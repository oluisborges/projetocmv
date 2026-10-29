import { describe, expect, it } from "vitest";
import { shoppingList } from "@/lib/calc";
import type { ProdIngredient } from "@/lib/production-data";
import { batchesLabel, buyRows, computeProduction, groupBySupplier, shoppingText, type ProductionInput } from "./production-view";

const ing = (name: string, over: Partial<ProdIngredient> = {}): ProdIngredient => ({ name, kind: "insumo", baseUnit: "g", purchaseUnit: "kg", unitCost: 0.02, packSize: 1000, packLabel: "1 kg", supplier: null, ...over });

describe("lista de compras na tela", () => {
  const ingredients = {
    patinho: ing("Patinho moído", { unitCost: 0.04 }),
    frango: ing("Peito de frango", { supplier: "Frigorífico Boi Bom", unitCost: 0.015 }),
    sal: ing("Sal", { packSize: 1000, packLabel: "1 kg", supplier: "Mercado" }),
    queijo: ing("Queijo muçarela", { unitCost: 0.05, packSize: 500, packLabel: "500 g" }),
  };

  it("do exemplo do print: precisa 20 kg, tem 8 kg, compra 12 kg", () => {
    const list = shoppingList(new Map([["patinho", 20_000]]), new Map([["patinho", 8000]]), new Map([["patinho", 1000]]));
    const { toBuy, enough } = buyRows(list, ingredients, () => true);
    expect(enough).toHaveLength(0);
    expect(toBuy[0]).toMatchObject({ name: "Patinho moído", need: "20 kg", stock: "8 kg", buy: "12 kg", packs: "12 pacotes de 1 kg" });
    expect(toBuy[0].cost).toBeCloseTo(12_000 * 0.04, 6);
  });

  it("o que o estoque já cobre vai para 'já tem'; estoque nunca contado aparece sem número", () => {
    const list = shoppingList(new Map([["frango", 5000], ["sal", 100]]), new Map([["frango", 9000]]), new Map([["frango", 1000], ["sal", 1000]]));
    const { toBuy, enough } = buyRows(list, ingredients, (id) => id === "frango");
    expect(enough.map((r) => r.name)).toEqual(["Peito de frango"]);
    expect(toBuy[0]).toMatchObject({ name: "Sal", stock: null, packs: "1 pacote de 1 kg" });
  });

  it("agrupa por fornecedor, com os sem fornecedor no fim", () => {
    const list = shoppingList(new Map([["frango", 5000], ["sal", 100], ["queijo", 1200]]), new Map(), new Map([["frango", 1000], ["sal", 1000], ["queijo", 500]]));
    const groups = groupBySupplier(buyRows(list, ingredients, () => false).toBuy);
    expect(groups.map((g) => g.supplier)).toEqual(["Frigorífico Boi Bom", "Mercado", "Sem fornecedor"]);
  });

  it("sem nenhum fornecedor cadastrado, um grupo só e sem título", () => {
    const list = shoppingList(new Map([["queijo", 600]]), new Map(), new Map([["queijo", 500]]));
    const groups = groupBySupplier(buyRows(list, ingredients, () => false).toBuy);
    expect(groups).toHaveLength(1);
    expect(groups[0].supplier).toBeNull();
  });

  it("texto para WhatsApp: título, fornecedor, itens e total", () => {
    const list = shoppingList(new Map([["frango", 5000], ["queijo", 1200]]), new Map(), new Map([["frango", 1000], ["queijo", 500]]));
    const rows = buyRows(list, ingredients, () => false).toBuy;
    const text = shoppingText("Compras da semana", rows, 99.5);
    expect(text).toContain("Compras da semana");
    expect(text).toContain("*Frigorífico Boi Bom*");
    expect(text).toContain("• Peito de frango: 5 pacotes de 1 kg (5 kg)");
    expect(text).toContain("• Queijo muçarela: 3 pacotes de 500 g (1,5 kg)");
    expect(text).toContain("Total estimado: R$");
  });

  it("lotes de receita no plural certo", () => {
    expect(batchesLabel(1)).toBe("1 lote");
    expect(batchesLabel(1.152)).toBe("1,15 lotes");
    expect(batchesLabel(3)).toBe("3 lotes");
  });
});

describe("conta da produção", () => {
  const base: ProductionInput = {
    recipes: [{ id: "esc", name: "Escondidinho", costPerPortion: 9.5, usage: { patinho: 150, arroz: 120 } }],
    ingredients: {
      patinho: ing("Patinho moído", { unitCost: 0.04 }),
      "arroz-cru": ing("Arroz", { unitCost: 0.005, packSize: 5000, packLabel: "5 kg" }),
      arroz: ing("Arroz Teste", { kind: "receita", packSize: null, packLabel: null, unitCost: 0.0024 }),
    },
    receitas: { arroz: { name: "Arroz Teste", base: "g" as const, readyGrams: 12_500, parts: [{ ingredientId: "arroz-cru", grossPerGram: 0.4 }] } },
    stock: { patinho: { balance: 8000, known: true, lastCountAt: "2026-10-20T12:00:00Z" } },
  };

  it("100 escondidinhos: 15 kg de patinho (tem 8), arroz em lote, custo da produção", () => {
    const c = computeProduction([{ recipeId: "esc", units: 100 }], base);
    expect(c.marmitas).toBe(100);
    expect(c.cost).toBeCloseTo(950, 6);
    expect(c.needs.receitas.get("arroz")!.grams).toBe(12_000);
    expect(c.rows.toBuy.map((r) => [r.name, r.buy])).toEqual([["Arroz", "5 kg"], ["Patinho moído", "7 kg"]]);
  });

  it("o que já foi marcado como comprado continua na lista (não some ao comprar)", () => {
    const bought = { patinho: 7000, "arroz-cru": 5000 };
    // o estoque já recebeu essas compras:
    const after: ProductionInput = { ...base, stock: { ...base.stock, patinho: { balance: 15_000, known: true, lastCountAt: null }, "arroz-cru": { balance: 5000, known: true, lastCountAt: null } } };
    const c = computeProduction([{ recipeId: "esc", units: 100 }], after, bought);
    expect(c.rows.toBuy.map((r) => r.name)).toEqual(["Arroz", "Patinho moído"]);
    expect(c.rows.enough).toHaveLength(0);
  });

  it("sem quantidades, nada a calcular", () => {
    expect(computeProduction([{ recipeId: "esc", units: 0 }], base).marmitas).toBe(0);
  });
});
