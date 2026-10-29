import "server-only";
import { getActiveOrg } from "@/lib/auth";
import { fromBaseQty, isPurchaseUnit } from "@/lib/calc";
import { loadCurrentPrices, loadPricingContext } from "@/lib/pricing-data";
import { analyzePrice } from "@/lib/pricing-view";
import { computeRecipe, recipeCostSettings, recipeUsage } from "@/lib/recipe-cost";
import { loadIngredients, loadRecipes } from "@/lib/recipes-data";

export type FichaLine = { ingredient: string; kind: "insumo" | "embalagem" | "receita"; qty: number; unit: string; cost: number };

export type FichaReport = {
  id: string;
  name: string;
  category: string | null;
  mode: "serving" | "batch";
  portions: number | null;
  lines: FichaLine[];
  /** Custo por marmita (com a margem de segurança); `null` se a ficha está incompleta. */
  cost: number | null;
  price: number | null;
  /** Lucro líquido ÷ preço, com os percentuais configurados. */
  netPct: number | null;
};

export type FichasReport = { orgName: string; generatedAt: Date; fichas: FichaReport[] };

/** Fichas técnicas com o custo de cada linha, para imprimir (cozinha) ou guardar (Excel). */
export async function loadFichasReport(orgId: string, canWrite: boolean): Promise<FichasReport | null> {
  const ctx = await loadPricingContext(orgId, canWrite);
  if (!ctx) return null;
  const [ingredients, { recipes, items }, prices, active] = await Promise.all([loadIngredients(), loadRecipes(), loadCurrentPrices(ctx.unit.id), getActiveOrg()]);
  const byIngredient = new Map(ingredients.map((i) => [i.id, i]));
  const feePct = ctx.channels[0]?.fee_pct ?? 0;

  const fichas: FichaReport[] = recipes
    .map((r) => {
      const recipeItems = items
        .filter((i) => i.recipe_id === r.id && byIngredient.has(i.ingredient_id))
        .map((i) => ({ item: i, ingredientId: i.ingredient_id, ingredient: byIngredient.get(i.ingredient_id)!, netQty: i.net_qty, scope: i.scope }));
      const settings = recipeCostSettings(r, ctx.settings.safetyMarginPct);
      const view = computeRecipe(settings, recipeItems);
      const usage = recipeUsage(recipeCostSettings(r, 0), recipeItems);
      const cost = view.ok ? view.cost.costPerPortion.toNumber() : null;
      const price = prices.get(r.id) ?? null;
      const lines: FichaLine[] = recipeItems.map(({ item, ingredient, ingredientId }) => {
        const unit = item.qty_unit && isPurchaseUnit(item.qty_unit) ? item.qty_unit : null;
        return {
          ingredient: ingredient.name,
          kind: ingredient.kind,
          qty: unit ? fromBaseQty(item.net_qty, unit).toNumber() : item.net_qty,
          unit: unit ?? "",
          cost: usage ? (usage.get(ingredientId) ?? 0) * ingredient.unit_cost : 0,
        };
      });
      const analysis = cost !== null ? analyzePrice({ cost, settings: ctx.settings, feePct, price }) : null;
      return { id: r.id, name: r.name, category: r.category, mode: r.mode, portions: r.portions, lines, cost, price, netPct: analysis?.at?.netPct ?? null };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return { orgName: active?.orgName ?? "Marmitaria", generatedAt: new Date(), fichas };
}
