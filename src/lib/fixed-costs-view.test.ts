import { describe, expect, it } from "vitest";
import { summarizeFixedCosts } from "./fixed-costs-view";

const base = {
  fixedCosts: [1500, 800, 200], // aluguel, energia dos freezers, sistema
  staff: [
    { area: "cozinha" as const, monthlySalary: 2200, chargesPct: 0.3 }, // 2.860
    { area: "entrega" as const, monthlySalary: 1500, chargesPct: 0 }, // 1.500
  ],
  monthlyRevenue: 60000,
  monthlyUnits: 1400,
  dishes: [{ price: 15, cost: 7.51 }],
  taxPct: 0.06,
  feePct: 0,
};

describe("summarizeFixedCosts", () => {
  it("soma custos fixos e equipe com encargos", () => {
    const r = summarizeFixedCosts(base);
    expect(r.fixedTotal).toBe(2500);
    expect(r.staffTotal).toBe(4360);
    expect(r.total).toBe(6860);
  });

  it("custo fixo por marmita e percentual do faturamento", () => {
    const r = summarizeFixedCosts(base);
    expect(r.perUnit).toBeCloseTo(4.9, 4); // 6.860 / 1.400
    expect(r.pctOfRevenue).toBeCloseTo(0.11433, 4); // 6.860 / 60.000
  });

  it("ponto de equilíbrio: marmita de R$ 15 com custo 7,51 e 6% de imposto", () => {
    const r = summarizeFixedCosts(base);
    // contribuição = 15 - 7,51 - 0,90 = 6,59 por marmita
    expect(r.breakEven!.avgContribution).toBeCloseTo(6.59, 2);
    expect(r.breakEven!.units).toBe(1041); // ceil(6.860 / 6,59)
    expect(r.breakEven!.revenue).toBeCloseTo(15614.57, 2);
    expect(r.breakEven!.perDay).toBe(35); // ceil(1.041 / 30)
  });

  it("sem faturamento ou marmitas por mês, não inventa percentual nem custo por marmita", () => {
    const r = summarizeFixedCosts({ ...base, monthlyRevenue: null, monthlyUnits: null });
    expect(r.perUnit).toBeNull();
    expect(r.pctOfRevenue).toBeNull();
    expect(r.total).toBe(6860);
  });

  it("sem preço nas marmitas não há ponto de equilíbrio", () => {
    expect(summarizeFixedCosts({ ...base, dishes: [] }).breakEven).toBeNull();
    expect(summarizeFixedCosts({ ...base, dishes: [{ price: 0, cost: 7.51 }] }).breakEven).toBeNull();
  });

  it("marmita que perde dinheiro em cada venda: nunca empata", () => {
    expect(summarizeFixedCosts({ ...base, dishes: [{ price: 7, cost: 7.51 }] }).breakEven).toBeNull();
  });

  it("sem custos fixos não há o que cobrir", () => {
    const r = summarizeFixedCosts({ ...base, fixedCosts: [], staff: [] });
    expect(r.total).toBe(0);
    expect(r.perUnit).toBeNull();
    expect(r.breakEven).toBeNull();
  });

  it("canal com taxa maior exige vender mais para empatar", () => {
    const direct = summarizeFixedCosts(base).breakEven!.units;
    const delivery = summarizeFixedCosts({ ...base, feePct: 0.27 }).breakEven!.units;
    expect(delivery).toBeGreaterThan(direct);
  });
});

describe("ponto de equilíbrio com vendas", () => {
  it("pesa pelo que cada produto vende: o campeão de margem baixa empurra o equilíbrio para cima", () => {
    const base = { fixedCosts: [3000], staff: [], monthlyRevenue: null, monthlyUnits: null, taxPct: 0, feePct: 0 };
    const equal = summarizeFixedCosts({ ...base, dishes: [{ price: 20, cost: 10 }, { price: 20, cost: 18 }] }).breakEven!;
    const weighted = summarizeFixedCosts({ ...base, dishes: [{ price: 20, cost: 10, qty: 10 }, { price: 20, cost: 18, qty: 90 }] }).breakEven!;
    // margens: R$ 10 e R$ 2. Igual: média R$ 6 -> 500 un. Pesado (10/90): média R$ 2,80 -> ~1.071 un.
    expect(equal.units).toBeCloseTo(500, 6);
    expect(weighted.units).toBe(1072); // 3000 ÷ 2,80 = 1.071,4, arredondado para cima
  });
});
