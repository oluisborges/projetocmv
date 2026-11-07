/**
 * Largura do conteúdo no desktop, por tipo de tela. No celular tudo ocupa a largura da tela; do `lg` para cima:
 * - narrow: telas de edição e formulários (um produto, um insumo, a produção em passos) ficam em coluna de leitura;
 * - standard: listas e painéis ganham mais espaço (grades de 2 colunas);
 * - wide: o painel Shogun, que é feito de listas e quadros.
 */
export type PageWidth = "narrow" | "standard" | "wide";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const NARROW = [
  new RegExp(`^/cardapio/${UUID}(/.*)?$`, "i"),
  new RegExp(`^/cardapio/combos/${UUID}$`, "i"),
  /^\/cardapio\/nova$/,
  new RegExp(`^/ingredientes/${UUID}$`, "i"),
  /^\/ingredientes\/(novo|reajuste|nfe)(\/.*)?$/,
  /^\/ingredientes\/receitas\/.+$/,
  new RegExp(`^/producao/${UUID}$`, "i"),
  /^\/producao\/fechar-mes$/,
  /^\/configuracoes(\/.*)?$/,
  /^\/avisos$/,
];

export function widthFor(pathname: string): PageWidth {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "wide";
  if (NARROW.some((re) => re.test(pathname))) return "narrow";
  return "standard";
}

/** Classes de largura (só valem do `lg` para cima; antes disso a coluna é a da tela). */
export const WIDTH_CLASS: Record<PageWidth, string> = {
  narrow: "lg:max-w-3xl",
  standard: "lg:max-w-4xl",
  wide: "lg:max-w-6xl",
};
