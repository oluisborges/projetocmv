import { createHash } from "node:crypto";

/** Tentativas erradas permitidas por janela de 15 minutos. */
export const LOGIN_LIMITS = { perAccount: 5, perIp: 20 } as const;
export const LOGIN_WINDOW = "15 minutes";

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

/** IP de quem fez o pedido. Na Vercel o x-forwarded-for é definido pela própria Vercel (o primeiro é o cliente). */
export function clientIp(h: { get(name: string): string | null }): string {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || "desconhecido";
}

/** Chaves guardadas no banco: só hashes, nunca o e-mail ou o IP em texto. */
export function loginKeys(ip: string, email: string): { account: string; ip: string } {
  return { account: `acct:${hash(`${ip}|${email.trim().toLowerCase()}`)}`, ip: `ip:${hash(ip)}` };
}

/** Bloqueia quando a mesma pessoa+IP errou demais, ou quando o IP todo errou demais (testando vários e-mails). */
export function isOverLimit(counts: { account: number; ip: number }): boolean {
  return counts.account >= LOGIN_LIMITS.perAccount || counts.ip >= LOGIN_LIMITS.perIp;
}
