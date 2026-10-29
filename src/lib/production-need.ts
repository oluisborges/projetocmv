import "server-only";
import { loadProductionBase, loadWeeklySales } from "@/lib/production-data";
import { suggestionRows } from "@/lib/production-view";

/** Quantas marmitas precisam ser feitas esta semana (pela sugestão da Produção) e quantas unidades no total. `null` se não deu para calcular. */
export async function loadProductionNeed(orgId: string, canWrite: boolean): Promise<{ products: number; units: number } | null> {
  const base = await loadProductionBase(orgId, canWrite);
  if (!base) return null;
  const weekly = await loadWeeklySales(orgId, base.unitId, base.hasMenu);
  const need = suggestionRows(base, weekly).filter((r) => r.suggested > 0 && r.confidence !== "none");
  return { products: need.length, units: need.reduce((n, r) => n + r.suggested, 0) };
}
