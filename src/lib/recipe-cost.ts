import { NoPortionsError, baseUnitOf, isPurchaseUnit, receitaCostPerGram, recipeCost, type RecipeCost } from "@/lib/calc";

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

/**
 * Quanto de cada insumo COMPRADO (na unidade-base: g, ml ou un) uma porção da ficha consome, já com rendimento e fator de correção.
 * Sem a margem de segurança: ela cobre perda no custo, não é insumo que saiu da prateleira. `null` se a ficha está incompleta.
 */
export function recipeUsage(settings: CostSettings, items: (CostItem & { ingredientId: string })[]): Map<string, number> | null {
  const view = computeRecipe(settings, items);
  if (!view.ok) return null;
  const portions = view.cost.portions.toNumber();
  if (!(portions > 0)) return null;
  const out = new Map<string, number>();
  for (const i of items) {
    const yieldFactor = settings.useCookingYield && i.scope === "batch" ? (i.ingredient.cooking_yield ?? 1) : 1;
    const gross = (i.netQty / (yieldFactor > 0 ? yieldFactor : 1)) * i.ingredient.correction_factor;
    out.set(i.ingredientId, (out.get(i.ingredientId) ?? 0) + (i.scope === "batch" ? gross / portions : gross));
  }
  return out;
}

/** Receita (arroz, estrogonofe, purê feitos em lote) como os ingredientes que ela leva e o peso total que rende pronta. */
export type ReceitaInput = { ingredients: { ingredient: CostIngredient; netQty: number }[]; readyWeightGrams: number | null };

export type ReceitaCost = { batchCost: number; readyWeightGrams: number; costPerGram: number; missingPrices: number };

/**
 * Custo de uma Receita: o lote inteiro (com fator de correção de cada ingrediente, sal e tempero inclusos) ÷ o peso pronto.
 * `null` enquanto faltar ingrediente ou o peso que ela rende. A margem de segurança NÃO entra aqui: ela é aplicada
 * na marmita que usa a receita (como em qualquer ingrediente do lote), para não contar duas vezes.
 */
export function computeReceita(r: ReceitaInput): ReceitaCost | null {
  if (!r.readyWeightGrams || r.readyWeightGrams <= 0 || r.ingredients.length === 0) return null;
  const view = computeRecipe(
    { portions: 1, portionWeight: null, cookingLossPct: 0 },
    r.ingredients.map((i) => ({ ingredient: i.ingredient, netQty: i.netQty, scope: "batch" as const })),
  );
  if (!view.ok) return null;
  const batchCost = view.cost.batchCost.toNumber();
  return {
    batchCost,
    readyWeightGrams: r.readyWeightGrams,
    costPerGram: receitaCostPerGram(batchCost, r.readyWeightGrams).toNumber(),
    missingPrices: view.missingPrices,
  };
}

/**
 * Custo de todas as Receitas de uma marmitaria de uma vez. `rows` são as linhas de `recipe_items` das receitas
 * (só ingredientes: receita não leva receita) e `ingredientById` os insumos já com preço.
 */
export function computeReceitas(
  receitas: { id: string; portion_weight: number | null }[],
  rows: { recipe_id: string; ingredient_id: string | null; net_qty: number }[],
  ingredientById: Map<string, CostIngredient>,
): Map<string, ReceitaCost | null> {
  const out = new Map<string, ReceitaCost | null>();
  for (const r of receitas) {
    const ingredients = rows.flatMap((i) => {
      const ingredient = i.recipe_id === r.id && i.ingredient_id ? ingredientById.get(i.ingredient_id) : undefined;
      return ingredient ? [{ ingredient, netQty: i.net_qty }] : [];
    });
    out.set(r.id, computeReceita({ ingredients, readyWeightGrams: r.portion_weight }));
  }
  return out;
}
