import { describe, expect, it } from "vitest";
import { INGREDIENT_TEMPLATE, parseCsv, readIngredientSheet, readRecipeSheet, RECIPE_TEMPLATE } from "./sheet-import";

describe("CSV", () => {
  it("lê o formato do Excel brasileiro (; e vírgula decimal) com BOM", () => {
    const rows = parseCsv("﻿Nome;Preço\r\nArroz;28,50\r\n");
    expect(rows).toEqual([["Nome", "Preço"], ["Arroz", "28,50"]]);
  });

  it("aceita vírgula como separador e aspas com vírgula dentro", () => {
    expect(parseCsv('nome,preco\n"Farinha, de trigo",5.2\n')).toEqual([["nome", "preco"], ["Farinha, de trigo", "5.2"]]);
  });

  it("aceita aspas escapadas e tab", () => {
    expect(parseCsv('a\tb\n"diz ""oi"""\tx')).toEqual([["a", "b"], ['diz "oi"', "x"]]);
  });
});

describe("planilha de insumos", () => {
  it("lê o modelo", () => {
    const r = readIngredientSheet(parseCsv(INGREDIENT_TEMPLATE));
    if ("error" in r) throw new Error(r.error);
    expect(r.errors).toEqual([]);
    expect(r.items).toHaveLength(3);
    expect(r.items[0]).toMatchObject({ name: "Peito de frango", unit: "kg", qty: 1, price: 17.9, category: "Carnes", correctionFactor: 1.15 });
    expect(r.items[2]).toMatchObject({ name: "Óleo de soja", unit: "l", qty: 0.9, price: 8.5 });
  });

  it("colunas em outra ordem, nomes parecidos e números do Excel", () => {
    const r = readIngredientSheet([["Produto", "Valor", "Und", "Qtd"], ["Feijão", 9.9, "KG", 1]]);
    if ("error" in r) throw new Error(r.error);
    expect(r.items[0]).toMatchObject({ name: "Feijão", price: 9.9, unit: "kg", qty: 1 });
  });

  it("quantidade e preço em branco: 1 e sem preço", () => {
    const r = readIngredientSheet([["Nome", "Unidade"], ["Sal", "kg"]]);
    if ("error" in r) throw new Error(r.error);
    expect(r.items[0]).toMatchObject({ qty: 1, price: 0, correctionFactor: 1 });
  });

  it("aponta a linha com problema e segue com as outras", () => {
    const r = readIngredientSheet([["Nome", "Unidade", "Preço"], ["Arroz", "kg", "5"], ["Caixa", "cx", "3"], ["", "kg", "1"], ["Sal", "kg", "abc"]]);
    if ("error" in r) throw new Error(r.error);
    expect(r.items.map((i) => i.name)).toEqual(["Arroz"]);
    expect(r.errors.map((e) => e.line)).toEqual([3, 4, 5]);
  });

  it("acha o cabeçalho mesmo com linhas de título acima e pula linhas vazias", () => {
    const r = readIngredientSheet([["Lista de compras da loja"], [], ["Nome", "Unidade"], ["Alho", "kg"], [null, null]]);
    if ("error" in r) throw new Error(r.error);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].line).toBe(4);
  });

  it("sem cabeçalho reconhecível, explica", () => {
    expect("error" in readIngredientSheet([["a", "b"], ["1", "2"]])).toBe(true);
  });

  it("recusa fator de correção abaixo de 1", () => {
    const r = readIngredientSheet([["Nome", "Unidade", "FC"], ["Alho", "kg", "0,5"]]);
    if ("error" in r) throw new Error(r.error);
    expect(r.items).toEqual([]);
    expect(r.errors).toHaveLength(1);
  });
});

describe("planilha de fichas", () => {
  it("agrupa as linhas por ficha", () => {
    const r = readRecipeSheet(parseCsv(RECIPE_TEMPLATE));
    if ("error" in r) throw new Error(r.error);
    expect(r.recipes).toHaveLength(1);
    expect(r.recipes[0].name).toBe("Frango com arroz");
    expect(r.recipes[0].lines.map((l) => [l.ingredient, l.qty, l.unit])).toEqual([["Peito de frango", 120, "g"], ["Arroz branco", 100, "g"], ["Óleo de soja", 5, "ml"]]);
  });

  it("nome da ficha em branco continua a de cima; unidade vazia é grama", () => {
    const r = readRecipeSheet([["Ficha", "Insumo", "Quantidade"], ["Strogonoff", "Frango", "100"], ["", "Creme de leite", "30"], ["Feijoada", "Feijão", "80"]]);
    if ("error" in r) throw new Error(r.error);
    expect(r.recipes.map((x) => [x.name, x.lines.length])).toEqual([["Strogonoff", 2], ["Feijoada", 1]]);
    expect(r.recipes[0].lines[1].unit).toBe("g");
  });

  it("reúne a mesma ficha escrita com outra caixa/acento", () => {
    const r = readRecipeSheet([["Ficha", "Insumo", "Qtd", "Un"], ["Feijão tropeiro", "Feijão", "50", "g"], ["FEIJAO TROPEIRO", "Bacon", "20", "g"]]);
    if ("error" in r) throw new Error(r.error);
    expect(r.recipes).toHaveLength(1);
    expect(r.recipes[0].lines).toHaveLength(2);
  });

  it("quantidade ou unidade ruim vira erro com a linha", () => {
    const r = readRecipeSheet([["Ficha", "Insumo", "Quantidade", "Unidade"], ["A", "X", "0", "g"], ["A", "Y", "5", "colher"]]);
    if ("error" in r) throw new Error(r.error);
    expect(r.errors.map((e) => e.line)).toEqual([2, 3]);
  });
});

describe("planilha de cliente sem coluna de unidade", () => {
  const rows = [
    [null, null, null],
    [null, "Insumos alimentícios", "Custo do insumo (R$)", "Qtd na embalagem (kg/lt/unds)", "Custo unitário final (R$)"],
    [null, "arroz branco", 122, 30, 4.07],
    [null, "azeite", 42.9, 0.5, 85.8],
    [null, null, null, null, null],
    [null, "Spaghetti com almondega", 8.3, 1, 8.3],
    [null, "Insumos descartáveis", "Custo do insumo (R$)", "Qtd embalagem (kg/lt/und)", "Custo unitário final (R$)"],
  ];

  it("lê nome, preço e quantidade, assume kg e para na primeira linha em branco", () => {
    const r = readIngredientSheet(rows);
    if ("error" in r) throw new Error(r.error);
    expect(r.errors).toEqual([]);
    expect(r.items.map((i) => [i.name, i.price, i.qty, i.unit, i.unitAssumed])).toEqual([
      ["arroz branco", 122, 30, "kg", true],
      ["azeite", 42.9, 0.5, "kg", true],
    ]);
  });

  it("uma aba só de apresentação não vira insumos", () => {
    expect("error" in readIngredientSheet([[null, "Ficha Técnica Gerencial"], [null, "Como fazer uma Ficha Técnica?"]])).toBe(true);
  });
});
