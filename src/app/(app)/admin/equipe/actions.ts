"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminState } from "../actions";

const fail = (error: string): AdminState => ({ error });
const staffRole = z.enum(["admin", "manager"]);

/** Cria uma pessoa da equipe Shogun já confirmada, com senha provisória (ela cria a própria no primeiro acesso). */
export async function createStaffUser(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(80),
      email: z.email().transform((v) => v.trim().toLowerCase()),
      password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72),
      role: staffRole,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message && parsed.error.issues[0].message !== "Invalid input" ? parsed.error.issues[0].message : "Confira os campos e tente de novo.");
  const v = parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    user_metadata: { full_name: v.name },
    app_metadata: { admin_created: true },
  });
  if (error || !data.user) return fail(/already|registered|exists/i.test(error?.message ?? "") ? "Esse e-mail já tem conta." : "Não foi possível criar o usuário.");

  const { error: profileError } = await admin
    .from("profiles")
    .update({ must_change_password: true, is_platform_admin: v.role === "admin", staff_role: v.role === "manager" ? "manager" : null })
    .eq("id", data.user.id);
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return fail("Não foi possível criar o usuário.");
  }

  revalidatePath("/admin/equipe");
  return { ok: `${v.name} criado(a) como ${v.role === "admin" ? "admin" : "gestor"}. Passe o e-mail e a senha provisória: no primeiro acesso a pessoa cria a própria.` };
}

/** Troca entre admin e gestor. Não deixa o último admin virar gestor, nem você mesmo. */
export async function setStaffRole(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const me = await requireAdmin();
  const parsed = z.object({ userId: z.uuid(), role: staffRole }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Pedido inválido.");
  const { userId, role } = parsed.data;
  if (userId === me.userId && role !== "admin") return fail("Você não pode tirar o próprio acesso de admin.");

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("is_platform_admin, staff_role").eq("id", userId).maybeSingle();
  if (!target || (!target.is_platform_admin && target.staff_role !== "manager")) return fail("Essa pessoa não é da equipe Shogun.");

  const { error } = await admin
    .from("profiles")
    .update({ is_platform_admin: role === "admin", staff_role: role === "manager" ? "manager" : null })
    .eq("id", userId);
  if (error) return fail("Não foi possível trocar o papel.");
  // Admin enxerga tudo: as liberações antigas de gestor não valem mais.
  if (role === "admin") await admin.from("staff_org_access").delete().eq("user_id", userId);

  revalidatePath("/admin/equipe");
  return { ok: role === "admin" ? "Agora é admin." : "Agora é gestor: só vê os clientes que você liberar." };
}

/** Define quais clientes um gestor pode ver (substitui a lista inteira). */
export async function setStaffAccess(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const userId = z.uuid().safeParse(formData.get("userId"));
  const orgIds = z.array(z.uuid()).safeParse(formData.getAll("orgIds"));
  if (!userId.success || !orgIds.success) return fail("Pedido inválido.");

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("staff_role").eq("id", userId.data).maybeSingle();
  if (target?.staff_role !== "manager") return fail("Só gestores têm lista de clientes liberados.");

  const { error: delError } = await admin.from("staff_org_access").delete().eq("user_id", userId.data);
  if (delError) return fail("Não foi possível salvar.");
  if (orgIds.data.length > 0) {
    const { error } = await admin.from("staff_org_access").insert(orgIds.data.map((org_id) => ({ user_id: userId.data, org_id })));
    if (error) return fail("Não foi possível salvar.");
  }

  revalidatePath("/admin/equipe");
  return { ok: orgIds.data.length === 0 ? "Nenhum cliente liberado." : `${orgIds.data.length} ${orgIds.data.length === 1 ? "cliente liberado" : "clientes liberados"}.` };
}
