import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapOrder as cwMapOrder } from "../cardapioweb";
import { mapOrder as pfMapOrder, orderState } from "../prefiro";
import type { MappedOrder, Raw } from "../types";
import { AuthError, RangeRefusedError, TransientError, cardapiowebClient, prefiroClient } from "./http";
import { knownOrderIds, removeOrders, saveOrders, type Connection } from "./store";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
/** Espaço de tempo reservado para fechar o ciclo e gravar o estado antes do limite da função. */
const SAFETY_MS = 6_000;
const DETAIL_BATCH = 25;
const MAX_ATTEMPTS = 3;
const CW_SPAN_DAYS = 30; // janela do histórico; a API recusa intervalos longos
const CW_MIN_SPAN_DAYS = 7;
const PF_SPAN_DAYS = 15; // a Prefiro lista 15 dias por padrão
const PF_OVERLAP_MS = 15 * 60_000;
/** Sem conferir há mais que isso: volta a listar por janelas (uma consulta só poderia ser recusada pela API). */
const MAX_INCREMENTAL_GAP_MS = 14 * DAY_MS;

export type SyncSummary = {
  connectionId: string;
  ordersSaved: number;
  phase: Connection["phase"];
  /** Pedidos ainda esperando o detalhe na fila. */
  pending: number;
  /** O ciclo avançou (gravou pedidos, andou no histórico ou terminou a carga)? Base para encadear outro ciclo. */
  progressed: boolean;
  error?: string;
};

export type RunOptions = {
  /** Só escoa a fila (aviso do webhook): não lista o histórico, para não gastar o limite de chamadas do provedor. */
  queueOnly?: boolean;
};

type Creds = { api_key: string; config: { hash?: string } };

/** Resultado de buscar um pedido avisado pelo webhook (ou listado pelo histórico). */
type Fetched = { order: MappedOrder | null; gone: boolean } | null; // null = não encontrado

const COLUMNS =
  "id, org_id, unit_id, provider, status, phase, history_cursor, lookback_from, last_incremental_at, last_sync_at, last_error, merchant_name, orders_imported";

async function setState(db: SupabaseClient, id: string, patch: Record<string, unknown>) {
  await db.from("menu_connections").update(patch).eq("id", id);
}

/** Pega a trava de execução; false se outra execução está em andamento. */
export async function lockConnection(db: SupabaseClient, id: string, budgetMs: number): Promise<boolean> {
  const now = new Date();
  const until = new Date(now.getTime() + budgetMs + 30_000).toISOString();
  const { data } = await db
    .from("menu_connections")
    .update({ locked_until: until })
    .eq("id", id)
    .or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`)
    .select("id");
  return Boolean(data?.length);
}

export async function loadConnection(db: SupabaseClient, id: string): Promise<Connection | null> {
  const { data } = await db.from("menu_connections").select(COLUMNS).eq("id", id).maybeSingle();
  return (data as Connection | null) ?? null;
}

async function loadCreds(db: SupabaseClient, id: string): Promise<Creds | null> {
  const { data } = await db.from("menu_credentials").select("api_key, config").eq("connection_id", id).maybeSingle();
  return (data as Creds | null) ?? null;
}

// ---------------------------------------------------------------- fila (pedidos avisados pelo webhook ou listados pelo histórico)

export async function enqueue(db: SupabaseClient, conn: Pick<Connection, "id" | "org_id">, orderIds: string[], reopen = false) {
  for (let i = 0; i < orderIds.length; i += 500) {
    const rows = orderIds.slice(i, i + 500).map((order_id) => ({ connection_id: conn.id, org_id: conn.org_id, order_id, state: "pending", attempts: 0, last_error: null }));
    // webhook reabre o pedido (o status pode ter mudado); o histórico só acrescenta o que ainda não estava na fila
    await db.from("menu_order_queue").upsert(rows, { onConflict: "connection_id,order_id", ignoreDuplicates: !reopen });
  }
}

async function drainQueue(db: SupabaseClient, conn: Connection, fetchOne: (id: string) => Promise<Fetched>, deadline: number): Promise<number> {
  let processed = 0;
  while (Date.now() < deadline - SAFETY_MS) {
    const { data: batch } = await db
      .from("menu_order_queue")
      .select("order_id, attempts")
      .eq("connection_id", conn.id)
      .eq("state", "pending")
      .order("created_at")
      .limit(DETAIL_BATCH);
    if (!batch?.length) break;

    const sales: MappedOrder[] = [];
    const gone: string[] = [];
    const settle: { order_id: string; state: string; attempts: number; last_error: string | null }[] = [];
    let stop = false;
    for (const q of batch as { order_id: string; attempts: number }[]) {
      if (Date.now() > deadline - SAFETY_MS) break;
      try {
        const r = await fetchOne(q.order_id);
        if (!r) settle.push({ order_id: q.order_id, state: "skipped", attempts: q.attempts, last_error: "não encontrado" });
        else {
          if (r.order) sales.push(r.order);
          if (r.gone) gone.push(`${conn.provider === "cardapioweb" ? "cw" : "pf"}:${q.order_id}`);
          settle.push({ order_id: q.order_id, state: r.order ? "done" : "skipped", attempts: q.attempts, last_error: null });
        }
      } catch (e) {
        if (e instanceof AuthError) throw e;
        const attempts = q.attempts + 1;
        settle.push({ order_id: q.order_id, state: attempts >= MAX_ATTEMPTS ? "failed" : "pending", attempts, last_error: (e instanceof Error ? e.message : String(e)).slice(0, 300) });
        if (e instanceof TransientError && attempts < MAX_ATTEMPTS) {
          stop = true; // provedor instável: para e tenta no próximo ciclo
          break;
        }
      }
    }
    await saveOrders(db, conn, sales);
    if (gone.length) await removeOrders(db, conn.id, gone);
    for (const s of settle) {
      await db.from("menu_order_queue").update({ state: s.state, attempts: s.attempts, last_error: s.last_error }).eq("connection_id", conn.id).eq("order_id", s.order_id);
    }
    processed += settle.length;
    if (stop || settle.length === 0 || settle.every((s) => s.state === "pending")) break;
  }
  return processed;
}

// ---------------------------------------------------------------- CardápioWeb

async function syncCardapioweb(db: SupabaseClient, conn: Connection, creds: Creds, deadline: number, opts: RunOptions): Promise<{ saved: number; phase: Connection["phase"]; note?: string }> {
  const cw = cardapiowebClient(creds.api_key);
  const fetchOne = async (id: string): Promise<Fetched> => {
    const d = await cw.detail(id);
    if (!d) return null;
    if (d.status === "canceled") return { order: null, gone: true };
    return { order: cwMapOrder(d), gone: false };
  };

  if (opts.queueOnly) return { saved: await drainQueue(db, conn, fetchOne, deadline), phase: conn.phase };

  let saved = 0;
  let phase = conn.phase;
  let cursor = new Date(conn.history_cursor ?? conn.lookback_from);
  let span = CW_SPAN_DAYS;
  let note: string | undefined;

  const listWindow = async (start: Date, end: Date) => {
    for (let page = 1; ; page++) {
      const body = await cw.history(start.toISOString(), end.toISOString(), page);
      const ids = (body?.orders ?? []).map((o) => String(o.id));
      const known = await knownOrderIds(db, conn.id, ids.map((x) => `cw:${x}`));
      await enqueue(db, conn, ids.filter((x) => !known.has(`cw:${x}`)));
      if (page >= (body?.pagination?.total_pages ?? 1)) break;
    }
  };

  while (Date.now() < deadline - SAFETY_MS) {
    if (phase === "history") {
      const now = new Date();
      if (cursor.getTime() >= now.getTime() - 60_000) {
        phase = "done";
        await setState(db, conn.id, { phase, history_cursor: now.toISOString(), last_incremental_at: now.toISOString() });
        continue;
      }
      const end = new Date(Math.min(cursor.getTime() + span * DAY_MS, now.getTime()));
      try {
        await listWindow(cursor, end);
      } catch (e) {
        if (!(e instanceof RangeRefusedError)) throw e;
        if (span > CW_MIN_SPAN_DAYS) {
          span = CW_MIN_SPAN_DAYS; // a API recusou: tenta janelas menores
          continue;
        }
        // nem a janela mínima: pula o trecho e avisa (nada fica escondido)
        note = `O CardápioWeb recusou o trecho de ${cursor.toISOString().slice(0, 10)} a ${end.toISOString().slice(0, 10)}: ${e.message.replace(/\s+/g, " ").slice(0, 100)}`;
      }
      cursor = end;
      await setState(db, conn.id, { history_cursor: cursor.toISOString() });
      // grava o que já foi listado, para os meses recentes aparecerem sem esperar a carga inteira
      saved += await drainQueue(db, conn, fetchOne, Math.min(deadline, Date.now() + 30_000));
    } else {
      // em dia: confere o que mudou desde a última vez e escoa a fila do webhook
      const from = new Date((conn.last_incremental_at ? Date.parse(conn.last_incremental_at) : Date.now() - 2 * DAY_MS) - HOUR_MS);
      if (Date.now() - from.getTime() > MAX_INCREMENTAL_GAP_MS) {
        // ficou muito tempo sem conferir (falha, conexão pausada): refaz por janelas a partir de onde parou
        phase = "history";
        cursor = from;
        await setState(db, conn.id, { phase, history_cursor: from.toISOString() });
        continue;
      }
      const startedAt = new Date();
      await listWindow(from, new Date());
      saved += await drainQueue(db, conn, fetchOne, deadline);
      await setState(db, conn.id, { last_incremental_at: startedAt.toISOString() });
      break;
    }
  }
  if (phase === "done") saved += await drainQueue(db, conn, fetchOne, deadline);
  return { saved, phase, note };
}

// ---------------------------------------------------------------- Prefiro

async function syncPrefiro(db: SupabaseClient, conn: Connection, creds: Creds, deadline: number, opts: RunOptions): Promise<{ saved: number; phase: Connection["phase"]; note?: string }> {
  const hash = creds.config.hash;
  if (!hash) throw new AuthError("Hash do estabelecimento não encontrada. Conecte de novo.");
  const pf = prefiroClient(hash, creds.api_key);

  const fetchOne = async (id: string): Promise<Fetched> => {
    const raw = await pf.detail(id);
    if (!raw) return null;
    const state = orderState(raw);
    if (state === "cancelled") return { order: null, gone: true };
    return { order: pfMapOrder(raw), gone: false };
  };

  /** Aplica pedidos lidos da lista: grava as vendas e tira da base o que foi cancelado. Pedido sem itens na lista busca o detalhe. */
  const apply = async (raws: Raw[]) => {
    const sales: MappedOrder[] = [];
    const gone: string[] = [];
    for (const raw of raws) {
      const state = orderState(raw);
      if (state === "cancelled") {
        if (raw?.id !== undefined) gone.push(`pf:${raw.id}`);
      } else if (state === "sale") {
        const full = Array.isArray(raw.itens) ? raw : ((await pf.detail(String(raw.id)).catch(() => null)) ?? raw);
        const m = pfMapOrder(full);
        if (m) sales.push(m);
      }
    }
    await saveOrders(db, conn, sales);
    if (gone.length) await removeOrders(db, conn.id, gone);
    return sales.length;
  };

  if (opts.queueOnly) return { saved: await drainQueue(db, conn, fetchOne, deadline), phase: conn.phase };

  let saved = 0;
  let phase = conn.phase;
  let cursor = new Date(conn.history_cursor ?? conn.lookback_from);
  let note: string | undefined;

  while (Date.now() < deadline - SAFETY_MS) {
    if (phase === "history") {
      const now = new Date();
      if (cursor.getTime() >= now.getTime() - 60_000) {
        phase = "done";
        await setState(db, conn.id, { phase, history_cursor: now.toISOString(), last_incremental_at: now.toISOString() });
        continue;
      }
      // janelas de até 15 dias; se a API recusar, divide até 1 dia; se nem assim, avisa e segue
      let span = PF_SPAN_DAYS;
      for (;;) {
        const to = new Date(Math.min(cursor.getTime() + span * DAY_MS, now.getTime()));
        const r = await pf.orders(cursor, to);
        if (r.ok) {
          saved += await apply(r.data);
          cursor = to;
          break;
        }
        if (span > 1) span = Math.max(1, Math.floor(span / 2));
        else {
          note = `A Prefiro não devolveu os pedidos de ${cursor.toISOString().slice(0, 10)} (HTTP ${r.status}).`;
          cursor = new Date(cursor.getTime() + DAY_MS);
          break;
        }
      }
      await setState(db, conn.id, { history_cursor: cursor.toISOString() });
    } else {
      // em dia: pedidos criados ou alterados desde a última conferência (pega novos, mudança de status e cancelamento)
      const startedAt = new Date();
      const since = new Date((conn.last_incremental_at ? Date.parse(conn.last_incremental_at) : Date.now() - DAY_MS) - PF_OVERLAP_MS);
      if (Date.now() - since.getTime() > MAX_INCREMENTAL_GAP_MS) {
        phase = "history";
        cursor = since;
        await setState(db, conn.id, { phase, history_cursor: since.toISOString() });
        continue;
      }
      let r = await pf.orders(since, new Date(Date.now() + DAY_MS), "updated");
      if (!r.ok && (r.status === 400 || r.status === 422)) r = await pf.recent(); // sem filtro por atualização: usa os últimos 15 dias
      if (!r.ok) throw new TransientError(`HTTP ${r.status}: ${r.raw}`);
      saved += await apply(r.data);
      saved += await drainQueue(db, conn, fetchOne, deadline);
      await setState(db, conn.id, { last_incremental_at: startedAt.toISOString() });
      break;
    }
  }
  if (phase === "done" && Date.now() < deadline - SAFETY_MS) saved += await drainQueue(db, conn, fetchOne, deadline);
  return { saved, phase, note };
}

// ---------------------------------------------------------------- ciclo

/**
 * Um ciclo de trabalho para uma conexão, dentro do orçamento de tempo. Quem chama já pegou a trava (`lockConnection`).
 * Nunca lança: o resultado (ou o erro) fica registrado na conexão.
 */
export async function runConnection(db: SupabaseClient, connectionId: string, deadline: number, opts: RunOptions = {}): Promise<SyncSummary> {
  const conn = await loadConnection(db, connectionId);
  if (!conn) return { connectionId, ordersSaved: 0, phase: "history", pending: 0, progressed: false, error: "conexão não encontrada" };
  try {
    const creds = await loadCreds(db, connectionId);
    if (!creds) throw new AuthError("Credenciais não encontradas. Conecte de novo.");
    const r = conn.provider === "cardapioweb" ? await syncCardapioweb(db, conn, creds, deadline, opts) : await syncPrefiro(db, conn, creds, deadline, opts);
    const { count } = await db.from("menu_orders").select("id", { count: "exact", head: true }).eq("connection_id", connectionId);
    await setState(db, connectionId, {
      status: "connected", last_error: r.note ?? null, last_sync_at: new Date().toISOString(), locked_until: null, orders_imported: count ?? 0,
    });
    const after = await loadConnection(db, connectionId);
    const { count: pending } = await db.from("menu_order_queue").select("order_id", { count: "exact", head: true }).eq("connection_id", connectionId).eq("state", "pending");
    return {
      connectionId,
      ordersSaved: r.saved,
      phase: r.phase,
      pending: pending ?? 0,
      progressed: r.saved > 0 || r.phase !== conn.phase || after?.history_cursor !== conn.history_cursor,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await setState(db, connectionId, {
      status: e instanceof AuthError ? "error" : "connected", last_error: msg.slice(0, 400), last_sync_at: new Date().toISOString(), locked_until: null,
    });
    return { connectionId, ordersSaved: 0, phase: conn.phase, pending: 0, progressed: false, error: msg };
  }
}

/**
 * Conexões que o cron deve rodar agora: carga inicial em andamento, fila com pedidos esperando, ou em dia mas sem conferência
 * há mais de 12 h (o cron roda 1× por dia, à meia-noite de Brasília; a folga absorve a imprecisão do horário do cron).
 */
export async function connectionsDue(db: SupabaseClient, now = new Date()): Promise<string[]> {
  const { data: all } = await db.from("menu_connections").select("id, phase, last_incremental_at").eq("status", "connected");
  const { data: waiting } = await db.from("menu_order_queue").select("connection_id").eq("state", "pending").limit(1000);
  const waitingIds = new Set((waiting ?? []).map((r) => r.connection_id as string));
  return (all ?? [])
    .filter((c) => c.phase === "history" || waitingIds.has(c.id as string) || !c.last_incremental_at || now.getTime() - Date.parse(c.last_incremental_at as string) > 12 * HOUR_MS)
    .map((c) => c.id as string);
}
