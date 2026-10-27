import "server-only";
import { isPurchaseUnit } from "@/lib/calc";
import { hasMenuConnection, loadMenuRecipeSales } from "@/lib/menu-data";
import { lastMonths, monthBounds } from "@/lib/month-view";
import { loadPricingContext } from "@/lib/pricing-data";
import { computeRecipe, recipeCostSettings, recipeUsage } from "@/lib/recipe-cost";
import { loadIngredients, loadReceitaUsage, loadRecipes } from "@/lib/recipes-data";
import { buildStock, stockResult, type StockResult, type StockRow } from "@/lib/stock-view";
import { createClient } from "@/lib/supabase/server";

export type StockMonth = {
  unitId: string;
  month: string;
  rows: StockRow[];
  result: StockResult | null;
  revenue: number;
  purchasesTotal: number;
  theoreticalCost: number | null;
  /** Marmitas prontas no freezer (R$ ao custo) no fim do mês e no fim do anterior. */
  finishedClosing: number | null;
  finishedOpening: number;
  /** Produtos vendidos com ficha incompleta: o uso deles não entra na conta. */
  recipesWithoutUsage: number;
  combosSold: number;
  /** Há contagem do mês anterior (o começo do mês é conhecido). */
  hasOpening: boolean;
  soldUnits: number;
};

/** Compras, uso esperado e contagem de cada insumo no mês, e o CMV real quando há contagem. */
export async function loadStockMonth(orgId: string, canWrite: boolean, month: string): Promise<StockMonth | null> {
  const ctx = await loadPricingContext(orgId, canWrite);
  if (!ctx) return null;
  const unitId = ctx.unit.id;
  const previous = lastMonths(month, 2)[1];
  const supabase = await createClient();

  const [ingredients, { recipes, items }, { data: period }, { data: prevPeriod }, { data: purchases }, { data: counts }, { data: prevCounts }] = await Promise.all([
    loadIngredients(),
    loadRecipes(),
    supabase.from("periods").select("id, revenue, purchases, finished_stock_value").eq("unit_id", unitId).eq("month", month).maybeSingle(),
    supabase.from("periods").select("finished_stock_value").eq("unit_id", unitId).eq("month", previous).maybeSingle(),
    supabase.from("ingredient_purchases").select("ingredient_id, qty_base, source").eq("unit_id", unitId).eq("month", month),
    supabase.from("ingredient_stock_counts").select("ingredient_id, qty_base").eq("unit_id", unitId).eq("month", month),
    supabase.from("ingredient_stock_counts").select("ingredient_id, qty_base").eq("unit_id", unitId).eq("month", previous),
  ]);

  // Marmitas vendidas por ficha: as digitadas + as do cardápio digital.
  const units = new Map<string, number>();
  let combosSold = 0;
  if (period) {
    const [{ data: sales }, { data: comboSales }] = await Promise.all([
      supabase.from("period_sales").select("recipe_id, qty_sold").eq("period_id", period.id),
      supabase.from("period_combo_sales").select("qty_sold").eq("period_id", period.id),
    ]);
    for (const s of sales ?? []) units.set(s.recipe_id as string, (units.get(s.recipe_id as string) ?? 0) + Number(s.qty_sold));
    combosSold = (comboSales ?? []).reduce((n, c) => n + Number(c.qty_sold), 0);
  }
  if (await hasMenuConnection(orgId)) {
    const { start, end } = monthBounds(month);
    for (const [recipeId, s] of await loadMenuRecipeSales(unitId, start, end)) units.set(recipeId, (units.get(recipeId) ?? 0) + s.units);
  }

  // Uso esperado de cada insumo e custo esperado (sem margem de segurança: aqui interessa o que realmente sai da prateleira).
  const byIngredient = new Map(ingredients.map((i) => [i.id, i]));
  // Receita usada na marmita (gramas prontos) vira o que ela gastou de verdade: arroz cru, sal, cebola…
  const receitaUsage = await loadReceitaUsage(ingredients);
  const used = new Map<string, number>();
  let theoretical = 0;
  let counted = false;
  let recipesWithoutUsage = 0;
  let soldUnits = 0;
  for (const r of recipes) {
    const sold = units.get(r.id) ?? 0;
    if (sold <= 0) continue;
    soldUnits += sold;
    const recipeItems = items
      .filter((i) => i.recipe_id === r.id && byIngredient.has(i.ingredient_id))
      .map((i) => ({ ingredientId: i.ingredient_id, ingredient: byIngredient.get(i.ingredient_id)!, netQty: i.net_qty, scope: i.scope }));
    const settings = recipeCostSettings(r, 0);
    const view = computeRecipe(settings, recipeItems);
    const usage = recipeUsage(settings, recipeItems);
    if (!view.ok || !usage) {
      recipesWithoutUsage++;
      continue;
    }
    theoretical += view.cost.costPerPortion.toNumber() * sold;
    counted = true;
    for (const [ingredientId, perPortion] of usage) {
      const parts = receitaUsage.get(ingredientId);
      if (parts) for (const p of parts) used.set(p.ingredientId, (used.get(p.ingredientId) ?? 0) + perPortion * p.grossPerGram * sold);
      else used.set(ingredientId, (used.get(ingredientId) ?? 0) + perPortion * sold);
    }
  }

  const toMap = (rows: { ingredient_id: unknown; qty_base: unknown }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.ingredient_id as string, (m.get(r.ingredient_id as string) ?? 0) + Number(r.qty_base));
    return m;
  };
  const purchasedNfe = toMap((purchases ?? []).filter((p) => p.source === "nfe"));
  const purchasedManual = toMap((purchases ?? []).filter((p) => p.source === "manual"));

  const stockIngredients = ingredients
    .filter((i) => i.kind !== "receita" && !i.archived_at && isPurchaseUnit(i.purchase_unit))
    .map((i) => ({ id: i.id, name: i.name, purchaseUnit: i.purchase_unit, unitCost: i.unit_cost }));
  const rows = buildStock({ ingredients: stockIngredients, opening: toMap(prevCounts), purchasedNfe, purchasedManual, used, counts: toMap(counts) });

  const revenue = Number(period?.revenue ?? 0);
  const purchasesTotal = Number(period?.purchases ?? 0);
  const theoreticalCost = counted ? theoretical : null;
  const finishedOpening = Number(prevPeriod?.finished_stock_value ?? 0);
  const finishedClosing = period?.finished_stock_value === null || period?.finished_stock_value === undefined ? null : Number(period.finished_stock_value);

  return {
    unitId,
    month,
    rows,
    result: stockResult({ rows, purchasesTotal, theoreticalCost, revenue, finishedOpening, finishedClosing: finishedClosing ?? 0 }),
    revenue,
    purchasesTotal,
    theoreticalCost,
    finishedClosing,
    finishedOpening,
    recipesWithoutUsage,
    combosSold,
    hasOpening: (prevCounts ?? []).length > 0,
    soldUnits,
  };
}
