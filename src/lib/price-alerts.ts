export type HistoryPoint = { ingredient_id: string; unit_cost: number; changed_at: string };

export type PriceIncreaseAlert = {
  ingredientId: string;
  name: string;
  /** Aumento em fração (0.12 = +12%). */
  pct: number;
  /** Em quantas fichas o insumo é usado. */
  recipes: number;
};

/**
 * Insumos cujo custo SUBIU no período. Compara o primeiro e o último registro de cada insumo dentro da janela
 * (o histórico é gravado pelo banco a cada mudança de preço). Registros com custo zero são ignorados: um insumo
 * importado do catálogo começa em R$ 0 e ganhar o primeiro preço não é "aumento".
 */
export function priceIncreaseAlerts(input: {
  history: HistoryPoint[];
  names: Map<string, string>;
  recipesUsing: Map<string, number>;
  minPct?: number;
  windowDays?: number;
  now?: Date;
}): PriceIncreaseAlert[] {
  const { history, names, recipesUsing, minPct = 0.05, windowDays = 45, now = new Date() } = input;
  const since = now.getTime() - windowDays * 86_400_000;

  const byIngredient = new Map<string, HistoryPoint[]>();
  for (const h of history) {
    if (new Date(h.changed_at).getTime() < since || !(h.unit_cost > 0)) continue;
    byIngredient.set(h.ingredient_id, [...(byIngredient.get(h.ingredient_id) ?? []), h]);
  }

  const alerts: PriceIncreaseAlert[] = [];
  for (const [id, points] of byIngredient) {
    if (points.length < 2) continue;
    const sorted = [...points].sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());
    const first = sorted[0].unit_cost;
    const last = sorted[sorted.length - 1].unit_cost;
    const pct = (last - first) / first;
    if (pct >= minPct) alerts.push({ ingredientId: id, name: names.get(id) ?? "Insumo", pct, recipes: recipesUsing.get(id) ?? 0 });
  }
  return alerts.sort((a, b) => b.pct - a.pct);
}
