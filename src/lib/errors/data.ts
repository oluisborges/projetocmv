import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type ErrorRow = {
  id: number;
  source: "server" | "client" | "sync";
  message: string;
  stack: string | null;
  path: string | null;
  routeType: string | null;
  orgName: string | null;
  count: number;
  firstSeen: string;
  lastSeen: string;
  resolvedAt: string | null;
};

/** Quantos tipos de erro estão em aberto (para o número na aba). Só chamar depois de `requireAdmin()`. */
export const countOpenErrors = cache(async (): Promise<number> => {
  const db = createAdminClient();
  const [{ data: rows }, { data: tests }] = await Promise.all([db.from("error_events").select("org_id").is("resolved_at", null), db.from("organizations").select("id").eq("is_test", true)]);
  const testIds = new Set((tests ?? []).map((o) => o.id as string)); // erro de conta de teste não conta
  return (rows ?? []).filter((r) => !(r.org_id && testIds.has(r.org_id as string))).length;
});

/** Erros em aberto (mais recentes primeiro) e os resolvidos nos últimos 7 dias. Limpa o que foi resolvido há mais de 30 dias. */
export async function loadErrors(): Promise<{ open: ErrorRow[]; resolved: ErrorRow[] }> {
  const db = createAdminClient();
  await db.from("error_events").delete().lt("resolved_at", new Date(Date.now() - 30 * 86_400_000).toISOString());
  const [{ data: rows }, { data: orgs }] = await Promise.all([
    db
      .from("error_events")
      .select("id, source, message, stack, path, route_type, org_id, count, first_seen, last_seen, resolved_at")
      .or(`resolved_at.is.null,resolved_at.gt.${new Date(Date.now() - 7 * 86_400_000).toISOString()}`)
      .order("last_seen", { ascending: false })
      .limit(200),
    db.from("organizations").select("id, name, is_test"),
  ]);
  const names = new Map((orgs ?? []).map((o) => [o.id as string, o.name as string]));
  const testIds = new Set((orgs ?? []).filter((o) => o.is_test).map((o) => o.id as string));
  const all: ErrorRow[] = (rows ?? []).filter((r) => !(r.org_id && testIds.has(r.org_id as string))).map((r) => ({
    id: Number(r.id),
    source: r.source as ErrorRow["source"],
    message: r.message as string,
    stack: (r.stack as string | null) ?? null,
    path: (r.path as string | null) ?? null,
    routeType: (r.route_type as string | null) ?? null,
    orgName: r.org_id ? (names.get(r.org_id as string) ?? null) : null,
    count: Number(r.count),
    firstSeen: r.first_seen as string,
    lastSeen: r.last_seen as string,
    resolvedAt: (r.resolved_at as string | null) ?? null,
  }));
  return { open: all.filter((e) => !e.resolvedAt), resolved: all.filter((e) => e.resolvedAt) };
}
