import { describe, expect, it } from "vitest";
import { priceActions, priceForNetMargin } from "./price-actions";

const settings = { taxPct: 0.06, otherPct: 0, fixedExpensePct: 0.2, minMarginPct: 0.1 };

describe("preço que bate a meta", () => {
  it("custo ÷ (1 − impostos − taxas − fixas − meta)", () => {
    // 1 − 0,06 − 0 − 0,20 − 0,10 = 0,64 → 12 ÷ 0,64 = 18,75
    expect(priceForNetMargin(12, settings, 0)).toBeCloseTo(18.75, 4);
    // com 8% de taxa do canal: 0,56 → 12 ÷ 0,56
    expect(priceForNetMargin(12, settings, 0.08)).toBeCloseTo(21.4286, 3);
  });

  it("não fecha quando impostos, taxas e meta comem o preço", () => {
    expect(priceForNetMargin(12, { ...settings, fixedExpensePct: 0.8 }, 0)).toBeNull();
    expect(priceForNetMargin(0, settings, 0)).toBeNull();
  });
});

describe("ações de preço", () => {
  const dishes = [
    { id: "a", name: "Frango com arroz", cost: 12, price: 17, netPct: 0.04 },
    { id: "b", name: "Strogonoff", cost: 14, price: 29.9, netPct: 0.25 }, // acima da meta: fora
    { id: "c", name: "Feijoada", cost: 15, price: 20, netPct: 0.02 },
    { id: "d", name: "Sem preço", cost: 10, price: null, netPct: null },
  ];

  it("só lista marmitas abaixo da meta, com o preço arredondado para cima em R$ 0,50", () => {
    const r = priceActions({ dishes, settings, feePct: 0 });
    expect(r.map((x) => x.id).sort()).toEqual(["a", "c"]);
    const a = r.find((x) => x.id === "a")!;
    expect(a.targetPrice).toBe(19); // 18,75 → 19,00
    expect(a.rise).toBe(2);
    expect(a.risePct).toBeCloseTo(2 / 17, 4);
  });

  it("ordena por quanto rende por mês e calcula o ganho com as vendas", () => {
    const units = new Map([["a", 300], ["c", 90]]); // 3 meses
    const r = priceActions({ dishes, settings, feePct: 0, units, months: 3 });
    // a: (19−17) × 0,94 × 300 ÷ 3 = 188
    expect(r[0].id).toBe("a");
    expect(r[0].gainPerMonth).toBeCloseTo(188, 2);
    expect(r[1].id).toBe("c");
  });

  it("sem vendas, quem está mais longe da meta vem primeiro", () => {
    const r = priceActions({ dishes, settings, feePct: 0 });
    expect(r[0].id).toBe("c");
    expect(r[0].gainPerMonth).toBeNull();
  });

  it("respeita o limite", () => {
    expect(priceActions({ dishes, settings, feePct: 0, limit: 1 })).toHaveLength(1);
  });

  it("se o preço atual já passa do necessário, não sugere", () => {
    const r = priceActions({ dishes: [{ id: "x", name: "X", cost: 12, price: 19, netPct: 0.09 }], settings, feePct: 0 });
    expect(r).toEqual([]); // alvo 19,00 não é maior que o preço atual
  });
});
