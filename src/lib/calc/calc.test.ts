import { describe, expect, it } from "vitest";
import {
  ImpossiblePriceError,
  breakEven,
  cmo,
  cmvDeviation,
  cmvReal,
  cmvTheoretical,
  contributionMargin,
  fixedCostPerUnit,
  fixedExpensePct,
  fromBaseQty,
  grossQty,
  isCompatibleUnit,
  isPurchaseUnit,
  marginStatus,
  netMargin,
  netMarginPct,
  priceChangePct,
  recipeCost,
  suggestedPrice,
  toBaseQty,
  toCents,
  unitsFor,
  unitCost,
  type RecipeItem,
} from "./index";

describe("insumo", () => {
  it("custo por grama: frango a R$ 14,00 o kg", () => {
    expect(unitCost({ purchasePrice: 14, purchaseQty: 1, purchaseUnit: "kg" }).toString()).toBe("0.014");
  });

  it("custo por unidade: bandeja a R$ 90 o cento", () => {
    expect(unitCost({ purchasePrice: 90, purchaseQty: 100, purchaseUnit: "un" }).toString()).toBe("0.9");
  });

  it("converte litro para ml", () => {
    expect(unitCost({ purchasePrice: 9, purchaseQty: 0.9, purchaseUnit: "l" }).toString()).toBe("0.01");
  });

  it("quantidade bruta = líquida × FC", () => {
    expect(grossQty(10000, 1.15).toString()).toBe("11500");
  });

  it("recusa FC menor que 1", () => {
    expect(() => grossQty(100, 0.9)).toThrow(RangeError);
  });

  it("variação de preço: 10,00 → 10,80 = +8%", () => {
    expect(priceChangePct(10, 10.8).toString()).toBe("0.08");
  });
});

describe("ficha técnica: frango grelhado", () => {
  const frango: RecipeItem = {
    unitCost: 0.014,
    correctionFactor: 1.15,
    netQty: 10000,
    scope: "batch",
  };
  const embalagem: RecipeItem[] = [
    { unitCost: 0.9, correctionFactor: 1, netQty: 1, scope: "portion", countsForYield: false },
    { unitCost: 0.12, correctionFactor: 1, netQty: 1, scope: "portion", countsForYield: false },
    { unitCost: 0.05, correctionFactor: 1, netQty: 1, scope: "portion", countsForYield: false },
  ];

  it("10 kg líquidos, FC 1,15, perda de cocção 25%, porção de 300 g", () => {
    const r = recipeCost({
      items: [frango, ...embalagem],
      cookingLossPct: 0.25,
      portionWeight: 300,
    });
    expect(r.batchCost.toString()).toBe("161");
    expect(r.yieldWeight.toString()).toBe("7500");
    expect(r.portions.toString()).toBe("25");
    expect(r.ingredientCostPerPortion.toFixed(2)).toBe("6.44");
    expect(r.packagingCostPerPortion.toFixed(2)).toBe("1.07");
    expect(r.costPerPortion.toFixed(2)).toBe("7.51");
  });

  it("número de porções informado tem prioridade", () => {
    const arroz: RecipeItem = { unitCost: 0.006, correctionFactor: 1, netQty: 5000, scope: "batch" };
    const r = recipeCost({ items: [frango, arroz], portions: 40 });
    expect(r.costPerPortion.toFixed(3)).toBe("4.775");
  });

  it("exige porções ou peso da porção", () => {
    expect(() => recipeCost({ items: [frango] })).toThrow();
  });

  it("recusa perda de cocção de 100%", () => {
    expect(() => recipeCost({ items: [frango], cookingLossPct: 1, portions: 10 })).toThrow(RangeError);
  });
});

describe("precificação", () => {
  const rates = { taxPct: 0.06, salesFeePct: 0.05, fixedExpensePct: 0.12, profitPct: 0.15 };

  it("markup divisor: divisor 0,62 => custo 7,51 vira R$ 12,11", () => {
    expect(toCents(suggestedPrice(7.51, rates)).toString()).toBe("12.11");
  });

  it("margem de contribuição e margem líquida", () => {
    const price = suggestedPrice(7.51, rates);
    expect(contributionMargin(price, 7.51, rates).toFixed(2)).toBe("3.27");
    expect(netMargin(price, 7.51, rates).toFixed(2)).toBe("1.82");
    expect(netMarginPct(price, 7.51, rates).toFixed(4)).toBe("0.1500");
  });

  it("preço praticado abaixo do sugerido derruba a margem", () => {
    // vendendo a R$ 10,00: 10 − 7,51 − 1,10 − 1,20 = 0,19
    expect(netMargin(10, 7.51, rates).toFixed(2)).toBe("0.19");
  });

  it("soma de percentuais >= 100% é preço impossível", () => {
    expect(() => suggestedPrice(7.51, { ...rates, profitPct: 0.77 })).toThrow(ImpossiblePriceError);
  });

  it("despesa fixa rateada", () => {
    expect(fixedExpensePct(7200, 60000).toString()).toBe("0.12");
    expect(fixedCostPerUnit(7200, 1400).toFixed(2)).toBe("5.14");
    expect(fixedExpensePct(7200, 0).toString()).toBe("0");
  });

  it("semáforo da margem", () => {
    expect(marginStatus(0.1, 0.15)).toBe("below-target");
    expect(marginStatus(0.17, 0.15)).toBe("warning");
    expect(marginStatus(0.2, 0.15)).toBe("good");
  });
});

describe("CMV", () => {
  it("sem estoque: compras ÷ faturamento, marcado como aproximado", () => {
    const r = cmvReal({ purchases: 18000, revenue: 60000 });
    expect(r.pct.toString()).toBe("0.3");
    expect(r.approximate).toBe(true);
  });

  it("com estoque: (EI + compras − EF) ÷ faturamento", () => {
    const r = cmvReal({ purchases: 18000, revenue: 60000, openingStock: 4000, closingStock: 5000 });
    expect(r.cost.toString()).toBe("17000");
    expect(r.pct.toFixed(4)).toBe("0.2833");
    expect(r.approximate).toBe(false);
  });

  it("CMV teórico e desvio", () => {
    const t = cmvTheoretical(
      [
        { costPerPortion: 7.51, qtySold: 800 },
        { costPerPortion: 9.2, qtySold: 600 },
      ],
      60000,
    );
    expect(t.cost.toString()).toBe("11528");
    expect(t.pct.toFixed(4)).toBe("0.1921");
    expect(cmvDeviation(0.3, t.pct).toFixed(4)).toBe("0.1079");
  });

  it("faturamento zero não gera NaN", () => {
    expect(cmvReal({ purchases: 100, revenue: 0 }).pct.toString()).toBe("0");
  });
});

describe("CMO", () => {
  it("soma encargos e divide por área", () => {
    const r = cmo(
      [
        { area: "cozinha", monthlySalary: 2200, chargesPct: 0.3 },
        { area: "cozinha", monthlySalary: 1800, chargesPct: 0.3 },
        { area: "embalagem", monthlySalary: 1700, chargesPct: 0.3 },
        { area: "entrega", monthlySalary: 1500, chargesPct: 0 },
      ],
      60000,
    );
    expect(r.total.toString()).toBe("8910");
    expect(r.pct.toFixed(4)).toBe("0.1485");
    expect(r.byArea.cozinha.toString()).toBe("5200");
  });
});

describe("ponto de equilíbrio", () => {
  const mix = [
    { price: 12.11, margin: 3.27, qtySold: 800 },
    { price: 15, margin: 4, qtySold: 600 },
  ];

  it("faturamento e marmitas para cobrir R$ 9.000 de custos fixos", () => {
    const be = breakEven(9000, mix)!;
    expect(be.revenue.toFixed(2)).toBe("33531.10");
    expect(be.units.toString()).toBe("2512");
  });

  it("sem margem positiva não há ponto de equilíbrio", () => {
    expect(breakEven(9000, [{ price: 10, margin: -1, qtySold: 100 }])).toBeNull();
  });
});

describe("unidades de medida escolhidas pelo dono", () => {
  it("converte para a unidade-base e volta", () => {
    expect(toBaseQty(2, "kg").toString()).toBe("2000");
    expect(toBaseQty(0.5, "l").toString()).toBe("500");
    expect(toBaseQty(300, "g").toString()).toBe("300");
    expect(fromBaseQty(1500, "kg").toString()).toBe("1.5");
    expect(fromBaseQty(250, "l").toString()).toBe("0.25");
    expect(fromBaseQty(toBaseQty(0.75, "kg"), "kg").toString()).toBe("0.75");
  });

  it("só oferece unidades que medem a mesma coisa", () => {
    expect(unitsFor("g")).toEqual(["g", "kg"]);
    expect(unitsFor("ml")).toEqual(["ml", "l"]);
    expect(unitsFor("un")).toEqual(["un"]);
    expect(isCompatibleUnit("kg", "g")).toBe(true);
    expect(isCompatibleUnit("l", "g")).toBe(false);
    expect(isCompatibleUnit("un", "ml")).toBe(false);
    expect(isPurchaseUnit("kg")).toBe(true);
    expect(isPurchaseUnit("colher")).toBe(false);
    expect(isPurchaseUnit("toString")).toBe(false);
  });

  it("meio quilo de frango custa o mesmo que 500 g", () => {
    const cost = (qty: number, unit: "g" | "kg") => toBaseQty(qty, unit).mul(0.014).toFixed(2);
    expect(cost(0.5, "kg")).toBe(cost(500, "g"));
  });
});

describe("rendimento depois de pronto (ficha por marmita)", () => {
  const arroz = { unitCost: 0.006, correctionFactor: 1 }; // R$ 6,00 o kg, cru

  it("150 g de arroz COZIDO custam o preço de 60 g crus (rende 250%), não de 150 g", () => {
    const r = recipeCost({
      items: [{ ...arroz, netQty: 150, scope: "batch", cookingYield: 2.5 }],
      portions: 1,
    });
    expect(r.costPerPortion.toFixed(2)).toBe("0.36"); // 60 g × R$ 0,006
    const semRendimento = recipeCost({ items: [{ ...arroz, netQty: 150, scope: "batch" }], portions: 1 });
    expect(semRendimento.costPerPortion.toFixed(2)).toBe("0.90"); // o erro que o rendimento evita: 2,5× mais caro
  });

  it("frango grelhado rende 75%: 120 g prontos pedem 160 g crus limpos, e o fator de correção entra por cima", () => {
    // 120 / 0,75 = 160 g cru limpo; × FC 1,15 = 184 g comprados; × R$ 0,014 = R$ 2,576
    const r = recipeCost({
      items: [{ unitCost: 0.014, correctionFactor: 1.15, netQty: 120, scope: "batch", cookingYield: 0.75 }],
      portions: 1,
    });
    expect(r.costPerPortion.toFixed(3)).toBe("2.576");
  });

  it("embalagem por porção não passa pelo rendimento", () => {
    const r = recipeCost({
      items: [{ unitCost: 0.9, correctionFactor: 1, netQty: 1, scope: "portion", countsForYield: false, cookingYield: 1 }],
      portions: 1,
    });
    expect(r.costPerPortion.toFixed(2)).toBe("0.90");
  });

  it("rendimento zero ou negativo é recusado", () => {
    expect(() => recipeCost({ items: [{ ...arroz, netQty: 100, scope: "batch", cookingYield: 0 }], portions: 1 })).toThrow(RangeError);
  });
});
