"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

const schema = z.object({ email: z.email(), password: z.string().min(1) });

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: "Digite um e-mail válido e a sua senha." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // Mesma mensagem para e-mail inexistente e senha errada (não revela quais e-mails existem).
  if (error) return { error: "E-mail ou senha incorretos." };

  redirect("/");
}
