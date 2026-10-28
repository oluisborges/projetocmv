import { describe, expect, it } from "vitest";
import { menuLocksFrom } from "./menu-locks";

describe("menus travados", () => {
  it("conta nova: Painel e Produção travados, os dois mandam criar a primeira marmita", () => {
    const l = menuLocksFrom({ count: 0 });
    expect(l.painel?.href).toBe("/marmitas/nova");
    expect(l.painel?.message).toContain("primeira marmita");
    expect(l.producao?.href).toBe("/marmitas/nova");
    expect(l.producao?.message).toContain("primeira marmita");
  });

  it("com ao menos uma marmita: tudo liberado", () => {
    expect(menuLocksFrom({ count: 3 })).toEqual({ painel: null, producao: null });
  });

  it("erro de consulta não trava nada", () => {
    expect(menuLocksFrom({ count: null, error: new Error("timeout") })).toEqual({ painel: null, producao: null });
  });

  it("contagem nula sem erro conta como zero", () => {
    expect(menuLocksFrom({ count: null }).painel).not.toBeNull();
  });
});
