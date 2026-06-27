import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { cleanOptionalString, cleanRequiredString, logActivity, requireCatalogWrite, requireCurrentOrganizationId } from "./app";

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
  favorite: v.optional(v.boolean()),
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
    const { organization } = await requireCatalogWrite(ctx);
    const organizationId = organization._id;
    const now = Date.now();
    const serviceId = await ctx.db.insert("services", {
      organizationId,
      ...normalizeService(args),
      favorite: args.favorite ?? false,
      active: args.active ?? true,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, "service.created", "service", serviceId, `Prestation creee: ${args.name}`);
    return serviceId;
  },
});

export const update = mutation({
  args: {
    serviceId: v.id("services"),
    ...serviceArgs,
  },
  handler: async (ctx, args) => {
    const { organization } = await requireCatalogWrite(ctx);
    const organizationId = organization._id;
    const service = await ctx.db.get(args.serviceId);
    if (!service || service.organizationId !== organizationId) {
      throw new Error("Prestation introuvable");
    }

    await ctx.db.patch(args.serviceId, {
      ...normalizeService(args),
      favorite: args.favorite ?? service.favorite ?? false,
      active: args.active ?? service.active,
      updatedAt: Date.now(),
    });
    await logActivity(ctx, "service.updated", "service", args.serviceId, `Prestation modifiee: ${args.name}`);

    return args.serviceId;
  },
});

export const archive = mutation({
  args: { serviceId: v.id("services") },
  handler: async (ctx, args) => {
    const { organization } = await requireCatalogWrite(ctx);
    const organizationId = organization._id;
    const service = await ctx.db.get(args.serviceId);
    if (!service || service.organizationId !== organizationId) {
      throw new Error("Prestation introuvable");
    }

    await ctx.db.patch(args.serviceId, {
      active: false,
      updatedAt: Date.now(),
    });
    await logActivity(ctx, "service.archived", "service", args.serviceId, `Prestation archivee: ${service.name}`);

    return args.serviceId;
  },
});

export const toggleFavorite = mutation({
  args: { serviceId: v.id("services"), favorite: v.boolean() },
  handler: async (ctx, args) => {
    const { organization } = await requireCatalogWrite(ctx);
    const organizationId = organization._id;
    const service = await ctx.db.get(args.serviceId);
    if (!service || service.organizationId !== organizationId) {
      throw new Error("Prestation introuvable");
    }

    await ctx.db.patch(args.serviceId, {
      favorite: args.favorite,
      updatedAt: Date.now(),
    });
    await logActivity(ctx, "service.favorite_updated", "service", args.serviceId, `${args.favorite ? "Favori ajoute" : "Favori retire"}: ${service.name}`);

    return args.serviceId;
  },
});

function normalizeService(args: {
  name: string;
  description?: string;
  unit: "heure" | "forfait" | "jour" | "m2" | "metre";
  unitPriceHt: number;
  favorite?: boolean;
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
