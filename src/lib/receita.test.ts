import { describe, expect, it } from "vitest";
import { receitaCostPerGram } from "@/lib/calc";
import { computeReceita, computeRecipe, type CostIngredient } from "@/lib/recipe-cost";

// R$ por grama = preço ÷ gramas compradas. Valores de marmitaria: arroz R$ 5/kg, sal R$ 3/kg, cebola R$ 5/kg (FC 1,1), óleo R$ 8/l, alho R$ 25/kg.
const ing = (pricePerKg: number, fc = 1): CostIngredient => ({ unit_cost: pricePerKg / 1000, correction_factor: fc, cooking_yield: 1 });

const arroz = {
  // lote de 5 kg de arroz cru que rende 12,5 kg de arroz pronto
  readyWeightGrams: 12_500,
  ingredients: [
    { ingredient: ing(5), netQty: 5000 }, // 5 kg arroz  = 25,00
    { ingredient: ing(3), netQty: 100 }, // 100 g sal   = 0,30
    { ingredient: ing(5, 1.1), netQty: 500 }, // 500 g cebola (FC 1,1) = 2,75
    { ingredient: ing(8), netQty: 200 }, // 200 ml óleo = 1,60
    { ingredient: ing(25), netQty: 100 }, // 100 g alho  = 2,50
  ],
};

describe("Receita: custo por grama", () => {
  it("lote de arroz com sal, cebola, óleo e alho: o tempero já está no custo por kg", () => {
    const r = computeReceita(arroz)!;
    expect(r.batchCost).toBeCloseTo(32.15, 2);
    expect(r.costPerGram).toBeCloseTo(32.15 / 12_500, 8);
    expect(r.costPerGram * 1000).toBeCloseTo(2.572, 3); // R$ 2,57 por kg de arroz pronto
  });

  it("a marmita paga só os gramas que leva: 120 g de arroz pronto", () => {
    const r = computeReceita(arroz)!;
    const arrozPronto: CostIngredient = { unit_cost: r.costPerGram, correction_factor: 1, cooking_yield: 1 };
    const view = computeRecipe({ portions: 1, portionWeight: null, cookingLossPct: 0, useCookingYield: true }, [{ ingredient: arrozPronto, netQty: 120, scope: "batch" }]);
    expect(view.ok && view.cost.costPerPortion.toNumber()).toBeCloseTo(0.3086, 4);
  });

  it("marmita de estrogonofe: três receitas somam por grama, mais a embalagem", () => {
    const estrogonofe = computeReceita({ readyWeightGrams: 6000, ingredients: [{ ingredient: ing(22, 1.15), netQty: 4000 }, { ingredient: ing(3), netQty: 80 }] })!;
    const batata = computeReceita({ readyWeightGrams: 7000, ingredients: [{ ingredient: ing(6, 1.2), netQty: 8000 }, { ingredient: ing(3), netQty: 60 }] })!;
    const a = computeReceita(arroz)!;
    const as = (c: number): CostIngredient => ({ unit_cost: c, correction_factor: 1, cooking_yield: 1 });
    const bandeja: CostIngredient = { unit_cost: 0.9, correction_factor: 1, cooking_yield: 1, purchase_unit: "un" };
    const view = computeRecipe({ portions: 1, portionWeight: null, cookingLossPct: 0, useCookingYield: true }, [
      { ingredient: as(estrogonofe.costPerGram), netQty: 150, scope: "batch" },
      { ingredient: as(a.costPerGram), netQty: 120, scope: "batch" },
      { ingredient: as(batata.costPerGram), netQty: 100, scope: "batch" },
      { ingredient: bandeja, netQty: 1, scope: "portion" },
    ]);
    const esperado = 150 * estrogonofe.costPerGram + 120 * a.costPerGram + 100 * batata.costPerGram + 0.9;
    expect(view.ok && view.cost.costPerPortion.toNumber()).toBeCloseTo(esperado, 6);
    expect(view.ok && view.cost.yieldWeight.toNumber()).toBe(370); // peso da marmita: 150 + 120 + 100
  });

  it("mudou o preço do sal: o custo por grama da receita acompanha", () => {
    const antes = computeReceita(arroz)!.costPerGram;
    const depois = computeReceita({ ...arroz, ingredients: arroz.ingredients.map((i, ix) => (ix === 1 ? { ...i, ingredient: ing(6) } : i)) })!.costPerGram;
    expect(depois).toBeGreaterThan(antes);
    expect((depois - antes) * 12_500).toBeCloseTo(0.3, 6); // 100 g de sal a R$ 3 a mais por kg
  });

  it("sem o peso que rende ou sem ingredientes, não inventa custo", () => {
    expect(computeReceita({ ...arroz, readyWeightGrams: null })).toBeNull();
    expect(computeReceita({ ...arroz, readyWeightGrams: 0 })).toBeNull();
    expect(computeReceita({ readyWeightGrams: 1000, ingredients: [] })).toBeNull();
    expect(() => receitaCostPerGram(10, 0)).toThrow(RangeError);
  });

  it("ingrediente sem preço aparece como aviso", () => {
    const r = computeReceita({ readyWeightGrams: 1000, ingredients: [{ ingredient: ing(0), netQty: 500 }, { ingredient: ing(5), netQty: 500 }] })!;
    expect(r.missingPrices).toBe(1);
  });
});
