import Link from "next/link";
import { CostsTabs } from "@/components/costs-tabs";
import { Hint } from "@/components/hint";
import { requireMember } from "@/lib/auth";
import { loadStaff } from "@/lib/costs-data";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import { currentMonthStart, lastMonths, monthLabel, monthStart, summarizeMonth } from "@/lib/month-view";
import { loadPricingContext } from "@/lib/pricing-data";
import { computeRecipe } from "@/lib/recipe-cost";
import { loadIngredients, loadRecipes } from "@/lib/recipes-data";
import { createClient } from "@/lib/supabase/server";
import { PeriodForm, SalesRow } from "./month-forms";

export const metadata = { title: "Resultado do mês" };

const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default async function MonthPage(props: PageProps<"/custos/mes">) {
  const { orgId, canWrite } = await requireMember();
  const sp = await props.searchParams;
  const requested = monthStart(typeof sp.mes === "string" ? sp.mes : undefined);
  const now = currentMonthStart();
  const month = requested ?? now;

  const ctx = await loadPricingContext(orgId, canWrite);
  if (!ctx) {
    return (
      <>
        <h1 className="text-2xl font-extrabold tracking-tight">Custos</h1>
        <p className="rounded-xl border border-border bg-surface p-4 text-sm">Sua marmitaria ainda não tem uma unidade cadastrada. Fale com a Shogun.</p>
      </>
    );
  }

  const supabase = await createClient();
  const [{ data: period }, staff, ingredients, { recipes, items }] = await Promise.all([
    supabase.from("periods").select("id, revenue, purchases").eq("unit_id", ctx.unit.id).eq("month", month).maybeSingle(),
    loadStaff(ctx.unit.id),
    loadIngredients(),
    loadRecipes(),
  ]);
  const { data: salesRows } = period
    ? await supabase.from("period_sales").select("recipe_id, qty_sold").eq("period_id", period.id)
    : { data: [] as { recipe_id: string; qty_sold: number }[] };

  const byIngredient = new Map(ingredients.map((i) => [i.id, i]));
  const qtyByRecipe = new Map((salesRows ?? []).map((r) => [r.recipe_id as string, Number(r.qty_sold)]));

  const dishes = recipes.map((r) => {
    const view = computeRecipe(
      { portions: r.portions, portionWeight: r.portion_weight, cookingLossPct: r.cooking_loss_pct, useCookingYield: r.mode === "serving" },
      items.filter((i) => i.recipe_id === r.id && byIngredient.has(i.ingredient_id)).map((i) => ({ ingredient: byIngredient.get(i.ingredient_id)!, netQty: i.net_qty, scope: i.scope })),
    );
    return { id: r.id, name: r.name, cost: view.ok ? view.cost.costPerPortion.toNumber() : null, qty: qtyByRecipe.get(r.id) ?? 0 };
  });

  const revenue = Number(period?.revenue ?? 0);
  const purchases = Number(period?.purchases ?? 0);
  const summary = summarizeMonth({
    revenue,
    purchases,
    sales: dishes.map((d) => ({ recipeId: d.id, qty: d.qty, cost: d.cost })),
    staff: staff.map((m) => ({ area: m.area, monthlySalary: m.monthly_salary, chargesPct: m.charges_pct })),
  });

  const months = lastMonths(now, 6);
  if (!months.includes(month)) months.push(month);
  months.sort().reverse(); // do mais recente para o mais antigo, mesmo quando o mês pedido está fora da lista
  const hasData = revenue > 0 || purchases > 0 || summary.soldUnits > 0;
  const bigGap = summary.deviationPct !== null && Math.abs(summary.deviationPct) >= 0.03;

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Custos</h1>
        <p className="text-muted">Quanto você gastou no mês, comparado com o que deveria.</p>
      </section>

      <CostsTabs active="month" />

      <div>
        <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted">Mês</p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {months.map((m) => {
            const [y, mm] = m.split("-").map(Number);
            const on = m === month;
            return (
              <Link
                key={m}
                href={`/custos/mes?mes=${m.slice(0, 7)}`}
                aria-current={on ? "page" : undefined}
                className={`flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`}
              >
                {SHORT[mm - 1]}/{String(y).slice(2)}
              </Link>
            );
          })}
        </div>
      </div>

      <h2 className="text-lg font-bold first-letter:uppercase">{monthLabel(month)}</h2>

      {canWrite ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">1. Faturamento e compras do mês</h2>
          <PeriodForm month={month} revenue={revenue} purchases={purchases} />
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          2. Unidades vendidas ({formatNumber(summary.soldUnits, 0)})
        </h2>
        {dishes.length === 0 ? (
          <p className="text-sm text-muted">
            Ainda não há fichas. Monte em <Link href="/fichas" className="font-semibold text-primary">Fichas</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-4">
            {dishes.map((d) => (
              <SalesRow key={`${d.id}-${month}`} month={month} recipe={{ id: d.id, name: d.name, cost: d.cost }} initialQty={d.qty} canWrite={canWrite} />
            ))}
          </ul>
        )}
      </section>

      {/* resultado depois dos dois passos de preenchimento */}
      {hasData ? (
        <section aria-live="polite" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">
                Você gastou com insumos
                <Hint>Compras do mês ÷ faturamento. É uma aproximação: o app ainda não controla o estoque, então o que sobrou na prateleira conta como gasto.</Hint>
              </dt>
              <dd className="tabular text-xl font-extrabold">{summary.cmvRealPct !== null ? formatPct(summary.cmvRealPct) : "—"}</dd>
              <dd className="tabular text-xs text-muted">{formatBRL(summary.purchases)} do faturamento</dd>
            </div>
            <div>
              <dt className="text-muted">
                As fichas dizem que deveria ser
                <Hint>Custo de cada produto (pela ficha) × quantas você vendeu, dividido pelo faturamento. É o gasto ideal, sem desperdício.</Hint>
              </dt>
              <dd className="tabular text-xl font-extrabold">{summary.cmvTheoreticalPct !== null ? formatPct(summary.cmvTheoreticalPct) : "—"}</dd>
              <dd className="tabular text-xs text-muted">{summary.theoreticalCost !== null ? formatBRL(summary.theoreticalCost) : "informe as vendas abaixo"}</dd>
            </div>
          </dl>

          {summary.deviationCost !== null ? (
            <div
              className={`rounded-lg p-3 text-sm ${
                summary.deviationPct === null ? "bg-border/60" : bigGap && summary.deviationCost > 0 ? "bg-danger/10" : bigGap ? "bg-warning/10" : "bg-success/10"
              }`}
            >
              {summary.deviationPct === null ? (
                <p>
                  Comprou <strong>{formatBRL(summary.purchases)}</strong>; o esperado era <strong>{formatBRL(summary.theoreticalCost ?? 0)}</strong>. <strong>Informe o faturamento</strong> para avaliar a diferença.
                </p>
              ) : !bigGap ? (
                <p>
                  <strong>Compras e vendas batem.</strong> A diferença é de só {formatBRL(Math.abs(summary.deviationCost))}.
                </p>
              ) : summary.deviationCost > 0 ? (
                <p>
                  <strong>Gastou {formatBRL(summary.deviationCost)} a mais</strong> do que as vendas explicam.
                  <Hint>
                    Pode ser sobra de estoque, desperdício, perda no preparo, preço de insumo desatualizado nas fichas ou venda não informada
                    {summary.salesWithoutCost > 0 ? ` (e ${summary.salesWithoutCost} ${summary.salesWithoutCost === 1 ? "ficha incompleta não entra" : "fichas incompletas não entram"} na conta)` : ""}.
                  </Hint>
                </p>
              ) : (
                <p>
                  <strong>Gastou {formatBRL(Math.abs(summary.deviationCost))} a menos</strong> do que o esperado.
                  <Hint>Provavelmente usou estoque comprado no mês anterior, informou vendas a mais, ou o custo de alguma ficha está acima do real.</Hint>
                </p>
              )}
            </div>
          ) : null}

          {summary.cmoCost > 0 ? (
            <div className="border-t border-border pt-3 text-sm">
              <p className="text-muted">
                Mão de obra
                <Hint>Salários mais encargos da sua equipe (cadastrada em Custos fixos), dividido pelo faturamento do mês.</Hint>
              </p>
              <p className="tabular">
                <strong className="text-xl font-extrabold">{summary.cmoPct !== null ? formatPct(summary.cmoPct) : "—"}</strong>{" "}
                <span className="text-muted">· {formatBRL(summary.cmoCost)} por mês</span>
              </p>
            </div>
          ) : null}

          {summary.salesWithoutCost > 0 ? (
            <p className="text-xs text-warning">
              {summary.salesWithoutCost} {summary.salesWithoutCost === 1 ? "produto vendido está" : "produtos vendidos estão"} com a ficha incompleta: o custo esperado está subestimado.
            </p>
          ) : null}
        </section>
      ) : (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          Informe o faturamento, as compras e quantas unidades vendeu de cada produto. O app mostra se o que você gastou bate com o que deveria.
        </p>
      )}

    </>
  );
}
