const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const EXACT: Record<string, string> = {
  "/": "Abriu o Início",
  "/painel": "Abriu o Painel",
  "/painel/cardapio": "Abriu a análise do cardápio",
  "/painel/cupons": "Abriu os cupons",
  "/mes": "Abriu Fechar o mês",
  "/mes/estoque": "Abriu o estoque do mês",
  "/mes/historico": "Abriu o Histórico",
  "/insumos": "Abriu Insumos",
  "/insumos/novo": "Abriu o cadastro de novo insumo",
  "/insumos/catalogo": "Abriu o catálogo de insumos",
  "/insumos/reajuste": "Abriu o reajuste de preços em lote",
  "/insumos/nfe": "Abriu a importação de nota fiscal",
  "/marmitas": "Abriu Marmitas",
  "/marmitas/nova": "Abriu a criação de ficha",
  "/marmitas/combos": "Abriu Combos",
  "/custos": "Abriu Custos fixos",
  "/custos/impostos": "Abriu impostos e meta de lucro",
  "/custos/cardapio": "Abriu os vínculos do cardápio",
  "/avisos": "Abriu Avisos",
  "/conta/senha": "Abriu Trocar senha",
};

const PATTERNS: [RegExp, string][] = [
  [new RegExp(`^/insumos/${UUID}$`, "i"), "Abriu a edição de um insumo"],
  [new RegExp(`^/marmitas/${UUID}$`, "i"), "Abriu uma ficha"],
  [new RegExp(`^/marmitas/${UUID}/preco$`, "i"), "Abriu o preço de um produto"],
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
