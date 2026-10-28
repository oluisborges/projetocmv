"use client";

import { useState } from "react";
import { EstimateNotice } from "@/components/estimate-notice";
import { MarginBadge } from "@/components/margin-badge";
import { formatBRL, formatPct, parseDecimal } from "@/lib/format";
import { analyzePrice, priceChange, type PricingSettings } from "@/lib/pricing-view";
import { setRecipePrice } from "../../precos-actions";
import { PendingLabel } from "@/components/spinner";
import { MonthlyProfit, PriceStatement, type FixedBasis } from "./price-statement";

type Channel = { id: string; name: string; fee_pct: number };

const priceFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Simulator({
  recipeId,
  cost,
  currentPrice,
  settings,
  configured,
  estimateReason,
  channels,
  canWrite,
  basis,
  menuUnits,
}: {
  recipeId: string;
  cost: number;
  currentPrice: number | null;
  settings: PricingSettings;
  /** `false` = lucros são estimativa. */
  configured: boolean;
  estimateReason: "tax" | "expenses" | null;
  channels: Channel[];
  canWrite: boolean;
  /** De onde vem o percentual dos custos fixos (para o extrato explicar a conta). */
  basis: FixedBasis;
  /** Unidades dessa marmita vendidas no cardápio digital nos últimos 30 dias (ou `null`). */
  menuUnits: number | null;
}) {
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const channel = channels.find((c) => c.id === channelId) ?? channels[0];
  const feePct = channel?.fee_pct ?? 0;

  const initial = currentPrice ?? 0;
  const [text, setText] = useState(initial > 0 ? priceFmt.format(initial) : "");
  const [saved, setSaved] = useState(currentPrice);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });

  const parsed = parseDecimal(text);
  const price = parsed === null ? 0 : Number(parsed);
  const analysis = analyzePrice({ cost, settings, feePct, price });
  // Quanto muda o que sobra por marmita em relação ao preço que vale hoje.
  const change = saved && saved > 0 && price > 0 && Math.abs(price - saved) >= 0.005 ? priceChange({ cost, settings, feePct, from: saved, to: price }) : null;

  const nudge = (delta: number) => setText(priceFmt.format(Math.max(0, Number((price + delta).toFixed(2)))));

  async function save() {
    setState({ kind: "saving" });
    const result = await setRecipePrice(recipeId, text);
    if (result.ok) {
      setSaved(result.price);
      setState({ kind: "saved" });
      setTimeout(() => setState((s) => (s.kind === "saved" ? { kind: "idle" } : s)), 2500);
    } else {
      setState({ kind: "error", message: result.error });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {channels.length > 1 ? (
        <div>
          <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted">Vendendo por</p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {channels.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChannelId(c.id)}
                aria-pressed={c.id === channel?.id}
                className={`h-10 shrink-0 rounded-full border px-4 text-sm font-medium ${c.id === channel?.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`}
              >
                {c.name}
                {c.fee_pct > 0 ? ` · ${formatPct(c.fee_pct, 2)}` : ""}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <EstimateNotice reason={estimateReason} />

      <section className="flex flex-col gap-3 card p-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Preço de venda
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => nudge(-0.5)} className="size-12 shrink-0 rounded-xl border border-border text-xl font-bold" aria-label="Diminuir 50 centavos">
              −
            </button>
            <div className="flex h-14 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <span className="text-muted">R$</span>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                inputMode="decimal"
                aria-label="Preço de venda"
                className="tabular w-full bg-transparent text-2xl font-extrabold outline-none"
              />
            </div>
            <button type="button" onClick={() => nudge(0.5)} className="size-12 shrink-0 rounded-xl border border-border text-xl font-bold" aria-label="Aumentar 50 centavos">
              +
            </button>
          </div>
        </label>

        {analysis.at ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <MarginBadge status={analysis.at.status} pct={analysis.at.netPct} estimate={!configured} />
            <p className="tabular text-sm text-muted">
              {analysis.at.net >= 0 ? "Sobra" : "Falta"} <strong className="text-foreground">{formatBRL(Math.abs(analysis.at.net))}</strong> por unidade
            </p>
          </div>
        ) : null}
        {change ? (
          <p className="tabular rounded-lg bg-background px-3 py-2 text-sm">
            Hoje você cobra <strong>{formatBRL(saved ?? 0)}</strong> e sobra <strong>{formatBRL(change.before.net)}</strong>. Com este preço sobra <strong>{formatBRL(change.after.net)}</strong>
            {" "}
            <span className={change.netDelta >= 0 ? "font-semibold text-success" : "font-semibold text-danger"}>
              ({change.netDelta >= 0 ? "+" : "−"}
              {formatBRL(Math.abs(change.netDelta))} por marmita)
            </span>
            .
          </p>
        ) : null}

        {canWrite ? (
          <button type="button" onClick={save} disabled={!(price > 0) || state.kind === "saving"} className="h-12 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60">
            {state.kind === "saving" ? <PendingLabel>Salvando…</PendingLabel> : saved === price ? "Este é o preço atual" : "Definir como preço do produto"}
          </button>
        ) : null}
        <p role={state.kind === "error" ? "alert" : undefined} className="min-h-4 text-center text-xs">
          {state.kind === "saved" ? <span className="text-success">Preço salvo ✓</span> : null}
          {state.kind === "error" ? <span className="text-danger">{state.message}</span> : null}
        </p>
      </section>

      {price > 0 ? (
        <>
          <PriceStatement recipeId={recipeId} price={price} cost={cost} settings={settings} feePct={feePct} channelName={channel?.name ?? null} basis={basis} />
          <MonthlyProfit key={channel?.id} price={price} cost={cost} settings={settings} feePct={feePct} suggestedUnits={menuUnits && menuUnits > 0 ? Math.round(menuUnits) : 100} unitsFromMenu={Boolean(menuUnits && menuUnits > 0)} />
        </>
      ) : null}

      {channels.length > 1 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Em cada canal de venda</h2>
          <ul className="divide-y divide-border card px-4">
            {channels.map((c) => {
              const a = analyzePrice({ cost, settings, feePct: c.fee_pct, price });
              return (
                <li key={c.id} className="flex flex-col gap-1.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{c.name}</span>
                    {a.at ? <MarginBadge status={a.at.status} pct={a.at.netPct} estimate={!configured} /> : <span className="text-sm text-muted">defina o preço</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
