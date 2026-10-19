import { describe, expect, it } from "vitest";
import { menuLocksFrom } from "./menu-locks";

describe("menus travados", () => {
  it("conta nova: Mês e Painel travados, os dois mandam criar a primeira marmita", () => {
    const l = menuLocksFrom({ count: 0 }, { count: 0 });
    expect(l.mes?.href).toBe("/marmitas/nova");
    expect(l.mes?.message).toContain("primeira marmita");
    expect(l.painel?.href).toBe("/marmitas/nova");
    expect(l.painel?.message).toContain("preço de venda");
  });

  it("com marmita e sem preço: Mês liberado; Painel manda definir o preço", () => {
    const l = menuLocksFrom({ count: 3 }, { count: 0 });
    expect(l.mes).toBeNull();
    expect(l.painel?.href).toBe("/marmitas");
    expect(l.painel?.cta).toBe("Definir o preço");
  });

  it("com preço definido: tudo liberado", () => {
    expect(menuLocksFrom({ count: 3 }, { count: 2 })).toEqual({ mes: null, painel: null });
  });

  it("erro de consulta não trava nada", () => {
    expect(menuLocksFrom({ count: null, error: new Error("timeout") }, { count: 0 })).toEqual({ mes: null, painel: null });
    expect(menuLocksFrom({ count: 2 }, { count: null, error: { code: "57014" } })).toEqual({ mes: null, painel: null });
  });

  it("contagem nula sem erro conta como zero", () => {
    expect(menuLocksFrom({ count: null }, { count: null }).mes).not.toBeNull();
  });
});
