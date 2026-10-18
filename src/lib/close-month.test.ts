import { describe, expect, it } from "vitest";
import { closeMonthChecklist } from "./close-month";

const full = {
  month: "2026-09-01",
  connected: true,
  menuOrders: 420,
  menuRevenue: 38120,
  purchases: 14200,
  purchasesFromNfe: 9800,
  outsideRevenue: 0,
  prevOutsideRevenue: 3500,
  hasFixedCosts: true,
  recipesWithoutCost: 0,
  soldUnits: 1500,
  stockCounted: 0,
};

describe("fechar o mês", () => {
  it("com cardápio, compras e fichas em dia, está pronto (venda por fora é opcional)", () => {
    const r = closeMonthChecklist(full);
    expect(r.ready).toBe(true);
    expect(r.items.find((i) => i.key === "outside")!.optional).toBe(true);
    expect(r.items.find((i) => i.key === "outside")!.detail).toContain("Mês passado");
    expect(r.items.find((i) => i.key === "purchases")!.detail).toContain("vieram de notas fiscais");
  });

  it("sem compras, aponta a nota fiscal", () => {
    const r = closeMonthChecklist({ ...full, purchases: 0, purchasesFromNfe: 0 });
    expect(r.ready).toBe(false);
    const p = r.items.find((i) => i.key === "purchases")!;
    expect(p.done).toBe(false);
    expect(p.href).toBe("/insumos/nfe");
  });

  it("ficha incompleta bloqueia e leva às fichas", () => {
    const r = closeMonthChecklist({ ...full, recipesWithoutCost: 2 });
    expect(r.ready).toBe(false);
    expect(r.items.find((i) => i.key === "recipes")!.detail).toContain("2 marmitas vendidas");
  });

  it("sem cardápio conectado, o faturamento é obrigatório e não há item do cardápio", () => {
    const r = closeMonthChecklist({ ...full, connected: false, menuOrders: 0, outsideRevenue: 0 });
    expect(r.items.some((i) => i.key === "menu")).toBe(false);
    expect(r.items.find((i) => i.key === "outside")!.optional).toBeFalsy();
    expect(r.ready).toBe(false);
    expect(r.requiredDone).toBe(3); // compras, fichas, contas fixas
    expect(r.required).toBe(4);
  });

  it("a contagem de estoque é opcional e não bloqueia", () => {
    const r = closeMonthChecklist(full);
    const stock = r.items.find((i) => i.key === "stock")!;
    expect(stock.optional).toBe(true);
    expect(stock.href).toBe("/custos/estoque?mes=2026-09");
    expect(r.ready).toBe(true);
    expect(closeMonthChecklist({ ...full, stockCounted: 12 }).items.find((i) => i.key === "stock")!.done).toBe(true);
  });

  it("o link de informar leva ao mês certo", () => {
    expect(closeMonthChecklist({ ...full, connected: false }).items.find((i) => i.key === "outside")!.href).toBe("/custos/mes?mes=2026-09#contas-do-mes");
  });
});
