import { describe, expect, it } from "vitest";
import {
  buildInsights,
  contributionSummary,
  couponPct,
  elapsedFraction,
  projectRevenue,
  realMargin,
  revenueTrend,
  setupScore,
  setupSteps,
  sortClients,
  summarizeNetwork,
  ticket,
  type ClientMonth,
  type NetworkClient,
} from "./network-view";

// 18/10/2026 15:00 em Brasília = 18/10 18:00 UTC: dia 18 de 31
const now = new Date("2026-10-18T18:00:00Z");
const MONTH = "2026-10-01";

const month = (over: Partial<ClientMonth> = {}): ClientMonth => ({ revenue: 0, orders: 0, menuRevenue: 0, manualRevenue: 0, discount: 0, ...over });
const client = (over: Partial<NetworkClient> = {}): NetworkClient => ({
  id: "c1",
  name: "Marmita da Bela",
  hasMenu: true,
  month: month({ revenue: 10_000, orders: 50, menuRevenue: 10_000, discount: 400 }),
  prev: month({ revenue: 14_000 }),
  coverage: 0.9,
  unlinkedProducts: 2,
  margin: { avgContributionPct: 0.55, products: 10, priced: 10, incomplete: 0, realPct: 0.5 },
  setup: { ingredients: 40, recipes: 10, pricedRecipes: 10, fixedCosts: 4, staff: 2, settingsDone: true },
  ...over,
});

describe("ritmo do mês", () => {
  it("fração do mês passada", () => {
    expect(elapsedFraction("2026-09-01", now)).toBe(1); // mês fechado
    expect(elapsedFraction("2026-11-01", now)).toBe(0); // futuro
    expect(elapsedFraction(MONTH, now)).toBeCloseTo(18 / 31, 5);
  });

  it("usa o dia de Brasília: 01/11 01:00 UTC ainda é 31/10", () => {
    expect(elapsedFraction("2026-10-01", new Date("2026-11-01T01:00:00Z"))).toBe(1);
  });

  it("projeta o faturamento do mês em andamento", () => {
    expect(projectRevenue(10_000, 18 / 31)).toBeCloseTo(17_222.2, 0);
    expect(projectRevenue(10_000, 1)).toBe(10_000);
  });

  it("cedo demais no mês não projeta", () => {
    expect(projectRevenue(500, 3 / 31)).toBeNull();
  });

  it("variação compara a projeção com o mês anterior (não parece queda)", () => {
    const t = revenueTrend(month({ revenue: 10_000 }), month({ revenue: 14_000 }), MONTH, now);
    expect(t.basis).toBe("pace");
    expect(t.pct).toBeCloseTo(17_222.2 / 14_000 - 1, 2); // ~ +23%, e não -29%
  });

  it("mês fechado compara o faturamento real", () => {
    const t = revenueTrend(month({ revenue: 7_000 }), month({ revenue: 14_000 }), "2026-09-01", now);
    expect(t).toEqual({ pct: -0.5, projected: 7_000, basis: "closed" });
  });

  it("sem mês anterior não há variação", () => {
    expect(revenueTrend(month({ revenue: 5_000 }), month(), MONTH, now).pct).toBeNull();
  });
});

describe("cupom e ticket", () => {
  it("cupom sobre o que seria vendido sem ele", () => {
    expect(couponPct(month({ menuRevenue: 9_600, discount: 400 }))).toBeCloseTo(0.04, 5);
    expect(couponPct(month())).toBeNull();
  });
  it("ticket médio do cardápio", () => {
    expect(ticket(month({ menuRevenue: 10_000, orders: 50 }))).toBe(200);
    expect(ticket(month())).toBeNull();
  });
});

describe("margens", () => {
  const rates = { taxPct: 0.06, feePct: 0, otherPct: 0.02 };

  it("margem de contribuição: (preço − custo − impostos) ÷ preço, média simples", () => {
    // frango 19,90 custo 8,50: (19,90 − 8,50 − 1,592) / 19,90 = 49,3%; strogonoff 21,90 custo 11,20: (21,90 − 11,20 − 1,752) / 21,90 = 40,9%
    const m = contributionSummary(
      [
        { id: "a", cost: 8.5, price: 19.9 },
        { id: "b", cost: 11.2, price: 21.9 },
        { id: "x", cost: null, price: 25 }, // ficha incompleta: fora
        { id: "y", cost: 9, price: null }, // sem preço: fora
      ],
      rates,
    );
    expect(m).toBeCloseTo((0.4929 + 0.4086) / 2, 3);
  });

  it("pesa pelas vendas quando existem", () => {
    const rec = [
      { id: "a", cost: 8.5, price: 19.9 },
      { id: "b", cost: 11.2, price: 21.9 },
    ];
    const weighted = contributionSummary(rec, rates, new Map([["a", 90], ["b", 10]]))!;
    const plain = contributionSummary(rec, rates)!;
    expect(weighted).toBeGreaterThan(plain); // o produto de melhor margem vende mais
  });

  it("sem produto com custo e preço, não há margem", () => {
    expect(contributionSummary([{ id: "a", cost: null, price: 10 }], rates)).toBeNull();
  });

  it("margem real das vendas: valor pago − custo − impostos", () => {
    // 100 marmitas pagas a R$ 1.900 no total (19 cada, já com cupom), custo 8,50: (1900 − 850 − 152) / 1900
    const r = realMargin([{ recipeId: "a", units: 100, net: 1900 }], new Map([["a", 8.5]]), rates);
    expect(r).toBeCloseTo((1900 - 850 - 1900 * 0.08) / 1900, 5);
  });

  it("ficha sem custo fica fora da margem real", () => {
    expect(realMargin([{ recipeId: "a", units: 10, net: 200 }], new Map([["a", null]]), rates)).toBeNull();
  });
});

describe("adoção", () => {
  it("passos e nota", () => {
    const full = client();
    expect(setupSteps(full).every((s) => s.done)).toBe(true);
    expect(setupScore(full)).toBe(1);
    const empty = client({ hasMenu: false, coverage: null, setup: { ingredients: 0, recipes: 0, pricedRecipes: 0, fixedCosts: 0, staff: 0, settingsDone: false } });
    expect(setupSteps(empty)).toHaveLength(5); // sem cardápio, não pede vínculo
    expect(setupScore(empty)).toBe(0);
  });

  it("vínculo só conta como feito com 70% ou mais", () => {
    expect(setupSteps(client({ coverage: 0.5 })).find((s) => s.key === "links")!.done).toBe(false);
    expect(setupSteps(client({ coverage: 0.7 })).find((s) => s.key === "links")!.done).toBe(true);
  });
});

describe("alertas", () => {
  const keys = (cs: NetworkClient[]) => buildInsights(cs, MONTH, now).map((i) => `${i.name}:${i.key}`);

  it("cliente saudável não gera alerta", () => {
    expect(keys([client({ month: month({ revenue: 10_000, orders: 50, menuRevenue: 10_000, discount: 100 }) })])).toEqual([]);
  });

  it("queda forte no ritmo atual", () => {
    const c = client({ month: month({ revenue: 4_000, orders: 20, menuRevenue: 4_000 }), prev: month({ revenue: 14_000 }) });
    expect(keys([c])).toContain("Marmita da Bela:drop");
  });

  it("queda pequena ou mês anterior pequeno não alerta", () => {
    expect(keys([client({ month: month({ revenue: 9_000, orders: 40, menuRevenue: 9_000 }), prev: month({ revenue: 14_000 }) })])).not.toContain("Marmita da Bela:drop");
    expect(keys([client({ month: month({ revenue: 10, orders: 1, menuRevenue: 10 }), prev: month({ revenue: 500 }) })])).not.toContain("Marmita da Bela:drop");
  });

  it("cardápio conectado sem pedidos no meio do mês", () => {
    expect(keys([client({ month: month(), prev: month() })])).toContain("Marmita da Bela:no-sales");
  });

  it("margem baixa, cupom alto e vínculos baixos", () => {
    const c = client({
      month: month({ revenue: 10_000, orders: 50, menuRevenue: 10_000, discount: 1_500 }),
      margin: { avgContributionPct: 0.28, products: 5, priced: 5, incomplete: 0, realPct: 0.2 },
      coverage: 0.3,
      unlinkedProducts: 40,
    });
    expect(keys([c])).toEqual(expect.arrayContaining(["Marmita da Bela:low-margin", "Marmita da Bela:coupon", "Marmita da Bela:links"]));
  });

  it("cliente novo: sem fichas, depois sem preço, depois sem custos fixos", () => {
    const base = { hasMenu: false, coverage: null, month: month(), prev: month() };
    expect(keys([client({ ...base, setup: { ingredients: 0, recipes: 0, pricedRecipes: 0, fixedCosts: 0, staff: 0, settingsDone: false } })])).toEqual(["Marmita da Bela:no-recipes"]);
    expect(keys([client({ ...base, setup: { ingredients: 5, recipes: 3, pricedRecipes: 0, fixedCosts: 0, staff: 0, settingsDone: false } })])).toEqual(["Marmita da Bela:no-prices", "Marmita da Bela:no-fixed"]);
  });

  it("avisos vêm antes dos informativos; dentro de cada grupo, o maior faturamento primeiro", () => {
    const a = client({ id: "a", name: "A", month: month({ revenue: 1_000, orders: 5, menuRevenue: 1_000, discount: 400 }), prev: month() });
    const b = client({ id: "b", name: "B", month: month({ revenue: 9_000, orders: 40, menuRevenue: 9_000, discount: 2_000 }), prev: month() });
    const c = client({ id: "c", name: "C", hasMenu: false, coverage: null, month: month(), prev: month(), setup: { ingredients: 0, recipes: 0, pricedRecipes: 0, fixedCosts: 0, staff: 0, settingsDone: false } });
    expect(keys([c, a, b])).toEqual(["B:coupon", "A:coupon", "C:no-recipes"]);
  });
});

describe("rede", () => {
  const a = client({ id: "a", month: month({ revenue: 10_000, orders: 50, menuRevenue: 10_000, discount: 500 }), prev: month({ revenue: 12_000 }), margin: { avgContributionPct: 0.5, products: 4, priced: 4, incomplete: 0, realPct: null } });
  const b = client({ id: "b", name: "Outra", month: month({ revenue: 6_000, orders: 30, menuRevenue: 5_000, manualRevenue: 1_000, discount: 100 }), prev: month({ revenue: 5_000 }), margin: { avgContributionPct: 0.4, products: 4, priced: 4, incomplete: 0, realPct: null } });
  const dead = client({ id: "d", name: "Parada", hasMenu: false, month: month(), prev: month(), margin: { avgContributionPct: null, products: 0, priced: 0, incomplete: 0, realPct: null } });

  it("soma o faturamento e os pedidos, e calcula ticket e cupom da rede", () => {
    const t = summarizeNetwork([a, b, dead], MONTH, now);
    expect(t.revenue).toBe(16_000);
    expect(t.orders).toBe(80);
    expect(t.ticket).toBeCloseTo(15_000 / 80, 5);
    expect(t.couponPct).toBeCloseTo(600 / 15_600, 5);
    expect(t.clients).toBe(3);
    expect(t.activeClients).toBe(2);
    expect(t.withMenu).toBe(2);
    expect(t.avgContributionPct).toBeCloseTo(0.45, 5);
    expect(t.marginClients).toBe(2);
  });

  it("ordenações: quem mais precisa de atenção primeiro", () => {
    const names = (cs: NetworkClient[]) => cs.map((c) => c.name);
    expect(names(sortClients([a, b, dead], "revenue", MONTH, now))).toEqual(["Marmita da Bela", "Outra", "Parada"]);
    expect(names(sortClients([a, b, dead], "margin", MONTH, now))).toEqual(["Outra", "Marmita da Bela", "Parada"]);
    expect(names(sortClients([b, dead, a], "name", MONTH, now))).toEqual(["Marmita da Bela", "Outra", "Parada"]);
    expect(names(sortClients([a, b, dead], "setup", MONTH, now))[0]).toBe("Parada");
  });
});
