// Tradução dos pedidos da API do CardápioWeb (parceiros v1) para o nosso modelo. PURO: sem rede e sem banco.
// Referência: projetosecreto/replica/cardapioweb-integracao.md e https://docs.cardapioweb.com/llms.txt
import { cents, label, money, num, productKey, text, type MappedLine, type MappedOrder } from "./types";

export type CwOption = { name?: string | null; option_id?: number | string | null; quantity?: number | string | null; unit_price?: number | string | null };
export type CwItem = {
  name?: string | null;
  item_id?: number | string | null;
  quantity?: number | string | null;
  total_price?: number | string | null;
  unit_price?: number | string | null;
  options?: CwOption[] | null;
};

export type CwOrderDetail = {
  id: number | string;
  status: string;
  total: number | string;
  created_at: string;
  sales_channel?: string | null;
  delivery_fee?: number | string | null;
  discounts?: { category?: string | null; coupon_code?: string | null; total?: number | string | null }[] | null;
  items?: CwItem[] | null;
};

/**
 * Linhas do pedido. O valor do item (`total_price`) já inclui as opções, então a linha do item guarda só a parte própria
 * (total − opções) e cada opção vira uma linha à parte. **A confirmar com uma chave real** (veja o documento de desenho).
 */
export function mapLines(items: CwItem[] | null | undefined): MappedLine[] {
  const out: MappedLine[] = [];
  for (const it of items ?? []) {
    const name = label(it?.name);
    if (!name) continue;
    const qty = num(it.quantity) || 1;
    const options = (it.options ?? []).filter((o) => text(o?.name));
    const optionLines: MappedLine[] = options.map((o) => {
      const oq = (num(o.quantity) || 1) * qty;
      return { key: productKey(o.option_id, label(o.name)), name: label(o.name), kind: "option", qty: oq, total: money(num(o.unit_price) * oq) };
    });
    const own = num(it.total_price) || num(it.unit_price) * qty;
    const optionsTotal = optionLines.reduce((s, l) => s + l.total, 0);
    out.push({ key: productKey(it.item_id, name), name, kind: "item", qty, total: money(own - optionsTotal) }, ...optionLines);
  }
  return out;
}

/** Código do cupom do pedido: o primeiro desconto da categoria "coupon" que traz código. */
export function couponOf(discounts: CwOrderDetail["discounts"]): string | null {
  const c = (discounts ?? []).find((d) => d?.category === "coupon" && text(d?.coupon_code));
  return c ? text(c.coupon_code).toUpperCase().slice(0, 60) : null;
}

/** Só pedido `closed` vira venda. Cancelado e em andamento devolvem null. */
export function mapOrder(o: CwOrderDetail): MappedOrder | null {
  if (o.status !== "closed") return null;
  const total = num(o.total);
  if (!o.created_at || Number.isNaN(Date.parse(o.created_at)) || !Number.isFinite(Number(o.total)) || total < 0) return null;
  return {
    externalId: `cw:${o.id}`,
    orderedAt: new Date(o.created_at).toISOString(),
    total: cents(total),
    discount: money((o.discounts ?? []).reduce((s, d) => s + num(d?.total), 0)),
    coupon: couponOf(o.discounts),
    deliveryFee: money(num(o.delivery_fee)),
    channel: text(o.sales_channel) || null,
    lines: mapLines(o.items),
  };
}

/** Evento de webhook → id do pedido a buscar. Eventos desconhecidos ou sem id são ignorados. */
export function webhookOrderId(body: unknown): string | null {
  const b = body as { event_type?: unknown; order_id?: unknown } | null;
  if (!b || (b.event_type !== "ORDER_CREATED" && b.event_type !== "ORDER_STATUS_UPDATED")) return null;
  const id = Number(b.order_id);
  return Number.isInteger(id) && id > 0 ? String(id) : null;
}

/** Divide [from, to] em janelas de até `days` dias (o histórico recusa intervalos longos). */
export function windows(from: Date, to: Date, days = 90): { start: string; end: string }[] {
  const out: { start: string; end: string }[] = [];
  let cursor = from.getTime();
  while (cursor < to.getTime()) {
    const end = Math.min(cursor + days * 86_400_000, to.getTime());
    out.push({ start: new Date(cursor).toISOString(), end: new Date(end).toISOString() });
    cursor = end;
  }
  return out;
}
