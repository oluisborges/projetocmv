import { describe, expect, it } from "vitest";
import { buildFichaTecnica, type FichaIngredient, type FichaRecipeInput } from "./ficha-tecnica";
import { fichaToPdf, fichaToXlsx } from "./ficha-tecnica-export";

const ing = (id: string, name: string, kind: FichaIngredient["kind"], purchase_unit: string, unit_cost: number, correction_factor = 1, cooking_yield = 1): FichaIngredient => ({
  id, name, kind, purchase_unit, unit_cost, correction_factor, cooking_yield,
});

// Caso real de marmitaria (Hibiscus): Penne a bolonhesa, por unidade, com receitas e embalagem.
const ingredients = new Map<string, FichaIngredient>([
  ["penne", ing("penne", "Penne cozido", "receita", "g", 0.0044976)],
  ["carne", ing("carne", "Carne moída refogada", "receita", "g", 0.0375993)],
  ["molho", ing("molho", "Molho de tomate", "receita", "g", 0.0125157)],
  ["emb", ing("emb", "Embalagem", "embalagem", "un", 1.049)],
  ["adesivo", ing("adesivo", "Adesivo", "embalagem", "un", 0.154)],
  ["cebola", ing("cebola", "Cebola in natura", "insumo", "kg", 0.009, 1.089)],
  ["semPreco", ing("semPreco", "Sal grosso", "insumo", "kg", 0)],
]);

const penne: FichaRecipeInput = { id: "r1", kind: "marmita", name: "Penne a bolonhesa", category: "Carne", mode: "serving", portions: 1, portion_weight: null, portion_weight_unit: "g", cooking_loss_pct: 0 };
const items = [
  { ingredient_id: "penne", net_qty: 115, qty_unit: "g", scope: "batch" as const },
  { ingredient_id: "carne", net_qty: 120, qty_unit: "g", scope: "batch" as const },
  { ingredient_id: "molho", net_qty: 100, qty_unit: "g", scope: "batch" as const },
  { ingredient_id: "emb", net_qty: 1, qty_unit: "un", scope: "portion" as const },
  { ingredient_id: "adesivo", net_qty: 1, qty_unit: "un", scope: "portion" as const },
];

describe("ficha técnica", () => {
  it("marmita: custo dos ingredientes, embalagem, margem de segurança e CMV", () => {
    const f = buildFichaTecnica({ recipe: penne, items, ingredients, safetyMarginPct: 0.1, price: 24 });
    expect(f.lines.map((l) => l.name)).toEqual(["Carne moída refogada", "Molho de tomate", "Penne cozido"]); // mais caro primeiro
    expect(f.packaging.map((l) => l.name)).toEqual(["Embalagem", "Adesivo"]);
    expect(f.totals.ingredients).toBeCloseTo(0.517224 + 4.511917 + 1.25157, 3);
    expect(f.totals.packaging).toBeCloseTo(1.203, 3);
    expect(f.totals.total).toBeGreaterThan(f.totals.ingredients + f.totals.packaging); // com a margem
    expect(f.totals.safety).toBeGreaterThan(0);
    expect(f.portionWeight).toBe("335 g");
    expect(f.cmvPct).toBeCloseTo((f.totals.total as number) / 24, 5);
    expect(f.incomplete).toBe(false);
  });

  it("peso líquido, fator de correção e peso bruto de um insumo", () => {
    const f = buildFichaTecnica({
      recipe: penne,
      items: [{ ingredient_id: "cebola", net_qty: 336, qty_unit: "g", scope: "batch" }],
      ingredients,
      safetyMarginPct: 0,
      price: null,
    });
    const l = f.lines[0];
    expect(l.net).toBe("336 g");
    expect(l.factor).toBeCloseTo(1.089, 3);
    expect(l.gross).toBe("365,9 g");
    expect(l.cost).toBeCloseTo(0.009 * 336 * 1.089, 4);
  });

  it("insumo sem preço deixa a ficha incompleta e avisa", () => {
    const f = buildFichaTecnica({ recipe: penne, items: [...items, { ingredient_id: "semPreco", net_qty: 5, qty_unit: "g", scope: "batch" }], ingredients, safetyMarginPct: 0, price: null });
    expect(f.incomplete).toBe(true);
    expect(f.warnings.join(" ")).toContain("sem preço");
    expect(f.lines.find((l) => l.name === "Sal grosso")?.cost).toBeNull();
  });

  it("receita: rendimento, custo do lote e custo por kg", () => {
    const molho: FichaRecipeInput = { id: "r2", kind: "receita", name: "Molho de tomate", category: null, mode: "batch", portions: 1, portion_weight: 26000, portion_weight_unit: "kg", cooking_loss_pct: 0 };
    const f = buildFichaTecnica({ recipe: molho, items: [{ ingredient_id: "cebola", net_qty: 822, qty_unit: "g", scope: "batch" }], ingredients, safetyMarginPct: 0.1, price: null });
    expect(f.kind).toBe("receita");
    expect(f.receita?.yield).toBe("26 kg");
    expect(f.totals.total).toBeCloseTo(0.009 * 822 * 1.089, 4);
    expect(f.receita?.perUnit).toBeCloseTo(((0.009 * 822 * 1.089) / 26000) * 1000, 5);
    expect(f.receita?.perUnitLabel).toBe("Custo por kg");
  });

  it("gera o PDF e o Excel sem quebrar", async () => {
    const f = buildFichaTecnica({ recipe: penne, items, ingredients, safetyMarginPct: 0.1, price: 24 });
    const pdf = await fichaToPdf(f, "Hibiscus Gastronomia", new Date("2026-10-31T15:00:00Z"));
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    const xlsx = await fichaToXlsx(f, "Hibiscus Gastronomia", new Date("2026-10-31T15:00:00Z"));
    expect(xlsx.subarray(0, 2).toString()).toBe("PK");
  }, 30_000);
});
