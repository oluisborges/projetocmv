import Link from "next/link";
import { MonthChips } from "@/components/month-chips";
import { EstoqueTabs } from "@/components/estoque-tabs";
import { ProducaoTabs } from "@/components/producao-tabs";
import { Hint } from "@/components/hint";
import { requireMember } from "@/lib/auth";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import { currentMonthStart, lastMonths, monthLabel, monthStart } from "@/lib/month-view";
import { loadStockMonth } from "@/lib/stock-data";
import { StockRowReadOnly } from "./stock-rows";
import { requireProductionAccess } from "@/lib/production-access";

export const metadata = { title: "Histórico do estoque" };

export default async function StockHistoryPage(props: PageProps<"/producao/estoque/historico">) {
  await requireProductionAccess();
  const { orgId, canWrite } = await requireMember();
  const sp = await props.searchParams;
  const now = currentMonthStart();
  const month = monthStart(typeof sp.mes === "string" ? sp.mes : undefined) ?? now;
  const data = await loadStockMonth(orgId, canWrite, month);

  const months = lastMonths(now, 6);
  if (!months.includes(month)) months.push(month);
  months.sort().reverse();

  const header = (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Produção</h1>
        <p className="text-muted">Histórico do estoque: mês a mês, o que você comprou, o que as fichas gastaram e o que sobrou de verdade.</p>
      </section>
      <ProducaoTabs active="estoque" />
      <EstoqueTabs active="historico" />
    </>
  );

  if (!data) {
    return (
      <>
        {header}
        <p className="card p-4 text-sm">Sua marmitaria ainda não tem unidade cadastrada. Fale com o suporte do Precificaí.</p>
      </>
    );
  }

  const { result } = data;
  const missingTotal = data.rows.reduce((s, r) => s + (r.missingValue !== null && r.missingValue > 0 ? r.missingValue : 0), 0);

  return (
    <>
      {header}

      <MonthChips months={months} current={month} basePath="/producao/estoque/historico" />
      <h2 className="text-lg font-bold first-letter:uppercase">{monthLabel(month)}</h2>

      {result ? (
        <section aria-label="CMV real" className={`flex flex-col gap-3 rounded-2xl border-2 p-4 ${result.gap !== null && result.gap > 0 && Math.abs(result.gapPct ?? 0) >= 0.02 ? "border-danger/40 bg-danger/10" : "border-success/40 bg-success/10"}`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            CMV real do mês
            <Hint>
              Estoque do começo + compras do mês − estoque do fim (e marmitas prontas que sobraram). É o que você realmente gastou em insumos para vender o que vendeu. O &quot;esperado&quot; vem das fichas.
            </Hint>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-muted">Você gastou</p>
              <p className="tabular text-2xl font-extrabold">{formatBRL(result.cogs)}</p>
              {data.revenue > 0 ? <p className="tabular text-xs text-muted">{formatPct(result.cogs / data.revenue)} do faturamento</p> : null}
            </div>
            <div>
              <p className="text-sm text-muted">As fichas dizem</p>
              <p className="tabular text-2xl font-extrabold">{result.theoreticalCost !== null ? formatBRL(result.theoreticalCost) : "—"}</p>
              {result.theoreticalCost !== null && data.revenue > 0 ? <p className="tabular text-xs text-muted">{formatPct(result.theoreticalCost / data.revenue)} do faturamento</p> : null}
            </div>
          </div>
          {result.gap !== null ? (
            <p className="text-sm">
              {Math.abs(result.gap) < 1 ? (
                <strong>Bateu: o que você gastou é o que as vendas explicam.</strong>
              ) : result.gap > 0 ? (
                <>
                  <strong>
                    Sumiram {formatBRL(result.gap)}
                    {result.gapPct !== null ? ` (${formatPct(result.gapPct)} do faturamento)` : ""}
                  </strong>{" "}
                  em insumos que as vendas não explicam: desperdício, porção maior que a ficha, quebra, ou compra e venda não lançadas.
                </>
              ) : (
                <>
                  <strong>Gastou {formatBRL(-result.gap)} a menos</strong> do que as fichas esperavam. Confira se faltou lançar alguma compra ou se alguma ficha está com quantidade maior que a real.
                </>
              )}
            </p>
          ) : (
            <p className="text-sm text-muted">Complete as fichas das marmitas vendidas para comparar com o esperado.</p>
          )}
          <p className="tabular text-xs text-muted">
            Começou com {formatBRL(result.openingValue)} em insumos · comprou {formatBRL(data.purchasesTotal)} · terminou com {formatBRL(result.closingValue)}
            {data.finishedOpening > 0 || (data.finishedClosing ?? 0) > 0 ? ` · freezer: ${formatBRL(data.finishedOpening)} → ${formatBRL(data.finishedClosing ?? 0)}` : ""}.
          </p>
          {result.countedCount < 5 ? (
            <p className="text-xs text-muted">Você contou {result.countedCount} {result.countedCount === 1 ? "insumo" : "insumos"}. Os que ficaram sem contagem entram como esperado: quanto mais você contar, mais confiável.</p>
          ) : null}
        </section>
      ) : (
        <section className="flex flex-col gap-2 card p-4 text-sm">
          <p>
            <strong>Para ver o CMV real do mês:</strong> conte o que sobrou dos insumos mais caros (frango, carnes, queijo…) em{" "}
            <Link href="/producao/estoque" className="tap-area font-semibold text-primary underline">
              Estoque agora
            </Link>
            . A contagem e as compras que você lança lá entram aqui sozinhas, no mês em que aconteceram.
          </p>
          <p className="text-muted">Não precisa contar tudo. Comece pelos de cima da lista: são os que mais pesam no seu custo.</p>
        </section>
      )}

      {data.recipesWithoutUsage > 0 ? (
        <p className="rounded-xl bg-warning/10 p-3 text-sm">
          {data.recipesWithoutUsage} {data.recipesWithoutUsage === 1 ? "marmita vendida está" : "marmitas vendidas estão"} com a ficha incompleta e não {data.recipesWithoutUsage === 1 ? "entra" : "entram"} no uso esperado. Complete em{" "}
          <Link href="/cardapio" className="tap-area font-semibold text-primary underline">
            Marmitas
          </Link>
          .
        </p>
      ) : null}
      {data.combosSold > 0 ? (
        <p className="rounded-xl bg-warning/10 p-3 text-sm">Os {formatNumber(data.combosSold, 0)} combos vendidos ainda não entram no uso esperado dos insumos; só as marmitas avulsas e as do cardápio.</p>
      ) : null}
      {!data.hasOpening && data.rows.length > 0 ? (
        <p className="rounded-xl bg-primary/10 p-3 text-sm">
          Não há contagem do mês anterior, então o app parte de zero no começo deste mês. Para ter o começo certo, tenha uma contagem em <span className="first-letter:uppercase">{monthLabel(lastMonths(month, 2)[1])}</span> também.
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Insumos do mês ({data.rows.length})
          {missingTotal > 0 ? <span className="ml-2 font-normal normal-case text-danger tabular">faltam {formatBRL(missingTotal)}</span> : null}
        </h2>
        {data.rows.length === 0 ? (
          <p className="card p-4 text-sm text-muted">
            Ainda não há compras nem vendas com ficha neste mês. Importe as{" "}
            <Link href="/ingredientes/nfe" className="tap-area font-semibold text-primary underline">
              notas fiscais
            </Link>{" "}
            e informe as vendas em{" "}
            <Link href={`/producao/fechar-mes?mes=${month.slice(0, 7)}`} className="tap-area font-semibold text-primary underline">
              Fechar o mês
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-border card px-4">
            {data.rows.map((r) => (
              <StockRowReadOnly key={`${r.id}-${month}`} row={r} />
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">
          O uso esperado é o que as marmitas vendidas gastam pelas fichas (com perda de limpeza e rendimento). As compras vêm das notas fiscais importadas e do que você lança em Estoque agora.
        </p>
      </section>
    </>
  );
}
