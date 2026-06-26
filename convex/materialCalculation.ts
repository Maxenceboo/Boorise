export type MaterialCalcInput = {
  requestedQuantity: number;
  wasteRate?: number;
  divisible: boolean;
  quantityPerLot?: number | null;
  unitPriceHt: number;
};

export type MaterialCalcResult = {
  quantityWithWaste: number;
  purchasedQuantity: number;
  deliveredPhysicalQuantity: number;
  waste: number;
  totalHt: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const round4 = (value: number) => Math.round(value * 10000) / 10000;

export function calculateMaterial(input: MaterialCalcInput): MaterialCalcResult {
  if (!Number.isFinite(input.requestedQuantity) || input.requestedQuantity <= 0) {
    throw new Error("La quantite demandee doit etre superieure a 0");
  }
  if (!Number.isFinite(input.unitPriceHt) || input.unitPriceHt < 0) {
    throw new Error("Le prix unitaire doit etre positif");
  }
  if (input.wasteRate !== undefined && (!Number.isFinite(input.wasteRate) || input.wasteRate < 0 || input.wasteRate > 100)) {
    throw new Error("Le taux de perte doit etre compris entre 0 et 100");
  }
  if (!input.divisible && input.quantityPerLot != null && (!Number.isFinite(input.quantityPerLot) || input.quantityPerLot <= 0)) {
    throw new Error("La quantite par lot doit etre superieure a 0");
  }

  const wasteRate = input.wasteRate ?? 0;
  const requestedQuantity = input.requestedQuantity;
  const unitPriceHt = input.unitPriceHt;
  const quantityWithWaste = round4(requestedQuantity * (1 + wasteRate / 100));

  if (input.divisible) {
    return {
      quantityWithWaste,
      purchasedQuantity: quantityWithWaste,
      deliveredPhysicalQuantity: quantityWithWaste,
      waste: round4(quantityWithWaste - requestedQuantity),
      totalHt: round2(quantityWithWaste * unitPriceHt),
    };
  }

  const quantityPerLot = input.quantityPerLot && input.quantityPerLot > 0 ? input.quantityPerLot : 1;
  const lots = Math.ceil(quantityWithWaste / quantityPerLot);
  const deliveredPhysicalQuantity = lots * quantityPerLot;

  return {
    quantityWithWaste,
    purchasedQuantity: lots,
    deliveredPhysicalQuantity: round4(deliveredPhysicalQuantity),
    waste: round4(Math.max(0, deliveredPhysicalQuantity - requestedQuantity)),
    totalHt: round2(lots * unitPriceHt),
  };
}
