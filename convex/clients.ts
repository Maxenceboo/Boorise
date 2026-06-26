import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { cleanOptionalString, cleanRequiredString, requireCurrentOrganizationId } from "./app";

export const list = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    if (args.includeInactive) {
      return await ctx.db
        .query("clients")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(100);
    }

    const clients = await ctx.db
      .query("clients")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .take(100);
    return clients.filter((client) => client.active !== false);
  },
});

export const get = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const client = await ctx.db.get(args.clientId);
    if (!client || client.organizationId !== organizationId) {
      return null;
    }
    return client;
  },
});

export const activity = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const client = await ctx.db.get(args.clientId);
    if (!client || client.organizationId !== organizationId) {
      return null;
    }

    const [clientQuotes, clientInvoices] = await Promise.all([
      ctx.db
        .query("quotes")
        .withIndex("by_organizationId_and_clientId", (q) => q.eq("organizationId", organizationId).eq("clientId", args.clientId))
        .order("desc")
        .take(100),
      ctx.db
        .query("invoices")
        .withIndex("by_organizationId_and_clientId", (q) => q.eq("organizationId", organizationId).eq("clientId", args.clientId))
        .order("desc")
        .take(100),
    ]);
    const unpaidInvoices = clientInvoices.filter((invoice) => invoice.status !== "paid" && invoice.status !== "void");

    return {
      client,
      quotes: clientQuotes.slice(0, 8),
      invoices: clientInvoices.slice(0, 8),
      totals: {
        quotesTtc: roundMoney(clientQuotes.reduce((sum, quote) => sum + quote.totalTtc, 0)),
        invoicesTtc: roundMoney(clientInvoices.reduce((sum, invoice) => sum + invoice.totalTtc, 0)),
        unpaidTtc: roundMoney(unpaidInvoices.reduce((sum, invoice) => sum + invoice.totalTtc, 0)),
        acceptedQuotes: clientQuotes.filter((quote) => quote.status === "accepted" || quote.status === "invoiced").length,
        unpaidInvoices: unpaidInvoices.length,
      },
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    firstName: v.optional(v.string()),
    companyName: v.optional(v.string()),
    customerType: v.optional(v.union(v.literal("individual"), v.literal("business"), v.literal("public"))),
    siren: v.optional(v.string()),
    siret: v.optional(v.string()),
    vatNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const now = Date.now();

    return await ctx.db.insert("clients", {
      organizationId,
      name: cleanRequiredString(args.name, "Le nom du client"),
      firstName: cleanOptionalString(args.firstName),
      companyName: cleanOptionalString(args.companyName),
      customerType: args.customerType ?? (args.companyName ? "business" : "individual"),
      siren: cleanOptionalString(args.siren),
      siret: cleanOptionalString(args.siret),
      vatNumber: cleanOptionalString(args.vatNumber),
      email: cleanOptionalString(args.email),
      phone: cleanOptionalString(args.phone),
      address: cleanOptionalString(args.address),
      postalCode: cleanOptionalString(args.postalCode),
      city: cleanOptionalString(args.city),
      country: cleanOptionalString(args.country),
      notes: cleanOptionalString(args.notes),
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    clientId: v.id("clients"),
    name: v.string(),
    firstName: v.optional(v.string()),
    companyName: v.optional(v.string()),
    customerType: v.optional(v.union(v.literal("individual"), v.literal("business"), v.literal("public"))),
    siren: v.optional(v.string()),
    siret: v.optional(v.string()),
    vatNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    notes: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const client = await ctx.db.get(args.clientId);
    if (!client || client.organizationId !== organizationId) {
      throw new Error("Client introuvable");
    }

    await ctx.db.patch(args.clientId, {
      name: cleanRequiredString(args.name, "Le nom du client"),
      firstName: cleanOptionalString(args.firstName),
      companyName: cleanOptionalString(args.companyName),
      customerType: args.customerType ?? client.customerType ?? (args.companyName ? "business" : "individual"),
      siren: cleanOptionalString(args.siren),
      siret: cleanOptionalString(args.siret),
      vatNumber: cleanOptionalString(args.vatNumber),
      email: cleanOptionalString(args.email),
      phone: cleanOptionalString(args.phone),
      address: cleanOptionalString(args.address),
      postalCode: cleanOptionalString(args.postalCode),
      city: cleanOptionalString(args.city),
      country: cleanOptionalString(args.country),
      notes: cleanOptionalString(args.notes),
      active: args.active ?? client.active ?? true,
      updatedAt: Date.now(),
    });

    return args.clientId;
  },
});

export const archive = mutation({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const client = await ctx.db.get(args.clientId);
    if (!client || client.organizationId !== organizationId) {
      throw new Error("Client introuvable");
    }

    await ctx.db.patch(args.clientId, {
      active: false,
      updatedAt: Date.now(),
    });

    return args.clientId;
  },
});

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
