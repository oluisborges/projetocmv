// Inteligência de cupom: quanto cada cupom custou e se o pedido ainda deu lucro. Regra pura (sem banco).

export type CouponGroupInput = {
  /** Código do cupom; "" = pedido com desconto sem código (fidelidade etc.); "?" = pedido antigo ainda não relido. */
  code: string;
  orders: number;
  /** Desconto dado, em R$. */
  discount: number;
  /** Valor dos itens antes do desconto. */
  gross: number;
  /** Valor dos itens depois do desconto (o que foi pago por eles). */
  net: number;
  products: { productId: string; qty: number; gross: number; net: number }[];
};

export type Verdict = "loss" | "low" | "ok" | "unknown";

export type CouponReport = {
  code: string;
  orders: number;
  discount: number;
  /** Desconto ÷ valor dos itens. */
  discountPct: number | null;
  /** Quanto sobrou nos itens vinculados, depois do cupom (R$). */
  contribution: number;
  /** Sobra ÷ valor pago, com o cupom. */
  marginAfter: number | null;
  /** Sobra ÷ valor cheio, se não houvesse cupom. */
  marginBefore: number | null;
  /** Quanto o cupom comeu da sobra (R$): a diferença entre o pedido sem e com cupom. */
  profitLost: number;
  /** Parte do valor dos itens que tem ficha vinculada e com custo. */
  coverage: number;
  verdict: Verdict;
};

export type CouponAnalysis = {
  couponOrders: number;
  totalOrders: number;
  discount: number;
  /** Desconto ÷ (itens antes do desconto) em todos os pedidos com desconto. */
  discountPct: number | null;
  avgDiscountPerOrder: number | null;
  /** Ticket (só itens) dos pedidos com e sem desconto. */
  ticketWith: number | null;
  ticketWithout: number | null;
  /** Margem dos pedidos sem desconto × com desconto (itens vinculados). */
  marginWithout: number | null;
  marginWith: number | null;
  profitLost: number;
  reports: CouponReport[];
  /** Pedidos com desconto cujo código ainda não foi lido (importação de pedidos antigos em andamento). */
  pendingCode: number;
};

/** Margem mínima abaixo da qual o cupom é "margem baixa" e menos da metade vinculada = "sem como avaliar". */
export const MIN_COVERAGE = 0.5;

const safeDiv = (a: number, b: number) => (b > 0 ? a / b : null);

/**
 * `costPerSale`: custo de UMA venda de cada produto (ficha × marmitas por venda, ou combo inteiro); ausente/null = sem custo.
 * `baseline`: o que foi vendido nos pedidos SEM desconto (para comparar).
 */
export function analyzeCoupons(input: {
  groups: CouponGroupInput[];
  costPerSale: Map<string, number | null>;
  variablePct: number;
  minMarginPct: number;
  totalOrders: number;
  baseline: { productId: string; qty: number; net: number }[];
}): CouponAnalysis {
  const { variablePct: v } = input;

  const costed = (lines: { productId: string; qty: number; gross: number; net: number }[]) => {
    let gross = 0;
    let net = 0;
    let cost = 0;
    let all = 0;
    for (const l of lines) {
      all += l.net;
      const c = input.costPerSale.get(l.productId);
      if (c === null || c === undefined) continue;
      gross += l.gross;
      net += l.net;
      cost += c * l.qty;
    }
    return { gross, net, cost, allNet: all };
  };

  const reports: CouponReport[] = input.groups.map((g) => {
    const k = costed(g.products);
    const contribution = k.net - k.cost - k.net * v;
    const contributionFull = k.gross - k.cost - k.gross * v;
    const coverage = g.net > 0 ? k.net / g.net : 0;
    const marginAfter = safeDiv(contribution, k.net);
    const verdict: Verdict = coverage < MIN_COVERAGE ? "unknown" : contribution < 0 ? "loss" : marginAfter !== null && marginAfter < input.minMarginPct ? "low" : "ok";
    return {
      code: g.code,
      orders: g.orders,
      discount: g.discount,
      discountPct: safeDiv(g.discount, g.gross),
      contribution,
      marginAfter,
      marginBefore: safeDiv(contributionFull, k.gross),
      profitLost: contributionFull - contribution,
      coverage,
      verdict,
    };
  });
  // piores primeiro: prejuízo, margem baixa, ok; dentro de cada um, o que mais descontou
  const rank: Record<Verdict, number> = { loss: 0, low: 1, ok: 2, unknown: 3 };
  reports.sort((a, b) => rank[a.verdict] - rank[b.verdict] || b.discount - a.discount || a.code.localeCompare(b.code, "pt-BR"));

  const couponOrders = input.groups.reduce((s, g) => s + g.orders, 0);
  const discount = input.groups.reduce((s, g) => s + g.discount, 0);
  const gross = input.groups.reduce((s, g) => s + g.gross, 0);
  const netWith = input.groups.reduce((s, g) => s + g.net, 0);
  const withK = costed(input.groups.flatMap((g) => g.products));
  const baseK = costed(input.baseline.map((b) => ({ productId: b.productId, qty: b.qty, gross: b.net, net: b.net })));
  const baselineNet = input.baseline.reduce((s, b) => s + b.net, 0);
  const ordersWithout = Math.max(0, input.totalOrders - couponOrders);

  return {
    couponOrders,
    totalOrders: input.totalOrders,
    discount,
    discountPct: safeDiv(discount, gross),
    avgDiscountPerOrder: safeDiv(discount, couponOrders),
    ticketWith: safeDiv(netWith, couponOrders),
    ticketWithout: safeDiv(baselineNet, ordersWithout),
    marginWithout: safeDiv(baseK.net - baseK.cost - baseK.net * v, baseK.net),
    marginWith: safeDiv(withK.net - withK.cost - withK.net * v, withK.net),
    profitLost: reports.reduce((s, r) => s + Math.max(0, r.profitLost), 0),
    reports,
    pendingCode: input.groups.filter((g) => g.code === "?").reduce((s, g) => s + g.orders, 0),
  };
}

/**
 * Quanto de desconto um produto aguenta sem a margem cair abaixo da mínima:
 * preço mínimo = (custo + custos fixos de uma unidade) ÷ (1 − impostos − margem mínima); desconto máximo = 1 − preço mínimo ÷ preço. `null` se a conta é impossível.
 * `fixedCostPerUnit` (R$): a parte das contas fixas e da equipe que cada unidade paga. Ela não encolhe com o cupom: o aluguel é o mesmo com ou sem desconto.
 */
export function maxDiscountPct(input: { price: number; cost: number; variablePct: number; minMarginPct: number; fixedCostPerUnit?: number }): number | null {
  const factor = 1 - input.variablePct - input.minMarginPct;
  if (factor <= 0 || input.price <= 0) return null;
  const floor = (input.cost + (input.fixedCostPerUnit ?? 0)) / factor;
  return Math.max(0, 1 - floor / input.price);
}

export const verdictLabel: Record<Verdict, string> = {
  loss: "Dá prejuízo",
  low: "Margem baixa",
  ok: "Saudável",
  unknown: "Faltam vínculos",
};
