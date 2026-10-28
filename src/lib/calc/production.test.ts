import { describe, expect, it } from "vitest";
import { finishedBalance, productionNeeds, shoppingList, stockBalance, type ReceitaBlueprint } from "./index";

// Insumos (ids curtos): arroz cru, sal, frango, cebola, queijo. Quantidades na unidade-base (g).
const arroz: ReceitaBlueprint = {
  // lote de arroz: 5 kg de arroz cru + 100 g de sal + 500 g de cebola (FC 1,1 já aplicado = 550 g) rendem 12,5 kg prontos
  readyGrams: 12_500,
  parts: [
    { ingredientId: "arroz-cru", grossPerGram: 5000 / 12_500 },
    { ingredientId: "sal", grossPerGram: 100 / 12_500 },
    { ingredientId: "cebola", grossPerGram: 550 / 12_500 },
  ],
};

describe("quanto produzir: o que a produção pede", () => {
  it("120 marmitas com 120 g de arroz pronto: 14,4 kg de arroz pronto = 1,15 lote e os insumos do lote", () => {
    const { ingredients, receitas } = productionNeeds([{ units: 120, perUnit: new Map([["arroz", 120], ["frango", 130]]) }], new Map([["arroz", arroz]]));
    expect(receitas.get("arroz")!.grams).toBe(14_400);
    expect(receitas.get("arroz")!.batches).toBeCloseTo(1.152, 6);
    expect(receitas.get("arroz")!.wholeBatches).toBe(2);
    expect(ingredients.get("arroz-cru")).toBeCloseTo(5760, 6); // 14,4 kg prontos gastam 5,76 kg de arroz cru
    expect(ingredients.get("sal")).toBeCloseTo(115.2, 6);
    expect(ingredients.get("frango")).toBe(15_600); // insumo direto: 130 g × 120
  });

  it("duas marmitas que usam a mesma receita somam os gramas", () => {
    const { receitas, ingredients } = productionNeeds(
      [
        { units: 100, perUnit: new Map([["arroz", 120]]) },
        { units: 50, perUnit: new Map([["arroz", 100], ["queijo", 30]]) },
      ],
      new Map([["arroz", arroz]]),
    );
    expect(receitas.get("arroz")!.grams).toBe(17_000);
    expect(ingredients.get("queijo")).toBe(1500);
  });

  it("quantidade zero ou negativa não pede nada", () => {
    const { ingredients } = productionNeeds([{ units: 0, perUnit: new Map([["frango", 130]]) }, { units: -5, perUnit: new Map([["frango", 130]]) }], new Map());
    expect(ingredients.size).toBe(0);
  });

  it("receita sem peso pronto informado não quebra: lotes zerados", () => {
    const { receitas } = productionNeeds([{ units: 10, perUnit: new Map([["x", 100]]) }], new Map([["x", { readyGrams: 0, parts: [] }]]));
    expect(receitas.get("x")).toEqual({ grams: 1000, batches: 0, wholeBatches: 0 });
  });
});

describe("lista de compras", () => {
  it("falta = pedido − estoque, em embalagens inteiras de compra", () => {
    const list = shoppingList(new Map([["arroz-cru", 5760], ["sal", 115.2], ["frango", 15_600]]), new Map([["arroz-cru", 1000], ["frango", 20_000]]), new Map([["arroz-cru", 5000], ["sal", 1000], ["frango", 1000]]));
    const by = Object.fromEntries(list.map((i) => [i.id, i]));
    expect(by["arroz-cru"].missing).toBe(4760);
    expect(by["arroz-cru"].packs).toBe(1); // um pacote de 5 kg cobre
    expect(by["arroz-cru"].buyQty).toBe(5000);
    expect(by["arroz-cru"].leftover).toBe(240);
    expect(by["sal"].packs).toBe(1);
    expect(by["frango"].missing).toBe(0); // estoque de sobra: não compra
    expect(by["frango"].packs).toBe(0);
    expect(by["frango"].buyQty).toBe(0);
  });

  it("insumo sem tamanho de embalagem compra exatamente o que falta; estoque negativo conta como zero", () => {
    const [i] = shoppingList(new Map([["x", 700]]), new Map([["x", -300]]), new Map());
    expect(i.stock).toBe(0);
    expect(i.packs).toBeNull();
    expect(i.buyQty).toBe(700);
  });

  it("não compra pacote a mais por erro de arredondamento", () => {
    const [i] = shoppingList(new Map([["x", 3 * 0.1 * 1000]]), new Map(), new Map([["x", 300]]));
    expect(i.packs).toBe(1);
  });
});

describe("saldo de estoque", () => {
  const at = (d: number) => `2026-10-${String(d).padStart(2, "0")}T12:00:00Z`;

  it("a última contagem manda; depois dela, soma as variações", () => {
    const b = stockBalance([
      { kind: "purchase", qty: 5000, at: at(1) },
      { kind: "count", qty: 3000, at: at(10) },
      { kind: "production", qty: -800, at: at(11) },
      { kind: "purchase", qty: 2000, at: at(12) },
      { kind: "waste", qty: -100, at: at(13) },
    ]);
    expect(b.balance).toBe(4100);
    expect(b.lastCountAt).toBe(at(10));
    expect(b.known).toBe(true);
  });

  it("sem contagem, parte de zero; sem movimento nenhum, o saldo é desconhecido", () => {
    expect(stockBalance([{ kind: "purchase", qty: 5000, at: at(1) }, { kind: "production", qty: -1200, at: at(2) }]).balance).toBe(3800);
    expect(stockBalance([])).toEqual({ balance: 0, lastCountAt: null, known: false });
  });

  it("uma nova contagem corrige o que o sistema achava (e ignora o que veio antes)", () => {
    const b = stockBalance([
      { kind: "count", qty: 10_000, at: at(1) },
      { kind: "production", qty: -9000, at: at(2) },
      { kind: "count", qty: 2500, at: at(3) },
    ]);
    expect(b.balance).toBe(2500);
  });

  it("marmitas prontas: contagem + produzidas − vendidas no cardápio desde então", () => {
    const b = finishedBalance([{ kind: "count", qty: 40, at: at(1) }, { kind: "produced", qty: 60, at: at(3) }], 55);
    expect(b.balance).toBe(45);
  });
});
