"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Hint } from "@/components/hint";
import { PendingLabel } from "@/components/spinner";
import { daysSince, formatAge, formatBaseQty, formatNumber } from "@/lib/format";
import { addFinishedMovement, addIngredientMovement, saveStockCounts } from "./actions";

export type StockRowData = {
  id: string;
  name: string;
  kind: "insumo" | "embalagem";
  baseUnit: string;
  /** Unidade em que se digita (kg, g, l, ml, un). */
  unit: string;
  balance: number;
  known: boolean;
  lastCountAt: string | null;
};

export type FinishedRowData = { id: string; name: string; balance: number; known: boolean; lastCountAt: string | null };

const norm = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
const input = "tabular h-11 min-w-0 rounded-xl border border-border bg-background px-3 text-right text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const chip = (on: boolean) => `h-10 flex-1 rounded-lg px-2 text-sm font-semibold ${on ? "bg-tint text-primary" : "text-muted"}`;

function statusText(known: boolean, lastCountAt: string | null) {
  if (!known) return "nunca contado";
  return lastCountAt ? `contado ${formatAge(daysSince(lastCountAt))}` : "sem contagem (só movimentos)";
}

type Action = "count" | "purchase" | "waste";
const ACTION_LABEL: Record<Action, string> = { count: "Contei", purchase: "Comprei", waste: "Perdi" };

/** Linha de um insumo: saldo estimado e as três ações (contei, comprei, perdi). */
function IngredientRow({ row, canWrite, onDone }: { row: StockRowData; canWrite: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<Action>("count");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function save() {
    setBusy(true);
    const result = await addIngredientMovement({ ingredientId: row.id, kind: action, text, unit: row.unit });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setText("");
    setError(undefined);
    setOpen(false);
    onDone();
  }

  const negative = row.known && row.balance < 0;
  return (
    <li className="flex flex-col gap-2 py-3">
      <button type="button" onClick={() => canWrite && setOpen((v) => !v)} aria-expanded={open} className="flex min-h-11 w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block truncate font-medium">{row.name}</span>
          <span className="block text-xs text-muted">{statusText(row.known, row.lastCountAt)}</span>
        </span>
        <span className={`tabular shrink-0 text-right font-extrabold ${negative ? "text-warning" : ""}`}>
          {row.known ? (negative ? "contar de novo" : formatBaseQty(row.balance, row.baseUnit)) : "—"}
        </span>
      </button>
      {open ? (
        <div className="flex flex-col gap-2 rounded-xl bg-background p-3">
          <div className="flex gap-1 rounded-lg bg-border/60 p-1" role="tablist">
            {(Object.keys(ACTION_LABEL) as Action[]).map((a) => (
              <button key={a} type="button" role="tab" aria-selected={action === a} onClick={() => setAction(a)} className={chip(action === a)}>
                {ACTION_LABEL[a]}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">
            {action === "count" ? "Quanto tem agora na prateleira (substitui o saldo)." : action === "purchase" ? "Quanto entrou (soma ao saldo)." : "Quanto estragou ou sumiu (tira do saldo)."}
          </p>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} inputMode="decimal" placeholder="0" aria-label={`${ACTION_LABEL[action]} de ${row.name}`} className={input} />
            <span className="w-8 text-sm text-muted">{row.unit}</span>
            <button type="button" onClick={save} disabled={busy || text.trim() === ""} className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? <PendingLabel>Salvando…</PendingLabel> : "Salvar"}
            </button>
          </div>
          {error ? (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** Linha de uma marmita pronta (congelador): contei, produzi ou perdi. */
function FinishedRow({ row, canWrite, onDone }: { row: FinishedRowData; canWrite: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<"count" | "produced" | "waste">("count");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const label = { count: "Contei", produced: "Produzi", waste: "Perdi" } as const;

  async function save() {
    setBusy(true);
    const result = await addFinishedMovement({ recipeId: row.id, kind: action, text });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setText("");
    setError(undefined);
    setOpen(false);
    onDone();
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <button type="button" onClick={() => canWrite && setOpen((v) => !v)} aria-expanded={open} className="flex min-h-11 w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block truncate font-medium">{row.name}</span>
          <span className="block text-xs text-muted">{statusText(row.known, row.lastCountAt)}</span>
        </span>
        <span className="tabular shrink-0 text-right font-extrabold">{row.known ? `${formatNumber(Math.max(0, row.balance), 0)} un` : "—"}</span>
      </button>
      {open ? (
        <div className="flex flex-col gap-2 rounded-xl bg-background p-3">
          <div className="flex gap-1 rounded-lg bg-border/60 p-1" role="tablist">
            {(["count", "produced", "waste"] as const).map((a) => (
              <button key={a} type="button" role="tab" aria-selected={action === a} onClick={() => setAction(a)} className={chip(action === a)}>
                {label[a]}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">
            {action === "count" ? "Quantas marmitas prontas há agora (substitui o saldo)." : action === "produced" ? "Quantas saíram da produção (soma ao saldo)." : "Quantas estragaram ou foram descartadas."}
          </p>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} inputMode="numeric" placeholder="0" aria-label={`${label[action]} de ${row.name}`} className={input} />
            <span className="w-8 text-sm text-muted">un</span>
            <button type="button" onClick={save} disabled={busy || text.trim() === ""} className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? <PendingLabel>Salvando…</PendingLabel> : "Salvar"}
            </button>
          </div>
          {error ? (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** Contagem rápida: todos os insumos numa lista, só digita o que contou e salva tudo de uma vez. */
function QuickCount({ rows, onClose, onDone }: { rows: StockRowData[]; onClose: () => void; onDone: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const filled = Object.values(values).filter((v) => v.trim() !== "").length;

  async function save() {
    setBusy(true);
    const result = await saveStockCounts({ counts: rows.map((r) => ({ ingredientId: r.id, text: values[r.id] ?? "", unit: r.unit })) });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onDone();
    onClose();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Contagem rápida</h2>
        <button type="button" onClick={onClose} className="tap-area text-sm font-semibold text-primary underline">
          Cancelar
        </button>
      </div>
      <p className="text-xs text-muted">Digite só o que você contou. O que ficar em branco não muda.</p>
      <ul className="divide-y divide-border card px-4">
        {rows.map((r) => (
          <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_6rem_2rem] items-center gap-2 py-2">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{r.name}</span>
              <span className="block text-xs text-muted">{r.known ? `sistema: ${formatBaseQty(r.balance, r.baseUnit)}` : "nunca contado"}</span>
            </span>
            <input
              value={values[r.id] ?? ""}
              onChange={(e) => setValues((p) => ({ ...p, [r.id]: e.target.value }))}
              inputMode="decimal"
              placeholder="—"
              aria-label={`Contagem de ${r.name}`}
              className={`${input} w-full`}
            />
            <span className="text-xs text-muted">{r.unit}</span>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <button type="button" onClick={save} disabled={busy || filled === 0} className="sticky bottom-20 h-12 rounded-xl bg-primary font-semibold text-primary-foreground shadow-lg disabled:opacity-60">
        {busy ? <PendingLabel>Salvando…</PendingLabel> : filled === 0 ? "Digite o que contou" : `Salvar contagem (${filled})`}
      </button>
    </section>
  );
}

export function StockManager({ ingredients, finished, canWrite }: { ingredients: StockRowData[]; finished: FinishedRowData[]; canWrite: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState(false);
  const refresh = () => router.refresh();

  const q = norm(query);
  const match = (name: string) => q === "" || norm(name).includes(q);
  const shownIngredients = useMemo(() => ingredients.filter((i) => i.kind === "insumo" && match(i.name)), [ingredients, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownPacks = useMemo(() => ingredients.filter((i) => i.kind === "embalagem" && match(i.name)), [ingredients, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownFinished = finished.filter((f) => match(f.name));
  const neverCounted = ingredients.filter((i) => !i.known).length;

  if (quick) return <QuickCount rows={ingredients} onClose={() => setQuick(false)} onDone={refresh} />;

  return (
    <div className="flex flex-col gap-6">
      {canWrite ? (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => setQuick(true)} className="h-12 rounded-xl bg-primary font-semibold text-primary-foreground">
            Contagem rápida
          </button>
          {neverCounted > 0 ? <p className="text-center text-xs text-muted">{neverCounted} {neverCounted === 1 ? "item nunca foi contado" : "itens nunca foram contados"}. Quanto mais atualizado o estoque, mais certa a lista de compras.</p> : null}
        </div>
      ) : null}

      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar insumo, embalagem ou marmita…" aria-label="Buscar" className="h-12 card px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />

      {finished.length > 0 && shownFinished.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Marmitas prontas
            <Hint>As marmitas congeladas que já estão prontas. O sistema desconta o que o cardápio digital vendeu desde a última contagem.</Hint>
          </h2>
          <ul className="divide-y divide-border card px-4">
            {shownFinished.map((f) => (
              <FinishedRow key={f.id} row={f} canWrite={canWrite} onDone={refresh} />
            ))}
          </ul>
        </section>
      ) : null}

      {shownIngredients.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Insumos <span className="font-normal">({shownIngredients.length})</span>
          </h2>
          <ul className="divide-y divide-border card px-4">
            {shownIngredients.map((r) => (
              <IngredientRow key={r.id} row={r} canWrite={canWrite} onDone={refresh} />
            ))}
          </ul>
        </section>
      ) : null}

      {shownPacks.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Embalagens <span className="font-normal">({shownPacks.length})</span>
          </h2>
          <ul className="divide-y divide-border card px-4">
            {shownPacks.map((r) => (
              <IngredientRow key={r.id} row={r} canWrite={canWrite} onDone={refresh} />
            ))}
          </ul>
        </section>
      ) : null}

      {shownIngredients.length + shownPacks.length + shownFinished.length === 0 ? <p className="card p-4 text-sm text-muted">Nada encontrado.</p> : null}
    </div>
  );
}
