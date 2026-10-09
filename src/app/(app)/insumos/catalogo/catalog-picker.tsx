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

export function CatalogPicker({ items }: { items: CatalogItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  return (
    <ActionForm action={importFromCatalog} submitLabel={selected.size > 0 ? `Importar ${selected.size} ${selected.size === 1 ? "item" : "itens"}` : "Escolha os itens acima"}>
      {[...groups].map(([group, list]) => {
        const available = list.filter((i) => !i.imported).map((i) => i.id);
        const allOn = available.length > 0 && available.every((id) => selected.has(id));
        return (
          <fieldset key={group} className="flex flex-col rounded-xl border border-border bg-surface px-4">
            <legend className="sr-only">{group}</legend>
            <div className="flex items-center justify-between border-b border-border py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{group}</h2>
              {available.length > 0 ? (
                <button type="button" onClick={() => toggle(available, !allOn)} className="text-sm font-semibold text-primary">
                  {allOn ? "Desmarcar todos" : "Marcar todos"}
                </button>
              ) : null}
            </div>
            <ul className="divide-y divide-border">
              {list.map((i) => (
                <li key={i.id}>
                  <label className={`flex min-h-12 items-center gap-3 py-2 ${i.imported ? "opacity-50" : ""}`}>
                    <input
                      type="checkbox"
                      name="ids"
                      value={i.id}
                      disabled={i.imported}
                      checked={selected.has(i.id)}
                      onChange={(e) => toggle([i.id], e.target.checked)}
                      className="size-5 accent-[var(--primary)]"
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
