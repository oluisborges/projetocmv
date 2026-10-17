import { Hint } from "@/components/hint";
import type { MenuMonth, OutsideEstimate } from "@/lib/calc";
import { formatBRL, formatPct } from "@/lib/format";

const REASON: Record<Extract<OutsideEstimate, { ok: false }>["reason"], string> = {
  "no-outside-revenue": "Informe quanto vendeu por fora do cardápio para ver a estimativa.",
  "no-margin": "Ainda não dá para estimar: faltam produtos do cardápio vinculados a fichas completas.",
  "low-coverage": "Ainda não dá para estimar: menos da metade do que o cardápio vendeu tem ficha vinculada.",
};

/** Lucro do cardápio (real) e da venda por fora (estimado), sempre rotulados. Antes das despesas fixas. */
export function MenuProfitCard({ summary, outside, outsideRevenue }: { summary: MenuMonth; outside: OutsideEstimate; outsideRevenue: number }) {
  const real = summary.costedRevenue.gt(0);
  const total = real && outside.ok ? summary.contribution.plus(outside.contribution) : null;
  return (
    <section aria-live="polite" className="flex flex-col gap-3 card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        Quanto sobrou das vendas
        <Hint>
          Venda menos o custo da comida e embalagem das fichas, menos impostos e taxas do canal. Ainda não desconta as despesas fixas (aluguel, equipe…): isso está em Custos fixos.
        </Hint>
      </h2>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            No cardápio <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">real</span>
          </p>
          <p className="tabular text-2xl font-extrabold">{real ? formatBRL(summary.contribution.toNumber()) : "—"}</p>
        </div>
        {summary.contributionPct ? <p className="tabular text-sm text-muted">{formatPct(summary.contributionPct.toNumber())} do vendido</p> : null}
      </div>
      {!real ? <p className="text-xs text-muted">Vincule os produtos do cardápio a fichas completas para ver o lucro real.</p> : null}
      {summary.linesWithoutCost > 0 ? (
        <p className="text-xs text-warning">
          {summary.linesWithoutCost} {summary.linesWithoutCost === 1 ? "produto vinculado está" : "produtos vinculados estão"} com a ficha incompleta e ficou fora da conta.
        </p>
      ) : null}

      <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
        <div>
          <p className="text-sm text-muted">
            Venda por fora ({formatBRL(outsideRevenue)}) <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">estimado</span>
            <Hint>Não sabemos o que foi vendido por fora, então usamos a mesma margem do cardápio. É uma projeção, não um número exato.</Hint>
          </p>
          <p className="tabular text-2xl font-extrabold">{outside.ok ? formatBRL(outside.contribution.toNumber()) : "—"}</p>
        </div>
        {outside.ok ? <p className="tabular text-sm text-muted">{formatPct(outside.pct.toNumber())} do vendido</p> : null}
      </div>
      {!outside.ok ? <p className="text-xs text-muted">{REASON[outside.reason]}</p> : null}

      {total ? (
        <p className="border-t border-border pt-3 text-sm">
          Somando os dois, sobraram cerca de <strong className="tabular">{formatBRL(total.toNumber())}</strong> <span className="text-muted">(parte estimada)</span>.
        </p>
      ) : null}
    </section>
  );
}
