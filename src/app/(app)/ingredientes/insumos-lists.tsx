"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Hint } from "@/components/hint";
import { daysSince, formatBRL, formatNumber, STALE_DAYS } from "@/lib/format";
import type { ReceitaListItem } from "@/lib/recipes-data";
import { PriceRows, type IngredientRow } from "./price-list";

export type TypeFilter = "todos" | "insumos" | "receitas" | "embalagens";

const norm = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
const needsUpdate = (i: IngredientRow) => i.purchase_price <= 0 || daysSince(i.price_updated_at) > STALE_DAYS;

const CHIPS: { key: TypeFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "insumos", label: "Comida" },
  { key: "receitas", label: "Receitas" },
  { key: "embalagens", label: "Embalagens" },
];

function readyText(r: ReceitaListItem) {
  const q = r.readyWeightGrams ?? 0;
  return r.base === "un" ? `${formatNumber(q, 0)} un` : `${formatNumber(q / 1000, 2)} ${r.base === "ml" ? "L" : "kg"}`;
}

function ReceitaRows({ receitas }: { receitas: ReceitaListItem[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {receitas.map((r) => (
        <li key={r.id}>
          <Link href={`/ingredientes/receitas/${r.id}`} className="flex flex-col gap-0.5 card p-4">
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-semibold">{r.name}</span>
              {r.costPerKg !== null ? <span className="tabular shrink-0 font-extrabold">{formatBRL(r.costPerKg)}/{r.base === "un" ? "un" : r.base === "ml" ? "litro" : "kg"}</span> : <span className="shrink-0 text-xs text-warning">incompleta</span>}
            </span>
            <span className="text-xs text-muted">
              {r.readyWeightGrams ? `rende ${readyText(r)} pronto` : "informe quanto rende"}
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

const EMPTY: Record<TypeFilter, string> = {
  todos: "Nada encontrado.",
  insumos: "Nenhuma comida encontrada.",
  receitas: "Nenhuma receita encontrada.",
  embalagens: "Nenhuma embalagem encontrada.",
};

/**
 * A lista de Ingredientes: uma busca e chips deslizantes (Todos, Insumos, Receitas, Embalagens, Precisa atualizar).
 * As categorias só aparecem quando a pessoa toca na busca. Em "Todos" as seções vêm separadas, com título e contagem.
 */
export function InsumosLists({ initialType, receitas, items, canWrite }: { initialType: TypeFilter; receitas: ReceitaListItem[]; items: IngredientRow[]; canWrite: boolean }) {
  const [type, setType] = useState<TypeFilter>(initialType);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [category, setCategory] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);

  const showReceitas = type === "todos" || type === "receitas";
  const showInsumos = type === "todos" || type === "insumos";
  const showPacks = type === "todos" || type === "embalagens";

  const insumos = useMemo(() => items.filter((i) => i.kind !== "embalagem"), [items]);
  const packs = useMemo(() => items.filter((i) => i.kind === "embalagem"), [items]);
  const pendingCount = items.filter(needsUpdate).length;
  const counts: Record<TypeFilter, number> = { todos: receitas.length + items.length, insumos: insumos.length, receitas: receitas.length, embalagens: packs.length };
  const categories = useMemo(() => [...new Set([...(showInsumos ? insumos : []), ...(showPacks ? packs : [])].map((i) => i.category).filter((c): c is string => Boolean(c)))].sort(), [insumos, packs, showInsumos, showPacks]);

  const q = norm(query);
  const match = (name: string) => q === "" || norm(name).includes(q);
  const pass = (i: IngredientRow) => (!category || i.category === category) && (!onlyPending || needsUpdate(i)) && match(i.name);
  // "Precisa atualizar" e categoria falam de preço de compra: as receitas ficam de fora enquanto algum deles está ligado.
  const receitasShown = showReceitas && !onlyPending && !category ? receitas.filter((r) => match(r.name)) : [];
  const insumosShown = showInsumos ? insumos.filter(pass) : [];
  const packsShown = showPacks ? packs.filter(pass) : [];
  const total = receitasShown.length + insumosShown.length + packsShown.length;

  const chip = (on: boolean) => `h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground"}`;
  const catChip = (on: boolean) => `h-9 shrink-0 rounded-full border px-3 text-xs font-semibold ${on ? "border-primary bg-tint text-primary" : "border-border bg-surface text-muted"}`;
  const heading = (text: string, count: number, tip?: React.ReactNode) =>
    type === "todos" ? (
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        {text} <span className="font-normal">({count})</span>
        {tip}
      </h2>
    ) : null;
  const showCategories = (focused || query !== "" || category !== "") && categories.length > 0;

  return (
    <section className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Buscar comida, receita ou embalagem…"
        aria-label="Buscar"
        className="h-12 card px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />

      {showCategories ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Categorias">
          <button type="button" onMouseDown={(e) => e.preventDefault()} className={catChip(category === "")} onClick={() => setCategory("")}>
            Todas as categorias
          </button>
          {categories.map((c) => (
            <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} className={catChip(category === c)} onClick={() => setCategory(category === c ? "" : c)}>
              {c}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de item">
        {CHIPS.map((c) => (
          <button key={c.key} type="button" aria-pressed={type === c.key} onClick={() => setType(c.key)} className={chip(type === c.key)}>
            {c.label} ({counts[c.key]})
          </button>
        ))}
        <button type="button" aria-pressed={onlyPending} onClick={() => setOnlyPending((v) => !v)} className={`${chip(onlyPending)} ${onlyPending ? "" : "border-warning/60 text-warning"}`}>
          Precisa atualizar ({pendingCount})
        </button>
      </div>

      {total === 0 ? (
        <p className="card p-4 text-sm text-muted">{EMPTY[type]}</p>
      ) : (
        <>
          {receitasShown.length > 0 ? (
            <div className="flex flex-col gap-2">
              {heading("Receitas", receitasShown.length, <Hint>O que você faz em lote (arroz, estrogonofe, purê) e usa em várias marmitas. O sal e o tempero ficam dentro do custo por kg.</Hint>)}
              <ReceitaRows receitas={receitasShown} />
            </div>
          ) : null}
          {insumosShown.length > 0 ? (
            <div className="flex flex-col gap-2">
              {heading("Comida", insumosShown.length)}
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
