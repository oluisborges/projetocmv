import { NextResponse } from "next/server";
import { dispatchRun } from "@/lib/menu/server/dispatch";
import { connectionsDue } from "@/lib/menu/server/sync";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

/**
 * Cron da Vercel (vercel.json), 1× por dia à meia-noite de Brasília (03:00 UTC). Não sincroniza nada aqui: descobre quais conexões
 * estão devendo e pede a cada uma que rode na sua própria função (`/api/menu/run/[id]`), em paralelo. Assim o tempo total não cresce
 * com o número de clientes. Só aceita quem sabe o CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });

  const db = createAdminClient();
  const ids = await connectionsDue(db);
  const origin = new URL(request.url).origin;
  const results = await Promise.all(ids.map((id) => dispatchRun(origin, id)));
  return NextResponse.json({ ok: true, due: ids.length, dispatched: results.filter(Boolean).length });
}
