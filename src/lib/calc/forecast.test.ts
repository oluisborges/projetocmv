import { describe, expect, it } from "vitest";
import { suggestProduction, topSellers } from "./index";

describe("sugestão de produção da semana", () => {
  it("vendas estáveis: a sugestão fica na média, arredondada em múltiplos de 5", () => {
    const s = suggestProduction({ weekly: [40, 38, 42, 40], finished: null });
    // média ponderada 40,2 com tendência de +5%: demanda 41, produz 45 (múltiplo de 5)
    expect(s.forecast).toBe(41);
    expect(s.toProduce).toBe(45);
    expect(s.confidence).toBe("ok");
    expect(s.weeksWithSales).toBe(4);
  });

  it("semana recente pesa mais: média ponderada puxa para as últimas vendas", () => {
    const s = suggestProduction({ weekly: [20, 20, 40, 40], finished: null });
    // (20×1 + 20×2 + 40×3 + 40×4) / 10 = 34 ; tendência +100% limitada a +25% × 0,5
    expect(s.average).toBeCloseTo(34, 6);
    expect(s.trendPct).toBeCloseTo(1, 6);
    expect(s.forecast).toBe(38); // 34 × 1,125 = 38,25
  });

  it("queda forte também é limitada: nunca mais que −12,5%", () => {
    const s = suggestProduction({ weekly: [60, 60, 10, 10], finished: null });
    expect(s.forecast).toBe(Math.round(s.average * 0.875));
  });

  it("desconta as marmitas prontas no congelador", () => {
    const s = suggestProduction({ weekly: [40, 40, 40, 40], finished: 25 });
    expect(s.forecast).toBe(40);
    expect(s.toProduce).toBe(15);
  });

  it("congelador cheio: não produz nada", () => {
    expect(suggestProduction({ weekly: [30, 30, 30, 30], finished: 100 }).toProduce).toBe(0);
  });

  it("semanas antes da primeira venda não puxam a média para baixo", () => {
    const s = suggestProduction({ weekly: [0, 0, 30, 30], finished: null });
    expect(s.weeks).toBe(2);
    expect(s.average).toBe(30);
    expect(s.confidence).toBe("low"); // só 2 semanas de histórico
  });

  it("sem nenhuma venda, sugere zero e diz que não há base", () => {
    expect(suggestProduction({ weekly: [0, 0, 0, 0], finished: null })).toMatchObject({ forecast: 0, toProduce: 0, confidence: "none" });
    expect(suggestProduction({ weekly: [], finished: 5 }).confidence).toBe("none");
  });

  it("quantidades pequenas não são arredondadas de 5 em 5", () => {
    expect(suggestProduction({ weekly: [3, 4, 3, 4], finished: null }).toProduce).toBe(4);
  });
});

describe("as mais vendidas", () => {
  it("as que somam 80% da demanda", () => {
    const top = topSellers([
      { id: "escondidinho", forecast: 50 },
      { id: "strogonoff", forecast: 30 },
      { id: "fricasse", forecast: 12 },
      { id: "brasileirinho", forecast: 8 },
    ]);
    expect([...top]).toEqual(["escondidinho", "strogonoff"]);
  });

  it("sem demanda, ninguém é destaque", () => {
    expect(topSellers([{ id: "a", forecast: 0 }]).size).toBe(0);
  });
});
