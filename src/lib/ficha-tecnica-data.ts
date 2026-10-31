import "server-only";
import { buildFichaTecnica, type FichaIngredient, type FichaTecnica } from "@/lib/ficha-tecnica";
import { loadCurrentPrices, loadPricingContext } from "@/lib/pricing-data";
import { computeRecipe, recipeCostSettings } from "@/lib/recipe-cost";
import { loadIngredients, loadReceitaRows, loadReceitas, loadRecipe, loadRecipes } from "@/lib/recipes-data";

export type FichaOptionItem = { name: string; tag: "insumo" | "receita" | "embalagem" };
export type FichaOption = { id: string; name: string; kind: "marmita" | "receita"; category: string | null; complete: boolean; /** O que tem dentro, só para a pessoa conferir qual item é. */ items: FichaOptionItem[] };

/** Produtos e receitas que podem ter a ficha técnica impressa, com a indicação de quais estão completas (com preço de tudo). */
export async function loadFichaOptions(orgId: string, canWrite: boolean): Promise<FichaOption[]> {
  const ctx = await loadPricingContext(orgId, canWrite);
  const [{ recipes, items }, ingredients, receitas, receitaRows] = await Promise.all([loadRecipes(), loadIngredients(), loadReceitas(), loadReceitaRows(orgId)]);
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const margin = ctx?.settings.safetyMarginPct ?? 0;

  const marmitas: FichaOption[] = recipes.map((r) => {
    const costItems = items.filter((i) => i.recipe_id === r.id && byId.has(i.ingredient_id)).map((i) => ({ ingredient: byId.get(i.ingredient_id)!, netQty: i.net_qty, scope: i.scope }));
    const view = computeRecipe(recipeCostSettings(r, margin), costItems);
    const contents = items.filter((i) => i.recipe_id === r.id).flatMap((i) => (byId.has(i.ingredient_id) ? [{ name: byId.get(i.ingredient_id)!.name, tag: byId.get(i.ingredient_id)!.kind }] : []));
    return { id: r.id, name: r.name, kind: "marmita" as const, category: r.category, complete: view.ok && view.missingPrices === 0, items: contents };
  });
  const receitaOptions: FichaOption[] = receitas.map((r) => ({
    id: r.id,
    name: r.name,
    kind: "receita" as const,
    category: null,
    complete: r.costPerKg !== null,
    items: (receitaRows.find((x) => x.id === r.id)?.items ?? []).flatMap((i) => (i.ingredient_id && byId.has(i.ingredient_id) ? [{ name: byId.get(i.ingredient_id)!.name, tag: byId.get(i.ingredient_id)!.kind }] : [])),
  }));
  return [...marmitas, ...receitaOptions].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** A ficha técnica pronta para imprimir de um produto ou receita da marmitaria atual. `null` se não existir. */
export async function loadFichaTecnica(orgId: string, canWrite: boolean, id: string): Promise<FichaTecnica | null> {
  const ctx = await loadPricingContext(orgId, canWrite);
  if (!ctx) return null;
  const [found, ingredients, prices] = await Promise.all([loadRecipe(id), loadIngredients(), loadCurrentPrices(ctx.unit.id)]);
  if (!found) return null;
  const map = new Map<string, FichaIngredient>(
    ingredients.map((i) => [i.id, { id: i.id, name: i.name, kind: i.kind, purchase_unit: i.purchase_unit, unit_cost: i.unit_cost, correction_factor: i.correction_factor, cooking_yield: i.cooking_yield }]),
  );
  const { recipe, items } = found;
  return buildFichaTecnica({
    recipe: {
      id: recipe.id,
      kind: recipe.kind,
      name: recipe.name,
      category: recipe.category,
      mode: recipe.mode,
      portions: recipe.portions,
      portion_weight: recipe.portion_weight,
      portion_weight_unit: recipe.portion_weight_unit,
      cooking_loss_pct: recipe.cooking_loss_pct,
    },
    items: items.map((i) => ({ ingredient_id: i.ingredient_id, net_qty: i.net_qty, qty_unit: i.qty_unit, scope: i.scope })),
    ingredients: map,
    safetyMarginPct: ctx.settings.safetyMarginPct ?? 0,
    price: prices.get(id) ?? null,
  });
}
