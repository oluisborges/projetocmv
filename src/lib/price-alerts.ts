export type HistoryPoint = { ingredient_id: string; unit_cost: number; changed_at: string };

export type PriceIncreaseAlert = {
  ingredientId: string;
  name: string;
  /** Aumento em fração (0.12 = +12%). */
  pct: number;
  /** Em quantas fichas ativas o insumo é usado. */
  recipes: number;
};

/**
 * Insumos cujo custo SUBIU na janela. O histórico é gravado pelo banco a cada mudança de preço, então:
 * - base = último preço ANTES da janela (um insumo antigo reajustado uma única vez tem só 1 ponto dentro dela);
 *   se não houver nenhum anterior, o primeiro ponto da janela;
 * - atual = último preço dentro da janela.
 * Custo zero é ignorado como base: um insumo importado do catálogo começa em R$ 0, e ganhar o primeiro
 * preço não é "aumento".
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
  const time = (p: HistoryPoint) => new Date(p.changed_at).getTime();

  const byIngredient = new Map<string, HistoryPoint[]>();
  for (const h of history) byIngredient.set(h.ingredient_id, [...(byIngredient.get(h.ingredient_id) ?? []), h]);

  const alerts: PriceIncreaseAlert[] = [];
  for (const [id, points] of byIngredient) {
    const sorted = [...points].sort((a, b) => time(a) - time(b));
    const before = sorted.filter((p) => time(p) < since).at(-1);
    const inWindow = sorted.filter((p) => time(p) >= since);
    if (inWindow.length === 0) continue;

    const base = before ?? inWindow[0];
    const last = inWindow[inWindow.length - 1];
    if (!(base.unit_cost > 0) || !(last.unit_cost > 0)) continue;

    const pct = (last.unit_cost - base.unit_cost) / base.unit_cost;
    if (pct >= minPct) alerts.push({ ingredientId: id, name: names.get(id) ?? "Insumo", pct, recipes: recipesUsing.get(id) ?? 0 });
  }
  return alerts.sort((a, b) => b.pct - a.pct);
}
