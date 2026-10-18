import Link from "next/link";
import { MonthTabs } from "@/components/month-tabs";
import { requireMember } from "@/lib/auth";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import { loadHistory, type HistoryEntry } from "@/lib/history-data";
import type { ChangeEvent } from "@/lib/history-view";
import { lastMonths, monthLabel } from "@/lib/month-view";
import { ExportLinks } from "@/components/export-links";
import { Hint } from "@/components/hint";
import { profitBridge } from "@/lib/profit-bridge";

export const metadata = { title: "Histórico" };

const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

function eventText(e: ChangeEvent) {
  const arrow = (from: string, to: string, up: boolean) => (
    <span className="tabular">
      {from} → <strong className={up ? "text-danger" : "text-success"}>{to}</strong>
    </span>
  );
  if (e.kind === "price") return <>{e.label}: preço {arrow(formatBRL(e.from), formatBRL(e.to), false)}</>;
  if (e.kind === "cost") return <>{e.label}: custo {arrow(formatBRL(e.from), formatBRL(e.to), e.to > e.from)}</>;
  if (e.kind === "tax") return <>{e.label}: {arrow(formatPct(e.from), formatPct(e.to), e.to > e.from)}</>;
  return <>{e.label} por mês: {arrow(formatBRL(e.from), formatBRL(e.to), e.to > e.from)}</>;
}

function Delta({ now, before }: { now: number; before: number | undefined }) {
  if (!before || before <= 0 || now <= 0) return null;
  const pct = now / before - 1;
  return (
    <p className={`text-xs font-semibold ${pct >= 0 ? "text-success" : "text-danger"}`}>
      {pct >= 0 ? "▲" : "▼"} {formatPct(Math.abs(pct), 0)} <span className="font-normal text-muted">no faturamento vs mês anterior</span>
    </p>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular text-lg font-extrabold leading-tight">{value}</dd>
      {sub ? <dd className="tabular text-xs text-muted">{sub}</dd> : null}
    </div>
  );
}

function MonthCard({ entry, previous, open }: { entry: HistoryEntry; previous: HistoryEntry | undefined; open: boolean }) {
  const { summary: s } = entry;
  const hasNumbers = s.revenue > 0 || s.purchases > 0;
  return (
    <details open={open} className="group card">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="font-bold first-letter:uppercase">{monthLabel(entry.month)}</span>
          <span className="tabular text-sm text-muted">{s.revenue > 0 ? `Faturou ${formatBRL(s.revenue)}` : "faturamento não informado"}</span>
        </span>
        {s.result ? (
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${s.result.value >= 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
            {s.result.value >= 0 ? "Sobrou" : "Faltou"} {formatPct(Math.abs(s.result.pct), 0)}
          </span>
        ) : null}
        <span aria-hidden className="text-muted transition group-open:rotate-180">
          ▾
        </span>
      </summary>

      <div className="flex flex-col gap-4 border-t border-border p-4">
        {!hasNumbers ? (
          <p className="text-sm text-muted">
            Nada informado neste mês ainda.{" "}
            <Link href={`/mes?mes=${entry.month.slice(0, 7)}`} className="font-semibold text-primary underline">
              Informar faturamento e compras
            </Link>
          </p>
        ) : (
          <>
            <Delta now={s.revenue} before={previous?.summary.revenue} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Stat
                label="Faturamento"
                value={s.revenue > 0 ? formatBRL(s.revenue) : "—"}
                sub={entry.menuOrders > 0 ? `${formatBRL(entry.menuRevenue)} do cardápio${s.revenue - entry.menuRevenue > 0 ? ` + ${formatBRL(s.revenue - entry.menuRevenue)} por fora` : ""}` : undefined}
              />
              <Stat label="Compras de insumos" value={s.purchases > 0 ? formatBRL(s.purchases) : "—"} />
              <Stat
                label="Gasto com insumos"
                value={s.insumosPct !== null ? formatPct(s.insumosPct) : "—"}
                sub={s.expectedPct !== null ? `as fichas indicavam ${formatPct(s.expectedPct)}` : undefined}
              />
              <Stat label="Unidades vendidas" value={s.soldUnits > 0 ? formatNumber(s.soldUnits, 0) : "—"} />
              {entry.hasSnapshot ? (
                <>
                  <Stat label="Equipe" value={s.staffPct !== null ? formatPct(s.staffPct) : "—"} />
                  <Stat label="Despesas fixas" value={s.fixedPct !== null ? formatPct(s.fixedPct) : "—"} />
                  <Stat label="Impostos e taxas" value={s.taxesPct !== null ? formatPct(s.taxesPct) : "—"} />
                  {s.result ? (
                    <Stat
                      label={s.partial ? "Sobra até agora (estimativa)" : "Sobrou (estimativa)"}
                      value={formatBRL(s.result.value)}
                      sub={`${formatPct(s.result.pct)} do faturamento · ${s.resultBasis === "fichas" ? "pelo custo das fichas" : "pelas compras do mês"}${s.partial ? "; contas fixas só dos dias que passaram" : ""}`}
                    />
                  ) : null}
                </>
              ) : null}
            </dl>
          </>
        )}

        {entry.moves.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Insumos que mudaram de preço</p>
            <ul className="flex flex-col gap-1 text-sm">
              {entry.moves.map((m) => (
                <li key={m.name} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{m.name}</span>
                  <span className={`tabular shrink-0 font-semibold ${m.pct > 0 ? "text-danger" : "text-success"}`}>
                    {m.pct > 0 ? "▲ +" : "▼ −"}
                    {formatPct(Math.abs(m.pct), 0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {entry.events.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">O que mudou durante o mês</p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {entry.events.map((e, i) => (
                <li key={`${e.at}-${i}`} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                  <span className="tabular w-11 shrink-0 text-xs font-semibold text-muted">{dayLabel(e.at)}</span>
                  <span className="min-w-0 flex-1">{eventText(e)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {entry.hasSnapshot && entry.products.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Produtos neste mês</p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {entry.products.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="tabular text-xs text-muted">
                      {p.avgCost !== null ? `custo médio ${formatBRL(p.avgCost)}` : "ficha incompleta"}
                      {p.avgPrice ? (p.minPrice !== p.maxPrice ? ` · preço de ${formatBRL(p.minPrice ?? 0)} a ${formatBRL(p.maxPrice ?? 0)}` : ` · preço ${formatBRL(p.avgPrice)}`) : ""}
                      {p.sold > 0 ? ` · ${formatNumber(p.sold, 0)} vendidos` : ""}
                    </span>
                  </span>
                  {p.avgCost !== null && p.avgPrice ? <span className="tabular shrink-0 text-xs font-semibold">{formatPct(p.avgCost / p.avgPrice, 0)} em insumos</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {hasNumbers ? <ExportLinks base="/painel/exportar" params={`mes=${entry.month.slice(0, 7)}`} label="Relatório do mês" hint="Para o contador e o financeiro: resultado, marmitas, insumos e (se você contou o estoque) o CMV real." /> : null}

        <p className="text-xs text-muted">
          {entry.hasSnapshot
            ? "Os números são médias do mês: cada custo ou preço conta pelo tempo em que valeu. O app registra uma mudança sempre que alguém altera algo; o que foi feito antes do primeiro registro do mês é tratado como valendo desde o dia 1."
            : "O app ainda não tinha guardado os custos e os preços deste mês: aqui só aparece o que foi informado em Resultado do mês."}
        </p>
      </div>
    </details>
  );
}

function Chart({ entries }: { entries: HistoryEntry[] }) {
  const shown = entries
    .filter((e) => e.summary.revenue > 0)
    .slice(0, 6)
    .reverse();
  if (shown.length < 2) return null;
  const max = Math.max(...shown.map((e) => e.summary.revenue));
  return (
    <section aria-label="Faturamento por mês" className="flex flex-col gap-3 card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">Faturamento por mês</p>
      <ol className="flex h-40 items-end gap-2">
        {shown.map((e) => {
          const m = Number(e.month.split("-")[1]);
          const r = e.summary.result;
          return (
            <li key={e.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="tabular text-[10px] font-semibold text-muted">{formatNumber(e.summary.revenue / 1000, 1)} mil</span>
              <span className="w-full rounded-t-md bg-primary" style={{ height: `${Math.max(6, (e.summary.revenue / max) * 70)}%` }} />
              <span className="text-xs font-medium">{SHORT[m - 1]}</span>
              {r ? <span className={`tabular text-[10px] font-bold ${r.value >= 0 ? "text-success" : "text-danger"}`}>{formatPct(r.pct, 0)}</span> : <span className="text-[10px]">&nbsp;</span>}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted">Embaixo de cada mês: quanto sobrou do faturamento (estimativa), quando há dados.</p>
    </section>
  );
}


/** "Por que o resultado mudou?": o último mês com resultado contra o anterior. */
function BridgeCard({ entries }: { entries: HistoryEntry[] }) {
  // Só compara meses fechados: o mês em andamento ainda não tem todas as vendas nem todas as contas.
  const cur = entries.find((e) => e.summary.result && !e.summary.partial);
  if (!cur) return null;
  const prevMonth = lastMonths(cur.month, 2)[1];
  const prev = entries.find((e) => e.month === prevMonth);
  if (!prev) return null;
  const bridge = profitBridge(prev.summary, cur.summary, cur.moves);
  if (!bridge) return null;
  const up = bridge.delta >= 0;
  return (
    <section aria-label="Por que o resultado mudou" className="flex flex-col gap-3 card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
        Por que o resultado mudou
        <Hint>Compara o resultado de {monthLabel(cur.month)} com o do mês anterior e separa o que veio das vendas, do preço médio, do custo dos insumos e das contas fixas. Usa a mesma conta do resto do Histórico: custo dos insumos pelas fichas (ou pelas compras, se as fichas não bastam).</Hint>
      </p>
      <p className="text-sm">
        De <strong className="tabular">{formatBRL(bridge.from)}</strong> em <span className="first-letter:uppercase">{monthLabel(prev.month)}</span> para <strong className="tabular">{formatBRL(bridge.to)}</strong> em{" "}
        <span>{monthLabel(cur.month)}</span>:{" "}
        <strong className={`tabular ${up ? "text-success" : "text-danger"}`}>
          {up ? "+" : "−"}
          {formatBRL(Math.abs(bridge.delta))}
        </strong>
        .
      </p>
      <ul className="divide-y divide-border">
        {bridge.steps
          .filter((st) => Math.abs(st.value) >= 1)
          .map((st) => (
            <li key={st.key} className="flex items-start justify-between gap-3 py-2.5">
              <span className="min-w-0 text-sm">
                <span className="block font-semibold">{st.label}</span>
                <span className="text-xs text-muted">{st.text}</span>
              </span>
              <span className={`tabular shrink-0 text-sm font-bold ${st.value >= 0 ? "text-success" : "text-danger"}`}>
                {st.value >= 0 ? "+" : "−"}
                {formatBRL(Math.abs(st.value))}
              </span>
            </li>
          ))}
      </ul>
    </section>
  );
}

export default async function HistoricoPage() {
  const { orgId, canWrite } = await requireMember();
  const history = await loadHistory(orgId, canWrite);

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Mês</h1>
        <p className="text-muted">O que aconteceu em cada mês.</p>
      </section>
      <MonthTabs active="historico" />

      {!history || history.entries.length === 0 ? (
        <p className="card p-4 text-sm">
          O histórico começa a se formar quando você informa o faturamento do mês em{" "}
          <Link href="/mes" className="font-semibold text-primary underline">
            Mês → Fechar
          </Link>
          . A cada mês, o app guarda também os seus custos e preços daquele momento.
        </p>
      ) : (
        <>
          <BridgeCard entries={history.entries} />
          <Chart entries={history.entries} />
          <div className="flex flex-col gap-3">
            {history.entries.map((e, i) => {
              const prevMonth = lastMonths(e.month, 2)[1];
              return <MonthCard key={e.month} entry={e} previous={history.entries.find((x) => x.month === prevMonth)} open={i === 0} />;
            })}
          </div>
        </>
      )}
    </>
  );
}
