import { describe, expect, it } from "vitest";
import { describePath } from "./activity";

describe("describePath", () => {
  it("traduz as telas do app", () => {
    expect(describePath("/")).toBe("Abriu o Início");
    expect(describePath("/ingredientes")).toBe("Abriu Ingredientes");
    expect(describePath("/producao/fechar-mes?mes=2026-09")).toBe("Abriu Fechar o mês");
    expect(describePath("/cardapio/")).toBe("Abriu o Cardápio");
    expect(describePath("/cardapio/3f2b8c1e-1111-4222-8333-444455556666")).toBe("Abriu uma ficha");
  });

  it("telas novas e preço de um produto", () => {
    expect(describePath("/financeiro/historico")).toBe("Abriu o Histórico");
    expect(describePath("/financeiro")).toBe("Abriu o Financeiro (custos fixos)");
    expect(describePath("/cardapio/3f2b8c1e-1111-4222-8333-444455556666/preco")).toBe("Abriu o preço de um produto");
  });

  it("ignora endereços desconhecidos ou gigantes", () => {
    expect(describePath("/admin")).toBeNull();
    expect(describePath("/qualquer-coisa")).toBeNull();
    expect(describePath("/cardapio/nao-e-uuid")).toBeNull();
    expect(describePath("/" + "a".repeat(500))).toBeNull();
  });
});
