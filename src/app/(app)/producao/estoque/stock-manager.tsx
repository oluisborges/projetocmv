"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Hint } from "@/components/hint";
import { PendingLabel } from "@/components/spinner";
import { daysSince, formatAge, formatBaseQty, formatNumber } from "@/lib/format";
import { addFinishedMovement, addIngredientMovement, saveStockCounts, saveStockMinimum } from "./actions";

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
  /** Estoque mínimo (unidade-base); `null` = sem mínimo. */
  minimum: number | null;
};

export type FinishedRowData = { id: string; name: string; balance: number; known: boolean; lastCountAt: string | null; /** O lote mais antigo que ainda tem marmitas e quando vence. */ expiry: { code: string | null; expiresOn: string; daysLeft: number } | null };
export type ExpiringData = { name: string; code: string | null; remaining: number; expiresOn: string; daysLeft: number };

const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const expiryText = (daysLeft: number, expiresOn: string) => (daysLeft < 0 ? `venceu em ${dayMonth(expiresOn)}` : daysLeft === 0 ? "vence hoje" : `vence em ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} (${dayMonth(expiresOn)})`);

const norm = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
const input = "tabular h-11 min-w-0 rounded-xl border border-border bg-background px-3 text-right text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const chip = (on: boolean) => `h-10 flex-1 rounded-lg px-2 text-sm font-semibold ${on ? "bg-tint text-primary" : "text-muted"}`;

function statusText(known: boolean, lastCountAt: string | null) {
  if (!known) return "nunca contado";
  return lastCountAt ? `contado ${formatAge(daysSince(lastCountAt))}` : "nunca contado · estimado pelas compras e usos";
}

/** Por que se perdeu: vira a observação do movimento e aparece em Movimentos. */
const WASTE_REASONS = ["Venceu", "Quebra ou caiu", "Erro de preparo", "Outro"] as const;
const reasonSelect = "h-11 w-full rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-primary";

type Action = "count" | "purchase" | "waste" | "min";
const ACTION_LABEL: Record<Action, string> = { count: "Contei", purchase: "Comprei", waste: "Perdi", min: "Mínimo" };

/** Linha de um insumo: saldo estimado e as três ações (contei, comprei, perdi). */
function IngredientRow({ row, canWrite, onDone }: { row: StockRowData; canWrite: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<Action>("count");
  const [reason, setReason] = useState<string>(WASTE_REASONS[0]);
  const [paid, setPaid] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function save() {
    setBusy(true);
    if (action === "min") {
      const r = await saveStockMinimum({ ingredientId: row.id, text, unit: row.unit });
      setBusy(false);
      if (!r.ok) return setError(r.error);
      setText("");
      setError(undefined);
      setOpen(false);
      onDone();
      return;
    }
    const result = await addIngredientMovement({ ingredientId: row.id, kind: action, text, unit: row.unit, ...(action === "waste" ? { note: `Motivo: ${reason}` } : {}), ...(action === "purchase" && paid.trim() !== "" ? { paid } : {}) });
    setPaid("");
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setText("");
    setError(undefined);
    setOpen(false);
    onDone();
  }

  const negative = row.known && row.balance < 0;
  const below = row.minimum !== null && row.known && row.balance < row.minimum;
  return (
    <li className="flex flex-col gap-2 py-3">
      <button type="button" onClick={() => canWrite && setOpen((v) => !v)} aria-expanded={open} className="flex min-h-11 w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block truncate font-medium">{row.name}</span>
          <span className="block text-xs text-muted">
            {statusText(row.known, row.lastCountAt)}
            {row.minimum !== null ? ` · mínimo ${formatBaseQty(row.minimum, row.baseUnit)}` : ""}
            {below ? <strong className="ml-1 text-warning">abaixo do mínimo</strong> : null}
          </span>
        </span>
        <span className={`tabular shrink-0 text-right font-extrabold ${negative ? "text-warning" : ""}`}>
          {row.known ? (negative ? (row.lastCountAt ? "contar de novo" : "contar") : formatBaseQty(row.balance, row.baseUnit)) : "—"}
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
            {action === "count"
              ? "Quanto tem agora na prateleira (substitui o saldo)."
              : action === "purchase"
                ? "Quanto entrou (soma ao saldo)."
                : action === "min"
                  ? "Quanto você quer ter sempre em estoque. Abaixo disso, o insumo entra na lista de compras (deixe vazio para tirar)."
                  : "Quanto estragou ou sumiu (tira do saldo)."}
          </p>
          {action === "waste" ? (
            <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Motivo da perda" className={reasonSelect}>
              {WASTE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          ) : null}
          {action === "purchase" ? (
            <label className="flex items-center gap-2 text-xs text-muted">
              Pagou R$ (opcional)
              <input value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" placeholder="0,00" aria-label={`Quanto pagou em ${row.name}`} className={`${input} w-28`} />
            </label>
          ) : null}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} inputMode="decimal" placeholder={action === "min" ? "sem mínimo" : "0"} aria-label={`${ACTION_LABEL[action]} de ${row.name}`} className={input} />
            <span className="w-8 text-sm text-muted">{row.unit}</span>
            <button type="button" onClick={save} disabled={busy || (text.trim() === "" && action !== "min")} className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
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
  const [reason, setReason] = useState<string>(WASTE_REASONS[0]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const label = { count: "Contei", produced: "Produzi", waste: "Perdi" } as const;

  async function save() {
    setBusy(true);
    const result = await addFinishedMovement({ recipeId: row.id, kind: action, text, ...(action === "waste" ? { note: `Motivo: ${reason}` } : {}) });
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
          <span className="block text-xs text-muted">
            {statusText(row.known, row.lastCountAt)}
            {row.expiry ? <span className={row.expiry.daysLeft <= 15 ? "ml-1 font-semibold text-warning" : "ml-1"}>{` · ${row.expiry.code ? `lote ${row.expiry.code}, ` : ""}${expiryText(row.expiry.daysLeft, row.expiry.expiresOn)}`}</span> : null}
          </span>
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
          {action === "waste" ? (
            <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Motivo da perda" className={reasonSelect}>
              {WASTE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          ) : null}
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
function QuickCount({ rows: all, focusIds, onClose, onDone }: { rows: StockRowData[]; focusIds: string[]; onClose: () => void; onDone: () => void }) {
  // O que a produção em montagem vai usar vem primeiro; o resto segue em ordem alfabética.
  const focus = new Set(focusIds);
  const rows = [...all].sort((a, b) => Number(focus.has(b.id)) - Number(focus.has(a.id)));
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
      <p className="text-xs text-muted">Digite só o que você contou. O que ficar em branco não muda.{focus.size > 0 ? " Os itens da produção em montagem estão no topo." : ""}</p>
      <div className="flex flex-col gap-1" aria-hidden>
        <div className="h-2 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(filled / Math.max(1, rows.length)) * 100}%` }} />
        </div>
        <p className="tabular text-xs text-muted">{filled} de {rows.length} preenchidos</p>
      </div>
      <ul className="divide-y divide-border card px-4">
        {rows.map((r) => (
          <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_6rem_2rem] items-center gap-2 py-2">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{r.name}</span>
              <span className="block text-xs text-muted">{r.known ? (r.balance < 0 ? "conte para acertar o saldo" : `sistema: ${formatBaseQty(r.balance, r.baseUnit)}`) : "nunca contado"}</span>
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

export function StockManager({ ingredients, finished, canWrite, expiring, focusIds, focusLabel }: { ingredients: StockRowData[]; finished: FinishedRowData[]; canWrite: boolean; expiring: ExpiringData[]; focusIds: string[]; focusLabel: string | null }) {
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
  const counted = ingredients.length - neverCounted;
  // Com produção em montagem, o que ela usa vem primeiro e o resto fica recolhido (a busca abre tudo).
  const focusSet = new Set(focusIds);
  const focusRows = ingredients.filter((i) => focusSet.has(i.id));
  const useFocus = focusRows.length > 0 && q === "";
  const restIngredients = useFocus ? shownIngredients.filter((i) => !focusSet.has(i.id)) : shownIngredients;
  const restPacks = useFocus ? shownPacks.filter((i) => !focusSet.has(i.id)) : shownPacks;

  if (quick) return <QuickCount rows={ingredients} focusIds={focusIds} onClose={() => setQuick(false)} onDone={refresh} />;

  return (
    <div className="flex flex-col gap-6">
      {canWrite ? (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => setQuick(true)} className="h-12 rounded-xl bg-primary font-semibold text-primary-foreground">
            Contagem rápida
          </button>
          <p className="text-center text-xs text-muted">
            Contados: <strong className="text-foreground">{counted} de {ingredients.length}</strong>. Quanto mais atualizado o estoque, mais certa a lista de compras.
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-border" aria-hidden>
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(counted / Math.max(1, ingredients.length)) * 100}%` }} />
          </div>
        </div>
      ) : null}

      {expiring.length > 0 ? (
        <section aria-label="Perto de vencer" className="flex flex-col gap-2 rounded-2xl border-2 border-warning/40 bg-warning/10 p-4">
          <h2 className="text-sm font-bold">
            Perto de vencer
            <Hint>Lotes de marmitas prontas que vencem em até 15 dias (ou já venceram). Dá para vender ou usar primeiro; o sistema considera que o mais antigo sai antes.</Hint>
          </h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            {expiring.map((e) => (
              <li key={`${e.name}-${e.code}-${e.expiresOn}`} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  <strong>{formatNumber(e.remaining, 0)}</strong> {e.name}
                  {e.code ? <span className="text-muted"> · lote {e.code}</span> : null}
                </span>
                <span className="shrink-0 text-xs font-semibold text-warning">{expiryText(e.daysLeft, e.expiresOn)}</span>
              </li>
            ))}
          </ul>
        </section>
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

      {useFocus ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Confira estes {focusRows.length} itens
            <Hint>São os insumos que {focusLabel ?? "a produção em montagem"} vai usar. Se o estoque deles estiver certo, a lista de compras também fica certa.</Hint>
          </h2>
          {focusLabel ? <p className="text-xs text-muted">Para {focusLabel}.</p> : null}
          <ul className="divide-y divide-border card px-4">
            {focusRows.map((r) => (
              <IngredientRow key={r.id} row={r} canWrite={canWrite} onDone={refresh} />
            ))}
          </ul>
        </section>
      ) : null}

      {useFocus ? (
        <details className="card px-4">
          <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold text-muted">
            Todos os outros itens ({restIngredients.length + restPacks.length})
          </summary>
          <div className="flex flex-col gap-4 pb-3">
            {restIngredients.length > 0 ? (
              <div>
                <h3 className="py-1 text-xs font-semibold uppercase tracking-wider text-muted">Insumos</h3>
                <ul className="divide-y divide-border">
                  {restIngredients.map((r) => (
                    <IngredientRow key={r.id} row={r} canWrite={canWrite} onDone={refresh} />
                  ))}
                </ul>
              </div>
            ) : null}
            {restPacks.length > 0 ? (
              <div>
                <h3 className="py-1 text-xs font-semibold uppercase tracking-wider text-muted">Embalagens</h3>
                <ul className="divide-y divide-border">
                  {restPacks.map((r) => (
                    <IngredientRow key={r.id} row={r} canWrite={canWrite} onDone={refresh} />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      ) : (
        <>
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
        </>
      )}

      {shownIngredients.length + shownPacks.length + shownFinished.length === 0 ? <p className="card p-4 text-sm text-muted">Nada encontrado.</p> : null}
    </div>
  );
}
