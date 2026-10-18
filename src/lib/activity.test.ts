import { describe, expect, it } from "vitest";
import { describePath } from "./activity";

describe("describePath", () => {
  it("traduz as telas do app", () => {
    expect(describePath("/")).toBe("Abriu o Início");
    expect(describePath("/insumos")).toBe("Abriu Insumos");
    expect(describePath("/mes?mes=2026-09")).toBe("Abriu Fechar o mês");
    expect(describePath("/marmitas/")).toBe("Abriu Marmitas");
    expect(describePath("/marmitas/3f2b8c1e-1111-4222-8333-444455556666")).toBe("Abriu uma ficha");
  });

  it("telas novas e preço de um produto", () => {
    expect(describePath("/mes/historico")).toBe("Abriu o Histórico");
    expect(describePath("/ajustes/custos")).toBe("Abriu Custos fixos");
    expect(describePath("/marmitas/3f2b8c1e-1111-4222-8333-444455556666/preco")).toBe("Abriu o preço de um produto");
  });

  it("ignora endereços desconhecidos ou gigantes", () => {
    expect(describePath("/admin")).toBeNull();
    expect(describePath("/qualquer-coisa")).toBeNull();
    expect(describePath("/marmitas/nao-e-uuid")).toBeNull();
    expect(describePath("/" + "a".repeat(500))).toBeNull();
  });
});
