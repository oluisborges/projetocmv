"use client";

import { useRef, useState } from "react";
import { ActionForm, TextField } from "@/components/forms";
import { Hint } from "@/components/hint";
import { formatBRL } from "@/lib/format";
import { savePeriod, setComboSoldQty, setSoldQty } from "./actions";
import { Spinner } from "@/components/spinner";

const money = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PeriodForm({ month, revenue, purchases, outside = false }: { month: string; revenue: number; purchases: number; /** Cardápio conectado: o faturamento digitado é só o que vendeu por fora dele. */ outside?: boolean }) {
  return (
    <ActionForm action={savePeriod} submitLabel="Salvar o mês" key={month}>
      <input type="hidden" name="month" value={month} />
      <TextField
        label={outside ? "Quanto vendeu por fora do cardápio (R$)" : "Quanto você faturou no mês (R$)"}
        name="revenue"
        inputMode="decimal"
        required={false}
        defaultValue={revenue > 0 ? money.format(revenue) : ""}
        placeholder="Ex.: 60.000"
        hint={<Hint>{outside ? "Só o que entrou fora do cardápio digital (WhatsApp, balcão, feira…). O que vendeu pelo cardápio o app já puxa sozinho." : "Tudo que entrou com as vendas dos produtos no mês."}</Hint>}
      />
      <TextField
        label="Quanto você comprou de insumos (R$)"
        name="purchases"
        inputMode="decimal"
        required={false}
        defaultValue={purchases > 0 ? money.format(purchases) : ""}
        placeholder="Ex.: 18.000"
        hint={<Hint>A soma das notas de compra de comida e embalagem do mês, tudo que você pagou aos fornecedores.</Hint>}
      />
    </ActionForm>
  );
}

export function SalesRow({
  month,
  recipe,
  initialQty,
  canWrite,
  combo = false,
}: {
  month: string;
  recipe: { id: string; name: string; cost: number | null };
  initialQty: number;
  canWrite: boolean;
  /** `true`: a linha é de um combo (usa a venda de combos). */
  combo?: boolean;
}) {
  const [saved, setSaved] = useState(initialQty);
  const [text, setText] = useState(initialQty > 0 ? String(initialQty) : "");
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });
  const latest = useRef(0); // só a última resposta vale: duas edições seguidas não deixam o valor velho sobrescrever o novo

  async function commit() {
    const current = text.trim() === "" ? 0 : Number(text.replace(",", "."));
    if (current === saved) return;
    const mine = ++latest.current;
    setState({ kind: "saving" });
    const result = combo ? await setComboSoldQty(month, recipe.id, text) : await setSoldQty(month, recipe.id, text);
    if (mine !== latest.current) return;
    if (result.ok) {
      setSaved(result.qty);
      setText(result.qty > 0 ? String(result.qty) : "");
      setState({ kind: "saved" });
      setTimeout(() => setState((s) => (s.kind === "saved" ? { kind: "idle" } : s)), 2000);
    } else {
      setState({ kind: "error", message: result.error });
    }
  }

  return (
    <li className="flex flex-col gap-1 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium leading-snug">{recipe.name}</p>
          <p className="text-xs text-muted">
            {recipe.cost === null ? (
              <span className="text-warning">ficha incompleta: o custo não entra na conta</span>
            ) : saved > 0 ? (
              <>
                custou <strong className="tabular text-foreground">{formatBRL(recipe.cost * saved)}</strong> ({formatBRL(recipe.cost)} cada)
              </>
            ) : (
              <>custa {formatBRL(recipe.cost)} cada</>
            )}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-1.5">
          <span className="sr-only">{combo ? "Combos vendidos" : "Unidades vendidas"} de {recipe.name}</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const next = e.currentTarget.closest("li")?.nextElementSibling?.querySelector("input");
              e.currentTarget.blur();
              next?.focus();
            }}
            inputMode="numeric"
            enterKeyHint="next"
            disabled={!canWrite}
            placeholder="0"
            aria-invalid={state.kind === "error"}
            className="tabular h-11 w-24 card px-3 text-right text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
          <span className="text-sm text-muted">{combo ? "combos" : "un"}</span>
        </label>
      </div>
      <p role={state.kind === "error" ? "alert" : undefined} className="empty:hidden text-right text-xs">
        {state.kind === "saving" ? <span className="inline-flex items-center gap-1 text-muted"><Spinner className="size-3" />Salvando…</span> : null}
        {state.kind === "saved" ? <span className="text-success">Salvo ✓</span> : null}
        {state.kind === "error" ? <span className="text-danger">{state.message}</span> : null}
      </p>
    </li>
  );
}
