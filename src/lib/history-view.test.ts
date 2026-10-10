import { describe, expect, it } from "vitest";
import { monthPriceMoves, summarizeHistoryMonth, type MonthSnapshot } from "./history-view";

const snapshot: MonthSnapshot = { v: 1, fixedTotal: 3000, staffTotal: 4000, taxPct: 0.06, feePct: 0, products: [] };

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
