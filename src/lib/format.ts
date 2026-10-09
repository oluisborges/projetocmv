const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl4 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 4 });

export const formatBRL = (v: number | string): string => brl.format(Number(v));
/** Para custos pequenos (R$ 0,0140 por grama) que perdem sentido em 2 casas. */
export const formatBRLPrecise = (v: number | string): string => brl4.format(Number(v));

export function formatNumber(v: number | string, maxDigits = 3): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: maxDigits }).format(Number(v));
}

/** Percentual a partir de fração: 0.085 -> "8,5%". */
export const formatPct = (fraction: number | string, digits = 1): string =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(Number(fraction) * 100)}%`;

/**
 * Lê o que o dono digitou: "14,5", "R$ 1.234,56", "14.5" -> número como texto ("14.5", "1234.56").
 * Devolve `null` se não for um número válido. Só aceita sinal de menos quando `allowNegative`.
 */
export function parseDecimal(input: string, { allowNegative = false }: { allowNegative?: boolean } = {}): string | null {
  let s = input.replace(/R\$|\s/g, "");
  if (!s) return null;

  const negative = s.startsWith("-");
  if (negative) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s)) return null;

  if (s.includes(",")) {
    // Vírgula é o decimal; pontos são separador de milhar.
    if ((s.match(/,/g) ?? []).length > 1) return null;
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ""); // "1.234" / "12.345.678": milhar
  } else if ((s.match(/\./g) ?? []).length > 1) {
    return null;
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  if (negative && !allowNegative) return null;
  return negative ? `-${s}` : s;
}

export const UNIT_LABEL: Record<string, string> = { kg: "kg", g: "g", l: "litro", ml: "ml", un: "un" };

/** "R$ 14,00 por 1 kg" -> parte "1 kg"; "100 un" etc. */
export function formatPurchaseSize(qty: number | string, unit: string): string {
  return `${formatNumber(qty)} ${UNIT_LABEL[unit] ?? unit}`;
}

export function daysSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}

export function formatAge(days: number): string {
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? "há 1 mês" : `há ${months} meses`;
}

/** Preço sem atualização há mais de 30 dias merece aviso. */
export const STALE_DAYS = 30;
