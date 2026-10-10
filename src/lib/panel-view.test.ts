import { describe, expect, it } from "vitest";
import { summarizePanel } from "./panel-view";

const settings = { taxPct: 0.06, fixedExpensePct: 0.2, profitPct: 0.15, minMarginPct: 0.1 };

describe("summarizePanel", () => {
  it("sem marmita com custo e preço não há painel", () => {
    expect(summarizePanel({ dishes: [{ id: "a", name: "A", cost: 5, price: null }], settings, feePct: 0, staffShareOfFixed: 0 })).toBeNull();
  });

  it("a composição soma 100% e separa mão de obra das demais despesas fixas", () => {
    const r = summarizePanel({
      dishes: [
        { id: "a", name: "Frango", cost: 10, price: 25 },
        { id: "b", name: "Carne", cost: 15, price: 30 },
      ],
      settings,
      feePct: 0.05,
      staffShareOfFixed: 0.5,
    })!;
    const c = r.composition;
    expect(c.cmv + c.cmo + c.fixed + c.commercial + c.profit).toBeCloseTo(1, 10);
    expect(c.cmv).toBeCloseTo((10 / 25 + 15 / 30) / 2, 10); // 45%
    expect(c.cmo).toBeCloseTo(0.1, 10);
    expect(c.fixed).toBeCloseTo(0.1, 10);
    expect(c.commercial).toBeCloseTo(0.11, 10);
    expect(r.cmvRanking.map((d) => d.name)).toEqual(["Carne", "Frango"]);
  });
});
