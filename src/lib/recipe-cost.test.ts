import { describe, expect, it } from "vitest";
import { computeRecipe, type CostItem } from "./recipe-cost";

const frango = { unit_cost: 0.014, correction_factor: 1.15 };
const bandeja = { unit_cost: 0.9, correction_factor: 1 };
const filme = { unit_cost: 0.12, correction_factor: 1 };

const items: CostItem[] = [
  { ingredient: frango, netQty: 10000, scope: "batch" },
  { ingredient: bandeja, netQty: 1, scope: "portion" },
  { ingredient: filme, netQty: 1, scope: "portion" },
];

describe("computeRecipe", () => {
  it("frango grelhado: 25 porções de 300 g custam R$ 7,46 cada (6,44 do lote + 1,02 de bandeja e filme)", () => {
    const r = computeRecipe({ portions: null, portionWeight: 300, cookingLossPct: 0.25 }, items);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cost.portions.toString()).toBe("25");
      expect(r.cost.costPerPortion.toFixed(2)).toBe("7.46");
      expect(r.missingPrices).toBe(0);
    }
  });

  it("conta itens sem preço (custo incompleto)", () => {
    const r = computeRecipe(
      { portions: 10, portionWeight: null, cookingLossPct: 0 },
      [...items, { ingredient: { unit_cost: 0, correction_factor: 1 }, netQty: 50, scope: "batch" }],
    );
    expect(r.ok && r.missingPrices).toBe(1);
  });

  it("ficha sem ingredientes não quebra", () => {
    expect(computeRecipe({ portions: 10, portionWeight: null, cookingLossPct: 0 }, [])).toEqual({ ok: false, reason: "no-items" });
    expect(computeRecipe({ portions: 10, portionWeight: null, cookingLossPct: 0 }, items.slice(1))).toEqual({ ok: false, reason: "no-items" });
  });

  it("sem porções nem peso da porção, explica o motivo", () => {
    expect(computeRecipe({ portions: null, portionWeight: null, cookingLossPct: 0 }, items)).toEqual({ ok: false, reason: "no-portions" });
  });

  it("peso da porção maior que o rendimento (zero porções) não quebra", () => {
    const r = computeRecipe({ portions: null, portionWeight: 99999, cookingLossPct: 0 }, items);
    expect(r.ok).toBe(false);
  });

  it("perda de cocção inválida não quebra", () => {
    const r = computeRecipe({ portions: 10, portionWeight: null, cookingLossPct: 1 }, items);
    expect(r).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("rendimento só conta peso", () => {
  it("30 ovos (un) não viram 30 g no rendimento", () => {
    const ovo = { unit_cost: 0.8, correction_factor: 1, purchase_unit: "un" };
    const arroz = { unit_cost: 0.006, correction_factor: 1, purchase_unit: "kg" };
    const withEggs = computeRecipe(
      { portions: null, portionWeight: 100, cookingLossPct: 0 },
      [
        { ingredient: arroz, netQty: 1000, scope: "batch" },
        { ingredient: ovo, netQty: 30, scope: "batch" },
      ],
    );
    expect(withEggs.ok).toBe(true);
    if (withEggs.ok) expect(withEggs.cost.yieldWeight.toString()).toBe("1000"); // sem os 30 ovos
  });
});

describe("ficha por marmita usa o rendimento de cada insumo", () => {
  const arroz = { unit_cost: 0.006, correction_factor: 1, purchase_unit: "kg", cooking_yield: 2.5 };
  const frango = { unit_cost: 0.014, correction_factor: 1.15, purchase_unit: "kg", cooking_yield: 0.75 };
  const bandeja = { unit_cost: 0.9, correction_factor: 1, purchase_unit: "un", cooking_yield: 1 };
  const itens: CostItem[] = [
    { ingredient: arroz, netQty: 150, scope: "batch" },
    { ingredient: frango, netQty: 120, scope: "batch" },
    { ingredient: bandeja, netQty: 1, scope: "portion" },
  ];

  it("com rendimento: arroz 0,36 + frango 2,576 + bandeja 0,90 = R$ 3,84", () => {
    const r = computeRecipe({ portions: 1, portionWeight: null, cookingLossPct: 0, useCookingYield: true }, itens);
    expect(r.ok && r.cost.costPerPortion.toFixed(3)).toBe("3.836");
  });

  it("em lote o rendimento do insumo é ignorado (a perda de cocção da receita já cuida disso)", () => {
    const r = computeRecipe({ portions: 1, portionWeight: null, cookingLossPct: 0, useCookingYield: false }, itens);
    // arroz 150 g crus = 0,90 | frango 120 × 1,15 = 138 g = 1,932 | bandeja 0,90
    expect(r.ok && r.cost.costPerPortion.toFixed(3)).toBe("3.732");
  });
});
