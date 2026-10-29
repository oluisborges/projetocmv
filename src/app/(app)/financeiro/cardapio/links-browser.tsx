"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { filterLinkItems, tabOf, type LinkKind, type LinkTab } from "@/lib/menu/links-filter";
import { normalizeName } from "@/lib/names";
import { LinkRow, type TargetOption } from "./link-row";

export type LinkItem = {
  id: string;
  name: string;
  kind: "item" | "option";
  /** "" = sem vínculo · "ignore" = não é marmita · "r:id" ficha · "c:id" combo */
  target: string;
  units: number;
  sold: { qty: number; revenue: number } | null;
  /** Vendas em todo o período importado (mês atual + 3 anteriores). */
  soldRange: { qty: number; revenue: number } | null;
  suggestion: TargetOption | null;
};

type Tab = LinkTab;
type Kind = LinkKind;

const tabClass = (on: boolean) => `flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold ${on ? "bg-surface shadow-sm" : "text-muted"}`;
const chipClass = (on: boolean) => `flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`;

/** Abas (sem vínculo / vinculados) e busca da tela de vínculos. Tudo na hora, no navegador. */
export function LinksBrowser({ items, recipes, combos, canWrite }: { items: LinkItem[]; recipes: TargetOption[]; combos: TargetOption[]; canWrite: boolean }) {
  const pendingCount = items.filter((i) => i.target === "").length;
  const [tab, setTab] = useState<Tab>(pendingCount > 0 ? "pending" : "done");
  const [kind, setKind] = useState<Kind>("all");
  const [query, setQuery] = useState("");
  // linha salva fica na aba onde estava até o dono trocar de aba: assim dá para ajustar "leva N marmitas" sem ela sumir
  const [pinned, setPinned] = useState<Map<string, Tab>>(new Map());
  const deferred = useDeferredValue(query);

  const words = useMemo(() => normalizeName(deferred).split(" ").filter(Boolean), [deferred]);
  const visible = useMemo(() => filterLinkItems(items, { tab, kind, query: deferred, pinned }), [items, pinned, tab, kind, deferred]);

  const switchTab = (t: Tab) => {
    setTab(t);
    setPinned(new Map());
  };

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Produtos do cardápio" className="flex gap-1 rounded-xl bg-border/60 p-1">
        <button type="button" role="tab" aria-selected={tab === "pending"} onClick={() => switchTab("pending")} className={tabClass(tab === "pending")}>
          Sem vínculo
          <span className={`tabular rounded-full px-1.5 text-xs ${pendingCount > 0 ? "bg-warning/15 text-warning" : "bg-border text-muted"}`}>{pendingCount}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "done"} onClick={() => switchTab("done")} className={tabClass(tab === "done")}>
          Vinculados
          <span className="tabular rounded-full bg-border px-1.5 text-xs text-muted">{items.length - pendingCount}</span>
        </button>
      </div>

      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar produto ou opção…"
          aria-label="Buscar produto ou opção"
          autoComplete="off"
          enterKeyHint="search"
          className="h-12 w-full card pl-4 pr-12 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca" className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-xl text-muted">
            ×
          </button>
        ) : null}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Tipo">
        {(
          [
            ["all", "Todos"],
            ["item", "Produtos"],
            ["option", "Opções (complementos)"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chipClass(kind === k)}>
            {label}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted" aria-live="polite">
        {visible.length} {visible.length === 1 ? "resultado" : "resultados"}
        {words.length > 0 ? ` para “${deferred.trim()}”` : ""}
      </p>

      {visible.length === 0 ? (
        <p className="card p-4 text-sm text-muted">
          {words.length > 0 || kind !== "all"
            ? "Nada encontrado com esse filtro. Confira a busca ou troque de aba."
            : tab === "pending"
              ? "Tudo vinculado por aqui."
              : "Nenhum produto vinculado ainda. Comece pela aba “Sem vínculo”."}
        </p>
      ) : (
        <ul className="divide-y divide-border card px-4">
          {visible.map((i) => (
            <LinkRow
              key={i.id}
              product={{ id: i.id, name: i.name, kind: i.kind, target: i.target, units: i.units }}
              sold={i.sold}
              soldRange={i.soldRange}
              recipes={recipes}
              combos={combos}
              suggestion={i.suggestion}
              canWrite={canWrite}
              onSaved={() => setPinned((m) => (m.has(i.id) ? m : new Map(m).set(i.id, tabOf(i))))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
