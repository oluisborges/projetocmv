import { after, NextResponse, type NextRequest } from "next/server";
import { dispatchRun } from "@/lib/menu/server/dispatch";
import { lockConnection, runConnection } from "@/lib/menu/server/sync";
import { shouldChain } from "@/lib/menu/window";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Orçamento menor que o limite da função (60 s): sobra tempo para gravar o estado e chamar o próximo ciclo antes de a Vercel encerrar.
const BUDGET_MS = 40_000;

/**
 * Roda UM ciclo de UMA conexão. Chamada pelo cron (`/api/menu/cron`) e por si mesma: se ainda sobra trabalho (carga do histórico
 * ou fila de pedidos), pede o próximo ciclo ao terminar. Só aceita quem sabe o CRON_SECRET. Responde 202 na hora.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ connectionId: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });

  const { connectionId } = await ctx.params;
  if (!UUID.test(connectionId)) return NextResponse.json({ ok: false }, { status: 400 });
  const depth = Math.max(0, Number.parseInt(request.headers.get("x-chain-depth") ?? "0", 10) || 0);

  const db = createAdminClient();
  if (!(await lockConnection(db, connectionId, BUDGET_MS))) return NextResponse.json({ ok: true, busy: true }, { status: 202 }); // outro ciclo já está rodando

  const origin = new URL(request.url).origin;
  after(async () => {
    const r = await runConnection(db, connectionId, Date.now() + BUDGET_MS);
    // se este ciclo morrer antes daqui, a retomada vem do "kick" (telas abertas) e do cron diário
    if (shouldChain({ phase: r.phase, pending: r.pending, progressed: r.progressed, error: Boolean(r.error), depth })) await dispatchRun(origin, connectionId, depth + 1);
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}
