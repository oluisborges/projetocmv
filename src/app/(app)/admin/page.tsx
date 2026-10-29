import { SubmitButton } from "@/components/submit-button";
import { attentionReasons, menuHealth, MENU_HEALTH_LABEL, orgFlags, orgSeverity, worstMenuHealth } from "@/lib/admin-overview";
import { requireStaff } from "@/lib/auth";
import { countOpenErrors } from "@/lib/errors/data";
import { kickStalled } from "@/lib/menu/server/kick";
import { PROVIDER_LABEL } from "@/lib/menu/types";
import { dateTimeBR, timeAgo } from "@/lib/relative-time";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { viewAsOrganization } from "../actions";
import { createOrganization } from "./actions";
import { AdminForm, Field } from "./admin-form";
import { AdminTabs } from "./admin-tabs";
import { MenuPanel, type MenuConnectionRow } from "./menu-panel";
import { OrgDirectory, type OrgItem } from "./org-directory";
import { TestTagPanel } from "./test-tag-panel";
import { UsersPanel, type UserRow } from "./users-panel";

export const metadata = { title: "Painel Shogun" };
// "Atualizar agora" roda dentro da própria ação do painel
export const maxDuration = 60;

type Activity = { org_id: string; last_activity: string; last_login: string | null; last_kind: string; last_summary: string; last_user_id: string | null; events_7d: number | string };

export default async function AdminPage() {
  const session = await requireStaff();
  const canManage = session.isPlatformAdmin; // gestor só visualiza
  const admin = createAdminClient();
  const supabase = await createClient(); // sessão do admin: a função de atividade confere quem pergunta

  const [{ data: orgs }, { data: memberships }, { data: usersPage }, { data: menuConns }, { data: menuCreds }, { data: activityRows }, { data: blockedRows }] = await Promise.all([
    admin.from("organizations").select("id, name, slug, created_at, is_test").order("name"),
    admin.from("memberships").select("org_id, user_id, role"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("menu_connections").select("id, org_id, provider, status, phase, merchant_name, store_code, last_sync_at, last_error, orders_imported, pending_orders, locked_until").order("created_at"),
    admin.from("menu_credentials").select("connection_id, webhook_token"),
    supabase.rpc("admin_org_activity"),
    admin.from("profiles").select("id").not("blocked_at", "is", null),
  ]);
  // O gestor só enxerga os clientes que o admin liberou.
  let visibleOrgs = orgs ?? [];
  if (!canManage) {
    const { data: allowedRows } = await admin.from("staff_org_access").select("org_id").eq("user_id", session.userId);
    const allowed = new Set((allowedRows ?? []).map((r) => r.org_id as string));
    visibleOrgs = visibleOrgs.filter((o) => allowed.has(o.id as string));
  }
  const blockedIds = new Set((blockedRows ?? []).map((r) => r.id as string));
  const webhookTokens = new Map((menuCreds ?? []).map((c) => [c.connection_id as string, c.webhook_token as string]));
  const activity = new Map(((activityRows as Activity[] | null) ?? []).map((a) => [a.org_id, a]));
  // importação parada no meio? abrir o painel retoma (a corrente de ciclos pode quebrar se uma função for encerrada)
  if (canManage) await kickStalled(
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

  const items: OrgItem[] = visibleOrgs.map((org) => {
    const orgId = org.id as string;
    const members = (memberships ?? []).filter((m) => m.org_id === org.id);
    const conns = (menuConns ?? []).filter((c) => c.org_id === org.id);
    const act = activity.get(orgId);
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
    const ownerMember = members.find((m) => m.role === "owner") ?? members[0];
    const ownerUser = ownerMember ? users.get(ownerMember.user_id) : undefined;

    const userRows: UserRow[] = members.map((m) => ({
      id: m.user_id,
      name: userName(m.user_id) ?? m.user_id,
      email: users.get(m.user_id)?.email ?? "",
      role: m.role as UserRow["role"],
      blocked: blockedIds.has(m.user_id),
    }));
    const menuRows: MenuConnectionRow[] = conns.map((c) => ({
      id: c.id as string,
      provider: c.provider as MenuConnectionRow["provider"],
      status: c.status as MenuConnectionRow["status"],
      phase: c.phase as MenuConnectionRow["phase"],
      merchant_name: (c.merchant_name as string | null) ?? null,
      store_code: (c.store_code as string | null) ?? null,
      last_sync_at: (c.last_sync_at as string | null) ?? null,
      last_error: (c.last_error as string | null) ?? null,
      orders_imported: Number(c.orders_imported),
      pending_orders: Number(c.pending_orders),
      webhook_token: webhookTokens.get(c.id as string) ?? null,
    }));

    return {
      id: orgId,
      name: org.name as string,
      searchText: [org.name, ...members.flatMap((m) => [userName(m.user_id), users.get(m.user_id)?.email])].filter(Boolean).join(" "),
      owner: ownerMember ? { name: userName(ownerMember.user_id) ?? "Dono", email: ownerUser?.email ?? "" } : null,
      members: members.length,
      lastActivity,
      lastActivityLabel: timeAgo(lastActivity, now),
      lastActivityTitle: dateTimeBR(lastActivity),
      activityTone: flags.inactive ? "bad" : hours <= 24 ? "ok" : "warn",
      lastAction: act?.last_summary ?? null,
      lastActor: act?.last_user_id ? userName(act.last_user_id) : null,
      events7d: Number(act?.events_7d ?? 0),
      flags,
      isTest: Boolean(org.is_test),
      severity: org.is_test ? "ok" : orgSeverity(flags, worstMenuHealth(summaries, now)),
      reasons: org.is_test ? [] : attentionReasons({
        lastActivity,
        conns: summaries.map((s) => ({ ...s, providerLabel: PROVIDER_LABEL[s.provider] })),
        now,
        ago: (iso) => timeAgo(iso, now),
      }),
      menu: conns.map((c, idx) => {
        const total = Number(c.orders_imported) + Number(c.pending_orders);
        return {
          id: c.id as string,
          providerLabel: PROVIDER_LABEL[c.provider as "cardapioweb" | "prefiro"],
          health: menuHealth(summaries[idx], now),
          healthLabel: MENU_HEALTH_LABEL[menuHealth(summaries[idx], now)],
          lastSyncLabel: timeAgo(c.last_sync_at as string | null, now),
          lastSyncTitle: dateTimeBR(c.last_sync_at as string | null),
          ordersLabel: number.format(Number(c.orders_imported)),
          pending: Number(c.pending_orders),
          progress: Number(c.pending_orders) > 0 && total > 0 ? Math.round((Number(c.orders_imported) / total) * 100) : null,
          error: (c.last_error as string | null) ?? null,
        };
      }),
      historyHref: `/admin/uso/${orgId}`,
      viewAs: (
        <form action={viewAsOrganization} className="contents">
          <input type="hidden" name="orgId" value={orgId} />
          <SubmitButton pendingLabel="Abrindo…" className="h-11 w-full rounded-xl bg-primary px-2 text-sm font-semibold text-primary-foreground">
            Ver como
          </SubmitButton>
        </form>
      ),
      usersPanel: canManage ? <UsersPanel orgId={orgId} users={userRows} /> : null,
      menuPanel: canManage ? <MenuPanel orgId={orgId} connections={menuRows} /> : null,
      settingsPanel: canManage ? <TestTagPanel orgId={orgId} isTest={Boolean(org.is_test)} /> : null,
    };
  });

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Painel Shogun</h1>
        <p className="text-muted">{canManage ? "Quem está usando o sistema, como estão os cardápios e o que precisa da sua atenção." : "Os clientes que você pode visualizar."}</p>
      </section>

      {canManage ? <AdminTabs active="clients" errorCount={await countOpenErrors()} /> : null}

      <OrgDirectory
        items={items}
        canManage={canManage}
        createForm={
        !canManage ? null : (
          <AdminForm action={createOrganization} submitLabel="Criar marmitaria">
            <Field label="Nome da marmitaria" name="orgName" />
            <Field label="Nome da primeira unidade" name="unitName" />
            <Field label="Nome do dono" name="ownerName" />
            <Field label="E-mail do dono (será o login)" name="ownerEmail" type="email" autoComplete="off" />
            <Field label="Senha (mínimo 8 caracteres)" name="ownerPassword" type="password" />
            <p className="text-xs text-muted">Depois de criar, passe o e-mail e a senha para o dono. No primeiro acesso ele cria a própria senha.</p>
          </AdminForm>
        )}
      />
    </>
  );
}
