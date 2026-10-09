"use client";

import { useState } from "react";
import { Hint } from "@/components/hint";
import { MarginBadge } from "@/components/margin-badge";
import { formatBRL, formatPct, parseDecimal } from "@/lib/format";
import { analyzePrice, priceBreakdown, type PricingSettings } from "@/lib/pricing-view";
import { setRecipePrice } from "../actions";

type Channel = { id: string; name: string; fee_pct: number };

const priceFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BAR: Record<string, string> = {
  cost: "bg-foreground/70",
  tax: "bg-warning/60",
  fee: "bg-warning/60",
  fixed: "bg-muted/60",
  profit: "bg-success",
};

export function Simulator({
  recipeId,
  cost,
  currentPrice,
  settings,
  channels,
  canWrite,
}: {
  recipeId: string;
  cost: number;
  currentPrice: number | null;
  settings: PricingSettings;
  channels: Channel[];
  canWrite: boolean;
}) {
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const channel = channels.find((c) => c.id === channelId) ?? channels[0];
  const feePct = channel?.fee_pct ?? 0;

  const initial = currentPrice ?? analyzePrice({ cost, settings, feePct }).suggested ?? 0;
  const [text, setText] = useState(initial > 0 ? priceFmt.format(initial) : "");
  const [saved, setSaved] = useState(currentPrice);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });

  const parsed = parseDecimal(text);
  const price = parsed === null ? 0 : Number(parsed);
  const analysis = analyzePrice({ cost, settings, feePct, price });
  const parts = price > 0 ? priceBreakdown({ price, cost, settings, feePct }) : [];

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

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
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
            <MarginBadge status={analysis.at.status} pct={analysis.at.netPct} />
            <p className="tabular text-sm text-muted">
              Sobra <strong className="text-foreground">{formatBRL(analysis.at.net)}</strong> por marmita
            </p>
          </div>
        ) : null}

        {analysis.impossible ? (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            Impostos, taxas, despesas e lucro desejado somam 100% ou mais: não existe preço que feche a conta. Revise em Ajustes.
          </p>
        ) : analysis.suggested !== null ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted">
              Para ganhar {formatPct(settings.profitPct)} limpo: <strong className="tabular text-foreground">{formatBRL(analysis.suggested)}</strong>
            </span>
            <button type="button" onClick={() => setText(priceFmt.format(analysis.suggested!))} className="h-9 shrink-0 rounded-lg border border-primary px-3 font-semibold text-primary">
              Usar
            </button>
          </div>
        ) : null}

        {canWrite ? (
          <button type="button" onClick={save} disabled={!(price > 0) || state.kind === "saving"} className="h-12 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60">
            {state.kind === "saving" ? "Salvando…" : saved === price ? "Este é o preço atual" : "Definir como preço da marmita"}
          </button>
        ) : null}
        <p role={state.kind === "error" ? "alert" : undefined} className="min-h-4 text-center text-xs">
          {state.kind === "saved" ? <span className="text-success">Preço salvo ✓</span> : null}
          {state.kind === "error" ? <span className="text-danger">{state.message}</span> : null}
        </p>
      </section>

      {parts.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Para onde vai o dinheiro
            <Hint>De cada venda, quanto cobre o custo, quanto vai para impostos e taxas, quanto paga as despesas fixas e quanto sobra de lucro.</Hint>
          </h2>
          <ul className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
            {parts.map((p) => (
              <li key={p.key} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className={p.key === "profit" && p.value < 0 ? "font-semibold text-danger" : ""}>{p.key === "profit" && p.value < 0 ? "Prejuízo" : p.label}</span>
                  <span className="tabular shrink-0">
                    <strong>{formatBRL(p.value)}</strong> <span className="text-muted">· {formatPct(p.pct)}</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-background" aria-hidden>
                  <div className={`h-full rounded-full ${p.value < 0 ? "bg-danger" : BAR[p.key]}`} style={{ width: `${Math.min(100, Math.max(0, p.pct * 100))}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {channels.length > 1 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Em cada canal de venda</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-4">
            {channels.map((c) => {
              const a = analyzePrice({ cost, settings, feePct: c.fee_pct, price });
              return (
                <li key={c.id} className="flex flex-col gap-1.5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{c.name}</span>
                    <span className="tabular text-sm text-muted">
                      preço certo <strong className="text-foreground">{a.suggested !== null ? formatBRL(a.suggested) : "—"}</strong>
                    </span>
                  </div>
                  {a.at ? <MarginBadge status={a.at.status} pct={a.at.netPct} /> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
