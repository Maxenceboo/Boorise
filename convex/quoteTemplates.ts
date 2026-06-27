import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { cleanOptionalString, cleanRequiredString, logActivity, requireBusinessWrite, requireCurrentOrganizationId } from "./app";
import { calculateMaterial } from "./materialCalculation";
import { assertCanEditQuote } from "./documentLifecycle";

type TemplateLineInput = {
  kind: "material" | "service" | "custom";
  materialId?: Id<"materials">;
  serviceId?: Id<"services">;
  section?: string;
  description: string;
  unit: string;
  quantity: number;
  unitPriceHt: number;
  wasteRate: number;
  marginRate: number;
};

const builtinTemplates: Array<{
  key: string;
  name: string;
  category: string;
  description: string;
  lines: TemplateLineInput[];
}> = [
  {
    key: "terrasse",
    name: "Terrasse bois",
    category: "Exterieur",
    description: "Structure, platelage, visserie et pose pour une terrasse standard.",
    lines: [
      line("Fournitures", "Lambourdes / structure", "m2", 1, 28, 8),
      line("Fournitures", "Lames de terrasse", "m2", 1, 52, 10),
      line("Fournitures", "Visserie et consommables", "forfait", 1, 65, 0),
      line("Pose", "Preparation support et pose", "m2", 1, 45, 0),
      line("Finitions", "Decoupes, rives et nettoyage", "forfait", 1, 180, 0),
    ],
  },
  {
    key: "placo",
    name: "Cloison placo",
    category: "Second oeuvre",
    description: "Rails, plaques, bandes, enduit et pose pour cloison courante.",
    lines: [
      line("Fournitures", "Rails et montants", "m2", 1, 12, 8),
      line("Fournitures", "Plaques de platre", "m2", 1, 16, 10),
      line("Fournitures", "Bandes, enduit et visserie", "m2", 1, 7, 5),
      line("Pose", "Montage ossature et plaques", "m2", 1, 32, 0),
      line("Finitions", "Bandes et ratissage localise", "m2", 1, 18, 0),
    ],
  },
  {
    key: "peinture",
    name: "Peinture piece",
    category: "Finitions",
    description: "Protection, preparation, sous-couche et deux couches de finition.",
    lines: [
      line("Preparation", "Protection chantier", "forfait", 1, 75, 0),
      line("Preparation", "Rebouchage et poncage", "m2", 1, 8, 0),
      line("Fournitures", "Sous-couche", "m2", 1, 3.5, 8),
      line("Fournitures", "Peinture finition 2 couches", "m2", 1, 8.5, 10),
      line("Application", "Application peinture", "m2", 1, 22, 0),
    ],
  },
  {
    key: "salle-bain",
    name: "Salle de bain",
    category: "Renovation",
    description: "Base de chiffrage pour renovation de salle de bain avec plomberie, carrelage et finitions.",
    lines: [
      line("Depose", "Depose et evacuation", "forfait", 1, 620, 0),
      line("Plomberie", "Adaptation arrivees et evacuations", "forfait", 1, 950, 0),
      line("Fournitures", "Receveur, robinetterie et accessoires", "forfait", 1, 1250, 0),
      line("Carrelage", "Etancheite et carrelage mural/sol", "m2", 1, 95, 10),
      line("Finitions", "Joints, silicone, nettoyage et mise en service", "forfait", 1, 320, 0),
    ],
  },
  {
    key: "sol",
    name: "Pose de sol",
    category: "Finitions",
    description: "Preparation support, fourniture et pose d'un sol courant.",
    lines: [
      line("Preparation", "Ragreage / preparation support", "m2", 1, 18, 0),
      line("Fournitures", "Revetement de sol", "m2", 1, 32, 8),
      line("Fournitures", "Sous-couche et accessoires", "m2", 1, 7, 5),
      line("Pose", "Pose et decoupes", "m2", 1, 28, 0),
      line("Finitions", "Plinthes et seuils", "metre", 1, 12, 5),
    ],
  },
];

export const list = query({
  args: {},
  handler: async (ctx) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const customTemplates = await ctx.db
      .query("quoteTemplates")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .take(100);

    const custom = await Promise.all(
      customTemplates.map(async (template) => {
        const lines = await ctx.db
          .query("quoteTemplateLines")
          .withIndex("by_templateId_and_sortOrder", (q) => q.eq("templateId", template._id))
          .take(100);
        return {
          key: `custom:${template._id}`,
          source: "custom" as const,
          template,
          name: template.name,
          category: template.category ?? "Personnalise",
          description: template.description,
          favorite: template.favorite ?? false,
          lineCount: lines.length,
        };
      }),
    );

    return [
      ...builtinTemplates.map((template) => ({
        key: `builtin:${template.key}`,
        source: "builtin" as const,
        template: null,
        name: template.name,
        category: template.category,
        description: template.description,
        favorite: false,
        lineCount: template.lines.length,
      })),
      ...custom,
    ];
  },
});

export const createFromQuote = mutation({
  args: {
    quoteId: v.id("quotes"),
    name: v.string(),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organizationId = await requireCurrentOrganizationId(ctx);
    const quote = await ctx.db.get(args.quoteId);
    if (!quote || quote.organizationId !== organizationId) {
      throw new Error("Devis introuvable");
    }
    const items = await ctx.db
      .query("quoteItems")
      .withIndex("by_quoteId_and_sortOrder", (q) => q.eq("quoteId", args.quoteId))
      .take(200);
    if (items.length === 0) {
      throw new Error("Impossible de creer un modele depuis un devis vide");
    }

    const now = Date.now();
    const templateId = await ctx.db.insert("quoteTemplates", {
      organizationId,
      name: cleanRequiredString(args.name, "Le nom du modele"),
      category: cleanOptionalString(args.category) ?? "Personnalise",
      description: cleanOptionalString(args.description) ?? quote.title,
      favorite: true,
      createdAt: now,
      updatedAt: now,
    });

    for (const item of items) {
      await ctx.db.insert("quoteTemplateLines", {
        organizationId,
        templateId,
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
        sortOrder: item.sortOrder,
        createdAt: now,
        updatedAt: now,
      });
    }

    await logActivity(ctx, "quote_template.created", "quoteTemplate", templateId, `Modele cree: ${args.name}`);
    return templateId;
  },
});

export const toggleFavorite = mutation({
  args: { templateId: v.id("quoteTemplates"), favorite: v.boolean() },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const organizationId = organization._id;
    const template = await ctx.db.get(args.templateId);
    if (!template || template.organizationId !== organizationId) {
      throw new Error("Modele introuvable");
    }
    await ctx.db.patch(args.templateId, { favorite: args.favorite, updatedAt: Date.now() });
    await logActivity(ctx, "quote_template.favorite_updated", "quoteTemplate", args.templateId, `${args.favorite ? "Favori ajoute" : "Favori retire"}: ${template.name}`);
    return args.templateId;
  },
});

export const applyToQuote = mutation({
  args: {
    quoteId: v.id("quotes"),
    templateKey: v.string(),
    quantityMultiplier: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireBusinessWrite(ctx);
    const organizationId = organization._id;
    const quote = await ctx.db.get(args.quoteId);
    if (!quote || quote.organizationId !== organizationId) {
      throw new Error("Devis introuvable");
    }
    assertCanEditQuote(quote.status);

    const multiplier = normalizeMultiplier(args.quantityMultiplier ?? 1);
    const lines = await resolveTemplateLines(ctx, organizationId, args.templateKey);
    if (lines.length === 0) {
      throw new Error("Ce modele ne contient aucune ligne");
    }

    const now = Date.now();
    const lastItem = await ctx.db
      .query("quoteItems")
      .withIndex("by_quoteId_and_sortOrder", (q) => q.eq("quoteId", args.quoteId))
      .order("desc")
      .take(1);
    let sortOrder = lastItem[0]?.sortOrder ?? 0;
    let inserted = 0;

    for (const line of lines.slice(0, 80)) {
      sortOrder += 10;
      const normalized = await normalizeTemplateLine(ctx, organizationId, line, multiplier);
      await ctx.db.insert("quoteItems", {
        organizationId,
        quoteId: args.quoteId,
        ...normalized,
        sortOrder,
        createdAt: now,
        updatedAt: now,
      });
      inserted += 1;
    }

    await recalculateQuoteTotals(ctx, args.quoteId);
    await logActivity(ctx, "quote_template.applied", "quote", args.quoteId, `Modele applique: ${args.templateKey}`);
    return { inserted };
  },
});

async function resolveTemplateLines(ctx: QueryCtx, organizationId: Id<"organizations">, templateKey: string) {
  if (templateKey.startsWith("builtin:")) {
    const key = templateKey.slice("builtin:".length);
    return builtinTemplates.find((template) => template.key === key)?.lines ?? [];
  }

  if (!templateKey.startsWith("custom:")) {
    throw new Error("Modele invalide");
  }
  const templateId = templateKey.slice("custom:".length) as Id<"quoteTemplates">;
  const template = await ctx.db.get(templateId);
  if (!template || template.organizationId !== organizationId) {
    throw new Error("Modele introuvable");
  }
  return await ctx.db
    .query("quoteTemplateLines")
    .withIndex("by_templateId_and_sortOrder", (q) => q.eq("templateId", template._id))
    .take(100);
}

async function normalizeTemplateLine(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  lineInput: TemplateLineInput | Doc<"quoteTemplateLines">,
  multiplier: number,
) {
  const quantity = round4(lineInput.quantity * multiplier);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantite de modele invalide");
  }
  const wasteRate = clampRate(lineInput.wasteRate, "Perte");
  const marginRate = clampRate(lineInput.marginRate, "Marge");
  const unitPriceHt = normalizeMoneyInput(lineInput.unitPriceHt, "Le prix unitaire");

  if (lineInput.kind === "material" && lineInput.materialId) {
    const material = await ctx.db.get(lineInput.materialId);
    if (material && material.organizationId === organizationId) {
      const calculation = calculateMaterial({
        requestedQuantity: quantity,
        wasteRate: wasteRate || material.defaultWasteRate,
        divisible: material.divisible,
        quantityPerLot: material.quantityPerLot,
        unitPriceHt: unitPriceHt || material.purchasePriceHt,
      });
      return {
        kind: "material" as const,
        materialId: material._id,
        serviceId: undefined,
        section: cleanOptionalString(lineInput.section),
        description: cleanOptionalString(lineInput.description) ?? material.name,
        unit: material.unit,
        quantity,
        unitPriceHt: roundMoney(unitPriceHt || material.purchasePriceHt),
        wasteRate: wasteRate || material.defaultWasteRate,
        marginRate,
        quantityWithWaste: calculation.quantityWithWaste,
        purchasedQuantity: calculation.purchasedQuantity,
        deliveredPhysicalQuantity: calculation.deliveredPhysicalQuantity,
        wasteQuantity: calculation.waste,
        realCostHt: calculation.totalHt,
        totalHt: roundMoney(calculation.totalHt * (1 + marginRate / 100)),
      };
    }
  }

  if (lineInput.kind === "service" && lineInput.serviceId) {
    const service = await ctx.db.get(lineInput.serviceId);
    if (service && service.organizationId === organizationId) {
      const price = unitPriceHt || service.unitPriceHt;
      return simpleLine("service", undefined, service._id, lineInput, quantity, service.unit, price, wasteRate, marginRate, service.name);
    }
  }

  return simpleLine("custom", undefined, undefined, lineInput, quantity, lineInput.unit, unitPriceHt, wasteRate, marginRate, lineInput.description);
}

function simpleLine(
  kind: "service" | "custom",
  materialId: undefined,
  serviceId: Id<"services"> | undefined,
  lineInput: TemplateLineInput | Doc<"quoteTemplateLines">,
  quantity: number,
  unit: string,
  unitPriceHt: number,
  wasteRate: number,
  marginRate: number,
  fallbackDescription: string,
) {
  const quantityWithWaste = round4(quantity * (1 + wasteRate / 100));
  const realCostHt = roundMoney(quantityWithWaste * unitPriceHt);
  return {
    kind,
    materialId,
    serviceId,
    section: cleanOptionalString(lineInput.section),
    description: cleanRequiredString(lineInput.description || fallbackDescription, "La designation"),
    unit: cleanRequiredString(unit, "L'unite"),
    quantity,
    unitPriceHt: roundMoney(unitPriceHt),
    wasteRate,
    marginRate,
    quantityWithWaste,
    purchasedQuantity: quantityWithWaste,
    deliveredPhysicalQuantity: quantityWithWaste,
    wasteQuantity: round4(quantityWithWaste - quantity),
    realCostHt,
    totalHt: roundMoney(realCostHt * (1 + marginRate / 100)),
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
  await ctx.db.patch(quoteId, { totalHt, totalTtc, updatedAt: Date.now() });
}

function line(section: string, description: string, unit: string, quantity: number, unitPriceHt: number, wasteRate: number): TemplateLineInput {
  return { kind: "custom", section, description, unit, quantity, unitPriceHt, wasteRate, marginRate: 0 };
}

function normalizeMultiplier(value: number) {
  if (!Number.isFinite(value) || value <= 0 || value > 10000) {
    throw new Error("La quantite du modele doit etre superieure a 0");
  }
  return Math.round(value * 10000) / 10000;
}

function clampRate(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label} doit etre compris entre 0 et 100`);
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
