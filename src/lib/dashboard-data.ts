import "server-only";
import { after } from "next/server";
import { saveMonthSnapshot } from "@/lib/snapshot-data";
import type { MenuLine, MenuMonth, OutsideEstimate } from "@/lib/calc";
import { summarizeCombo } from "@/lib/combo-view";
import { loadCombos, loadSalesWeights } from "@/lib/combos-data";
import { hasMenuConnection, loadMenuMonth, loadMenuProducts, loadMenuRecipeSales } from "@/lib/menu-data";
import { buildMenuMonth, menuProfit, usesMenu } from "@/lib/menu-view";
import { summarizeFixedCosts, type FixedCostSummary } from "@/lib/fixed-costs-view";
import { summarizePanel, type PanelSummary } from "@/lib/panel-view";
import { loadStaff } from "@/lib/costs-data";
import { normalizeSnapshot, summarizeSamples } from "@/lib/history-view";
import { currentMonthStart, lastMonths, monthBounds, summarizeMonth, type MonthSummary } from "@/lib/month-view";
import { priceIncreaseAlerts, type PriceIncreaseAlert } from "@/lib/price-alerts";
import { loadCurrentPrices, loadPricingContext, type PricingContext } from "@/lib/pricing-data";
import { analyzePrice, type PriceAnalysis } from "@/lib/pricing-view";
import { computeRecipe, recipeCostSettings } from "@/lib/recipe-cost";
import { loadIngredients, loadReceitaUsage, loadRecipes } from "@/lib/recipes-data";
import { STALE_DAYS } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type DashboardDish = {
  id: string;
  name: string;
  cost: number | null;
  price: number | null;
  analysis: PriceAnalysis | null;
  /** Marmitas vendidas nos últimos meses (as mesmas que pesam as médias); 0 sem vendas. */
  weight: number;
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
  /**
   * Base da conta do mês, a MESMA do Histórico: custos, taxas e contas fixas como valeram durante o mês (média pelo tempo),
   * e não só os de hoje. Sem registro do mês, vale o de hoje.
   */
  monthBasis: { variablePct: number; fixedTotal: number };
  /** Números do cardápio digital no mês do resumo (`null` sem cardápio conectado ou sem pedidos no mês). */
  menu: {
    orders: number;
    revenue: number;
    discount: number;
    summary: MenuMonth;
    outside: OutsideEstimate;
    outsideRevenue: number;
    outsideFromDishes: boolean;
    fixedCosts: number;
    unlinkedProducts: number;
  } | null;
  staleCount: number;
  noPriceCount: number;
  increases: PriceIncreaseAlert[];
  /** Médias dos produtos com preço (CMV, CMO, despesas, lucro); `null` se nenhuma tem custo e preço. */
  panel: PanelSummary | null;
  /** `avgNetPct` e o painel pesam cada produto pelas vendas dos últimos meses. */
  weighted: boolean;
  /** Equilíbrio do mês (precisa de custos cadastrados e de produto com preço). */
  breakEven: FixedCostSummary["breakEven"];
};

/** Tudo que o painel do Início precisa, numa carga só (cada consulta já filtrada pela organização). */
export async function loadDashboard(orgId: string, canWrite: boolean, opts: { awaitSnapshot?: boolean } = {}): Promise<Dashboard | null> {
  const ctx = await loadPricingContext(orgId, canWrite);
  if (!ctx) return null;

  const supabase = await createClient();
  const now = currentMonthStart();
  const previous = lastMonths(now, 2)[1];

  const [ingredients, { recipes, items }, prices, staff, { data: ingPrices }, { data: monthPeriods }, { data: recentPeriods }, { data: history }] = await Promise.all([
    loadIngredients(),
    loadRecipes(),
    loadCurrentPrices(ctx.unit.id),
    loadStaff(ctx.unit.id),
    supabase.from("ingredients").select("purchase_price, price_updated_at").eq("org_id", orgId).is("archived_at", null),
    supabase.from("periods").select("id, month, revenue, purchases").eq("unit_id", ctx.unit.id).in("month", [now, previous]),
    supabase.from("periods").select("id").eq("unit_id", ctx.unit.id).gt("revenue", 0).order("month", { ascending: false }).limit(3),
    // Sem limite inferior de data: o alerta precisa do último preço ANTES da janela como base. Os mais recentes primeiro,
    // para que um eventual corte do limite descarte o histórico antigo, nunca o preço atual.
    supabase.from("ingredient_price_history").select("ingredient_id, unit_cost, changed_at").eq("org_id", orgId).order("changed_at", { ascending: false }).limit(2000),
  ]);

  // O resumo do mês usa o mês em andamento se ele já tem números; senão, o mês anterior (no começo do mês o atual está vazio).
  const hasNumbers = (p?: { revenue: unknown; purchases: unknown }) => Number(p?.revenue ?? 0) > 0 || Number(p?.purchases ?? 0) > 0;
  const currentPeriod = (monthPeriods ?? []).find((p) => String(p.month) === now);
  const previousPeriod = (monthPeriods ?? []).find((p) => String(p.month) === previous);
  const period = hasNumbers(currentPeriod) ? currentPeriod : hasNumbers(previousPeriod) ? previousPeriod : currentPeriod;
  const monthStart = period ? String(period.month) : now;

  // Custo de cada marmita como valeu durante o mês (média pelo tempo), igual ao Histórico. Sem registro, o de hoje.
  const { data: snapRow } = await supabase.from("month_snapshots").select("data").eq("unit_id", ctx.unit.id).eq("month", monthStart).maybeSingle();
  const snap = snapRow ? normalizeSnapshot(snapRow.data, monthStart) : null;
  const monthEnd = monthBounds(monthStart).end;
  const series = snap ? summarizeSamples(snap, monthStart, monthEnd.getTime() > Date.now() ? new Date() : monthEnd) : null;
  const seriesCost = new Map((series?.products ?? []).map((p) => [p.id, p.avgCost]));

  const periodIds = [...new Set([period?.id, ...(recentPeriods ?? []).map((p) => p.id)].filter(Boolean) as string[])];
  const { data: allSales } = periodIds.length
    ? await supabase.from("period_sales").select("period_id, recipe_id, qty_sold").in("period_id", periodIds)
    : { data: [] as { period_id: string; recipe_id: string; qty_sold: number }[] };
  const salesRows = (allSales ?? []).filter((r) => r.period_id === period?.id);
  // Pesos das médias: vendas dos últimos meses informados (até 3), por produto.
  const recentIds = new Set((recentPeriods ?? []).map((p) => p.id as string));
  const weights = new Map<string, number>();
  for (const r of allSales ?? []) if (recentIds.has(r.period_id as string)) weights.set(r.recipe_id as string, (weights.get(r.recipe_id as string) ?? 0) + Number(r.qty_sold));
  // As marmitas vendidas pelo cardápio nos últimos 3 meses (mês atual + 2 anteriores) também pesam nas médias.
  const menuConnected = await hasMenuConnection(orgId);
  if (menuConnected) {
    const since = monthBounds(lastMonths(now, 3)[2]).start;
    for (const [recipeId, s] of await loadMenuRecipeSales(ctx.unit.id, since, new Date())) weights.set(recipeId, (weights.get(recipeId) ?? 0) + s.units);
  }

  // Canal de referência: o de menor taxa (a lista já vem ordenada assim; é o mesmo em todas as telas).
  const cheapest = ctx.channels[0];
  const feePct = cheapest?.fee_pct ?? 0;

  const byIngredient = new Map(ingredients.map((i) => [i.id, i]));
  const dishes: DashboardDish[] = recipes.map((r) => {
    const view = computeRecipe(
      recipeCostSettings(r, ctx.settings.safetyMarginPct),
      items.filter((i) => i.recipe_id === r.id && byIngredient.has(i.ingredient_id)).map((i) => ({ ingredient: byIngredient.get(i.ingredient_id)!, netQty: i.net_qty, scope: i.scope })),
    );
    const cost = view.ok ? view.cost.costPerPortion.toNumber() : null;
    const price = prices.get(r.id) ?? null;
    return { id: r.id, name: r.name, cost, price, analysis: cost === null ? null : analyzePrice({ cost, settings: ctx.settings, feePct, price }), weight: weights.get(r.id) ?? 0 };
  });

  const monthCost = (d: DashboardDish): number | null => (series ? (seriesCost.get(d.id) ?? null) : d.cost);

  // "Produto com preço" = custo calculado (> 0) e preço de venda definido: o mesmo critério do Painel.
  const priced = dishes.filter((d) => d.analysis?.at && (d.cost ?? 0) > 0);
  const belowTarget = priced.filter((d) => d.analysis!.at!.status === "below-target");
  const weighted = priced.some((d) => (weights.get(d.id) ?? 0) > 0);
  const weightOf = (id: string) => (weighted ? (weights.get(id) ?? 0) : 1);
  const weightSum = priced.reduce((s, d) => s + weightOf(d.id), 0);
  const avgNetPct = priced.length > 0 && weightSum > 0 ? priced.reduce((s, d) => s + d.analysis!.at!.netPct * weightOf(d.id), 0) / weightSum : null;

  const qty = new Map(salesRows.map((r) => [r.recipe_id as string, Number(r.qty_sold)]));

  // Cardápio digital: o faturamento digitado é só a venda de fora; o total é cardápio + digitado (veja Mês → Fechar o mês).
  const typedOutside = Number(period?.revenue ?? 0);
  let menu: Dashboard["menu"] = null;
  let menuLines: MenuLine[] = [];
  if (menuConnected) {
    const data = await loadMenuMonth(ctx.unit.id, monthStart);
    if (usesMenu(true, data.orders)) {
      const [products, combos, comboWeights] = await Promise.all([loadMenuProducts(orgId), loadCombos(orgId, { active: true }), loadSalesWeights(ctx.unit.id)]);
      const recipeCosts = new Map(dishes.map((d) => [d.id, { cost: monthCost(d) }]));
      const comboTargets = new Map(
        combos.map((c) => {
          const sc = summarizeCombo(c, recipeCosts, comboWeights, ctx.settings, feePct);
          return [c.id, { cost: sc.cost > 0 ? sc.cost : null, units: sc.units }] as const;
        }),
      );
      // Os cardápios cobram mensalidade fixa (custo fixo), não % por pedido: aqui só impostos e outras taxas.
      const variablePct = ctx.settings.taxPct + (ctx.settings.otherPct ?? 0);
      const view = buildMenuMonth({ products, sales: data.sales, recipes: recipeCosts, combos: comboTargets, variablePct });
      const profit = menuProfit(view, { typedRevenue: typedOutside, dishes: dishes.map((d) => ({ qty: qty.get(d.id) ?? 0, price: d.price, cost: monthCost(d) })), variablePct });
      menu = {
        orders: data.orders,
        revenue: data.revenue,
        discount: data.discount,
        summary: view.summary,
        outside: profit.outside,
        outsideRevenue: profit.outsideRevenue,
        outsideFromDishes: profit.outsideFromDishes,
        fixedCosts: ctx.fixedTotal,
        unlinkedProducts: view.unlinkedProducts,
      };
      menuLines = view.lines;
    }
  }

  const summary = summarizeMonth({
    revenue: (menu ? menu.outsideRevenue : typedOutside) + (menu?.revenue ?? 0),
    purchases: Number(period?.purchases ?? 0),
    sales: [
      ...dishes.map((d) => ({ recipeId: d.id, qty: qty.get(d.id) ?? 0, cost: monthCost(d) })),
      ...menuLines.flatMap((l) =>
        l.status === "linked" ? [{ recipeId: "menu", qty: Number(l.qty), cost: l.costPerSale == null ? null : Number(l.costPerSale), unitsPerSale: l.unitsPerSale }] : [],
      ),
    ],
    staff: staff.map((m) => ({ area: m.area, monthlySalary: m.monthly_salary, chargesPct: m.charges_pct })),
  });

  const recipesUsing = new Map<string, number>();
  const seen = new Set<string>();
  const activeRecipeIds = new Set(recipes.map((r) => r.id)); // fichas arquivadas não contam
  // Marmita que usa uma Receita (arroz, estrogonofe…) também depende dos insumos dessa receita.
  const receitaUsage = await loadReceitaUsage(ingredients);
  for (const it of items) {
    if (!activeRecipeIds.has(it.recipe_id)) continue;
    for (const ingredientId of receitaUsage.get(it.ingredient_id)?.map((p) => p.ingredientId) ?? [it.ingredient_id]) {
      const key = `${it.recipe_id}:${ingredientId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      recipesUsing.set(ingredientId, (recipesUsing.get(ingredientId) ?? 0) + 1);
    }
  }

  const staleBefore = Date.now() - STALE_DAYS * 86_400_000;
  const activeIngs = ingPrices ?? [];

  const panel = summarizePanel({
    dishes: dishes.map((d) => ({ id: d.id, name: d.name, cost: d.cost, price: d.price })),
    settings: ctx.settings,
    feePct,
    staffShareOfFixed: ctx.fixedTotal > 0 ? ctx.staffTotal / ctx.fixedTotal : 0,
    weights,
  });
  const { breakEven } = summarizeFixedCosts({
    fixedCosts: [ctx.fixedTotal - ctx.staffTotal],
    staff: staff.map((m) => ({ area: m.area, monthlySalary: m.monthly_salary, chargesPct: m.charges_pct })),
    monthlyRevenue: ctx.monthlyRevenue,
    monthlyUnits: ctx.monthlyUnits,
    dishes: dishes.filter((d) => d.cost !== null && (d.price ?? 0) > 0).map((d) => ({ price: d.price as number, cost: d.cost as number, qty: weights.get(d.id) })),
    taxPct: ctx.settings.taxPct,
    feePct: feePct + (ctx.settings.otherPct ?? 0),
  });

  // Fotografia do mês para o Histórico (só quem edita grava).
  // Depois de responder: gravar a foto não deve atrasar a tela.
  if (canWrite) {
    const unitId = ctx.unit.id;
    const state = {
      fixedTotal: ctx.fixedTotal - ctx.staffTotal,
      staffTotal: ctx.staffTotal,
      taxPct: ctx.settings.taxPct,
      feePct: feePct + (ctx.settings.otherPct ?? 0), // taxa do canal + outras taxas: é a soma que entra na conta do mês
      products: dishes.map((d) => ({ id: d.id, name: d.name, cost: d.cost, price: d.price })),
    };
    // O Histórico lê a foto logo em seguida: nele a gravação é esperada.
    if (opts.awaitSnapshot) await saveMonthSnapshot(orgId, unitId, state);
    else after(() => saveMonthSnapshot(orgId, unitId, state));
  }

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
    monthBasis: series
      ? { variablePct: series.average.taxPct + series.average.feePct, fixedTotal: series.average.fixedTotal + series.average.staffTotal }
      : { variablePct: ctx.settings.taxPct + (ctx.settings.otherPct ?? 0), fixedTotal: ctx.fixedTotal },
    menu,
    staleCount: activeIngs.filter((i) => Number(i.purchase_price) > 0 && new Date(i.price_updated_at).getTime() < staleBefore).length,
    noPriceCount: activeIngs.filter((i) => !(Number(i.purchase_price) > 0)).length,
    increases: priceIncreaseAlerts({
      history: (history ?? []).map((h) => ({ ingredient_id: h.ingredient_id as string, unit_cost: Number(h.unit_cost), changed_at: h.changed_at as string })),
      names: new Map(ingredients.map((i) => [i.id, i.name])),
      recipesUsing,
    }),
    panel,
    weighted,
    breakEven,
  };
}
