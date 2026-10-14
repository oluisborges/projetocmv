"use client";

import Link from "next/link";
import { useState } from "react";
import { EstimateNotice } from "@/components/estimate-notice";
import { MarginBadge } from "@/components/margin-badge";
import { formatBRL, parseDecimal } from "@/lib/format";
import { analyzePrice, type PricingSettings } from "@/lib/pricing-view";
import { setRecipePrice } from "./actions";
import { Spinner } from "@/components/spinner";

export type PricingRowData = {
  id: string;
  name: string;
  /** Custo por porção; `null` quando a ficha está incompleta. */
  cost: number | null;
  missingPrices: number;
  currentPrice: number | null;
};

type Channel = { id: string; name: string; fee_pct: number };

const priceFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Row({ row, settings, feePct, canWrite, configured }: { row: PricingRowData; settings: PricingSettings; feePct: number; canWrite: boolean; configured: boolean }) {
  const [saved, setSaved] = useState(row.currentPrice);
  const [text, setText] = useState(row.currentPrice ? priceFmt.format(row.currentPrice) : "");
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });

  // O que está digitado vale já para o semáforo; só grava ao sair do campo.
  const parsed = parseDecimal(text);
  const typed = parsed === null ? NaN : Number(parsed);
  const live = Number.isFinite(typed) && typed > 0 ? typed : saved;
  const analysis = row.cost === null ? null : analyzePrice({ cost: row.cost, settings, feePct, price: live });

  async function save(value: string) {
    setState({ kind: "saving" });
    const result = await setRecipePrice(row.id, value);
    if (result.ok) {
      setSaved(result.price);
      setText(priceFmt.format(result.price));
      setState({ kind: "saved" });
      setTimeout(() => setState((s) => (s.kind === "saved" ? { kind: "idle" } : s)), 2000);
    } else {
      setState({ kind: "error", message: result.error });
    }
  }

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="min-w-0">
        <Link href={`/precificacao/${row.id}`} className="block text-base font-semibold leading-snug">
          {row.name}
        </Link>
        {row.cost !== null ? (
          <p className="text-xs text-muted">
            custa {formatBRL(row.cost)} por porção
            {row.missingPrices > 0 ? <span className="text-warning"> · custo incompleto ({row.missingPrices} sem preço)</span> : null}
          </p>
        ) : (
          <p className="text-xs text-warning">Ficha incompleta: termine em Fichas para ver o preço.</p>
        )}
      </div>

      {analysis ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {analysis.at ? (
                <div className="flex flex-col items-start gap-1">
                  <MarginBadge status={analysis.at.status} pct={analysis.at.netPct} estimate={!configured} />
                  <span className="tabular text-xs text-muted">
                    {analysis.at.net >= 0 ? "sobra" : "falta"} {formatBRL(Math.abs(analysis.at.net))} por unidade
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted">Defina o preço que você cobra</span>
              )}
            </div>
            <label className="flex shrink-0 items-center gap-1.5">
              <span className="sr-only">Preço de venda de {row.name}</span>
              <span aria-hidden className="text-sm text-muted">
                R$
              </span>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={() => text.trim() !== "" && text.trim() !== (saved ? priceFmt.format(saved) : "") && void save(text)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                inputMode="decimal"
                disabled={!canWrite}
                placeholder="0,00"
                aria-invalid={state.kind === "error"}
                className="tabular h-11 w-28 card px-3 text-right text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
            </label>
          </div>

        </>
      ) : null}

      <p role={state.kind === "error" ? "alert" : undefined} className="empty:hidden text-right text-xs">
        {state.kind === "saving" ? <span className="inline-flex items-center gap-1 text-muted"><Spinner className="size-3" />Salvando…</span> : null}
        {state.kind === "saved" ? <span className="text-success">Salvo ✓</span> : null}
        {state.kind === "error" ? <span className="text-danger">{state.message}</span> : null}
      </p>
    </li>
  );
}

export function PricingList({
  rows,
  channels,
  settings,
  configured,
  estimateReason,
  canWrite,
}: {
  rows: PricingRowData[];
  channels: Channel[];
  settings: PricingSettings;
  /** `false` = lucros são estimativa. */
  configured: boolean;
  estimateReason: "tax" | "expenses" | null;
  canWrite: boolean;
}) {
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const channel = channels.find((c) => c.id === channelId) ?? channels[0];
  const feePct = channel?.fee_pct ?? 0;

  const below = rows.filter((r) => {
    if (r.cost === null || !r.currentPrice) return false;
    return analyzePrice({ cost: r.cost, settings, feePct, price: r.currentPrice }).at?.status === "below-target";
  }).length;

  const chip = (active: boolean) =>
    `h-10 shrink-0 rounded-full border px-4 text-sm font-medium ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`;

  return (
    <section className="flex flex-col gap-3">
      {channels.length > 1 ? (
        <div>
          <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted">Onde você vende</p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {channels.map((c) => (
              <button key={c.id} type="button" className={chip(c.id === channel?.id)} onClick={() => setChannelId(c.id)} aria-pressed={c.id === channel?.id}>
                {c.name}
                {c.fee_pct > 0 ? ` · ${(c.fee_pct * 100).toLocaleString("pt-BR")}%` : ""}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <EstimateNotice reason={estimateReason} />

      {configured && below > 0 ? (
        <p role="status" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {below} {below === 1 ? "produto está" : "produtos estão"} abaixo da sua meta de margem{channel ? ` vendendo por ${channel.name}` : ""}.
        </p>
      ) : null}

      <ul className="divide-y divide-border card px-4">
        {rows.map((row) => (
          <Row key={`${row.id}-${channelId}`} row={row} settings={settings} feePct={feePct} canWrite={canWrite} configured={configured} />
        ))}
      </ul>
    </section>
  );
}
