import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  const user = userId ? await ctx.db.get(userId) : null;
  if (!user) {
    throw new Error("Authentification requise");
  }

  return user;
}

async function getCurrentMembership(ctx: QueryCtx | MutationCtx) {
  const user = await requireUser(ctx);
  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .unique();

  if (!membership) {
    return null;
  }

  const organization = await ctx.db.get(membership.organizationId);
  if (!organization) {
    throw new Error("Organisation introuvable");
  }

  return { user, membership, organization };
}

export function cleanOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function cleanRequiredString(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} est obligatoire`);
  }
  return trimmed;
}

export async function requireCurrentMembership(ctx: QueryCtx | MutationCtx) {
  const currentMembership = await getCurrentMembership(ctx);
  if (!currentMembership) {
    throw new Error("Organisation requise");
  }
  return currentMembership;
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return { user: null, organization: null, membership: null };
    }

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    const organization = membership ? await ctx.db.get(membership.organizationId) : null;

    return { user, organization, membership };
  },
});

export const createOrganization = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existingMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (existingMembership) {
      return existingMembership.organizationId;
    }

    const now = Date.now();
    const organizationId = await ctx.db.insert("organizations", {
      name: cleanRequiredString(args.name, "Le nom de l'entreprise"),
      defaultVatRate: 20,
      defaultMarginRate: 0,
      quotePrefix: "D",
      invoicePrefix: "F",
      paymentTermsDays: 30,
      quoteValidityDays: 30,
      defaultOperationType: "mixed",
      taxDebitOption: false,
      paymentTermsText: "Acompte de 30% a la commande, solde a la reception des travaux.",
      latePenaltyText: "Penalites de retard selon le taux legal en vigueur. Indemnite forfaitaire de recouvrement: 40 EUR.",
      discountTermsText: "Escompte pour paiement anticipe: neant.",
      quotePricingText: "Devis gratuit.",
      legalNotice: "Devis valable sous reserve de disponibilite des materiaux et d'acces normal au chantier.",
      acceptanceText: "Bon pour accord, date et signature precedees de la mention manuscrite.",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("organizationMembers", {
      organizationId,
      userId: user._id,
      role: "owner",
      createdAt: now,
    });

    const year = new Date(now).getFullYear();
    await ctx.db.insert("documentSequences", {
      organizationId,
      kind: "quotes",
      year,
      nextNumber: 1,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("documentSequences", {
      organizationId,
      kind: "invoices",
      year,
      nextNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    return organizationId;
  },
});

export const updateOrganization = mutation({
  args: {
    name: v.string(),
    legalName: v.optional(v.string()),
    legalForm: v.optional(v.string()),
    shareCapital: v.optional(v.string()),
    siren: v.optional(v.string()),
    siret: v.optional(v.string()),
    vatNumber: v.optional(v.string()),
    apeCode: v.optional(v.string()),
    registerNumber: v.optional(v.string()),
    registerCity: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    defaultVatRate: v.number(),
    defaultHourlyRate: v.optional(v.number()),
    defaultMarginRate: v.optional(v.number()),
    quotePrefix: v.optional(v.string()),
    invoicePrefix: v.optional(v.string()),
    paymentTermsDays: v.optional(v.number()),
    quoteValidityDays: v.optional(v.number()),
    paymentTermsText: v.optional(v.string()),
    latePenaltyText: v.optional(v.string()),
    discountTermsText: v.optional(v.string()),
    taxExemptionText: v.optional(v.string()),
    quotePricingText: v.optional(v.string()),
    legalNotice: v.optional(v.string()),
    bankDetails: v.optional(v.string()),
    defaultOperationType: v.optional(v.union(v.literal("goods"), v.literal("services"), v.literal("mixed"))),
    taxDebitOption: v.optional(v.boolean()),
    professionalInsurance: v.optional(v.string()),
    mediatorInfo: v.optional(v.string()),
    acceptanceText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireCurrentMembership(ctx);
    const now = Date.now();

    await ctx.db.patch(organization._id, {
      name: cleanRequiredString(args.name, "Le nom de l'entreprise"),
      legalName: cleanOptionalString(args.legalName),
      legalForm: cleanOptionalString(args.legalForm),
      shareCapital: cleanOptionalString(args.shareCapital),
      siren: cleanOptionalString(args.siren),
      siret: cleanOptionalString(args.siret),
      vatNumber: cleanOptionalString(args.vatNumber),
      apeCode: cleanOptionalString(args.apeCode),
      registerNumber: cleanOptionalString(args.registerNumber),
      registerCity: cleanOptionalString(args.registerCity),
      email: cleanOptionalString(args.email),
      phone: cleanOptionalString(args.phone),
      address: cleanOptionalString(args.address),
      postalCode: cleanOptionalString(args.postalCode),
      city: cleanOptionalString(args.city),
      country: cleanOptionalString(args.country),
      logoUrl: cleanOptionalString(args.logoUrl),
      defaultVatRate: clampRate(args.defaultVatRate, "TVA"),
      defaultHourlyRate: args.defaultHourlyRate === undefined ? undefined : roundPositive(args.defaultHourlyRate, "Taux horaire"),
      defaultMarginRate: args.defaultMarginRate === undefined ? undefined : clampRate(args.defaultMarginRate, "Marge"),
      quotePrefix: cleanOptionalString(args.quotePrefix),
      invoicePrefix: cleanOptionalString(args.invoicePrefix),
      paymentTermsDays: Math.max(0, Math.round(args.paymentTermsDays ?? 30)),
      quoteValidityDays: Math.max(0, Math.round(args.quoteValidityDays ?? 30)),
      paymentTermsText: cleanOptionalString(args.paymentTermsText),
      latePenaltyText: cleanOptionalString(args.latePenaltyText),
      discountTermsText: cleanOptionalString(args.discountTermsText),
      taxExemptionText: cleanOptionalString(args.taxExemptionText),
      quotePricingText: cleanOptionalString(args.quotePricingText),
      legalNotice: cleanOptionalString(args.legalNotice),
      bankDetails: cleanOptionalString(args.bankDetails),
      defaultOperationType: args.defaultOperationType ?? organization.defaultOperationType ?? "mixed",
      taxDebitOption: args.taxDebitOption ?? false,
      professionalInsurance: cleanOptionalString(args.professionalInsurance),
      mediatorInfo: cleanOptionalString(args.mediatorInfo),
      acceptanceText: cleanOptionalString(args.acceptanceText),
      updatedAt: now,
    });

    return organization._id;
  },
});

export async function requireCurrentOrganizationId(ctx: QueryCtx | MutationCtx): Promise<Id<"organizations">> {
  const currentMembership = await requireCurrentMembership(ctx);
  return currentMembership.organization._id;
}

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const [clients, materials, quotes, invoices, quoteItems] = await Promise.all([
      ctx.db
        .query("clients")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(200),
      ctx.db
        .query("materials")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(300),
      ctx.db
        .query("quotes")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(200),
      ctx.db
        .query("invoices")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(100),
      ctx.db
        .query("quoteItems")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(500),
    ]);

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const activeClients = clients.filter((client) => client.active !== false);
    const activeMaterials = materials.filter((material) => material.active);
    const totalQuotesHt = quotes.reduce((sum, quote) => sum + quote.totalHt, 0);
    const totalQuotesTtc = quotes.reduce((sum, quote) => sum + quote.totalTtc, 0);
    const acceptedQuotesTtc = quotes
      .filter((quote) => quote.status === "accepted" || quote.status === "invoiced")
      .reduce((sum, quote) => sum + quote.totalTtc, 0);
    const openQuotes = quotes.filter((quote) => quote.status === "draft" || quote.status === "sent");
    const unpaidInvoices = invoices.filter((invoice) => invoice.status !== "paid" && invoice.status !== "void");
    const overdueInvoices = unpaidInvoices.filter((invoice) => invoice.dueDate < now);
    const dueSoonInvoices = unpaidInvoices.filter((invoice) => invoice.dueDate >= now && invoice.dueDate <= now + sevenDaysMs);
    const quotesToFollowUp = quotes.filter((quote) => quote.status === "sent" && now - quote.updatedAt >= sevenDaysMs);
    const expiredQuotes = quotes.filter((quote) => quote.status !== "accepted" && quote.status !== "invoiced" && quote.validUntil !== undefined && quote.validUntil < now);
    const materialCostHt = quoteItems.reduce((sum, item) => sum + (item.realCostHt ?? 0), 0);
    const itemsTotalHt = quoteItems.reduce((sum, item) => sum + item.totalHt, 0);
    const estimatedMarginHt = Math.max(0, itemsTotalHt - materialCostHt);
    const conversionBase = quotes.filter((quote) => quote.status !== "draft").length;
    const wonQuotes = quotes.filter((quote) => quote.status === "accepted" || quote.status === "invoiced").length;
    const conversionRate = conversionBase > 0 ? Math.round((wonQuotes / conversionBase) * 10000) / 100 : 0;

    return {
      counts: {
        clients: activeClients.length,
        materials: activeMaterials.length,
        quotes: quotes.length,
        invoices: invoices.length,
      },
      totals: {
        quotesHt: roundMoney(totalQuotesHt),
        quotesTtc: roundMoney(totalQuotesTtc),
        acceptedQuotesTtc: roundMoney(acceptedQuotesTtc),
        unpaidInvoicesTtc: roundMoney(unpaidInvoices.reduce((sum, invoice) => sum + invoice.totalTtc, 0)),
        overdueInvoicesTtc: roundMoney(overdueInvoices.reduce((sum, invoice) => sum + invoice.totalTtc, 0)),
        paidInvoicesTtc: roundMoney(invoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + invoice.totalTtc, 0)),
        estimatedMarginHt: roundMoney(estimatedMarginHt),
        estimatedMarginRate: itemsTotalHt > 0 ? Math.round((estimatedMarginHt / itemsTotalHt) * 10000) / 100 : 0,
        conversionRate,
      },
      pipeline: {
        draft: quotes.filter((quote) => quote.status === "draft").length,
        sent: quotes.filter((quote) => quote.status === "sent").length,
        accepted: quotes.filter((quote) => quote.status === "accepted").length,
        refused: quotes.filter((quote) => quote.status === "refused").length,
        invoiced: quotes.filter((quote) => quote.status === "invoiced").length,
        unpaidInvoices: unpaidInvoices.length,
        overdueInvoices: overdueInvoices.length,
        dueSoonInvoices: dueSoonInvoices.length,
        quotesToFollowUp: quotesToFollowUp.length,
        expiredQuotes: expiredQuotes.length,
      },
      latestQuotes: await Promise.all(
        quotes.slice(0, 6).map(async (quote) => ({
          ...quote,
          client: quote.clientId ? await ctx.db.get(quote.clientId) : null,
        })),
      ),
      latestInvoices: await Promise.all(
        invoices.slice(0, 6).map(async (invoice) => ({
          ...invoice,
          client: invoice.clientId ? await ctx.db.get(invoice.clientId) : null,
          quote: invoice.quoteId ? await ctx.db.get(invoice.quoteId) : null,
        })),
      ),
      latestClients: activeClients.slice(0, 6),
      priorities: {
        overdueInvoices: await Promise.all(
          overdueInvoices
            .sort((a, b) => a.dueDate - b.dueDate)
            .slice(0, 5)
            .map(async (invoice) => ({
              ...invoice,
              client: invoice.clientId ? await ctx.db.get(invoice.clientId) : null,
              quote: invoice.quoteId ? await ctx.db.get(invoice.quoteId) : null,
            })),
        ),
        dueSoonInvoices: await Promise.all(
          dueSoonInvoices
            .sort((a, b) => a.dueDate - b.dueDate)
            .slice(0, 5)
            .map(async (invoice) => ({
              ...invoice,
              client: invoice.clientId ? await ctx.db.get(invoice.clientId) : null,
              quote: invoice.quoteId ? await ctx.db.get(invoice.quoteId) : null,
            })),
        ),
        quotesToFollowUp: await Promise.all(
          quotesToFollowUp
            .sort((a, b) => a.updatedAt - b.updatedAt)
            .slice(0, 5)
            .map(async (quote) => ({
              ...quote,
              client: quote.clientId ? await ctx.db.get(quote.clientId) : null,
            })),
        ),
        expiredQuotes: await Promise.all(
          expiredQuotes
            .sort((a, b) => (a.validUntil ?? 0) - (b.validUntil ?? 0))
            .slice(0, 5)
            .map(async (quote) => ({
              ...quote,
              client: quote.clientId ? await ctx.db.get(quote.clientId) : null,
            })),
        ),
      },
      alerts: {
        openQuotes: openQuotes.length,
        unpaidInvoices: unpaidInvoices.length,
        overdueInvoices: overdueInvoices.length,
        dueSoonInvoices: dueSoonInvoices.length,
        quotesToFollowUp: quotesToFollowUp.length,
        expiredQuotes: expiredQuotes.length,
        lowCatalogDetail: activeMaterials.filter(
          (material) => !material.reference || !material.category || !material.supplier,
        ).length,
      },
    };
  },
});

function clampRate(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label} doit être compris entre 0 et 100`);
  }
  return Math.round(value * 100) / 100;
}

function roundPositive(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} doit etre positif`);
  }
  return Math.round(value * 100) / 100;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
