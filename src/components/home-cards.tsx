import Link from "next/link";
import { ApplyPriceButton } from "@/components/apply-price-button";
import { Hint } from "@/components/hint";
import { formatBRL, formatPct } from "@/lib/format";
import type { MonthHealth } from "@/lib/month-health";
import type { PriceAction } from "@/lib/price-actions";
import { monthLabel } from "@/lib/month-view";

const TONE: Record<MonthHealth["tone"], { ring: string; text: string }> = {
  good: { ring: "border-success/40 bg-success/10", text: "text-success" },
  warn: { ring: "border-warning/50 bg-warning/10", text: "text-warning" },
  bad: { ring: "border-danger/40 bg-danger/10", text: "text-danger" },
  neutral: { ring: "border-border bg-surface", text: "" },
};

/** "Como estou este mês?": a primeira coisa que a dona vê ao abrir o app. */
export function MonthHealthCard({ health, month, canWrite }: { health: MonthHealth; month: string; canWrite: boolean }) {
  const tone = TONE[health.tone];
  const pct = health.breakEvenProgress === null ? null : Math.min(1, health.breakEvenProgress);
  return (
    <section aria-label="Como estou este mês" className={`flex flex-col gap-3 rounded-2xl border-2 p-5 ${tone.ring}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          Como estou em <span className="first-letter:uppercase">{monthLabel(month)}</span>
        </p>
        <p className="tabular text-xs text-muted">{health.partial ? `dia ${health.day} de ${health.daysInMonth}` : "mês fechado"}</p>
      </div>

      {health.profit !== null ? (
        <div className="flex flex-col">
          <p className="text-sm text-muted">
            {health.partial ? "Sobra até agora" : "Sobrou no mês"}
            <Hint>Faturamento menos o custo dos insumos (pelas fichas), impostos e taxas, e as contas fixas só dos dias que já passaram. É o mesmo número do Histórico. É uma estimativa: usa o custo das fichas, não as compras reais.</Hint>
          </p>
          <p className={`tabular text-4xl font-extrabold tracking-tight ${health.profit < 0 ? "text-danger" : ""}`}>{formatBRL(health.profit)}</p>
          <p className="tabular text-sm text-muted">de {formatBRL(health.revenue)} faturados</p>
        </div>
      ) : (
        <div className="flex flex-col">
          <p className="text-sm text-muted">Faturou até agora</p>
          <p className="tabular text-4xl font-extrabold tracking-tight">{formatBRL(health.revenue)}</p>
        </div>
      )}

      <p className={`text-sm font-semibold ${tone.text}`}>{health.headline}</p>

      {pct !== null && health.breakEvenRevenue !== null ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              Ponto de equilíbrio
              <Hint>Quanto você precisa faturar no mês para pagar todas as contas (insumos, impostos, equipe e despesas fixas). Acima disso, sobra lucro.</Hint>
            </span>
            <span className="tabular text-muted">{formatBRL(health.breakEvenRevenue)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-border" role="img" aria-label={`${formatPct(pct, 0)} do ponto de equilíbrio`}>
            <div className={`h-full rounded-full ${health.breakEvenProgress! >= 1 ? "bg-success" : "bg-accent"}`} style={{ width: `${pct * 100}%` }} />
          </div>
          <p className="tabular text-xs text-muted">
            {health.breakEvenProgress! >= 1 ? "Você já passou do equilíbrio: daqui para frente é lucro." : `Faltam ${formatBRL(health.missingToBreakEven ?? 0)} para pagar todas as contas do mês inteiro.`}
          </p>
        </div>
      ) : null}

      {canWrite ? (
        <Link href={`/producao/fechar-mes?mes=${month.slice(0, 7)}`} className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-primary">
          Ver ou atualizar as contas do mês →
        </Link>
      ) : null}
    </section>
  );
}

/** "O que fazer agora": preço que bateria a meta, só para quem está abaixo dela. */
export function PriceActionsCard({ actions, targetPct, canWrite = false }: { actions: PriceAction[]; targetPct: number; canWrite?: boolean }) {
  if (actions.length === 0) return null;
  return (
    <section aria-label="O que fazer agora" className="flex flex-col gap-3 card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        O que fazer agora
        <Hint>
          Estas marmitas sobram menos que a sua meta de {formatPct(targetPct, 0)} de lucro. O preço ao lado é o menor que bate a meta. É uma conta, não uma ordem: você conhece sua região e seus clientes.
        </Hint>
      </h2>
      <ul className="divide-y divide-border">
        {actions.map((a) => (
          <li key={a.id} className="flex flex-col gap-2 py-3">
            <Link href={`/cardapio/${a.id}/preco`} className="flex min-h-11 flex-col gap-0.5">
              <span className="font-semibold leading-snug">{a.name}</span>
              <span className="tabular text-sm">
                Suba de {formatBRL(a.price)} para <strong>{formatBRL(a.targetPrice)}</strong> <span className="text-muted">(+{formatBRL(a.rise)}, +{formatPct(a.risePct, 0)})</span>
              </span>
              <span className="tabular text-xs text-muted">
                Hoje sobra {formatPct(a.currentNetPct, 0)} (meta {formatPct(targetPct, 0)})
                {a.gainPerMonth !== null ? ` · cerca de ${formatBRL(a.gainPerMonth)} a mais por mês` : ""}
              </span>
            </Link>
            {canWrite ? <ApplyPriceButton recipeId={a.id} price={a.targetPrice} name={a.name} /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
