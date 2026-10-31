const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const EXACT: Record<string, string> = {
  "/": "Abriu o Início",
  "/painel": "Abriu a Visão Avançada",
  "/painel/cardapio": "Abriu a análise por marmita",
  "/painel/cupons": "Abriu os cupons",
  "/financeiro": "Abriu o Financeiro (custos fixos)",
  "/financeiro/impostos": "Abriu impostos e meta de lucro",
  "/cardapio/sincronizar": "Abriu a sincronização do cardápio digital",
  "/producao/fechar-mes": "Abriu Fechar o mês",
  "/producao/estoque/historico": "Abriu o histórico do estoque",
  "/financeiro/historico": "Abriu o Histórico",
  "/ingredientes": "Abriu Ingredientes",
  "/ingredientes/novo": "Abriu o cadastro de novo insumo",
  "/ingredientes/catalogo": "Abriu o catálogo de insumos",
  "/ingredientes/reajuste": "Abriu o reajuste de preços em lote",
  "/ingredientes/nfe": "Abriu a importação de nota fiscal",
  "/ingredientes/receitas/nova": "Abriu o cadastro de nova receita",
  "/cardapio": "Abriu o Cardápio",
  "/cardapio/nova": "Abriu a criação de ficha",
  "/cardapio/combos": "Abriu Combos",
  "/producao": "Abriu a Produção",
  "/producao/estoque": "Abriu o estoque da produção",
  "/producao/fichas": "Abriu as fichas técnicas para imprimir",
  "/avisos": "Abriu Avisos",
  "/configuracoes": "Abriu as Configurações",
  "/conta/senha": "Abriu Trocar senha",
};

const PATTERNS: [RegExp, string][] = [
  [new RegExp(`^/ingredientes/${UUID}$`, "i"), "Abriu a edição de um insumo"],
  [new RegExp(`^/ingredientes/receitas/${UUID}$`, "i"), "Abriu uma receita"],
  [new RegExp(`^/cardapio/${UUID}$`, "i"), "Abriu uma ficha"],
  [new RegExp(`^/cardapio/${UUID}/preco$`, "i"), "Abriu o preço de um produto"],
  [new RegExp(`^/producao/${UUID}$`, "i"), "Abriu uma produção"],
];

/**
 * Frase para o histórico de uso a partir do endereço da tela. Só telas conhecidas entram: o endereço vem do
 * navegador, então qualquer outra coisa é ignorada (`null`) em vez de gravada.
 */
export function describePath(path: string): string | null {
  const clean = path.split("?")[0].replace(/\/+$/, "") || "/";
  if (clean.length > 120) return null;
  if (EXACT[clean]) return EXACT[clean];
  for (const [re, text] of PATTERNS) if (re.test(clean)) return text;
  return null;
}
