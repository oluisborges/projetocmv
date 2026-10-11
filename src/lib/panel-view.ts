import { D } from "@/lib/calc";
import { priceBreakdown, type PricingSettings } from "@/lib/pricing-view";

export type PanelDish = { id: string; name: string; cost: number | null; price: number | null };

export type DishCmv = { id: string; name: string; pct: number };

export type PanelSummary = {
  /** As médias pesam cada produto pelas suas vendas (senão, todos valem igual). */
  weighted: boolean;
  /** Marmitas com custo e preço de venda: só elas entram nas médias. */
  count: number;
  /** Gasto com insumos de cada produto (custo ÷ preço), da mais alta para a mais baixa. */
  cmvRanking: DishCmv[];
  /** Médias por unidade, em fração do preço. Somam 100%. */
  composition: { cmv: number; cmo: number; fixed: number; commercial: number; profit: number };
};

/**
 * Para onde vai, em média, cada real do preço das marmitas. A despesa fixa do preço inclui a equipe;
 * aqui ela é separada em mão de obra (CMO) e demais despesas fixas, na proporção dos custos cadastrados.
 * "Comerciais" = impostos + taxa do canal de venda.
 */
export function summarizePanel(input: {
  dishes: PanelDish[];
  settings: PricingSettings;
  feePct: number;
  staffShareOfFixed: number;
  /** Unidades vendidas por produto (id -> qtd). Se algum produto com preço vendeu, a média pesa pelas vendas. */
  weights?: Map<string, number>;
}): PanelSummary | null {
  const priced = input.dishes.filter((d) => d.cost !== null && d.cost > 0 && (d.price ?? 0) > 0);
  if (priced.length === 0) return null;

  const share = Math.min(1, Math.max(0, input.staffShareOfFixed));
  const weightOf = (id: string) => Math.max(0, input.weights?.get(id) ?? 0);
  const weighted = priced.some((d) => weightOf(d.id) > 0);
  const w = (id: string) => (weighted ? weightOf(id) : 1);
  let totalWeight = D(0);
  const sum = { cmv: D(0), cmo: D(0), fixed: D(0), commercial: D(0), profit: D(0) };
  const ranking: DishCmv[] = [];

  for (const d of priced) {
    const parts = Object.fromEntries(
      priceBreakdown({ price: d.price as number, cost: d.cost as number, settings: input.settings, feePct: input.feePct }).map((p) => [p.key, p.pct]),
    ) as Record<"cost" | "tax" | "fee" | "fixed" | "profit", number> & { other?: number };
    const wt = w(d.id);
    totalWeight = totalWeight.plus(wt);
    sum.cmv = sum.cmv.plus(D(parts.cost).mul(wt));
    sum.cmo = sum.cmo.plus(D(parts.fixed).mul(share).mul(wt));
    sum.fixed = sum.fixed.plus(D(parts.fixed).mul(D(1).minus(share)).mul(wt));
    sum.commercial = sum.commercial.plus(D(parts.tax).plus(parts.fee).plus(parts.other ?? 0).mul(wt));
    sum.profit = sum.profit.plus(D(parts.profit).mul(wt));
    ranking.push({ id: d.id, name: d.name, pct: parts.cost });
  }

  const n = priced.length;
  const avg = (v: ReturnType<typeof D>) => v.div(totalWeight).toNumber();
  return {
    weighted,
    count: n,
    cmvRanking: ranking.sort((a, b) => b.pct - a.pct),
    composition: { cmv: avg(sum.cmv), cmo: avg(sum.cmo), fixed: avg(sum.fixed), commercial: avg(sum.commercial), profit: avg(sum.profit) },
  };
}
