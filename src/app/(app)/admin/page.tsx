import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { menuHealth, MENU_HEALTH_LABEL, orgFlags } from "@/lib/admin-overview";
import { requireAdmin } from "@/lib/auth";
import { kickStalled } from "@/lib/menu/server/kick";
import { PROVIDER_LABEL } from "@/lib/menu/types";
import { dateTimeBR, timeAgo } from "@/lib/relative-time";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { viewAsOrganization } from "../actions";
import { addMember, createOrganization, resetPassword } from "./actions";
import { AdminForm, Field } from "./admin-form";
import { MenuSection, type MenuConnectionRow } from "./menu-section";
import { OrgDirectory, type OrgItem } from "./org-directory";

export const metadata = { title: "Painel Shogun" };
// "Sincronizar agora" roda dentro da própria ação do painel
export const maxDuration = 60;

const ROLE_LABEL: Record<string, string> = { owner: "Dono", manager: "Gerente", viewer: "Só leitura" };

type Activity = { org_id: string; last_activity: string; last_login: string | null; last_kind: string; last_summary: string; last_user_id: string | null; events_7d: number | string };

export default async function AdminPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const supabase = await createClient(); // sessão do admin: a função de atividade confere quem pergunta

  const [{ data: orgs }, { data: memberships }, { data: usersPage }, { data: menuConns }, { data: menuCreds }, { data: activityRows }] = await Promise.all([
    admin.from("organizations").select("id, name, slug, created_at").order("name"),
    admin.from("memberships").select("org_id, user_id, role"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("menu_connections").select("id, org_id, provider, status, phase, merchant_name, last_sync_at, last_error, orders_imported, pending_orders, locked_until").order("created_at"),
    admin.from("menu_credentials").select("connection_id, webhook_token"),
    supabase.rpc("admin_org_activity"),
  ]);
  const webhookTokens = new Map((menuCreds ?? []).map((c) => [c.connection_id as string, c.webhook_token as string]));
  const activity = new Map(((activityRows as Activity[] | null) ?? []).map((a) => [a.org_id, a]));
  // importação parada no meio? abrir o painel retoma (a corrente de ciclos pode quebrar se uma função for encerrada)
  await kickStalled(
    (menuConns ?? []).map((c) => ({
      id: c.id as string,
      status: c.status as string,
      phase: c.phase as "history" | "done",
      pending_orders: Number(c.pending_orders),
      locked_until: (c.locked_until as string | null) ?? null,
      last_sync_at: (c.last_sync_at as string | null) ?? null,
    })),
  );

  const users = new Map((usersPage?.users ?? []).map((u) => [u.id, u]));
  const userName = (id: string) => {
    const u = users.get(id);
    return (u?.user_metadata?.full_name as string | undefined) ?? u?.email ?? null;
  };
  const now = new Date();
  const number = new Intl.NumberFormat("pt-BR");

  const items: OrgItem[] = (orgs ?? []).map((org) => {
    const members = (memberships ?? []).filter((m) => m.org_id === org.id);
    const conns = (menuConns ?? []).filter((c) => c.org_id === org.id);
    const act = activity.get(org.id as string);
    const lastActivity = act?.last_activity ?? null;
    const summaries = conns.map((c) => ({
      provider: c.provider as "cardapioweb" | "prefiro",
      status: c.status as "connected" | "error",
      phase: c.phase as "history" | "done",
      last_sync_at: (c.last_sync_at as string | null) ?? null,
      pending_orders: Number(c.pending_orders),
    }));
    const flags = orgFlags({ lastActivity, conns: summaries, now });
    const hours = lastActivity ? (now.getTime() - Date.parse(lastActivity)) / 3_600_000 : Infinity;

    return {
      id: org.id as string,
      name: org.name as string,
      searchText: [org.name, ...members.flatMap((m) => [userName(m.user_id), users.get(m.user_id)?.email])].filter(Boolean).join(" "),
      members: members.length,
      lastActivity,
      lastActivityLabel: timeAgo(lastActivity, now),
      lastActivityTitle: dateTimeBR(lastActivity),
      activityTone: flags.inactive ? "bad" : hours <= 24 ? "ok" : "warn",
      lastAction: act?.last_summary ?? null,
      lastActor: act?.last_user_id ? userName(act.last_user_id) : null,
      events7d: Number(act?.events_7d ?? 0),
      flags,
      menu: conns.map((c, idx) => ({
        id: c.id as string,
        providerLabel: PROVIDER_LABEL[c.provider as "cardapioweb" | "prefiro"],
        health: menuHealth(summaries[idx], now),
        healthLabel: MENU_HEALTH_LABEL[menuHealth(summaries[idx], now)],
        lastSyncLabel: timeAgo(c.last_sync_at as string | null, now),
        lastSyncTitle: dateTimeBR(c.last_sync_at as string | null),
        ordersLabel: number.format(Number(c.orders_imported)),
        pending: Number(c.pending_orders),
        error: (c.last_error as string | null) ?? null,
      })),
      actions: (
        <div className="grid grid-cols-2 gap-2">
          <form action={viewAsOrganization}>
            <input type="hidden" name="orgId" value={org.id as string} />
            <SubmitButton pendingLabel="Abrindo…" className="h-11 w-full rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground">
              Ver como cliente
            </SubmitButton>
          </form>
          <Link href={`/admin/uso/${org.id}`} className="flex h-11 items-center justify-center rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-primary">
            Histórico de uso
          </Link>
        </div>
      ),
      manage: (
        <>
          <ul className="flex flex-col divide-y divide-border">
            {members.map((m) => {
              const u = users.get(m.user_id);
              return (
                <li key={m.user_id} className="flex flex-col gap-2 py-3 first:pt-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="min-w-0 truncate font-medium">{userName(m.user_id) ?? m.user_id}</p>
                    <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs">{ROLE_LABEL[m.role]}</span>
                  </div>
                  <p className="truncate text-sm text-muted">{u?.email}</p>
                  <details>
                    <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">Trocar senha</summary>
                    <div className="pt-1">
                      <AdminForm action={resetPassword} submitLabel="Salvar nova senha">
                        <input type="hidden" name="userId" value={m.user_id} />
                        <Field label="Nova senha (mínimo 8 caracteres)" name="password" type="password" />
                      </AdminForm>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>

          <MenuSection
            orgId={org.id as string}
            connections={conns.map((c) => ({ ...(c as unknown as Omit<MenuConnectionRow, "webhook_token">), webhook_token: webhookTokens.get(c.id as string) ?? null }))}
          />

          <details>
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">Adicionar usuário</summary>
            <div className="pt-1">
              <AdminForm action={addMember} submitLabel="Adicionar usuário">
                <input type="hidden" name="orgId" value={org.id as string} />
                <Field label="Nome" name="name" />
                <Field label="E-mail (será o login)" name="email" type="email" />
                <Field label="Senha (mínimo 8 caracteres)" name="password" type="password" />
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Papel
                  <select name="role" defaultValue="manager" className="h-11 card px-3 text-base">
                    <option value="manager">Gerente (edita)</option>
                    <option value="owner">Dono (edita e gerencia)</option>
                    <option value="viewer">Só leitura</option>
                  </select>
                </label>
              </AdminForm>
            </div>
          </details>
        </>
      ),
    };
  });

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Painel Shogun</h1>
        <p className="text-muted">Acompanhe quem está usando o sistema e como estão os cardápios conectados.</p>
      </section>

      <details className="card p-4" open={items.length === 0}>
        <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold">Nova marmitaria</summary>
        <div className="pt-2">
          <p className="pb-3 text-sm text-muted">Crie a marmitaria do cliente e a senha de acesso. Depois passe e-mail e senha para ele.</p>
          <AdminForm action={createOrganization} submitLabel="Criar marmitaria">
            <Field label="Nome da marmitaria" name="orgName" />
            <Field label="Nome da primeira unidade" name="unitName" />
            <Field label="Nome do dono" name="ownerName" />
            <Field label="E-mail do dono (será o login)" name="ownerEmail" type="email" autoComplete="off" />
            <Field label="Senha (mínimo 8 caracteres)" name="ownerPassword" type="password" />
          </AdminForm>
        </div>
      </details>

      <OrgDirectory items={items} />
    </>
  );
}
