"use client";

import { useMemo, useState } from "react";
import { Hint } from "@/components/hint";
import { productionNeeds, shoppingList } from "@/lib/calc";
import { formatBRL, formatBaseQty, formatNumber } from "@/lib/format";
import type { ProductionBase } from "@/lib/production-data";
import { batchesLabel, buyRows, groupBySupplier, shoppingText, type BuyRow } from "@/lib/production-view";

export type PlanLine = { recipeId: string; units: number };

/** O que `ProductionResult` precisa da marmitaria (tudo serializável). */
export type ResultBase = Pick<ProductionBase, "recipes" | "ingredients" | "receitas" | "stock">;

const noteClass = "text-xs leading-relaxed text-muted";

function BuyTable({ rows }: { rows: BuyRow[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 border-b border-border bg-background/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
        <span>Insumo</span>
        <span className="text-right">Precisa</span>
        <span className="text-right">Tem</span>
        <span className="text-right">Comprar</span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-x-2 px-3 py-2.5 text-sm">
            <span className="font-medium leading-snug">{r.name}</span>
            <span className="tabular text-right text-muted">{r.need}</span>
            <span className="tabular text-right text-muted">{r.stock ?? "—"}</span>
            <span className="tabular text-right font-extrabold">{r.buy}</span>
            {r.packs ? <span className="col-span-4 pt-0.5 text-right text-xs text-muted">{r.packs}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * O resultado de um plano de produção: quanto sai de cada marmita, o que preparar (receitas em lote) e o que comprar
 * (necessário − estoque, em embalagens inteiras). Serve para a calculadora e para o plano da semana.
 */
export function ProductionResult({ lines, base, title }: { lines: PlanLine[]; base: ResultBase; title: string }) {
  const [copied, setCopied] = useState(false);

  const calc = useMemo(() => {
    const recipeById = new Map(base.recipes.map((r) => [r.id, r]));
    const active = lines.filter((l) => l.units > 0 && recipeById.has(l.recipeId));
    const receitas = new Map(Object.entries(base.receitas).map(([id, r]) => [id, { readyGrams: r.readyGrams, parts: r.parts }]));
    const needs = productionNeeds(
      active.map((l) => ({ units: l.units, perUnit: new Map(Object.entries(recipeById.get(l.recipeId)!.usage)) })),
      receitas,
    );
    const stock = new Map(Object.entries(base.stock).map(([id, b]) => [id, b.balance]));
    const pack = new Map(Object.entries(base.ingredients).flatMap(([id, i]) => (i.packSize ? [[id, i.packSize] as const] : [])));
    const list = shoppingList(needs.ingredients, stock, pack);
    const rows = buyRows(list, base.ingredients, (id) => base.stock[id]?.known === true);
    const marmitas = active.reduce((n, l) => n + l.units, 0);
    const cost = active.reduce((s, l) => s + l.units * recipeById.get(l.recipeId)!.costPerPortion, 0);
    const buyCost = rows.toBuy.reduce((s, r) => s + r.cost, 0);
    return { needs, rows, marmitas, cost, buyCost };
  }, [lines, base]);

  if (calc.marmitas === 0) return null;
  const text = shoppingText(title, calc.rows.toBuy, calc.buyCost);
  const groups = groupBySupplier(calc.rows.toBuy);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie a lista:", text);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-1 card p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Produção</p>
        <p className="tabular text-2xl font-extrabold tracking-tight">{formatNumber(calc.marmitas, 0)} marmitas</p>
        <p className="tabular text-sm text-muted">
          Custo de produzir tudo: <strong className="text-foreground">{formatBRL(calc.cost)}</strong> · {formatBRL(calc.cost / calc.marmitas)} por marmita
        </p>
      </section>

      {calc.needs.receitas.size > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            O que preparar
            <Hint>As receitas em lote (arroz, estrogonofe) que as marmitas usam: quanto precisa ficar pronto e quantos lotes isso dá. Os insumos delas já estão na lista de compras.</Hint>
          </h2>
          <ul className="flex flex-col divide-y divide-border card px-4">
            {[...calc.needs.receitas].map(([id, r]) => {
              const bp = base.receitas[id];
              return (
                <li key={id} className="flex flex-col gap-0.5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{bp?.name ?? "Receita"}</span>
                    <span className="tabular shrink-0 font-extrabold">{formatBaseQty(r.grams, "g")} prontos</span>
                  </div>
                  <p className={noteClass}>
                    São {batchesLabel(r.batches)} {bp ? `(cada lote rende ${formatBaseQty(bp.readyGrams, "g")})` : ""}.{" "}
                    {r.wholeBatches > r.batches + 0.005 ? `Faça ${r.wholeBatches} ${r.wholeBatches === 1 ? "lote" : "lotes"} (${formatBaseQty(r.wholeBatches * (bp?.readyGrams ?? 0), "g")}); a sobra serve para outro dia.` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          O que comprar
          <Hint>O que a produção pede menos o que você tem em estoque, arredondado para a embalagem em que você compra. Insumo com um traço em Tem nunca foi contado: o sistema considera zero.</Hint>
        </h2>
        {calc.rows.toBuy.length === 0 ? (
          <p className="card p-4 text-sm text-success">Tudo que a produção pede já está no estoque. Nada para comprar.</p>
        ) : (
          groups.map((g) => (
            <div key={g.supplier ?? "todos"} className="flex flex-col gap-2">
              {g.supplier ? <h3 className="text-sm font-bold">{g.supplier}</h3> : null}
              <BuyTable rows={g.rows} />
            </div>
          ))
        )}
        {calc.rows.toBuy.length > 0 ? (
          <>
            <p className="tabular text-sm text-muted">
              Compra estimada: <strong className="text-foreground">{formatBRL(calc.buyCost)}</strong> (embalagens inteiras, pelo preço cadastrado)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={copy} className="h-12 rounded-xl border border-border bg-surface text-sm font-semibold">
                {copied ? "Copiado ✓" : "Copiar lista"}
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                Enviar no WhatsApp
              </a>
            </div>
          </>
        ) : null}
      </section>

      {calc.rows.enough.length > 0 ? (
        <details className="card px-4">
          <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold text-muted">Já tem em estoque ({calc.rows.enough.length})</summary>
          <ul className="divide-y divide-border pb-1">
            {calc.rows.enough.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                <span>{r.name}</span>
                <span className="tabular shrink-0 text-muted">
                  precisa {r.need} · tem {r.stock}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
