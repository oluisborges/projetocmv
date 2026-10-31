import { describe, expect, it } from "vitest";
import { emptyNutrition, kcalToKj, percentDV, roundForLabel, scaleNutrition, sumNutrition, type Nutrition } from "./calc/nutrition";
import { nutritionToPdf } from "./nutrition-export";
import { nutritionRows } from "./nutrition-rows";
import type { ProductNutrition } from "./nutrition-data";
import { searchTaco, suggestTaco, tacoFood, tacoNutrition } from "./taco";
import { TACO_FOODS } from "./taco-data";

const n = (o: Partial<Nutrition>): Nutrition => ({ ...emptyNutrition(), ...o });

describe("cálculo nutricional", () => {
  it("soma o que cada ingrediente traz, proporcional ao peso", () => {
    // Arroz tipo 1 cozido (TACO: 128 kcal, 2,5 g prot.) e frango grelhado (159 kcal, 32 g prot.)
    const arroz = tacoNutrition(3)!;
    const frango = tacoNutrition(410)!;
    const { total, missing } = sumNutrition([
      { grams: 150, per100: arroz },
      { grams: 120, per100: frango },
    ]);
    expect(missing).toBe(0);
    expect(total.kcal).toBeCloseTo(1.5 * 128 + 1.2 * 159, 4);
    expect(total.protein).toBeCloseTo(1.5 * 2.5 + 1.2 * 32, 4);
    expect(total.sugars).toBeNull(); // a TACO não traz açúcares: continua sem dado, não vira zero
  });

  it("ingrediente sem alimento ligado conta como faltando e não zera o resto", () => {
    const { total, missing } = sumNutrition([
      { grams: 100, per100: n({ kcal: 100 }) },
      { grams: 50, per100: null },
    ]);
    expect(missing).toBe(1);
    expect(total.kcal).toBe(100);
  });

  it("reescala da porção para 100 g", () => {
    const per100 = scaleNutrition(n({ kcal: 335, sodium: 200 }), 335, 100);
    expect(per100.kcal).toBeCloseTo(100, 6);
    expect(per100.sodium).toBeCloseTo(59.7015, 3);
    expect(scaleNutrition(n({ kcal: 1 }), 0, 100).kcal).toBeNull();
  });

  it("%VD usa os valores de referência da IN 75 e some onde não há referência", () => {
    expect(percentDV("kcal", 400)).toBe(20);
    expect(percentDV("sodium", 1200)).toBe(50);
    expect(percentDV("protein", 37.5)).toBe(50);
    expect(percentDV("transFat", 1)).toBeNull();
    expect(percentDV("sugars", 10)).toBeNull();
    expect(percentDV("fat", null)).toBeNull();
  });

  it("arredonda como no rótulo", () => {
    expect(roundForLabel("kcal", 412.6)).toBe(413);
    expect(roundForLabel("carbs", 0.4)).toBe(0);
    expect(roundForLabel("carbs", 7.46)).toBe(7.5);
    expect(roundForLabel("carbs", 44.6)).toBe(45);
    expect(roundForLabel("sodium", 4)).toBe(0);
    expect(roundForLabel("sodium", 523.4)).toBe(523);
    expect(roundForLabel("transFat", 0.1)).toBe(0);
    expect(roundForLabel("fat", null)).toBeNull();
    expect(kcalToKj(100)).toBe(418);
  });
});

describe("TACO", () => {
  it("traz os 597 alimentos com dados conferidos", () => {
    expect(TACO_FOODS.length).toBe(597);
    expect(tacoFood(3)?.name).toBe("Arroz, tipo 1, cozido");
    expect(tacoNutrition(3)).toMatchObject({ kcal: 128, protein: 2.5, carbs: 28.1 });
    expect(tacoNutrition(410)).toMatchObject({ kcal: 159, protein: 32 });
    expect(tacoNutrition(999999)).toBeNull();
  });

  it("busca pelo nome, sem acento e com todas as palavras", () => {
    const r = searchTaco("brocolis cru");
    expect(r.map((f) => f.name)).toContain("Brócolis, cru");
    expect(searchTaco("")).toEqual([]);
    expect(searchTaco("zzzz")).toEqual([]);
  });

  it("sugere o alimento certo para nomes de ingredientes de marmitaria", () => {
    expect(suggestTaco("Cebola in natura")?.name).toMatch(/^Cebola, crua/);
    expect(suggestTaco("Alho")?.name).toMatch(/^Alho/);
    expect(suggestTaco("Brócolis")?.name).toMatch(/^Brócolis/);
    expect(suggestTaco("Embalagem 750 ml")).toBeNull();
    expect(suggestTaco("")).toBeNull();
  });
});

describe("tabela nutricional pronta", () => {
  const base = { id: "p1", name: "Frango com arroz", lines: [], missing: 0, override: null, householdMeasure: "1 marmita", portionGrams: 300, canWrite: true };
  // Porção de 300 g: 150 g de arroz cozido + 150 g de frango grelhado (TACO)
  const { total } = sumNutrition([
    { grams: 150, per100: tacoNutrition(3) },
    { grams: 150, per100: tacoNutrition(410) },
  ]);
  const data: ProductNutrition = { ...base, auto: { perPortion: total, portionGrams: 300 }, perPortion: total, per100: scaleNutrition(total, 300, 100) };

  it("monta as linhas na ordem da RDC, com %VD e sem inventar o que a TACO não tem", () => {
    const rows = nutritionRows(data.per100, data.perPortion);
    expect(rows.map((r) => r.label)).toEqual(["Valor energético", "Carboidratos totais", "Açúcares totais", "Açúcares adicionados", "Proteínas", "Gorduras totais", "Gorduras saturadas", "Gorduras trans", "Fibra alimentar", "Sódio"]);
    // 150 g de arroz (128 kcal/100 g) + 150 g de frango (159 kcal/100 g) = 430,5 kcal
    expect(rows[0].perPortion).toBe("431 kcal = 1.803 kJ");
    expect(rows[0].vd).toBe("22");
    expect(rows[2].perPortion).toBe("—"); // açúcares: sem dado
    expect(rows[2].vd).toBe("**");
    expect(nutritionRows(null, data.perPortion)[0].per100).toBe("—");
  });

  it("gera o PDF", async () => {
    const pdf = await nutritionToPdf(data, "Hibiscus Gastronomia", new Date("2026-10-31T15:00:00Z"));
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);
});
