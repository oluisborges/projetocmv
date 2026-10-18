import { describe, expect, it } from "vitest";
import type { HistoryMonth } from "./history-view";
import { profitBridge } from "./profit-bridge";

const month = (revenue: number, purchases: number, soldUnits: number, taxesPct: number, fixed: number): HistoryMonth => ({
  revenue,
  purchases,
  soldUnits,
  insumosPct: purchases / revenue,
  expectedPct: null,
  staffPct: null,
  fixedPct: null,
  taxesPct,
  insumosCost: purchases,
  resultBasis: "compras",
  partial: false,
  result: { value: revenue - purchases - fixed - revenue * taxesPct, pct: 0 },
});

describe("por que o resultado mudou", () => {
  // setembro: 1.000 marmitas a R$ 25 = 25.000; insumos 8.750; imposto 6%; fixas 9.000 → sobra 5.750
  const sep = month(25000, 8750, 1000, 0.06, 9000);

  it("os quatro passos somam exatamente a diferença", () => {
    // outubro: 1.100 marmitas a R$ 24 = 26.400; insumos 10.340 (frango subiu); fixas 9.500
    const oct = month(26400, 10340, 1100, 0.06, 9500);
    const b = profitBridge(sep, oct)!;
    expect(b.from).toBeCloseTo(5750, 2);
    expect(b.to).toBeCloseTo(26400 - 10340 - 9500 - 1584, 2); // 4.976
    const sum = b.steps.reduce((s, x) => s + x.value, 0);
    expect(sum).toBeCloseTo(b.delta, 6);
  });

  it("cada passo mede a sua causa", () => {
    const oct = month(26400, 10340, 1100, 0.06, 9500);
    const b = profitBridge(sep, oct)!;
    const by = Object.fromEntries(b.steps.map((s) => [s.key, s.value]));
    // volume: +100 × (25 × 0,94 − 8,75) = +100 × 14,75 = 1.475
    expect(by.volume).toBeCloseTo(1475, 2);
    // preço: 1.100 × (24 × 0,94 − 25 × 0,94) = −1.034
    expect(by.price).toBeCloseTo(-1034, 2);
    // custo: −1.100 × (9,4 − 8,75) = −715
    expect(by.cost).toBeCloseTo(-715, 2);
    // fixas: −500
    expect(by.fixed).toBeCloseTo(-500, 2);
  });

  it("ordena pelo que mais pesou e cita os insumos que mudaram de preço", () => {
    const oct = month(26400, 10340, 1100, 0.06, 9500);
    const b = profitBridge(sep, oct, [{ name: "Peito de frango", pct: 0.14 }])!;
    expect(b.steps[0].key).toBe("volume");
    expect(b.steps.find((s) => s.key === "cost")!.text).toContain("Peito de frango +14%");
  });

  it("mês em andamento não entra na comparação", () => {
    expect(profitBridge(sep, { ...sep, partial: true })).toBeNull();
  });

  it("sem resultado ou sem marmitas vendidas não explica", () => {
    expect(profitBridge({ ...sep, result: null }, sep)).toBeNull();
    expect(profitBridge(sep, { ...sep, soldUnits: 0 })).toBeNull();
  });
});
