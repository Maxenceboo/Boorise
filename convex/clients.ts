import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCurrentOrganizationId } from "./app";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    return await ctx.db
      .query("clients")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .take(100);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    companyName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const now = Date.now();

    return await ctx.db.insert("clients", {
      organizationId,
      name: args.name.trim(),
      companyName: args.companyName?.trim() || undefined,
      email: args.email?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      address: args.address?.trim() || undefined,
      postalCode: args.postalCode?.trim() || undefined,
      city: args.city?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});
