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
    supabase.from("profiles").select("full_name, is_platform_admin").eq("id", user.id).maybeSingle(),
    supabase.from("memberships").select("role, organizations(id, name)").eq("user_id", user.id),
  ]);

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? null,
    isPlatformAdmin: profile?.is_platform_admin ?? false,
    memberships: (memberships ?? []).flatMap((m) => {
      const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
      return org ? [{ role: m.role as Membership["role"], org: { id: org.id, name: org.name } }] : [];
    }),
  };
});

export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Só admin Shogun passa. Para qualquer outra pessoa a página simplesmente "não existe". */
export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  if (!session.isPlatformAdmin) notFound();
  return session;
}
