import "server-only";
import { appendSample, normalizeSnapshot, type SnapshotState } from "@/lib/history-view";
import { currentMonthStart } from "@/lib/month-view";
import { createClient } from "@/lib/supabase/server";

/**
 * Guarda como o negócio está agora no histórico do mês atual, mas só se algo mudou desde a última fotografia
 * (uma leitura barata a cada chamada; a gravação só acontece em mudança). Falha em silêncio: o histórico é bônus,
 * nunca derruba uma tela.
 */
export async function saveMonthSnapshot(orgId: string, unitId: string, state: SnapshotState): Promise<void> {
  try {
    const supabase = await createClient();
    const month = currentMonthStart();
    const { data: existing } = await supabase.from("month_snapshots").select("data").eq("unit_id", unitId).eq("month", month).maybeSingle();
    const next = appendSample(normalizeSnapshot(existing?.data, month), state, new Date());
    if (!next) return;
    await supabase.from("month_snapshots").upsert({ org_id: orgId, unit_id: unitId, month, data: next }, { onConflict: "unit_id,month" });
  } catch {
    /* ignora */
  }
}
