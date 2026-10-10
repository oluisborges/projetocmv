import "server-only";
import { summarizeFixedCosts, type FixedCostSummary } from "@/lib/fixed-costs-view";
import { summarizePanel, type PanelSummary } from "@/lib/panel-view";
import { loadStaff } from "@/lib/costs-data";
import { currentMonthStart, summarizeMonth, type MonthSummary } from "@/lib/month-view";
import { priceIncreaseAlerts, type PriceIncreaseAlert } from "@/lib/price-alerts";
import { loadCurrentPrices, loadPricingContext, type PricingContext } from "@/lib/pricing-data";
import { analyzePrice, type PriceAnalysis } from "@/lib/pricing-view";
import { computeRecipe } from "@/lib/recipe-cost";
import { loadIngredients, loadRecipes } from "@/lib/recipes-data";
import { STALE_DAYS } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type DashboardDish = {
  id: string;
  name: string;
  cost: number | null;
  price: number | null;
  analysis: PriceAnalysis | null;
};

export type Dashboard = {
  ctx: PricingContext;
  /** Nome do canal usado nas contas (o de menor taxa). */
  channelName: string;
  dishes: DashboardDish[];
  /** Insumos ativos e fichas ativas (para o checklist de primeiros passos). */
  ingredientCount: number;
  recipeCount: number;
  /** Fichas com preço de venda definido. */
  withPriceCount: number;
  pricedCount: number;
  belowTarget: DashboardDish[];
  /** Lucro líquido médio dos produtos com preço (fração), ou `null` se nenhuma tem preço. */
  avgNetPct: number | null;
  month: MonthSummary & { start: string; hasData: boolean };
  staleCount: number;
  noPriceCount: number;
  increases: PriceIncreaseAlert[];
  /** Médias dos produtos com preço (CMV, CMO, despesas, lucro); `null` se nenhuma tem custo e preço. */
  panel: PanelSummary | null;
  /** Equilíbrio do mês (precisa de custos cadastrados e de produto com preço). */
  breakEven: FixedCostSummary["breakEven"];
};

/** Tudo que o painel do Início precisa, numa carga só (cada consulta já filtrada pela organização). */
export async function loadDashboard(orgId: string, canWrite: boolean): Promise<Dashboard | null> {
  const ctx = await loadPricingContext(orgId, canWrite);
  if (!ctx) return null;

  const supabase = await createClient();
  const monthStart = currentMonthStart();

  const [ingredients, { recipes, items }, prices, staff, { data: ingPrices }, { data: period }, { data: history }] = await Promise.all([
    loadIngredients(),
    loadRecipes(),
    loadCurrentPrices(ctx.unit.id),
    loadStaff(ctx.unit.id),
    supabase.from("ingredients").select("purchase_price, price_updated_at").eq("org_id", orgId).is("archived_at", null),
    supabase.from("periods").select("id, revenue, purchases").eq("unit_id", ctx.unit.id).eq("month", monthStart).maybeSingle(),
    // Sem limite inferior de data: o alerta precisa do último preço ANTES da janela como base. Os mais recentes primeiro,
    // para que um eventual corte do limite descarte o histórico antigo, nunca o preço atual.
    supabase.from("ingredient_price_history").select("ingredient_id, unit_cost, changed_at").eq("org_id", orgId).order("changed_at", { ascending: false }).limit(2000),
  ]);

  const { data: salesRows } = period
    ? await supabase.from("period_sales").select("recipe_id, qty_sold").eq("period_id", period.id)
    : { data: [] as { recipe_id: string; qty_sold: number }[] };

  const cheapest = [...ctx.channels].sort((a, b) => a.fee_pct - b.fee_pct)[0];
  const feePct = cheapest?.fee_pct ?? 0;

  const byIngredient = new Map(ingredients.map((i) => [i.id, i]));
  const dishes: DashboardDish[] = recipes.map((r) => {
    const view = computeRecipe(
      { portions: r.portions, portionWeight: r.portion_weight, cookingLossPct: r.cooking_loss_pct, useCookingYield: r.mode === "serving" },
      items.filter((i) => i.recipe_id === r.id && byIngredient.has(i.ingredient_id)).map((i) => ({ ingredient: byIngredient.get(i.ingredient_id)!, netQty: i.net_qty, scope: i.scope })),
    );
    const cost = view.ok ? view.cost.costPerPortion.toNumber() : null;
    const price = prices.get(r.id) ?? null;
    return { id: r.id, name: r.name, cost, price, analysis: cost === null ? null : analyzePrice({ cost, settings: ctx.settings, feePct, price }) };
  });

  const priced = dishes.filter((d) => d.analysis?.at);
  const belowTarget = priced.filter((d) => d.analysis!.at!.status === "below-target");
  const avgNetPct = priced.length > 0 ? priced.reduce((s, d) => s + d.analysis!.at!.netPct, 0) / priced.length : null;

  const qty = new Map((salesRows ?? []).map((r) => [r.recipe_id as string, Number(r.qty_sold)]));
  const summary = summarizeMonth({
    revenue: Number(period?.revenue ?? 0),
    purchases: Number(period?.purchases ?? 0),
    sales: dishes.map((d) => ({ recipeId: d.id, qty: qty.get(d.id) ?? 0, cost: d.cost })),
    staff: staff.map((m) => ({ area: m.area, monthlySalary: m.monthly_salary, chargesPct: m.charges_pct })),
  });

  const recipesUsing = new Map<string, number>();
  const seen = new Set<string>();
  const activeRecipeIds = new Set(recipes.map((r) => r.id)); // fichas arquivadas não contam
  for (const it of items) {
    if (!activeRecipeIds.has(it.recipe_id)) continue;
    const key = `${it.recipe_id}:${it.ingredient_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    recipesUsing.set(it.ingredient_id, (recipesUsing.get(it.ingredient_id) ?? 0) + 1);
  }

  const staleBefore = Date.now() - STALE_DAYS * 86_400_000;
  const activeIngs = ingPrices ?? [];

  const panel = summarizePanel({
    dishes: dishes.map((d) => ({ id: d.id, name: d.name, cost: d.cost, price: d.price })),
    settings: ctx.settings,
    feePct,
    staffShareOfFixed: ctx.fixedTotal > 0 ? ctx.staffTotal / ctx.fixedTotal : 0,
  });
  const { breakEven } = summarizeFixedCosts({
    fixedCosts: [ctx.fixedTotal - ctx.staffTotal],
    staff: staff.map((m) => ({ area: m.area, monthlySalary: m.monthly_salary, chargesPct: m.charges_pct })),
    monthlyRevenue: ctx.monthlyRevenue,
    monthlyUnits: ctx.monthlyUnits,
    dishes: dishes.filter((d) => d.cost !== null && (d.price ?? 0) > 0).map((d) => ({ price: d.price as number, cost: d.cost as number })),
    taxPct: ctx.settings.taxPct,
    feePct,
  });

  return {
    ctx,
    channelName: cheapest?.name ?? "venda direta",
    dishes,
    ingredientCount: activeIngs.length,
    recipeCount: dishes.length,
    withPriceCount: dishes.filter((d) => (d.price ?? 0) > 0).length,
    pricedCount: priced.length,
    belowTarget,
    avgNetPct,
    month: { ...summary, start: monthStart, hasData: summary.revenue > 0 || summary.purchases > 0 || summary.soldUnits > 0 },
    staleCount: activeIngs.filter((i) => Number(i.purchase_price) > 0 && new Date(i.price_updated_at).getTime() < staleBefore).length,
    noPriceCount: activeIngs.filter((i) => !(Number(i.purchase_price) > 0)).length,
    increases: priceIncreaseAlerts({
      history: (history ?? []).map((h) => ({ ingredient_id: h.ingredient_id as string, unit_cost: Number(h.unit_cost), changed_at: h.changed_at as string })),
      names: new Map(ingredients.map((i) => [i.id, i.name])),
      recipesUsing,
    }),
    panel,
    breakEven,
  };
}
