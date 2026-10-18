import { monthBounds } from "@/lib/month-view";

/** Como estava o negócio num instante. Tudo em reais/fração, nada calculado aqui. */
export type SnapshotState = {
  /** Contas fixas do mês, sem a equipe. */
  fixedTotal: number;
  /** Equipe (salário + encargos). */
  staffTotal: number;
  taxPct: number;
  /** Taxa do canal de venda usado nas contas. */
  feePct: number;
  products: { id: string; name: string; cost: number | null; price: number | null }[];
};

/** Tudo o que o app viu mudar durante o mês: uma fotografia a cada vez que algo era diferente da anterior. */
export type MonthSnapshot = { v: 2; samples: { at: string; s: SnapshotState }[] };

const MAX_SAMPLES = 120;
const r2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Chave de comparação: valores arredondados, produtos em ordem fixa. */
function stateKey(st: SnapshotState): string {
  return JSON.stringify([
    r2(st.fixedTotal),
    r2(st.staffTotal),
    r4(st.taxPct),
    r4(st.feePct),
    [...st.products].sort((x, y) => x.id.localeCompare(y.id)).map((p) => [p.id, r2(p.cost), r2(p.price)]),
  ]);
}

/** Lê o que está no banco (formato antigo de uma foto só ou o atual). */
export function normalizeSnapshot(raw: unknown, month: string): MonthSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v === 2 && Array.isArray(o.samples)) return o as unknown as MonthSnapshot;
  if (o.v === 1) {
    const { v: _v, ...state } = o;
    void _v;
    return { v: 2, samples: [{ at: monthBounds(month).start.toISOString(), s: state as unknown as SnapshotState }] };
  }
  return null;
}

/** Acrescenta uma amostra só se algo mudou desde a última. Devolve `null` quando não há nada a gravar. */
export function appendSample(current: MonthSnapshot | null, state: SnapshotState, at: Date): MonthSnapshot | null {
  const last = current?.samples[current.samples.length - 1];
  if (last && stateKey(last.s) === stateKey(state)) return null;
  const samples = [...(current?.samples ?? []), { at: at.toISOString(), s: state }];
  return { v: 2, samples: samples.slice(-MAX_SAMPLES) };
}

export type ProductSeries = {
  id: string;
  name: string;
  /** Média ponderada pelo tempo em que cada valor valeu. */
  avgCost: number | null;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
};

export type ChangeEvent = { at: string; kind: "price" | "cost" | "fixed" | "staff" | "tax"; label: string; from: number; to: number };

/**
 * Resume as amostras do mês: valores médios (cada amostra vale do instante em que foi vista até a seguinte; a primeira vale desde o
 * começo do mês, pois não sabemos o que havia antes) e a lista do que mudou. `end` = fim do mês, ou agora se o mês não acabou.
 */
export function summarizeSamples(snapshot: MonthSnapshot, month: string, end: Date): { average: SnapshotState; products: ProductSeries[]; events: ChangeEvent[] } {
  const start = monthBounds(month).start.getTime();
  const stop = end.getTime();
  const samples = [...snapshot.samples].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const weights = samples.map((smp, i) => {
    const from = i === 0 ? start : Math.max(start, Date.parse(smp.at));
    const to = i + 1 < samples.length ? Math.min(stop, Date.parse(samples[i + 1].at)) : stop;
    return Math.max(0, to - from);
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const w = weights.map((x, i) => (weights.every((y) => y === 0) ? (i === samples.length - 1 ? 1 : 0) : x / total));
  const wavg = (pick: (st: SnapshotState) => number) => samples.reduce((sum, smp, i) => sum + pick(smp.s) * w[i], 0);

  const ids = new Map<string, string>();
  for (const smp of samples) for (const p of smp.s.products) ids.set(p.id, p.name);
  const products: ProductSeries[] = [...ids].map(([id, name]) => {
    const series = (field: "cost" | "price") => {
      let sum = 0;
      let weight = 0;
      const seen: number[] = [];
      samples.forEach((smp, i) => {
        const v = smp.s.products.find((p) => p.id === id)?.[field] ?? null;
        if (v !== null) {
          sum += v * w[i];
          weight += w[i];
          seen.push(v);
        }
      });
      return { avg: weight > 0 ? sum / weight : null, min: seen.length ? Math.min(...seen) : null, max: seen.length ? Math.max(...seen) : null };
    };
    const c = series("cost");
    const p = series("price");
    return { id, name, avgCost: c.avg, avgPrice: p.avg, minPrice: p.min, maxPrice: p.max };
  });

  const events: ChangeEvent[] = [];
  for (let i = 1; i < samples.length; i++) {
    const before = samples[i - 1].s;
    const now = samples[i].s;
    const at = samples[i].at;
    if (r2(before.fixedTotal) !== r2(now.fixedTotal)) events.push({ at, kind: "fixed", label: "Contas fixas", from: before.fixedTotal, to: now.fixedTotal });
    if (r2(before.staffTotal) !== r2(now.staffTotal)) events.push({ at, kind: "staff", label: "Equipe", from: before.staffTotal, to: now.staffTotal });
    if (r4(before.taxPct) !== r4(now.taxPct)) events.push({ at, kind: "tax", label: "Imposto sobre a venda", from: before.taxPct, to: now.taxPct });
    for (const p of now.products) {
      const old = before.products.find((x) => x.id === p.id);
      if (!old) continue;
      if (old.price !== null && p.price !== null && r2(old.price) !== r2(p.price)) events.push({ at, kind: "price", label: p.name, from: old.price, to: p.price });
      // custo: só mudanças de 2% ou mais (arredondamentos de centavo não são notícia)
      if (old.cost && p.cost !== null && Math.abs(p.cost / old.cost - 1) >= 0.02) events.push({ at, kind: "cost", label: p.name, from: old.cost, to: p.cost });
    }
  }

  return {
    average: {
      fixedTotal: wavg((x) => x.fixedTotal),
      staffTotal: wavg((x) => x.staffTotal),
      taxPct: wavg((x) => x.taxPct),
      feePct: wavg((x) => x.feePct),
      products: products.map((p) => ({ id: p.id, name: p.name, cost: p.avgCost, price: p.avgPrice })),
    },
    products,
    events: events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 12),
  };
}

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
  snapshot: SnapshotState | null;
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
  const { start: startDate, end: endDate } = monthBounds(month);
  const start = startDate.getTime();
  const end = endDate.getTime();

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

export type MonthWithMenu = {
  /** Digitado + cardápio. */
  revenue: number;
  soldUnits: number;
  /** O que as vendas do mês deveriam ter custado pelas fichas; `null` se nenhuma venda tem custo. */
  theoreticalCost: number | null;
  menuRevenue: number;
  menuOrders: number;
};

/**
 * Junta o que o dono digitou no mês (faturamento por fora e marmitas avulsas) com o que o cardápio vendeu.
 * Mês sem pedidos importados (anterior à conexão) continua só com o digitado.
 * Marmitas do cardápio: as das fichas vinculadas (`recipeUnits`, já com "marmitas por venda") e as dos combos vinculados.
 */
export function mergeMonthWithMenu(input: {
  typed: { revenue: number; qty: Map<string, number> };
  menu: { orders: number; revenue: number; recipeUnits: Map<string, number>; comboQty: Map<string, number> };
  costOf: (recipeId: string) => number | null;
  /** Custo e marmitas de cada combo (custos de hoje). */
  combos: Map<string, { cost: number | null; units: number }>;
}): MonthWithMenu {
  const menuOn = input.menu.orders > 0;
  let theoretical = 0;
  let counted = false;
  let soldUnits = 0;

  const add = (units: number, cost: number | null) => {
    soldUnits += units;
    if (units > 0 && cost !== null) {
      theoretical += cost * units;
      counted = true;
    }
  };
  for (const [id, q] of input.typed.qty) add(q, input.costOf(id));
  if (menuOn) {
    for (const [id, units] of input.menu.recipeUnits) add(units, input.costOf(id));
    for (const [id, qty] of input.menu.comboQty) {
      const c = input.combos.get(id);
      if (!c) continue;
      soldUnits += qty * c.units;
      if (qty > 0 && c.cost !== null) {
        theoretical += c.cost * qty;
        counted = true;
      }
    }
  }
  return {
    revenue: input.typed.revenue + (menuOn ? input.menu.revenue : 0),
    soldUnits,
    theoreticalCost: counted ? theoretical : null,
    menuRevenue: menuOn ? input.menu.revenue : 0,
    menuOrders: menuOn ? input.menu.orders : 0,
  };
}
