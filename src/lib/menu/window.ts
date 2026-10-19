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

/**
 * A importação parou no meio? Tem trabalho (carga do histórico ou fila), a conexão está ativa, ninguém está rodando agora
 * e o último ciclo foi há mais de 45 s (um ciclo em andamento tem trava). Quem abre as telas do cardápio "cutuca" essas conexões para elas continuarem.
 */
export function needsKick(c: { status: string; phase: "history" | "done"; pending_orders: number; locked_until: string | null; last_sync_at: string | null }, now: Date = new Date()): boolean {
  if (c.status !== "connected") return false;
  if (c.phase !== "history" && c.pending_orders <= 0) return false;
  if (c.locked_until && Date.parse(c.locked_until) > now.getTime()) return false;
  return !c.last_sync_at || now.getTime() - Date.parse(c.last_sync_at) > 45_000;
}

/**
 * Lista as páginas de uma janela de pedidos sem estourar o tempo: cada página é uma chamada lenta (a API limita o ritmo),
 * então antes de pedir a próxima confere se ainda cabe. Se não couber, devolve a página onde continuar (guardada no banco).
 */
export async function listPages(opts: {
  startPage: number;
  /** Busca e processa uma página; devolve o total de páginas da janela. */
  fetchPage: (page: number) => Promise<number>;
  /** Tempo que uma página costuma levar (inclui a espera do limite de chamadas). */
  pageCostMs: number;
  deadline: number;
  now?: () => number;
  /** Chamado depois de cada página concluída, com a próxima a buscar. */
  onPage?: (nextPage: number) => Promise<void>;
}): Promise<{ complete: boolean; nextPage: number }> {
  const now = opts.now ?? Date.now;
  let page = Math.max(1, opts.startPage);
  for (;;) {
    if (now() + opts.pageCostMs > opts.deadline) return { complete: false, nextPage: page };
    const total = await opts.fetchPage(page);
    if (page >= total) return { complete: true, nextPage: 1 };
    page += 1;
    await opts.onPage?.(page);
  }
}
