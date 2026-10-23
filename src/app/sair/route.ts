import { NextResponse, type NextRequest } from "next/server";
import { VIEW_AS_COOKIE } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Encerra a sessão e volta para o login. É para onde o app manda quem tem uma sessão que não vale mais
 * (acesso bloqueado pelo Shogun, conta removida): sem isso o login devolveria a pessoa ao início, em laço.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const url = new URL("/login", request.url);
  if (request.nextUrl.searchParams.get("motivo") === "bloqueado") url.searchParams.set("motivo", "bloqueado");
  const response = NextResponse.redirect(url);
  response.cookies.delete(VIEW_AS_COOKIE);
  return response;
}
