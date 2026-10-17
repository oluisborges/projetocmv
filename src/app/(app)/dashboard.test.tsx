import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Dashboard, DashboardDish } from "@/lib/dashboard-data";
import { analyzePrice } from "@/lib/pricing-view";
import { DashboardView } from "./dashboard";

const settings = { taxPct: 0.06, fixedExpensePct: 0.12, profitPct: 0.15, minMarginPct: 0.1 };

const dish = (id: string, name: string, cost: number, price: number | null): DashboardDish => ({
  id,
  name,
  cost,
  price,
  analysis: analyzePrice({ cost, settings, feePct: 0, price }),
});

function build(over: Partial<Dashboard> = {}): Dashboard {
  const dishes = [dish("a", "Frango grelhado", 7.51, 15), dish("b", "Strogonoff", 9.2, 10.5), dish("c", "Feijoada", 11, null)];
  const priced = dishes.filter((d) => d.analysis?.at);
  return {
    ctx: {
      unit: { id: "u", name: "Matriz" },
      settings,
      fixedAuto: true,
      fixedPctOfRevenue: 0.12,
      monthlyRevenue: 60000,
      monthlyUnits: 1400,
      revenueSource: "manual",
      revenueMonths: 0,
      estimate: false,
      estimateReason: null,
      fixedTotal: 7200,
      staffTotal: 4360,
      configured: true,
      channels: [{ id: "c1", name: "Venda direta", fee_pct: 0 }],
    },
    channelName: "Venda direta",
    menu: null,
    dishes,
    ingredientCount: 20,
    recipeCount: 3,
    withPriceCount: 2,
    pricedCount: priced.length,
    belowTarget: priced.filter((d) => d.analysis!.at!.status === "below-target"),
    avgNetPct: priced.reduce((s, d) => s + d.analysis!.at!.netPct, 0) / priced.length,
    month: {
      revenue: 60000,
      purchases: 18000,
      cmvRealPct: 0.3,
      cmvTheoreticalPct: 0.192,
      theoreticalCost: 11528,
      deviationPct: 0.108,
      deviationCost: 6472,
      cmoPct: 0.0727,
      cmoCost: 4360,
      salesWithoutCost: 0,
      soldUnits: 1400,
      start: "2026-10-01",
      hasData: true,
    },
    staleCount: 2,
    noPriceCount: 1,
    increases: [{ ingredientId: "i1", name: "Peito de frango", pct: 0.12, recipes: 3 }],
    panel: null,
    weighted: false,
    breakEven: null,
    ...over,
  };
}

describe("DashboardView", () => {
  it("mostra indicadores, alertas e o produto de pior lucro primeiro", () => {
    const html = renderToStaticMarkup(<DashboardView data={build()} />);
    expect(html).toContain("Lucro médio");
    expect(html).toContain("Abaixo da meta");
    expect(html).toContain("Gasto com insumos");
    expect(html).toContain("30%"); // CMV real
    expect(html).toContain("7,3%"); // CMO
    expect(html).toContain("Peito de frango subiu 12%");
    expect(html).toContain("afeta 3 produtos");
    expect(html).toContain("1 insumo sem preço");
    expect(html).toContain("2 preços de insumos sem atualizar");
    expect(html).toContain("Você gastou R$");
    // Strogonoff (preço 10,50) rende menos que o frango (preço 15): vem primeiro na lista
    expect(html.indexOf("Strogonoff")).toBeLessThan(html.indexOf("Frango grelhado"));
    // marmita sem preço não aparece no ranking
    expect(html).not.toContain("Feijoada");
  });

  it("sem nada a reclamar, diz que está tudo bem", () => {
    const base = build();
    const html = renderToStaticMarkup(
      <DashboardView
        data={build({ belowTarget: [], staleCount: 0, noPriceCount: 0, increases: [], month: { ...base.month, deviationPct: 0, deviationCost: 0 } })}
      />,
    );
    expect(html).toContain("Nada pedindo atenção agora");
  });

  it("enquanto os ajustes não foram salvos, o lucro aparece como estimativa", () => {
    const base = build();
    const html = renderToStaticMarkup(<DashboardView data={build({ ctx: { ...base.ctx, configured: false, estimate: true, estimateReason: "tax" } })} />);
    expect(html).toContain("Estimativa");
    expect(html).toContain("estimativa: faltam impostos");
  });

  it("mês sem números mostra traços e o caminho para informar", () => {
    const base = build();
    const html = renderToStaticMarkup(
      <DashboardView data={build({ month: { ...base.month, cmvRealPct: null, cmoPct: null, deviationPct: null, deviationCost: null, hasData: false } })} />,
    );
    expect(html).toContain("informe o mês em Custos");
    expect(html).toContain("equipe e faturamento em Custos");
  });
});
