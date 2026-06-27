import type { Doc, Id } from "./_generated/dataModel";

export type QuoteBusinessSummary = {
  lineCount: number;
  salesHt: number;
  materialCostHt: number;
  serviceCostHt: number;
  customCostHt: number;
  realCostHt: number;
  marginHt: number;
  marginRate: number;
};

export function summarizeQuoteItems(items: Doc<"quoteItems">[]): QuoteBusinessSummary {
  const materialCostHt = roundMoney(
    items
      .filter((item) => item.kind === "material")
      .reduce((sum, item) => sum + realCost(item), 0),
  );
  const serviceCostHt = roundMoney(
    items
      .filter((item) => item.kind === "service")
      .reduce((sum, item) => sum + realCost(item), 0),
  );
  const customCostHt = roundMoney(
    items
      .filter((item) => item.kind === "custom")
      .reduce((sum, item) => sum + realCost(item), 0),
  );
  const realCostHt = roundMoney(materialCostHt + serviceCostHt + customCostHt);
  const salesHt = roundMoney(items.reduce((sum, item) => sum + item.totalHt, 0));
  const marginHt = roundMoney(salesHt - realCostHt);

  return {
    lineCount: items.length,
    salesHt,
    materialCostHt,
    serviceCostHt,
    customCostHt,
    realCostHt,
    marginHt,
    marginRate: salesHt > 0 ? roundRate((marginHt / salesHt) * 100) : 0,
  };
}

export function groupQuoteItemsByQuoteId(items: Doc<"quoteItems">[]) {
  const groups = new Map<Id<"quotes">, Doc<"quoteItems">[]>();
  for (const item of items) {
    const group = groups.get(item.quoteId) ?? [];
    group.push(item);
    groups.set(item.quoteId, group);
  }
  return groups;
}

function realCost(item: Doc<"quoteItems">) {
  return item.realCostHt ?? item.totalHt;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundRate(value: number) {
  return Math.round(value * 100) / 100;
}
