import { describe, expect, it } from "vitest";
import { analyzePrice, monthlyResult, priceBreakdown, priceChange, type PricingSettings } from "./pricing-view";

const settings: PricingSettings = { taxPct: 0.06, fixedExpensePct: 0.12, profitPct: 0.15, minMarginPct: 0.1 };

describe("analyzePrice", () => {
  it("sem preço informado não há análise", () => {
    expect(analyzePrice({ cost: 7.51, settings, feePct: 0.05 }).at).toBeNull();
  });

  it("a R$ 12,12 (custo 7,51, 6% imposto, 5% taxa, 12% fixas) a margem líquida é de uns 15%", () => {
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

  it("canal com taxa maior deixa sobrar menos no mesmo preço", () => {
    const direct = analyzePrice({ cost: 7.51, settings, feePct: 0, price: 15 }).at!;
    const delivery = analyzePrice({ cost: 7.51, settings, feePct: 0.27, price: 15 }).at!;
    expect(delivery.net).toBeLessThan(direct.net);
  });

  it("taxas que passam do preço dão prejuízo, sem quebrar", () => {
    const a = analyzePrice({ cost: 7.51, settings, feePct: 0.9, price: 12 });
    expect(a.at!.net).toBeLessThan(0);
    expect(a.at!.status).toBe("below-target");
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

describe("extrato da marmita: quanto sobra por unidade e no mês", () => {
  // Marmita de R$ 5,36 vendida a R$ 12,00: impostos 6%, taxa do canal 3%, custos fixos 20%.
  const s: PricingSettings = { taxPct: 0.06, fixedExpensePct: 0.2, profitPct: 0.15, minMarginPct: 0.1 };

  it("sobra antes dos fixos e lucro por unidade", () => {
    const a = analyzePrice({ cost: 5.36, settings: s, feePct: 0.03, price: 12 }).at!;
    expect(a.contribution).toBeCloseTo(5.56, 6);
    expect(a.contributionPct).toBeCloseTo(0.4633, 4);
    expect(a.net).toBeCloseTo(3.16, 6);
    expect(a.netPct).toBeCloseTo(0.2633, 4);
  });

  it("o extrato fecha: custo + impostos + taxa + fixos + lucro = preço", () => {
    const parts = priceBreakdown({ price: 12, cost: 5.36, settings: s, feePct: 0.03 });
    expect(parts.reduce((sum, p) => sum + p.value, 0)).toBeCloseTo(12, 8);
    expect(parts.find((p) => p.key === "profit")!.value).toBeCloseTo(3.16, 6);
  });

  it("vendendo 300 por mês", () => {
    const a = analyzePrice({ cost: 5.36, settings: s, feePct: 0.03, price: 12 }).at!;
    const m = monthlyResult({ price: 12, contribution: a.contribution, net: a.net, units: 300 });
    expect(m.revenue).toBe(3600);
    expect(m.contribution).toBeCloseTo(1668, 4);
    expect(m.net).toBeCloseTo(948, 4);
  });

  it("subir de R$ 12,00 para R$ 13,00 deixa R$ 0,71 a mais por marmita", () => {
    const c = priceChange({ cost: 5.36, settings: s, feePct: 0.03, from: 12, to: 13 })!;
    expect(c.after.net).toBeCloseTo(3.87, 6);
    expect(c.netDelta).toBeCloseTo(0.71, 6);
  });

  it("sem preço dos dois lados, não compara; unidades negativas viram zero", () => {
    expect(priceChange({ cost: 5.36, settings: s, feePct: 0, from: 0, to: 13 })).toBeNull();
    expect(monthlyResult({ price: 12, contribution: 5, net: 3, units: -4 }).net).toBe(0);
  });
});
