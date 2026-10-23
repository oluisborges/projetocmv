"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminState = { error?: string; ok?: string };

const text = (max: number) => z.string().trim().min(1).max(max);
const email = z.email().transform((v) => v.trim().toLowerCase());
const password = z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72);
const role = z.enum(["owner", "manager", "viewer"]);

const fail = (error: string): AdminState => ({ error });

function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message && err.issues[0].message !== "Invalid input"
    ? err.issues[0].message
    : "Confira os campos e tente de novo.";
}

/** Cria o usuário já confirmado, com a senha definida pelo admin. */
type CreatedUser = { ok: true; userId: string } | { ok: false; error: string };

async function createUser(
  admin: ReturnType<typeof createAdminClient>,
  input: { email: string; password: string; fullName: string },
): Promise<CreatedUser> {
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
    // app_metadata só pode ser definido pelo servidor (o cliente não consegue forjar). O banco só aceita novas contas com esta marca.
    app_metadata: { admin_created: true },
  });
  if (error || !data.user) {
    const taken = /already|registered|exists/i.test(error?.message ?? "");
    return { ok: false, error: taken ? "Esse e-mail já tem conta." : "Não foi possível criar o usuário." };
  }

  // A senha foi escolhida por outra pessoa (e passou por mensagem): quem recebe precisa criar a própria no primeiro acesso.
  const { error: flagError } = await admin.from("profiles").update({ must_change_password: true }).eq("id", data.user.id);
  if (flagError) {
    await admin.auth.admin.deleteUser(data.user.id); // sem a obrigação de troca não deixamos a conta existir
    return { ok: false, error: "Não foi possível criar o usuário." };
  }
  return { ok: true, userId: data.user.id };
}

export async function createOrganization(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();

  const parsed = z
    .object({
      orgName: text(80),
      unitName: text(80),
      ownerName: text(80),
      ownerEmail: email,
      ownerPassword: password,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;

  const admin = createAdminClient();

  const user = await createUser(admin, { email: v.ownerEmail, password: v.ownerPassword, fullName: v.ownerName });
  if (!user.ok) return fail(user.error);

  const baseSlug = slugify(v.orgName);
  let org: { id: string } | null = null;
  for (const slug of [baseSlug, `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`]) {
    const { data, error } = await admin.from("organizations").insert({ name: v.orgName, slug }).select("id").single();
    if (!error) {
      org = data;
      break;
    }
    if (error.code !== "23505") break; // só repete se o slug já existia
  }
  if (!org) {
    await admin.auth.admin.deleteUser(user.userId);
    return fail("Não foi possível criar a marmitaria.");
  }

  const { error: memberError } = await admin.from("memberships").insert({ org_id: org.id, user_id: user.userId, role: "owner" });
  const { error: unitError } = await admin.from("units").insert({ org_id: org.id, name: v.unitName });
  if (memberError || unitError) {
    await admin.from("organizations").delete().eq("id", org.id); // apaga em cascata o que foi criado
    await admin.auth.admin.deleteUser(user.userId);
    return fail("Não foi possível terminar o cadastro. Nada foi criado.");
  }

  revalidatePath("/admin");
  return { ok: `${v.orgName} criada. O dono já pode entrar com ${v.ownerEmail}.` };
}

export async function addMember(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();

  const parsed = z
    .object({ orgId: z.uuid(), name: text(80), email, password, role })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;

  const admin = createAdminClient();
  const user = await createUser(admin, { email: v.email, password: v.password, fullName: v.name });
  if (!user.ok) return fail(user.error);

  const { error } = await admin.from("memberships").insert({ org_id: v.orgId, user_id: user.userId, role: v.role });
  if (error) {
    await admin.auth.admin.deleteUser(user.userId);
    return fail("Não foi possível ligar o usuário à marmitaria.");
  }

  revalidatePath("/admin");
  return { ok: `${v.name} adicionado(a).` };
}

export async function resetPassword(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();

  const parsed = z.object({ userId: z.uuid(), password }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(parsed.data.userId, { password: parsed.data.password });
  if (error) return fail("Não foi possível trocar a senha.");

  const { error: flagError } = await admin.from("profiles").update({ must_change_password: true }).eq("id", parsed.data.userId);
  if (flagError) return fail("A senha foi trocada, mas não deu para exigir a troca no primeiro acesso. Tente de novo.");

  return { ok: "Senha provisória definida. Passe para o cliente: no primeiro acesso ele cria a própria senha." };
}

/** Troca o e-mail de login. Já fica confirmado (o admin é quem garante que o endereço é da pessoa). */
export async function changeUserEmail(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();

  const parsed = z.object({ userId: z.uuid(), email }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Digite um e-mail válido.");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(parsed.data.userId, { email: parsed.data.email, email_confirm: true });
  if (error) {
    const taken = /already|registered|exists|duplicate/i.test(error.message);
    return fail(taken ? "Esse e-mail já tem conta." : "Não foi possível trocar o e-mail.");
  }

  revalidatePath("/admin");
  return { ok: `E-mail trocado. A pessoa entra agora com ${parsed.data.email} (a senha continua a mesma).` };
}

/** Bloqueia ou libera o acesso de um usuário. O bloqueio vale já: no login, na renovação da sessão e no banco (RLS). */
export async function setUserBlocked(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const me = await requireAdmin();

  const parsed = z.object({ userId: z.uuid(), blocked: z.enum(["1", "0"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Pedido inválido.");
  const { userId } = parsed.data;
  const block = parsed.data.blocked === "1";
  if (block && userId === me.userId) return fail("Você não pode bloquear a si mesmo.");

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("is_platform_admin").eq("id", userId).maybeSingle();
  if (!target) return fail("Usuário não encontrado.");
  if (block && target.is_platform_admin) return fail("Não dá para bloquear um admin Shogun.");

  // Primeiro o banco (fecha o acesso pela API), depois o Auth (não deixa entrar nem renovar). Se o Auth falhar, desfaz.
  const { error: flagError } = await admin.from("profiles").update({ blocked_at: block ? new Date().toISOString() : null }).eq("id", userId);
  if (flagError) return fail("Não foi possível alterar o acesso.");
  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: block ? BAN_FOREVER : "none" });
  if (banError) {
    await admin.from("profiles").update({ blocked_at: block ? null : new Date().toISOString() }).eq("id", userId);
    return fail("Não foi possível alterar o acesso.");
  }

  revalidatePath("/admin");
  return { ok: block ? "Acesso bloqueado. A pessoa não consegue mais entrar nem usar o app." : "Acesso liberado. A pessoa já pode entrar de novo." };
}

const BAN_FOREVER = "876000h"; // ~100 anos; "none" tira o bloqueio
