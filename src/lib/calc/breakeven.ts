import { D, type Decimal, type Num, safeDiv } from "./decimal";

export type DishMix = { price: Num; margin: Num; qtySold: Num };

/** Margem de contribuição % média ponderada pelas vendas: Σ(MC × qtd) ÷ Σ(preço × qtd). */
export function weightedContributionPct(mix: DishMix[]): Decimal {
  const mc = mix.reduce((s, d) => s.plus(D(d.margin).mul(d.qtySold)), D(0));
  const rev = mix.reduce((s, d) => s.plus(D(d.price).mul(d.qtySold)), D(0));
  return safeDiv(mc, rev);
}

/** MC unitária média (R$) ponderada pelas vendas. */
export function weightedContributionPerUnit(mix: DishMix[]): Decimal {
  const mc = mix.reduce((s, d) => s.plus(D(d.margin).mul(d.qtySold)), D(0));
  const qty = mix.reduce((s, d) => s.plus(d.qtySold), D(0));
  return safeDiv(mc, qty);
}

/**
 * Ponto de equilíbrio mensal: custos fixos (inclui CMO fixo) ÷ MC % média.
 * Devolve faturamento (R$) e quantidade de marmitas; `null` se a MC média não é positiva.
 */
export function breakEven(
  fixedCosts: Num,
  mix: DishMix[],
): { revenue: Decimal; units: Decimal } | null {
  const pct = weightedContributionPct(mix);
  const perUnit = weightedContributionPerUnit(mix);
  if (pct.lte(0) || perUnit.lte(0)) return null;
  return { revenue: D(fixedCosts).div(pct), units: D(fixedCosts).div(perUnit).ceil() };
}
