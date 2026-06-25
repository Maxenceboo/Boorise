import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { cleanOptionalString, cleanRequiredString, requireCurrentOrganizationId } from "./app";

const serviceUnitValidator = v.union(
  v.literal("heure"),
  v.literal("forfait"),
  v.literal("jour"),
  v.literal("m2"),
  v.literal("metre"),
);

const serviceArgs = {
  name: v.string(),
  description: v.optional(v.string()),
  unit: serviceUnitValidator,
  unitPriceHt: v.number(),
  active: v.optional(v.boolean()),
};

export const list = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const services = await ctx.db
      .query("services")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .take(200);

    if (args.includeInactive) {
      return services;
    }
    return services.filter((service) => service.active);
  },
});

export const create = mutation({
  args: serviceArgs,
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const now = Date.now();
    return await ctx.db.insert("services", {
      organizationId,
      ...normalizeService(args),
      active: args.active ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    serviceId: v.id("services"),
    ...serviceArgs,
  },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const service = await ctx.db.get(args.serviceId);
    if (!service || service.organizationId !== organizationId) {
      throw new Error("Prestation introuvable");
    }

    await ctx.db.patch(args.serviceId, {
      ...normalizeService(args),
      active: args.active ?? service.active,
      updatedAt: Date.now(),
    });

    return args.serviceId;
  },
});

export const archive = mutation({
  args: { serviceId: v.id("services") },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const service = await ctx.db.get(args.serviceId);
    if (!service || service.organizationId !== organizationId) {
      throw new Error("Prestation introuvable");
    }

    await ctx.db.patch(args.serviceId, {
      active: false,
      updatedAt: Date.now(),
    });

    return args.serviceId;
  },
});

function normalizeService(args: {
  name: string;
  description?: string;
  unit: "heure" | "forfait" | "jour" | "m2" | "metre";
  unitPriceHt: number;
}) {
  if (!Number.isFinite(args.unitPriceHt) || args.unitPriceHt < 0) {
    throw new Error("Le prix unitaire doit être positif");
  }

  return {
    name: cleanRequiredString(args.name, "Le nom de la prestation"),
    description: cleanOptionalString(args.description),
    unit: args.unit,
    unitPriceHt: Math.round(args.unitPriceHt * 100) / 100,
  };
}
