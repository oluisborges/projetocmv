import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Histórico de uso" };

const PAGE = 100;
const TZ = "America/Sao_Paulo";
const FILTERS = [
  { key: "todos", label: "Tudo", kind: null },
  { key: "entradas", label: "Entradas", kind: "login" },
  { key: "telas", label: "Telas abertas", kind: "view" },
  { key: "alteracoes", label: "Alterações", kind: "change" },
] as const;

const KIND_STYLE: Record<string, { label: string; className: string }> = {
  login: { label: "Entrada", className: "bg-primary text-primary-foreground" },
  view: { label: "Tela", className: "bg-border text-foreground" },
  change: { label: "Alteração", className: "bg-tint text-brand-deep" },
};

const day = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: TZ });
const time = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TZ });
const dateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: TZ });

/** Tudo o que cada pessoa de uma marmitaria fez no sistema, com data e hora de Brasília. Só admin Shogun. */
export default async function UsagePage(props: PageProps<"/admin/uso/[orgId]">) {
  await requireAdmin();
  const { orgId } = await props.params;
  if (!z.uuid().safeParse(orgId).success) notFound();
  const sp = await props.searchParams;

  const filter = FILTERS.find((f) => f.key === sp.tipo) ?? FILTERS[0];
  const page = Math.max(1, Number.parseInt(typeof sp.pagina === "string" ? sp.pagina : "1", 10) || 1);

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id, name").eq("id", orgId).maybeSingle();
  if (!org) notFound();

  let query = supabase
    .from("activity_log")
    .select("id, user_id, by_admin, kind, summary, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE); // pede uma a mais para saber se há próxima página
  if (filter.kind) query = query.eq("kind", filter.kind);

  const [{ data: rows }, { data: lastLogin }, { data: usersPage }] = await Promise.all([
    query,
    supabase.from("activity_log").select("created_at, user_id").eq("org_id", orgId).eq("kind", "login").eq("by_admin", false).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    createAdminClient().auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const users = new Map((usersPage?.users ?? []).map((u) => [u.id, (u.user_metadata?.full_name as string | undefined) ?? u.email ?? "Usuário"]));
  const events = (rows ?? []).slice(0, PAGE);
  const hasMore = (rows ?? []).length > PAGE;

  const groups = new Map<string, typeof events>();
  for (const e of events) {
    const key = day(e.created_at as string);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  const href = (tipo: string, pagina = 1) => `/admin/uso/${orgId}?tipo=${tipo}${pagina > 1 ? `&pagina=${pagina}` : ""}`;

  return (
    <>
      <Link href="/admin" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
        ← Painel Shogun
      </Link>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Histórico de uso</h1>
        <p className="text-lg font-semibold">{org.name}</p>
        <p className="text-sm text-muted">
          {lastLogin ? (
            <>
              Última entrada do cliente: <strong className="text-foreground">{dateTime(lastLogin.created_at as string)}</strong> (horário de Brasília)
            </>
          ) : (
            "O cliente ainda não entrou no sistema (ou entrou antes de o histórico existir)."
          )}
        </p>
      </section>

      <nav aria-label="Filtro" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={href(f.key)}
            aria-current={f.key === filter.key ? "page" : undefined}
            className={`flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium ${f.key === filter.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {events.length === 0 ? (
        <p className="card p-4 text-sm text-muted">Nada registrado ainda para este filtro. O histórico começa a ser gravado a partir de agora.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {[...groups].map(([label, list]) => (
            <section key={label} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted first-letter:uppercase">{label}</h2>
              <ul className="card divide-y divide-border px-4">
                {list.map((e) => {
                  const style = KIND_STYLE[e.kind as string] ?? KIND_STYLE.view;
                  return (
                    <li key={e.id as number} className="flex flex-col gap-1 py-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="tabular font-bold">{time(e.created_at as string)}</span>
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${style.className}`}>{style.label}</span>
                        <span className="min-w-0 truncate text-muted">{users.get(e.user_id as string) ?? "Usuário removido"}</span>
                        {e.by_admin ? <span className="rounded-full border border-warning px-2 py-0.5 font-semibold text-warning">Shogun</span> : null}
                      </div>
                      <p className="text-sm leading-snug">{e.summary as string}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 text-sm font-semibold text-primary">
        {page > 1 ? <Link href={href(filter.key, page - 1)}>← Mais recentes</Link> : <span />}
        {hasMore ? <Link href={href(filter.key, page + 1)}>Mais antigas →</Link> : null}
      </div>
    </>
  );
}
