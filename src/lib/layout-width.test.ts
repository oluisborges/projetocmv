import { describe, expect, it } from "vitest";
import { widthFor } from "./layout-width";

const id = "3cb57426-350c-4973-b742-064473be0b51";

describe("largura do conteúdo no desktop", () => {
  it("listas e painéis ficam na largura padrão", () => {
    for (const p of ["/", "/painel", "/painel/cupons", "/cardapio", "/cardapio/fichas", "/cardapio/combos", "/ingredientes", "/ingredientes/catalogo", "/financeiro", "/financeiro/historico", "/producao", "/producao/estoque", "/producao/estoque/movimentos"]) {
      expect(widthFor(p), p).toBe("standard");
    }
  });

  it("edição e formulários ficam em coluna de leitura", () => {
    for (const p of [`/cardapio/${id}`, `/cardapio/${id}/ficha`, `/cardapio/${id}/preco`, `/cardapio/combos/${id}`, "/cardapio/nova", `/ingredientes/${id}`, "/ingredientes/novo", "/ingredientes/nfe", "/ingredientes/receitas/nova", `/ingredientes/receitas/${id}`, `/producao/${id}`, "/producao/fechar-mes"]) {
      expect(widthFor(p), p).toBe("narrow");
    }
  });

  it("o painel Shogun é largo", () => {
    expect(widthFor("/admin")).toBe("wide");
    expect(widthFor("/admin/resultados")).toBe("wide");
  });
});
