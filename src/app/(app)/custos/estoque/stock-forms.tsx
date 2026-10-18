"use client";

import { useRef, useState } from "react";
import { Hint } from "@/components/hint";
import { Spinner } from "@/components/spinner";
import { formatBRL, formatNumber } from "@/lib/format";
import type { StockRow } from "@/lib/stock-view";
import { saveFinishedStock, saveManualPurchase, saveStockCount } from "./actions";

type State = { kind: "idle" | "saving" | "saved" | "error"; message?: string };

const input = "tabular h-11 w-24 card px-3 text-right text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const show = (baseQty: number, perDisplay: number) => formatNumber(baseQty / perDisplay, 2);
const toText = (baseQty: number | null, perDisplay: number) => (baseQty === null ? "" : String(Math.round((baseQty / perDisplay) * 1000) / 1000).replace(".", ","));

/** Uma linha de insumo: o que entrou, o que as fichas gastaram, o que deveria sobrar e o que ela contou. */
export function StockRowCard({ month, row, canWrite }: { month: string; row: StockRow; canWrite: boolean }) {
  const [counted, setCounted] = useState<number | null>(row.counted);
  const [manual, setManual] = useState<number>(row.purchased - row.purchasedNfe);
  const [countText, setCountText] = useState(toText(row.counted, row.perDisplay));
  const [manualText, setManualText] = useState(manual > 0 ? toText(manual, row.perDisplay) : "");
  const [state, setState] = useState<State>({ kind: "idle" });
  const latest = useRef(0);

  const purchased = row.purchasedNfe + manual;
  const expected = row.opening + purchased - row.used;
  const missingQty = counted === null ? null : expected - counted;
  const missingValue = missingQty === null ? null : missingQty * row.unitCost;
  const u = row.displayUnit;

  async function run(kind: "count" | "manual", text: string) {
    const mine = ++latest.current;
    setState({ kind: "saving" });
    const res = kind === "count" ? await saveStockCount(month, row.id, text) : await saveManualPurchase(month, row.id, text);
    if (mine !== latest.current) return;
    if (!res.ok) return setState({ kind: "error", message: res.error });
    if (kind === "count") {
      setCounted(res.qtyBase);
      setCountText(toText(res.qtyBase, row.perDisplay));
    } else {
      setManual(res.qtyBase ?? 0);
      setManualText(res.qtyBase ? toText(res.qtyBase, row.perDisplay) : "");
    }
    setState({ kind: "saved" });
    setTimeout(() => setState((s) => (s.kind === "saved" ? { kind: "idle" } : s)), 2000);
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <p className="font-semibold leading-snug">{row.name}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div>
          <dt className="text-xs text-muted">Começou o mês com</dt>
          <dd className="tabular">{row.opening > 0 ? `${show(row.opening, row.perDisplay)} ${u}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Comprou</dt>
          <dd className="tabular">
            {purchased > 0 ? `${show(purchased, row.perDisplay)} ${u}` : "—"}
            {row.purchasedNfe > 0 ? <span className="text-xs text-muted"> ({show(row.purchasedNfe, row.perDisplay)} em notas)</span> : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">As fichas gastaram</dt>
          <dd className="tabular">{row.used > 0 ? `${show(row.used, row.perDisplay)} ${u}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Deveria sobrar</dt>
          <dd className={`tabular font-semibold ${expected < 0 ? "text-danger" : ""}`}>
            {show(expected, row.perDisplay)} {u}
          </dd>
        </div>
      </dl>

      {canWrite ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0">Contei</span>
            <input
              value={countText}
              onChange={(e) => setCountText(e.target.value)}
              onBlur={() => toText(counted, row.perDisplay) !== countText.trim() && run("count", countText)}
              inputMode="decimal"
              placeholder="—"
              aria-label={`Quanto sobrou de ${row.name}, em ${u}`}
              className={input}
            />
            <span className="text-muted">{u}</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0">
              Comprei sem nota
              <Hint>Compras deste insumo que não vieram de nota fiscal importada (feira, mercado). As das notas já somam sozinhas.</Hint>
            </span>
            <input
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              onBlur={() => toText(manual > 0 ? manual : null, row.perDisplay) !== manualText.trim() && run("manual", manualText)}
              inputMode="decimal"
              placeholder="0"
              aria-label={`Compras de ${row.name} sem nota, em ${u}`}
              className={input}
            />
            <span className="text-muted">{u}</span>
          </label>
        </div>
      ) : null}

      <p role={state.kind === "error" ? "alert" : undefined} className="empty:hidden text-xs">
        {state.kind === "saving" ? (
          <span className="inline-flex items-center gap-1 text-muted">
            <Spinner className="size-3" />
            Salvando…
          </span>
        ) : null}
        {state.kind === "saved" ? <span className="text-success">Salvo ✓</span> : null}
        {state.kind === "error" ? <span className="text-danger">{state.message}</span> : null}
      </p>

      {missingQty !== null && missingValue !== null ? (
        <p className={`rounded-lg px-3 py-2 text-sm ${Math.abs(missingValue) < 5 ? "bg-success/10" : missingValue > 0 ? "bg-danger/10" : "bg-warning/10"}`}>
          {Math.abs(missingValue) < 5 ? (
            <>Bateu com o esperado.</>
          ) : missingValue > 0 ? (
            <>
              Faltam <strong className="tabular">{show(missingQty, row.perDisplay)} {u}</strong> que as vendas não explicam: <strong className="tabular">{formatBRL(missingValue)}</strong> a preço de hoje.
            </>
          ) : (
            <>
              Sobrou <strong className="tabular">{show(-missingQty, row.perDisplay)} {u}</strong> a mais que o esperado ({formatBRL(-missingValue)}). Pode ter faltado lançar uma compra ou a ficha usa mais do que o real.
            </>
          )}
        </p>
      ) : null}
    </li>
  );
}

/** Marmitas prontas no freezer ao custo, no fim do mês: sem isso, o que foi produzido e ainda não vendeu parece perda. */
export function FinishedStockForm({ month, initial, canWrite }: { month: string; initial: number | null; canWrite: boolean }) {
  const [text, setText] = useState(initial === null ? "" : String(initial).replace(".", ","));
  const [saved, setSaved] = useState(initial);
  const [state, setState] = useState<State>({ kind: "idle" });

  async function commit() {
    const clean = text.trim();
    if ((clean === "" && saved === null) || (saved !== null && String(saved).replace(".", ",") === clean)) return;
    setState({ kind: "saving" });
    const res = await saveFinishedStock(month, text);
    if (!res.ok) return setState({ kind: "error", message: res.error });
    setSaved(res.value);
    setText(res.value === null ? "" : String(res.value).replace(".", ","));
    setState({ kind: "saved" });
    setTimeout(() => setState((s) => (s.kind === "saved" ? { kind: "idle" } : s)), 2000);
  }

  return (
    <section className="flex flex-col gap-2 card p-4">
      <h3 className="font-semibold">
        Marmitas prontas no freezer
        <Hint>
          Você produz em lote e vende aos poucos. Informe, no fim do mês, quanto vale (ao custo, não ao preço de venda) o que já está pronto e não foi vendido. Sem isso, a produção que sobrou no freezer parece desperdício.
        </Hint>
      </h3>
      <label className="flex items-center gap-2 text-sm">
        <span className="shrink-0">Valor ao custo</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          inputMode="decimal"
          disabled={!canWrite}
          placeholder="Ex.: 3.500"
          aria-label="Valor, ao custo, das marmitas prontas no freezer"
          className="tabular h-11 w-32 card px-3 text-right text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
        />
        <span className="text-muted">R$</span>
      </label>
      <p role={state.kind === "error" ? "alert" : undefined} className="empty:hidden text-xs">
        {state.kind === "saving" ? <span className="text-muted">Salvando…</span> : null}
        {state.kind === "saved" ? <span className="text-success">Salvo ✓</span> : null}
        {state.kind === "error" ? <span className="text-danger">{state.message}</span> : null}
      </p>
    </section>
  );
}
