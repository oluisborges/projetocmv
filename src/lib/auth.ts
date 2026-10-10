import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Membership = { role: "owner" | "manager" | "viewer"; org: { id: string; name: string } };

export type Session = {
  userId: string;
  email: string;
  fullName: string | null;
  isPlatformAdmin: boolean;
  /** A senha atual foi definida por outra pessoa (admin Shogun): precisa criar a própria antes de usar o app. */
  mustChangePassword: boolean;
  memberships: Membership[];
};

/** Sessão do usuário logado (uma consulta por requisição). `null` se não estiver logado. */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("full_name, is_platform_admin, must_change_password").eq("id", user.id).maybeSingle(),
    // Ordem fixa: se um dia houver mais de uma organização, a "ativa" é sempre a mais antiga.
    supabase.from("memberships").select("role, organizations(id, name)").eq("user_id", user.id).order("created_at"),
  ]);

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? null,
    isPlatformAdmin: profile?.is_platform_admin ?? false,
    mustChangePassword: profile?.must_change_password ?? false,
    memberships: (memberships ?? []).flatMap((m) => {
      const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
      return org ? [{ role: m.role as Membership["role"], org: { id: org.id, name: org.name } }] : [];
    }),
  };
});

export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  // Senha provisória: nada do app abre antes de a pessoa criar a própria (a tela de troca fica fora deste guarda).
  if (session.mustChangePassword) redirect("/conta/senha");
  return session;
}

export type Member = { session: Session; orgId: string; orgName: string; canWrite: boolean };

/**
 * Usuário de uma marmitaria. A organização vem SEMPRE da sessão (servidor), nunca de um campo do formulário.
 * Hoje cada usuário tem uma marmitaria; quem não tem (ex.: admin Shogun) volta para o início.
 */
export async function requireMember(): Promise<Member> {
  const session = await requireUser();
  const m = session.memberships[0];
  if (!m) redirect("/");
  return { session, orgId: m.org.id, orgName: m.org.name, canWrite: m.role !== "viewer" };
}

/** Só admin Shogun passa. Para qualquer outra pessoa a página simplesmente "não existe". */
export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  if (!session.isPlatformAdmin) notFound();
  return session;
}
