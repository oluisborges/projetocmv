import { recipeCost, type RecipeCost } from "@/lib/calc";

/** Insumo/embalagem como vem do banco (unit_cost = R$ por g/ml/un comprado, já bruto). */
export type CostIngredient = { unit_cost: number; correction_factor: number };

export type CostItem = { ingredient: CostIngredient; netQty: number; scope: "batch" | "portion" };

export type CostSettings = {
  portions: number | null;
  portionWeight: number | null;
  /** fração: 0.25 = 25% */
  cookingLossPct: number;
};

export type RecipeView =
  | { ok: true; cost: RecipeCost; missingPrices: number }
  | { ok: false; reason: "no-items" | "no-portions" | "invalid" };

/**
 * Custo de uma ficha para exibir na tela. Nunca lança: ficha pela metade (sem itens, sem porções)
 * devolve `ok: false` com o motivo, para a tela explicar em vez de quebrar.
 */
export function computeRecipe(settings: CostSettings, items: CostItem[]): RecipeView {
  if (items.filter((i) => i.scope === "batch").length === 0) return { ok: false, reason: "no-items" };

  try {
    const cost = recipeCost({
      items: items.map((i) => ({
        unitCost: i.ingredient.unit_cost,
        correctionFactor: i.ingredient.correction_factor,
        netQty: i.netQty,
        scope: i.scope,
        countsForYield: i.scope === "batch",
      })),
      cookingLossPct: settings.cookingLossPct,
      portions: settings.portions ?? undefined,
      portionWeight: settings.portionWeight ?? undefined,
    });
    return { ok: true, cost, missingPrices: items.filter((i) => i.ingredient.unit_cost <= 0).length };
  } catch (e) {
    const noPortions = e instanceof Error && /porções|porção/.test(e.message);
    return { ok: false, reason: noPortions ? "no-portions" : "invalid" };
  }
}
