import Link from "next/link";
import { PainelTabs } from "@/components/painel-tabs";
import { requireMember } from "@/lib/auth";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import { loadHistory, type HistoryEntry } from "@/lib/history-data";
import { lastMonths, monthLabel } from "@/lib/month-view";

export const metadata = { title: "Histórico" };

const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

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
    <details open={open} className="group rounded-xl border border-border bg-surface">
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
            <Link href={`/custos/mes?mes=${entry.month.slice(0, 7)}`} className="font-semibold text-primary underline">
              Informar faturamento e compras
            </Link>
          </p>
        ) : (
          <>
            <Delta now={s.revenue} before={previous?.summary.revenue} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Stat label="Faturamento" value={s.revenue > 0 ? formatBRL(s.revenue) : "—"} />
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
                  {s.result ? <Stat label="Sobrou (estimativa)" value={formatBRL(s.result.value)} sub={`${formatPct(s.result.pct)} do faturamento`} /> : null}
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

        {entry.hasSnapshot && entry.products.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Produtos neste mês</p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {entry.products.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="tabular text-xs text-muted">
                      {p.cost !== null ? `custo ${formatBRL(p.cost)}` : "ficha incompleta"}
                      {p.price ? ` · preço ${formatBRL(p.price)}` : ""}
                      {p.sold > 0 ? ` · ${formatNumber(p.sold, 0)} vendidos` : ""}
                    </span>
                  </span>
                  {p.cost !== null && p.price ? <span className="tabular shrink-0 text-xs font-semibold">{formatPct(p.cost / p.price, 0)} em insumos</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="text-xs text-muted">
          {entry.hasSnapshot
            ? "Custos, preços, equipe e impostos são os que valiam no último dia em que o app foi usado neste mês."
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
    <section aria-label="Faturamento por mês" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
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

export default async function HistoricoPage() {
  const { orgId, canWrite } = await requireMember();
  const history = await loadHistory(orgId, canWrite);

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Painel</h1>
        <p className="text-muted">O que aconteceu em cada mês.</p>
      </section>
      <PainelTabs active="historico" />

      {!history || history.entries.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm">
          O histórico começa a se formar quando você informa o faturamento do mês em{" "}
          <Link href="/custos/mes" className="font-semibold text-primary underline">
            Custos → Resultado do mês
          </Link>
          . A cada mês, o app guarda também os seus custos e preços daquele momento.
        </p>
      ) : (
        <>
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
