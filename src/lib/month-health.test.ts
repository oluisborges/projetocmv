import { describe, expect, it } from "vitest";
import { monthHealth } from "./month-health";

// Setembro tem 30 dias. Dia 10 às 12h em Brasília = 15h UTC.
const day = (d: number) => new Date(Date.UTC(2026, 8, d, 15));
const base = { monthStart: "2026-09-01", revenue: 15000, insumosCost: 5250, variablePct: 0.06, fixedTotal: 12000, breakEvenRevenue: 36000 };

describe("como estou este mês", () => {
  it("mês em andamento: sobra até agora usa as contas fixas só dos dias passados", () => {
    const h = monthHealth({ ...base, now: day(10) });
    expect(h.partial).toBe(true);
    expect(h.day).toBe(10);
    // 15000 − 5250 − 900 (6%) − 4000 (12000 × 10/30) = 4850
    expect(h.profit).toBeCloseTo(4850, 2);
  });

  it("projeta o mês pelo ritmo e compara com o ponto de equilíbrio", () => {
    const h = monthHealth({ ...base, now: day(10) });
    expect(h.projectedRevenue).toBeCloseTo(45000, 2); // 15000/10 × 30
    // 45000 − 15750 − 2700 − 12000 = 14550
    expect(h.projectedProfit).toBeCloseTo(14550, 2);
    expect(h.tone).toBe("good");
    expect(h.headline).toContain("sobra");
    expect(h.breakEvenProgress).toBeCloseTo(15000 / 36000, 4);
    expect(h.missingToBreakEven).toBe(21000);
  });

  it("ritmo abaixo do equilíbrio avisa, e muito abaixo é vermelho", () => {
    const warn = monthHealth({ ...base, revenue: 10000, insumosCost: 3500, now: day(10), breakEvenRevenue: 36000 }); // projeta 30000 (83%)
    expect(warn.projectedRevenue).toBeCloseTo(30000, 2);
    expect(warn.tone).toBe("bad"); // 30000 < 36000 × 0,85
    const almost = monthHealth({ ...base, revenue: 11500, insumosCost: 4025, now: day(10) }); // 34500 = 96%
    expect(almost.tone).toBe("warn");
  });

  it("nos primeiros dias não projeta", () => {
    const h = monthHealth({ ...base, revenue: 2000, insumosCost: 700, now: day(3) });
    expect(h.projectedRevenue).toBeNull();
    expect(h.projectedProfit).toBeNull();
    expect(h.tone).toBe("neutral");
  });

  it("sem custo de insumos não inventa lucro", () => {
    const h = monthHealth({ ...base, insumosCost: null, now: day(10) });
    expect(h.profit).toBeNull();
    expect(h.headline).toContain("fichas");
  });

  it("mês fechado: usa o mês inteiro e diz como terminou", () => {
    const h = monthHealth({ ...base, revenue: 40000, insumosCost: 14000, now: new Date(Date.UTC(2026, 9, 5, 15)) });
    expect(h.partial).toBe(false);
    expect(h.day).toBe(30);
    // 40000 − 14000 − 2400 − 12000 = 11600
    expect(h.profit).toBeCloseTo(11600, 2);
    expect(h.tone).toBe("good");
    expect(h.headline).toContain("fechou com sobra");
  });

  it("mês fechado no vermelho", () => {
    const h = monthHealth({ ...base, revenue: 20000, insumosCost: 8000, now: new Date(Date.UTC(2026, 9, 5, 15)) });
    expect(h.profit).toBeLessThan(0);
    expect(h.tone).toBe("bad");
  });

  it("sem vendas", () => {
    expect(monthHealth({ ...base, revenue: 0, now: day(10) }).headline).toContain("Ainda não há vendas");
  });
});
