import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { cleanOptionalString, logActivity, requireBusinessWrite, requireCurrentOrganizationId } from "./app";
import {
  assertCanCreateInvoiceCreditNote,
  assertCanRecordInvoicePayment,
  assertCanUpdateInvoiceStatus,
  assertValidPaymentAmount,
  type MutableInvoiceStatus,
} from "./documentLifecycle";

const invoiceStatusValidator = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("partially_paid"),
  v.literal("paid"),
  v.literal("overdue"),
  v.literal("void"),
);

export const list = query({
  args: {},
  handler: async (ctx) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .take(100);
    const payments = await ctx.db
      .query("invoicePayments")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .take(1000);
    const paymentsByInvoiceId = groupPaymentsByInvoiceId(payments);
    const emailEvents = await ctx.db
      .query("documentEmailEvents")
      .withIndex("by_organizationId_and_createdAt", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .take(1000);
    const emailEventsByInvoiceId = groupEmailEventsByInvoiceId(emailEvents);

    return await Promise.all(
      invoices.map(async (invoice) => {
        const invoicePayments = paymentsByInvoiceId.get(invoice._id) ?? [];
        const invoiceEmailEvents = emailEventsByInvoiceId.get(invoice._id) ?? [];
        const reminders = invoiceEmailEvents.filter((event) => event.eventKind === "reminder");
        const summary = paymentSummary(invoice, invoicePayments);
        return {
          ...invoice,
          ...summary,
          payments: invoicePayments,
          reminderCount: reminders.length,
          lastReminderAt: reminders[0]?.createdAt,
          client: invoice.clientId ? await ctx.db.get(invoice.clientId) : null,
          quote: invoice.quoteId ? await ctx.db.get(invoice.quoteId) : null,
          creditInvoice: invoice.creditInvoiceId ? await ctx.db.get(invoice.creditInvoiceId) : null,
          creditedInvoice: invoice.creditedInvoiceId ? await ctx.db.get(invoice.creditedInvoiceId) : null,
        };
      }),
    );
  },
});

export const get = query({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.organizationId !== organizationId) {
      return null;
    }

    const items = invoice.quoteId && (!invoice.invoiceKind || invoice.invoiceKind === "standard")
      ? await ctx.db
          .query("quoteItems")
          .withIndex("by_quoteId_and_sortOrder", (q) => q.eq("quoteId", invoice.quoteId!))
          .take(300)
      : [];
    const emailEvents = await ctx.db
      .query("documentEmailEvents")
      .withIndex("by_invoiceId_and_createdAt", (q) => q.eq("invoiceId", args.invoiceId))
      .order("desc")
      .take(20);
    const payments = await ctx.db
      .query("invoicePayments")
      .withIndex("by_invoiceId_and_paidAt", (q) => q.eq("invoiceId", args.invoiceId))
      .order("desc")
      .take(100);

    return {
      invoice,
      client: invoice.clientId ? await ctx.db.get(invoice.clientId) : null,
      quote: invoice.quoteId ? await ctx.db.get(invoice.quoteId) : null,
      creditInvoice: invoice.creditInvoiceId ? await ctx.db.get(invoice.creditInvoiceId) : null,
      creditedInvoice: invoice.creditedInvoiceId ? await ctx.db.get(invoice.creditedInvoiceId) : null,
      items,
      emailEvents,
      payments,
      reminderCount: emailEvents.filter((event) => event.eventKind === "reminder").length,
      lastReminderAt: emailEvents.find((event) => event.eventKind === "reminder")?.createdAt,
      ...paymentSummary(invoice, payments),
    };
  },
});

export const createDepositFromQuote = mutation({
  args: {
    quoteId: v.id("quotes"),
    depositRate: v.number(),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const quote = await ctx.db.get(args.quoteId);
    if (!quote || quote.organizationId !== organization._id) {
      throw new Error("Devis introuvable");
    }
    if (quote.status !== "accepted" && quote.status !== "invoiced") {
      throw new Error("Un acompte se cree depuis un devis accepte");
    }
    if (quote.totalHt <= 0) {
      throw new Error("Impossible de creer un acompte sur un devis vide");
    }
    const depositRate = clampRate(args.depositRate, "Acompte");
    if (depositRate <= 0) {
      throw new Error("Le taux d'acompte doit etre superieur a 0");
    }

    const now = Date.now();
    const totalHt = roundMoney(quote.totalHt * depositRate / 100);
    const totalTtc = roundMoney(quote.totalTtc * depositRate / 100);
    const dueDate = now + Math.max(0, organization.paymentTermsDays ?? 30) * 24 * 60 * 60 * 1000;
    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: organization._id,
      quoteId: quote._id,
      clientId: quote.clientId,
      number: await nextDocumentNumber(ctx, organization._id, organization.invoicePrefix ?? "F", "invoices"),
      invoiceKind: "deposit",
      depositRate,
      deliveryAddress: quote.deliveryAddress,
      operationType: quote.operationType ?? organization.defaultOperationType ?? "mixed",
      taxDebitOption: quote.taxDebitOption ?? organization.taxDebitOption ?? false,
      status: "draft",
      totalHt,
      totalTtc,
      vatRate: quote.vatRate,
      issueDate: now,
      serviceDate: now,
      dueDate,
      paymentTermsText: quote.paymentTermsText ?? organization.paymentTermsText,
      latePenaltyText: quote.latePenaltyText ?? organization.latePenaltyText,
      legalNotice: quote.legalNotice ?? organization.legalNotice,
      bankDetails: organization.bankDetails,
      createdAt: now,
      updatedAt: now,
    });

    await logActivity(ctx, "invoice.deposit_created", "invoice", invoiceId, `Facture d'acompte ${depositRate}% creee depuis ${quote.number}`);
    return invoiceId;
  },
});

export const createBalanceFromQuote = mutation({
  args: {
    quoteId: v.id("quotes"),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const quote = await ctx.db.get(args.quoteId);
    if (!quote || quote.organizationId !== organization._id) {
      throw new Error("Devis introuvable");
    }
    if (quote.convertedInvoiceId) {
      return quote.convertedInvoiceId;
    }
    if (quote.status !== "accepted" && quote.status !== "invoiced") {
      throw new Error("Une facture de solde se cree depuis un devis accepte");
    }
    if (quote.totalHt <= 0) {
      throw new Error("Impossible de creer un solde sur un devis vide");
    }

    const linkedInvoices = await ctx.db
      .query("invoices")
      .withIndex("by_organizationId_and_quoteId", (q) =>
        q.eq("organizationId", organization._id).eq("quoteId", quote._id),
      )
      .take(100);
    const existingFinalInvoice = linkedInvoices.find(
      (invoice) => invoice.status !== "void" && (invoice.invoiceKind === "standard" || invoice.invoiceKind === "balance"),
    );
    if (existingFinalInvoice) {
      return existingFinalInvoice._id;
    }

    const issuedDeposits = linkedInvoices.filter(
      (invoice) => invoice.invoiceKind === "deposit" && invoice.status !== "draft" && invoice.status !== "void",
    );
    const deductedDepositHt = roundMoney(issuedDeposits.reduce((sum, invoice) => sum + invoice.totalHt, 0));
    const deductedDepositTtc = roundMoney(issuedDeposits.reduce((sum, invoice) => sum + invoice.totalTtc, 0));
    if (deductedDepositTtc <= 0) {
      throw new Error("Aucun acompte emis a deduire pour ce devis");
    }
    if (deductedDepositTtc >= quote.totalTtc - 0.01) {
      throw new Error("Les acomptes couvrent deja le total du devis");
    }

    const totalHt = roundMoney(Math.max(0, quote.totalHt - deductedDepositHt));
    const totalTtc = roundMoney(Math.max(0, quote.totalTtc - deductedDepositTtc));
    const now = Date.now();
    const dueDate = now + Math.max(0, organization.paymentTermsDays ?? 30) * 24 * 60 * 60 * 1000;
    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: organization._id,
      quoteId: quote._id,
      clientId: quote.clientId,
      number: await nextDocumentNumber(ctx, organization._id, organization.invoicePrefix ?? "F", "invoices"),
      invoiceKind: "balance",
      sourceQuoteTotalHt: quote.totalHt,
      sourceQuoteTotalTtc: quote.totalTtc,
      deductedDepositHt,
      deductedDepositTtc,
      deliveryAddress: quote.deliveryAddress,
      operationType: quote.operationType ?? organization.defaultOperationType ?? "mixed",
      taxDebitOption: quote.taxDebitOption ?? organization.taxDebitOption ?? false,
      status: "draft",
      totalHt,
      totalTtc,
      vatRate: quote.vatRate,
      issueDate: now,
      serviceDate: now,
      dueDate,
      paymentTermsText: quote.paymentTermsText ?? organization.paymentTermsText,
      latePenaltyText: quote.latePenaltyText ?? organization.latePenaltyText,
      legalNotice: quote.legalNotice ?? organization.legalNotice,
      bankDetails: organization.bankDetails,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(quote._id, {
      status: "invoiced",
      convertedInvoiceId: invoiceId,
      invoicedAt: now,
      finalizedAt: quote.finalizedAt ?? now,
      updatedAt: now,
    });
    await logActivity(ctx, "invoice.balance_created", "invoice", invoiceId, `Facture de solde creee depuis ${quote.number}`);
    return invoiceId;
  },
});

export const createCreditNoteFromInvoice = mutation({
  args: {
    invoiceId: v.id("invoices"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.organizationId !== organization._id) {
      throw new Error("Facture introuvable");
    }
    assertCanCreateInvoiceCreditNote(invoice.status, invoice.invoiceKind);
    if (invoice.creditInvoiceId) {
      return invoice.creditInvoiceId;
    }

    const existingCredit = await ctx.db
      .query("invoices")
      .withIndex("by_organizationId_and_creditedInvoiceId", (q) =>
        q.eq("organizationId", organization._id).eq("creditedInvoiceId", invoice._id),
      )
      .take(10);
    const linkedCredit = existingCredit.find((row) => row.status !== "void");
    if (linkedCredit) {
      await ctx.db.patch(invoice._id, { creditInvoiceId: linkedCredit._id, updatedAt: Date.now() });
      return linkedCredit._id;
    }

    const now = Date.now();
    const creditId = await ctx.db.insert("invoices", {
      organizationId: organization._id,
      quoteId: invoice.quoteId,
      clientId: invoice.clientId,
      number: await nextDocumentNumber(ctx, organization._id, organization.invoicePrefix ?? "F", "invoices"),
      invoiceKind: "credit",
      creditedInvoiceId: invoice._id,
      deliveryAddress: invoice.deliveryAddress,
      operationType: invoice.operationType ?? organization.defaultOperationType ?? "mixed",
      taxDebitOption: invoice.taxDebitOption ?? organization.taxDebitOption ?? false,
      status: "draft",
      totalHt: -Math.abs(invoice.totalHt),
      totalTtc: -Math.abs(invoice.totalTtc),
      vatRate: invoice.vatRate,
      issueDate: now,
      serviceDate: invoice.serviceDate ?? invoice.issueDate,
      dueDate: now,
      paymentTermsText: invoice.paymentTermsText ?? organization.paymentTermsText,
      latePenaltyText: invoice.latePenaltyText ?? organization.latePenaltyText,
      legalNotice: cleanOptionalString(args.reason) ?? `Avoir lie a la facture ${invoice.number}`,
      bankDetails: invoice.bankDetails ?? organization.bankDetails,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(invoice._id, {
      creditInvoiceId: creditId,
      updatedAt: now,
    });
    await logActivity(ctx, "invoice.credit_created", "invoice", creditId, `Avoir cree depuis ${invoice.number}`);
    return creditId;
  },
});

export const updateStatus = mutation({
  args: {
    invoiceId: v.id("invoices"),
    status: invoiceStatusValidator,
  },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const organizationId = organization._id;
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.organizationId !== organizationId) {
      throw new Error("Facture introuvable");
    }
    assertCanUpdateInvoiceStatus(invoice.status, args.status as MutableInvoiceStatus, !!invoice.paidAt);

    const now = Date.now();
    const updates: Partial<Doc<"invoices">> = {
      status: args.status,
      updatedAt: now,
    };
    if (args.status === "sent" && !invoice.sentAt) {
      updates.sentAt = now;
    }
    if ((args.status === "sent" || args.status === "void") && !invoice.finalizedAt) {
      updates.finalizedAt = now;
    }
    if (args.status === "void" && !invoice.voidedAt) {
      updates.voidedAt = now;
    }

    await ctx.db.patch(args.invoiceId, updates);
    if (args.status === "sent" && invoice.invoiceKind === "credit" && invoice.creditedInvoiceId) {
      await ctx.db.patch(invoice.creditedInvoiceId, {
        status: "void",
        creditInvoiceId: args.invoiceId,
        voidedAt: now,
        updatedAt: now,
      });
    }
    await logActivity(ctx, "invoice.status_changed", "invoice", args.invoiceId, `Statut facture: ${args.status}`);

    return args.invoiceId;
  },
});

export const recordPayment = mutation({
  args: {
    invoiceId: v.id("invoices"),
    amountTtc: v.number(),
    paidAt: v.optional(v.number()),
    paymentMethod: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const organizationId = organization._id;
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.organizationId !== organizationId) {
      throw new Error("Facture introuvable");
    }
    const paidAt = args.paidAt ?? Date.now();
    assertCanRecordInvoicePayment(invoice.status, paidAt);
    const existingPayments = await ctx.db
      .query("invoicePayments")
      .withIndex("by_invoiceId_and_paidAt", (q) => q.eq("invoiceId", args.invoiceId))
      .take(100);
    const summary = paymentSummary(invoice, existingPayments);
    assertValidPaymentAmount(args.amountTtc, summary.remainingTtc);

    const amountTtc = roundMoney(args.amountTtc);
    const newPaidTotal = roundMoney(summary.paidTotalTtc + amountTtc);
    const isFullyPaid = newPaidTotal >= invoice.totalTtc - 0.01;
    const now = Date.now();

    await ctx.db.insert("invoicePayments", {
      organizationId,
      invoiceId: args.invoiceId,
      amountTtc,
      paidAt,
      paymentMethod: cleanOptionalString(args.paymentMethod),
      paymentReference: cleanOptionalString(args.paymentReference),
      notes: cleanOptionalString(args.notes),
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.invoiceId, {
      status: isFullyPaid ? "paid" : "partially_paid",
      paidAt,
      finalizedAt: isFullyPaid ? invoice.finalizedAt ?? now : invoice.finalizedAt,
      paymentMethod: cleanOptionalString(args.paymentMethod),
      paymentReference: cleanOptionalString(args.paymentReference),
      updatedAt: now,
    });
    await logActivity(ctx, isFullyPaid ? "invoice.paid" : "invoice.partially_paid", "invoice", args.invoiceId, `Paiement enregistre sur ${invoice.number}: ${amountTtc.toLocaleString("fr-FR")} EUR`);

    return args.invoiceId;
  },
});

function groupPaymentsByInvoiceId(payments: Doc<"invoicePayments">[]) {
  const rows = new Map<Id<"invoices">, Doc<"invoicePayments">[]>();
  for (const payment of payments) {
    const existing = rows.get(payment.invoiceId) ?? [];
    existing.push(payment);
    rows.set(payment.invoiceId, existing);
  }
  return rows;
}

function groupEmailEventsByInvoiceId(events: Doc<"documentEmailEvents">[]) {
  const rows = new Map<Id<"invoices">, Doc<"documentEmailEvents">[]>();
  for (const event of events) {
    if (!event.invoiceId) {
      continue;
    }
    const existing = rows.get(event.invoiceId) ?? [];
    existing.push(event);
    rows.set(event.invoiceId, existing);
  }
  return rows;
}

function paymentSummary(invoice: Doc<"invoices">, payments: Doc<"invoicePayments">[]) {
  const explicitPaidTotal = roundMoney(payments.reduce((sum, payment) => sum + payment.amountTtc, 0));
  const paidTotalTtc = payments.length === 0 && invoice.status === "paid" ? invoice.totalTtc : explicitPaidTotal;
  return {
    paidTotalTtc,
    remainingTtc: roundMoney(Math.max(0, invoice.totalTtc - paidTotalTtc)),
    paymentCount: payments.length,
  };
}

async function nextDocumentNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  prefix: string,
  table: "quotes" | "invoices",
) {
  const now = Date.now();
  const year = new Date(now).getFullYear();
  const normalizedPrefix = cleanOptionalString(prefix)?.toUpperCase() ?? (table === "quotes" ? "D" : "F");
  const base = `${normalizedPrefix}-${year}-`;

  const sequences = await ctx.db
    .query("documentSequences")
    .withIndex("by_organizationId_and_kind_and_year", (q) =>
      q.eq("organizationId", organizationId).eq("kind", table).eq("year", year),
    )
    .take(20);

  if (sequences.length > 0) {
    const value = Math.max(1, ...sequences.map((sequence) => Math.round(sequence.nextNumber)));
    const [primary, ...duplicates] = sequences;
    await ctx.db.patch(primary._id, {
      nextNumber: value + 1,
      updatedAt: now,
    });
    for (const duplicate of duplicates) {
      await ctx.db.patch(duplicate._id, {
        nextNumber: value + 1,
        updatedAt: now,
      });
    }
    return `${base}${String(value).padStart(3, "0")}`;
  }

  const rows = await ctx.db
    .query(table)
    .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
    .order("desc")
    .take(500);
  const existingMax = rows.reduce((max, row) => {
    if (!row.number.startsWith(base)) {
      return max;
    }
    const value = Number(row.number.slice(base.length));
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  const value = existingMax + 1;

  await ctx.db.insert("documentSequences", {
    organizationId,
    kind: table,
    year,
    nextNumber: value + 1,
    createdAt: now,
    updatedAt: now,
  });

  return `${base}${String(value).padStart(3, "0")}`;
}

function clampRate(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label} doit etre compris entre 0 et 100`);
  }
  return Math.round(value * 100) / 100;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
