import { D, type Decimal, type Num, safeDiv } from "./decimal";

export type PricingRates = {
  /** Impostos sobre a venda (fração). */
  taxPct: Num;
  /** Taxas de venda: cartão, iFood etc. (fração). */
  salesFeePct: Num;
  /** Despesas fixas rateadas sobre o faturamento (fração). */
  fixedExpensePct: Num;
  /** Lucro desejado (fração). */
  profitPct: Num;
};

type VariableRates = Pick<PricingRates, "taxPct" | "salesFeePct">;
type NetRates = Pick<PricingRates, "taxPct" | "salesFeePct" | "fixedExpensePct">;

export class ImpossiblePriceError extends Error {
  constructor(public readonly totalPct: Decimal) {
    super("A soma de impostos, taxas, despesas fixas e lucro chegou a 100% ou mais");
    this.name = "ImpossiblePriceError";
  }
}

export const totalRates = (r: PricingRates): Decimal =>
  D(r.taxPct).plus(r.salesFeePct).plus(r.fixedExpensePct).plus(r.profitPct);

/** Markup divisor: preço = custo / (1 − Σ percentuais). */
export function suggestedPrice(cost: Num, rates: PricingRates): Decimal {
  const total = totalRates(rates);
  if (total.gte(1)) throw new ImpossiblePriceError(total);
  return D(cost).div(D(1).minus(total));
}

/** Margem de contribuição em R$: preço − custo − (impostos + taxas de venda) sobre o preço. */
export function contributionMargin(price: Num, cost: Num, rates: VariableRates): Decimal {
  const variable = D(price).mul(D(rates.taxPct).plus(rates.salesFeePct));
  return D(price).minus(cost).minus(variable);
}

export const contributionMarginPct = (price: Num, cost: Num, rates: VariableRates): Decimal =>
  safeDiv(contributionMargin(price, cost, rates), price);

/** Margem líquida em R$: abate também a despesa fixa rateada sobre o preço. */
export function netMargin(price: Num, cost: Num, rates: NetRates): Decimal {
  return contributionMargin(price, cost, rates).minus(D(price).mul(rates.fixedExpensePct));
}

export const netMarginPct = (price: Num, cost: Num, rates: NetRates): Decimal =>
  safeDiv(netMargin(price, cost, rates), price);

/** Despesa fixa rateada (fração do faturamento) = custos fixos mensais ÷ faturamento mensal. */
export const fixedExpensePct = (monthlyFixedCosts: Num, monthlyRevenue: Num): Decimal =>
  safeDiv(monthlyFixedCosts, monthlyRevenue);

/** Despesa fixa por marmita (R$) = custos fixos mensais ÷ marmitas vendidas no mês. */
export const fixedCostPerUnit = (monthlyFixedCosts: Num, monthlyUnitsSold: Num): Decimal =>
  safeDiv(monthlyFixedCosts, monthlyUnitsSold);

export type MarginStatus = "good" | "warning" | "below-target";

/** Semáforo da margem líquida frente à meta mínima. Atenção = até 3 pontos acima da meta. */
export function marginStatus(marginPct: Num, targetPct: Num): MarginStatus {
  const m = D(marginPct);
  const t = D(targetPct);
  if (m.lt(t)) return "below-target";
  if (m.lt(t.plus(0.03))) return "warning";
  return "good";
}
