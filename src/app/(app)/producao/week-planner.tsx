"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Hint } from "@/components/hint";
import { PendingLabel } from "@/components/spinner";
import { formatNumber, parseDecimal } from "@/lib/format";
import { registerProduction, reopenPlan, savePlan } from "./actions";
import { ProductionResult, type ResultBase } from "./production-result";

export type PlannerRow = {
  id: string;
  name: string;
  /** Vendas das últimas semanas (da mais antiga para a mais recente). */
  weekly: number[];
  average: number;
  trendPct: number | null;
  forecast: number;
  suggested: number;
  finished: number | null;
  confidence: "none" | "low" | "ok";
  topSeller: boolean;
};

export type PlanStatus = "none" | "draft" | "confirmed" | "produced";

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

export function WeekPlanner({
  weekStart,
  weekLabelText,
  status,
  planId,
  rows,
  initial,
  base,
  canWrite,
  source,
  weeksUsed,
}: {
  weekStart: string;
  weekLabelText: string;
  status: PlanStatus;
  planId: string | null;
  rows: PlannerRow[];
  /** Quantidade planejada por marmita (do plano salvo ou da sugestão). */
  initial: Record<string, number>;
  base: ResultBase;
  canWrite: boolean;
  source: "menu" | "manual" | "none";
  weeksUsed: number;
}) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initial).map(([id, n]) => [id, n > 0 ? String(n) : ""])));
  const [busy, setBusy] = useState<"save" | "confirm" | "reopen" | "produce" | null>(null);
  const [error, setError] = useState<string>();
  const [producing, setProducing] = useState(false);
  const [produced, setProduced] = useState<Record<string, string>>({});

  const locked = status === "confirmed" || status === "produced" || !canWrite;
  const lines = useMemo(() => rows.map((r) => ({ recipeId: r.id, units: toQty(qty[r.id]) })), [rows, qty]);
  const total = lines.reduce((n, l) => n + l.units, 0);

  const withSales = rows.filter((r) => r.forecast > 0 || toQty(qty[r.id]) > 0);
  const others = rows.filter((r) => !withSales.includes(r));

  const payload = () => rows.map((r) => ({ recipeId: r.id, planned: toQty(qty[r.id]), suggested: r.confidence === "none" ? null : r.suggested }));

  async function save(confirm: boolean) {
    setBusy(confirm ? "confirm" : "save");
    setError(undefined);
    const result = await savePlan({ weekStart, items: payload(), confirm });
    setBusy(null);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  async function reopen() {
    if (!planId) return;
    setBusy("reopen");
    const result = await reopenPlan(planId);
    setBusy(null);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  async function produce() {
    if (!planId) return;
    setBusy("produce");
    setError(undefined);
    const result = await registerProduction({ planId, produced: rows.map((r) => ({ recipeId: r.id, qty: toQty(produced[r.id] ?? qty[r.id]) })).filter((p) => toQty(qty[p.recipeId]) > 0 || p.qty > 0) });
    setBusy(null);
    if (!result.ok) return setError(result.error);
    setProducing(false);
    router.refresh();
  }

  const useSuggestion = () => setQty(Object.fromEntries(rows.map((r) => [r.id, r.suggested > 0 ? String(r.suggested) : ""])));

  const renderRow = (r: PlannerRow) => {
    const planned = toQty(qty[r.id]);
    const diff = r.confidence === "none" ? null : planned - r.suggested;
    return (
      <li key={r.id} className="flex flex-col gap-1.5 py-3">
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
              {r.finished !== null ? ` · prontas: ${formatNumber(Math.max(0, r.finished), 0)}` : ""}
            </p>
          </div>
          <input
            value={qty[r.id] ?? ""}
            onChange={(e) => setQty((p) => ({ ...p, [r.id]: e.target.value }))}
            disabled={locked}
            inputMode="numeric"
            placeholder="0"
            aria-label={`Quantas ${r.name} produzir`}
            className={input}
          />
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

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl bg-background px-4 py-3 text-sm">
        {status === "produced" ? (
          <>
            <strong>Produção registrada.</strong> As marmitas entraram no estoque de prontas e os insumos saíram do estoque.
          </>
        ) : status === "confirmed" ? (
          <>
            <strong>Plano confirmado</strong> para {weekLabelText}. A lista de compras abaixo está valendo.
          </>
        ) : status === "draft" ? (
          <>
            <strong>Rascunho</strong> salvo para {weekLabelText}. Ajuste e confirme quando estiver pronto.
          </>
        ) : (
          <>
            Sugestão do sistema para {weekLabelText}. Ajuste à vontade e confirme.
          </>
        )}
      </p>

      <p className={noteClass}>
        {source === "menu"
          ? `Baseada nas vendas do cardápio digital nas últimas ${weeksUsed} semanas, na tendência de cada marmita e no que já está pronto no congelador.`
          : source === "manual"
            ? "Estimada pela média mensal de vendas que você informou em Mês (dividida em semanas). Conecte o cardápio digital para uma sugestão por semana."
            : "Ainda não há vendas para sugerir. Digite as quantidades à mão ou conecte o cardápio digital."}
        <Hint>
          A sugestão é a média das últimas semanas (as mais recentes pesam mais), com um ajuste leve pela tendência, menos as marmitas que já estão prontas. É só um ponto de partida: você decide.
        </Hint>
      </p>

      {withSales.length > 0 ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Marmitas da semana</h2>
            {!locked && source !== "none" ? (
              <button type="button" onClick={useSuggestion} className="tap-area text-sm font-semibold text-primary underline">
                Usar a sugestão
              </button>
            ) : null}
          </div>
          <ul className="divide-y divide-border card px-4">{withSales.map(renderRow)}</ul>
        </section>
      ) : null}

      {others.length > 0 ? (
        <details className="card px-4">
          <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold text-muted">Outras marmitas ({others.length})</summary>
          <ul className="divide-y divide-border pb-1">{others.map(renderRow)}</ul>
        </details>
      ) : null}

      {rows.length === 0 ? <p className="card p-4 text-sm text-muted">Nenhuma marmita com a ficha completa ainda. Termine as fichas em Marmitas para planejar a produção.</p> : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {canWrite && status !== "produced" ? (
        <div className="flex flex-col gap-2">
          {status === "confirmed" ? (
            <>
              <button type="button" onClick={() => setProducing(true)} className="h-12 rounded-xl bg-primary font-semibold text-primary-foreground">
                Registrar produção
              </button>
              <button type="button" onClick={reopen} disabled={busy !== null} className="h-12 rounded-xl border border-border bg-surface font-semibold disabled:opacity-60">
                {busy === "reopen" ? <PendingLabel>Reabrindo…</PendingLabel> : "Reabrir para ajustar"}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => save(true)} disabled={busy !== null || total === 0} className="h-12 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60">
                {busy === "confirm" ? <PendingLabel>Confirmando…</PendingLabel> : total === 0 ? "Coloque as quantidades para confirmar" : `Confirmar plano (${formatNumber(total, 0)} marmitas)`}
              </button>
              <button type="button" onClick={() => save(false)} disabled={busy !== null} className="h-12 rounded-xl border border-border bg-surface font-semibold disabled:opacity-60">
                {busy === "save" ? <PendingLabel>Salvando…</PendingLabel> : "Salvar rascunho"}
              </button>
            </>
          )}
        </div>
      ) : null}

      {producing ? (
        <section className="flex flex-col gap-3 card p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Quanto saiu de verdade?</h2>
          <p className={noteClass}>Confira as quantidades. Ao registrar, as marmitas entram no estoque de prontas e os insumos (e o que as receitas gastaram) saem do estoque.</p>
          <ul className="divide-y divide-border">
            {rows
              .filter((r) => toQty(qty[r.id]) > 0)
              .map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 truncate text-sm font-medium">{r.name}</span>
                  <input
                    value={produced[r.id] ?? qty[r.id] ?? ""}
                    onChange={(e) => setProduced((p) => ({ ...p, [r.id]: e.target.value }))}
                    inputMode="numeric"
                    aria-label={`Quantas ${r.name} saíram`}
                    className={input}
                  />
                </li>
              ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setProducing(false)} className="h-12 rounded-xl border border-border font-semibold">
              Cancelar
            </button>
            <button type="button" onClick={produce} disabled={busy !== null} className="h-12 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60">
              {busy === "produce" ? <PendingLabel>Registrando…</PendingLabel> : "Registrar"}
            </button>
          </div>
        </section>
      ) : null}

      {status !== "produced" ? <ProductionResult lines={lines} base={base} title={`Compras da semana ${weekLabelText}`} /> : null}
    </div>
  );
}
