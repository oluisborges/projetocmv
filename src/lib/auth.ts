import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
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
  /** Acesso bloqueado pelo admin Shogun. */
  blocked: boolean;
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
    supabase.from("profiles").select("full_name, is_platform_admin, must_change_password, blocked_at").eq("id", user.id).maybeSingle(),
    // Ordem fixa: se um dia houver mais de uma organização, a "ativa" é sempre a mais antiga.
    supabase.from("memberships").select("role, organizations(id, name)").eq("user_id", user.id).order("created_at"),
  ]);

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? null,
    isPlatformAdmin: profile?.is_platform_admin ?? false,
    mustChangePassword: profile?.must_change_password ?? false,
    blocked: Boolean(profile?.blocked_at),
    memberships: (memberships ?? []).flatMap((m) => {
      const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
      return org ? [{ role: m.role as Membership["role"], org: { id: org.id, name: org.name } }] : [];
    }),
  };
});

export async function requireUser(): Promise<Session> {
  const session = await getSession();
  // Sessão que o Auth não aceita mais (usuário bloqueado ou removido): encerra e volta ao login.
  if (!session) redirect("/sair");
  if (session.blocked) redirect("/sair?motivo=bloqueado");
  // Senha provisória: nada do app abre antes de a pessoa criar a própria (a tela de troca fica fora deste guarda).
  if (session.mustChangePassword) redirect("/conta/senha");
  return session;
}

/** Cookie com a marmitaria que o admin Shogun escolheu "ver como". Só vale se a sessão for de admin (conferido a cada requisição). */
export const VIEW_AS_COOKIE = "shogun_view_as";

export type ActiveOrg = { orgId: string; orgName: string; canWrite: boolean; /** admin vendo como a marmitaria */ viewingAs: boolean };

/**
 * Marmitaria em uso agora. Vem SEMPRE do servidor: da sessão (vínculo do usuário) ou, só para admin Shogun,
 * da marmitaria escolhida no cookie, conferida no banco. Cookie forjado por quem não é admin é ignorado.
 */
export const getActiveOrg = cache(async (): Promise<ActiveOrg | null> => {
  const session = await getSession();
  if (!session) return null;

  if (session.isPlatformAdmin) {
    const wanted = (await cookies()).get(VIEW_AS_COOKIE)?.value;
    if (wanted && UUID.test(wanted)) {
      const supabase = await createClient();
      const { data: org } = await supabase.from("organizations").select("id, name").eq("id", wanted).maybeSingle();
      if (org) return { orgId: org.id, orgName: org.name, canWrite: true, viewingAs: true };
    }
  }

  const m = session.memberships[0];
  return m ? { orgId: m.org.id, orgName: m.org.name, canWrite: m.role !== "viewer", viewingAs: false } : null;
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Member = { session: Session; orgId: string; orgName: string; canWrite: boolean; viewingAs: boolean };

/**
 * Usuário de uma marmitaria. A organização vem SEMPRE do servidor (ver getActiveOrg), nunca de um campo do formulário.
 * Quem não tem marmitaria (ex.: admin Shogun sem "ver como") volta para o início.
 */
export async function requireMember(): Promise<Member> {
  const session = await requireUser();
  const active = await getActiveOrg();
  if (!active) redirect("/");
  return { session, ...active };
}

/** Só admin Shogun passa. Para qualquer outra pessoa a página simplesmente "não existe". */
export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  if (!session.isPlatformAdmin) notFound();
  return session;
}
