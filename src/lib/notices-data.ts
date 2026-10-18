import "server-only";
import { loadDashboard } from "@/lib/dashboard-data";
import { currentMonthStart, lastMonths, monthLabel } from "@/lib/month-view";
import { buildNotices, type Notice } from "@/lib/notices";
import { createClient } from "@/lib/supabase/server";

/** Dia do mês no fuso de São Paulo (o servidor roda em UTC). */
function dayOfMonthBR(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", day: "2-digit" }).format(now));
}

/** Avisos da marmitaria: preços que subiram, marmitas abaixo da meta, cadastro incompleto e mês por fechar. */
export async function loadNotices(orgId: string, canWrite: boolean): Promise<Notice[]> {
  const data = await loadDashboard(orgId, canWrite);
  if (!data) return [];

  const month = lastMonths(currentMonthStart(), 2)[1];
  const supabase = await createClient();
  const { data: period } = await supabase.from("periods").select("id, revenue, purchases").eq("unit_id", data.ctx.unit.id).eq("month", month).maybeSingle();
  let sold = false;
  if (period) {
    const { count } = await supabase.from("period_sales").select("id", { count: "exact", head: true }).eq("period_id", period.id).gt("qty_sold", 0);
    sold = (count ?? 0) > 0;
  }
  const revenue = Number(period?.revenue ?? 0);

  return buildNotices({
    increases: data.increases,
    belowTarget: data.belowTarget.map((d) => d.name),
    noPriceCount: data.noPriceCount,
    staleCount: data.staleCount,
    previousMonth: {
      label: monthLabel(month).split(" de ")[0],
      month,
      closed: revenue > 0,
      soldOrRevenue: revenue > 0 || Number(period?.purchases ?? 0) > 0 || sold,
    },
    dayOfMonth: dayOfMonthBR(),
  });
}
