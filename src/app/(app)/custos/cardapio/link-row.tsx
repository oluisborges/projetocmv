"use client";

import { useRef, useState } from "react";
import { Spinner } from "@/components/spinner";
import { formatBRL, formatNumber } from "@/lib/format";
import { saveMenuLink } from "./actions";

export type TargetOption = { value: string; label: string };

type Props = {
  product: { id: string; name: string; kind: "item" | "option"; target: string; units: number };
  /** O que o produto vendeu no mês em andamento (ajuda a decidir o que vincular primeiro). */
  sold: { qty: number; revenue: number } | null;
  recipes: TargetOption[];
  combos: TargetOption[];
  suggestion: TargetOption | null;
  canWrite: boolean;
};

/** Uma linha da tela de vínculos: escolhe a ficha/combo e salva sozinha ao mudar. */
export function LinkRow({ product, sold, recipes, combos, suggestion, canWrite }: Props) {
  const [target, setTarget] = useState(product.target);
  const [units, setUnits] = useState(String(product.units));
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });
  const latest = useRef(0); // só a última resposta vale

  async function save(nextTarget: string, nextUnits: string) {
    const mine = ++latest.current;
    setState({ kind: "saving" });
    const result = await saveMenuLink(product.id, nextTarget, nextUnits);
    if (mine !== latest.current) return;
    if (result.ok) {
      setState({ kind: "saved" });
      setTimeout(() => setState((s) => (s.kind === "saved" ? { kind: "idle" } : s)), 2000);
    } else setState({ kind: "error", message: result.error });
  }

  const isRecipe = target.startsWith("r:");
  const pending = target === "";

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium leading-snug">{product.name}</p>
          <p className="text-xs text-muted">
            {product.kind === "option" ? "adicional · " : ""}
            {sold ? (
              <>
                vendeu <strong className="tabular text-foreground">{formatNumber(sold.qty, 0)}</strong> no mês · {formatBRL(sold.revenue)}
              </>
            ) : (
              "sem vendas neste mês"
            )}
          </p>
        </div>
        {pending ? <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">sem vínculo</span> : null}
      </div>

      <div className="flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Ficha ou combo de {product.name}</span>
          <select
            value={target}
            disabled={!canWrite}
            onChange={(e) => {
              setTarget(e.target.value);
              void save(e.target.value, units);
            }}
            className="h-11 w-full card px-3 text-base disabled:opacity-60"
          >
            <option value="">Escolha a ficha…</option>
            <option value="ignore">Não é marmita (bebida, taxa…)</option>
            {recipes.length > 0 ? (
              <optgroup label="Fichas">
                {recipes.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {combos.length > 0 ? (
              <optgroup label="Combos">
                {combos.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>
        {isRecipe ? (
          <label className="flex shrink-0 items-center gap-1.5 text-sm text-muted">
            <span>leva</span>
            <input
              value={units}
              disabled={!canWrite}
              inputMode="numeric"
              aria-label={`Marmitas por venda de ${product.name}`}
              onChange={(e) => setUnits(e.target.value)}
              onBlur={() => {
                if (units !== String(product.units)) void save(target, units);
              }}
              className="tabular h-11 w-16 card px-2 text-center text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <span>un</span>
          </label>
        ) : null}
      </div>

      {pending && suggestion && canWrite ? (
        <button
          type="button"
          onClick={() => {
            setTarget(suggestion.value);
            void save(suggestion.value, units);
          }}
          className="h-11 self-start rounded-lg border border-primary/30 bg-primary/5 px-3 text-sm font-medium text-primary"
        >
          Parece ser: {suggestion.label}. Usar
        </button>
      ) : null}

      <p role={state.kind === "error" ? "alert" : undefined} className="empty:hidden text-xs">
        {state.kind === "saving" ? <span className="inline-flex items-center gap-1 text-muted"><Spinner className="size-3" />Salvando…</span> : null}
        {state.kind === "saved" ? <span className="text-success">Salvo ✓</span> : null}
        {state.kind === "error" ? <span className="text-danger">{state.message}</span> : null}
      </p>
    </li>
  );
}
