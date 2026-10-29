import { describe, expect, it } from "vitest";
import { advancedLockFrom, menuLocksFrom } from "./menu-locks";

describe("menus travados", () => {
  it("conta nova: Produção travada e manda criar a primeira marmita", () => {
    const l = menuLocksFrom({ count: 0 });
    expect(l.producao?.href).toBe("/cardapio/nova");
    expect(l.producao?.message).toContain("primeira marmita");
  });

  it("com ao menos uma marmita: tudo liberado", () => {
    expect(menuLocksFrom({ count: 3 })).toEqual({ producao: null });
    expect(advancedLockFrom({ count: 3 })).toBeNull();
  });

  it("a Visão Avançada também espera a primeira marmita", () => {
    expect(advancedLockFrom({ count: 0 })?.message).toContain("Visão Avançada");
  });

  it("erro de consulta não trava nada", () => {
    expect(menuLocksFrom({ count: null, error: new Error("timeout") })).toEqual({ producao: null });
    expect(advancedLockFrom({ count: null, error: { code: "57014" } })).toBeNull();
  });

  it("contagem nula sem erro conta como zero", () => {
    expect(menuLocksFrom({ count: null }).producao).not.toBeNull();
  });
});
