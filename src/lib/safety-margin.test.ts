import { describe, expect, it } from "vitest";
import { recipeCost } from "@/lib/calc";
import { analyzePrice, priceBreakdown } from "./pricing-view";
import { computeRecipe } from "./recipe-cost";

describe("margem de segurança nos insumos", () => {
  const ingredient = { unit_cost: 0.02, correction_factor: 1, purchase_unit: "g" };
  const pack = { unit_cost: 1.2, correction_factor: 1, purchase_unit: "un" };

  it("soma 10% só aos insumos do lote, não à embalagem", () => {
    const base = recipeCost({
      items: [
        { unitCost: 0.02, correctionFactor: 1, netQty: 1000, scope: "batch" },
        { unitCost: 1.2, correctionFactor: 1, netQty: 1, scope: "portion" },
      ],
      portions: 10,
    });
    const withMargin = recipeCost({
      items: [
        { unitCost: 0.02, correctionFactor: 1, netQty: 1000, scope: "batch" },
        { unitCost: 1.2, correctionFactor: 1, netQty: 1, scope: "portion" },
      ],
      portions: 10,
      safetyMarginPct: 0.1,
    });
    // lote: R$ 20 -> R$ 22 (÷ 10 porções = R$ 2,20); embalagem R$ 1,20 não muda
    expect(base.costPerPortion.toNumber()).toBeCloseTo(3.2, 10);
    expect(withMargin.ingredientCostPerPortion.toNumber()).toBeCloseTo(2.2, 10);
    expect(withMargin.packagingCostPerPortion.toNumber()).toBeCloseTo(1.2, 10);
    expect(withMargin.costPerPortion.toNumber()).toBeCloseTo(3.4, 10);
  });

  it("computeRecipe repassa a margem; zero retira", () => {
    const items = [
      { ingredient, netQty: 1000, scope: "batch" as const },
      { ingredient: pack, netQty: 1, scope: "portion" as const },
    ];
    const cost = (m: number) => {
      const r = computeRecipe({ portions: 10, portionWeight: null, cookingLossPct: 0, safetyMarginPct: m }, items);
      if (!r.ok) throw new Error("ficha inválida");
      return r.cost.costPerPortion.toNumber();
    };
    expect(cost(0)).toBeCloseTo(3.2, 10);
    expect(cost(0.1)).toBeCloseTo(3.4, 10);
  });
});

describe("outras taxas sobre a venda", () => {
  const settings = { taxPct: 0.06, fixedExpensePct: 0.12, profitPct: 0.15, minMarginPct: 0.1 };

  it("entram na conta do lucro junto com a taxa do canal", () => {
    const without = analyzePrice({ cost: 10, settings, feePct: 0.05, price: 25 }).at!;
    const withOther = analyzePrice({ cost: 10, settings: { ...settings, otherPct: 0.03 }, feePct: 0.05, price: 25 }).at!;
    // 3% de R$ 25 = R$ 0,75 a menos de lucro
    expect(without.net - withOther.net).toBeCloseTo(0.75, 10);
  });

  it("aparecem separadas no 'para onde vai o dinheiro' e a soma continua o preço", () => {
    const parts = priceBreakdown({ price: 25, cost: 10, settings: { ...settings, otherPct: 0.03 }, feePct: 0.05 });
    expect(parts.find((p) => p.key === "other")?.value).toBeCloseTo(0.75, 10);
    expect(parts.reduce((s, p) => s + p.value, 0)).toBeCloseTo(25, 10);
    expect(priceBreakdown({ price: 25, cost: 10, settings, feePct: 0.05 }).some((p) => p.key === "other")).toBe(false);
  });
});
