"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BaixarFichaButton } from "@/components/baixar-ficha";
import { FichaItems } from "@/components/ficha-items";
import type { FichaOption } from "@/lib/ficha-tecnica-data";

const norm = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
type Filter = "todas" | "marmita" | "receita";

/** Escolher um produto ou receita (a seta mostra o que tem dentro) e baixar a ficha técnica. */
export function FichasList({ options }: { options: FichaOption[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

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
                <button type="button" aria-expanded={open.has(o.id)} onClick={() => toggle(o.id)} className="tap-area flex min-w-0 flex-1 items-start gap-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{o.name}</span>
                    <span className="block text-xs text-muted">
                      {o.kind === "receita" ? "Receita" : "Produto"}
                      {o.category ? ` · ${o.category}` : ""}
                      {` · ${o.items.length} ${o.items.length === 1 ? "item" : "itens"}`}
                    </span>
                  </span>
                  <span aria-hidden className={`mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition-transform ${open.has(o.id) ? "rotate-180" : ""}`}>
                    <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 8 5 5 5-5" />
                    </svg>
                  </span>
                </button>
                {!o.complete ? <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">custo incompleto</span> : null}
              </div>
              {open.has(o.id) ? <FichaItems items={o.items} /> : null}
              <div className={`grid gap-2 ${o.kind === "marmita" ? "grid-cols-2" : ""}`}>
                <BaixarFichaButton id={o.id} name={o.name} />
                {o.kind === "marmita" ? (
                  <Link href={`/cardapio/${o.id}/nutricional`} className="flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-3 py-1 text-center text-sm font-semibold leading-tight">
                    Baixar tabela nutricional
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
