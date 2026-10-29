import Link from "next/link";
import { BrandFooter } from "@/components/brand-footer";
import { Hint } from "@/components/hint";
import { PainelTabs } from "@/components/painel-tabs";
import { requireMember } from "@/lib/auth";
import { loadCoupons } from "@/lib/coupon-data";
import { verdictLabel, type Verdict } from "@/lib/coupon-view";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import { currentMonthStart, lastMonths, monthLabel, monthStart } from "@/lib/month-view";

export const metadata = { title: "Cupons de desconto" };

const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const BADGE: Record<Verdict, string> = { loss: "bg-danger/10 text-danger", low: "bg-warning/10 text-warning", ok: "bg-success/10 text-success", unknown: "bg-border text-muted" };

const codeLabel = (code: string) => (code === "" ? "Desconto sem cupom" : code === "?" ? "Pedidos antigos (lendo o código)" : code);

export default async function CouponsPage(props: PageProps<"/painel/cupons">) {
  const { orgId, canWrite } = await requireMember();
  const sp = await props.searchParams;
  const now = currentMonthStart();
  const month = monthStart(typeof sp.mes === "string" ? sp.mes : undefined) ?? now;
  const data = await loadCoupons(orgId, canWrite, month);

  const months = lastMonths(now, 6);
  if (!months.includes(month)) months.push(month);
  months.sort().reverse();

  const header = (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Painel</h1>
        <p className="text-muted">Quanto os cupons custam e se ainda sobra lucro com eles.</p>
      </section>
      <PainelTabs active="cupons" showCoupons />
    </>
  );

  if (!data) {
    return (
      <>
        {header}
        <p className="card p-4 text-sm">Os cupons vêm dos pedidos do cardápio digital. Seu cardápio ainda não está conectado: fale com o suporte do Precificaí.</p>
      </>
    );
  }

  const a = data.analysis;
  const hasCoupons = a.couponOrders > 0;

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
                href={`/painel/cupons?mes=${m.slice(0, 7)}`}
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

      {!hasCoupons ? (
        <p className="card p-4 text-sm">
          <strong>Nenhum pedido com desconto neste mês.</strong> <span className="text-muted">Quando houver cupons nos pedidos do cardápio, a análise aparece aqui.</span>
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-1 card p-4">
            <p className="text-sm text-muted">
              Descontos dados no mês
              <Hint>Soma de todos os cupons e descontos dos pedidos do cardápio. Cada desconto vale para o pedido inteiro; o app divide entre os itens para saber quanto cada marmita foi realmente paga.</Hint>
            </p>
            <p className="tabular text-3xl font-extrabold tracking-tight">{formatBRL(a.discount)}</p>
            <p className="text-sm text-muted">
              {formatNumber(a.couponOrders, 0)} de {formatNumber(a.totalOrders, 0)} pedidos ({a.totalOrders > 0 ? formatPct(a.couponOrders / a.totalOrders, 0) : "—"}) · média de{" "}
              {a.avgDiscountPerOrder !== null ? formatBRL(a.avgDiscountPerOrder) : "—"} por pedido
              {a.discountPct !== null ? ` · ${formatPct(a.discountPct)} do valor dos itens` : ""}
            </p>
          </section>

          {a.marginWith !== null && a.marginWithout !== null ? (
            <section className="flex flex-col gap-2 card p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                O cupom come a sua margem
                <Hint>Margem de contribuição dos itens vinculados a fichas: o que sobra depois do custo, impostos e taxas, antes das despesas fixas.</Hint>
              </h2>
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-muted">Pedidos sem desconto</dt>
                  <dd className="tabular text-2xl font-extrabold text-success">{formatPct(a.marginWithout, 0)}</dd>
                  {a.ticketWithout !== null ? <dd className="text-xs text-muted">ticket {formatBRL(a.ticketWithout)}</dd> : null}
                </div>
                <div>
                  <dt className="text-xs text-muted">Pedidos com desconto</dt>
                  <dd className={`tabular text-2xl font-extrabold ${a.marginWith < data.minMarginPct ? "text-danger" : ""}`}>{formatPct(a.marginWith, 0)}</dd>
                  {a.ticketWith !== null ? <dd className="text-xs text-muted">ticket {formatBRL(a.ticketWith)}</dd> : null}
                </div>
              </dl>
              {a.profitLost > 0 ? (
                <p className="text-sm">
                  Os cupons tiraram cerca de <strong className="tabular">{formatBRL(a.profitLost)}</strong> do seu lucro neste mês.
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Cupom por cupom</h2>
            {data.noCodesAtAll ? (
              <p className="rounded-xl bg-warning/10 p-3 text-sm">O cardápio não informou o código dos cupons neste período, então só dá para ver o total dos descontos.</p>
            ) : null}
            <ul className="divide-y divide-border card px-4">
              {a.reports.map((r) => (
                <li key={r.code} className="flex flex-col gap-1.5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words font-semibold leading-snug">{codeLabel(r.code)}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[r.verdict]}`}>{verdictLabel[r.verdict]}</span>
                  </div>
                  <p className="tabular text-sm text-muted">
                    usado em <strong className="text-foreground">{formatNumber(r.orders, 0)}</strong> {r.orders === 1 ? "pedido" : "pedidos"} · deu{" "}
                    <strong className="text-foreground">{formatBRL(r.discount)}</strong>
                    {r.discountPct !== null ? ` (${formatPct(r.discountPct, 0)} dos itens)` : ""}
                  </p>
                  {r.verdict !== "unknown" && r.marginAfter !== null ? (
                    <p className="tabular text-sm">
                      Sobrou <strong className={r.contribution < 0 ? "text-danger" : ""}>{formatBRL(r.contribution)}</strong> ({formatPct(r.marginAfter, 0)}
                      {r.marginBefore !== null ? `, seriam ${formatPct(r.marginBefore, 0)} sem o cupom` : ""})
                    </p>
                  ) : r.code === "?" ? (
                    <p className="text-xs text-muted">Estamos lendo de novo esses pedidos para descobrir o cupom; isso termina sozinho.</p>
                  ) : (
                    <p className="text-xs text-muted">
                      Só {formatPct(r.coverage, 0)} dos itens têm ficha vinculada.{" "}
                      <Link href="/financeiro/cardapio" className="font-semibold text-primary">
                        Vincular produtos
                      </Link>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {data.room.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Quanto desconto cada marmita aguenta
            <Hint>
              É o maior desconto que a marmita aceita sem a margem cair abaixo da sua margem mínima ({formatPct(data.minMarginPct, 0)}), considerando o custo da ficha, os impostos e as taxas. Acima disso o cupom faz você perder dinheiro naquela marmita.
            </Hint>
          </h2>
          <ul className="divide-y divide-border card px-4">
            {data.room.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link href={`/cardapio/${r.id}/preco`} className="block truncate font-semibold">
                    {r.name}
                  </Link>
                  <p className="tabular text-xs text-muted">
                    preço {formatBRL(r.price)} · custo {formatBRL(r.cost)} · vendeu {formatNumber(r.units, 0)}
                  </p>
                </div>
                <p className={`tabular shrink-0 text-right text-lg font-extrabold ${r.maxDiscountPct !== null && r.maxDiscountPct < 0.1 ? "text-danger" : ""}`}>
                  {r.maxDiscountPct === null ? "—" : formatPct(r.maxDiscountPct, 0)}
                  <span className="block text-[11px] font-normal text-muted">no máximo</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <BrandFooter />
    </>
  );
}
