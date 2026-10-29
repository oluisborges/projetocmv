"use client";

import Link from "next/link";
import { useState } from "react";
import { Hint } from "@/components/hint";
import { formatBRL, formatNumber, formatPct, parseDecimal } from "@/lib/format";
import { analyzePrice, monthlyResult, priceBreakdown, type PricingSettings } from "@/lib/pricing-view";

/** De onde vem o percentual dos custos fixos (para explicar a conta, não só mostrar o número). */
export type FixedBasis = {
  /** `true` = calculado dos custos cadastrados ÷ faturamento; `false` = percentual informado. */
  auto: boolean;
  fixedTotal: number;
  monthlyRevenue: number | null;
  revenueSource: "history" | "manual" | null;
  revenueMonths: number;
};

type Row = { key: string; sign: "" | "−" | "="; label: string; value: number; pct: number; note?: React.ReactNode; strong?: boolean; tone?: "good" | "bad" };

const BAR: Record<string, string> = { cost: "bg-foreground/70", tax: "bg-warning/60", fee: "bg-warning/60", other: "bg-warning/60", fixed: "bg-muted/60", profit: "bg-success" };
const noteClass = "text-xs leading-relaxed text-muted";
const link = "tap-area font-semibold text-primary underline";

/**
 * "Como chegamos nesse número": o preço de cima para baixo, cada linha com o valor em R$, a porcentagem do preço
 * e de onde vem a conta (com o link de onde alterar).
 */
export function PriceStatement({
  recipeId,
  price,
  cost,
  settings,
  feePct,
  channelName,
  basis,
}: {
  recipeId: string;
  price: number;
  cost: number;
  settings: PricingSettings;
  feePct: number;
  channelName: string | null;
  basis: FixedBasis;
}) {
  const parts = priceBreakdown({ price, cost, settings, feePct });
  const at = analyzePrice({ cost, settings, feePct, price }).at;
  if (!at || parts.length === 0) return null;
  const by = Object.fromEntries(parts.map((p) => [p.key, p]));
  const safety = settings.safetyMarginPct ?? 0;

  const fixedNote = basis.auto ? (
    <p className={noteClass}>
      {formatBRL(basis.fixedTotal)} de custos fixos por mês (com salários) ÷ {formatBRL(basis.monthlyRevenue ?? 0)} de faturamento por mês = {formatPct(settings.fixedExpensePct)}.{" "}
      {basis.revenueSource === "history" ? `Faturamento: média dos últimos ${basis.revenueMonths} ${basis.revenueMonths === 1 ? "mês" : "meses"} de vendas. ` : "Faturamento que você informou. "}
      <Link href="/financeiro" className={link}>
        Ver custos fixos
      </Link>
    </p>
  ) : (
    <p className={noteClass}>
      Percentual que você informou. Cadastre os custos fixos e o faturamento para o sistema calcular sozinho.{" "}
      <Link href="/financeiro" className={link}>
        Informar em Custos
      </Link>
    </p>
  );

  const rows: Row[] = [
    { key: "price", sign: "", label: "Você vende por", value: price, pct: 1, strong: true },
    {
      key: "cost",
      sign: "−",
      label: "Custo do produto",
      value: by.cost.value,
      pct: by.cost.pct,
      note: (
        <p className={noteClass}>
          Ingredientes, receitas e embalagem{safety > 0 ? `, mais ${formatNumber(safety * 100, 1)}% de margem de segurança nos insumos` : ""}.{" "}
          <Link href={`/cardapio/${recipeId}`} className={link}>
            Ver a ficha
          </Link>
        </p>
      ),
    },
    {
      key: "tax",
      sign: "−",
      label: `Impostos (${formatPct(settings.taxPct)} do preço)`,
      value: by.tax.value,
      pct: by.tax.pct,
      note: (
        <p className={noteClass}>
          Percentual que você definiu.{" "}
          <Link href="/financeiro/impostos" className={link}>
            Alterar em Custos
          </Link>
        </p>
      ),
    },
    {
      key: "fee",
      sign: "−",
      label: `Taxa de venda${channelName ? ` · ${channelName}` : ""} (${formatPct(feePct)})`,
      value: by.fee.value,
      pct: by.fee.pct,
      note: <p className={noteClass}>Cobrada pelo canal de venda (cartão, app de pedidos). Troque o canal lá em cima para ver outro.</p>,
    },
    ...(by.other ? [{ key: "other", sign: "−" as const, label: `Outras taxas (${formatPct(settings.otherPct ?? 0)})`, value: by.other.value, pct: by.other.pct }] : []),
    {
      key: "contribution",
      sign: "=",
      label: "Sobra antes dos custos fixos",
      value: at.contribution,
      pct: at.contributionPct,
      strong: true,
      note: <p className={noteClass}>É o que cada venda deixa para pagar o aluguel, os salários e o resto dos custos fixos.</p>,
    },
    { key: "fixed", sign: "−", label: `Custos fixos (${formatPct(settings.fixedExpensePct)} do preço)`, value: by.fixed.value, pct: by.fixed.pct, note: fixedNote },
    {
      key: "profit",
      sign: "=",
      label: at.net < 0 ? "Prejuízo por marmita" : "Lucro por marmita",
      value: at.net,
      pct: at.netPct,
      strong: true,
      tone: at.net < 0 ? "bad" : "good",
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        Como chegamos nesse número
        <Hint>
          Parte do preço de venda e tira, em ordem, o custo, os impostos, a taxa e os custos fixos. O que sobra no fim é o lucro de uma marmita.
        </Hint>
      </h2>
      <ul className="flex flex-col card p-4">
        {rows.map((r) => (
          <li key={r.key} className={`flex flex-col gap-1 py-2.5 ${r.strong && r.key !== "price" ? "border-t border-border" : ""} ${r.key === "price" ? "pb-3" : ""}`}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={`${r.strong ? "font-bold" : ""} ${r.tone === "bad" ? "text-danger" : ""}`}>
                {r.sign ? <span className="mr-1.5 text-muted">{r.sign}</span> : null}
                {r.label}
              </span>
              <span className="tabular shrink-0">
                <strong className={r.tone === "bad" ? "text-danger" : r.tone === "good" ? "text-success" : ""}>{formatBRL(r.value)}</strong>
                <span className="text-muted"> · {formatPct(r.pct)}</span>
              </span>
            </div>
            {r.key !== "price" && r.key !== "contribution" ? (
              <div className="h-1.5 overflow-hidden rounded-full bg-background" aria-hidden>
                <div className={`h-full rounded-full ${r.value < 0 ? "bg-danger" : BAR[r.key] ?? "bg-success"}`} style={{ width: `${Math.min(100, Math.max(0, r.pct * 100))}%` }} />
              </div>
            ) : null}
            {r.note}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "No mês": o lucro por marmita multiplicado pelas vendas. As unidades vêm do cardápio digital (últimos 30 dias) ou são um palpite editável. */
export function MonthlyProfit({
  price,
  cost,
  settings,
  feePct,
  suggestedUnits,
  unitsFromMenu,
}: {
  price: number;
  cost: number;
  settings: PricingSettings;
  feePct: number;
  suggestedUnits: number;
  unitsFromMenu: boolean;
}) {
  const [text, setText] = useState(String(suggestedUnits));
  const at = analyzePrice({ cost, settings, feePct, price }).at;
  if (!at) return null;
  const parsed = parseDecimal(text);
  const units = parsed === null ? 0 : Math.max(0, Math.floor(Number(parsed)));
  const m = monthlyResult({ price, contribution: at.contribution, net: at.net, units });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        No mês
        <Hint>O lucro de uma marmita vezes quantas você vende. Mude a quantidade para ver quanto sobra com mais ou menos vendas.</Hint>
      </h2>
      <div className="flex flex-col gap-3 card p-4">
        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          <span>Se eu vender por mês</span>
          <span className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              inputMode="numeric"
              aria-label="Quantas marmitas vendidas por mês"
              className="tabular h-11 w-24 rounded-xl border border-border bg-background px-3 text-right text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <span className="text-muted">marmitas</span>
          </span>
        </label>
        <p className={noteClass}>{unitsFromMenu ? "Começa com o que o cardápio digital vendeu dessa marmita nos últimos 30 dias." : "Um número de exemplo: mude para o que você vende."}</p>
        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Faturamento dessa marmita</dt>
            <dd className="tabular font-semibold">{formatBRL(m.revenue)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Sobra antes dos custos fixos</dt>
            <dd className="tabular font-semibold">{formatBRL(m.contribution)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-border pt-2">
            <dt className="font-bold">{m.net < 0 ? "Prejuízo no mês" : "Lucro no mês"}</dt>
            <dd className={`tabular text-lg font-extrabold ${m.net < 0 ? "text-danger" : "text-success"}`}>{formatBRL(m.net)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
