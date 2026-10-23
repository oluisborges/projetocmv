"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { clearLoginFailures, isLoginThrottled, keysForRequest, recordLoginFailure } from "@/lib/login-throttle";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error?: string;
  /** bloqueado por tentativas: a tela mostra o caminho do "esqueci a senha" */
  locked?: boolean;
  /** devolvido no erro para o campo de e-mail não esvaziar */
  email?: string;
};

/** Histórico de uso: anota a entrada (com a marmitaria da pessoa, se tiver). Falhar aqui nunca impede o login. */
async function logLogin(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: membership }, { data: profile }] = await Promise.all([
      supabase.from("memberships").select("org_id").eq("user_id", user.id).order("created_at").limit(1).maybeSingle(),
      supabase.from("profiles").select("is_platform_admin").eq("id", user.id).maybeSingle(),
    ]);
    const admin = Boolean(profile?.is_platform_admin);
    await supabase.from("activity_log").insert({
      org_id: membership?.org_id ?? null,
      user_id: user.id,
      by_admin: admin,
      kind: "login",
      summary: admin ? "Admin Shogun entrou no sistema" : "Entrou no sistema",
    });
  } catch {
    /* ignora */
  }
}

const schema = z.object({ email: z.email(), password: z.string().min(1) });

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: "Digite um e-mail válido e a sua senha." };

  const keys = await keysForRequest(parsed.data.email);
  if (await isLoginThrottled(keys)) {
    return { error: "Muitas tentativas seguidas. Por segurança, espere 15 minutos e tente de novo.", locked: true, email: parsed.data.email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // Mesma mensagem para e-mail inexistente e senha errada (não revela quais e-mails existem).
  if (error) {
    // O Auth só diz que o usuário está bloqueado depois de conferir a senha: quem chegou aqui sabe a senha certa.
    if (error.code === "user_banned") return { error: "O seu acesso está bloqueado. Fale com o Grupo Shogun.", email: parsed.data.email };
    await recordLoginFailure(keys);
    return { error: "E-mail ou senha incorretos.", email: parsed.data.email };
  }

  await clearLoginFailures(keys);
  await logLogin(supabase);
  redirect("/");
}
