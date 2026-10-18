import "server-only";
import { loadDashboard } from "@/lib/dashboard-data";
import { mergeMonthWithMenu, monthPriceMoves, normalizeSnapshot, summarizeHistoryMonth, summarizeSamples, type ChangeEvent, type HistoryMonth, type PriceMove, type ProductSeries } from "@/lib/history-view";
import { summarizeCombo } from "@/lib/combo-view";
import { loadCombos, loadSalesWeights } from "@/lib/combos-data";
import { hasMenuConnection, loadMenuMonthly, loadMenuRecipeSales, type MenuMonthlyRow } from "@/lib/menu-data";
import { currentMonthStart, elapsedFraction, lastMonths, monthBounds } from "@/lib/month-view";
import { createClient } from "@/lib/supabase/server";

/** Já existe algum mês com faturamento (digitado ou vindo do cardápio)? Antes disso o Histórico não tem o que mostrar. */
export async function hasHistory(unitId: string): Promise<boolean> {
  const supabase = await createClient();
  const [{ data }, { data: menu }] = await Promise.all([
    supabase.from("periods").select("id").eq("unit_id", unitId).gt("revenue", 0).limit(1),
    supabase.from("menu_orders").select("id").eq("unit_id", unitId).limit(1),
  ]);
  return (data?.length ?? 0) > 0 || (menu?.length ?? 0) > 0;
}

export type HistoryEntry = {
  month: string;
  summary: HistoryMonth;
  /** Tem o registro do mês (custos e preços como eram durante o mês)? */
  hasSnapshot: boolean;
  /** Quanto do faturamento do mês veio do cardápio digital (o resto foi digitado pelo dono). */
  menuRevenue: number;
  menuOrders: number;
  /** Quantas vezes o app viu algo mudar no mês (preços, contas, equipe). */
  changeCount: number;
  moves: PriceMove[];
  events: ChangeEvent[];
  products: (ProductSeries & { sold: number })[];
};

/** Meses com alguma informação, do mais recente para o mais antigo. */
export async function loadHistory(orgId: string, canWrite: boolean): Promise<{ entries: HistoryEntry[]; unitName: string } | null> {
  const dash = await loadDashboard(orgId, canWrite, { awaitSnapshot: true }); // também grava a foto do mês atual (e espera, porque lê logo em seguida)
  if (!dash) return null;
  const unitId = dash.ctx.unit.id;
  const supabase = await createClient();
  const months = lastMonths(currentMonthStart(), 12);
  const oldest = months[months.length - 1];

  const [{ data: periods }, { data: snaps }, { data: history }, { data: ingredients }] = await Promise.all([
    supabase.from("periods").select("id, month, revenue, purchases").eq("unit_id", unitId).gte("month", oldest),
    supabase.from("month_snapshots").select("month, data").eq("unit_id", unitId).gte("month", oldest),
    supabase.from("ingredient_price_history").select("ingredient_id, unit_cost, changed_at").eq("org_id", orgId).order("changed_at", { ascending: false }).limit(3000),
    supabase.from("ingredients").select("id, name").eq("org_id", orgId),
  ]);

  const periodIds = (periods ?? []).map((p) => p.id as string);
  const { data: sales } = periodIds.length ? await supabase.from("period_sales").select("period_id, recipe_id, qty_sold").in("period_id", periodIds) : { data: [] };

  const snapByMonth = new Map((snaps ?? []).map((s) => [String(s.month), normalizeSnapshot(s.data, String(s.month))]));
  const periodByMonth = new Map((periods ?? []).map((p) => [String(p.month), p]));
  const names = new Map((ingredients ?? []).map((i) => [i.id as string, i.name as string]));
  const priceHistory = (history ?? []).map((h) => ({ ingredient_id: h.ingredient_id as string, unit_cost: Number(h.unit_cost), changed_at: h.changed_at as string }));
  const todayCost = new Map(dash.dishes.map((d) => [d.id, d.cost]));

  // Cardápio digital: faturamento, marmitas por ficha e combos de cada mês (o mês sem pedidos continua só com o digitado).
  const menuMonthly: Map<string, MenuMonthlyRow> = (await hasMenuConnection(orgId)) ? await loadMenuMonthly(unitId, oldest) : new Map();
  const menuUnits = new Map<string, Map<string, number>>();
  await Promise.all(
    [...menuMonthly.values()]
      .filter((m) => m.orders > 0)
      .map(async (m) => {
        const { start, end } = monthBounds(m.month);
        const sales = await loadMenuRecipeSales(unitId, start, end);
        menuUnits.set(m.month, new Map([...sales].map(([id, v]) => [id, v.units])));
      }),
  );
  const comboInfo = new Map<string, { cost: number | null; units: number }>();
  if ([...menuMonthly.values()].some((m) => m.comboQty.size > 0)) {
    const [combos, weights] = await Promise.all([loadCombos(orgId, { active: true }), loadSalesWeights(unitId)]);
    const recipeCosts = new Map(dash.dishes.map((d) => [d.id, { cost: d.cost }]));
    for (const c of combos) {
      const sc = summarizeCombo(c, recipeCosts, weights, dash.ctx.settings, dash.ctx.channels[0]?.fee_pct ?? 0);
      comboInfo.set(c.id, { cost: sc.cost > 0 ? sc.cost : null, units: sc.units });
    }
  }

  const entries: HistoryEntry[] = [];
  for (const month of months) {
    const period = periodByMonth.get(month);
    const snapshot = snapByMonth.get(month) ?? null;
    const menuMonth = menuMonthly.get(month);
    if (!period && !snapshot && !(menuMonth && menuMonth.orders > 0)) continue;

    const qty = new Map((sales ?? []).filter((s) => s.period_id === period?.id).map((s) => [s.recipe_id as string, Number(s.qty_sold)]));
    const monthEnd = monthBounds(month).end;
    const series = snapshot ? summarizeSamples(snapshot, month, monthEnd.getTime() > Date.now() ? new Date() : monthEnd) : null;
    const avgCost = new Map((series?.products ?? []).map((p) => [p.id, p.avgCost]));
    const costOf = (id: string) => (series ? (avgCost.get(id) ?? null) : (todayCost.get(id) ?? null));

    const merged = mergeMonthWithMenu({
      typed: { revenue: Number(period?.revenue ?? 0), qty },
      menu: { orders: menuMonth?.orders ?? 0, revenue: menuMonth?.revenue ?? 0, recipeUnits: menuUnits.get(month) ?? new Map(), comboQty: menuMonth?.comboQty ?? new Map() },
      costOf,
      combos: comboInfo,
    });

    entries.push({
      month,
      summary: summarizeHistoryMonth({
        revenue: merged.revenue,
        purchases: Number(period?.purchases ?? 0),
        soldUnits: merged.soldUnits,
        theoreticalCost: merged.theoreticalCost,
        snapshot: series?.average ?? null,
        elapsed: elapsedFraction(month),
      }),
      hasSnapshot: Boolean(series),
      menuRevenue: merged.menuRevenue,
      menuOrders: merged.menuOrders,
      changeCount: series?.events.length ?? 0,
      moves: monthPriceMoves(priceHistory, names, month),
      events: series?.events ?? [],
      products: (series?.products ?? []).map((p) => ({ ...p, sold: (qty.get(p.id) ?? 0) + (menuUnits.get(month)?.get(p.id) ?? 0) })),
    });
  }
  return { entries, unitName: dash.ctx.unit.name };
}
