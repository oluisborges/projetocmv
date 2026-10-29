import Link from "next/link";
import { BrandFooter } from "@/components/brand-footer";
import { Hint } from "@/components/hint";
import { InicioTabs } from "@/components/inicio-tabs";
import { PainelTabs } from "@/components/painel-tabs";
import { requireMember } from "@/lib/auth";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import { hasMenuConnection } from "@/lib/menu-data";
import { loadMenuEngineering } from "@/lib/menu-engineering-data";
import { productsForShare, QUADRANT_INFO, summarizeQuadrants, type Quadrant } from "@/lib/menu-engineering";
import { currentMonthStart, lastMonths, monthLabel, monthStart } from "@/lib/month-view";
import { MenuMatrix } from "./matrix";

export const metadata = { title: "Por marmita" };

const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const BADGE: Record<Quadrant, string> = { star: "bg-success/10 text-success", plowhorse: "bg-warning/10 text-warning", puzzle: "bg-primary/10 text-primary", dog: "bg-danger/10 text-danger" };

export default async function MenuAnalysisPage(props: PageProps<"/painel/cardapio">) {
  const { orgId, canWrite } = await requireMember();
  const sp = await props.searchParams;
  const now = currentMonthStart();
  const month = monthStart(typeof sp.mes === "string" ? sp.mes : undefined) ?? now;
  const data = await loadMenuEngineering(orgId, canWrite, month);

  const months = lastMonths(now, 6);
  if (!months.includes(month)) months.push(month);
  months.sort().reverse();

  const header = (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Por marmita</h1>
        <p className="text-muted">Quais marmitas valem destaque, reajuste ou saída do cardápio digital.</p>
      </section>
      <InicioTabs active="avancada" />
      <PainelTabs active="cardapio" showCoupons={await hasMenuConnection(orgId)} />
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
  const quadrants = summarizeQuadrants(result);

  return (
    <>
      {header}

      <div>
        <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted">Mês</p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {months.map((m) => {
            const on = m === month;
            const [y, mm] = m.split("-").map(Number);
            return (
              <Link
                key={m}
                href={`/painel/cardapio?mes=${m.slice(0, 7)}`}
                aria-current={on ? "page" : undefined}
                className={`flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`}
              >
                {SHORT[mm - 1]}/{String(y).slice(2)}
              </Link>
            );
          })}
        </div>
        <h2 className="pt-3 text-lg font-bold first-letter:uppercase">{monthLabel(month)}</h2>
      </div>

      {result.products.length === 0 ? (
        <div className="flex flex-col gap-2 card p-4 text-sm">
          <p>
            <strong>Ainda não há vendas com ficha completa neste mês.</strong>
          </p>
          <p className="text-muted">
            {data.menuConnected ? (
              <>
                Vincule os produtos do cardápio digital às fichas em{" "}
                <Link href="/cardapio/sincronizar" className="tap-area font-semibold text-primary">
                  Cardápio, aba Sincronizar Cardápio
                </Link>{" "}
                e complete as fichas que ainda estão sem custo.
              </>
            ) : (
              <>
                Informe quantas marmitas vendeu de cada ficha em{" "}
                <Link href={`/producao/fechar-mes?mes=${month.slice(0, 7)}`} className="tap-area font-semibold text-primary">
                  Fechar o mês
                </Link>{" "}
                (e o preço de cada uma em Cardápio, na aba Preço de venda) para ver a análise.
              </>
            )}
          </p>
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-1 card p-4">
            <p className="text-sm text-muted">
              Sobrou das vendas do mês
              <Hint>Valor pago pelas marmitas (já sem a parte do cupom) menos o custo das fichas, impostos e outras taxas. Ainda não desconta as despesas fixas.</Hint>
            </p>
            <p className="tabular text-3xl font-extrabold tracking-tight">{formatBRL(result.totalContribution)}</p>
            <p className="text-sm text-muted">
              em {formatNumber(result.totalUnits, 0)} marmitas · {formatBRL(result.avgUnitContribution)} por marmita, em média.{" "}
              {result.products.length > 2 ? (
                <>
                  {productsForShare(result, 0.8)} {productsForShare(result, 0.8) === 1 ? "produto dá" : "produtos dão"} 80% desse lucro.
                </>
              ) : null}
            </p>
          </section>

          <section className="flex flex-col gap-3 card p-4">
            <MenuMatrix result={result} />
          </section>

          <dl className="grid grid-cols-2 gap-3">
            {quadrants.map((q) => (
              <div key={q.quadrant} className="flex flex-col gap-0.5 card p-3">
                <dt className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[q.quadrant]}`}>{QUADRANT_INFO[q.quadrant].label}</dt>
                <dd className="tabular text-2xl font-extrabold">{q.count}</dd>
                <dd className="text-xs text-muted">{q.count > 0 ? `${formatBRL(q.totalContribution)} de lucro` : QUADRANT_INFO[q.quadrant].hint}</dd>
              </div>
            ))}
          </dl>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Marmita por marmita</h2>
            <ul className="divide-y divide-border card px-4">
              {result.products.map((p) => (
                <li key={p.id} className="flex flex-col gap-1.5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/cardapio/${p.id}/preco`} className="tap-area min-w-0 font-semibold leading-snug">
                      {p.name}
                    </Link>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[p.quadrant]}`}>{QUADRANT_INFO[p.quadrant].label}</span>
                  </div>
                  <p className="tabular text-sm text-muted">
                    vendeu <strong className="text-foreground">{formatNumber(p.units, 0)}</strong> · pago em média {formatBRL(p.paidPrice)} · sobra{" "}
                    <strong className="text-foreground">{formatBRL(p.unitContribution)}</strong> ({formatPct(p.marginPct, 0)}) por marmita
                  </p>
                  <p className="tabular text-sm">
                    Lucro no mês: <strong>{formatBRL(p.totalContribution)}</strong>
                  </p>
                  <p className="text-xs text-muted">{QUADRANT_INFO[p.quadrant].action}</p>
                </li>
              ))}
            </ul>
          </section>

          {result.unclassified.length > 0 ? (
            <p className="rounded-xl bg-warning/10 p-3 text-sm">
              {result.unclassified.length} {result.unclassified.length === 1 ? "produto vendeu mas ficou de fora" : "produtos venderam mas ficaram de fora"} da análise por falta de custo na ficha:{" "}
              {result.unclassified
                .slice(0, 4)
                .map((u) => u.name)
                .join(", ")}
              {result.unclassified.length > 4 ? "…" : ""}. Complete em{" "}
              <Link href="/cardapio" className="tap-area font-semibold text-primary">
                Marmitas
              </Link>
              .
            </p>
          ) : null}
          {data.skippedManualUnits > 0 ? (
            <p className="rounded-xl bg-warning/10 p-3 text-sm">
              {formatNumber(data.skippedManualUnits, 0)} marmitas que você digitou em fichas sem preço cadastrado não entraram. Cadastre o preço em{" "}
              <Link href="/cardapio" className="tap-area font-semibold text-primary">
                Marmitas, na aba Preço de venda
              </Link>
              .
            </p>
          ) : null}
        </>
      )}
      <BrandFooter />
    </>
  );
}
