import Link from "next/link";
import { Hint } from "@/components/hint";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import { trendLabel } from "@/lib/network-board";
import { setupSteps, type Insight, type NetworkClient, type NetworkTotals } from "@/lib/network-view";

const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const shortMonth = (m: string) => `${SHORT[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

const compact = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
/** Rótulo curto do gráfico, sem "R$" (o título já diz): "203 mil". */
const compactPlain = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 0 });
/** Valores grandes dos cartões: sem centavos, para caber no celular. */
const brl0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const TONE = { good: "text-success", warn: "text-warning", bad: "text-danger", none: "text-muted" } as const;

function Tile({ label, value, hint, sub, help }: { label: string; value: string; hint?: string; sub?: { text: string; tone: keyof typeof TONE }; help?: string }) {
  return (
    <div className="flex flex-col gap-0.5 card p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
        {help ? <Hint>{help}</Hint> : null}
      </dt>
      <dd className="tabular truncate text-2xl font-extrabold tracking-tight">{value}</dd>
      {sub ? <dd className={`text-xs font-semibold ${TONE[sub.tone]}`}>{sub.text}</dd> : null}
      {hint ? <dd className="text-xs text-muted">{hint}</dd> : null}
    </div>
  );
}

/** Os números da rede inteira no mês escolhido. */
export function NetworkKpis({ totals }: { totals: NetworkTotals }) {
  const trend = trendLabel(totals.trend.pct, totals.trend.basis);
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <Tile
        label="Faturamento da rede"
        value={brl0.format(totals.revenue)}
        sub={totals.trend.pct !== null ? { text: trend.text, tone: trend.tone } : undefined}
        hint={totals.trend.projected !== null && totals.trend.basis === "pace" ? `projeção do mês: ${compact.format(totals.trend.projected)}` : undefined}
        help="Soma do que os clientes venderam no mês: pedidos do cardápio mais o que cada dono digitou de venda por fora. Em mês em andamento, a seta compara o ritmo atual com o mês anterior."
      />
      <Tile
        label="Pedidos no cardápio"
        value={formatNumber(totals.orders, 0)}
        hint={totals.ticket !== null ? `ticket médio ${formatBRL(totals.ticket)}` : "sem pedidos no mês"}
      />
      <Tile
        label="Cupons"
        value={totals.couponPct !== null ? formatPct(totals.couponPct) : "—"}
        hint={totals.couponPct !== null ? "do que seria vendido sem cupom" : undefined}
        help="Quanto os clientes deixaram de receber por causa de cupons e descontos nos pedidos do cardápio."
      />
      <Tile label="Clientes vendendo" value={`${totals.activeClients} de ${totals.clients}`} hint="com faturamento no mês" />
      <Tile
        label="Margem dos produtos"
        value={totals.avgContributionPct !== null ? formatPct(totals.avgContributionPct, 0) : "—"}
        hint={totals.marginClients > 0 ? `média de ${totals.marginClients} ${totals.marginClients === 1 ? "cliente" : "clientes"} com preço e custo` : "ninguém com ficha e preço ainda"}
        help="Média da margem de contribuição dos produtos de cada cliente: preço menos custo da ficha, impostos e taxas, antes das despesas fixas."
      />
      <Tile label="Cardápio conectado" value={`${totals.withMenu} de ${totals.clients}`} hint="clientes com integração" />
    </dl>
  );
}

/** Faturamento da rede nos últimos 6 meses, cardápio e digitado empilhados. */
export function RevenueChart({ series, selected }: { series: { month: string; menu: number; manual: number; total: number }[]; selected: string }) {
  const max = Math.max(1, ...series.map((s) => s.total));
  return (
    <section aria-label="Evolução do faturamento" className="flex flex-col gap-3 card p-4">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Faturamento por mês (R$)</h2>
        <p className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span aria-hidden className="size-2.5 rounded-sm bg-primary" /> cardápio
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden className="size-2.5 rounded-sm bg-accent" /> digitado
          </span>
        </p>
      </header>
      <ol className="grid grid-cols-6 items-end gap-2" style={{ height: "10rem" }}>
        {series.map((s) => {
          const h = (s.total / max) * 100;
          const on = s.month === selected;
          return (
            <li key={s.month} className="flex h-full flex-col justify-end gap-1" aria-label={`${shortMonth(s.month)}: ${formatBRL(s.total)}`}>
              <span className={`tabular text-center text-[11px] ${on ? "font-bold" : "text-muted"}`}>{s.total > 0 ? compactPlain.format(s.total) : "—"}</span>
              <div className={`flex w-full flex-col justify-end overflow-hidden rounded-t-md ${on ? "" : "opacity-60"}`} style={{ height: `${Math.max(h, s.total > 0 ? 3 : 0)}%` }}>
                {s.manual > 0 ? <div className="bg-accent" style={{ height: `${(s.manual / s.total) * 100}%` }} /> : null}
                <div className="min-h-px flex-1 bg-primary" />
              </div>
              <span className={`text-center text-[11px] ${on ? "font-bold" : "text-muted"}`}>{shortMonth(s.month)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** O que merece uma conversa com cada cliente. Os 6 mais importantes ficam à vista; o resto, num "ver mais". */
export function InsightList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <p role="status" className="rounded-2xl bg-success/10 px-4 py-3 text-sm text-success">
        <strong>Nada pedindo conversa.</strong> Vendas no ritmo, margens saudáveis e clientes com o sistema montado.
      </p>
    );
  }
  const item = (i: Insight) => (
    <li key={`${i.orgId}-${i.key}`} className="flex items-start gap-3 py-2">
      <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-full ${i.severity === "warning" ? "bg-warning" : "bg-primary/40"}`} />
      <p className="min-w-0 flex-1 text-sm leading-snug">
        <strong>{i.name}</strong>
        <span className="block text-muted">{i.text}</span>
      </p>
      <Link href={`/admin/uso/${i.orgId}`} className="flex h-11 shrink-0 items-center rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-primary">
        Ver uso
      </Link>
    </li>
  );
  const warnings = insights.filter((i) => i.severity === "warning").length;
  return (
    <section aria-label="Para conversar com os clientes" className="flex flex-col gap-1 rounded-2xl border border-warning/40 bg-warning/5 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-warning">
        Para conversar ({insights.length}){warnings > 0 ? ` · ${warnings} ${warnings === 1 ? "aviso" : "avisos"}` : ""}
      </h2>
      <ul className="flex flex-col divide-y divide-warning/20">{insights.slice(0, 6).map(item)}</ul>
      {insights.length > 6 ? (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">Ver mais {insights.length - 6}</summary>
          <ul className="flex flex-col divide-y divide-warning/20">{insights.slice(6).map(item)}</ul>
        </details>
      ) : null}
    </section>
  );
}

/** Quantos clientes já chegaram em cada passo de montar o sistema. */
export function AdoptionFunnel({ clients }: { clients: NetworkClient[] }) {
  const stepsOf = clients.map((c) => setupSteps(c));
  const labels: { key: string; label: string }[] = [
    { key: "ingredients", label: "Insumos cadastrados" },
    { key: "recipes", label: "Fichas técnicas" },
    { key: "prices", label: "Preços de venda" },
    { key: "fixed", label: "Custos fixos e equipe" },
    { key: "menu", label: "Cardápio conectado" },
    { key: "links", label: "Produtos vinculados" },
  ];
  const rows = labels.map((l) => {
    const base = l.key === "links" ? clients.filter((c) => c.hasMenu).length : clients.length;
    const done = stepsOf.filter((steps) => steps.find((s) => s.key === l.key)?.done).length;
    return { ...l, done, base };
  });
  return (
    <section aria-label="Adoção" className="flex flex-col gap-3 card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        Quanto cada cliente já montou
        <Hint>Cada passo faz o sistema calcular um pouco mais do lucro real. “Produtos vinculados” só conta clientes com cardápio conectado.</Hint>
      </h2>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => {
          const share = r.base > 0 ? r.done / r.base : 0;
          return (
            <li key={r.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{r.label}</span>
                <span className="tabular font-semibold">
                  {r.done} <span className="font-normal text-muted">de {r.base}</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={r.label}>
                <div className={`h-full rounded-full ${share >= 0.7 ? "bg-success" : share >= 0.4 ? "bg-accent" : "bg-warning"}`} style={{ width: `${Math.round(share * 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
