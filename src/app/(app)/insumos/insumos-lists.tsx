"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Hint } from "@/components/hint";
import { daysSince, formatBRL, formatNumber, STALE_DAYS } from "@/lib/format";
import type { ReceitaListItem } from "@/lib/recipes-data";
import { PriceRows, type IngredientRow } from "./price-list";

type Tab = "todos" | "receitas" | "insumos" | "embalagens";

const norm = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
const needsUpdate = (i: IngredientRow) => i.purchase_price <= 0 || daysSince(i.price_updated_at) > STALE_DAYS;

function ReceitaRows({ receitas }: { receitas: ReceitaListItem[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {receitas.map((r) => (
        <li key={r.id}>
          <Link href={`/insumos/receitas/${r.id}`} className="flex flex-col gap-0.5 card p-4">
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-semibold">{r.name}</span>
              {r.costPerKg !== null ? <span className="tabular shrink-0 font-extrabold">{formatBRL(r.costPerKg)}/kg</span> : <span className="shrink-0 text-xs text-warning">incompleta</span>}
            </span>
            <span className="text-xs text-muted">
              {r.readyWeightGrams ? `rende ${formatNumber(r.readyWeightGrams / 1000, 2)} kg pronto` : "informe quanto rende"}
              {r.batchCost !== null ? ` · lote ${formatBRL(r.batchCost)}` : ""}
              {" · "}
              {r.usedIn === 0 ? "ainda não usada" : `usada em ${r.usedIn} ${r.usedIn === 1 ? "marmita" : "marmitas"}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const EMPTY: Record<Tab, string> = {
  todos: "Nada encontrado.",
  receitas: "Nenhuma receita encontrada.",
  insumos: "Nenhum insumo encontrado.",
  embalagens: "Nenhuma embalagem encontrada.",
};

/**
 * O conteúdo de uma aba de Insumos: UMA busca (e os filtros) para a aba inteira, valendo para todas as seções dela
 * (receitas, insumos, embalagens). Em "Todos" as seções vêm separadas, cada uma com o próprio título.
 */
export function InsumosLists({ tab, receitas, items, canWrite, hasReceitaTip }: { tab: Tab; receitas: ReceitaListItem[]; items: IngredientRow[]; canWrite: boolean; hasReceitaTip?: boolean }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const showReceitas = tab === "todos" || tab === "receitas";
  const showInsumos = tab === "todos" || tab === "insumos";
  const showPacks = tab === "todos" || tab === "embalagens";
  const showFilters = showInsumos || showPacks;

  const insumos = useMemo(() => items.filter((i) => i.kind !== "embalagem"), [items]);
  const packs = useMemo(() => items.filter((i) => i.kind === "embalagem"), [items]);
  const inView = useMemo(() => [...(showInsumos ? insumos : []), ...(showPacks ? packs : [])], [insumos, packs, showInsumos, showPacks]);
  const categories = useMemo(() => [...new Set(inView.map((i) => i.category).filter((c): c is string => Boolean(c)))].sort(), [inView]);
  const pendingCount = inView.filter(needsUpdate).length;

  const q = norm(query);
  const match = (name: string) => q === "" || norm(name).includes(q);
  const pass = (i: IngredientRow) => (!category || i.category === category) && (!onlyPending || needsUpdate(i)) && match(i.name);
  const receitasShown = showReceitas ? receitas.filter((r) => match(r.name)) : [];
  const insumosShown = showInsumos ? insumos.filter(pass) : [];
  const packsShown = showPacks ? packs.filter(pass) : [];
  const total = receitasShown.length + insumosShown.length + packsShown.length;

  const canFilter = showFilters && inView.length > 0;
  const activeFilters = (onlyPending ? 1 : 0) + (category ? 1 : 0);
  const chip = (active: boolean) => `h-11 shrink-0 rounded-full border px-4 text-sm font-medium ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`;
  const heading = (text: string, count: number) =>
    tab === "todos" ? (
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        {text} <span className="font-normal">({count})</span>
      </h2>
    ) : null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === "receitas" ? "Buscar receita…" : tab === "insumos" ? "Buscar insumo…" : tab === "embalagens" ? "Buscar embalagem…" : "Buscar insumo, embalagem ou receita…"}
          aria-label="Buscar"
          className="h-12 min-w-0 flex-1 card px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {canFilter ? (
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-controls="insumos-filtros"
            className={`flex h-12 shrink-0 items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold ${filtersOpen || activeFilters > 0 ? "border-primary bg-tint text-primary" : "border-border bg-surface"}`}
          >
            Filtros
            {activeFilters > 0 ? <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{activeFilters}</span> : null}
          </button>
        ) : null}
      </div>

      {canFilter && filtersOpen ? (
        <div id="insumos-filtros" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <button type="button" className={chip(onlyPending)} onClick={() => setOnlyPending((v) => !v)} aria-pressed={onlyPending}>
            Precisa atualizar ({pendingCount})
          </button>
          <button type="button" className={chip(category === "")} onClick={() => setCategory("")}>
            Todas
          </button>
          {categories.map((c) => (
            <button key={c} type="button" className={chip(category === c)} onClick={() => setCategory(category === c ? "" : c)}>
              {c}
            </button>
          ))}
        </div>
      ) : null}

      {total === 0 ? (
        <p className="card p-4 text-sm text-muted">{EMPTY[tab]}</p>
      ) : (
        <>
          {receitasShown.length > 0 ? (
            <div className="flex flex-col gap-2">
              {tab === "todos" ? (
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                  Receitas <span className="font-normal">({receitasShown.length})</span>
                  {hasReceitaTip ? <Hint>O que você faz em lote (arroz, estrogonofe, purê) e usa em várias marmitas. O sal e o tempero ficam dentro do custo por kg.</Hint> : null}
                </h2>
              ) : null}
              <ReceitaRows receitas={receitasShown} />
            </div>
          ) : null}
          {insumosShown.length > 0 ? (
            <div className="flex flex-col gap-2">
              {heading("Insumos", insumosShown.length)}
              <PriceRows items={insumosShown} canWrite={canWrite} />
            </div>
          ) : null}
          {packsShown.length > 0 ? (
            <div className="flex flex-col gap-2">
              {heading("Embalagens", packsShown.length)}
              <PriceRows items={packsShown} canWrite={canWrite} />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
