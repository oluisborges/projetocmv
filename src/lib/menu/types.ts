import { normalizeName } from "@/lib/names";

export type MenuProvider = "cardapioweb" | "prefiro";

export const PROVIDER_LABEL: Record<MenuProvider, string> = { cardapioweb: "CardápioWeb", prefiro: "Prefiro Delivery" };

/** Linha de um pedido, no formato único que o app guarda (os dois provedores são traduzidos para ele). */
export type MappedLine = {
  /** Chave estável do produto: id do cardápio, ou o nome normalizado quando o provedor não dá id. */
  key: string;
  name: string;
  /** "item" = o produto pedido; "option" = complemento, sabor ou adicional dele. */
  kind: "item" | "option";
  qty: number;
  /** Valor da linha em reais. */
  total: number;
};

/** Pedido que virou venda, já traduzido. `orderedAt` é um instante ISO com fuso. */
export type MappedOrder = {
  externalId: string;
  orderedAt: string;
  total: number;
  discount: number;
  /** Código do cupom usado no pedido (maiúsculas); `null` = o pedido não traz código (desconto de fidelidade, etc.). */
  coupon: string | null;
  deliveryFee: number;
  channel: string | null;
  lines: MappedLine[];
};

/** JSON cru de um provedor: o formato não é controlado por nós, então cada campo é conferido ao ler. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Raw = Record<string, any>;

export const cents = (n: number) => Math.round(n * 100) / 100;
export const money = (n: number) => Math.max(0, cents(n));

export const text = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

export const num = (v: unknown): number => {
  const n = Number(typeof v === "string" ? v.replace(",", ".") : v);
  return Number.isFinite(n) ? n : 0;
};

/** Chave do produto: o id do cardápio quando existe; senão o nome normalizado (marcado para não colidir com ids). */
export function productKey(id: unknown, name: string): string {
  const raw = text(id);
  return raw ? `id:${raw}` : `nm:${normalizeName(name)}`;
}

/** Comparação em tempo constante do token do webhook. */
export function sameToken(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
