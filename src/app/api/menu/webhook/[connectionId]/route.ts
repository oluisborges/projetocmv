import { after, NextResponse, type NextRequest } from "next/server";
import { webhookOrderId as cwOrderId } from "@/lib/menu/cardapioweb";
import { webhookOrderId as pfOrderId } from "@/lib/menu/prefiro";
import { enqueue, loadConnection, lockConnection, runConnection } from "@/lib/menu/server/sync";
import { sameToken, type Raw } from "@/lib/menu/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AFTER_BUDGET_MS = 40_000;

/**
 * Aviso de pedido novo/alterado do CardápioWeb (token no cabeçalho X-Webhook-Token) ou da Prefiro (token na URL, ?t=).
 * Só valida, coloca o pedido na fila e responde 200 depressa; o detalhe é buscado logo depois da resposta.
 * Esta rota fica fora do login (veja o matcher do proxy): a autorização é o token da conexão.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await ctx.params;
  const token = request.headers.get("x-webhook-token") ?? request.nextUrl.searchParams.get("t") ?? "";
  if (!UUID.test(connectionId) || !token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = createAdminClient();
  const { data: cred } = await db.from("menu_credentials").select("webhook_token").eq("connection_id", connectionId).maybeSingle();
  if (!cred || !sameToken(token, cred.webhook_token as string)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const conn = await loadConnection(db, connectionId);
  if (!conn) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }
  const orderId = conn.provider === "cardapioweb" ? cwOrderId(body) : pfOrderId(body as Raw | null);
  if (!orderId) return NextResponse.json({ ok: true, ignored: true }); // outro tipo de evento: 200 para o provedor não desativar o aviso

  try {
    await enqueue(db, conn, [orderId], true);
  } catch {
    return NextResponse.json({ error: "Falha ao enfileirar" }, { status: 500 }); // 500: o provedor tenta de novo
  }

  after(async () => {
    // só escoa a fila: listar o histórico a cada aviso gastaria o limite de chamadas do provedor
    if (await lockConnection(db, connectionId, AFTER_BUDGET_MS)) await runConnection(db, connectionId, Date.now() + AFTER_BUDGET_MS, { queueOnly: true });
  });
  return NextResponse.json({ ok: true });
}
