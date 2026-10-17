import { describe, expect, it } from "vitest";
import { combineMonthTotals, estimateOutside, summarizeMenuMonth, type MenuLine } from "./index";

// Marmitaria de exemplo: imposto 6% + taxa do canal 0%, então 6% de variáveis.
const VARIABLE = 0.06;

const frango: MenuLine = { status: "linked", qty: 100, revenue: 1990, costPerSale: 8.5 }; // R$ 19,90 cada
const strogonoff: MenuLine = { status: "linked", qty: 50, revenue: 1095, costPerSale: 11.2 }; // R$ 21,90 cada
const kit10: MenuLine = { status: "linked", qty: 4, revenue: 800, costPerSale: 85, unitsPerSale: 10 }; // kit de 10 por R$ 200

describe("resumo do mês no cardápio", () => {
  it("lucro real = receita − custo − imposto, só das linhas com custo", () => {
    const m = summarizeMenuMonth([frango, strogonoff], VARIABLE);
    expect(m.linkedRevenue.toNumber()).toBe(3085);
    expect(m.cost.toNumber()).toBe(100 * 8.5 + 50 * 11.2); // 850 + 560 = 1410
    // 3085 − 1410 − 3085 × 6% = 1489,90
    expect(m.contribution.toDecimalPlaces(2).toNumber()).toBe(1489.9);
    expect(m.contributionPct!.toDecimalPlaces(4).toNumber()).toBe(0.4829);
    expect(m.linkedUnits.toNumber()).toBe(150);
  });

  it("kit de 10 conta 10 marmitas por venda", () => {
    const m = summarizeMenuMonth([kit10], VARIABLE);
    expect(m.linkedUnits.toNumber()).toBe(40);
    expect(m.cost.toNumber()).toBe(340);
  });

  it("vários produtos do cardápio vinculados à mesma ficha somam normalmente", () => {
    const m = summarizeMenuMonth(
      [
        { status: "linked", qty: 30, revenue: 597, costPerSale: 8.5 }, // "Frango grelhado"
        { status: "linked", qty: 20, revenue: 458, costPerSale: 8.5 }, // "Frango grelhado + arroz extra"
      ],
      0,
    );
    expect(m.cost.toNumber()).toBe(425);
    expect(m.linkedUnits.toNumber()).toBe(50);
  });

  it("sem vínculo entra na receita mas não na margem, e baixa a cobertura", () => {
    const m = summarizeMenuMonth([frango, { status: "unlinked", qty: 40, revenue: 1990 }], VARIABLE);
    expect(m.unlinkedRevenue.toNumber()).toBe(1990);
    expect(m.coverage!.toNumber()).toBe(0.5);
    expect(m.cost.toNumber()).toBe(850); // o sem vínculo não gera custo
  });

  it("ignorado (bebida) não conta na cobertura", () => {
    const m = summarizeMenuMonth([frango, { status: "ignored", qty: 80, revenue: 400 }], VARIABLE);
    expect(m.ignoredRevenue.toNumber()).toBe(400);
    expect(m.coverage!.toNumber()).toBe(1);
  });

  it("ficha incompleta fica fora da margem e é contada", () => {
    const m = summarizeMenuMonth([frango, { status: "linked", qty: 10, revenue: 250, costPerSale: null }], VARIABLE);
    expect(m.linesWithoutCost).toBe(1);
    expect(m.costedRevenue.toNumber()).toBe(1990);
    expect(m.linkedRevenue.toNumber()).toBe(2240);
  });

  it("mês sem vendas não divide por zero", () => {
    const m = summarizeMenuMonth([], VARIABLE);
    expect(m.coverage).toBeNull();
    expect(m.contributionPct).toBeNull();
    expect(m.contribution.toNumber()).toBe(0);
  });
});

describe("lucro estimado da venda por fora", () => {
  const menu = summarizeMenuMonth([frango, strogonoff], VARIABLE);

  it("aplica a margem do cardápio ao faturamento digitado", () => {
    const e = estimateOutside(6000, menu);
    expect(e.ok).toBe(true);
    if (e.ok) expect(e.contribution.toNumber()).toBe(2897.7); // 6000 × (1489,90 ÷ 3085)
  });

  it("não estima sem venda por fora", () => {
    expect(estimateOutside(0, menu)).toEqual({ ok: false, reason: "no-outside-revenue" });
  });

  it("não estima quando o cardápio ainda não tem vínculo suficiente", () => {
    const low = summarizeMenuMonth([frango, { status: "unlinked", qty: 100, revenue: 3000 }], VARIABLE);
    expect(estimateOutside(6000, low)).toEqual({ ok: false, reason: "low-coverage" });
  });

  it("não estima sem margem calculável", () => {
    expect(estimateOutside(6000, summarizeMenuMonth([], VARIABLE))).toEqual({ ok: false, reason: "no-margin" });
  });
});

describe("totais do mês", () => {
  it("cardápio + venda por fora", () => {
    const t = combineMonthTotals({ menuRevenue: 14000, menuUnits: 650, outsideRevenue: 6000, outsideUnits: 280 });
    expect(t.revenue.toNumber()).toBe(20000);
    expect(t.units.toNumber()).toBe(930);
  });
});
