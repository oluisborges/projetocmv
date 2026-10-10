import Link from "next/link";
import { CostsTabs } from "@/components/costs-tabs";
import { requireMember } from "@/lib/auth";
import { loadFixedCosts, loadStaff } from "@/lib/costs-data";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import { summarizeFixedCosts } from "@/lib/fixed-costs-view";
import { loadCurrentPrices, loadPricingContext } from "@/lib/pricing-data";
import { computeRecipe } from "@/lib/recipe-cost";
import { loadIngredients, loadRecipes } from "@/lib/recipes-data";
import { AddFixedCostForm, AddStaffForm, FixedCostRow, MonthlyNumbersForm, StaffRowView } from "./costs-forms";

export const metadata = { title: "Custos" };

export default async function CostsPage() {
  const { orgId, canWrite } = await requireMember();
  const ctx = await loadPricingContext(orgId, canWrite);

  if (!ctx) {
    return (
      <>
        <h1 className="text-2xl font-extrabold tracking-tight">Custos</h1>
        <p className="rounded-xl border border-border bg-surface p-4 text-sm">Sua marmitaria ainda não tem uma unidade cadastrada. Fale com a Shogun.</p>
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

  // Marmitas com custo calculado e preço definido entram no ponto de equilíbrio (mesmo peso para todas).
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const dishes = recipes.flatMap((r) => {
    const price = prices.get(r.id) ?? 0;
    const view = computeRecipe(
      { portions: r.portions, portionWeight: r.portion_weight, cookingLossPct: r.cooking_loss_pct, useCookingYield: r.mode === "serving" },
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
    feePct,
  });

  const empty = fixedCosts.length === 0 && staff.length === 0;

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Custos</h1>
        <p className="text-muted">O que você paga todo mês, venda ou não venda. Isso entra no preço de cada marmita.</p>
      </section>

      <CostsTabs active="fixed" />

      <section aria-live="polite" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Seu ponto de equilíbrio</p>
        {summary.breakEven ? (
          <>
          <p className="text-lg leading-snug">
            Para empatar você precisa vender <strong className="tabular">{formatNumber(summary.breakEven.units, 0)} marmitas por mês</strong> (cerca de{" "}
            <strong className="tabular">{formatNumber(summary.breakEven.perDay, 0)} por dia</strong>), o que dá{" "}
            <strong className="tabular">{formatBRL(summary.breakEven.revenue)}</strong> de faturamento.
          </p>
          <p className="text-xs text-muted">
            Considerando 30 dias por mês, o preço atual das suas marmitas e a venda por <strong>{cheapest?.name ?? "venda direta"}</strong> (a de menor taxa).
            {ctx.configured ? "" : " É uma estimativa: ainda faltam os impostos nos Ajustes."}
          </p>
          </>
        ) : empty ? (
          <p className="text-muted">Cadastre seus custos fixos e a equipe abaixo para descobrir quanto precisa vender para não ter prejuízo.</p>
        ) : dishes.length === 0 ? (
          <p className="text-muted">
            Falta o preço de venda das marmitas para calcular. <Link href="/precificacao" className="font-semibold text-primary">Definir preços</Link>
          </p>
        ) : (
          <p className="text-warning">Com os preços de hoje, suas marmitas não cobrem os custos: cada venda perde dinheiro. Revise em Preços.</p>
        )}

        {summary.total > 0 ? (
          <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
            <div>
              <dt className="text-muted">Custos fixos + equipe</dt>
              <dd className="tabular font-bold">{formatBRL(summary.total)}/mês</dd>
            </div>
            <div>
              <dt className="text-muted">Cada marmita paga</dt>
              <dd className="tabular font-bold">{summary.perUnit !== null ? formatBRL(summary.perUnit) : "informe as marmitas/mês"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted">Peso nas vendas</dt>
              <dd className="font-bold">
                {summary.pctOfRevenue !== null && !ctx.fixedAuto ? (
                  <span className="font-normal text-danger">
                    Seus custos fixos (<span className="tabular">{formatPct(summary.pctOfRevenue)}</span> do faturamento) passam do que você fatura. Confira os valores: enquanto isso o preço sugerido NÃO está
                    contando os custos fixos.
                  </span>
                ) : summary.pctOfRevenue !== null ? (
                  <>
                    <span className="tabular">{formatPct(summary.pctOfRevenue)}</span> do faturamento <span className="font-normal text-muted">· já usado no preço sugerido</span>
                  </>
                ) : (
                  <span className="font-normal text-muted">informe o faturamento do mês para o app usar isso no preço</span>
                )}
              </dd>
            </div>
          </dl>
        ) : null}
      </section>

      {canWrite ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Números do mês</h2>
          <MonthlyNumbersForm revenue={ctx.monthlyRevenue} units={ctx.monthlyUnits} />
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Custos fixos ({fixedCosts.length}) · {formatBRL(summary.fixedTotal)}
        </h2>
        {fixedCosts.length > 0 ? (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-4">
            {fixedCosts.map((c) => (
              <FixedCostRow key={c.id} cost={c} canWrite={canWrite} />
            ))}
          </ul>
        ) : null}
        {canWrite ? <AddFixedCostForm /> : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Equipe ({staff.length}) · {formatBRL(summary.staffTotal)}
        </h2>
        {staff.length > 0 ? (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-4">
            {staff.map((m) => (
              <StaffRowView key={m.id} person={m} canWrite={canWrite} />
            ))}
          </ul>
        ) : null}
        {canWrite ? <AddStaffForm /> : null}
        <p className="text-xs text-muted">Inclua você também: coloque seu pró-labore como uma pessoa da equipe. Seu trabalho tem custo e precisa estar no preço.</p>
      </section>
    </>
  );
}
