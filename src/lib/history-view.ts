/** Fotografia do que valia no mês (guardada pelo app). Tudo em reais/fração, nada calculado aqui. */
export type MonthSnapshot = {
  v: 1;
  /** Contas fixas do mês, sem a equipe. */
  fixedTotal: number;
  /** Equipe (salário + encargos). */
  staffTotal: number;
  taxPct: number;
  /** Taxa do canal de venda usado nas contas. */
  feePct: number;
  products: { id: string; name: string; cost: number | null; price: number | null }[];
};

export type HistoryMonth = {
  revenue: number;
  purchases: number;
  soldUnits: number;
  /** Compras ÷ faturamento. */
  insumosPct: number | null;
  /** O que as vendas do mês deveriam ter custado em insumos ÷ faturamento. */
  expectedPct: number | null;
  staffPct: number | null;
  fixedPct: number | null;
  /** Impostos + taxa do canal. */
  taxesPct: number | null;
  /** Sobra estimada: faturamento − compras − equipe − contas fixas − impostos e taxas. Só com faturamento, compras e foto do mês. */
  result: { value: number; pct: number } | null;
};

const div = (a: number, b: number) => (b > 0 ? a / b : null);

export function summarizeHistoryMonth(input: {
  revenue: number;
  purchases: number;
  soldUnits: number;
  theoreticalCost: number | null;
  snapshot: MonthSnapshot | null;
}): HistoryMonth {
  const { revenue, purchases, snapshot } = input;
  const s = snapshot;
  const taxRate = s ? s.taxPct + s.feePct : 0;
  const result =
    s && revenue > 0 && purchases > 0
      ? (() => {
          const value = revenue - purchases - s.staffTotal - s.fixedTotal - revenue * taxRate;
          return { value, pct: value / revenue };
        })()
      : null;
  return {
    revenue,
    purchases,
    soldUnits: input.soldUnits,
    insumosPct: purchases > 0 ? div(purchases, revenue) : null,
    expectedPct: input.theoreticalCost !== null ? div(input.theoreticalCost, revenue) : null,
    staffPct: s ? div(s.staffTotal, revenue) : null,
    fixedPct: s ? div(s.fixedTotal, revenue) : null,
    taxesPct: s && revenue > 0 ? taxRate : null,
    result,
  };
}

export type PriceMove = { name: string; pct: number };

/**
 * Insumos que mudaram de preço DURANTE o mês: compara o último preço antes do mês (ou, se não há, ignora o insumo)
 * com o último preço do mês. Só mudanças de 5% ou mais; as maiores primeiro.
 */
export function monthPriceMoves(
  history: { ingredient_id: string; unit_cost: number; changed_at: string }[],
  names: Map<string, string>,
  month: string,
  limit = 3,
): PriceMove[] {
  const start = Date.parse(`${month}T00:00:00Z`);
  const [y, m] = month.split("-").map(Number);
  const end = Date.UTC(y, m, 1); // m já é o mês seguinte (base 0)

  const byIngredient = new Map<string, { unit_cost: number; at: number }[]>();
  for (const h of history) {
    const list = byIngredient.get(h.ingredient_id) ?? [];
    list.push({ unit_cost: h.unit_cost, at: Date.parse(h.changed_at) });
    byIngredient.set(h.ingredient_id, list);
  }

  const moves: PriceMove[] = [];
  for (const [id, list] of byIngredient) {
    list.sort((a, b) => a.at - b.at);
    const base = [...list].reverse().find((p) => p.at < start);
    const last = [...list].reverse().find((p) => p.at < end);
    if (!base || !last || base.unit_cost <= 0 || last.at < start) continue;
    const pct = last.unit_cost / base.unit_cost - 1;
    const name = names.get(id);
    if (name && Math.abs(pct) >= 0.05) moves.push({ name, pct });
  }
  return moves.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, limit);
}
