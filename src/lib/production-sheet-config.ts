// O que vai dentro da ficha de produção impressa e em que ordem. A pessoa escolhe seção por seção (e a ordem delas)
// ou parte de um modelo pronto: Lista de compras (com preços), Ficha completa ou Cozinha (sem preços).

export const SECOES = ["produzir", "preparar", "comprar", "observacoes"] as const;
export type Secao = (typeof SECOES)[number];

export const SECAO_LABEL: Record<Secao, string> = {
  produzir: "Produzir",
  preparar: "Preparar (receitas)",
  comprar: "Comprar",
  observacoes: "Observações",
};

export const SECAO_DICA: Record<Secao, string> = {
  produzir: "Quantas marmitas de cada produto fazer.",
  preparar: "As receitas em lote, com os insumos já somados.",
  comprar: "O que falta comprar, descontado o estoque.",
  observacoes: "Linhas em branco para anotar.",
};

export const OPCOES = ["resumo", "saiu", "custoProduto", "insumos", "precos", "fornecedor", "estoque", "marcar"] as const;
export type Opcao = (typeof OPCOES)[number];

/** Cada opção pertence a uma seção (ou ao topo da folha) e só aparece para escolher quando a seção está marcada. */
export const OPCAO_INFO: Record<Opcao, { label: string; secao: Secao | "topo" }> = {
  resumo: { label: "Resumo no topo", secao: "topo" },
  saiu: { label: "Coluna “Saiu” para anotar", secao: "produzir" },
  custoProduto: { label: "Custo de cada produto", secao: "produzir" },
  insumos: { label: "Insumos de cada receita", secao: "preparar" },
  precos: { label: "Preços estimados (total e por kg/un)", secao: "comprar" },
  fornecedor: { label: "Agrupar por fornecedor", secao: "comprar" },
  estoque: { label: "Quanto tem em estoque", secao: "comprar" },
  marcar: { label: "Caixinha para marcar", secao: "comprar" },
};

export type SheetConfig = { secoes: Secao[]; opcoes: Record<Opcao, boolean> };

const opcoes = (on: Opcao[]): Record<Opcao, boolean> => Object.fromEntries(OPCOES.map((o) => [o, on.includes(o)])) as Record<Opcao, boolean>;

export type SheetModeloId = "compras" | "completa" | "cozinha";

export const SHEET_MODELOS: { id: SheetModeloId; nome: string; descricao: string; config: SheetConfig }[] = [
  {
    id: "compras",
    nome: "Lista de compras",
    descricao: "Só o que comprar, com preço estimado (total e por kg/un), fornecedor e quanto tem em estoque.",
    config: { secoes: ["comprar"], opcoes: opcoes(["resumo", "precos", "fornecedor", "estoque", "marcar"]) },
  },
  {
    id: "completa",
    nome: "Ficha completa",
    descricao: "Produzir, preparar e comprar, na ordem do dia, com a coluna “Saiu” e as observações.",
    config: { secoes: ["produzir", "preparar", "comprar", "observacoes"], opcoes: opcoes(["resumo", "saiu", "insumos", "precos", "fornecedor", "marcar"]) },
  },
  {
    id: "cozinha",
    nome: "Cozinha",
    descricao: "Para quem prepara: o que produzir e as receitas com os insumos. Sem preços.",
    config: { secoes: ["produzir", "preparar", "observacoes"], opcoes: opcoes(["saiu", "insumos"]) },
  },
];

export const SHEET_PADRAO: SheetConfig = SHEET_MODELOS[1].config;

const isSecao = (v: string): v is Secao => (SECOES as readonly string[]).includes(v);
const isOpcao = (v: string): v is Opcao => (OPCOES as readonly string[]).includes(v);

/** "comprar,produzir" + "precos,fornecedor" (na barra de endereço) -> configuração. Sem nada válido, vale a Ficha completa. */
export function sheetFromParams(secoes: string | null | undefined, opcoesParam: string | null | undefined): SheetConfig {
  if (secoes === null || secoes === undefined) return { secoes: [...SHEET_PADRAO.secoes], opcoes: { ...SHEET_PADRAO.opcoes } };
  const list: Secao[] = [];
  for (const s of secoes.split(",").map((x) => x.trim())) if (isSecao(s) && !list.includes(s)) list.push(s);
  const wanted = new Set((opcoesParam ?? "").split(",").map((x) => x.trim()).filter(isOpcao));
  return { secoes: list, opcoes: opcoes([...wanted]) };
}

export const sheetToParams = (c: SheetConfig): { secoes: string; opcoes: string } => ({ secoes: c.secoes.join(","), opcoes: OPCOES.filter((o) => c.opcoes[o]).join(",") });

/** Qual modelo pronto bate exatamente com a escolha atual (ou `null` = personalizada). Vale a ordem das seções. */
export function sheetModeloDe(c: SheetConfig): SheetModeloId | null {
  return SHEET_MODELOS.find((m) => m.config.secoes.join(",") === c.secoes.join(",") && OPCOES.every((o) => m.config.opcoes[o] === c.opcoes[o]))?.id ?? null;
}

/** Opções que fazem sentido agora: só as das seções marcadas (e o resumo do topo). */
export const opcoesVisiveis = (c: SheetConfig): Opcao[] => OPCOES.filter((o) => OPCAO_INFO[o].secao === "topo" || c.secoes.includes(OPCAO_INFO[o].secao as Secao));
