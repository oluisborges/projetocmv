"use client";

import { useState } from "react";
import { Hint } from "@/components/hint";
import { formatBRL, formatBaseQty, formatNumber } from "@/lib/format";
import { batchesLabel, groupBySupplier, shoppingText, type BuyRow, type ProductionCalc, type ProductionInput } from "@/lib/production-view";
import { setBought } from "./actions";

const noteClass = "text-xs leading-relaxed text-muted";

/** Passo "O que preparar": as receitas em lote que as marmitas usam, e quantos lotes fazer. */
export function PrepareList({ calc, receitas }: { calc: ProductionCalc; receitas: ProductionInput["receitas"] }) {
  if (calc.needs.receitas.size === 0) {
    return <p className="card p-4 text-sm text-muted">Nenhuma receita em lote nesta produção. Pode ir direto para as compras.</p>;
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        Receitas para preparar
        <Hint>As receitas em lote (arroz, estrogonofe…) que as marmitas usam: quanto precisa ficar pronto e quantos lotes isso dá. Os insumos delas já estão na lista de compras.</Hint>
      </h2>
      <ul className="flex flex-col divide-y divide-border card px-4">
        {[...calc.needs.receitas].map(([id, r]) => {
          const bp = receitas[id];
          const whole = r.wholeBatches;
          return (
            <li key={id} className="flex flex-col gap-1 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{bp?.name ?? "Receita"}</span>
                <span className="tabular shrink-0 font-extrabold">{formatBaseQty(r.grams, "g")} prontos</span>
              </div>
              <p className="text-sm">
                {whole > 0 ? (
                  <>
                    Faça <strong>{whole} {whole === 1 ? "lote" : "lotes"}</strong>
                    {bp ? ` (cada um rende ${formatBaseQty(bp.readyGrams, "g")})` : ""}.
                  </>
                ) : (
                  "Informe quanto a receita rende pronta para calcular os lotes."
                )}
              </p>
              {r.batches > 0 && whole > r.batches + 0.005 ? <p className={noteClass}>Precisa de {batchesLabel(r.batches)}; a sobra serve para outro dia.</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CheckRow({ row, checked, disabled, onToggle }: { row: BuyRow; checked: boolean; disabled: boolean; onToggle: (next: boolean) => void }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onToggle(e.target.checked)} aria-label={`Comprei ${row.name}`} className="mt-0.5 size-6 shrink-0 accent-primary" />
      <div className="min-w-0 flex-1">
        <p className={`font-medium leading-snug ${checked ? "text-muted line-through" : ""}`}>{row.name}</p>
        <p className={noteClass}>
          precisa {row.need}
          {row.stock ? ` · tem ${row.stock}` : " · estoque não contado"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`tabular font-extrabold ${checked ? "text-muted line-through" : ""}`}>{row.buy}</p>
        {row.packs ? <p className={noteClass}>{row.packs}</p> : null}
      </div>
    </li>
  );
}

/**
 * Passo "O que comprar": a lista com caixinha. Marcar "comprei" dá entrada no estoque (e desmarcar desfaz),
 * então o estoque se atualiza sozinho enquanto a pessoa faz as compras.
 */
export function BuyChecklist({
  calc,
  planId,
  bought,
  qtyOf,
  canWrite,
  title,
  onBoughtChange,
}: {
  calc: ProductionCalc;
  planId: string;
  /** Ids dos insumos já marcados como comprados. */
  bought: Set<string>;
  /** Quanto dar de entrada no estoque ao marcar (embalagens inteiras, na unidade-base). */
  qtyOf: (id: string) => number;
  canWrite: boolean;
  title: string;
  onBoughtChange: (id: string, next: boolean) => void;
}) {
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const rows = calc.rows.toBuy;
  const groups = groupBySupplier(rows);
  const done = rows.filter((r) => bought.has(r.id)).length;
  const text = shoppingText(title, rows.filter((r) => !bought.has(r.id)), rows.filter((r) => !bought.has(r.id)).reduce((s, r) => s + r.cost, 0));

  async function toggle(row: BuyRow, next: boolean) {
    setError(undefined);
    onBoughtChange(row.id, next);
    const result = await setBought({ planId, ingredientId: row.id, bought: next, qtyBase: qtyOf(row.id) });
    if (!result.ok) {
      onBoughtChange(row.id, !next);
      setError(result.error);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie a lista:", text);
    }
  }

  if (rows.length === 0) {
    return <p className="card p-4 text-sm text-success">Tudo que esta produção pede já está no estoque. Nada para comprar.</p>;
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Lista de compras
          <Hint>O que a produção pede menos o que você tem em estoque, em embalagens inteiras. Marque o que já comprou: o estoque recebe a compra sozinho.</Hint>
        </h2>
        <span className="tabular text-sm font-semibold">
          {done} de {rows.length}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-border" aria-hidden>
        <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(done / rows.length) * 100}%` }} />
      </div>

      {groups.map((g) => (
        <div key={g.supplier ?? "todos"} className="flex flex-col gap-1">
          {g.supplier ? <h3 className="text-sm font-bold">{g.supplier}</h3> : null}
          <ul className="flex flex-col divide-y divide-border card px-4">
            {g.rows.map((r) => (
              <CheckRow key={r.id} row={r} checked={bought.has(r.id)} disabled={!canWrite} onToggle={(next) => toggle(r, next)} />
            ))}
          </ul>
        </div>
      ))}

      {error ? (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

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
    </section>
  );
}

/** Resumo no topo dos passos 2 a 4: quantas marmitas e quanto custa produzir. */
export function ProductionSummary({ calc }: { calc: ProductionCalc }) {
  return (
    <p className="tabular rounded-xl bg-background px-4 py-3 text-sm">
      <strong>{formatNumber(calc.marmitas, 0)} marmitas</strong> · custo de produzir tudo {formatBRL(calc.cost)} ({formatBRL(calc.marmitas > 0 ? calc.cost / calc.marmitas : 0)} cada)
    </p>
  );
}
