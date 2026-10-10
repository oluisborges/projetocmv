import { NextResponse } from "next/server";

/**
 * Chamado todo dia pelo cron da Vercel (vercel.json). O Supabase gratuito pausa o projeto depois de uma semana sem
 * atividade; esta chamada diária mantém o banco acordado. Só aceita quem sabe o CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: "supabase não configurado" }, { status: 500 });

  const res = await fetch(`${url}/rest/v1/rpc/ping`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
  });
  return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 502 });
}
