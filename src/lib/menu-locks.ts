// Menus que ainda não podem ser usados: aparecem sempre, mas travados, com a explicação do que fazer para liberar.
// Consulta com erro do Supabase não lança exceção (devolve `{ error }`): na dúvida, nada fica travado.

export type CountResult = { count: number | null; error?: unknown };

export type MenuLock = { message: string; href: string; cta: string };

export function menuLocksFrom(recipes: CountResult, priced: CountResult): { mes: MenuLock | null; painel: MenuLock | null } {
  if (recipes.error || priced.error) return { mes: null, painel: null };
  const hasRecipes = (recipes.count ?? 0) > 0;
  const hasPrice = (priced.count ?? 0) > 0;
  return {
    mes: hasRecipes ? null : { message: "O Mês é liberado depois que você cria a sua primeira marmita.", href: "/marmitas/nova", cta: "Criar marmita" },
    painel: hasPrice
      ? null
      : hasRecipes
        ? { message: "O Painel é liberado quando você define o preço de venda de uma marmita.", href: "/marmitas", cta: "Definir o preço" }
        : { message: "O Painel é liberado depois que você cria uma marmita e define o preço de venda dela.", href: "/marmitas/nova", cta: "Criar marmita" },
  };
}
