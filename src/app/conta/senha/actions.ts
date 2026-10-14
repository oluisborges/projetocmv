"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PasswordState = { error?: string };

const schema = z.object({
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72, "A senha pode ter no máximo 72 caracteres."),
  confirm: z.string(),
});

/** Cada pessoa cria a própria senha. A senha provisória que o Grupo Shogun passou deixa de valer. */
export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const session = await getSession(); // não passa por requireUser: esta é a tela que resolve a troca obrigatória
  if (!session) redirect("/login");

  const parsed = schema.safeParse({ password: String(formData.get("password") ?? ""), confirm: String(formData.get("confirm") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos." };
  if (parsed.data.password !== parsed.data.confirm) return { error: "As duas senhas não são iguais." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const same = /same|different|diferente/i.test(error.message) || error.code === "same_password";
    return { error: same ? "Escolha uma senha diferente da atual." : "Não foi possível trocar a senha. Tente de novo." };
  }

  // Só o servidor desmarca a obrigação (o cliente não escreve esta coluna). Sem a chave secreta (desenvolvimento local), segue sem desmarcar.
  try {
    await createAdminClient().from("profiles").update({ must_change_password: false }).eq("id", session.userId);
  } catch {
    // ambiente sem chave secreta
  }

  redirect("/");
}
