import { describe, expect, it } from "vitest";
import { appendSample, monthPriceMoves, normalizeSnapshot, summarizeHistoryMonth, summarizeSamples, type SnapshotState } from "./history-view";

const snapshot: SnapshotState = { fixedTotal: 3000, staffTotal: 4000, taxPct: 0.06, feePct: 0, products: [] };

describe("summarizeHistoryMonth", () => {
  it("calcula o que sobrou no mês", () => {
    const r = summarizeHistoryMonth({ revenue: 30000, purchases: 9000, soldUnits: 1000, theoreticalCost: 8400, snapshot });
    expect(r.insumosPct).toBeCloseTo(0.3, 10);
    expect(r.expectedPct).toBeCloseTo(0.28, 10);
    expect(r.staffPct).toBeCloseTo(4000 / 30000, 10);
    // 30000 − 9000 − 4000 − 3000 − 1800 = 12200
    expect(r.result?.value).toBeCloseTo(12200, 6);
    expect(r.result?.pct).toBeCloseTo(12200 / 30000, 10);
  });

  it("sem foto do mês ou sem compras não inventa resultado", () => {
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
    const first = appendSample(null, state(15), new Date("2026-09-02T12:00:00Z"))!;
    expect(first.samples).toHaveLength(1);
    expect(appendSample(first, state(15), new Date("2026-09-03T12:00:00Z"))).toBeNull();
    const second = appendSample(first, state(16), new Date("2026-09-16T12:00:00Z"))!;
    expect(second.samples).toHaveLength(2);
  });

  it("média ponderada pelo tempo: preço 15 até o dia 16 e 16 depois", () => {
    let snap = appendSample(null, state(15), new Date("2026-09-05T12:00:00Z"))!;
    snap = appendSample(snap, state(16), new Date("2026-09-16T00:00:00Z"))!;
    const r = summarizeSamples(snap, "2026-09-01", new Date("2026-10-01T00:00:00Z"));
    // 15 dias a R$ 15 (1 a 16) e 15 dias a R$ 16 (16 a 1/10)
    expect(r.products[0].avgPrice).toBeCloseTo(15.5, 6);
    expect(r.products[0].minPrice).toBe(15);
    expect(r.products[0].maxPrice).toBe(16);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({ kind: "price", label: "Frango", from: 15, to: 16 });
  });

  it("registra mudança da equipe e lê a foto antiga de um estado só", () => {
    let snap = appendSample(null, state(15, 4000), new Date("2026-09-02T00:00:00Z"))!;
    snap = appendSample(snap, state(15, 5000), new Date("2026-09-16T00:00:00Z"))!;
    expect(summarizeSamples(snap, "2026-09-01", new Date("2026-10-01T00:00:00Z")).events.map((e) => e.kind)).toEqual(["staff"]);

    const old = normalizeSnapshot({ v: 1, ...state(15) }, "2026-09-01")!;
    expect(old.samples).toHaveLength(1);
    expect(summarizeSamples(old, "2026-09-01", new Date("2026-10-01T00:00:00Z")).average.staffTotal).toBe(4000);
  });
});
