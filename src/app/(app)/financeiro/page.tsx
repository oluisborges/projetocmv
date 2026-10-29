import Link from "next/link";
import { CostsTabs } from "@/components/costs-tabs";
import { requireMember } from "@/lib/auth";
import { Hint } from "@/components/hint";
import { loadFixedCosts, loadStaff } from "@/lib/costs-data";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import { summarizeFixedCosts } from "@/lib/fixed-costs-view";
import { loadLastMonthRevenue } from "@/lib/last-month-revenue";
import { loadPricingContext } from "@/lib/pricing-data";
import { StepCard } from "./step-card";
import { AddFixedCostForm, AddStaffForm, FixedCostRow, MonthlyNumbersForm, StaffRowView } from "./costs-forms";

export const metadata = { title: "Custos fixos e equipe" };

export default async function CostsPage() {
  const { orgId, canWrite } = await requireMember();
  const ctx = await loadPricingContext(orgId, canWrite);

  if (!ctx) {
    return (
      <>
        <h1 className="text-2xl font-extrabold tracking-tight">Financeiro</h1>
        <CostsTabs active="fixed" />
        <p className="card p-4 text-sm">Sua marmitaria ainda não tem uma unidade cadastrada. Fale com o suporte do Precificaí.</p>
      </>
    );
  }

  const [fixedCosts, staff, lastMonth] = await Promise.all([loadFixedCosts(ctx.unit.id), loadStaff(ctx.unit.id), loadLastMonthRevenue(orgId, ctx.unit.id).catch(() => null)]);

  const cheapest = [...ctx.channels].sort((a, b) => a.fee_pct - b.fee_pct)[0];
  const feePct = cheapest?.fee_pct ?? 0;
  const summary = summarizeFixedCosts({
    fixedCosts: fixedCosts.map((c) => c.monthly_amount),
    staff: staff.map((m) => ({ area: m.area, monthlySalary: m.monthly_salary, chargesPct: m.charges_pct })),
    monthlyRevenue: ctx.monthlyRevenue,
    monthlyUnits: ctx.monthlyUnits,
    dishes: [],
    taxPct: ctx.settings.taxPct,
    feePct: feePct + (ctx.settings.otherPct ?? 0),
  });

  const salesDone = Boolean(ctx.monthlyRevenue && ctx.monthlyUnits);
  const fixedDone = fixedCosts.length > 0;
  const staffDone = staff.length > 0;
  const doneCount = [salesDone, fixedDone, staffDone].filter(Boolean).length;
  const firstOpen = !salesDone ? "sales" : !fixedDone ? "fixed" : !staffDone ? "staff" : null;
  const overRevenue = summary.pctOfRevenue !== null && !ctx.fixedAuto;

  const steps: { key: string; title: string; done: boolean; status: string; body: React.ReactNode }[] = [
    {
      key: "sales",
      title: "Quanto você vende por mês",
      done: salesDone,
      status: salesDone
        ? `${formatBRL(ctx.monthlyRevenue!)} · ${formatNumber(ctx.monthlyUnits!, 0)} unidades${ctx.revenueSource === "history" ? ` · média de ${ctx.revenueMonths} ${ctx.revenueMonths === 1 ? "mês" : "meses"}` : ""}`
        : "falta preencher",
      body:
        ctx.revenueSource === "history" ? (
          <>
            <p className="text-sm leading-relaxed">
              Calculado pela <strong>média dos {ctx.revenueMonths === 1 ? "mês" : `${ctx.revenueMonths} últimos meses`}</strong> em que você informou o faturamento. Para mudar, ajuste os meses em
              Mês.
            </p>
            <Link href="/producao/fechar-mes" className="inline-flex min-h-11 items-center font-semibold text-primary">
              Abrir o Mês →
            </Link>
          </>
        ) : canWrite ? (
          <>
            <MonthlyNumbersForm revenue={ctx.monthlyRevenue} units={ctx.monthlyUnits} />
            <p className="text-xs text-muted">
              Quando você informar o faturamento de cada mês em <Link href="/producao/fechar-mes" className="tap-area font-semibold text-primary underline">Produção, Fechar o mês</Link>, o app passa a usar a média desses meses.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">Ainda não informado.</p>
        ),
    },
    {
      key: "fixed",
      title: "Contas fixas (aluguel, luz, gás…)",
      done: fixedDone,
      status: fixedDone ? `${fixedCosts.length} ${fixedCosts.length === 1 ? "conta" : "contas"} · ${formatBRL(summary.fixedTotal)}/mês` : "nenhuma ainda",
      body: (
        <>
          {fixedCosts.length > 0 ? (
            <ul className="divide-y divide-border card px-4">
              {fixedCosts.map((c) => (
                <FixedCostRow key={c.id} cost={c} canWrite={canWrite} />
              ))}
            </ul>
          ) : null}
          {canWrite ? <AddFixedCostForm existing={fixedCosts.map((c) => c.name)} /> : null}
        </>
      ),
    },
    {
      key: "staff",
      title: "Equipe (inclua você)",
      done: staffDone,
      status: staffDone ? `${staff.length} ${staff.length === 1 ? "pessoa" : "pessoas"} · ${formatBRL(summary.staffTotal)}/mês` : "ninguém ainda",
      body: (
        <>
          {staff.length > 0 ? (
            <ul className="divide-y divide-border card px-4">
              {staff.map((m) => (
                <StaffRowView key={m.id} person={m} canWrite={canWrite} />
              ))}
            </ul>
          ) : null}
          {canWrite ? <AddStaffForm /> : null}
          <p className="text-xs text-muted">Coloque seu pró-labore como uma pessoa da equipe: seu trabalho tem custo e precisa estar no preço.</p>
        </>
      ),
    },
  ];

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Financeiro</h1>
        <p className="text-muted">O que você paga todo mês, venda ou não venda.</p>
      </section>
      <CostsTabs active="fixed" />

      {summary.total > 0 ? (
        <section aria-live="polite" className="flex flex-col gap-1 rounded-2xl bg-primary p-5 text-primary-foreground">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Total de contas e equipe</p>
          <p className="tabular text-3xl font-extrabold tracking-tight">{formatBRL(summary.total)} por mês</p>
          {lastMonth ? (
            <p className="text-sm opacity-90">
              <span className="tabular">{formatPct(summary.total / lastMonth.revenue)}</span> do que você faturou no mês passado.
              <Hint label="Como é calculado?">Contas fixas mais equipe (salários e encargos), divididos pelo que você faturou no mês passado, puxado do cardápio digital. Não inclui o gasto com insumos. Atualiza sozinho a cada mês.</Hint>
            </p>
          ) : null}
        </section>
      ) : (
        <p className="card p-4 text-sm">Preencha os passos abaixo para ver o total das suas contas e da equipe.</p>
      )}

      {overRevenue ? (
        <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">
          Suas contas ({formatPct(summary.pctOfRevenue!)} do faturamento) passam do que você fatura. Confira os valores: por enquanto o lucro calculado não conta os custos fixos.
        </p>
      ) : null}

      <div className="flex items-baseline justify-between text-sm">
        <h2 className="font-semibold">{doneCount === 3 ? "Tudo preenchido" : `${doneCount} de 3 preenchidos`}</h2>
        <Link href="/producao/fechar-mes" className="tap-area font-semibold text-primary">
          Fechar o mês →
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {steps.map((st, i) => (
          <StepCard key={st.key} index={i + 1} title={st.title} status={st.status} done={st.done} startOpen={st.key === firstOpen}>
            {st.body}
          </StepCard>
        ))}
      </div>
    </>
  );
}
