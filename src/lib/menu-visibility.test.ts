import { describe, expect, it } from "vitest";
import { menuVisibilityFrom } from "./menu-visibility";

describe("menus no momento certo", () => {
  it("conta nova: nenhum dos dois aparece", () => {
    expect(menuVisibilityFrom({ count: 0 }, { count: 0 })).toEqual({ mes: false, painel: false });
  });

  it("com ficha, aparece o Mês; com preço, também o Painel", () => {
    expect(menuVisibilityFrom({ count: 2 }, { count: 0 })).toEqual({ mes: true, painel: false });
    expect(menuVisibilityFrom({ count: 2 }, { count: 1 })).toEqual({ mes: true, painel: true });
  });

  it("erro de consulta não esconde o menu", () => {
    expect(menuVisibilityFrom({ count: null, error: new Error("timeout") }, { count: 3 })).toEqual({ mes: true, painel: true });
    expect(menuVisibilityFrom({ count: 4 }, { count: null, error: { code: "57014" } })).toEqual({ mes: true, painel: true });
  });

  it("contagem nula sem erro conta como zero", () => {
    expect(menuVisibilityFrom({ count: null }, { count: null })).toEqual({ mes: false, painel: false });
  });
});
