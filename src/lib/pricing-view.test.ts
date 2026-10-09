import { describe, expect, it } from "vitest";
import { analyzePrice, priceBreakdown, type PricingSettings } from "./pricing-view";

const settings: PricingSettings = { taxPct: 0.06, fixedExpensePct: 0.12, profitPct: 0.15, minMarginPct: 0.1 };

describe("analyzePrice", () => {
  it("custo 7,51 com 6% imposto, 5% taxa, 12% fixas e 15% lucro: sugere R$ 12,12 (arredonda para cima)", () => {
    const a = analyzePrice({ cost: 7.51, settings, feePct: 0.05 });
    expect(a.suggested).toBe(12.12);
    expect(a.impossible).toBe(false);
    expect(a.at).toBeNull();
  });

  it("no preço sugerido a margem líquida fica no lucro desejado (ou um tico acima)", () => {
    const a = analyzePrice({ cost: 7.51, settings, feePct: 0.05, price: 12.12 });
    expect(a.at!.netPct).toBeGreaterThanOrEqual(0.15);
    expect(a.at!.netPct).toBeLessThan(0.151);
    expect(a.at!.status).toBe("good");
  });

  it("vender a R$ 10,00 fica abaixo da meta", () => {
    const a = analyzePrice({ cost: 7.51, settings, feePct: 0.05, price: 10 });
    expect(a.at!.net).toBeCloseTo(0.19, 2);
    expect(a.at!.netPct).toBeCloseTo(0.019, 3);
    expect(a.at!.contribution).toBeCloseTo(1.39, 2);
    expect(a.at!.status).toBe("below-target");
  });

  it("canal com taxa maior pede preço maior", () => {
    const direct = analyzePrice({ cost: 7.51, settings, feePct: 0 }).suggested!;
    const delivery = analyzePrice({ cost: 7.51, settings, feePct: 0.27 }).suggested!;
    expect(delivery).toBeGreaterThan(direct);
  });

  it("percentuais que somam 100% ou mais: não existe preço, sem quebrar", () => {
    const a = analyzePrice({ cost: 7.51, settings: { ...settings, profitPct: 0.6 }, feePct: 0.3, price: 12 });
    expect(a.impossible).toBe(true);
    expect(a.suggested).toBeNull();
    expect(a.at).not.toBeNull(); // o preço praticado ainda pode ser analisado
  });

  it("preço zero ou vazio não gera análise", () => {
    expect(analyzePrice({ cost: 7.51, settings, feePct: 0, price: 0 }).at).toBeNull();
    expect(analyzePrice({ cost: 7.51, settings, feePct: 0, price: null }).at).toBeNull();
  });
});

describe("priceBreakdown", () => {
  it("as partes somam o preço", () => {
    const parts = priceBreakdown({ price: 15, cost: 7.51, settings, feePct: 0.05 });
    expect(parts.reduce((s, p) => s + p.value, 0)).toBeCloseTo(15, 8);
    expect(parts.reduce((s, p) => s + p.pct, 0)).toBeCloseTo(1, 8);
    expect(parts.map((p) => p.key)).toEqual(["cost", "tax", "fee", "fixed", "profit"]);
  });

  it("preço abaixo do custo mostra lucro negativo (prejuízo)", () => {
    const parts = priceBreakdown({ price: 6, cost: 7.51, settings, feePct: 0 });
    expect(parts.find((p) => p.key === "profit")!.value).toBeLessThan(0);
  });
});
