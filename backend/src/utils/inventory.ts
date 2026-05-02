import type { Inventory, FoodType } from "../types";
import { FOOD_TYPES } from "../types";

export function emptyInventory(): Inventory {
  return { A: 0, B: 0, C: 0, D: 0 };
}

export function totalInventory(inv: Inventory): number {
  let sum = 0;
  for (const f of FOOD_TYPES) sum += inv[f];
  return sum;
}

export function availableInventory(
  inv: Inventory,
  reserved: Inventory,
): Inventory {
  return {
    A: inv.A - reserved.A,
    B: inv.B - reserved.B,
    C: inv.C - reserved.C,
    D: inv.D - reserved.D,
  };
}

export function requiredFoods(produces: FoodType | null): FoodType[] {
  return FOOD_TYPES.filter((f) => f !== produces);
}
