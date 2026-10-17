import Link from "next/link";
import { Hint } from "@/components/hint";
import type { MenuMonth, OutsideEstimate } from "@/lib/calc";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";

const REASON: Record<Extract<OutsideEstimate, { ok: false }>["reason"], string> = {
  "no-outside-revenue": "Informe quanto vendeu por fora do cardápio para ver a estimativa.",
  "no-margin": "Ainda não dá para estimar: faltam produtos do cardápio vinculados a fichas completas.",
  "low-coverage": "Ainda não dá para estimar: menos da metade do que o cardápio vendeu tem ficha vinculada.",
};

/** Bloco "Vendas pelo cardápio": números reais vindos da integração, com a cobertura dos vínculos. */
export function MenuSalesCard({
  orders,
  revenue,
  summary,
  unlinkedProducts,
  importing = false,
}: {
  orders: number;
  revenue: number;
  summary: MenuMonth;
  unlinkedProducts: number;
  /** A importação ainda não terminou: os números do mês podem estar incompletos. */
  importing?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3 card p-4">
      {importing ? (
        <p role="status" className="rounded-lg bg-warning/10 p-3 text-sm">
          <strong>Ainda importando seus pedidos.</strong> Os números do mês podem estar incompletos; eles se completam sozinhos.
        </p>
      ) : null}
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Vendas pelo cardápio</h2>
        <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">automático</span>
      </header>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted">Faturamento</dt>
          <dd className="tabular text-xl font-extrabold">{formatBRL(revenue)}</dd>
          <dd className="tabular text-xs text-muted">{formatNumber(orders, 0)} pedidos</dd>
        </div>
        <div>
          <dt className="text-muted">Marmitas vendidas</dt>
          <dd className="tabular text-xl font-extrabold">{formatNumber(summary.linkedUnits.toNumber(), 0)}</dd>
          <dd className="text-xs text-muted">das fichas vinculadas</dd>
        </div>
      </dl>
      {unlinkedProducts > 0 ? (
        <p className="rounded-lg bg-warning/10 p-3 text-sm">
          {unlinkedProducts} {unlinkedProducts === 1 ? "produto vendido ainda não tem" : "produtos vendidos ainda não têm"} ficha
          {summary.coverage !== null ? ` (o custo de ${formatPct(summary.coverage.toNumber())} do que o cardápio vendeu já está na conta)` : ""}.{" "}
          <Link href="/custos/cardapio" className="font-semibold text-primary">Vincular agora</Link>
        </p>
      ) : null}
    </section>
  );
}

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
