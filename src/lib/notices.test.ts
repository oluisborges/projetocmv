import { describe, expect, it } from "vitest";
import { buildNotices, type NoticesInput } from "./notices";

const base: NoticesInput = {
  increases: [],
  belowTarget: [],
  noPriceCount: 0,
  staleCount: 0,
  previousMonth: { label: "setembro", month: "2026-09", closed: true, soldOrRevenue: true },
  dayOfMonth: 15,
};

describe("buildNotices", () => {
  it("sem nada pendente, devolve lista vazia", () => {
    expect(buildNotices(base)).toEqual([]);
  });

  it("insumo que subiu mostra o percentual e quantas fichas afeta", () => {
    const [n] = buildNotices({ ...base, increases: [{ ingredientId: "i1", name: "Frango", pct: 0.142, recipes: 3 }] });
    expect(n).toMatchObject({ tone: "warn", title: "Frango subiu 14%", detail: "Afeta 3 fichas.", href: "/ingredientes" });
  });

  it("fala no singular com uma ficha e avisa quando nenhuma usa o insumo", () => {
    const [one, none] = buildNotices({
      ...base,
      increases: [
        { ingredientId: "a", name: "Arroz", pct: 0.08, recipes: 1 },
        { ingredientId: "b", name: "Alho", pct: 0.2, recipes: 0 },
      ],
    });
    expect(one.detail).toBe("Afeta 1 ficha.");
    expect(none.detail).toContain("Nenhuma ficha");
  });

  it("ignora aumento abaixo de 5%", () => {
    expect(buildNotices({ ...base, increases: [{ ingredientId: "i", name: "Sal", pct: 0.03, recipes: 2 }] })).toEqual([]);
  });

  it("marmitas abaixo da meta vêm primeiro (bad) e listam até 3 nomes", () => {
    const list = buildNotices({
      ...base,
      noPriceCount: 2,
      belowTarget: ["Strogonoff", "Feijoada", "Frango grelhado", "Escondidinho"],
    });
    expect(list[0]).toMatchObject({ tone: "bad", href: "/cardapio", title: "4 marmitas abaixo da meta de lucro" });
    expect(list[0].detail).toBe("Strogonoff, Feijoada, Frango grelhado…");
    expect(list[1].key).toBe("no-price");
  });

  it("uma marmita abaixo da meta fica no singular", () => {
    expect(buildNotices({ ...base, belowTarget: ["Feijoada"] })[0].title).toBe("1 marmita abaixo da meta de lucro");
  });

  it("mês anterior com movimento e sem faturamento: pede o fechamento só depois do dia 3", () => {
    const prev = { label: "setembro", month: "2026-09-01", closed: false, soldOrRevenue: true };
    expect(buildNotices({ ...base, previousMonth: prev, dayOfMonth: 3 })).toEqual([]);
    const [n] = buildNotices({ ...base, previousMonth: prev, dayOfMonth: 4 });
    expect(n).toMatchObject({ tone: "warn", title: "Feche setembro", href: "/financeiro/mes?mes=2026-09" });
  });

  it("mês anterior sem movimento ou já fechado não gera aviso", () => {
    expect(buildNotices({ ...base, dayOfMonth: 20, previousMonth: { label: "setembro", month: "2026-09", closed: false, soldOrRevenue: false } })).toEqual([]);
    expect(buildNotices({ ...base, dayOfMonth: 20, previousMonth: { label: "setembro", month: "2026-09", closed: true, soldOrRevenue: true } })).toEqual([]);
  });

  it("preço parado é só informativo e fica por último", () => {
    const list = buildNotices({ ...base, staleCount: 12, noPriceCount: 1 });
    expect(list.map((n) => n.key)).toEqual(["no-price", "stale"]);
    expect(list[1]).toMatchObject({ tone: "info", title: "12 preços parados há muito tempo" });
  });
});
