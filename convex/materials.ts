import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { cleanOptionalString, cleanRequiredString, logActivity, requireCatalogWrite, requireCurrentOrganizationId } from "./app";
import { calculateMaterial } from "./materialCalculation";

const unitValidator = v.union(
  v.literal("piece"),
  v.literal("metre"),
  v.literal("m2"),
  v.literal("m3"),
  v.literal("litre"),
  v.literal("kilogramme"),
  v.literal("lot"),
);

const materialArgs = {
  name: v.string(),
  reference: v.optional(v.string()),
  category: v.optional(v.string()),
  description: v.optional(v.string()),
  unit: unitValidator,
  purchasePriceHt: v.number(),
  divisible: v.boolean(),
  quantityPerLot: v.optional(v.number()),
  length: v.optional(v.number()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  defaultWasteRate: v.number(),
  supplier: v.optional(v.string()),
  favorite: v.optional(v.boolean()),
  active: v.optional(v.boolean()),
};

export const list = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const materials = await ctx.db
      .query("materials")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .take(200);

    if (args.includeInactive) {
      return materials;
    }
    return materials.filter((material) => material.active);
  },
});

export const get = query({
  args: { materialId: v.id("materials") },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const material = await ctx.db.get(args.materialId);
    if (!material || material.organizationId !== organizationId) {
      return null;
    }
    return material;
  },
});

export const create = mutation({
  args: materialArgs,
  handler: async (ctx, args) => {
    const { organization } = await requireCatalogWrite(ctx);
    const organizationId = organization._id;
    const now = Date.now();
    const materialId = await ctx.db.insert("materials", {
      organizationId,
      ...normalizeMaterial(args),
      favorite: args.favorite ?? false,
      active: args.active ?? true,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, "material.created", "material", materialId, `Materiau cree: ${args.name}`);
    return materialId;
  },
});

export const update = mutation({
  args: {
    materialId: v.id("materials"),
    ...materialArgs,
  },
  handler: async (ctx, args) => {
    const { organization } = await requireCatalogWrite(ctx);
    const organizationId = organization._id;
    const material = await ctx.db.get(args.materialId);
    if (!material || material.organizationId !== organizationId) {
      throw new Error("Matériau introuvable");
    }

    await ctx.db.patch(args.materialId, {
      ...normalizeMaterial(args),
      favorite: args.favorite ?? material.favorite ?? false,
      active: args.active ?? material.active,
      updatedAt: Date.now(),
    });
    await logActivity(ctx, "material.updated", "material", args.materialId, `Materiau modifie: ${args.name}`);

    return args.materialId;
  },
});

export const archive = mutation({
  args: { materialId: v.id("materials") },
  handler: async (ctx, args) => {
    const { organization } = await requireCatalogWrite(ctx);
    const organizationId = organization._id;
    const material = await ctx.db.get(args.materialId);
    if (!material || material.organizationId !== organizationId) {
      throw new Error("Matériau introuvable");
    }

    await ctx.db.patch(args.materialId, {
      active: false,
      updatedAt: Date.now(),
    });
    await logActivity(ctx, "material.archived", "material", args.materialId, `Materiau archive: ${material.name}`);

    return args.materialId;
  },
});

export const toggleFavorite = mutation({
  args: { materialId: v.id("materials"), favorite: v.boolean() },
  handler: async (ctx, args) => {
    const { organization } = await requireCatalogWrite(ctx);
    const organizationId = organization._id;
    const material = await ctx.db.get(args.materialId);
    if (!material || material.organizationId !== organizationId) {
      throw new Error("Materiau introuvable");
    }

    await ctx.db.patch(args.materialId, {
      favorite: args.favorite,
      updatedAt: Date.now(),
    });
    await logActivity(ctx, "material.favorite_updated", "material", args.materialId, `${args.favorite ? "Favori ajoute" : "Favori retire"}: ${material.name}`);

    return args.materialId;
  },
});

export const importCsvRows = mutation({
  args: {
    rows: v.array(v.object(materialArgs)),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireCatalogWrite(ctx);
    const organizationId = organization._id;
    const now = Date.now();
    const rows = args.rows.slice(0, 200);
    const importedIds = [];

    for (const row of rows) {
      importedIds.push(await ctx.db.insert("materials", {
        organizationId,
        ...normalizeMaterial(row),
        favorite: row.favorite ?? false,
        active: row.active ?? true,
        createdAt: now,
        updatedAt: now,
      }));
    }

    await logActivity(ctx, "material.imported", "material", undefined, `${importedIds.length} materiau(x) importes par CSV`);
    return { imported: importedIds.length, skipped: Math.max(0, args.rows.length - rows.length) };
  },
});

export const previewCalculation = query({
  args: {
    materialId: v.id("materials"),
    requestedQuantity: v.number(),
    wasteRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const material = await ctx.db.get(args.materialId);
    if (!material || material.organizationId !== organizationId) {
      throw new Error("Matériau introuvable");
    }

    return calculateMaterial({
      requestedQuantity: args.requestedQuantity,
      wasteRate: args.wasteRate ?? material.defaultWasteRate,
      divisible: material.divisible,
      quantityPerLot: material.quantityPerLot,
      unitPriceHt: material.purchasePriceHt,
    });
  },
});

function normalizeMaterial(args: {
  name: string;
  reference?: string;
  category?: string;
  description?: string;
  unit: "piece" | "metre" | "m2" | "m3" | "litre" | "kilogramme" | "lot";
  purchasePriceHt: number;
  divisible: boolean;
  quantityPerLot?: number;
  length?: number;
  width?: number;
  height?: number;
  defaultWasteRate: number;
  supplier?: string;
  favorite?: boolean;
}) {
  if (!Number.isFinite(args.purchasePriceHt) || args.purchasePriceHt < 0) {
    throw new Error("Le prix d'achat doit être positif");
  }
  if (!Number.isFinite(args.defaultWasteRate) || args.defaultWasteRate < 0 || args.defaultWasteRate > 100) {
    throw new Error("Le taux de perte doit être compris entre 0 et 100");
  }
  if (!args.divisible && (args.quantityPerLot === undefined || !Number.isFinite(args.quantityPerLot) || args.quantityPerLot <= 0)) {
    throw new Error("La quantité par lot doit être supérieure à 0");
  }

  return {
    name: cleanRequiredString(args.name, "Le nom du matériau"),
    reference: cleanOptionalString(args.reference),
    category: cleanOptionalString(args.category),
    description: cleanOptionalString(args.description),
    unit: args.unit,
    purchasePriceHt: roundMoney(args.purchasePriceHt),
    divisible: args.divisible,
    quantityPerLot: args.divisible ? undefined : normalizeStrictPositive(args.quantityPerLot, "Quantite par lot"),
    length: normalizeStrictPositiveOptional(args.length, "Longueur"),
    width: normalizeStrictPositiveOptional(args.width, "Largeur"),
    height: normalizeStrictPositiveOptional(args.height, "Hauteur"),
    defaultWasteRate: roundRate(args.defaultWasteRate),
    supplier: cleanOptionalString(args.supplier),
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundRate(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeStrictPositive(value: number | undefined, label: string) {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} doit etre superieur a 0`);
  }
  return Math.round(value * 10000) / 10000;
}

function normalizeStrictPositiveOptional(value: number | undefined, label: string) {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} doit etre superieur a 0`);
  }
  return Math.round(value * 10000) / 10000;
}
