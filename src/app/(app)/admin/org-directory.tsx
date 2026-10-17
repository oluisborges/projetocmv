"use client";

import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { sortOrgs, type MenuHealth, type OrgFlags, type OrgSort } from "@/lib/admin-overview";
import { normalizeName } from "@/lib/names";

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
  error: string | null;
};

export type OrgItem = {
  id: string;
  name: string;
  /** nome da marmitaria + nomes e e-mails dos usuários, para a busca */
  searchText: string;
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
  /** botões "Ver como" e "Histórico de uso" (renderizados no servidor) */
  actions: ReactNode;
  /** usuários, cardápio e novo usuário (renderizados no servidor) */
  manage: ReactNode;
};

type Filter = "all" | "inactive" | "menuProblem" | "noMenu";

const HEALTH_STYLE: Record<MenuHealth, string> = {
  ok: "bg-success/10 text-success",
  importing: "bg-warning/10 text-warning",
  late: "bg-warning/10 text-warning",
  error: "bg-danger/10 text-danger",
};

const chipClass = (on: boolean) => `flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`;

const TONE: Record<OrgItem["activityTone"], string> = { ok: "bg-success", warn: "bg-warning", bad: "bg-danger" };

/** Lista das marmitarias do painel Shogun: o essencial de cada uma sempre à vista, com busca, filtros e ordenação. */
export function OrgDirectory({ items }: { items: OrgItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<OrgSort>("name");
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

  const connected = items.filter((i) => i.menu.length > 0);
  const kpis = [
    { label: "Marmitarias", value: String(items.length), hint: `${items.filter((i) => !i.flags.inactive).length} acessaram nos últimos 7 dias` },
    { label: "Sem acessar", value: String(counts.inactive), hint: "há 7+ dias ou nunca", bad: counts.inactive > 0 },
    { label: "Cardápio conectado", value: `${connected.length}`, hint: `${connected.filter((i) => !i.flags.menuProblem).length} funcionando bem` },
    { label: "Cardápio com problema", value: String(counts.menuProblem), hint: "erro ou atrasado", bad: counts.menuProblem > 0 },
  ];

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="flex flex-col gap-0.5 card p-3">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{k.label}</dt>
            <dd className={`tabular text-2xl font-extrabold ${k.bad ? "text-danger" : ""}`}>{k.value}</dd>
            <dd className="text-xs text-muted">{k.hint}</dd>
          </div>
        ))}
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
              <article className="flex flex-col gap-3 card p-4">
                <header className="flex items-baseline justify-between gap-3">
                  <h3 className="min-w-0 truncate text-lg font-bold">{i.name}</h3>
                  <span className="shrink-0 text-xs text-muted">
                    {i.members} {i.members === 1 ? "usuário" : "usuários"}
                  </span>
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
                        <dd className="text-muted">Não conectado</dd>
                      ) : (
                        i.menu.map((m) => (
                          <dd key={m.id} className="flex flex-col gap-0.5 py-0.5">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <strong>{m.providerLabel}</strong>
                              <span className={`rounded-full px-2 py-0.5 text-xs ${HEALTH_STYLE[m.health]}`}>{m.healthLabel}</span>
                            </span>
                            <span className="text-xs text-muted">
                              <span title={m.lastSyncTitle || undefined}>
                                {m.lastSyncLabel === "nunca" ? "Ainda não puxou pedidos" : `Puxou pedidos ${m.lastSyncLabel}`}
                              </span>
                              {" · "}
                              {m.ordersLabel} pedidos
                              {m.pending > 0 ? ` (faltam ${m.pending})` : ""}
                            </span>
                            {m.error ? <span className="line-clamp-2 text-xs text-danger">{m.error}</span> : null}
                          </dd>
                        ))
                      )}
                    </div>
                  </div>
                </dl>

                {i.actions}

                <details className="group border-t border-border pt-3">
                  <summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm font-semibold text-primary">
                    Gerenciar usuários e cardápio
                    <span aria-hidden className="transition group-open:rotate-180">
                      ▾
                    </span>
                  </summary>
                  <div className="flex flex-col gap-4 pt-3">{i.manage}</div>
                </details>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
