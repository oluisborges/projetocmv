"use client";

import { useState } from "react";
import { ActionForm } from "@/components/forms";
import { formatPurchaseSize } from "@/lib/format";
import { importFromCatalog } from "../actions";

export type CatalogItem = {
  id: string;
  name: string;
  category: string | null;
  purchase_unit: string;
  purchase_qty: number;
  imported: boolean;
};

export type CatalogRecipe = { id: string; name: string; category: string | null; itemCount: number; imported: boolean };

const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function CatalogPicker({ items, recipes }: { items: CatalogItem[]; recipes: CatalogRecipe[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedRecipes, setSelectedRecipes] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  // Quem não combina com a busca só fica escondido (não sai do formulário): o que já foi marcado continua marcado.
  const q = plain(query);
  const matches = (i: CatalogItem) => q === "" || plain(i.name).includes(q) || plain(i.category ?? "").includes(q);
  const visibleCount = items.filter(matches).length;

  const groups = new Map<string, CatalogItem[]>();
  for (const i of items) {
    const g = i.category ?? "Outros";
    groups.set(g, [...(groups.get(g) ?? []), i]);
  }

  const toggle = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const toggleRecipe = (id: string, on: boolean) =>
    setSelectedRecipes((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const total = selected.size + selectedRecipes.size;
  const checkbox = "size-6 shrink-0 accent-[var(--primary)]";

  return (
    <ActionForm action={importFromCatalog} submitLabel={total > 0 ? `Importar ${total} ${total === 1 ? "item" : "itens"}` : "Escolha os itens acima"}>
      {recipes.length > 0 ? (
        <fieldset className="flex flex-col rounded-xl border-2 border-accent bg-surface px-4">
          <legend className="sr-only">Fichas prontas</legend>
          <div className="border-b border-border py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Fichas prontas</h2>
            <p className="pt-1 text-sm text-muted">
              Fichas já montadas, em gramas prontos. Os insumos delas vêm junto; depois você ajusta as gramas e preenche os preços.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {recipes.map((r) => (
              <li key={r.id}>
                <label className={`flex min-h-14 items-center gap-3 py-2 ${r.imported ? "opacity-50" : ""}`}>
                  <input
                    type="checkbox"
                    name="recipes"
                    value={r.id}
                    disabled={r.imported}
                    checked={selectedRecipes.has(r.id)}
                    onChange={(e) => toggleRecipe(r.id, e.target.checked)}
                    className={checkbox}
                  />
                  <span className="flex-1">
                    {r.name}
                    <span className="block text-xs text-muted">
                      {r.category ? `${r.category} · ` : ""}
                      {r.itemCount} itens
                    </span>
                  </span>
                  {r.imported ? <span className="text-xs text-muted">já tem</span> : null}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      <h2 className="pt-2 text-sm font-semibold uppercase tracking-wider text-muted">Insumos e embalagens</h2>
      <div className="sticky top-16 z-10 -mx-4 bg-background/95 px-4 py-2 backdrop-blur">
        <label className="flex h-12 items-center gap-2 card px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <span aria-hidden className="text-muted">
            ⌕
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder={`Buscar entre ${items.length} insumos e embalagens`}
            aria-label="Buscar insumo ou embalagem"
            className="w-full bg-transparent text-base outline-none"
          />
        </label>
        {q !== "" ? (
          <p role="status" className="px-1 pt-1.5 text-xs text-muted">
            {visibleCount === 0 ? "Nada encontrado. Confira a escrita ou cadastre um insumo novo em Insumos → + Novo." : `${visibleCount} ${visibleCount === 1 ? "resultado" : "resultados"}`}
          </p>
        ) : null}
      </div>
      {[...groups].map(([group, list]) => {
        const shown = list.filter(matches);
        const available = shown.filter((i) => !i.imported).map((i) => i.id);
        const allOn = available.length > 0 && available.every((id) => selected.has(id));
        return (
          <fieldset key={group} className={`flex flex-col card px-4 ${shown.length === 0 ? "hidden" : ""}`}>
            <legend className="sr-only">{group}</legend>
            <div className="flex items-center justify-between border-b border-border py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">{group}</h3>
              {available.length > 0 ? (
                <button type="button" onClick={() => toggle(available, !allOn)} className="h-11 px-2 text-sm font-semibold text-primary">
                  {allOn ? "Desmarcar todos" : "Marcar todos"}
                </button>
              ) : null}
            </div>
            <ul className="divide-y divide-border">
              {list.map((i) => (
                <li key={i.id} className={matches(i) ? "" : "hidden"}>
                  <label className={`flex min-h-12 items-center gap-3 py-2 ${i.imported ? "opacity-50" : ""}`}>
                    <input
                      type="checkbox"
                      name="ids"
                      value={i.id}
                      disabled={i.imported}
                      checked={selected.has(i.id)}
                      onChange={(e) => toggle([i.id], e.target.checked)}
                      className={checkbox}
                    />
                    <span className="flex-1">
                      {i.name}
                      <span className="block text-xs text-muted">por {formatPurchaseSize(i.purchase_qty, i.purchase_unit)}</span>
                    </span>
                    {i.imported ? <span className="text-xs text-muted">já tem</span> : null}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        );
      })}
    </ActionForm>
  );
}
