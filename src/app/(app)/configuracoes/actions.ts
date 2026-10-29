"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveOrg, requireUser } from "@/lib/auth";
import { clearLoginFailures, isLoginThrottled, keysForRequest, recordLoginFailure } from "@/lib/login-throttle";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { error?: string; ok?: string };

const VIEW_AS = "As configurações ficam desligadas no \"Ver como\": elas são do cliente.";

const name = z.string().trim().min(2, "Digite pelo menos 2 letras.").max(80, "Use no máximo 80 letras.");

/** O nome da pessoa (aparece no "Olá, …" do Início). */
export async function saveProfileName(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const session = await requireUser();
  if ((await getActiveOrg())?.viewingAs) return { error: VIEW_AS };
  const parsed = name.safeParse(String(formData.get("name") ?? ""));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira o nome." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data }).eq("id", session.userId);
  if (error) return { error: "Não foi possível salvar o nome." };
  revalidatePath("/", "layout");
  return { ok: "Nome salvo." };
}

/** O nome da marmitaria (aparece no cabeçalho e nos relatórios). Só o dono. */
export async function saveCompanyName(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const session = await requireUser();
  const active = await getActiveOrg();
  if (active?.viewingAs) return { error: VIEW_AS };
  const membership = session.memberships[0];
  if (!membership || membership.role !== "owner") return { error: "Só o dono da marmitaria pode mudar o nome da empresa." };
  const parsed = name.safeParse(String(formData.get("company") ?? ""));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira o nome." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").update({ name: parsed.data }).eq("id", membership.org.id).select("id").maybeSingle();
  if (error || !data) return { error: "Não foi possível salvar o nome da empresa." };
  revalidatePath("/", "layout");
  return { ok: "Nome da empresa salvo." };
}

const passwordSchema = z.object({
  current: z.string().min(1, "Digite a senha atual."),
  password: z.string().min(8, "A senha nova precisa ter pelo menos 8 caracteres.").max(72, "A senha pode ter no máximo 72 caracteres."),
  confirm: z.string(),
});

/** Troca a senha pedindo a atual (e freando tentativas, como no login). */
export async function changeOwnPassword(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const session = await requireUser();
  if ((await getActiveOrg())?.viewingAs) return { error: VIEW_AS };
  const parsed = passwordSchema.safeParse({ current: String(formData.get("current") ?? ""), password: String(formData.get("password") ?? ""), confirm: String(formData.get("confirm") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos." };
  if (parsed.data.password !== parsed.data.confirm) return { error: "As duas senhas novas não são iguais." };
  if (parsed.data.password === parsed.data.current) return { error: "Escolha uma senha diferente da atual." };

  const keys = await keysForRequest(session.email);
  if (await isLoginThrottled(keys)) return { error: "Muitas tentativas seguidas. Espere 15 minutos e tente de novo." };

  const supabase = await createClient();
  const { error: checkError } = await supabase.auth.signInWithPassword({ email: session.email, password: parsed.data.current });
  if (checkError) {
    await recordLoginFailure(keys);
    return { error: "A senha atual não confere." };
  }
  await clearLoginFailures(keys);

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.code === "same_password" ? "Escolha uma senha diferente da atual." : "Não foi possível trocar a senha. Tente de novo." };

  try {
    await createAdminClient().from("profiles").update({ must_change_password: false }).eq("id", session.userId);
  } catch {
    // ambiente sem chave secreta
  }
  return { ok: "Senha trocada. Use a nova na próxima vez que entrar." };
}
