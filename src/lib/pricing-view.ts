import {
  D,
  ImpossiblePriceError,
  contributionMargin,
  contributionMarginPct,
  marginStatus,
  netMargin,
  netMarginPct,
  suggestedPrice,
  totalRates,
  type MarginStatus,
} from "@/lib/calc";

/** Percentuais como fração (0.06 = 6%). */
export type PricingSettings = {
  taxPct: number;
  fixedExpensePct: number;
  profitPct: number;
  /** Meta mínima de margem líquida. */
  minMarginPct: number;
};

export type PriceAnalysis = {
  /** Preço que garante o lucro desejado, arredondado PARA CIMA em centavos (nunca abaixo da meta). */
  suggested: number | null;
  /** `true` quando impostos + taxas + despesas + lucro somam 100% ou mais: não existe preço que feche a conta. */
  impossible: boolean;
  /** Análise do preço informado (praticado ou simulado); `null` se não há preço. */
  at: null | {
    price: number;
    contribution: number;
    contributionPct: number;
    net: number;
    netPct: number;
    status: MarginStatus;
  };
};

const ceilCents = (v: number) => D(v).mul(100).ceil().div(100).toNumber();

/** Tudo que a tela de preço mostra, num lugar só (e testado). `feePct` é a taxa do canal de venda escolhido. */
export function analyzePrice(input: { cost: number; settings: PricingSettings; feePct: number; price?: number | null }): PriceAnalysis {
  const { cost, settings, feePct } = input;
  const rates = { taxPct: settings.taxPct, salesFeePct: feePct, fixedExpensePct: settings.fixedExpensePct, profitPct: settings.profitPct };

  let suggested: number | null = null;
  let impossible = false;
  try {
    suggested = ceilCents(suggestedPrice(cost, rates).toNumber());
  } catch (e) {
    if (!(e instanceof ImpossiblePriceError)) throw e;
    impossible = true;
  }

  const price = input.price ?? 0;
  if (!(price > 0)) return { suggested, impossible, at: null };

  const net = netMarginPct(price, cost, rates).toNumber();
  return {
    suggested,
    impossible,
    at: {
      price,
      contribution: contributionMargin(price, cost, rates).toNumber(),
      contributionPct: contributionMarginPct(price, cost, rates).toNumber(),
      net: netMargin(price, cost, rates).toNumber(),
      netPct: net,
      status: marginStatus(net, settings.minMarginPct),
    },
  };
}

/** Para onde vai cada real do preço (em R$ e em %). Soma sempre o preço. */
export function priceBreakdown(input: { price: number; cost: number; settings: PricingSettings; feePct: number }) {
  const { price, cost, settings, feePct } = input;
  const parts = [
    { key: "cost", label: "Custo da marmita", value: D(cost) },
    { key: "tax", label: "Impostos", value: D(price).mul(settings.taxPct) },
    { key: "fee", label: "Taxa do canal de venda", value: D(price).mul(feePct) },
    { key: "fixed", label: "Despesas fixas", value: D(price).mul(settings.fixedExpensePct) },
  ];
  const used = parts.reduce((s, p) => s.plus(p.value), D(0));
  return [...parts, { key: "profit", label: "Lucro que sobra", value: D(price).minus(used) }].map((p) => ({
    key: p.key,
    label: p.label,
    value: p.value.toNumber(),
    pct: D(price).gt(0) ? p.value.div(price).toNumber() : 0,
  }));
}

export { totalRates };
