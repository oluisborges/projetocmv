import { describe, expect, it } from "vitest";
import { priceIncreaseAlerts } from "./price-alerts";

const now = new Date("2026-10-10T12:00:00Z");
const names = new Map([
  ["frango", "Peito de frango"],
  ["arroz", "Arroz"],
  ["sal", "Sal"],
]);
const used = new Map([
  ["frango", 3],
  ["arroz", 5],
]);

describe("priceIncreaseAlerts", () => {
  it("avisa o insumo que subiu 12% e quantas fichas ele afeta", () => {
    const r = priceIncreaseAlerts({
      history: [
        { ingredient_id: "frango", unit_cost: 0.014, changed_at: "2026-09-20T10:00:00Z" },
        { ingredient_id: "frango", unit_cost: 0.01568, changed_at: "2026-10-05T10:00:00Z" },
      ],
      names,
      recipesUsing: used,
      now,
    });
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("Peito de frango");
    expect(r[0].pct).toBeCloseTo(0.12, 4);
    expect(r[0].recipes).toBe(3);
  });

  it("ignora queda de preço, variação pequena e histórico de um único ponto", () => {
    const r = priceIncreaseAlerts({
      history: [
        { ingredient_id: "arroz", unit_cost: 0.006, changed_at: "2026-09-25T10:00:00Z" },
        { ingredient_id: "arroz", unit_cost: 0.0061, changed_at: "2026-10-02T10:00:00Z" }, // +1,7%
        { ingredient_id: "sal", unit_cost: 0.002, changed_at: "2026-10-01T10:00:00Z" }, // 1 ponto
        { ingredient_id: "frango", unit_cost: 0.02, changed_at: "2026-09-25T10:00:00Z" },
        { ingredient_id: "frango", unit_cost: 0.015, changed_at: "2026-10-02T10:00:00Z" }, // caiu
      ],
      names,
      recipesUsing: used,
      now,
    });
    expect(r).toEqual([]);
  });

  it("o primeiro preço de um insumo importado (de R$ 0) não é aumento", () => {
    const r = priceIncreaseAlerts({
      history: [
        { ingredient_id: "frango", unit_cost: 0, changed_at: "2026-09-25T10:00:00Z" },
        { ingredient_id: "frango", unit_cost: 0.014, changed_at: "2026-09-26T10:00:00Z" },
      ],
      names,
      recipesUsing: used,
      now,
    });
    expect(r).toEqual([]);
  });

  it("só olha a janela de 45 dias e ordena do maior aumento para o menor", () => {
    const r = priceIncreaseAlerts({
      history: [
        { ingredient_id: "sal", unit_cost: 0.001, changed_at: "2026-07-01T10:00:00Z" }, // fora da janela
        { ingredient_id: "sal", unit_cost: 0.002, changed_at: "2026-10-01T10:00:00Z" },
        { ingredient_id: "arroz", unit_cost: 0.006, changed_at: "2026-09-15T10:00:00Z" },
        { ingredient_id: "arroz", unit_cost: 0.0072, changed_at: "2026-10-01T10:00:00Z" }, // +20%
        { ingredient_id: "frango", unit_cost: 0.014, changed_at: "2026-09-15T10:00:00Z" },
        { ingredient_id: "frango", unit_cost: 0.0161, changed_at: "2026-10-01T10:00:00Z" }, // +15%
      ],
      names,
      recipesUsing: used,
      now,
    });
    expect(r.map((a) => a.name)).toEqual(["Arroz", "Peito de frango"]);
  });
});
