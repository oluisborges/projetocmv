const TZ = "America/Sao_Paulo";

/**
 * "há 5 min", "há 3 h", "ontem", "há 12 dias". Passando de 30 dias, a data. Sem data = "nunca".
 * Relógio adiantado (data no futuro) conta como "agora há pouco".
 */
export function timeAgo(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "nunca";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "nunca";
  const sec = Math.floor((now.getTime() - ms) / 1000);
  if (sec < 45) return "agora há pouco";
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${Math.max(1, min)} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days <= 30) return `há ${days} dias`;
  return new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ });
}

/** "17/10/2026 14:32" no horário de Brasília (para o texto que aparece ao passar o mouse). */
export function dateTimeBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: TZ });
}
