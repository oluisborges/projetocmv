import {
  D,
  contributionMargin,
  contributionMarginPct,
  marginStatus,
  netMargin,
  netMarginPct,
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
  /** Outras taxas sobre cada venda (comissão, por exemplo), fração. Opcional; padrão 0. */
  otherPct?: number;
  /** Margem de segurança sobre o custo dos insumos, fração. Entra no custo da ficha, não no preço. */
  safetyMarginPct?: number;
};

export type PriceAnalysis = {
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

/**
 * Tudo que a tela de preço mostra, num lugar só (e testado). `feePct` é a taxa do canal de venda escolhido.
 * Não existe "preço sugerido" de propósito: calculado só pelos custos ele puxa o preço para baixo, sem considerar
 * região, concorrência nem o que o cliente aceita pagar. Quem decide o preço é o dono; o app mostra o que sobra.
 */
export function analyzePrice(input: { cost: number; settings: PricingSettings; feePct: number; price?: number | null }): PriceAnalysis {
  const { cost, settings, feePct } = input;
  const rates = { taxPct: settings.taxPct, salesFeePct: feePct + (settings.otherPct ?? 0), fixedExpensePct: settings.fixedExpensePct, profitPct: settings.profitPct };

  const price = input.price ?? 0;
  if (!(price > 0)) return { at: null };

  const net = netMarginPct(price, cost, rates).toNumber();
  return {
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
    { key: "cost", label: "Custo do produto", value: D(cost) },
    { key: "tax", label: "Impostos", value: D(price).mul(settings.taxPct) },
    { key: "fee", label: "Taxa do canal de venda", value: D(price).mul(feePct) },
    ...((settings.otherPct ?? 0) > 0 ? [{ key: "other", label: "Outras taxas sobre a venda", value: D(price).mul(settings.otherPct ?? 0) }] : []),
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

/** O que as vendas de um mês rendem, a partir do que sobra em cada unidade. */
export function monthlyResult(input: { price: number; contribution: number; net: number; units: number }) {
  const units = D(Math.max(0, input.units));
  return {
    revenue: D(input.price).mul(units).toNumber(),
    contribution: D(input.contribution).mul(units).toNumber(),
    net: D(input.net).mul(units).toNumber(),
  };
}

/** Quanto muda o que sobra por unidade ao trocar o preço (`from` -> `to`). `null` se algum dos dois não é um preço. */
export function priceChange(input: { cost: number; settings: PricingSettings; feePct: number; from: number; to: number }) {
  const before = analyzePrice({ cost: input.cost, settings: input.settings, feePct: input.feePct, price: input.from }).at;
  const after = analyzePrice({ cost: input.cost, settings: input.settings, feePct: input.feePct, price: input.to }).at;
  if (!before || !after) return null;
  return { before, after, netDelta: D(after.net).minus(before.net).toNumber() };
}

export { totalRates };
