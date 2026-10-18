import { describe, expect, it } from "vitest";
import { engineerMenu, productsForShare, summarizeQuadrants, type EngineeringInput } from "./menu-engineering";

// Marmitaria de exemplo, 8% de impostos e taxas.
const VAR = 0.08;
const p = (id: string, units: number, paid: number, cost: number | null): EngineeringInput => ({ id, name: id, units, revenue: units * paid, cost });

const menu: EngineeringInput[] = [
  p("frango", 400, 19.9, 8.5), // popular, sobra bem (≈ 9,81/un)
  p("strogonoff", 300, 21.9, 14.5), // popular, sobra pouco (≈ 5,65/un)
  p("feijoada", 40, 27.9, 11), // pouco vendida, sobra bem (≈ 14,7/un)
  p("risoto", 30, 19.9, 15.5), // pouco vendido, sobra pouco (≈ 2,8/un)
  p("sopa", 230, 17.9, 7), // popular
];

describe("engenharia de cardápio", () => {
  const r = engineerMenu(menu, VAR);
  const by = (id: string) => r.products.find((x) => x.id === id)!;

  it("calcula quanto sobra por marmita e no total, já com impostos", () => {
    // frango: 19,90 − 8,50 − 19,90 × 8% = 9,808
    expect(by("frango").unitContribution).toBeCloseTo(9.808, 3);
    expect(by("frango").totalContribution).toBeCloseTo(9.808 * 400, 1);
    expect(by("frango").marginPct).toBeCloseTo(9.808 / 19.9, 4);
    expect(by("frango").paidPrice).toBeCloseTo(19.9, 5);
  });

  it("classifica nos quatro grupos", () => {
    expect(by("frango").quadrant).toBe("star");
    expect(by("strogonoff").quadrant).toBe("plowhorse");
    expect(by("feijoada").quadrant).toBe("puzzle");
    expect(by("risoto").quadrant).toBe("dog");
  });

  it("popularidade: corte de 70% da fatia média", () => {
    expect(r.popularityCut).toBeCloseTo(0.7 / 5, 5); // 5 produtos
    expect(by("feijoada").unitShare).toBeLessThan(r.popularityCut);
    expect(by("sopa").unitShare).toBeGreaterThan(r.popularityCut);
  });

  it("a régua da margem é a sobra média por marmita, ponderada pelas vendas", () => {
    const total = r.products.reduce((s, x) => s + x.totalContribution, 0);
    expect(r.avgUnitContribution).toBeCloseTo(total / 1000, 5);
    expect(r.totalUnits).toBe(1000);
  });

  it("ordena por lucro total e acumula (curva ABC)", () => {
    expect(r.products[0].id).toBe("frango");
    expect(r.products.at(-1)!.cumulativeShare).toBeCloseTo(1, 5);
    const shares = r.products.map((x) => x.cumulativeShare);
    expect([...shares].sort((a, b) => a - b)).toEqual(shares);
    expect(productsForShare(r, 0.5)).toBeLessThanOrEqual(2);
  });

  it("resume os grupos", () => {
    const s = summarizeQuadrants(r);
    expect(s.map((x) => x.quadrant)).toEqual(["star", "plowhorse", "puzzle", "dog"]);
    expect(s.reduce((n, x) => n + x.count, 0)).toBe(5);
    expect(s.reduce((n, x) => n + x.units, 0)).toBe(1000);
  });

  it("ficha sem custo ou sem venda não entra na classificação", () => {
    const x = engineerMenu([...menu, p("novo", 50, 20, null), p("parado", 0, 20, 8), { id: "semvalor", name: "semvalor", units: 10, revenue: 0, cost: 5 }], VAR);
    expect(x.products).toHaveLength(5);
    expect(x.unclassified.map((u) => u.id).sort()).toEqual(["novo", "semvalor"]);
  });

  it("cupom grande derruba o lucro: o mesmo produto pago a menos sobra menos", () => {
    const full = engineerMenu([p("a", 100, 20, 8)], VAR).products[0];
    const coupon = engineerMenu([p("a", 100, 18, 8)], VAR).products[0]; // pago 18 em vez de 20 (cupom de 10%)
    expect(full.unitContribution).toBeCloseTo(20 - 8 - 1.6, 5);
    expect(coupon.unitContribution).toBeCloseTo(18 - 8 - 1.44, 5);
    expect(coupon.marginPct).toBeLessThan(full.marginPct);
  });

  it("sem vendas, tudo vazio e sem divisão por zero", () => {
    const empty = engineerMenu([], VAR);
    expect(empty.products).toEqual([]);
    expect(empty.totalUnits).toBe(0);
    expect(empty.avgUnitContribution).toBe(0);
    expect(productsForShare(empty, 0.8)).toBe(0);
  });

  it("produto único é estrela (vende 100% e sobra a média)", () => {
    expect(engineerMenu([p("a", 10, 20, 8)], VAR).products[0].quadrant).toBe("star");
  });
});
