import Link from "next/link";
import { ImportProgress } from "@/components/import-progress";
import type { MenuMonth } from "@/lib/calc";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";

/** Bloco "Vendas pelo cardápio": números reais vindos da integração, com a cobertura dos vínculos e o andamento da importação. */
export function MenuSalesCard({
  orders,
  revenue,
  summary,
  unlinkedProducts,
  importing = false,
  pending = 0,
}: {
  orders: number;
  revenue: number;
  summary: MenuMonth;
  unlinkedProducts: number;
  /** A importação ainda não terminou: os números do mês podem estar incompletos. */
  importing?: boolean;
  /** Pedidos que ainda faltam chegar. */
  pending?: number;
}) {
  return (
    <section className="flex flex-col gap-3 card p-4">
      <ImportProgress initialImporting={importing} initialPending={pending} />
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
          <Link href="/custos/cardapio" className="font-semibold text-primary">
            Vincular agora
          </Link>
        </p>
      ) : null}
    </section>
  );
}
