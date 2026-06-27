import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  cleanOptionalString,
  cleanRequiredString,
  logActivity,
  requireBusinessWrite,
  requireCurrentOrganizationId,
} from "./app";
import { calculateMaterial } from "./materialCalculation";
import {
  assertCanCreateQuoteRevision,
  assertCanEditQuote,
  assertCanChangeQuoteStatus,
  assertCanConvertQuoteToInvoice,
  assertCanDeleteQuote,
  type MutableQuoteStatus,
} from "./documentLifecycle";
import { groupQuoteItemsByQuoteId, summarizeQuoteItems } from "./businessMetrics";

const quoteStatusValidator = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("accepted"),
  v.literal("refused"),
  v.literal("void"),
);

const itemKindValidator = v.union(v.literal("material"), v.literal("service"), v.literal("custom"));

export const list = query({
  args: {},
  handler: async (ctx) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const quotes = await ctx.db
      .query("quotes")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .take(100);
    const items = await ctx.db
      .query("quoteItems")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .take(1000);
    const itemsByQuoteId = groupQuoteItemsByQuoteId(items);

    return await Promise.all(
      quotes.map(async (quote) => ({
        ...quote,
        client: quote.clientId ? await ctx.db.get(quote.clientId) : null,
        business: summarizeQuoteItems(itemsByQuoteId.get(quote._id) ?? []),
      })),
    );
  },
});

export const get = query({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const quote = await ctx.db.get(args.quoteId);
    if (!quote || quote.organizationId !== organizationId) {
      return null;
    }

    const items = await ctx.db
      .query("quoteItems")
      .withIndex("by_quoteId_and_sortOrder", (q) => q.eq("quoteId", args.quoteId))
      .take(300);
    const emailEvents = await ctx.db
      .query("documentEmailEvents")
      .withIndex("by_quoteId_and_createdAt", (q) => q.eq("quoteId", args.quoteId))
      .order("desc")
      .take(20);
    const billing = await getQuoteBilling(ctx, quote);

    return {
      quote,
      client: quote.clientId ? await ctx.db.get(quote.clientId) : null,
      items,
      emailEvents,
      billing,
      business: summarizeQuoteItems(items),
    };
  },
});

export const createDraft = mutation({
  args: {
    clientId: v.optional(v.id("clients")),
    title: v.string(),
    siteDescription: v.optional(v.string()),
    deliveryAddress: v.optional(v.string()),
    operationType: v.optional(v.union(v.literal("goods"), v.literal("services"), v.literal("mixed"))),
    taxDebitOption: v.optional(v.boolean()),
    vatRate: v.optional(v.number()),
    issueDate: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    paymentTermsText: v.optional(v.string()),
    latePenaltyText: v.optional(v.string()),
    legalNotice: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    if (args.clientId) {
      await requireClient(ctx, organization._id, args.clientId);
    }

    const now = Date.now();
    const vatRate = args.vatRate ?? organization.defaultVatRate;
    const quoteId = await ctx.db.insert("quotes", {
      organizationId: organization._id,
      clientId: args.clientId,
      number: await nextDocumentNumber(ctx, organization._id, organization.quotePrefix ?? "D", "quotes"),
      title: cleanRequiredString(args.title, "Le titre du devis"),
      siteDescription: cleanOptionalString(args.siteDescription),
      deliveryAddress: cleanOptionalString(args.deliveryAddress),
      operationType: args.operationType ?? organization.defaultOperationType ?? "mixed",
      taxDebitOption: args.taxDebitOption ?? organization.taxDebitOption ?? false,
      status: "draft",
      totalHt: 0,
      totalTtc: 0,
      vatRate: clampRate(vatRate, "TVA"),
      issueDate: args.issueDate ?? now,
      validUntil: args.validUntil ?? now + Math.max(0, organization.quoteValidityDays ?? 30) * 24 * 60 * 60 * 1000,
      paymentTermsText: cleanOptionalString(args.paymentTermsText) ?? organization.paymentTermsText,
      latePenaltyText: cleanOptionalString(args.latePenaltyText) ?? organization.latePenaltyText,
      legalNotice: cleanOptionalString(args.legalNotice) ?? organization.legalNotice,
      notes: cleanOptionalString(args.notes),
      createdAt: now,
      updatedAt: now,
    });

    await logActivity(ctx, "quote.created", "quote", quoteId, `Devis cree: ${cleanRequiredString(args.title, "Le titre du devis")}`);
    return quoteId;
  },
});

export const updateDetails = mutation({
  args: {
    quoteId: v.id("quotes"),
    clientId: v.optional(v.id("clients")),
    title: v.string(),
    siteDescription: v.optional(v.string()),
    deliveryAddress: v.optional(v.string()),
    operationType: v.optional(v.union(v.literal("goods"), v.literal("services"), v.literal("mixed"))),
    taxDebitOption: v.optional(v.boolean()),
    vatRate: v.number(),
    issueDate: v.number(),
    validUntil: v.optional(v.number()),
    paymentTermsText: v.optional(v.string()),
    latePenaltyText: v.optional(v.string()),
    legalNotice: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const organizationId = organization._id;
    const quote = await requireQuote(ctx, organizationId, args.quoteId);
    assertCanEditQuote(quote.status);
    if (args.clientId) {
      await requireClient(ctx, organizationId, args.clientId);
    }

    await ctx.db.patch(args.quoteId, {
      clientId: args.clientId,
      title: cleanRequiredString(args.title, "Le titre du devis"),
      siteDescription: cleanOptionalString(args.siteDescription),
      deliveryAddress: cleanOptionalString(args.deliveryAddress),
      operationType: args.operationType,
      taxDebitOption: args.taxDebitOption ?? false,
      vatRate: clampRate(args.vatRate, "TVA"),
      issueDate: args.issueDate,
      validUntil: args.validUntil,
      paymentTermsText: cleanOptionalString(args.paymentTermsText),
      latePenaltyText: cleanOptionalString(args.latePenaltyText),
      legalNotice: cleanOptionalString(args.legalNotice),
      notes: cleanOptionalString(args.notes),
      updatedAt: Date.now(),
    });
    await recalculateQuoteTotals(ctx, args.quoteId);
    await logActivity(ctx, "quote.updated", "quote", args.quoteId, `Devis modifie: ${args.title}`);

    return args.quoteId;
  },
});

export const addItem = mutation({
  args: {
    quoteId: v.id("quotes"),
    kind: itemKindValidator,
    materialId: v.optional(v.id("materials")),
    serviceId: v.optional(v.id("services")),
    section: v.optional(v.string()),
    description: v.optional(v.string()),
    unit: v.optional(v.string()),
    quantity: v.number(),
    unitPriceHt: v.optional(v.number()),
    wasteRate: v.optional(v.number()),
    marginRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const organizationId = organization._id;
    await requireEditableQuote(ctx, organizationId, args.quoteId);
    const now = Date.now();
    const item = await normalizeQuoteItem(ctx, organizationId, args);
    const lastItem = await ctx.db
      .query("quoteItems")
      .withIndex("by_quoteId_and_sortOrder", (q) => q.eq("quoteId", args.quoteId))
      .order("desc")
      .take(1);

    const itemId = await ctx.db.insert("quoteItems", {
      organizationId,
      quoteId: args.quoteId,
      ...item,
      sortOrder: (lastItem[0]?.sortOrder ?? 0) + 10,
      createdAt: now,
      updatedAt: now,
    });
    await recalculateQuoteTotals(ctx, args.quoteId);
    await logActivity(ctx, "quote.item_added", "quote", args.quoteId, `Ligne ajoutee au devis: ${item.description}`);
    return itemId;
  },
});

export const updateItem = mutation({
  args: {
    itemId: v.id("quoteItems"),
    kind: itemKindValidator,
    materialId: v.optional(v.id("materials")),
    serviceId: v.optional(v.id("services")),
    section: v.optional(v.string()),
    description: v.optional(v.string()),
    unit: v.optional(v.string()),
    quantity: v.number(),
    unitPriceHt: v.optional(v.number()),
    wasteRate: v.optional(v.number()),
    marginRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const organizationId = organization._id;
    const existing = await ctx.db.get(args.itemId);
    if (!existing || existing.organizationId !== organizationId) {
      throw new Error("Ligne introuvable");
    }
    await requireEditableQuote(ctx, organizationId, existing.quoteId);

    const item = await normalizeQuoteItem(ctx, organizationId, { ...args, quoteId: existing.quoteId });
    await ctx.db.patch(args.itemId, {
      ...item,
      updatedAt: Date.now(),
    });
    await recalculateQuoteTotals(ctx, existing.quoteId);
    await logActivity(ctx, "quote.item_updated", "quote", existing.quoteId, `Ligne modifiee: ${item.description}`);
    return args.itemId;
  },
});

export const removeItem = mutation({
  args: { itemId: v.id("quoteItems") },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const organizationId = organization._id;
    const existing = await ctx.db.get(args.itemId);
    if (!existing || existing.organizationId !== organizationId) {
      throw new Error("Ligne introuvable");
    }
    await requireEditableQuote(ctx, organizationId, existing.quoteId);
    await ctx.db.delete(args.itemId);
    await recalculateQuoteTotals(ctx, existing.quoteId);
    await logActivity(ctx, "quote.item_removed", "quote", existing.quoteId, `Ligne supprimee: ${existing.description}`);
    return existing.quoteId;
  },
});

export const changeStatus = mutation({
  args: {
    quoteId: v.id("quotes"),
    status: quoteStatusValidator,
  },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const organizationId = organization._id;
    const quote = await requireQuote(ctx, organizationId, args.quoteId);
    assertCanChangeQuoteStatus(quote.status, args.status as MutableQuoteStatus);

    const now = Date.now();
    const updates: Partial<Doc<"quotes">> = {
      status: args.status,
      updatedAt: now,
    };
    if (args.status === "sent" && !quote.sentAt) {
      updates.sentAt = now;
    }
    if (args.status === "sent" && !quote.finalizedAt) {
      updates.finalizedAt = now;
    }
    if (args.status === "accepted" && !quote.acceptedAt) {
      updates.acceptedAt = now;
    }
    if (args.status === "accepted" && !quote.finalizedAt) {
      updates.finalizedAt = now;
    }
    if (args.status === "refused" && !quote.refusedAt) {
      updates.refusedAt = now;
    }
    if (args.status === "refused" && !quote.finalizedAt) {
      updates.finalizedAt = now;
    }
    if (args.status === "void" && !quote.voidedAt) {
      updates.voidedAt = now;
    }
    if (args.status === "void" && !quote.finalizedAt) {
      updates.finalizedAt = now;
    }

    await ctx.db.patch(args.quoteId, updates);
    await logActivity(ctx, "quote.status_changed", "quote", args.quoteId, `Statut devis: ${args.status}`);

    return args.quoteId;
  },
});

export const deleteDraft = mutation({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const organizationId = organization._id;
    const quote = await requireQuote(ctx, organizationId, args.quoteId);
    assertCanDeleteQuote(quote.status);

    const items = await ctx.db
      .query("quoteItems")
      .withIndex("by_quoteId_and_sortOrder", (q) => q.eq("quoteId", args.quoteId))
      .take(300);

    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    await ctx.db.delete(args.quoteId);
    await logActivity(ctx, "quote.deleted", "quote", args.quoteId, `Brouillon supprime: ${quote.number}`);
    return args.quoteId;
  },
});

export const createRevision = mutation({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const sourceQuote = await requireQuote(ctx, organization._id, args.quoteId);
    assertCanCreateQuoteRevision(sourceQuote.status);

    const now = Date.now();
    const revisionNumber = (sourceQuote.revisionNumber ?? 0) + 1;
    const newQuoteId = await ctx.db.insert("quotes", {
      organizationId: organization._id,
      clientId: sourceQuote.clientId,
      number: await nextDocumentNumber(ctx, organization._id, organization.quotePrefix ?? "D", "quotes"),
      title: `${sourceQuote.title} - revision ${revisionNumber}`,
      siteDescription: sourceQuote.siteDescription,
      deliveryAddress: sourceQuote.deliveryAddress,
      operationType: sourceQuote.operationType,
      taxDebitOption: sourceQuote.taxDebitOption,
      status: "draft",
      totalHt: 0,
      totalTtc: 0,
      vatRate: sourceQuote.vatRate,
      issueDate: now,
      validUntil: sourceQuote.validUntil,
      paymentTermsText: sourceQuote.paymentTermsText,
      latePenaltyText: sourceQuote.latePenaltyText,
      legalNotice: sourceQuote.legalNotice,
      notes: sourceQuote.notes,
      revisionOfQuoteId: sourceQuote.revisionOfQuoteId ?? sourceQuote._id,
      revisionNumber,
      createdAt: now,
      updatedAt: now,
    });

    const items = await ctx.db
      .query("quoteItems")
      .withIndex("by_quoteId_and_sortOrder", (q) => q.eq("quoteId", args.quoteId))
      .take(300);

    for (const item of items) {
      await ctx.db.insert("quoteItems", {
        organizationId: organization._id,
        quoteId: newQuoteId,
        kind: item.kind,
        materialId: item.materialId,
        serviceId: item.serviceId,
        section: item.section,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitPriceHt: item.unitPriceHt,
        wasteRate: item.wasteRate,
        marginRate: item.marginRate,
        quantityWithWaste: item.quantityWithWaste,
        purchasedQuantity: item.purchasedQuantity,
        deliveredPhysicalQuantity: item.deliveredPhysicalQuantity,
        wasteQuantity: item.wasteQuantity,
        realCostHt: item.realCostHt,
        totalHt: item.totalHt,
        sortOrder: item.sortOrder,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(sourceQuote._id, {
      supersededByQuoteId: newQuoteId,
      updatedAt: now,
    });
    await recalculateQuoteTotals(ctx, newQuoteId);
    await logActivity(ctx, "quote.revision_created", "quote", newQuoteId, `Revision creee depuis ${sourceQuote.number}`);
    return newQuoteId;
  },
});

export const createPublicLink = mutation({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const organizationId = organization._id;
    const quote = await requireQuote(ctx, organizationId, args.quoteId);
    if (quote.status === "draft") {
      throw new Error("Envoie le devis avant de creer un lien client.");
    }
    if (quote.status === "void") {
      throw new Error("Un devis annule ne peut pas etre partage.");
    }
    if (quote.status !== "sent" && !quote.clientDecision) {
      throw new Error("Le lien client se cree sur un devis envoye.");
    }

    const token = generatePublicToken();
    await ctx.db.patch(args.quoteId, {
      publicTokenHash: await sha256Hex(token),
      publicTokenCreatedAt: Date.now(),
      publicTokenRevokedAt: undefined,
      updatedAt: Date.now(),
    });
    await logActivity(ctx, "quote.public_link_created", "quote", args.quoteId, `Lien client cree pour ${quote.number}`);
    return { token };
  },
});

export const convertToInvoice = mutation({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const quote = await requireQuote(ctx, organization._id, args.quoteId);
    if (quote.convertedInvoiceId) {
      return quote.convertedInvoiceId;
    }
    assertCanConvertQuoteToInvoice(quote.status, quote.totalHt);

    const now = Date.now();
    const dueDate = now + Math.max(0, organization.paymentTermsDays ?? 30) * 24 * 60 * 60 * 1000;
    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: organization._id,
      quoteId: quote._id,
      clientId: quote.clientId,
      number: await nextDocumentNumber(ctx, organization._id, organization.invoicePrefix ?? "F", "invoices"),
      invoiceKind: "standard",
      deliveryAddress: quote.deliveryAddress,
      operationType: quote.operationType ?? organization.defaultOperationType ?? "mixed",
      taxDebitOption: quote.taxDebitOption ?? organization.taxDebitOption ?? false,
      status: "draft",
      totalHt: quote.totalHt,
      totalTtc: quote.totalTtc,
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
    await logActivity(ctx, "quote.invoiced", "quote", quote._id, `Facture creee depuis ${quote.number}`);

    return invoiceId;
  },
});

async function normalizeQuoteItem(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  args: {
    quoteId: Id<"quotes">;
    kind: "material" | "service" | "custom";
    materialId?: Id<"materials">;
    serviceId?: Id<"services">;
    section?: string;
    description?: string;
    unit?: string;
    quantity: number;
    unitPriceHt?: number;
    wasteRate?: number;
    marginRate?: number;
  },
) {
  if (!Number.isFinite(args.quantity) || args.quantity <= 0) {
    throw new Error("La quantité doit être supérieure à 0");
  }
  const marginRate = clampRate(args.marginRate ?? 0, "Marge");
  const wasteRate = args.wasteRate === undefined ? undefined : clampRate(args.wasteRate, "Perte");
  const unitPriceOverride = args.unitPriceHt === undefined ? undefined : normalizeMoneyInput(args.unitPriceHt, "Le prix unitaire");

  if (args.kind === "material") {
    if (!args.materialId) {
      throw new Error("Matériau requis");
    }
    const material = await ctx.db.get(args.materialId);
    if (!material || material.organizationId !== organizationId) {
      throw new Error("Matériau introuvable");
    }
    const materialWasteRate = wasteRate ?? material.defaultWasteRate;
    const unitPriceHt = unitPriceOverride ?? material.purchasePriceHt;
    const calculation = calculateMaterial({
      requestedQuantity: args.quantity,
      wasteRate: materialWasteRate,
      divisible: material.divisible,
      quantityPerLot: material.quantityPerLot,
      unitPriceHt,
    });

    return {
      kind: args.kind,
      materialId: material._id,
      serviceId: undefined,
      section: cleanOptionalString(args.section),
      description: cleanOptionalString(args.description) ?? material.name,
      unit: material.unit,
      quantity: round4(args.quantity),
      unitPriceHt: roundMoney(unitPriceHt),
      wasteRate: materialWasteRate,
      marginRate,
      quantityWithWaste: calculation.quantityWithWaste,
      purchasedQuantity: calculation.purchasedQuantity,
      deliveredPhysicalQuantity: calculation.deliveredPhysicalQuantity,
      wasteQuantity: calculation.waste,
      realCostHt: calculation.totalHt,
      totalHt: roundMoney(calculation.totalHt * (1 + marginRate / 100)),
    };
  }

  if (args.kind === "service") {
    if (!args.serviceId) {
      throw new Error("Prestation requise");
    }
    const service = await ctx.db.get(args.serviceId);
    if (!service || service.organizationId !== organizationId) {
      throw new Error("Prestation introuvable");
    }
    const unitPriceHt = unitPriceOverride ?? service.unitPriceHt;
    return {
      kind: args.kind,
      materialId: undefined,
      serviceId: service._id,
      section: cleanOptionalString(args.section),
      description: cleanOptionalString(args.description) ?? service.name,
      unit: service.unit,
      quantity: round4(args.quantity),
      unitPriceHt: roundMoney(unitPriceHt),
      wasteRate: 0,
      marginRate,
      quantityWithWaste: round4(args.quantity),
      purchasedQuantity: round4(args.quantity),
      deliveredPhysicalQuantity: round4(args.quantity),
      wasteQuantity: 0,
      realCostHt: roundMoney(args.quantity * unitPriceHt),
      totalHt: roundMoney(args.quantity * unitPriceHt * (1 + marginRate / 100)),
    };
  }

  const customWasteRate = wasteRate ?? 0;
  const unitPriceHt = unitPriceOverride ?? 0;
  if (!Number.isFinite(unitPriceHt) || unitPriceHt < 0) {
    throw new Error("Le prix unitaire doit être positif");
  }

  return {
    kind: args.kind,
    materialId: undefined,
    serviceId: undefined,
    section: cleanOptionalString(args.section),
    description: cleanRequiredString(args.description ?? "", "La description"),
    unit: cleanRequiredString(args.unit ?? "", "L'unité"),
    quantity: round4(args.quantity),
    unitPriceHt: roundMoney(unitPriceHt),
    wasteRate: customWasteRate,
    marginRate,
    quantityWithWaste: round4(args.quantity * (1 + customWasteRate / 100)),
    purchasedQuantity: round4(args.quantity * (1 + customWasteRate / 100)),
    deliveredPhysicalQuantity: round4(args.quantity * (1 + customWasteRate / 100)),
    wasteQuantity: round4(args.quantity * (customWasteRate / 100)),
    realCostHt: roundMoney(args.quantity * unitPriceHt * (1 + customWasteRate / 100)),
    totalHt: roundMoney(args.quantity * unitPriceHt * (1 + (customWasteRate + marginRate) / 100)),
  };
}

async function recalculateQuoteTotals(ctx: MutationCtx, quoteId: Id<"quotes">) {
  const quote = await ctx.db.get(quoteId);
  if (!quote) {
    throw new Error("Devis introuvable");
  }
  const items = await ctx.db
    .query("quoteItems")
    .withIndex("by_quoteId", (q) => q.eq("quoteId", quoteId))
    .take(500);
  const totalHt = roundMoney(items.reduce((sum, item) => sum + item.totalHt, 0));
  const totalTtc = roundMoney(totalHt * (1 + quote.vatRate / 100));
  await ctx.db.patch(quoteId, {
    totalHt,
    totalTtc,
    updatedAt: Date.now(),
  });
}

async function getQuoteBilling(ctx: QueryCtx, quote: Doc<"quotes">) {
  const invoices = await ctx.db
    .query("invoices")
    .withIndex("by_organizationId_and_quoteId", (q) =>
      q.eq("organizationId", quote.organizationId).eq("quoteId", quote._id),
    )
    .take(100);
  const activeInvoices = invoices.filter((invoice) => invoice.status !== "void");
  const issuedDeposits = activeInvoices.filter((invoice) => invoice.invoiceKind === "deposit" && invoice.status !== "draft");
  const depositIssuedHt = roundMoney(issuedDeposits.reduce((sum, invoice) => sum + invoice.totalHt, 0));
  const depositIssuedTtc = roundMoney(issuedDeposits.reduce((sum, invoice) => sum + invoice.totalTtc, 0));
  const finalInvoice = activeInvoices.find((invoice) => invoice.invoiceKind === "standard" || invoice.invoiceKind === "balance") ?? null;
  return {
    depositIssuedHt,
    depositIssuedTtc,
    remainingToInvoiceHt: roundMoney(Math.max(0, quote.totalHt - depositIssuedHt)),
    remainingToInvoiceTtc: roundMoney(Math.max(0, quote.totalTtc - depositIssuedTtc)),
    hasIssuedDeposits: depositIssuedTtc > 0,
    canCreateBalance: quote.status === "accepted" && depositIssuedTtc > 0 && depositIssuedTtc < quote.totalTtc - 0.01 && !finalInvoice,
    finalInvoiceId: finalInvoice?._id,
  };
}

async function requireEditableQuote(ctx: QueryCtx | MutationCtx, organizationId: Id<"organizations">, quoteId: Id<"quotes">) {
  const quote = await requireQuote(ctx, organizationId, quoteId);
  assertCanEditQuote(quote.status);
  return quote;
}

async function requireQuote(ctx: QueryCtx | MutationCtx, organizationId: Id<"organizations">, quoteId: Id<"quotes">) {
  const quote = await ctx.db.get(quoteId);
  if (!quote || quote.organizationId !== organizationId) {
    throw new Error("Devis introuvable");
  }
  return quote;
}

async function requireClient(ctx: QueryCtx | MutationCtx, organizationId: Id<"organizations">, clientId: Id<"clients">) {
  const client = await ctx.db.get(clientId);
  if (!client || client.organizationId !== organizationId) {
    throw new Error("Client introuvable");
  }
  return client;
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
    throw new Error(`${label} doit être compris entre 0 et 100`);
  }
  return Math.round(value * 100) / 100;
}

function normalizeMoneyInput(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} doit etre positif`);
  }
  return roundMoney(value);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000;
}

function generatePublicToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
