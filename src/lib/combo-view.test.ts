import { describe, expect, it } from "vitest";
import { summarizeCombo, type ComboShape } from "./combo-view";

const settings = { taxPct: 0.06, fixedExpensePct: 0.12, profitPct: 0.15, minMarginPct: 0.1 };

describe("summarizeCombo", () => {
  const recipes = new Map([
    ["frango", { cost: 5 }],
    ["carne", { cost: 9 }],
    ["lowcarb", { cost: 12 }],
  ]);

  const escolha: ComboShape = {
    groups: [{ kind: "choice", pick_qty: 10, unit_price: 22, options: ["frango", "carne", "lowcarb"].map((id) => ({ recipe_id: id, qty: null, unit_price: null })) }],
  };

  it("kit de escolha: preço, unidades, custo médio, intervalo e lucro", () => {
    const s = summarizeCombo(escolha, recipes, new Map(), settings, 0);
    expect(s.units).toBe(10);
    expect(s.price).toBe(220);
    expect(s.pricePerUnit).toBe(22);
    expect(s.cost).toBeCloseTo(86.6667, 3);
    expect(s.costMin).toBe(50);
    expect(s.costMax).toBe(120);
    expect(s.hasChoice).toBe(true);
    // lucro líquido = 220 − 86,67 − 6% − 12% de 220 = 220 − 86,67 − 39,6 = 93,73
    expect(s.analysis!.at!.net).toBeCloseTo(93.7333, 3);
  });

  it("as vendas puxam o custo para a marmita que mais sai", () => {
    const s = summarizeCombo(escolha, recipes, new Map([["frango", 90], ["carne", 10]]), settings, 0);
    expect(s.cost).toBeCloseTo((5 * 0.9 + 9 * 0.1) * 10, 6);
  });

  it("ficha arquivada ou sem custo deixa o combo marcado como incompleto", () => {
    const fixo: ComboShape = { groups: [{ kind: "fixed", pick_qty: null, unit_price: null, options: [{ recipe_id: "sumiu", qty: 5, unit_price: 23.5 }] }] };
    const s = summarizeCombo(fixo, recipes, new Map(), settings, 0);
    expect(s.incomplete).toBe(true);
    expect(s.price).toBe(117.5);
    expect(s.analysis).toBeNull(); // sem custo não dá para dizer o lucro
  });

  it("combo sem nada ainda é vazio", () => {
    expect(summarizeCombo({ groups: [] }, recipes, new Map(), settings, 0).empty).toBe(true);
  });
});
