import "server-only";
import { appendSample, normalizeSnapshot, type SnapshotState } from "@/lib/history-view";
import { currentMonthStart } from "@/lib/month-view";
import { createClient } from "@/lib/supabase/server";

/**
 * Guarda como o negócio está agora no histórico do mês atual, mas só se algo mudou desde a última fotografia.
 * Duas gravações podem acontecer juntas (ex.: depois de uma ação e ao abrir o Painel), então a atualização só vale se
 * ninguém mexeu na linha desde a leitura; se mexeram, lê de novo e tenta outra vez. Falha em silêncio: o histórico é
 * bônus, nunca derruba uma tela.
 */
export async function saveMonthSnapshot(orgId: string, unitId: string, state: SnapshotState): Promise<void> {
  try {
    const supabase = await createClient();
    const month = currentMonthStart();

    for (let attempt = 0; attempt < 4; attempt++) {
      const { data: existing } = await supabase.from("month_snapshots").select("data, updated_at").eq("unit_id", unitId).eq("month", month).maybeSingle();
      const next = appendSample(normalizeSnapshot(existing?.data, month), state, new Date());
      if (!next) return; // nada mudou

      if (!existing) {
        const { error } = await supabase.from("month_snapshots").insert({ org_id: orgId, unit_id: unitId, month, data: next });
        if (!error) return;
        if (error.code !== "23505") return; // outro erro: desiste; 23505 = alguém inseriu antes, lê de novo
        continue;
      }

      const { data: updated } = await supabase
        .from("month_snapshots")
        .update({ data: next })
        .eq("unit_id", unitId)
        .eq("month", month)
        .eq("updated_at", existing.updated_at)
        .select("id");
      if (updated && updated.length > 0) return;
    }
  } catch {
    /* ignora */
  }
}
