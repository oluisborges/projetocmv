import { describe, expect, it } from "vitest";
import { normalizeName } from "./names";

describe("normalizeName", () => {
  it("ignora maiúsculas, acento e espaços sobrando", () => {
    expect(normalizeName("Arroz branco")).toBe(normalizeName("  ARROZ   Branco "));
    expect(normalizeName("Feijão preto")).toBe(normalizeName("feijao PRETO"));
    expect(normalizeName("Pão de queijo")).toBe("pao de queijo");
  });

  it("marca diferente é outro insumo", () => {
    expect(normalizeName("Arroz branco Tio João")).not.toBe(normalizeName("Arroz branco"));
    expect(normalizeName("Arroz branco Prato Fino")).not.toBe(normalizeName("Arroz branco Tio João"));
  });
});
