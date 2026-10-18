import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { loadFixedCosts, loadStaff } from "@/lib/costs-data";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import { summarizeFixedCosts } from "@/lib/fixed-costs-view";
import { loadCurrentPrices, loadPricingContext } from "@/lib/pricing-data";
import { computeRecipe, recipeCostSettings } from "@/lib/recipe-cost";
import { loadIngredients, loadRecipes } from "@/lib/recipes-data";
import { StepCard } from "./step-card";
import { AddFixedCostForm, AddStaffForm, FixedCostRow, MonthlyNumbersForm, StaffRowView } from "./costs-forms";

export const metadata = { title: "Custos fixos e equipe" };

export default async function CostsPage() {
  const { orgId, canWrite } = await requireMember();
  const ctx = await loadPricingContext(orgId, canWrite);

  if (!ctx) {
    return (
      <>
      {/* TODO(orquestrador): trocar por <BackLink href="/ajustes"> de @/components/back-link quando existir */}
      <Link href="/ajustes" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
        ← Ajustes
      </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">Custos fixos e equipe</h1>
        <p className="card p-4 text-sm">Sua marmitaria ainda não tem uma unidade cadastrada. Fale com o suporte do Precificaí.</p>
      </>
    );
  }

  const [fixedCosts, staff, ingredients, { recipes, items }, prices] = await Promise.all([
    loadFixedCosts(ctx.unit.id),
    loadStaff(ctx.unit.id),
    loadIngredients(),
    loadRecipes(),
    loadCurrentPrices(ctx.unit.id),
  ]);

  // Produtos com custo calculado e preço definido entram no ponto de equilíbrio (mesmo peso para todas).
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const dishes = recipes.flatMap((r) => {
    const price = prices.get(r.id) ?? 0;
    const view = computeRecipe(
      recipeCostSettings(r, ctx.settings.safetyMarginPct),
      items.filter((i) => i.recipe_id === r.id && byId.has(i.ingredient_id)).map((i) => ({ ingredient: byId.get(i.ingredient_id)!, netQty: i.net_qty, scope: i.scope })),
    );
    return view.ok && price > 0 ? [{ price, cost: view.cost.costPerPortion.toNumber() }] : [];
  });

  const cheapest = [...ctx.channels].sort((a, b) => a.fee_pct - b.fee_pct)[0];
  const feePct = cheapest?.fee_pct ?? 0;
  const summary = summarizeFixedCosts({
    fixedCosts: fixedCosts.map((c) => c.monthly_amount),
    staff: staff.map((m) => ({ area: m.area, monthlySalary: m.monthly_salary, chargesPct: m.charges_pct })),
    monthlyRevenue: ctx.monthlyRevenue,
    monthlyUnits: ctx.monthlyUnits,
    dishes,
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
            <Link href="/mes" className="inline-flex min-h-11 items-center font-semibold text-primary">
              Abrir o Mês →
            </Link>
          </>
        ) : canWrite ? (
          <>
            <MonthlyNumbersForm revenue={ctx.monthlyRevenue} units={ctx.monthlyUnits} />
            <p className="text-xs text-muted">
              Quando você informar o faturamento de cada mês em <Link href="/mes" className="font-semibold text-primary underline">Mês</Link>, o app passa a usar a média desses meses.
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
      {/* TODO(orquestrador): trocar por <BackLink href="/ajustes"> de @/components/back-link quando existir */}
      <Link href="/ajustes" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
        ← Ajustes
      </Link>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Custos fixos e equipe</h1>
        <p className="text-muted">O que você paga todo mês, venda ou não venda.</p>
      </section>

      <section aria-live="polite" className="flex flex-col gap-2 rounded-2xl bg-primary p-5 text-primary-foreground">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Para não ter prejuízo, você precisa vender</p>
        {summary.breakEven ? (
          <>
            <p className="tabular text-3xl font-extrabold tracking-tight">{formatNumber(summary.breakEven.units, 0)} unidades por mês</p>
            <p className="text-sm opacity-90">
              Cerca de {formatNumber(summary.breakEven.perDay, 0)} por dia · {formatBRL(summary.breakEven.revenue)} de faturamento
            </p>
          </>
        ) : summary.total > 0 && dishes.length > 0 ? (
          <p className="text-base font-semibold">Com os preços de hoje, cada venda perde dinheiro. Revise em Marmitas.</p>
        ) : summary.total > 0 ? (
          <p className="text-base">
            Falta o preço de venda dos produtos.{" "}
            <Link href="/marmitas" className="font-bold underline">
              Definir preços
            </Link>
          </p>
        ) : (
          <p className="text-base">Preencha os passos abaixo e eu calculo isso para você.</p>
        )}
        {summary.total > 0 ? (
          <p className="border-t border-white/25 pt-2 text-sm opacity-90">
            Total de contas e equipe: <strong className="tabular">{formatBRL(summary.total)}</strong> por mês
            {summary.pctOfRevenue !== null && !overRevenue ? (
              <>
                {" "}
                (<span className="tabular">{formatPct(summary.pctOfRevenue)}</span> do que você fatura, já no preço)
              </>
            ) : null}
          </p>
        ) : null}
      </section>

      {overRevenue ? (
        <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">
          Suas contas ({formatPct(summary.pctOfRevenue!)} do faturamento) passam do que você fatura. Confira os valores: por enquanto o lucro calculado não conta os custos fixos.
        </p>
      ) : null}

      <div className="flex items-baseline justify-between text-sm">
        <h2 className="font-semibold">{doneCount === 3 ? "Tudo preenchido" : `${doneCount} de 3 preenchidos`}</h2>
        <Link href="/mes" className="tap-area font-semibold text-primary">
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
