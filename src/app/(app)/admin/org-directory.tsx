"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { Sheet } from "@/components/sheet";
import { sortOrgs, type AttentionReason, type MenuHealth, type OrgFlags, type OrgSeverity, type OrgSort } from "@/lib/admin-overview";
import { normalizeName } from "@/lib/names";
import { SyncNowButton } from "./sync-now-button";

export type OrgMenuRow = {
  id: string;
  providerLabel: string;
  health: MenuHealth;
  healthLabel: string;
  /** "há 3 h" / "nunca" */
  lastSyncLabel: string;
  /** data e hora exatas, para o texto ao passar o mouse */
  lastSyncTitle: string;
  /** "1.961" (formatado no servidor) */
  ordersLabel: string;
  pending: number;
  /** % do histórico já importado enquanto ainda importa */
  progress: number | null;
  error: string | null;
};

export type OrgItem = {
  id: string;
  name: string;
  /** nome da marmitaria + nomes e e-mails dos usuários, para a busca */
  searchText: string;
  owner: { name: string; email: string } | null;
  members: number;
  lastActivity: string | null;
  lastActivityLabel: string;
  lastActivityTitle: string;
  /** cor da bolinha: ok = acessou nas últimas 24 h, warn = esta semana, bad = sumido */
  activityTone: "ok" | "warn" | "bad";
  /** o que a pessoa fez por último, e quem */
  lastAction: string | null;
  lastActor: string | null;
  events7d: number;
  menu: OrgMenuRow[];
  flags: OrgFlags;
  severity: OrgSeverity;
  reasons: Pick<AttentionReason, "key" | "text" | "tab">[];
  historyHref: string;
  /** botão "Ver como" (formulário com ação do servidor) */
  viewAs: ReactNode;
  /** conteúdo das abas do painel de gerenciamento (renderizado no servidor) */
  usersPanel: ReactNode;
  menuPanel: ReactNode;
};

type Filter = "all" | "inactive" | "menuProblem" | "noMenu";
type Tab = "users" | "menu";

const HEALTH_STYLE: Record<MenuHealth, string> = {
  ok: "bg-success/10 text-success",
  importing: "bg-warning/10 text-warning",
  late: "bg-warning/10 text-warning",
  error: "bg-danger/10 text-danger",
};
const URGENCY: AttentionReason["key"][] = ["menu-error", "menu-late", "inactive", "never"];
const TONE: Record<OrgItem["activityTone"], string> = { ok: "bg-success", warn: "bg-warning", bad: "bg-danger" };
const ACCENT: Record<OrgSeverity, string> = { ok: "border-l-transparent", attention: "border-l-warning", critical: "border-l-danger" };

const chipClass = (on: boolean) => `flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`;
const cardButton = "flex h-11 items-center justify-center rounded-xl border border-border bg-surface px-2 text-sm font-semibold text-primary";

/**
 * Painel Shogun: visão geral das marmitarias. O essencial de cada uma fica à vista (último acesso e cardápio); o que exige ação
 * abre num painel por cima da tela (Gerenciar), com abas, em vez de menus dentro de menus. No topo, o que precisa de atenção.
 */
export function OrgDirectory({ items, createForm }: { items: OrgItem[]; createForm: ReactNode }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<OrgSort>("name");
  const [manage, setManage] = useState<{ id: string; tab: Tab } | null>(null);
  const [creating, setCreating] = useState(false);
  const [showAllAttention, setShowAllAttention] = useState(false);
  const deferred = useDeferredValue(query);

  const counts = useMemo(
    () => ({
      all: items.length,
      inactive: items.filter((i) => i.flags.inactive).length,
      menuProblem: items.filter((i) => i.flags.menuProblem).length,
      noMenu: items.filter((i) => i.flags.noMenu).length,
    }),
    [items],
  );

  const visible = useMemo(() => {
    const words = normalizeName(deferred).split(" ").filter(Boolean);
    const filtered = items.filter((i) => {
      if (filter !== "all" && !i.flags[filter]) return false;
      if (words.length === 0) return true;
      const hay = normalizeName(i.searchText);
      return words.every((w) => hay.includes(w));
    });
    return sortOrgs(filtered, sort);
  }, [items, deferred, filter, sort]);

  // O que pede atenção, do mais urgente ao menos, de todas as marmitarias (a ordem original é mantida dentro de cada tipo).
  const attention = useMemo(
    () =>
      items
        .flatMap((i) => i.reasons.map((reason) => ({ org: i, reason })))
        .sort((a, b) => URGENCY.indexOf(a.reason.key) - URGENCY.indexOf(b.reason.key)),
    [items],
  );
  const shownAttention = showAllAttention ? attention : attention.slice(0, 4);

  const connected = items.filter((i) => i.menu.length > 0);
  const openItem = manage ? items.find((i) => i.id === manage.id) : null;

  const kpis: { label: string; value: string; hint: string; bad?: boolean; filter?: Filter }[] = [
    { label: "Marmitarias", value: String(items.length), hint: `${items.filter((i) => !i.flags.inactive).length} acessaram nos últimos 7 dias`, filter: "all" },
    { label: "Sem acessar", value: String(counts.inactive), hint: "há 7+ dias ou nunca", bad: counts.inactive > 0, filter: "inactive" },
    { label: "Cardápio conectado", value: String(connected.length), hint: `${connected.filter((i) => !i.flags.menuProblem).length} funcionando bem` },
    { label: "Cardápio com problema", value: String(counts.menuProblem), hint: "erro ou atrasado", bad: counts.menuProblem > 0, filter: "menuProblem" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-tight">Marmitarias</h2>
        <button type="button" onClick={() => setCreating(true)} className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
          + Nova marmitaria
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-3 card p-6">
          <h3 className="text-lg font-bold">Nenhuma marmitaria ainda</h3>
          <p className="text-sm text-muted">Crie a primeira: você cadastra o dono e a senha, e depois passa o e-mail e a senha para ele entrar.</p>
          <button type="button" onClick={() => setCreating(true)} className="h-12 rounded-xl bg-primary px-5 font-semibold text-primary-foreground">
            Criar a primeira marmitaria
          </button>
        </div>
      ) : (
        <>
          {attention.length > 0 ? (
            <section aria-label="Precisa de atenção" className="flex flex-col gap-2 rounded-2xl border border-warning/40 bg-warning/5 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-warning">Precisa de atenção ({attention.length})</h3>
              <ul className="flex flex-col divide-y divide-warning/20">
                {shownAttention.map(({ org, reason }) => (
                  <li key={`${org.id}-${reason.key}-${reason.text}`} className="flex items-center justify-between gap-3 py-2">
                    <p className="min-w-0 text-sm leading-snug">
                      <strong>{org.name}</strong>
                      <span className="block text-muted">{reason.text}</span>
                    </p>
                    {reason.tab === "menu" ? (
                      <button type="button" onClick={() => setManage({ id: org.id, tab: "menu" })} className="h-11 shrink-0 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-primary">
                        Resolver
                      </button>
                    ) : (
                      <Link href={org.historyHref} className="flex h-11 shrink-0 items-center rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-primary">
                        Ver uso
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              {attention.length > 4 ? (
                <button type="button" onClick={() => setShowAllAttention((v) => !v)} className="h-11 self-start text-sm font-semibold text-primary">
                  {showAllAttention ? "Mostrar menos" : `Ver todos (${attention.length})`}
                </button>
              ) : null}
            </section>
          ) : (
            <p role="status" className="rounded-2xl bg-success/10 px-4 py-3 text-sm text-success">
              <strong>Tudo em ordem.</strong> Todos os clientes acessaram na última semana e os cardápios estão em dia.
            </p>
          )}

          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {kpis.map((k) => {
              const body = (
                <>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{k.label}</dt>
                  <dd className={`tabular text-2xl font-extrabold ${k.bad ? "text-danger" : ""}`}>{k.value}</dd>
                  <dd className="text-xs text-muted">{k.hint}</dd>
                </>
              );
              return k.filter ? (
                <button
                  key={k.label}
                  type="button"
                  onClick={() => setFilter(k.filter!)}
                  aria-pressed={filter === k.filter}
                  className={`flex min-h-11 flex-col items-start gap-0.5 card p-3 text-left ${filter === k.filter && k.filter !== "all" ? "ring-2 ring-primary" : ""}`}
                >
                  {body}
                </button>
              ) : (
                <div key={k.label} className="flex flex-col gap-0.5 card p-3">
                  {body}
                </div>
              );
            })}
          </dl>

          <div className="flex flex-col gap-3">
            <div className="relative">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar marmitaria, dono ou e-mail…"
                aria-label="Buscar marmitaria, dono ou e-mail"
                autoComplete="off"
                className="h-12 w-full card pl-4 pr-12 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca" className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-xl text-muted">
                  ×
                </button>
              ) : null}
            </div>

            <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Filtro">
              {(
                [
                  ["all", "Todas"],
                  ["inactive", "Sem acessar há 7+ dias"],
                  ["menuProblem", "Cardápio com problema"],
                  ["noMenu", "Sem cardápio"],
                ] as const
              ).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={chipClass(filter === key)}>
                  {label}
                  <span className={`tabular text-xs ${filter === key ? "opacity-80" : "text-muted"}`}>{counts[key]}</span>
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm text-muted">
              Ordenar por
              <select value={sort} onChange={(e) => setSort(e.target.value as OrgSort)} className="h-11 card px-3 text-base text-foreground">
                <option value="name">Nome (A–Z)</option>
                <option value="recent">Acessou há menos tempo</option>
                <option value="stale">Sem acessar há mais tempo</option>
              </select>
            </label>
          </div>

          <p className="text-xs text-muted" aria-live="polite">
            {visible.length} {visible.length === 1 ? "marmitaria" : "marmitarias"}
          </p>

          {visible.length === 0 ? (
            <p className="card p-4 text-sm text-muted">Nenhuma marmitaria com esse filtro. Limpe a busca ou troque o filtro.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {visible.map((i) => (
                <li key={i.id}>
                  <article className={`flex flex-col gap-3 card border-l-4 p-4 ${ACCENT[i.severity]}`}>
                    <header className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-bold">{i.name}</h3>
                        <p className="truncate text-xs text-muted">
                          {i.owner ? `${i.owner.name} · ${i.owner.email}` : "Sem dono cadastrado"}
                          {i.owner && i.members > 1 ? ` · +${i.members - 1}` : ""}
                        </p>
                      </div>
                      {i.severity !== "ok" ? (
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${i.severity === "critical" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>
                          {i.severity === "critical" ? "Urgente" : "Atenção"}
                        </span>
                      ) : null}
                    </header>

                    <dl className="flex flex-col gap-3 text-sm">
                      <div className="flex items-start gap-3">
                        <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-full ${TONE[i.activityTone]}`} />
                        <div className="min-w-0">
                          <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Último acesso do cliente</dt>
                          <dd>
                            <strong title={i.lastActivityTitle || undefined}>{i.lastActivity ? i.lastActivityLabel : "Ainda não acessou"}</strong>
                            {i.lastActivity && i.events7d > 0 ? <span className="text-muted"> · {i.events7d} ações na semana</span> : null}
                          </dd>
                          {i.lastAction ? (
                            <dd className="line-clamp-2 text-xs text-muted">
                              {i.lastActor ? `${i.lastActor}: ` : ""}
                              {i.lastAction}
                            </dd>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-full ${i.menu.length === 0 ? "bg-border" : i.flags.menuProblem ? "bg-danger" : "bg-success"}`} />
                        <div className="min-w-0 flex-1">
                          <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Cardápio digital</dt>
                          {i.menu.length === 0 ? (
                            <dd className="flex flex-wrap items-center gap-x-3 text-muted">
                              Não conectado
                              <button type="button" onClick={() => setManage({ id: i.id, tab: "menu" })} className="min-h-11 font-semibold text-primary">
                                Conectar
                              </button>
                            </dd>
                          ) : (
                            i.menu.map((m) => (
                              <dd key={m.id} className="flex flex-col gap-1 py-1">
                                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <strong>{m.providerLabel}</strong>
                                  <span className={`rounded-full px-2 py-0.5 text-xs ${HEALTH_STYLE[m.health]}`}>{m.healthLabel}</span>
                                </span>
                                <span className="text-xs text-muted">
                                  <span title={m.lastSyncTitle || undefined}>{m.lastSyncLabel === "nunca" ? "Ainda não puxou pedidos" : `Puxou pedidos ${m.lastSyncLabel}`}</span>
                                  {" · "}
                                  {m.ordersLabel} pedidos
                                </span>
                                {m.progress !== null ? (
                                  <span className="flex items-center gap-2" aria-label={`Importando o histórico: ${m.progress}%`}>
                                    <span className="h-1.5 w-28 overflow-hidden rounded-full bg-border">
                                      <span className="block h-full rounded-full bg-accent" style={{ width: `${m.progress}%` }} />
                                    </span>
                                    <span className="text-xs text-muted">
                                      {m.progress}% · faltam {m.pending}
                                    </span>
                                  </span>
                                ) : null}
                                {m.error ? <span className="line-clamp-2 text-xs text-danger">{m.error}</span> : null}
                                {m.health !== "error" ? <SyncNowButton connectionId={m.id} compact /> : null}
                              </dd>
                            ))
                          )}
                        </div>
                      </div>
                    </dl>

                    <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
                      {i.viewAs}
                      <Link href={i.historyHref} className={cardButton}>
                        Histórico
                      </Link>
                      <button type="button" onClick={() => setManage({ id: i.id, tab: "users" })} className={cardButton}>
                        Gerenciar
                      </button>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Sheet open={Boolean(openItem)} onClose={() => setManage(null)} title={openItem?.name ?? ""} subtitle="Gerenciar">
        {openItem && manage ? (
          <>
            <div role="tablist" aria-label="Gerenciar" className="sticky top-0 z-10 flex gap-1 border-b border-border bg-surface px-5 py-2">
              {(
                [
                  ["users", `Usuários (${openItem.members})`],
                  ["menu", `Cardápio (${openItem.menu.length})`],
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={manage.tab === tab}
                  onClick={() => setManage({ id: openItem.id, tab })}
                  className={`h-11 flex-1 rounded-lg text-sm font-semibold ${manage.tab === tab ? "bg-primary text-primary-foreground" : "bg-border/50 text-muted"}`}
                >
                  {label}
                </button>
              ))}
              <Link href={`/admin/planilha?org=${openItem.id}`} className="flex h-11 flex-1 items-center justify-center rounded-lg bg-border/50 text-sm font-semibold text-muted">
                Planilha
              </Link>
            </div>
            {manage.tab === "users" ? openItem.usersPanel : openItem.menuPanel}
          </>
        ) : null}
      </Sheet>

      <Sheet open={creating} onClose={() => setCreating(false)} title="Nova marmitaria" subtitle="Cadastre o cliente e a senha de acesso">
        <div className="p-5">{createForm}</div>
      </Sheet>
    </div>
  );
}
