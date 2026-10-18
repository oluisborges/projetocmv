import "server-only";
import { cache } from "react";
import { menuAlerts, type MenuAlert } from "@/lib/admin-overview";
import { PROVIDER_LABEL, type MenuProvider } from "@/lib/menu/types";
import { timeAgo } from "@/lib/relative-time";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cardápios que pararam de importar, para a equipe Shogun ver em qualquer tela. Só chamar para admin (usa a chave de serviço).
 * Uma consulta pequena por requisição.
 */
export const loadMenuAlerts = cache(async (): Promise<MenuAlert[]> => {
  const db = createAdminClient();
  const [{ data: conns }, { data: orgs }] = await Promise.all([
    db.from("menu_connections").select("id, org_id, provider, status, phase, last_sync_at, pending_orders"),
    db.from("organizations").select("id, name"),
  ]);
  const names = new Map((orgs ?? []).map((o) => [o.id as string, o.name as string]));
  const now = new Date();
  return menuAlerts({
    conns: (conns ?? []).map((c) => ({
      id: c.id as string,
      orgId: c.org_id as string,
      orgName: names.get(c.org_id as string) ?? "Marmitaria",
      providerLabel: PROVIDER_LABEL[c.provider as MenuProvider],
      provider: c.provider as MenuProvider,
      status: c.status as "connected" | "error",
      phase: c.phase as "history" | "done",
      last_sync_at: (c.last_sync_at as string | null) ?? null,
      pending_orders: Number(c.pending_orders),
    })),
    now,
    ago: (iso) => timeAgo(iso, now),
  });
});
