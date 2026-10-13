import { describe, expect, it } from "vitest";
import { describePath } from "./activity";

describe("describePath", () => {
  it("traduz as telas do app", () => {
    expect(describePath("/")).toBe("Abriu o Início");
    expect(describePath("/insumos")).toBe("Abriu Insumos");
    expect(describePath("/custos/mes?mes=2026-09")).toBe("Abriu Fechar o mês");
    expect(describePath("/fichas/")).toBe("Abriu Fichas");
    expect(describePath("/fichas/3f2b8c1e-1111-4222-8333-444455556666")).toBe("Abriu uma ficha");
  });

  it("ignora endereços desconhecidos ou gigantes", () => {
    expect(describePath("/admin")).toBeNull();
    expect(describePath("/qualquer-coisa")).toBeNull();
    expect(describePath("/fichas/nao-e-uuid")).toBeNull();
    expect(describePath("/" + "a".repeat(500))).toBeNull();
  });
});
