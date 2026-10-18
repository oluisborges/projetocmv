import { describe, expect, it } from "vitest";
import { boardRow, couponTone, coverageTone, marginTone, trendLabel } from "./network-board";
import type { NetworkClient } from "./network-view";

const now = new Date("2026-10-18T18:00:00Z");
const client = (over: Partial<NetworkClient> = {}): NetworkClient => ({
  id: "c1",
  name: "Marmita da Bela",
  hasMenu: true,
  month: { revenue: 10_000, orders: 50, menuRevenue: 10_000, manualRevenue: 0, discount: 400 },
  prev: { revenue: 14_000, orders: 0, menuRevenue: 0, manualRevenue: 0, discount: 0 },
  coverage: 0.9,
  unlinkedProducts: 2,
  margin: { avgContributionPct: 0.55, products: 10, priced: 10, incomplete: 0, realPct: 0.5 },
  setup: { ingredients: 40, recipes: 10, pricedRecipes: 10, fixedCosts: 4, staff: 2, settingsDone: true },
  ...over,
});

describe("rótulos do quadro de clientes", () => {
  it("tendência: seta, base de comparação e cor", () => {
    expect(trendLabel(0.12, "pace")).toEqual({ text: "↑ 12% no ritmo", tone: "good" });
    expect(trendLabel(-0.1, "closed")).toEqual({ text: "↓ 10% vs mês anterior", tone: "warn" });
    expect(trendLabel(-0.4, "pace").tone).toBe("bad");
    expect(trendLabel(null, "pace")).toEqual({ text: "—", tone: "none" });
  });

  it("cores das margens, cupons e vínculos", () => {
    expect([marginTone(0.3), marginTone(0.4), marginTone(0.5), marginTone(null)]).toEqual(["bad", "warn", "good", "none"]);
    expect([couponTone(0.12), couponTone(0.08), couponTone(0.02), couponTone(null)]).toEqual(["bad", "warn", "good", "none"]);
    expect([coverageTone(0.3), coverageTone(0.6), coverageTone(0.9), coverageTone(null)]).toEqual(["bad", "warn", "good", "none"]);
  });

  it("monta o cartão de um cliente completo", () => {
    const r = boardRow(client(), "2026-10-01", now);
    expect(r.revenue).toMatch(/10\.000,00/);
    expect(r.orders).toBe("50");
    expect(r.ticket).toMatch(/200,00/);
    expect(r.coupon).toBe("3,8%"); // 400 de 10.400
    expect(r.couponAmount).toMatch(/400,00 em cupons/);
    expect(r.margin).toBe("55%");
    expect(r.marginTone).toBe("good");
    expect(r.coverage).toBe("90%");
    expect(r.setupPct).toBe(1);
    expect(r.setupMissing).toBe("");
    expect(r.trend).toMatch(/^↑ 23% no ritmo/); // projeção 17.222 vs 14.000
  });

  it("cliente que ainda não montou nada mostra o que falta", () => {
    const r = boardRow(
      client({
        hasMenu: false,
        coverage: null,
        month: { revenue: 0, orders: 0, menuRevenue: 0, manualRevenue: 0, discount: 0 },
        prev: { revenue: 0, orders: 0, menuRevenue: 0, manualRevenue: 0, discount: 0 },
        margin: { avgContributionPct: null, products: 0, priced: 0, incomplete: 0, realPct: null },
        setup: { ingredients: 0, recipes: 0, pricedRecipes: 0, fixedCosts: 0, staff: 0, settingsDone: false },
      }),
      "2026-10-01",
      now,
    );
    expect(r.revenue).toBe("—");
    expect(r.margin).toBe("—");
    expect(r.setupPct).toBe(0);
    expect(r.setupMissing).toBe("insumos cadastrados, fichas técnicas, preços de venda, custos fixos e equipe, cardápio conectado");
    expect(r.coverageTone).toBe("none");
  });
});
