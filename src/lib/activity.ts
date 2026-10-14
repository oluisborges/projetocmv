const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const EXACT: Record<string, string> = {
  "/": "Abriu o Início",
  "/painel": "Abriu o Painel",
  "/painel/historico": "Abriu o Histórico do painel",
  "/insumos": "Abriu Insumos",
  "/insumos/novo": "Abriu o cadastro de novo insumo",
  "/insumos/catalogo": "Abriu o catálogo de insumos",
  "/insumos/reajuste": "Abriu o reajuste de preços em lote",
  "/fichas": "Abriu Fichas",
  "/fichas/nova": "Abriu a criação de ficha",
  "/precificacao": "Abriu Preços",
  "/precificacao/ajustes": "Abriu os ajustes de preço",
  "/custos": "Abriu Custos",
  "/custos/mes": "Abriu Fechar o mês",
  "/conta/senha": "Abriu Trocar senha",
};

const PATTERNS: [RegExp, string][] = [
  [new RegExp(`^/insumos/${UUID}$`, "i"), "Abriu a edição de um insumo"],
  [new RegExp(`^/fichas/${UUID}$`, "i"), "Abriu uma ficha"],
  [new RegExp(`^/precificacao/${UUID}$`, "i"), "Abriu o preço de um produto"],
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
