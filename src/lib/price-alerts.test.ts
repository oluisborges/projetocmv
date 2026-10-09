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

  it("usa o preço anterior à janela como base e ordena do maior aumento para o menor", () => {
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
    // sal: o preço de julho (fora da janela) é a base e dobrou; arroz +20%; frango +15%
    expect(r.map((a) => a.name)).toEqual(["Sal", "Arroz", "Peito de frango"]);
  });
});

describe("priceIncreaseAlerts: insumo antigo reajustado uma vez", () => {
  it("cadastrado há meses a R$ 10 e reajustado ontem para R$ 12: avisa +20%", () => {
    const r = priceIncreaseAlerts({
      history: [
        { ingredient_id: "frango", unit_cost: 0.01, changed_at: "2026-03-01T10:00:00Z" }, // há meses
        { ingredient_id: "frango", unit_cost: 0.012, changed_at: "2026-10-09T10:00:00Z" }, // ontem
      ],
      names,
      recipesUsing: used,
      now,
    });
    expect(r).toHaveLength(1);
    expect(r[0].pct).toBeCloseTo(0.2, 6);
  });

  it("insumo que não mudou na janela não gera aviso, mesmo com histórico antigo", () => {
    const r = priceIncreaseAlerts({
      history: [
        { ingredient_id: "arroz", unit_cost: 0.005, changed_at: "2026-02-01T10:00:00Z" },
        { ingredient_id: "arroz", unit_cost: 0.006, changed_at: "2026-04-01T10:00:00Z" },
      ],
      names,
      recipesUsing: used,
      now,
    });
    expect(r).toEqual([]);
  });

  it("base zero antiga (importado do catálogo) continua sem ser aumento", () => {
    const r = priceIncreaseAlerts({
      history: [
        { ingredient_id: "sal", unit_cost: 0, changed_at: "2026-03-01T10:00:00Z" },
        { ingredient_id: "sal", unit_cost: 0.002, changed_at: "2026-10-09T10:00:00Z" },
      ],
      names,
      recipesUsing: used,
      now,
    });
    expect(r).toEqual([]);
  });
});
