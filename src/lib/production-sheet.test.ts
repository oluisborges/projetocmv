import { describe, expect, it } from "vitest";
import type { Production, ProdIngredient, ProductionBase } from "@/lib/production-data";
import { buildProductionSheet } from "./production-sheet";

const ing = (name: string, over: Partial<ProdIngredient> = {}): ProdIngredient => ({ name, kind: "insumo", baseUnit: "g", purchaseUnit: "kg", unitCost: 0.02, packSize: 1000, packLabel: "1 kg", supplier: null, ...over });

const base: ProductionBase = {
  unitId: "u1",
  recipes: [
    { id: "esc", name: "Escondidinho", costPerPortion: 9.5, usage: { patinho: 150, arroz: 120 } },
    { id: "fil", name: "Filé de frango", costPerPortion: 8, usage: { frango: 180, arroz: 120 } },
  ],
  incomplete: [{ id: "novo", name: "Marmita nova" }],
  ingredients: {
    patinho: ing("Patinho moído", { unitCost: 0.04 }),
    frango: ing("Peito de frango", { unitCost: 0.015 }),
    "arroz-cru": ing("Arroz", { unitCost: 0.005, packSize: 5000, packLabel: "5 kg" }),
    arroz: ing("Arroz Teste", { kind: "receita", packSize: null, packLabel: null, unitCost: 0.0024 }),
  },
  receitas: { arroz: { name: "Arroz Teste", base: "g", readyGrams: 12_500, parts: [{ ingredientId: "arroz-cru", grossPerGram: 0.4 }] } },
  stock: { patinho: { balance: 8000, known: true, lastCountAt: "2026-10-20T12:00:00Z" } },
  finished: {},
  hasMenu: false,
};

const production = (items: Production["items"], over: Partial<Production> = {}): Production => ({
  id: "p1",
  name: null,
  plannedFor: "2026-11-09",
  weekStart: "2026-11-09",
  status: "draft",
  producedAt: null,
  createdAt: "2026-11-06T10:00:00Z",
  items,
  ...over,
});

describe("ficha de produção", () => {
  const items = [
    { recipeId: "esc", suggested: 80, planned: 100, produced: null },
    { recipeId: "fil", suggested: 60, planned: 50, produced: null },
    { recipeId: "novo", suggested: null, planned: 10, produced: null },
  ];
  const sheet = buildProductionSheet(production(items), base);

  it("produtos em ordem de quantidade, com o total de marmitas", () => {
    expect(sheet.products.map((p) => [p.name, p.units])).toEqual([["Escondidinho", 100], ["Filé de frango", 50]]);
    expect(sheet.units).toBe(150);
    expect(sheet.title).toBe("Produção de 09/11");
  });

  it("receita em lote vem com os insumos já multiplicados (150 marmitas × 120 g = 18 kg de arroz pronto)", () => {
    expect(sheet.receitas).toHaveLength(1);
    const r = sheet.receitas[0];
    expect(r.name).toBe("Arroz Teste");
    expect(r.ready).toBe("18 kg");
    expect(r.wholeBatches).toBe(2);
    expect(r.batches).toBe("1,44 lotes");
    expect(r.ingredients).toEqual([{ name: "Arroz", qty: "7,2 kg" }]);
  });

  it("compras: só o que falta, em embalagens inteiras (7,2 kg de arroz viram 2 pacotes de 5 kg), igual à tela de Produção", () => {
    expect(sheet.toBuy.map((r) => [r.name, r.buy])).toEqual([["Arroz", "10 kg"], ["Patinho moído", "7 kg"], ["Peito de frango", "9 kg"]]);
  });

  it("produto com a ficha incompleta fica de fora e é avisado", () => {
    expect(sheet.skipped).toEqual(["Marmita nova"]);
  });

  it("produção já feita é marcada e itens zerados não entram", () => {
    const done = buildProductionSheet(production([{ recipeId: "esc", suggested: null, planned: 0, produced: 0 }], { status: "produced", name: "Semana 2" }), base);
    expect(done.produced).toBe(true);
    expect(done.title).toBe("Semana 2");
    expect(done.products).toEqual([]);
    expect(done.receitas).toEqual([]);
  });
});
