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
  const wasteRate = Math.max(0, input.wasteRate ?? 0);
  const requestedQuantity = Math.max(0, input.requestedQuantity || 0);
  const unitPriceHt = Math.max(0, input.unitPriceHt || 0);
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
