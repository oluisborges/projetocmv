import { D, type Decimal, type Num, safeDiv } from "./decimal";

/**
 * CMV real %.
 * Sem estoque (MVP): compras do período ÷ faturamento (aproximação).
 * Com estoque: (estoque inicial + compras − estoque final) ÷ faturamento.
 */
export function cmvReal(input: {
  purchases: Num;
  revenue: Num;
  openingStock?: Num;
  closingStock?: Num;
}): { pct: Decimal; cost: Decimal; approximate: boolean } {
  const hasStock = input.openingStock !== undefined && input.closingStock !== undefined;
  const cost = D(input.purchases)
    .plus(hasStock ? input.openingStock! : 0)
    .minus(hasStock ? input.closingStock! : 0);
  return { pct: safeDiv(cost, input.revenue), cost, approximate: !hasStock };
}

/** CMV teórico % = Σ(custo por porção × qtd vendida) ÷ faturamento. */
export function cmvTheoretical(
  sales: { costPerPortion: Num; qtySold: Num }[],
  revenue: Num,
): { pct: Decimal; cost: Decimal } {
  const cost = sales.reduce((s, x) => s.plus(D(x.costPerPortion).mul(x.qtySold)), D(0));
  return { pct: safeDiv(cost, revenue), cost };
}

/** Desvio = real − teórico (fração). Positivo = o dinheiro está sumindo (perda, desperdício, preço defasado). */
export const cmvDeviation = (realPct: Num, theoreticalPct: Num): Decimal =>
  D(realPct).minus(theoreticalPct);
