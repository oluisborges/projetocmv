"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Hint } from "@/components/hint";
import { PendingLabel } from "@/components/spinner";
import { formatNumber, parseDecimal } from "@/lib/format";
import { computeProduction, type ProductionInput, type SuggestionRow } from "@/lib/production-view";
import { registerProduction, updateProduction } from "../actions";
import { BuyChecklist, PrepareList, ProductionSummary } from "../production-sections";

const STEPS = [
  { key: 1, label: "O que fazer" },
  { key: 2, label: "Preparar" },
  { key: 3, label: "Comprar" },
  { key: 4, label: "Já fiz" },
] as const;

const input = "tabular h-11 w-20 rounded-xl border border-border bg-background px-3 text-right text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const noteClass = "text-xs leading-relaxed text-muted";

const toQty = (text: string | undefined): number => {
  const p = parseDecimal(text ?? "");
  return p === null ? 0 : Math.max(0, Math.floor(Number(p)));
};

function trendText(t: number | null): string | null {
  if (t === null) return null;
  const pct = Math.round(t * 100);
  if (Math.abs(pct) < 5) return "estável";
  return pct > 0 ? `subindo ${pct}%` : `caindo ${Math.abs(pct)}%`;
}

export function ProductionWizard({
  id,
  defaultName,
  initialName,
  plannedFor,
  done,
  rows,
  initial,
  boughtQty,
  base,
  canWrite,
  source,
  weeksUsed,
  plannedElsewhere,
  producedQty,
}: {
  id: string;
  defaultName: string;
  initialName: string;
  plannedFor: string;
  done: boolean;
  rows: SuggestionRow[];
  initial: Record<string, number>;
  /** O que já foi marcado como comprado nesta produção: insumo -> quantidade que entrou no estoque. */
  boughtQty: Record<string, number>;
  base: ProductionInput;
  canWrite: boolean;
  source: "menu" | "manual" | "none";
  weeksUsed: number;
  /** Quanto outras produções da mesma semana já têm planejado (só informação). */
  plannedElsewhere: number;
  producedQty: Record<string, number>;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(done ? 4 : 1);
  const [name, setName] = useState(initialName);
  const [date, setDate] = useState(plannedFor);
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initial).map(([k, n]) => [k, n > 0 ? String(n) : ""])));
  const [bought, setBought] = useState<Set<string>>(() => new Set(Object.keys(boughtQty)));
  const [produced, setProduced] = useState<Record<string, string>>({});
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const locked = done || !canWrite;

  const lines = useMemo(() => rows.map((r) => ({ recipeId: r.id, units: toQty(qty[r.id]) })), [rows, qty]);
  const total = lines.reduce((n, l) => n + l.units, 0);
  // Itens já comprados continuam na lista: o estoque já recebeu a compra e ela não pode "sumir" da lista.
  const calc = useMemo(() => computeProduction(lines, base, boughtQty), [lines, base, boughtQty]);
  const qtyOf = (rid: string) => calc.rows.toBuy.find((r) => r.id === rid)?.buyQty ?? 0;

  // Salva sozinho, um instante depois de a pessoa parar de digitar.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (locked) return;
    const t = setTimeout(async () => {
      setSave("saving");
      const result = await updateProduction({ id, name: name.trim() === defaultName ? "" : name, plannedFor: date, items: rows.map((r) => ({ recipeId: r.id, planned: toQty(qty[r.id]) })) });
      if (result.ok) {
        setSave("saved");
        setError(undefined);
      } else {
        setSave("error");
        setError(result.error);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [qty, name, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const withSales = rows.filter((r) => r.forecast > 0 || toQty(qty[r.id]) > 0);
  const others = rows.filter((r) => !withSales.includes(r));
  const useSuggestion = () => setQty(Object.fromEntries(rows.map((r) => [r.id, r.suggested > 0 ? String(r.suggested) : ""])));

  async function finish() {
    setBusy(true);
    setError(undefined);
    const result = await registerProduction({ planId: id, produced: rows.map((r) => ({ recipeId: r.id, qty: toQty(produced[r.id] ?? qty[r.id]) })).filter((p) => p.qty > 0) });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  const renderRow = (r: SuggestionRow) => {
    const planned = toQty(qty[r.id]);
    const diff = r.confidence === "none" ? null : planned - r.suggested;
    return (
      <li key={r.id} className="flex flex-col gap-1 py-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-medium leading-snug">
              {r.name}
              {r.topSeller ? <span className="ml-2 rounded-full bg-tint px-2 py-0.5 text-xs font-semibold text-primary">mais vendida</span> : null}
            </p>
            <p className={noteClass}>
              {r.confidence === "none"
                ? "sem vendas recentes"
                : `sugestão ${formatNumber(r.suggested, 0)} · vende ~${formatNumber(r.average, 0)} por semana${trendText(r.trendPct) ? `, ${trendText(r.trendPct)}` : ""}`}
              {r.finished !== null ? ` · prontas: ${formatNumber(r.finished, 0)}` : ""}
            </p>
          </div>
          <input value={qty[r.id] ?? ""} onChange={(e) => setQty((p) => ({ ...p, [r.id]: e.target.value }))} disabled={locked} inputMode="numeric" placeholder="0" aria-label={`Quantas ${r.name} produzir`} className={input} />
        </div>
        {r.confidence !== "none" ? (
          <p className={noteClass}>
            Últimas semanas: {r.weekly.map((n) => formatNumber(n, 0)).join(", ")}
            {r.confidence === "low" ? " · pouco histórico, confira" : ""}
            {diff !== null && diff !== 0 && !locked ? ` · ${diff > 0 ? `${diff} a mais` : `${Math.abs(diff)} a menos`} que a sugestão` : ""}
          </p>
        ) : null}
      </li>
    );
  };

  const saveChip = save === "saving" ? "Salvando…" : save === "saved" ? "Salvo ✓" : save === "error" ? "Não salvou" : "";

  return (
    <div className="flex flex-col gap-5">
      {/* nome e dia */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted">
          Nome da produção
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={locked} maxLength={80} className="h-11 card px-3 text-base text-foreground outline-none focus:border-primary disabled:opacity-60" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Dia
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} disabled={locked} className="h-11 card px-2 text-base text-foreground outline-none focus:border-primary disabled:opacity-60" />
        </label>
      </div>

      {/* passos */}
      <nav aria-label="Passos da produção" className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between text-xs text-muted">
          <span>
            Passo {step} de 4 · <strong className="text-foreground">{STEPS[step - 1].label}</strong>
          </span>
          <span aria-live="polite">{saveChip}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {STEPS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStep(s.key)}
              aria-current={step === s.key ? "step" : undefined}
              className={`flex h-11 flex-col items-center justify-center rounded-lg text-[11px] font-semibold leading-tight ${step === s.key ? "bg-primary text-primary-foreground" : s.key < step ? "bg-tint text-primary" : "bg-border/60 text-muted"}`}
            >
              <span className="text-sm">{s.key}</span>
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      {done ? (
        <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
          <strong>Produção feita.</strong> As marmitas entraram no estoque de prontas e os insumos saíram do estoque.
        </p>
      ) : null}

      {/* passo 1 */}
      {step === 1 ? (
        <section className="flex flex-col gap-3">
          <p className={noteClass}>
            {source === "menu"
              ? `Sugestão pelas vendas do cardápio digital nas últimas ${weeksUsed} semanas, a tendência de cada marmita e o que já está pronto no congelador.`
              : source === "manual"
                ? "Sugestão pela média mensal de vendas que você informou em Mês (dividida em semanas). Conecte o cardápio digital para uma sugestão por semana."
                : "Ainda não há vendas para sugerir. Digite as quantidades à mão ou conecte o cardápio digital."}
            <Hint>A sugestão é a média das últimas semanas (as mais recentes pesam mais), com um ajuste leve pela tendência, menos o que já está pronto. É só um ponto de partida: você decide.</Hint>
            {plannedElsewhere > 0 ? ` Já há ${formatNumber(plannedElsewhere, 0)} marmitas planejadas em outras produções desta semana; elas já saíram da sugestão.` : ""}
          </p>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Quantas de cada?</h2>
            {!locked && source !== "none" ? (
              <button type="button" onClick={useSuggestion} className="tap-area text-sm font-semibold text-primary underline">
                Usar a sugestão
              </button>
            ) : null}
          </div>
          {withSales.length > 0 ? <ul className="divide-y divide-border card px-4">{withSales.map(renderRow)}</ul> : null}
          {others.length > 0 ? (
            <details className="card px-4">
              <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold text-muted">Outras marmitas ({others.length})</summary>
              <ul className="divide-y divide-border pb-1">{others.map(renderRow)}</ul>
            </details>
          ) : null}
          {rows.length === 0 ? <p className="card p-4 text-sm text-muted">Nenhuma marmita com a ficha completa ainda. Termine as fichas em Cardápio para montar a produção.</p> : null}
        </section>
      ) : null}

      {/* passo 2 */}
      {step === 2 ? (
        <section className="flex flex-col gap-4">
          {total > 0 ? <ProductionSummary calc={calc} /> : <p className="card p-4 text-sm text-muted">Escolha as marmitas no passo 1 para ver o que preparar.</p>}
          {total > 0 ? <PrepareList calc={calc} receitas={base.receitas} /> : null}
        </section>
      ) : null}

      {/* passo 3 */}
      {step === 3 ? (
        <section className="flex flex-col gap-4">
          {total > 0 ? <ProductionSummary calc={calc} /> : <p className="card p-4 text-sm text-muted">Escolha as marmitas no passo 1 para ver o que comprar.</p>}
          {total > 0 ? (
            <BuyChecklist
              calc={calc}
              planId={id}
              bought={bought}
              qtyOf={qtyOf}
              canWrite={!locked}
              title={`Compras: ${name.trim() || defaultName}`}
              onBoughtChange={(rid, next) =>
                setBought((prev) => {
                  const copy = new Set(prev);
                  if (next) copy.add(rid);
                  else copy.delete(rid);
                  return copy;
                })
              }
            />
          ) : null}
        </section>
      ) : null}

      {/* passo 4 */}
      {step === 4 ? (
        <section className="flex flex-col gap-3">
          {done ? (
            <ul className="divide-y divide-border card px-4">
              {rows
                .filter((r) => (producedQty[r.id] ?? 0) > 0)
                .map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="min-w-0 truncate font-medium">{r.name}</span>
                    <span className="tabular shrink-0 font-extrabold">{formatNumber(producedQty[r.id] ?? 0, 0)} un</span>
                  </li>
                ))}
            </ul>
          ) : total === 0 ? (
            <p className="card p-4 text-sm text-muted">Escolha as marmitas no passo 1.</p>
          ) : (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Quanto saiu de verdade?</h2>
              <p className={noteClass}>Confira as quantidades. Ao tocar em &quot;Já fiz&quot;, as marmitas entram no estoque de prontas e os insumos (e o que as receitas gastaram) saem do estoque.</p>
              <ul className="divide-y divide-border card px-4">
                {rows
                  .filter((r) => toQty(qty[r.id]) > 0)
                  .map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0 truncate text-sm font-medium">{r.name}</span>
                      <input value={produced[r.id] ?? qty[r.id] ?? ""} onChange={(e) => setProduced((p) => ({ ...p, [r.id]: e.target.value }))} disabled={!canWrite} inputMode="numeric" aria-label={`Quantas ${r.name} saíram`} className={input} />
                    </li>
                  ))}
              </ul>
              {canWrite ? (
                <button type="button" onClick={finish} disabled={busy} className="h-12 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60">
                  {busy ? <PendingLabel>Dando baixa…</PendingLabel> : "Já fiz"}
                </button>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {/* navegação */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))} disabled={step === 1} className="h-12 rounded-xl border border-border bg-surface font-semibold disabled:opacity-40">
          Voltar
        </button>
        <button type="button" onClick={() => setStep((s) => (s < 4 ? ((s + 1) as 2 | 3 | 4) : s))} disabled={step === 4} className="h-12 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-40">
          {step === 1 && total > 0 ? `Próximo (${formatNumber(total, 0)} marmitas)` : "Próximo"}
        </button>
      </div>
    </div>
  );
}
