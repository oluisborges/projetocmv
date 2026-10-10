import "server-only";
import { loadDashboard } from "@/lib/dashboard-data";
import { monthPriceMoves, normalizeSnapshot, summarizeHistoryMonth, summarizeSamples, type ChangeEvent, type HistoryMonth, type PriceMove, type ProductSeries } from "@/lib/history-view";
import { currentMonthStart, lastMonths } from "@/lib/month-view";
import { createClient } from "@/lib/supabase/server";

export type HistoryEntry = {
  month: string;
  summary: HistoryMonth;
  /** Tem o registro do mês (custos e preços como eram durante o mês)? */
  hasSnapshot: boolean;
  /** Quantas vezes o app viu algo mudar no mês (preços, contas, equipe). */
  changeCount: number;
  moves: PriceMove[];
  events: ChangeEvent[];
  products: (ProductSeries & { sold: number })[];
};

/** Meses com alguma informação, do mais recente para o mais antigo. */
export async function loadHistory(orgId: string, canWrite: boolean): Promise<{ entries: HistoryEntry[]; unitName: string } | null> {
  const dash = await loadDashboard(orgId, canWrite); // também grava a foto do mês atual
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

  const entries: HistoryEntry[] = [];
  for (const month of months) {
    const period = periodByMonth.get(month);
    const snapshot = snapByMonth.get(month) ?? null;
    if (!period && !snapshot) continue;

    const qty = new Map((sales ?? []).filter((s) => s.period_id === period?.id).map((s) => [s.recipe_id as string, Number(s.qty_sold)]));
    const [yy, mm] = month.split("-").map(Number);
    const monthEnd = new Date(Date.UTC(yy, mm, 1));
    const series = snapshot ? summarizeSamples(snapshot, month, monthEnd.getTime() > Date.now() ? new Date() : monthEnd) : null;
    const avgCost = new Map((series?.products ?? []).map((p) => [p.id, p.avgCost]));
    const costOf = (id: string) => (series ? (avgCost.get(id) ?? null) : (todayCost.get(id) ?? null));

    let theoretical = 0;
    let counted = false;
    for (const [id, q] of qty) {
      const c = costOf(id);
      if (q > 0 && c !== null) {
        theoretical += c * q;
        counted = true;
      }
    }
    const soldUnits = [...qty.values()].reduce((s, q) => s + q, 0);

    entries.push({
      month,
      summary: summarizeHistoryMonth({
        revenue: Number(period?.revenue ?? 0),
        purchases: Number(period?.purchases ?? 0),
        soldUnits,
        theoreticalCost: counted ? theoretical : null,
        snapshot: series?.average ?? null,
      }),
      hasSnapshot: Boolean(series),
      changeCount: series?.events.length ?? 0,
      moves: monthPriceMoves(priceHistory, names, month),
      events: series?.events ?? [],
      products: (series?.products ?? []).map((p) => ({ ...p, sold: qty.get(p.id) ?? 0 })),
    });
  }
  return { entries, unitName: dash.ctx.unit.name };
}
