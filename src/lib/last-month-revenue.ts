import "server-only";
import { hasMenuConnection, loadMenuMonth } from "@/lib/menu-data";
import { usesMenu } from "@/lib/menu-view";
import { currentMonthStart, lastMonths } from "@/lib/month-view";
import { createClient } from "@/lib/supabase/server";

/**
 * Quanto a marmitaria faturou no mês passado: o que o cardápio digital recebeu mais o que foi digitado (venda de fora).
 * Muda sozinho todo mês, porque puxa os pedidos importados. `null` quando não há nenhum número do mês passado.
 */
export async function loadLastMonthRevenue(orgId: string, unitId: string, now: Date = new Date()): Promise<{ month: string; revenue: number } | null> {
  const month = lastMonths(currentMonthStart(now), 2)[1];
  const supabase = await createClient();
  const [{ data: period }, connected] = await Promise.all([
    supabase.from("periods").select("revenue").eq("unit_id", unitId).eq("month", month).maybeSingle(),
    hasMenuConnection(orgId).catch(() => false),
  ]);
  const typed = Number(period?.revenue ?? 0);
  const menu = connected ? await loadMenuMonth(unitId, month) : null;
  const revenue = menu && usesMenu(true, menu.orders) ? menu.revenue + typed : typed;
  return revenue > 0 ? { month, revenue } : null;
}
