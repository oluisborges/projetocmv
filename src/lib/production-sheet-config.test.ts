import { describe, expect, it } from "vitest";
import { SHEET_MODELOS, SHEET_PADRAO, opcoesVisiveis, sheetFromParams, sheetModeloDe, sheetToParams } from "./production-sheet-config";

describe("configuração da ficha de produção", () => {
  it("sem parâmetros vale a Ficha completa", () => {
    const c = sheetFromParams(null, null);
    expect(c.secoes).toEqual(["produzir", "preparar", "comprar", "observacoes"]);
    expect(sheetModeloDe(c)).toBe("completa");
  });

  it("a ordem das seções é a que a pessoa escolheu (comprar antes de produzir)", () => {
    const c = sheetFromParams("comprar,produzir", "precos,fornecedor");
    expect(c.secoes).toEqual(["comprar", "produzir"]);
    expect(c.opcoes.precos).toBe(true);
    expect(c.opcoes.saiu).toBe(false);
    expect(sheetToParams(c)).toEqual({ secoes: "comprar,produzir", opcoes: "precos,fornecedor" });
  });

  it("ignora o que é inválido e repetido", () => {
    expect(sheetFromParams("comprar,xx,comprar,produzir", "foo,saiu").secoes).toEqual(["comprar", "produzir"]);
    expect(sheetFromParams("xx", "").secoes).toEqual([]);
    expect(sheetFromParams("", "").secoes).toEqual([]);
  });

  it("ida e volta pela barra de endereço mantém tudo", () => {
    for (const m of SHEET_MODELOS) {
      const p = sheetToParams(m.config);
      expect(sheetFromParams(p.secoes, p.opcoes)).toEqual(m.config);
    }
  });

  it("reconhece o modelo pronto só se a ordem e as opções batem", () => {
    expect(sheetModeloDe(SHEET_MODELOS[0].config)).toBe("compras");
    expect(sheetModeloDe({ ...SHEET_PADRAO, secoes: ["comprar", "produzir", "preparar", "observacoes"] })).toBeNull();
    expect(sheetModeloDe({ secoes: SHEET_PADRAO.secoes, opcoes: { ...SHEET_PADRAO.opcoes, precos: false } })).toBeNull();
  });

  it("só mostra as opções das seções marcadas", () => {
    const lista = SHEET_MODELOS[0].config;
    expect(opcoesVisiveis(lista)).toEqual(["resumo", "precos", "fornecedor", "estoque", "marcar"]);
    expect(opcoesVisiveis({ secoes: ["produzir"], opcoes: lista.opcoes })).toEqual(["resumo", "saiu", "custoProduto"]);
  });
});
