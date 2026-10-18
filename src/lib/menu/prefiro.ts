// Tradução dos pedidos da API da Prefiro Delivery (v2, autenticação Basic) para o nosso modelo. PURO: sem rede e sem banco.
// Documentação pública: https://documenter.getpostman.com/view/11644806/UVsEUokz (referência de campos: projetosecreto/src/lib/prefiro.ts)
import { cents, money, num, productKey, text, type MappedLine, type MappedOrder, type Raw } from "./types";

export const PREFIRO_API_HOST = "api.prefirodelivery.com";

/**
 * Extrai a hash do estabelecimento do que o admin colou: a hash pura ou uma URL da API (`https://api.prefirodelivery.com/HASH/v2`).
 * Qualquer outro domínio é recusado: o servidor só chama o domínio da Prefiro.
 */
export function parseHash(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{4,128}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || u.port || u.username || u.password) return null;
    if (u.hostname !== PREFIRO_API_HOST && u.hostname !== "api.prefirodelivery.net") return null;
    const first = u.pathname.split("/").filter(Boolean)[0] ?? "";
    return /^[A-Za-z0-9_-]{4,128}$/.test(first) ? first : null;
  } catch {
    return null;
  }
}

export const baseUrlOf = (hash: string) => `https://${PREFIRO_API_HOST}/${hash}/v2`;

/** Status da Prefiro: 1 Solicitado, 2 Em produção, 3 Pronto/saiu, 4 Entregue, 5 Cancelado, 6 Aguardando pagamento, 7 Saiu para entrega, 8 Expirado. */
export type OrderState = "sale" | "cancelled" | "open";

/** Venda = pedido que o estabelecimento aceitou (em produção em diante). Cancelado e expirado nunca viram venda. */
export function orderState(raw: Raw | null | undefined): OrderState {
  const st = raw?.status as { sku?: unknown } | number | string | undefined;
  const sku = Number(typeof st === "object" && st !== null ? st.sku : st);
  if (sku === 5 || sku === 8) return "cancelled";
  if (sku === 2 || sku === 3 || sku === 4 || sku === 7) return "sale";
  return "open";
}

/** "2022-03-07 13:58:11" (horário de Brasília, sem fuso no texto) → ISO com -03:00. */
export function toIso(raw: unknown): string | null {
  const m = text(raw).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)(Z|[+-]\d{2}:?\d{2})?/);
  if (!m) return null;
  const time = m[2].length === 5 ? `${m[2]}:00` : m[2];
  const iso = `${m[1]}T${time}${m[3] ?? "-03:00"}`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** Item da Prefiro (`nome`, `produto_id`, `quantidade`, `valor_total`, `complementos`, `sabores`). Complementos e sabores viram linhas de opção. */
export function mapLines(itens: unknown): MappedLine[] {
  const out: MappedLine[] = [];
  for (const i of (Array.isArray(itens) ? itens : []) as Raw[]) {
    const name = text(i?.nome);
    if (!name) continue;
    const qty = num(i.quantidade) || 1;
    const options: MappedLine[] = [];
    for (const c of (Array.isArray(i.complementos) ? i.complementos : []) as Raw[]) {
      const n = text(c?.nome);
      if (!n) continue;
      const oq = (num(c.quantidade) || 1) * qty;
      options.push({ key: productKey(c.opcao_id ?? c.produto_id, n), name: n, kind: "option", qty: oq, total: money(num(c.valor_unitario) * oq) });
    }
    for (const s of (Array.isArray(i.sabores) ? i.sabores : []) as Raw[]) {
      const n = text(s?.nome ?? s?.sabor);
      if (!n) continue;
      options.push({ key: productKey(s.sabor_id ?? s.produto_id ?? s.id, n), name: n, kind: "option", qty: (num(s.quantidade) || 1) * qty, total: money(num(s.valor_total ?? s.valor)) });
    }
    // valor_total do item inclui os complementos; a linha do item guarda só a parte própria. A confirmar com uma chave real.
    const own = num(i.valor_total) - options.reduce((sum, l) => sum + l.total, 0);
    out.push({ key: productKey(i.produto_id ?? i.sku, name), name, kind: "item", qty, total: money(own) }, ...options);
  }
  return out;
}

/** Pedido da API → venda. Devolve null para o que não é venda ou não tem o essencial (id, data, total). */
export function mapOrder(raw: Raw | null | undefined): MappedOrder | null {
  if (!raw || orderState(raw) !== "sale") return null;
  const id = text(raw.id);
  const orderedAt = toIso(raw.data);
  if (!id || !orderedAt || raw.total === undefined || raw.total === null) return null;
  return {
    externalId: `pf:${id}`,
    orderedAt,
    total: cents(num(raw.total)),
    discount: money(num(raw.desconto)),
    coupon: text(raw.cupom) ? text(raw.cupom).toUpperCase().slice(0, 60) : null,
    deliveryFee: money(num(raw.taxa_entrega)),
    channel: "prefiro",
    lines: mapLines(raw.itens),
  };
}

/** Corpo das respostas: `{ codigo, mensagem, data }`, com `data` em lista (até para um pedido só) ou objeto. */
export const dataOf = (body: Raw | null | undefined): Raw[] => (Array.isArray(body?.data) ? body.data : body?.data && typeof body.data === "object" ? [body.data] : []);

/** Webhook `{ referencia: 'Novo pedido', dados: { id, ... } }` → id do pedido (vazio se não houver). */
export function webhookOrderId(body: Raw | null | undefined): string {
  return text(body?.dados?.id ?? body?.data?.id ?? body?.id);
}

/** `YYYY-MM-DDTHH:MM:SS` no horário de Brasília, o formato dos filtros de data da API. */
export function apiDate(d: Date): string {
  return new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 19);
}
