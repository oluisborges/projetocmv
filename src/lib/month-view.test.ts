import { describe, expect, it } from "vitest";
import { currentMonthStart, lastMonths, monthLabel, monthStart, summarizeMonth } from "./month-view";

const staff = [
  { area: "cozinha" as const, monthlySalary: 2200, chargesPct: 0.3 }, // 2.860
  { area: "comercial" as const, monthlySalary: 1500, chargesPct: 0 }, // 1.500
];

describe("summarizeMonth", () => {
  it("CMV real, teórico, desvio e mão de obra de um mês de marmitaria", () => {
    const r = summarizeMonth({
      revenue: 60000,
      purchases: 18000,
      sales: [
        { recipeId: "a", qty: 800, cost: 7.51 }, // 6.008
        { recipeId: "b", qty: 600, cost: 9.2 }, // 5.520
      ],
      staff,
    });
    expect(r.cmvRealPct).toBeCloseTo(0.3, 6);
    expect(r.theoreticalCost).toBeCloseTo(11528, 6);
    expect(r.cmvTheoreticalPct).toBeCloseTo(0.192133, 5);
    expect(r.deviationPct).toBeCloseTo(0.107867, 5);
    expect(r.deviationCost).toBeCloseTo(6472, 6); // comprou R$ 6.472 além do que as vendas explicam
    expect(r.cmoCost).toBe(4360);
    expect(r.cmoPct).toBeCloseTo(0.072667, 5);
    expect(r.soldUnits).toBe(1400);
    expect(r.salesWithoutCost).toBe(0);
  });

  it("compras abaixo do custo teórico dá desvio negativo (usou estoque antigo)", () => {
    const r = summarizeMonth({ revenue: 10000, purchases: 1000, sales: [{ recipeId: "a", qty: 500, cost: 8 }], staff: [] });
    expect(r.deviationCost).toBeCloseTo(-3000, 6);
    expect(r.deviationPct).toBeLessThan(0);
  });

  it("sem faturamento não inventa percentual", () => {
    const r = summarizeMonth({ revenue: 0, purchases: 5000, sales: [{ recipeId: "a", qty: 100, cost: 8 }], staff });
    expect(r.cmvRealPct).toBeNull();
    expect(r.cmvTheoreticalPct).toBeNull();
    expect(r.deviationPct).toBeNull();
    expect(r.cmoPct).toBeNull();
    expect(r.theoreticalCost).toBeCloseTo(800, 6); // o custo em R$ ainda existe
    expect(r.cmoCost).toBe(4360);
  });

  it("sem compras não há CMV real nem desvio em %", () => {
    const r = summarizeMonth({ revenue: 60000, purchases: 0, sales: [{ recipeId: "a", qty: 100, cost: 8 }], staff: [] });
    expect(r.cmvRealPct).toBeNull();
    expect(r.deviationPct).toBeNull();
    expect(r.deviationCost).toBeNull();
    expect(r.cmvTheoreticalPct).toBeCloseTo(800 / 60000, 8);
  });

  it("venda de ficha incompleta é contada à parte e não entra no custo teórico", () => {
    const r = summarizeMonth({
      revenue: 60000,
      purchases: 18000,
      sales: [
        { recipeId: "a", qty: 100, cost: 8 },
        { recipeId: "b", qty: 50, cost: null },
      ],
      staff: [],
    });
    expect(r.salesWithoutCost).toBe(1);
    expect(r.theoreticalCost).toBe(800);
    expect(r.soldUnits).toBe(150);
  });

  it("quantidades zero são ignoradas", () => {
    const r = summarizeMonth({ revenue: 1000, purchases: 100, sales: [{ recipeId: "a", qty: 0, cost: 8 }], staff: [] });
    expect(r.theoreticalCost).toBeNull();
    expect(r.soldUnits).toBe(0);
  });
});

describe("meses", () => {
  it("valida e normaliza para o dia 1", () => {
    expect(monthStart("2026-10")).toBe("2026-10-01");
    expect(monthStart("2026-10-09")).toBe("2026-10-01");
    expect(monthStart("2026-13")).toBeNull();
    expect(monthStart("26-10")).toBeNull();
    expect(monthStart("0000-01")).toBeNull(); // ano 0 não existe no banco
    expect(monthStart("1999-12")).toBeNull();
    expect(monthStart("")).toBeNull();
    expect(monthStart(undefined)).toBeNull();
  });

  it("mês atual no fuso de São Paulo (3h de diferença do UTC)", () => {
    expect(currentMonthStart(new Date("2026-10-31T23:30:00-03:00"))).toBe("2026-10-01");
    // 01/11 01:30 UTC ainda é 31/10 22:30 em São Paulo
    expect(currentMonthStart(new Date("2026-11-01T01:30:00Z"))).toBe("2026-10-01");
    expect(currentMonthStart(new Date("2026-11-01T04:00:00Z"))).toBe("2026-11-01");
  });

  it("lista meses virando o ano", () => {
    expect(lastMonths("2026-02-01", 4)).toEqual(["2026-02-01", "2026-01-01", "2025-12-01", "2025-11-01"]);
  });

  it("nome do mês em português", () => {
    expect(monthLabel("2026-10-01")).toBe("outubro de 2026");
    expect(monthLabel("2027-03-01")).toBe("março de 2027");
  });
});
