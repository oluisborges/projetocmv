// Menus que ainda não podem ser usados: aparecem sempre, mas travados, com a explicação do que fazer para liberar.
// Consulta com erro do Supabase não lança exceção (devolve `{ error }`): na dúvida, nada fica travado.

export type CountResult = { count: number | null; error?: unknown };

export type MenuLock = { message: string; href: string; cta: string };

/** Painel (resumo, por marmita, fechar o mês) e Produção (calcular, semana, estoque) só fazem sentido com a primeira marmita criada. */
export function menuLocksFrom(recipes: CountResult): { painel: MenuLock | null; producao: MenuLock | null } {
  if (recipes.error) return { painel: null, producao: null };
  if ((recipes.count ?? 0) > 0) return { painel: null, producao: null };
  const create = { href: "/marmitas/nova", cta: "Criar marmita" };
  return {
    painel: { message: "O Painel é liberado depois que você cria a sua primeira marmita.", ...create },
    producao: { message: "A Produção é liberada depois que você cria a sua primeira marmita: é a partir dela que o sistema calcula o que produzir e comprar.", ...create },
  };
}
