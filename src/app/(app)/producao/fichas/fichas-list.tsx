"use client";

import { useMemo, useState } from "react";
import type { FichaOption } from "@/lib/ficha-tecnica-data";

const norm = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
type Filter = "todas" | "marmita" | "receita";

const download = "flex h-11 flex-1 items-center justify-center rounded-xl border px-3 text-sm font-semibold";

/** Escolher um produto ou receita e baixar a ficha técnica em PDF e/ou Excel. */
export function FichasList({ options }: { options: FichaOption[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");

  const counts = useMemo(() => ({ todas: options.length, marmita: options.filter((o) => o.kind === "marmita").length, receita: options.filter((o) => o.kind === "receita").length }), [options]);
  const q = norm(query);
  const shown = options.filter((o) => (filter === "todas" || o.kind === filter) && (q === "" || norm(o.name).includes(q)));
  const chip = (on: boolean) => `h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground"}`;

  return (
    <section className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar produto ou receita…"
        aria-label="Buscar"
        className="h-12 card px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo">
        <button type="button" aria-pressed={filter === "todas"} onClick={() => setFilter("todas")} className={chip(filter === "todas")}>
          Todas ({counts.todas})
        </button>
        <button type="button" aria-pressed={filter === "marmita"} onClick={() => setFilter("marmita")} className={chip(filter === "marmita")}>
          Produtos ({counts.marmita})
        </button>
        <button type="button" aria-pressed={filter === "receita"} onClick={() => setFilter("receita")} className={chip(filter === "receita")}>
          Receitas ({counts.receita})
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="card p-4 text-sm text-muted">Nada encontrado.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((o) => (
            <li key={o.id} className="flex flex-col gap-3 card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{o.name}</p>
                  <p className="text-xs text-muted">
                    {o.kind === "receita" ? "Receita" : "Produto"}
                    {o.category ? ` · ${o.category}` : ""}
                  </p>
                </div>
                {!o.complete ? <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">custo incompleto</span> : null}
              </div>
              <div className="flex gap-2">
                <a href={`/producao/fichas/baixar?id=${o.id}&formato=pdf`} download className={`${download} border-primary bg-primary text-primary-foreground`}>
                  Baixar PDF
                </a>
                <a href={`/producao/fichas/baixar?id=${o.id}&formato=xlsx`} download className={`${download} border-border bg-surface`}>
                  Baixar Excel
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
