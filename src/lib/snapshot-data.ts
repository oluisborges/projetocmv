import "server-only";
import type { MonthSnapshot } from "@/lib/history-view";
import { currentMonthStart } from "@/lib/month-view";
import { createClient } from "@/lib/supabase/server";

const SNAPSHOT_REFRESH_MS = 30 * 60_000;

/** Guarda a fotografia do mês atual (no máximo uma vez a cada 30 min). Falha em silêncio: o histórico é bônus, nunca derruba uma tela. */
export async function saveMonthSnapshot(orgId: string, unitId: string, snapshot: MonthSnapshot): Promise<void> {
  try {
    const supabase = await createClient();
    const month = currentMonthStart();
    const { data: existing } = await supabase.from("month_snapshots").select("updated_at").eq("unit_id", unitId).eq("month", month).maybeSingle();
    if (existing && Date.now() - new Date(existing.updated_at).getTime() < SNAPSHOT_REFRESH_MS) return;
    await supabase.from("month_snapshots").upsert({ org_id: orgId, unit_id: unitId, month, data: snapshot }, { onConflict: "unit_id,month" });
  } catch {
    /* ignora */
  }
}
