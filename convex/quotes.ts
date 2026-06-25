import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  cleanOptionalString,
  cleanRequiredString,
  requireCurrentMembership,
  requireCurrentOrganizationId,
} from "./app";
import { calculateMaterial } from "./materialCalculation";

const quoteStatusValidator = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("accepted"),
  v.literal("refused"),
  v.literal("invoiced"),
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

    return await Promise.all(
      quotes.map(async (quote) => ({
        ...quote,
        client: quote.clientId ? await ctx.db.get(quote.clientId) : null,
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

    return {
      quote,
      client: quote.clientId ? await ctx.db.get(quote.clientId) : null,
      items,
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
    const { organization } = await requireCurrentMembership(ctx);
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
    const organizationId = await requireCurrentOrganizationId(ctx);
    const quote = await requireQuote(ctx, organizationId, args.quoteId);
    if (quote.status === "invoiced") {
      throw new Error("Un devis facturé ne peut plus être modifié");
    }
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

    return args.quoteId;
  },
});

export const duplicate = mutation({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, args) => {
    const { organization } = await requireCurrentMembership(ctx);
    const sourceQuote = await requireQuote(ctx, organization._id, args.quoteId);
    const now = Date.now();

    const newQuoteId = await ctx.db.insert("quotes", {
      organizationId: organization._id,
      clientId: sourceQuote.clientId,
      number: await nextDocumentNumber(ctx, organization._id, organization.quotePrefix ?? "D", "quotes"),
      title: `Copie - ${sourceQuote.title}`,
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

    await recalculateQuoteTotals(ctx, newQuoteId);
    return newQuoteId;
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
    const organizationId = await requireCurrentOrganizationId(ctx);
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
    const organizationId = await requireCurrentOrganizationId(ctx);
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
    return args.itemId;
  },
});

export const removeItem = mutation({
  args: { itemId: v.id("quoteItems") },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const existing = await ctx.db.get(args.itemId);
    if (!existing || existing.organizationId !== organizationId) {
      throw new Error("Ligne introuvable");
    }
    await requireEditableQuote(ctx, organizationId, existing.quoteId);
    await ctx.db.delete(args.itemId);
    await recalculateQuoteTotals(ctx, existing.quoteId);
    return existing.quoteId;
  },
});

export const changeStatus = mutation({
  args: {
    quoteId: v.id("quotes"),
    status: quoteStatusValidator,
  },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const quote = await requireQuote(ctx, organizationId, args.quoteId);
    if (quote.status === "invoiced" && args.status !== "invoiced") {
      throw new Error("Un devis facturé ne peut pas revenir en arrière");
    }

    await ctx.db.patch(args.quoteId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return args.quoteId;
  },
});

export const convertToInvoice = mutation({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, args) => {
    const { organization } = await requireCurrentMembership(ctx);
    const quote = await requireQuote(ctx, organization._id, args.quoteId);
    if (quote.convertedInvoiceId) {
      return quote.convertedInvoiceId;
    }
    if (quote.totalHt <= 0) {
      throw new Error("Impossible de facturer un devis vide");
    }

    const now = Date.now();
    const dueDate = now + Math.max(0, organization.paymentTermsDays ?? 30) * 24 * 60 * 60 * 1000;
    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: organization._id,
      quoteId: quote._id,
      clientId: quote.clientId,
      number: await nextDocumentNumber(ctx, organization._id, organization.invoicePrefix ?? "F", "invoices"),
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
      updatedAt: now,
    });

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
  const wasteRate = clampRate(args.wasteRate ?? 0, "Perte");

  if (args.kind === "material") {
    if (!args.materialId) {
      throw new Error("Matériau requis");
    }
    const material = await ctx.db.get(args.materialId);
    if (!material || material.organizationId !== organizationId) {
      throw new Error("Matériau introuvable");
    }
    const calculation = calculateMaterial({
      requestedQuantity: args.quantity,
      wasteRate: args.wasteRate ?? material.defaultWasteRate,
      divisible: material.divisible,
      quantityPerLot: material.quantityPerLot,
      unitPriceHt: args.unitPriceHt ?? material.purchasePriceHt,
    });

    return {
      kind: args.kind,
      materialId: material._id,
      serviceId: undefined,
      section: cleanOptionalString(args.section),
      description: cleanOptionalString(args.description) ?? material.name,
      unit: material.unit,
      quantity: round4(args.quantity),
      unitPriceHt: roundMoney(args.unitPriceHt ?? material.purchasePriceHt),
      wasteRate: args.wasteRate ?? material.defaultWasteRate,
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
    const unitPriceHt = args.unitPriceHt ?? service.unitPriceHt;
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

  const unitPriceHt = args.unitPriceHt ?? 0;
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
    wasteRate,
    marginRate,
    quantityWithWaste: round4(args.quantity * (1 + wasteRate / 100)),
    purchasedQuantity: round4(args.quantity * (1 + wasteRate / 100)),
    deliveredPhysicalQuantity: round4(args.quantity * (1 + wasteRate / 100)),
    wasteQuantity: round4(args.quantity * (wasteRate / 100)),
    realCostHt: roundMoney(args.quantity * unitPriceHt * (1 + wasteRate / 100)),
    totalHt: roundMoney(args.quantity * unitPriceHt * (1 + (wasteRate + marginRate) / 100)),
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

async function requireEditableQuote(ctx: QueryCtx | MutationCtx, organizationId: Id<"organizations">, quoteId: Id<"quotes">) {
  const quote = await requireQuote(ctx, organizationId, quoteId);
  if (quote.status === "invoiced") {
    throw new Error("Un devis facturé ne peut plus être modifié");
  }
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

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000;
}
