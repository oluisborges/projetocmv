import { describe, expect, it } from "vitest";
import { buildMenuMonth, usesMenu, menuProfit } from "./menu-view";
import { suggestLink } from "./menu/suggest";

const recipes = new Map([
  ["r-frango", { cost: 8.5 }],
  ["r-strog", { cost: 11.2 }],
  ["r-incompleta", { cost: null }],
]);
const combos = new Map([["c-semanal", { cost: 80, units: 10 }]]);

const products = [
  { id: "p1", recipe_id: "r-frango", combo_id: null, units_per_sale: 1, ignored: false },
  { id: "p2", recipe_id: "r-frango", combo_id: null, units_per_sale: 1, ignored: false }, // outro produto, mesma ficha
  { id: "p3", recipe_id: "r-strog", combo_id: null, units_per_sale: 2, ignored: false }, // "dupla" leva 2 marmitas
  { id: "p4", recipe_id: null, combo_id: "c-semanal", units_per_sale: 1, ignored: false },
  { id: "p5", recipe_id: null, combo_id: null, units_per_sale: 1, ignored: true }, // refrigerante
  { id: "p6", recipe_id: null, combo_id: null, units_per_sale: 1, ignored: false }, // novo, sem vínculo
  { id: "p7", recipe_id: "r-incompleta", combo_id: null, units_per_sale: 1, ignored: false },
];

describe("visão do mês no cardápio", () => {
  const view = buildMenuMonth({
    products,
    recipes,
    combos,
    variablePct: 0.06,
    sales: [
      { product_id: "p1", qty: 30, revenue: 597, net: 597 },
      { product_id: "p2", qty: 20, revenue: 458, net: 458 },
      { product_id: "p3", qty: 10, revenue: 400, net: 400 },
      { product_id: "p4", qty: 2, revenue: 380, net: 380 },
      { product_id: "p5", qty: 15, revenue: 90, net: 90 },
      { product_id: "p6", qty: 5, revenue: 120, net: 120 },
      { product_id: "p7", qty: 4, revenue: 80, net: 80 },
    ],
  });

  it("dois produtos na mesma ficha somam o custo", () => {
    // frango: 50 × 8,50 = 425; strog dupla: 10 × (11,20 × 2) = 224; combo: 2 × 80 = 160
    expect(view.summary.cost.toNumber()).toBe(425 + 224 + 160);
  });

  it("conta as marmitas: dupla = 2, combo = as do combo", () => {
    expect(view.summary.linkedUnits.toNumber()).toBe(50 + 20 + 20 + 4); // inclui as 4 da ficha incompleta
  });

  it("separa sem vínculo, ignorado e ficha incompleta", () => {
    expect(view.unlinkedProducts).toBe(1);
    expect(view.summary.unlinkedRevenue.toNumber()).toBe(120);
    expect(view.summary.ignoredRevenue.toNumber()).toBe(90);
    expect(view.summary.linesWithoutCost).toBe(1);
  });

  it("estima a venda por fora com a margem do cardápio quando a cobertura é boa", () => {
    const p = menuProfit(view, { typedRevenue: 5000, dishes: [], variablePct: 0.06 });
    expect(p.outside.ok).toBe(true);
    if (p.outside.ok) expect(p.outside.source).toBe("menu");
  });

  it("com quantidades por ficha, a venda por fora usa o preço cadastrado e o custo da ficha", () => {
    // 100 frango a R$ 19,90 (custo 8,50), 6% de impostos: sobram 19,90 - 8,50 - 1,194 = 10,206 por unidade
    const p = menuProfit(view, { typedRevenue: 5000, dishes: [{ qty: 100, price: 19.9, cost: 8.5 }], variablePct: 0.06 });
    expect(p.outside.ok).toBe(true);
    if (p.outside.ok) {
      expect(p.outside.source).toBe("mix");
      expect(p.outside.pct.toDecimalPlaces(4).toNumber()).toBe(0.5129); // 10,206 / 19,90
      expect(p.outside.contribution.toNumber()).toBe(2564.32); // 5000 × 51,29%
    }
    expect(p.outsideFromDishes).toBe(false); // o valor é o que ele digitou
  });

  it("sem valor digitado, a venda por fora vale quantidade × preço cadastrado", () => {
    const p = menuProfit(view, { typedRevenue: 0, dishes: [{ qty: 100, price: 19.9, cost: 8.5 }, { qty: 10, price: null, cost: 9 }], variablePct: 0.06 });
    expect(p.outsideRevenue).toBe(1990); // a ficha sem preço não entra
    expect(p.outsideFromDishes).toBe(true);
  });
});

describe("cupom de desconto (valor realmente pago)", () => {
  it("o lucro usa o valor pago, não o valor da linha", () => {
    // 10 marmitas a R$ 20 = R$ 200 na linha; o cupom do pedido tirou 10% => pagaram R$ 180. Custo 8,50 cada, sem impostos.
    const gross = buildMenuMonth({
      products: [{ id: "a", recipe_id: "r-frango", combo_id: null, units_per_sale: 1, ignored: false }],
      recipes,
      combos,
      variablePct: 0,
      sales: [{ product_id: "a", qty: 10, revenue: 200, net: 200 }],
    });
    const paid = buildMenuMonth({
      products: [{ id: "a", recipe_id: "r-frango", combo_id: null, units_per_sale: 1, ignored: false }],
      recipes,
      combos,
      variablePct: 0,
      sales: [{ product_id: "a", qty: 10, revenue: 200, net: 180 }],
    });
    expect(gross.summary.contribution.toNumber()).toBe(115); // 200 - 85
    expect(paid.summary.contribution.toNumber()).toBe(95); // 180 - 85
    expect(paid.summary.contributionPct!.toDecimalPlaces(4).toNumber()).toBe(0.5278);
  });
});

describe("usa o cardápio no mês?", () => {
  it("só com conexão e pedidos no mês", () => {
    expect(usesMenu(true, 120)).toBe(true);
    expect(usesMenu(true, 0)).toBe(false); // mês anterior à conexão: o digitado é o total
    expect(usesMenu(false, 120)).toBe(false);
  });
});

describe("sugestão de vínculo por nome", () => {
  const cands = [
    { id: "a", name: "Strogonoff de frango", kind: "recipe" as const },
    { id: "b", name: "Frango grelhado", kind: "recipe" as const },
    { id: "c", name: "Escondidinho de carne seca", kind: "recipe" as const },
    { id: "d", name: "Kit semanal", kind: "combo" as const },
  ];

  it("ignora peso e tamanho", () => {
    expect(suggestLink("Strogonoff de Frango 350g", cands)?.id).toBe("a");
    expect(suggestLink("FRANGO GRELHADO (marmita 300 g)", cands)?.id).toBe("b");
  });

  it("não chuta quando não parece com nada", () => {
    expect(suggestLink("Refrigerante lata 350ml", cands)).toBeNull();
    expect(suggestLink("Suco", cands)).toBeNull();
  });

  it("não escolhe quando duas fichas empatam", () => {
    const twin = [
      { id: "x", name: "Frango com batata", kind: "recipe" as const },
      { id: "y", name: "Frango com legumes", kind: "recipe" as const },
    ];
    expect(suggestLink("Frango", twin)).toBeNull();
  });

  it("nome vazio não sugere", () => {
    expect(suggestLink("", cands)).toBeNull();
    expect(suggestLink("350g", cands)).toBeNull();
  });
});
