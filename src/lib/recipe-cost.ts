import { NoPortionsError, baseUnitOf, isPurchaseUnit, recipeCost, type RecipeCost } from "@/lib/calc";

/** Insumo/embalagem como vem do banco (unit_cost = R$ por g/ml/un comprado, já bruto). */
export type CostIngredient = {
  unit_cost: number;
  correction_factor: number;
  /** Peso pronto ÷ peso cru (arroz 2,5; frango 0,75). Só vale em ficha "por unidade" (`useCookingYield`). */
  cooking_yield?: number;
  /** Unidade de compra (kg, g, l, ml, un). Itens em "un" (ovo, bandeja) não têm peso e não entram no rendimento. */
  purchase_unit?: string;
};

export type CostItem = { ingredient: CostIngredient; netQty: number; scope: "batch" | "portion" };

export type CostSettings = {
  portions: number | null;
  portionWeight: number | null;
  /** fração: 0.25 = 25% */
  cookingLossPct: number;
  /** Ficha "por unidade": as quantidades são gramas PRONTOS, então cada insumo converte pelo seu rendimento. */
  useCookingYield?: boolean;
  /** Margem de segurança sobre os insumos (fração). */
  safetyMarginPct?: number;
};

const isCountedInUnits = (unit?: string) => Boolean(unit && isPurchaseUnit(unit) && baseUnitOf(unit) === "un");

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
        // Embalagem e itens por porção não "rendem": só entra o rendimento dos insumos do lote.
        cookingYield: settings.useCookingYield && i.scope === "batch" ? (i.ingredient.cooking_yield ?? 1) : 1,
        netQty: i.netQty,
        scope: i.scope,
        countsForYield: i.scope === "batch" && !isCountedInUnits(i.ingredient.purchase_unit),
      })),
      cookingLossPct: settings.cookingLossPct,
      portions: settings.portions ?? undefined,
      portionWeight: settings.portionWeight ?? undefined,
      safetyMarginPct: settings.safetyMarginPct ?? 0,
    });
    return { ok: true, cost, missingPrices: items.filter((i) => i.ingredient.unit_cost <= 0).length };
  } catch (e) {
    return { ok: false, reason: e instanceof NoPortionsError ? "no-portions" : "invalid" };
  }
}

/**
 * Ajustes de custo de uma ficha como vêm do banco. Um lugar só monta isso (todas as telas passam por aqui),
 * para nenhuma esquecer a margem de segurança nem o modo "por unidade".
 */
export function recipeCostSettings(
  r: { portions: number | null; portion_weight: number | null; cooking_loss_pct: number; mode: "serving" | "batch" },
  safetyMarginPct: number | undefined,
): CostSettings {
  return {
    portions: r.portions,
    portionWeight: r.portion_weight,
    cookingLossPct: r.cooking_loss_pct,
    useCookingYield: r.mode === "serving",
    safetyMarginPct: safetyMarginPct ?? 0,
  };
}
