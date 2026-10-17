import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MappedLine, MappedOrder, MenuProvider } from "../types";

export type Connection = {
  id: string;
  org_id: string;
  unit_id: string;
  provider: MenuProvider;
  status: "connected" | "error";
  phase: "history" | "done";
  history_cursor: string | null;
  lookback_from: string;
  last_incremental_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  merchant_name: string | null;
  orders_imported: number;
  pending_orders: number;
  locked_until: string | null;
};

const chunks = <T>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

/** Junta linhas repetidas do mesmo produto no mesmo pedido (o cardápio pode listar o mesmo item duas vezes). */
function mergeLines(lines: MappedLine[]): MappedLine[] {
  const by = new Map<string, MappedLine>();
  for (const l of lines) {
    const k = `${l.kind}|${l.key}`;
    const cur = by.get(k);
    by.set(k, cur ? { ...cur, qty: cur.qty + l.qty, total: Math.round((cur.total + l.total) * 100) / 100 } : l);
  }
  return [...by.values()];
}

/**
 * Grava pedidos já traduzidos (idempotente: reprocessar o mesmo pedido atualiza valores e refaz as linhas).
 * Produtos novos nascem sem vínculo; os existentes mantêm o vínculo que o dono fez.
 */
export async function saveOrders(db: SupabaseClient, conn: Pick<Connection, "id" | "org_id" | "unit_id" | "provider">, orders: MappedOrder[]) {
  if (orders.length === 0) return;

  // 1) produtos (nome e visto-por-último atualizam; o vínculo não é tocado)
  const products = new Map<string, { key: string; name: string; kind: string }>();
  for (const o of orders) for (const l of o.lines) products.set(`${l.kind}|${l.key}`, { key: l.key, name: l.name, kind: l.kind });
  const byKey = new Map<string, string>(); // external_key -> id
  const uniqueByKey = new Map([...products.values()].map((p) => [p.key, p]));
  for (const part of chunks([...uniqueByKey.values()], 200)) {
    const { error } = await db.from("menu_products").upsert(
      part.map((p) => ({ org_id: conn.org_id, provider: conn.provider, external_key: p.key, name: p.name, kind: p.kind, last_seen_at: new Date().toISOString() })),
      { onConflict: "org_id,provider,external_key" },
    );
    if (error) throw new Error(`produtos: ${error.message}`);
    const { data, error: e2 } = await db
      .from("menu_products")
      .select("id, external_key")
      .eq("org_id", conn.org_id)
      .eq("provider", conn.provider)
      .in("external_key", part.map((p) => p.key));
    if (e2) throw new Error(`produtos: ${e2.message}`);
    for (const r of data ?? []) byKey.set(r.external_key as string, r.id as string);
  }

  // 2) pedidos
  const orderIds = new Map<string, string>(); // external_id -> id
  for (const part of chunks(orders, 200)) {
    const { error } = await db.from("menu_orders").upsert(
      part.map((o) => ({
        org_id: conn.org_id, unit_id: conn.unit_id, connection_id: conn.id, external_id: o.externalId,
        ordered_at: o.orderedAt, total: o.total, discount: o.discount, delivery_fee: o.deliveryFee, channel: o.channel,
      })),
      { onConflict: "connection_id,external_id" },
    );
    if (error) throw new Error(`pedidos: ${error.message}`);
    const { data, error: e2 } = await db.from("menu_orders").select("id, external_id").eq("connection_id", conn.id).in("external_id", part.map((o) => o.externalId));
    if (e2) throw new Error(`pedidos: ${e2.message}`);
    for (const r of data ?? []) orderIds.set(r.external_id as string, r.id as string);
  }

  // 3) linhas: refaz as dos pedidos gravados
  const ids = [...orderIds.values()];
  for (const part of chunks(ids, 200)) {
    const { error } = await db.from("menu_order_lines").delete().eq("org_id", conn.org_id).in("order_id", part);
    if (error) throw new Error(`linhas: ${error.message}`);
  }
  const rows = orders.flatMap((o) => {
    const orderId = orderIds.get(o.externalId);
    if (!orderId) return [];
    return mergeLines(o.lines).flatMap((l) => {
      const productId = byKey.get(l.key);
      return productId && l.qty > 0 ? [{ org_id: conn.org_id, order_id: orderId, product_id: productId, qty: l.qty, line_total: l.total }] : [];
    });
  });
  for (const part of chunks(rows, 500)) {
    const { error } = await db.from("menu_order_lines").insert(part);
    if (error) throw new Error(`linhas: ${error.message}`);
  }
}

/** Tira da base pedidos que foram cancelados depois de entrar. As linhas saem junto (cascata). */
export async function removeOrders(db: SupabaseClient, connectionId: string, externalIds: string[]) {
  for (const part of chunks(externalIds, 200)) {
    await db.from("menu_orders").delete().eq("connection_id", connectionId).in("external_id", part);
  }
}

/** Quais destes pedidos já estão na base (para não buscar o detalhe de novo na carga). */
export async function knownOrderIds(db: SupabaseClient, connectionId: string, externalIds: string[]): Promise<Set<string>> {
  const known = new Set<string>();
  for (const part of chunks(externalIds, 200)) {
    const { data } = await db.from("menu_orders").select("external_id").eq("connection_id", connectionId).in("external_id", part);
    for (const r of data ?? []) known.add(r.external_id as string);
  }
  return known;
}
