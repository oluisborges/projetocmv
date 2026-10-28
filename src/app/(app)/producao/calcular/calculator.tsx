"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatNumber, parseDecimal } from "@/lib/format";
import { ProductionResult, type PlanLine, type ResultBase } from "../production-result";

type Finished = Record<string, { balance: number; known: boolean }>;

const inputClass = "tabular h-11 w-24 rounded-xl border border-border bg-background px-3 text-right text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

/** "Quero produzir X marmitas": escolhe as marmitas e as quantidades; o resultado (preparar e comprar) aparece embaixo, ao vivo. */
export function Calculator({ base, finished, incomplete }: { base: ResultBase; finished: Finished; incomplete: { id: string; name: string }[] }) {
  const [lines, setLines] = useState<{ recipeId: string; text: string }[]>([]);
  const [pick, setPick] = useState("");

  const used = new Set(lines.map((l) => l.recipeId));
  const options = base.recipes.filter((r) => !used.has(r.id));
  const byId = useMemo(() => new Map(base.recipes.map((r) => [r.id, r])), [base.recipes]);

  const planLines: PlanLine[] = lines.map((l) => {
    const p = parseDecimal(l.text);
    return { recipeId: l.recipeId, units: p === null ? 0 : Math.max(0, Math.floor(Number(p))) };
  });

  function add() {
    if (!pick) return;
    setLines((prev) => [...prev, { recipeId: pick, text: "" }]);
    setPick("");
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Quantas marmitas você vai produzir?</h2>

        {lines.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border card px-4">
            {lines.map((l, i) => {
              const r = byId.get(l.recipeId);
              const f = finished[l.recipeId];
              if (!r) return null;
              return (
                <li key={l.recipeId} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-medium leading-snug">{r.name}</p>
                    {f?.known ? <p className="text-xs text-muted">Prontas no congelador: {formatNumber(Math.max(0, f.balance), 0)}</p> : null}
                  </div>
                  <input
                    value={l.text}
                    onChange={(e) => setLines((prev) => prev.map((x, ix) => (ix === i ? { ...x, text: e.target.value } : x)))}
                    inputMode="numeric"
                    placeholder="0"
                    aria-label={`Quantas ${r.name} produzir`}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((_, ix) => ix !== i))}
                    aria-label={`Tirar ${r.name}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl leading-none text-muted active:bg-background"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {options.length > 0 ? (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Escolha uma marmita" className="h-12 min-w-0 card px-3 text-base outline-none focus:border-primary">
              <option value="">{lines.length === 0 ? "Escolha uma marmita…" : "Adicionar outra marmita…"}</option>
              {options.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={add} disabled={!pick} className="h-12 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              Adicionar
            </button>
          </div>
        ) : base.recipes.length === 0 ? (
          <p className="card p-4 text-sm text-muted">
            Nenhuma marmita com a ficha completa ainda. Termine as fichas em <Link href="/marmitas" className="font-semibold text-primary underline">Marmitas</Link> para calcular a produção.
          </p>
        ) : null}

        {incomplete.length > 0 ? (
          <p className="text-xs text-warning">
            {incomplete.length === 1 ? "1 marmita não aparece" : `${incomplete.length} marmitas não aparecem`} porque a ficha está incompleta ({incomplete.slice(0, 3).map((i) => i.name).join(", ")}
            {incomplete.length > 3 ? "…" : ""}).
          </p>
        ) : null}
      </section>

      <ProductionResult lines={planLines} base={base} title="Lista de compras" />
    </div>
  );
}
