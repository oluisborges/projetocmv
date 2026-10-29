// Menus que ainda não podem ser usados: aparecem sempre, mas travados, com a explicação do que fazer para liberar.
// Consulta com erro do Supabase não lança exceção (devolve `{ error }`): na dúvida, nada fica travado.

export type CountResult = { count: number | null; error?: unknown };

export type MenuLock = { message: string; href?: string; cta?: string };

const CREATE = { href: "/cardapio/nova", cta: "Criar marmita" };

/** Produção só faz sentido com a primeira marmita criada: é a partir dela que o sistema calcula o que produzir e comprar. */
export function menuLocksFrom(recipes: CountResult): { producao: MenuLock | null } {
  if (recipes.error || (recipes.count ?? 0) > 0) return { producao: null };
  return { producao: { message: "A Produção é liberada depois que você cria a sua primeira marmita: é a partir dela que o sistema calcula o que produzir e comprar.", ...CREATE } };
}

/**
 * Produção ainda em desenvolvimento: travada para todos até o lançamento.
 * `DEV_LOCK_INCLUDES_ADMIN`: enquanto for true, a equipe Shogun também vê o cadeado (para conferir o visual); depois de conferir, vira false.
 */
export const PRODUCAO_IN_DEVELOPMENT = true;
export const DEV_LOCK_INCLUDES_ADMIN = true;

export const PRODUCAO_DEV_LOCK: MenuLock = {
  message:
    "Este menu está em desenvolvimento e será lançado em breve. A Produção vai servir para planejar o que fazer na semana, ver o que falta comprar, controlar o estoque e fechar o mês.",
};

/** A trava de "em desenvolvimento" vale para este usuário? */
export const devLockApplies = (isPlatformAdmin: boolean) => PRODUCAO_IN_DEVELOPMENT && (!isPlatformAdmin || DEV_LOCK_INCLUDES_ADMIN);

/** A Visão Avançada (análises do Início) também espera a primeira marmita. */
export function advancedLockFrom(recipes: CountResult): MenuLock | null {
  if (recipes.error || (recipes.count ?? 0) > 0) return null;
  return { message: "A Visão Avançada é liberada depois que você cria a sua primeira marmita.", ...CREATE };
}
