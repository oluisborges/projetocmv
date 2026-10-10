"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { clearLoginFailures, isLoginThrottled, keysForRequest, recordLoginFailure } from "@/lib/login-throttle";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

const schema = z.object({ email: z.email(), password: z.string().min(1) });

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: "Digite um e-mail válido e a sua senha." };

  const keys = await keysForRequest(parsed.data.email);
  if (await isLoginThrottled(keys)) {
    return { error: "Muitas tentativas seguidas. Por segurança, espere 15 minutos e tente de novo, ou peça ajuda à Shogun no grupo de WhatsApp." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // Mesma mensagem para e-mail inexistente e senha errada (não revela quais e-mails existem).
  if (error) {
    await recordLoginFailure(keys);
    return { error: "E-mail ou senha incorretos." };
  }

  await clearLoginFailures(keys);
  redirect("/");
}
