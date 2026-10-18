import { describe, expect, it } from "vitest";
import { recipeUsage } from "./recipe-cost";
import { buildStock, stockResult } from "./stock-view";

const frango = { id: "frango", name: "Peito de frango", purchaseUnit: "kg", unitCost: 0.0179 }; // R$ 17,90/kg
const arroz = { id: "arroz", name: "Arroz", purchaseUnit: "kg", unitCost: 0.0056 }; // R$ 5,60/kg

describe("uso por insumo", () => {
  it("ficha por unidade: gramas PRONTAS viram cru comprado (rendimento e fator de correção)", () => {
    // 120 g de frango pronto, rende 0,75 do cru, FC 1,1 → 120 ÷ 0,75 × 1,1 = 176 g comprados
    const usage = recipeUsage({ portions: 1, portionWeight: null, cookingLossPct: 0, useCookingYield: true }, [
      { ingredientId: "frango", ingredient: { unit_cost: 0.0179, correction_factor: 1.1, cooking_yield: 0.75, purchase_unit: "kg" }, netQty: 120, scope: "batch" },
    ])!;
    expect(usage.get("frango")).toBeCloseTo(176, 6);
  });

  it("ficha em lote divide pelas porções; embalagem é por porção", () => {
    const usage = recipeUsage({ portions: 20, portionWeight: null, cookingLossPct: 0, useCookingYield: false }, [
      { ingredientId: "arroz", ingredient: { unit_cost: 0.0056, correction_factor: 1, purchase_unit: "kg" }, netQty: 3000, scope: "batch" },
      { ingredientId: "pote", ingredient: { unit_cost: 0.5, correction_factor: 1, purchase_unit: "un" }, netQty: 1, scope: "portion" },
    ])!;
    expect(usage.get("arroz")).toBeCloseTo(150, 6); // 3000 g ÷ 20
    expect(usage.get("pote")).toBe(1);
  });

  it("ficha incompleta não tem uso", () => {
    expect(recipeUsage({ portions: null, portionWeight: null, cookingLossPct: 0 }, [])).toBeNull();
  });
});

describe("estoque do mês", () => {
  const base = {
    ingredients: [frango, arroz],
    opening: new Map([["frango", 10_000]]), // 10 kg contados no mês anterior
    purchasedNfe: new Map([["frango", 60_000]]),
    purchasedManual: new Map([["arroz", 30_000]]),
    used: new Map([
      ["frango", 58_000],
      ["arroz", 24_000],
    ]),
  };

  it("esperado = começo + comprado − usado", () => {
    const rows = buildStock({ ...base, counts: new Map() });
    const f = rows.find((r) => r.id === "frango")!;
    expect(f.expected).toBe(12_000);
    expect(f.purchasedNfe).toBe(60_000);
    expect(f.counted).toBeNull();
    expect(f.missingValue).toBeNull();
    expect(rows[0].id).toBe("frango"); // 58 kg × R$ 17,90 pesa mais que o arroz
  });

  it("contou menos que o esperado: a diferença é perda em R$", () => {
    const rows = buildStock({ ...base, counts: new Map([["frango", 7_000]]) });
    const f = rows.find((r) => r.id === "frango")!;
    expect(f.missingQty).toBe(5_000);
    expect(f.missingValue).toBeCloseTo(5000 * 0.0179, 6); // R$ 89,50
  });

  it("insumo que não apareceu no mês fica de fora", () => {
    const rows = buildStock({ ...base, ingredients: [...base.ingredients, { id: "x", name: "Sal", purchaseUnit: "kg", unitCost: 0.002 }], counts: new Map() });
    expect(rows.find((r) => r.id === "x")).toBeUndefined();
  });

  it("sem nenhuma contagem não há CMV real", () => {
    const rows = buildStock({ ...base, counts: new Map() });
    expect(stockResult({ rows, purchasesTotal: 1500, theoreticalCost: 1300, revenue: 5000, finishedOpening: 0, finishedClosing: 0 })).toBeNull();
  });

  it("CMV real: começo + compras − fim, ajustado pelo freezer", () => {
    // contou 7 kg de frango (esperava 12); arroz não contado vale o esperado (6 kg)
    const rows = buildStock({ ...base, counts: new Map([["frango", 7_000]]) });
    const r = stockResult({ rows, purchasesTotal: 1_500, theoreticalCost: 1_380, revenue: 5_000, finishedOpening: 0, finishedClosing: 200 })!;
    expect(r.countedCount).toBe(1);
    expect(r.openingValue).toBeCloseTo(10_000 * 0.0179, 6); // 179
    expect(r.closingValue).toBeCloseTo(7_000 * 0.0179 + 6_000 * 0.0056, 6); // 125,30 + 33,60
    expect(r.consumption).toBeCloseTo(179 + 1500 - 158.9, 4); // 1.520,10
    expect(r.cogs).toBeCloseTo(1520.1 - 200, 4); // 200 ficaram prontas no freezer
    expect(r.gap).toBeCloseTo(1320.1 - 1380, 4);
  });

  it("marmitas prontas no freezer no começo entram como consumo extra", () => {
    const rows = buildStock({ ...base, counts: new Map([["frango", 12_000]]) });
    const r = stockResult({ rows, purchasesTotal: 1_000, theoreticalCost: null, revenue: 0, finishedOpening: 300, finishedClosing: 0 })!;
    expect(r.cogs).toBeCloseTo(r.consumption + 300, 6);
    expect(r.gap).toBeNull();
    expect(r.gapPct).toBeNull();
  });
});
