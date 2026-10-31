// O que vai dentro da ficha técnica impressa. A pessoa escolhe campo a campo ou parte de um modelo pronto
// (Cozinha: o que fazer e quanto de cada coisa; Financeiro: quanto custa e quanto sobra).

export const FICHA_CAMPOS = [
  "ingredientes",
  "embalagens",
  "pesoLiquido",
  "fc",
  "pesoBruto",
  "custo",
  "custoPorMarmita",
  "pesoPorcao",
  "precoVenda",
  "cmv",
  "modoPreparo",
] as const;

export type FichaCampo = (typeof FICHA_CAMPOS)[number];
export type FichaCampos = Record<FichaCampo, boolean>;

export const CAMPO_LABEL: Record<FichaCampo, string> = {
  ingredientes: "Ingredientes",
  embalagens: "Embalagens",
  pesoLiquido: "Peso líquido",
  fc: "FC (fator de correção)",
  pesoBruto: "Peso bruto",
  custo: "Custo de cada item",
  custoPorMarmita: "Custo por marmita",
  pesoPorcao: "Peso da porção",
  precoVenda: "Preço de venda",
  cmv: "CMV",
  modoPreparo: "Modo de preparo e observações",
};

/** Como os campos aparecem agrupados na tela. */
export const CAMPO_GRUPOS: { titulo: string; dica?: string; campos: FichaCampo[] }[] = [
  { titulo: "Tabela de itens", dica: "Quais itens e quais colunas.", campos: ["ingredientes", "embalagens", "pesoLiquido", "fc", "pesoBruto", "custo"] },
  { titulo: "Resumo no topo", dica: "Nas receitas: rendimento (peso da porção) e custo do lote, por kg e por 100 g (custo por marmita).", campos: ["custoPorMarmita", "pesoPorcao", "precoVenda", "cmv"] },
  { titulo: "Espaço para escrever", campos: ["modoPreparo"] },
];

const only = (on: FichaCampo[]): FichaCampos => Object.fromEntries(FICHA_CAMPOS.map((c) => [c, on.includes(c)])) as FichaCampos;

export type ModeloId = "cozinha" | "financeiro";

/** Modelos prontos: marcam os campos de cada uso. */
export const MODELOS: { id: ModeloId; nome: string; descricao: string; campos: FichaCampos }[] = [
  {
    id: "cozinha",
    nome: "Cozinha",
    descricao: "Ingredientes, embalagens, pesos e o espaço do modo de preparo. Sem custo nem preço.",
    campos: only(["ingredientes", "embalagens", "pesoLiquido", "pesoBruto", "pesoPorcao", "modoPreparo"]),
  },
  {
    id: "financeiro",
    nome: "Financeiro",
    descricao: "Tudo o que importa para o custo: itens, FC, custos, preço de venda e CMV.",
    campos: only(["ingredientes", "embalagens", "pesoLiquido", "fc", "pesoBruto", "custo", "custoPorMarmita", "pesoPorcao", "precoVenda", "cmv"]),
  },
];

export const CAMPOS_PADRAO: FichaCampos = MODELOS[1].campos;

/** "ingredientes,custo" (na barra de endereço) -> campos. Sem nada (ou tudo inválido), vale o modelo Financeiro. */
export function camposFromParam(param: string | null | undefined): FichaCampos {
  if (param === null || param === undefined) return { ...CAMPOS_PADRAO };
  const wanted = new Set(param.split(",").map((s) => s.trim()));
  return only(FICHA_CAMPOS.filter((c) => wanted.has(c)));
}

export const camposToParam = (campos: FichaCampos): string => FICHA_CAMPOS.filter((c) => campos[c]).join(",");

/** Qual modelo pronto bate exatamente com a escolha atual (ou `null` = personalizada). */
export function modeloDe(campos: FichaCampos): ModeloId | null {
  return MODELOS.find((m) => FICHA_CAMPOS.every((c) => m.campos[c] === campos[c]))?.id ?? null;
}
