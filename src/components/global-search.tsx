"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Sheet } from "@/components/sheet";
import { searchAll, type SearchResponse } from "@/app/(app)/search-actions";

const TYPE_LABEL = { insumo: "Insumo", marmita: "Marmita", combo: "Combo" } as const;

function SearchBody({ onPick }: { onPick: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const seq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = query.trim();
    const id = ++seq.current; // também ao apagar o texto: resposta atrasada de um termo antigo é descartada
    if (q.length < 2) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const found = await searchAll(q).catch((): SearchResponse => ({ results: [], total: 0 }));
        if (id === seq.current) setResults(found);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const q = query.trim();
  const ready = q.length >= 2;

  return (
    <div className="flex flex-col gap-3 p-4">
      <input
        ref={inputRef}
        type="search"
        inputMode="search"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value.trim().length < 2) setResults(null);
        }}
        placeholder="Buscar insumo, marmita ou combo"
        aria-label="Buscar insumo, marmita ou combo"
        className="h-12 w-full rounded-xl border border-border bg-background px-4 text-base"
      />
      {!ready ? (
        <p className="text-sm text-muted">Digite pelo menos 2 letras. Por exemplo: frango, arroz, marmita fit.</p>
      ) : results === null ? (
        <p role="status" className="text-sm text-muted">
          Buscando…
        </p>
      ) : results.results.length === 0 ? (
        <p role="status" className="text-sm text-muted">
          {pending ? "Buscando…" : `Nada encontrado para “${q}”.`}
        </p>
      ) : (
        <div className={pending ? "opacity-60" : undefined} aria-busy={pending}>
          <ul className="divide-y divide-border">
            {results.results.map((r) => (
              <li key={`${r.type}-${r.id}`}>
                <Link href={r.href} onClick={onPick} className="flex min-h-12 items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{r.name}</span>
                    <span className="block truncate text-xs text-muted">{r.detail}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{TYPE_LABEL[r.type]}</span>
                </Link>
              </li>
            ))}
          </ul>
          {results.total > results.results.length ? (
            <p role="status" className="pt-3 text-sm text-muted">
              Mostrando {results.results.length} de {results.total}. Digite mais letras para afinar.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Lupa no cabeçalho: abre a busca de insumos, marmitas e combos. */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar"
        className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white"
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Buscar">
        <SearchBody onPick={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
