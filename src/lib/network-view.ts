// Painel agregado da Shogun: regras puras (sem banco). Os números vêm de network-data.ts.

export type ClientMonth = {
  /** Cardápio + digitado por fora. */
  revenue: number;
  orders: number;
  menuRevenue: number;
  manualRevenue: number;
  discount: number;
};

export type ClientMargin = {
  /** Margem de contribuição média dos produtos com preço (antes das despesas fixas), em fração; `null` se não há. */
  avgContributionPct: number | null;
  products: number;
  priced: number;
  /** Produtos com ficha incompleta (sem custo calculável). */
  incomplete: number;
  /** Margem real nas vendas do cardápio das fichas vinculadas (valor pago − custo − impostos), em fração. */
  realPct: number | null;
};

export type ClientSetup = { ingredients: number; recipes: number; pricedRecipes: number; fixedCosts: number; staff: number; settingsDone: boolean };

export type NetworkClient = {
  id: string;
  name: string;
  hasMenu: boolean;
  month: ClientMonth;
  prev: ClientMonth;
  /** Parte do que o cardápio vendeu que já tem ficha vinculada (por valor pago). */
  coverage: number | null;
  unlinkedProducts: number;
  margin: ClientMargin;
  setup: ClientSetup;
};

const BRT = "America/Sao_Paulo";

/** Dia do mês e total de dias em Brasília (o servidor roda em UTC). */
function brtDayInfo(now: Date): { month: string; day: number; days: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: BRT, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const y = get("year");
  const m = get("month");
  return { month: `${y}-${String(m).padStart(2, "0")}-01`, day: get("day"), days: new Date(Date.UTC(y, m, 0)).getUTCDate() };
}

/** Quanto do mês já passou: 1 para mês fechado, 0 para mês futuro, dia ÷ dias do mês no mês em andamento. */
export function elapsedFraction(month: string, now: Date = new Date()): number {
  const cur = brtDayInfo(now);
  if (month < cur.month) return 1;
  if (month > cur.month) return 0;
  return cur.day / cur.days;
}

/** Abaixo disso o mês é cedo demais para projetar (poucos dias de dados dão projeções malucas). */
export const MIN_FRACTION_FOR_PACE = 0.2;

/** Faturamento que o mês vai ter no ritmo atual; `null` se é cedo demais. Mês fechado = o próprio faturamento. */
export function projectRevenue(revenue: number, fraction: number): number | null {
  if (fraction >= 1) return revenue;
  if (fraction < MIN_FRACTION_FOR_PACE) return null;
  return revenue / fraction;
}

export type Trend = { pct: number | null; projected: number | null; /** "ritmo" = projeção do mês em andamento */ basis: "closed" | "pace" };

/** Variação do faturamento contra o mês anterior. No mês em andamento compara a projeção (ritmo atual), para não parecer queda. */
export function revenueTrend(month: ClientMonth, prev: ClientMonth, monthKey: string, now: Date = new Date()): Trend {
  const fraction = elapsedFraction(monthKey, now);
  const projected = projectRevenue(month.revenue, fraction);
  const basis = fraction >= 1 ? "closed" : "pace";
  if (projected === null || prev.revenue <= 0) return { pct: null, projected, basis };
  return { pct: projected / prev.revenue - 1, projected, basis };
}

/** Cupons ÷ o que seria vendido sem cupom. `null` sem vendas no cardápio. */
export const couponPct = (m: ClientMonth): number | null => (m.menuRevenue > 0 ? m.discount / (m.menuRevenue + m.discount) : null);

export const ticket = (m: ClientMonth): number | null => (m.orders > 0 ? m.menuRevenue / m.orders : null);

// ---------------------------------------------------------------- margens

export type RateSet = { taxPct: number; feePct: number; otherPct: number };

/**
 * Margem de contribuição média dos produtos com custo e preço: (preço − custo − impostos e taxas) ÷ preço.
 * Se algum produto vendeu (pesos), a média pesa pelas vendas; senão, todos valem igual.
 */
export function contributionSummary(
  recipes: { id: string; cost: number | null; price: number | null }[],
  rates: RateSet,
  weights?: Map<string, number>,
): ClientMargin["avgContributionPct"] {
  const variable = rates.taxPct + rates.feePct + rates.otherPct;
  const priced = recipes.filter((r) => r.cost !== null && r.cost > 0 && (r.price ?? 0) > 0);
  if (priced.length === 0) return null;
  const weightOf = (id: string) => Math.max(0, weights?.get(id) ?? 0);
  const weighted = priced.some((r) => weightOf(r.id) > 0);
  let sum = 0;
  let total = 0;
  for (const r of priced) {
    const w = weighted ? weightOf(r.id) : 1;
    sum += ((r.price! - r.cost! - r.price! * variable) / r.price!) * w;
    total += w;
  }
  return total > 0 ? sum / total : null;
}

/** Margem real das vendas do cardápio nas fichas vinculadas: (valor pago − custo × marmitas − impostos) ÷ valor pago. */
export function realMargin(sales: { recipeId: string; units: number; net: number }[], costs: Map<string, number | null>, rates: RateSet): number | null {
  const variable = rates.taxPct + rates.feePct + rates.otherPct;
  let net = 0;
  let contribution = 0;
  for (const s of sales) {
    const cost = costs.get(s.recipeId);
    if (cost === null || cost === undefined || s.net <= 0) continue;
    net += s.net;
    contribution += s.net - cost * s.units - s.net * variable;
  }
  return net > 0 ? contribution / net : null;
}

// ---------------------------------------------------------------- adoção

export type SetupStep = { key: "ingredients" | "recipes" | "prices" | "fixed" | "menu" | "links"; label: string; done: boolean };

/** Passos que fazem o sistema calcular lucro de verdade; o último só vale para quem tem cardápio conectado. */
export function setupSteps(c: Pick<NetworkClient, "setup" | "hasMenu" | "coverage" | "month">): SetupStep[] {
  const steps: SetupStep[] = [
    { key: "ingredients", label: "Insumos cadastrados", done: c.setup.ingredients > 0 },
    { key: "recipes", label: "Fichas técnicas", done: c.setup.recipes > 0 },
    { key: "prices", label: "Preços de venda", done: c.setup.pricedRecipes > 0 },
    { key: "fixed", label: "Custos fixos e equipe", done: c.setup.fixedCosts > 0 || c.setup.staff > 0 },
    { key: "menu", label: "Cardápio conectado", done: c.hasMenu },
  ];
  if (c.hasMenu) steps.push({ key: "links", label: "Produtos vinculados", done: c.coverage !== null && c.coverage >= LINK_COVERAGE_OK });
  return steps;
}

export const setupScore = (c: Pick<NetworkClient, "setup" | "hasMenu" | "coverage" | "month">): number => {
  const steps = setupSteps(c);
  return steps.filter((s) => s.done).length / steps.length;
};

// ---------------------------------------------------------------- alertas

export const LOW_MARGIN = 0.35;
export const HIGH_COUPON = 0.1;
export const LINK_COVERAGE_OK = 0.7;
export const BIG_DROP = -0.25;

export type Insight = {
  orgId: string;
  name: string;
  key: "no-sales" | "drop" | "low-margin" | "coupon" | "links" | "no-recipes" | "no-prices" | "no-fixed";
  severity: "warning" | "info";
  text: string;
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** O que merece uma conversa com cada cliente, dos mais graves para os informativos. */
export function buildInsights(clients: NetworkClient[], monthKey: string, now: Date = new Date()): Insight[] {
  const fraction = elapsedFraction(monthKey, now);
  const out: Insight[] = [];
  for (const c of clients) {
    const add = (key: Insight["key"], severity: Insight["severity"], text: string) => out.push({ orgId: c.id, name: c.name, key, severity, text });
    const trend = revenueTrend(c.month, c.prev, monthKey, now);

    if (c.hasMenu && c.month.orders === 0 && c.month.manualRevenue === 0 && fraction >= 0.25) add("no-sales", "warning", "Cardápio conectado, mas sem nenhum pedido neste mês");
    if (trend.pct !== null && trend.pct <= BIG_DROP && c.prev.revenue >= 1000) {
      add("drop", "warning", `Faturamento ${pct(Math.abs(trend.pct))} abaixo do mês anterior${trend.basis === "pace" ? " (no ritmo atual)" : ""}`);
    }
    if (c.margin.avgContributionPct !== null && c.margin.avgContributionPct < LOW_MARGIN) add("low-margin", "warning", `Margem de contribuição média de ${pct(c.margin.avgContributionPct)}: preços podem estar baixos`);
    const coupon = couponPct(c.month);
    if (coupon !== null && coupon > HIGH_COUPON) add("coupon", "warning", `Cupons somam ${pct(coupon)} do vendido no cardápio`);
    if (c.hasMenu && c.month.orders > 0 && (c.coverage ?? 0) < LINK_COVERAGE_OK) {
      add("links", "info", `${pct(c.coverage ?? 0)} do cardápio com ficha vinculada (${c.unlinkedProducts} produtos sem vínculo): o lucro real fica incompleto`);
    }
    if (c.setup.recipes === 0) add("no-recipes", "info", "Ainda não cadastrou fichas técnicas");
    else if (c.setup.pricedRecipes === 0) add("no-prices", "info", "Tem fichas, mas nenhuma com preço de venda");
    if (c.setup.fixedCosts === 0 && c.setup.staff === 0 && c.setup.recipes > 0) add("no-fixed", "info", "Sem custos fixos nem equipe cadastrados: o preço sugerido ignora as despesas");
  }
  const rank = (i: Insight) => (i.severity === "warning" ? 0 : 1);
  const revenueOf = new Map(clients.map((c) => [c.id, c.month.revenue]));
  return out.sort((a, b) => rank(a) - rank(b) || (revenueOf.get(b.orgId) ?? 0) - (revenueOf.get(a.orgId) ?? 0));
}

// ---------------------------------------------------------------- rede

export type NetworkTotals = {
  revenue: number;
  prevRevenue: number;
  /** Variação da rede (projetada no mês em andamento); `null` se é cedo ou não há mês anterior. */
  trend: Trend;
  orders: number;
  menuRevenue: number;
  ticket: number | null;
  couponPct: number | null;
  activeClients: number;
  clients: number;
  withMenu: number;
  /** Média simples das margens dos clientes que têm margem calculável. */
  avgContributionPct: number | null;
  marginClients: number;
};

export function summarizeNetwork(clients: NetworkClient[], monthKey: string, now: Date = new Date()): NetworkTotals {
  const sum = (f: (c: NetworkClient) => number) => clients.reduce((s, c) => s + f(c), 0);
  const month: ClientMonth = {
    revenue: sum((c) => c.month.revenue),
    orders: sum((c) => c.month.orders),
    menuRevenue: sum((c) => c.month.menuRevenue),
    manualRevenue: sum((c) => c.month.manualRevenue),
    discount: sum((c) => c.month.discount),
  };
  const prev: ClientMonth = { ...month, revenue: sum((c) => c.prev.revenue), orders: 0, menuRevenue: 0, manualRevenue: 0, discount: 0 };
  const margins = clients.map((c) => c.margin.avgContributionPct).filter((m): m is number => m !== null);
  return {
    revenue: month.revenue,
    prevRevenue: prev.revenue,
    trend: revenueTrend(month, prev, monthKey, now),
    orders: month.orders,
    menuRevenue: month.menuRevenue,
    ticket: ticket(month),
    couponPct: couponPct(month),
    activeClients: clients.filter((c) => c.month.revenue > 0).length,
    clients: clients.length,
    withMenu: clients.filter((c) => c.hasMenu).length,
    avgContributionPct: margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : null,
    marginClients: margins.length,
  };
}

export type ClientSort = "revenue" | "trend" | "margin" | "setup" | "name";

export function sortClients(clients: NetworkClient[], sort: ClientSort, monthKey: string, now: Date = new Date()): NetworkClient[] {
  const byName = (a: NetworkClient, b: NetworkClient) => a.name.localeCompare(b.name, "pt-BR");
  const pace = (c: NetworkClient) => revenueTrend(c.month, c.prev, monthKey, now).pct;
  const desc = (f: (c: NetworkClient) => number | null) => (a: NetworkClient, b: NetworkClient) => (f(b) ?? -Infinity) - (f(a) ?? -Infinity) || byName(a, b);
  const asc = (f: (c: NetworkClient) => number | null) => (a: NetworkClient, b: NetworkClient) => (f(a) ?? Infinity) - (f(b) ?? Infinity) || byName(a, b);
  const list = [...clients];
  if (sort === "revenue") return list.sort(desc((c) => c.month.revenue));
  if (sort === "trend") return list.sort(asc(pace)); // quem mais caiu primeiro
  if (sort === "margin") return list.sort(asc((c) => c.margin.avgContributionPct)); // menor margem primeiro
  if (sort === "setup") return list.sort(asc((c) => setupScore(c))); // menos completos primeiro
  return list.sort(byName);
}
