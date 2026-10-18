"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { normalizeName } from "@/lib/names";

export type BoardTone = "good" | "warn" | "bad" | "none";

export type BoardRow = {
  id: string;
  name: string;
  hasMenu: boolean;
  revenue: string;
  /** "+12% no ritmo" / "−30% vs mês passado" / "—" */
  trend: string;
  trendTone: BoardTone;
  orders: string;
  ticket: string;
  coupon: string;
  couponAmount: string;
  couponTone: BoardTone;
  margin: string;
  marginTone: BoardTone;
  realMargin: string;
  coverage: string;
  coverageTone: BoardTone;
  setupPct: number;
  /** passos que faltam, em texto */
  setupMissing: string;
  /** valores para ordenar (nulos vão para o fim) */
  sort: { revenue: number; trend: number | null; margin: number | null; setup: number };
};

type SortKey = "revenue" | "trend" | "margin" | "setup" | "name";

const TONE: Record<BoardTone, string> = { good: "text-success", warn: "text-warning", bad: "text-danger", none: "" };

function Metric({ label, value, tone = "none", hint }: { label: string; value: string; tone?: BoardTone; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className={`tabular truncate text-base font-bold ${TONE[tone]}`}>{value}</dd>
      {hint ? <dd className="truncate text-xs text-muted">{hint}</dd> : null}
    </div>
  );
}

/** Clientes lado a lado: busca e ordenação (quem mais precisa de atenção primeiro). */
export function ClientsBoard({ rows }: { rows: BoardRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("revenue");
  const deferred = useDeferredValue(query);

  const visible = useMemo(() => {
    const words = normalizeName(deferred).split(" ").filter(Boolean);
    const filtered = rows.filter((r) => words.length === 0 || words.every((w) => normalizeName(r.name).includes(w)));
    const byName = (a: BoardRow, b: BoardRow) => a.name.localeCompare(b.name, "pt-BR");
    const cmp = (key: Exclude<SortKey, "name">, dir: 1 | -1) => (a: BoardRow, b: BoardRow) => {
      const x = a.sort[key];
      const y = b.sort[key];
      if (x === null && y === null) return byName(a, b);
      if (x === null) return 1; // sem dado vai para o fim
      if (y === null) return -1;
      return (x - y) * dir || byName(a, b);
    };
    if (sort === "revenue") return [...filtered].sort(cmp("revenue", -1));
    if (sort === "trend") return [...filtered].sort(cmp("trend", 1)); // quem mais caiu primeiro
    if (sort === "margin") return [...filtered].sort(cmp("margin", 1)); // menor margem primeiro
    if (sort === "setup") return [...filtered].sort(cmp("setup", 1)); // menos completos primeiro
    return [...filtered].sort(byName);
  }, [rows, deferred, sort]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente…"
            aria-label="Buscar cliente"
            autoComplete="off"
            className="h-12 w-full card pl-4 pr-12 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca" className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-xl text-muted">
              ×
            </button>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Ordenar por
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-12 card px-3 text-base text-foreground">
            <option value="revenue">Maior faturamento</option>
            <option value="trend">Quem mais caiu</option>
            <option value="margin">Menor margem</option>
            <option value="setup">Menos completos</option>
            <option value="name">Nome (A–Z)</option>
          </select>
        </label>
      </div>

      <p className="text-xs text-muted" aria-live="polite">
        {visible.length} {visible.length === 1 ? "cliente" : "clientes"}
      </p>

      {visible.length === 0 ? (
        <p className="card p-4 text-sm text-muted">Nenhum cliente encontrado.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((r) => (
            <li key={r.id}>
              <article className="flex flex-col gap-3 card p-4">
                <header className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 truncate text-lg font-bold">{r.name}</h3>
                  <span className={`shrink-0 text-sm font-semibold ${TONE[r.trendTone]}`}>{r.trend}</span>
                </header>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                  <Metric label="Faturamento" value={r.revenue} />
                  <Metric label="Pedidos" value={r.orders} hint={r.hasMenu ? `ticket ${r.ticket}` : "sem cardápio"} />
                  <Metric label="Cupons" value={r.coupon} tone={r.couponTone} hint={r.couponAmount} />
                  <Metric label="Margem dos produtos" value={r.margin} tone={r.marginTone} hint="antes das despesas fixas" />
                  <Metric label="Margem real nas vendas" value={r.realMargin} hint="fichas vinculadas" />
                  <Metric label="Cardápio vinculado" value={r.hasMenu ? r.coverage : "—"} tone={r.coverageTone} />
                </dl>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold uppercase tracking-wider text-muted">Sistema montado</span>
                    <span className="tabular font-semibold">{Math.round(r.setupPct * 100)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={Math.round(r.setupPct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Sistema montado">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(r.setupPct * 100)}%` }} />
                  </div>
                  {r.setupMissing ? <p className="text-xs text-muted">Falta: {r.setupMissing}</p> : null}
                </div>

                <Link href={`/admin/uso/${r.id}`} className="flex h-11 items-center justify-center rounded-xl border border-border bg-surface text-sm font-semibold text-primary">
                  Histórico de uso
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
