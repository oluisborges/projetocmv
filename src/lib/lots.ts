/** Lote de marmitas prontas: uma produção de um produto, com a data e a validade. */
export type Lot = { id: string; recipeId: string; code: string | null; qty: number; producedOn: string; expiresOn: string | null };
export type LotWithBalance = Lot & { remaining: number };

/** Soma dias a uma data "2026-11-07" (em UTC ao meio-dia, sem surpresas de fuso). */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Dias inteiros de `from` até `to` (negativo = já passou). */
export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000);
}

/**
 * Quanto sobra de cada lote, sabendo só o saldo total do produto no congelador. O que sai é o mais antigo primeiro (FIFO),
 * então o saldo está nos lotes mais novos: preenche do mais novo para o mais antigo. Lote sem saldo já foi todo consumido.
 */
export function allocateLots(lots: Lot[], balance: number): LotWithBalance[] {
  let left = Math.max(0, Math.floor(balance));
  const newestFirst = [...lots].sort((a, b) => (a.producedOn === b.producedOn ? 0 : a.producedOn < b.producedOn ? 1 : -1));
  const withBalance = newestFirst.map((lot) => {
    const remaining = Math.min(lot.qty, left);
    left -= remaining;
    return { ...lot, remaining };
  });
  return withBalance.reverse(); // do mais antigo para o mais novo
}

export type ExpiringLot = { lot: LotWithBalance; daysLeft: number };

/** Lotes que ainda têm marmitas e vencem em até `withinDays` dias (ou já venceram), os que vencem antes primeiro. */
export function expiringSoon(lots: LotWithBalance[], today: string, withinDays = 15): ExpiringLot[] {
  return lots
    .flatMap((lot) => (lot.remaining > 0 && lot.expiresOn ? [{ lot, daysLeft: daysBetween(today, lot.expiresOn) }] : []))
    .filter((x) => x.daysLeft <= withinDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** "L0711": o lote do dia 07/11 (um por produção, então o dia basta para identificar). */
export const lotCode = (producedOn: string): string => `L${producedOn.slice(8, 10)}${producedOn.slice(5, 7)}`;
