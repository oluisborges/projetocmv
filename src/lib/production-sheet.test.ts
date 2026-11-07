import { describe, expect, it } from "vitest";
import type { Production, ProdIngredient, ProductionBase } from "@/lib/production-data";
import { formatBRL } from "@/lib/format";
import { buildProductionSheet } from "./production-sheet";
import { SHEET_MODELOS, sheetFromParams } from "./production-sheet-config";
import { productionSheetToPdf } from "./production-sheet-export";

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
  minimums: {},
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

  it("custo por produto, compra estimada e preço por kg/un de cada item", () => {
    expect(sheet.products.map((p) => [p.name, p.cost])).toEqual([["Escondidinho", 950], ["Filé de frango", 400]]);
    expect(sheet.cost).toBeCloseTo(1350, 6);
    expect(sheet.toBuy.map((r) => [r.name, r.unitPrice])).toEqual([["Arroz", `${formatBRL(5)}/kg`], ["Patinho moído", `${formatBRL(40)}/kg`], ["Peito de frango", `${formatBRL(15)}/kg`]]);
    // arroz 10 kg × 5,00 + patinho 7 kg × 40,00 + frango 9 kg × 15,00
    expect(sheet.buyCost).toBeCloseTo(50 + 280 + 135, 6);
  });

  it("insumo sem preço fica sem valor por kg", () => {
    const free: ProductionBase = { ...base, ingredients: { ...base.ingredients, patinho: ing("Patinho moído", { unitCost: 0 }) } };
    expect(buildProductionSheet(production(items), free).toBuy.find((r) => r.name === "Patinho moído")?.unitPrice).toBeNull();
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

  it("PDF de cada modelo e de uma ordem personalizada sai sem quebrar", async () => {
    for (const m of SHEET_MODELOS) {
      const pdf = await productionSheetToPdf(sheet, "Hibiscus", new Date("2026-11-07T15:00:00Z"), m.config);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    }
    const custom = sheetFromParams("comprar,produzir", "precos,fornecedor,estoque,marcar,saiu,custoProduto,resumo");
    expect((await productionSheetToPdf(sheet, "Hibiscus", new Date("2026-11-07T15:00:00Z"), custom)).subarray(0, 4).toString()).toBe("%PDF");
    // só a lista de compras com preços é menor que a ficha completa
    const lista = await productionSheetToPdf(sheet, "Hibiscus", new Date("2026-11-07T15:00:00Z"), SHEET_MODELOS[0].config);
    const completa = await productionSheetToPdf(sheet, "Hibiscus", new Date("2026-11-07T15:00:00Z"), SHEET_MODELOS[1].config);
    expect(lista.length).toBeLessThanOrEqual(completa.length);
  }, 60_000);
});
