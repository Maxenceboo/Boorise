import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { cleanOptionalString, requireCurrentOrganizationId } from "./app";

const invoiceStatusValidator = v.union(
  v.literal("draft"),
  v.literal("sent"),
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

    return await Promise.all(
      invoices.map(async (invoice) => ({
        ...invoice,
        client: invoice.clientId ? await ctx.db.get(invoice.clientId) : null,
        quote: invoice.quoteId ? await ctx.db.get(invoice.quoteId) : null,
      })),
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

    const items = invoice.quoteId
      ? await ctx.db
          .query("quoteItems")
          .withIndex("by_quoteId_and_sortOrder", (q) => q.eq("quoteId", invoice.quoteId!))
          .take(300)
      : [];

    return {
      invoice,
      client: invoice.clientId ? await ctx.db.get(invoice.clientId) : null,
      quote: invoice.quoteId ? await ctx.db.get(invoice.quoteId) : null,
      items,
    };
  },
});

export const updateStatus = mutation({
  args: {
    invoiceId: v.id("invoices"),
    status: invoiceStatusValidator,
  },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.organizationId !== organizationId) {
      throw new Error("Facture introuvable");
    }

    await ctx.db.patch(args.invoiceId, {
      status: args.status,
      paidAt: args.status === "paid" ? Date.now() : invoice.paidAt,
      updatedAt: Date.now(),
    });

    return args.invoiceId;
  },
});

export const recordPayment = mutation({
  args: {
    invoiceId: v.id("invoices"),
    paidAt: v.optional(v.number()),
    paymentMethod: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.organizationId !== organizationId) {
      throw new Error("Facture introuvable");
    }
    if (invoice.status === "void") {
      throw new Error("Une facture annulee ne peut pas etre encaissee");
    }

    await ctx.db.patch(args.invoiceId, {
      status: "paid",
      paidAt: args.paidAt ?? Date.now(),
      paymentMethod: cleanOptionalString(args.paymentMethod),
      paymentReference: cleanOptionalString(args.paymentReference),
      updatedAt: Date.now(),
    });

    return args.invoiceId;
  },
});
