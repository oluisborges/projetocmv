import { currentMonthStart, lastMonths, monthBounds } from "@/lib/month-view";

/** Quantos meses anteriores ao atual entram na carga inicial (mês atual + 3 anteriores = 4 meses). */
export const LOOKBACK_PREVIOUS_MONTHS = 3;

/**
 * Início da carga inicial: o dia 1 (00:00 de Brasília) de 3 meses atrás. Em 17/10/2026 é 01/07/2026.
 * Pega os meses inteiros, não "90 dias", para o fechamento de cada mês bater com o do cardápio.
 */
export function menuLookbackStart(now: Date = new Date()): Date {
  const first = lastMonths(currentMonthStart(now), LOOKBACK_PREVIOUS_MONTHS + 1).at(-1)!;
  return monthBounds(first).start;
}

/** Quanto tempo sem conferir até a conexão ser considerada atrasada (a conferência é diária). */
export const STALE_AFTER_HOURS = 30;

export function isStale(lastSyncAt: string | null, now: Date = new Date()): boolean {
  return !lastSyncAt || now.getTime() - Date.parse(lastSyncAt) > STALE_AFTER_HOURS * 3_600_000;
}

/**
 * Depois de um ciclo, vale chamar outro logo em seguida? Só quando ainda há trabalho (histórico por listar ou fila com pedidos),
 * houve progresso e não deu erro. `depth` limita a corrente para um defeito nunca virar laço infinito.
 */
export const MAX_CHAIN_DEPTH = 150;
export function shouldChain(input: { phase: "history" | "done"; pending: number; progressed: boolean; error: boolean; depth: number }): boolean {
  if (input.error || !input.progressed || input.depth >= MAX_CHAIN_DEPTH) return false;
  return input.phase === "history" || input.pending > 0;
}
