// Quais itens do menu de baixo aparecem: "Mês" depois da primeira marmita, "Painel" depois do primeiro preço de venda.
// Consulta com erro do Supabase não lança exceção (devolve `{ error }`): na dúvida, mostra tudo em vez de esconder o menu.

export type CountResult = { count: number | null; error?: unknown };

export function menuVisibilityFrom(recipes: CountResult, priced: CountResult): { mes: boolean; painel: boolean } {
  if (recipes.error || priced.error) return { mes: true, painel: true };
  return { mes: (recipes.count ?? 0) > 0, painel: (priced.count ?? 0) > 0 };
}
