// Semanas de produção: de segunda a domingo, no horário de Brasília (UTC−3, sem horário de verão desde 2019).

const BRT_OFFSET_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;

/** Data civil de Brasília (sem hora) de um instante: "2026-10-28". */
export function brtDate(at: Date): string {
  return new Date(at.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 10);
}

/** A segunda-feira (data civil) da semana que contém o instante. */
export function weekStartOf(at: Date): string {
  const civil = new Date(`${brtDate(at)}T00:00:00Z`);
  const dow = civil.getUTCDay(); // 0 = domingo
  const back = dow === 0 ? 6 : dow - 1;
  return new Date(civil.getTime() - back * DAY_MS).toISOString().slice(0, 10);
}

/** Soma dias a uma data civil "YYYY-MM-DD". */
export function addDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Os instantes (UTC) em que a semana que começa em `weekStart` (segunda, BRT) começa e termina (exclusivo). */
export function weekBounds(weekStart: string): { start: Date; end: Date } {
  const start = new Date(new Date(`${weekStart}T00:00:00Z`).getTime() + BRT_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
}

/** Semana a planejar: a próxima (a que começa na segunda que vem); na segunda-feira, a própria semana. */
export function defaultPlanWeek(now: Date): string {
  const thisWeek = weekStartOf(now);
  return brtDate(now) === thisWeek ? thisWeek : addDays(thisWeek, 7);
}

/** "2026-10-26" -> "26/10 a 01/11". */
export function weekLabel(weekStart: string): string {
  const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return `${fmt(weekStart)} a ${fmt(addDays(weekStart, 6))}`;
}

/** As últimas `n` semanas COMPLETAS antes de `now` (da mais antiga para a mais recente). */
export function lastFullWeeks(now: Date, n: number): string[] {
  const current = weekStartOf(now);
  return Array.from({ length: n }, (_, i) => addDays(current, -7 * (n - i)));
}

/** `true` se a data civil é uma segunda-feira. */
export const isMonday = (date: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T00:00:00Z`).getUTCDay() === 1;
