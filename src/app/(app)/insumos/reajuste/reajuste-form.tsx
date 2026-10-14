"use client";

import { useActionState, useState } from "react";
import { Hint } from "@/components/hint";
import { parseDecimal } from "@/lib/format";
import { adjustPrices, type FormState } from "../actions";
import { PendingLabel } from "@/components/spinner";

export function AdjustForm({ categories, total }: { categories: { name: string; count: number }[]; total: number }) {
  const [state, action, pending] = useActionState(adjustPrices, {} as FormState);
  const [percent, setPercent] = useState("");
  const [category, setCategory] = useState("");

  const affected = category ? (categories.find((c) => c.name === category)?.count ?? 0) : total;
  const parsed = parseDecimal(percent, { allowNegative: true });

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (parsed === null) return; // o servidor mostra o erro de valor inválido
        const label = `${Number(parsed) > 0 ? "Aumentar" : "Reduzir"} ${Math.abs(Number(parsed)).toLocaleString("pt-BR")}%`;
        if (!window.confirm(`${label} no preço de ${affected} ${affected === 1 ? "insumo" : "insumos"}? Dá para ver o histórico depois.`)) {
          e.preventDefault();
        }
      }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        <span>
          Quanto mudou (%)
          <Hint>Use 8 para um aumento de 8%, ou -5 para uma queda de 5%. O preço de cada insumo é recalculado na hora.</Hint>
        </span>
        <input
          name="percent"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          inputMode="decimal"
          required
          autoComplete="off"
          placeholder="Ex.: 8"
          className="h-12 card px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Em quais insumos
        <select
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-12 card px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Todos ({total})</option>
          {categories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.count})
            </option>
          ))}
        </select>
      </label>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          {state.ok}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || affected === 0}
        className="h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? <PendingLabel>Reajustando…</PendingLabel> : "Reajustar preços"}
      </button>
    </form>
  );
}
