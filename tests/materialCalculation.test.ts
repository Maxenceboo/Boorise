import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateMaterial } from "../convex/materialCalculation";

describe("calculateMaterial", () => {
  it("keeps exact quantity for divisible products", () => {
    assert.deepEqual(
      calculateMaterial({
        requestedQuantity: 15.5,
        divisible: true,
        unitPriceHt: 3,
      }),
      {
        quantityWithWaste: 15.5,
        purchasedQuantity: 15.5,
        deliveredPhysicalQuantity: 15.5,
        waste: 0,
        totalHt: 46.5,
      },
    );
  });

  it("rounds non-divisible products to the next lot and exposes physical waste", () => {
    assert.deepEqual(
      calculateMaterial({
        requestedQuantity: 5,
        divisible: false,
        quantityPerLot: 2,
        unitPriceHt: 12,
      }),
      {
        quantityWithWaste: 5,
        purchasedQuantity: 3,
        deliveredPhysicalQuantity: 6,
        waste: 1,
        totalHt: 36,
      },
    );
  });

  it("applies waste before lot rounding", () => {
    assert.deepEqual(
      calculateMaterial({
        requestedQuantity: 30,
        wasteRate: 10,
        divisible: false,
        quantityPerLot: 5,
        unitPriceHt: 8,
      }),
      {
        quantityWithWaste: 33,
        purchasedQuantity: 7,
        deliveredPhysicalQuantity: 35,
        waste: 5,
        totalHt: 56,
      },
    );
  });

  it("handles boxes sold by lot", () => {
    assert.deepEqual(
      calculateMaterial({
        requestedQuantity: 250,
        divisible: false,
        quantityPerLot: 200,
        unitPriceHt: 14.5,
      }),
      {
        quantityWithWaste: 250,
        purchasedQuantity: 2,
        deliveredPhysicalQuantity: 400,
        waste: 150,
        totalHt: 29,
      },
    );
  });
});
