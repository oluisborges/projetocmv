import { describe, expect, it } from "vitest";
import { appendSample, mergeMonthWithMenu, monthPriceMoves, normalizeSnapshot, summarizeHistoryMonth, summarizeSamples, type SnapshotState } from "./history-view";

const snapshot: SnapshotState = { fixedTotal: 3000, staffTotal: 4000, taxPct: 0.06, feePct: 0, products: [] };

describe("summarizeHistoryMonth", () => {
  it("calcula o que sobrou no mês pelo custo das fichas", () => {
    const r = summarizeHistoryMonth({ revenue: 30000, purchases: 9000, soldUnits: 1000, theoreticalCost: 8400, snapshot });
    expect(r.insumosPct).toBeCloseTo(0.3, 10);
    expect(r.expectedPct).toBeCloseTo(0.28, 10);
    expect(r.staffPct).toBeCloseTo(4000 / 30000, 10);
    expect(r.resultBasis).toBe("fichas");
    // 30000 − 8400 (fichas) − 4000 − 3000 − 1800 = 12800
    expect(r.result?.value).toBeCloseTo(12800, 6);
    expect(r.result?.pct).toBeCloseTo(12800 / 30000, 10);
  });

  it("sem fichas completas, usa as compras do mês", () => {
    const r = summarizeHistoryMonth({ revenue: 30000, purchases: 9000, soldUnits: 1000, theoreticalCost: null, snapshot });
    expect(r.resultBasis).toBe("compras");
    expect(r.insumosCost).toBe(9000);
    expect(r.result?.value).toBeCloseTo(12200, 6); // 30000 − 9000 − 4000 − 3000 − 1800
  });

  it("mês em andamento cobra as contas fixas só dos dias que passaram", () => {
    const r = summarizeHistoryMonth({ revenue: 15000, purchases: 0, soldUnits: 500, theoreticalCost: 4200, snapshot, elapsed: 0.5 });
    expect(r.partial).toBe(true);
    // 15000 − 4200 − (4000 + 3000) × 0,5 − 900 = 6400
    expect(r.result?.value).toBeCloseTo(6400, 6);
    expect(r.staffPct).toBeCloseTo(2000 / 15000, 10);
  });

  it("sem foto do mês ou sem custo de insumos não inventa resultado", () => {
    expect(summarizeHistoryMonth({ revenue: 30000, purchases: 9000, soldUnits: 0, theoreticalCost: null, snapshot: null }).result).toBeNull();
    expect(summarizeHistoryMonth({ revenue: 30000, purchases: 0, soldUnits: 0, theoreticalCost: null, snapshot }).result).toBeNull();
  });

  it("sem faturamento não divide por zero", () => {
    const r = summarizeHistoryMonth({ revenue: 0, purchases: 500, soldUnits: 0, theoreticalCost: 100, snapshot });
    expect(r.insumosPct).toBeNull();
    expect(r.expectedPct).toBeNull();
    expect(r.staffPct).toBeNull();
    expect(r.result).toBeNull();
  });
});

describe("monthPriceMoves", () => {
  const names = new Map([
    ["a", "Frango"],
    ["b", "Arroz"],
    ["c", "Sal"],
  ]);
  const h = (ingredient_id: string, unit_cost: number, changed_at: string) => ({ ingredient_id, unit_cost, changed_at });

  it("compara o preço antes do mês com o último do mês e ordena pela maior mudança", () => {
    const moves = monthPriceMoves(
      [
        h("a", 10, "2026-08-15T12:00:00Z"),
        h("a", 11, "2026-09-05T12:00:00Z"),
        h("a", 12, "2026-09-20T12:00:00Z"), // +20% em setembro
        h("b", 5, "2026-08-01T12:00:00Z"),
        h("b", 4, "2026-09-10T12:00:00Z"), // −20%
        h("c", 1, "2026-08-01T12:00:00Z"),
        h("c", 1.02, "2026-09-10T12:00:00Z"), // +2%: pequeno demais
        h("a", 13, "2026-10-02T12:00:00Z"), // outubro não conta
      ],
      names,
      "2026-09-01",
    );
    expect(moves.map((m) => m.name)).toEqual(["Frango", "Arroz"]);
    expect(moves[0].pct).toBeCloseTo(0.2, 10);
    expect(moves[1].pct).toBeCloseTo(-0.2, 10);
  });

  it("ignora insumo criado dentro do mês (não há preço anterior)", () => {
    expect(monthPriceMoves([h("a", 10, "2026-09-02T12:00:00Z"), h("a", 20, "2026-09-20T12:00:00Z")], names, "2026-09-01")).toEqual([]);
  });
});

describe("variação durante o mês", () => {
  const state = (price: number, staff = 4000): SnapshotState => ({
    fixedTotal: 3000,
    staffTotal: staff,
    taxPct: 0.06,
    feePct: 0,
    products: [{ id: "p1", name: "Frango", cost: 7.5, price }],
  });

  it("só grava amostra nova quando algo mudou", () => {
    const first = appendSample(null, state(15), new Date("2026-09-02T12:00:00-03:00"))!;
    expect(first.samples).toHaveLength(1);
    expect(appendSample(first, state(15), new Date("2026-09-03T12:00:00-03:00"))).toBeNull();
    const second = appendSample(first, state(16), new Date("2026-09-16T12:00:00-03:00"))!;
    expect(second.samples).toHaveLength(2);
  });

  it("média ponderada pelo tempo: preço 15 até o dia 16 e 16 depois", () => {
    let snap = appendSample(null, state(15), new Date("2026-09-05T12:00:00-03:00"))!;
    snap = appendSample(snap, state(16), new Date("2026-09-16T00:00:00-03:00"))!;
    const r = summarizeSamples(snap, "2026-09-01", new Date("2026-10-01T00:00:00-03:00"));
    // 15 dias a R$ 15 (1 a 16) e 15 dias a R$ 16 (16 a 1/10)
    expect(r.products[0].avgPrice).toBeCloseTo(15.5, 6);
    expect(r.products[0].minPrice).toBe(15);
    expect(r.products[0].maxPrice).toBe(16);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({ kind: "price", label: "Frango", from: 15, to: 16 });
  });

  it("registra mudança da equipe e lê a foto antiga de um estado só", () => {
    let snap = appendSample(null, state(15, 4000), new Date("2026-09-02T00:00:00-03:00"))!;
    snap = appendSample(snap, state(15, 5000), new Date("2026-09-16T00:00:00-03:00"))!;
    expect(summarizeSamples(snap, "2026-09-01", new Date("2026-10-01T00:00:00-03:00")).events.map((e) => e.kind)).toEqual(["staff"]);

    const old = normalizeSnapshot({ v: 1, ...state(15) }, "2026-09-01")!;
    expect(old.samples).toHaveLength(1);
    expect(summarizeSamples(old, "2026-09-01", new Date("2026-10-01T00:00:00-03:00")).average.staffTotal).toBe(4000);
  });
});

describe("fuso de Brasília", () => {
  it("um registro às 22h do último dia do mês conta no mês certo, com peso", async () => {
    const { monthBounds } = await import("./month-view");
    const b = monthBounds("2026-09-01");
    expect(b.start.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(b.end.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    // 22h de Brasília de 30/09 = 01h UTC de 01/10: em UTC cairia em outubro
    const at = new Date("2026-09-30T22:00:00-03:00");
    expect(at.getTime()).toBeGreaterThanOrEqual(b.start.getTime());
    expect(at.getTime()).toBeLessThan(b.end.getTime());
    const first = appendSample(null, { fixedTotal: 1, staffTotal: 1, taxPct: 0, feePct: 0, products: [{ id: "p", name: "P", cost: 5, price: 10 }] }, new Date("2026-09-10T12:00:00-03:00"))!;
    const snap = appendSample(first, { fixedTotal: 1, staffTotal: 1, taxPct: 0, feePct: 0, products: [{ id: "p", name: "P", cost: 5, price: 20 }] }, at)!;
    const r = summarizeSamples(snap, "2026-09-01", b.end);
    expect(r.products[0].avgPrice!).toBeGreaterThan(10); // as 2h finais valem R$ 20, então a média passa de 10
    expect(monthBounds("2026-12-01").end.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });
});

describe("histórico com o cardápio", () => {
  const costs = new Map([["frango", 8.5], ["strog", 11.2]]);
  const costOf = (id: string) => costs.get(id) ?? null;
  const combos = new Map([["kit", { cost: 80, units: 10 }]]);

  it("soma o faturamento do cardápio ao digitado e conta as marmitas dos dois", () => {
    const m = mergeMonthWithMenu({
      typed: { revenue: 6_000, qty: new Map([["frango", 100]]) },
      menu: { orders: 120, revenue: 14_000, recipeUnits: new Map([["frango", 200], ["strog", 50]]), comboQty: new Map([["kit", 4]]) },
      costOf,
      combos,
    });
    expect(m.revenue).toBe(20_000);
    expect(m.soldUnits).toBe(100 + 250 + 40);
    expect(m.theoreticalCost).toBe(100 * 8.5 + 200 * 8.5 + 50 * 11.2 + 4 * 80);
    expect(m.menuRevenue).toBe(14_000);
    expect(m.menuOrders).toBe(120);
  });

  it("mês sem pedidos importados fica só com o digitado (o que foi digitado era o total)", () => {
    const m = mergeMonthWithMenu({
      typed: { revenue: 30_000, qty: new Map([["frango", 500]]) },
      menu: { orders: 0, revenue: 0, recipeUnits: new Map(), comboQty: new Map() },
      costOf,
      combos,
    });
    expect(m).toMatchObject({ revenue: 30_000, soldUnits: 500, menuRevenue: 0, menuOrders: 0 });
    expect(m.theoreticalCost).toBe(4_250);
  });

  it("ficha sem custo não entra no custo esperado, mas conta como vendida", () => {
    const m = mergeMonthWithMenu({
      typed: { revenue: 0, qty: new Map() },
      menu: { orders: 5, revenue: 500, recipeUnits: new Map([["semcusto", 10]]), comboQty: new Map() },
      costOf,
      combos,
    });
    expect(m.soldUnits).toBe(10);
    expect(m.theoreticalCost).toBeNull();
  });
});
