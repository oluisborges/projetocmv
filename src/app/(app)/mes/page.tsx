import Link from "next/link";
import { MonthChips } from "@/components/month-chips";
import { MonthTabs } from "@/components/month-tabs";
import { ExportLinks } from "@/components/export-links";
import { Hint } from "@/components/hint";
import { requireMember } from "@/lib/auth";
import { summarizeCombo } from "@/lib/combo-view";
import { loadCombos, loadSalesWeights } from "@/lib/combos-data";
import { loadStaff } from "@/lib/costs-data";
import { hasMenuConnection, isImporting, loadMenuMonth, loadMenuProducts, loadMenuStatus } from "@/lib/menu-data";
import { kickStalled } from "@/lib/menu/server/kick";
import { buildMenuMonth, menuProfit, usesMenu } from "@/lib/menu-view";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import { normalizeSnapshot, summarizeSamples } from "@/lib/history-view";
import { closeMonthChecklist } from "@/lib/close-month";
import { currentMonthStart, lastMonths, monthBounds, monthLabel, monthStart, summarizeMonth } from "@/lib/month-view";
import { loadCurrentPrices, loadPricingContext } from "@/lib/pricing-data";
import { computeRecipe, recipeCostSettings } from "@/lib/recipe-cost";
import { loadIngredients, loadRecipes } from "@/lib/recipes-data";
import { createClient } from "@/lib/supabase/server";
import { PeriodForm, SalesRow } from "./month-forms";
import { MenuProfitCard } from "@/components/menu-cards";
import { MenuSalesCard } from "@/components/menu-sales-card";

export const metadata = { title: "Resultado do mês" };

export default async function MonthPage(props: PageProps<"/mes">) {
  const { orgId, canWrite } = await requireMember();
  const sp = await props.searchParams;
  const requested = monthStart(typeof sp.mes === "string" ? sp.mes : undefined);
  const now = currentMonthStart();
  const month = requested ?? now;

  const ctx = await loadPricingContext(orgId, canWrite);
  if (!ctx) {
    return (
      <>
        <h1 className="text-2xl font-extrabold tracking-tight">Fechar o mês</h1>
        <p className="card p-4 text-sm">Sua marmitaria ainda não tem uma unidade cadastrada. Fale com o suporte do Precificaí.</p>
      </>
    );
  }

  const supabase = await createClient();
  const [{ data: period }, staff, ingredients, { recipes, items }, prices] = await Promise.all([
    supabase.from("periods").select("id, revenue, purchases").eq("unit_id", ctx.unit.id).eq("month", month).maybeSingle(),
    loadStaff(ctx.unit.id),
    loadIngredients(),
    loadRecipes(),
    loadCurrentPrices(ctx.unit.id), // preço que o dono cadastrou: vale para a venda por fora
  ]);
  const prevMonth = lastMonths(month, 2)[1];
  const bounds = monthBounds(month);
  const [{ data: prevPeriod }, { data: nfeRows }] = await Promise.all([
    supabase.from("periods").select("revenue").eq("unit_id", ctx.unit.id).eq("month", prevMonth).maybeSingle(),
    supabase.from("nfe_imports").select("added_to_purchases").eq("unit_id", ctx.unit.id).gte("issued_at", bounds.start.toISOString()).lt("issued_at", bounds.end.toISOString()),
  ]);
  const purchasesFromNfe = (nfeRows ?? []).reduce((n, r) => n + Number(r.added_to_purchases), 0);
  const { count: stockCounted } = await supabase.from("ingredient_stock_counts").select("id", { count: "exact", head: true }).eq("unit_id", ctx.unit.id).eq("month", month);
  const { data: salesRows } = period
    ? await supabase.from("period_sales").select("recipe_id, qty_sold").eq("period_id", period.id)
    : { data: [] as { recipe_id: string; qty_sold: number }[] };
  const [combos, weights, { data: comboSalesRows }] = await Promise.all([
    loadCombos(orgId, { active: true }),
    loadSalesWeights(ctx.unit.id),
    period ? supabase.from("period_combo_sales").select("combo_id, qty_sold").eq("period_id", period.id) : Promise.resolve({ data: [] as { combo_id: string; qty_sold: number }[] }),
  ]);
  const comboQty = new Map((comboSalesRows ?? []).map((r) => [r.combo_id as string, Number(r.qty_sold)]));

  // Mês que já passou e tem registro: usa os custos e a equipe daquele mês (os mesmos números do Histórico), não os de hoje.
  const { data: snapRow } = month < now ? await supabase.from("month_snapshots").select("data").eq("unit_id", ctx.unit.id).eq("month", month).maybeSingle() : { data: null };
  const snap = snapRow ? normalizeSnapshot(snapRow.data, month) : null;
  const series = snap ? summarizeSamples(snap, month, monthBounds(month).end) : null;
  const seriesCost = new Map((series?.products ?? []).map((p) => [p.id, p.avgCost]));

  const byIngredient = new Map(ingredients.map((i) => [i.id, i]));
  const qtyByRecipe = new Map((salesRows ?? []).map((r) => [r.recipe_id as string, Number(r.qty_sold)]));

  const dishes = recipes.map((r) => {
    const view = computeRecipe(
      recipeCostSettings(r, ctx.settings.safetyMarginPct),
      items.filter((i) => i.recipe_id === r.id && byIngredient.has(i.ingredient_id)).map((i) => ({ ingredient: byIngredient.get(i.ingredient_id)!, netQty: i.net_qty, scope: i.scope })),
    );
    const cost = series ? (seriesCost.get(r.id) ?? null) : view.ok ? view.cost.costPerPortion.toNumber() : null;
    return { id: r.id, name: r.name, cost, qty: qtyByRecipe.get(r.id) ?? 0 };
  });

  // Combos: o custo de cada um sai das marmitas dele (as de escolha, pela média das vendas).
  const recipeCosts = new Map(dishes.map((d) => [d.id, { cost: d.cost }]));
  const feePct = ctx.channels[0]?.fee_pct ?? 0;
  const comboRows = combos.map((c) => {
    const s = summarizeCombo(c, recipeCosts, weights, ctx.settings, feePct);
    return { id: c.id, name: c.name, cost: s.cost > 0 ? s.cost : null, units: s.units, qty: comboQty.get(c.id) ?? 0 };
  });
  const looseUnits = dishes.reduce((n, d) => n + d.qty, 0);

  // Cardápio digital: o faturamento digitado passa a ser só a venda de fora; o total é cardápio + digitado.
  // Mês sem pedidos (anterior à conexão) continua com o digitado como total.
  const connected = await hasMenuConnection(orgId);
  const menuData = connected ? await loadMenuMonth(ctx.unit.id, month) : null;
  const menuStatus = connected ? await loadMenuStatus(orgId) : [];
  await kickStalled(menuStatus); // importação parada? quem abre esta tela a retoma
  const menuOn = usesMenu(connected, menuData?.orders ?? 0);
  // Os cardápios (CardápioWeb e Prefiro) cobram mensalidade fixa, não % por pedido: aqui só entram os impostos e as outras taxas.
  // A mensalidade é um custo fixo e entra em Ajustes → Custos fixos.
  const menuVariablePct = ctx.settings.taxPct + (ctx.settings.otherPct ?? 0);
  const menuView = menuOn
    ? buildMenuMonth({
        products: await loadMenuProducts(orgId),
        sales: menuData!.sales,
        recipes: new Map(dishes.map((d) => [d.id, { cost: d.cost }])),
        combos: new Map(comboRows.map((c) => [c.id, { cost: c.cost, units: c.units }])),
        variablePct: menuVariablePct,
      })
    : null;

  // Venda por fora: vale o que o dono digitou; com quantidades por ficha, o lucro sai do preço que ele cadastrou e do custo da ficha.
  const typedOutside = Number(period?.revenue ?? 0);
  const profit = menuView
    ? menuProfit(menuView, { typedRevenue: typedOutside, dishes: dishes.map((d) => ({ qty: d.qty, price: prices.get(d.id) ?? null, cost: d.cost })), variablePct: menuVariablePct })
    : null;
  const outsideRevenue = profit ? profit.outsideRevenue : typedOutside;
  const revenue = outsideRevenue + (menuOn ? menuData!.revenue : 0);
  const purchases = Number(period?.purchases ?? 0);
  const summary = summarizeMonth({
    revenue,
    purchases,
    sales: [
      ...dishes.map((d) => ({ recipeId: d.id, qty: d.qty, cost: d.cost })),
      ...comboRows.map((c) => ({ recipeId: c.id, qty: c.qty, cost: c.cost, unitsPerSale: c.units })),
      ...(menuView?.lines ?? []).flatMap((l) =>
        l.status === "linked" ? [{ recipeId: "menu", qty: Number(l.qty), cost: l.costPerSale == null ? null : Number(l.costPerSale), unitsPerSale: l.unitsPerSale }] : [],
      ),
    ],
    staff: series
      ? [{ area: "cozinha" as const, monthlySalary: series.average.staffTotal, chargesPct: 0 }]
      : staff.map((m) => ({ area: m.area, monthlySalary: m.monthly_salary, chargesPct: m.charges_pct })),
  });

  const close = closeMonthChecklist({
    month,
    connected: menuOn,
    menuOrders: menuData?.orders ?? 0,
    menuRevenue: menuData?.revenue ?? 0,
    purchases,
    purchasesFromNfe,
    outsideRevenue: typedOutside,
    prevOutsideRevenue: Number(prevPeriod?.revenue ?? 0),
    hasFixedCosts: ctx.fixedTotal > 0,
    recipesWithoutCost: summary.salesWithoutCost,
    soldUnits: summary.soldUnits,
    stockCounted: stockCounted ?? 0,
  });

  const months = lastMonths(now, 6);
  if (!months.includes(month)) months.push(month);
  months.sort().reverse(); // do mais recente para o mais antigo, mesmo quando o mês pedido está fora da lista
  const hasData = revenue > 0 || purchases > 0 || summary.soldUnits > 0;
  const bigGap = summary.deviationPct !== null && Math.abs(summary.deviationPct) >= 0.03;

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Fechar o mês</h1>
        <p className="text-muted">Quanto você gastou no mês, comparado com o que deveria.</p>
      </section>

      <MonthTabs active="fechar" />

      <MonthChips months={months} current={month} basePath="/mes" />

      <h2 className="text-lg font-bold first-letter:uppercase">{monthLabel(month)}</h2>

      <section aria-label="Para fechar o mês" className={`flex flex-col gap-3 rounded-2xl border-2 p-4 ${close.ready ? "border-success/40 bg-success/10" : "border-border bg-surface"}`}>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-bold">{close.ready ? "Tudo pronto para fechar o mês" : "Para fechar o mês"}</h3>
          <span className="tabular text-sm text-muted">
            {close.requiredDone} de {close.required}
          </span>
        </div>
        <ul className="flex flex-col divide-y divide-border">
          {close.items.map((i) => (
            <li key={i.key} className="flex items-start gap-3 py-2.5">
              <span aria-hidden className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i.done ? "bg-success text-primary-foreground" : "bg-border text-muted"}`}>
                {i.done ? "✓" : "•"}
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-semibold">
                  {i.title}
                  {i.optional ? <span className="font-normal text-muted"> (opcional)</span> : null}
                </span>
                <span className="text-muted">{i.detail}</span>
              </span>
              {canWrite && i.href && i.cta ? (
                <Link href={i.href} className="flex min-h-11 shrink-0 items-center text-sm font-semibold text-primary">
                  {i.cta}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
        {hasData ? (
          <a href="#resultado-do-mes" className="tap-area self-start text-sm font-semibold text-primary underline">
            Ver o resultado do mês ↓
          </a>
        ) : null}
      </section>

      {menuOn && menuView && menuData ? <MenuSalesCard orders={menuData.orders} revenue={menuData.revenue} discount={menuData.discount} summary={menuView.summary} unlinkedProducts={menuView.unlinkedProducts} importing={isImporting(menuStatus)} pending={menuStatus.reduce((n, c) => n + c.pending_orders, 0)} /> : null}

      {canWrite ? (
        <section id="contas-do-mes" className="flex scroll-mt-20 flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{menuOn ? "1. Vendas por fora do cardápio e compras do mês" : "1. Faturamento e compras do mês"}</h2>
          <PeriodForm month={month} revenue={typedOutside} purchases={purchases} outside={menuOn} />
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          {canWrite ? "2" : "1"}. {menuOn ? "Marmitas vendidas por fora do cardápio" : "Marmitas vendidas avulsas"} ({formatNumber(looseUnits, 0)})
        </h2>
        {dishes.length === 0 ? (
          <p className="text-sm text-muted">
            Ainda não há fichas. Monte em <Link href="/marmitas" className="tap-area font-semibold text-primary">Marmitas</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-border card px-4">
            {dishes.map((d) => (
              <SalesRow key={`${d.id}-${month}`} month={month} recipe={{ id: d.id, name: d.name, cost: d.cost }} initialQty={d.qty} canWrite={canWrite} />
            ))}
          </ul>
        )}
      </section>

      {comboRows.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{canWrite ? "3" : "2"}. Combos vendidos ({formatNumber(comboRows.reduce((n, c) => n + c.qty, 0), 0)})</h2>
          <ul className="divide-y divide-border card px-4">
            {comboRows.map((c) => (
              <SalesRow key={`${c.id}-${month}`} month={month} recipe={{ id: c.id, name: c.name, cost: c.cost }} initialQty={c.qty} canWrite={canWrite} combo />
            ))}
          </ul>
          <p className="text-xs text-muted">Os combos entram no custo esperado do mês com as marmitas que cada um leva.</p>
        </section>
      ) : null}

      {menuOn && menuView ? <MenuProfitCard summary={menuView.summary} outside={profit!.outside} outsideRevenue={outsideRevenue} outsideFromDishes={profit!.outsideFromDishes} fixedCosts={ctx.fixedTotal} partialMonth={month === now} /> : null}

      {/* resultado depois dos passos de preenchimento */}
      {hasData ? (
        <section id="resultado-do-mes" aria-live="polite" className="flex scroll-mt-20 flex-col gap-3 card p-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">
                Você gastou com insumos
                <Hint>Compras do mês ÷ faturamento. É uma aproximação: o app ainda não controla o estoque, então o que sobrou na prateleira conta como gasto.</Hint>
              </dt>
              <dd className="tabular text-xl font-extrabold">{summary.cmvRealPct !== null ? formatPct(summary.cmvRealPct) : "—"}</dd>
              <dd className="tabular text-xs text-muted">{formatBRL(summary.purchases)} em compras no mês</dd>
            </div>
            <div>
              <dt className="text-muted">
                As fichas dizem que deveria ser
                <Hint>Custo de cada produto (pela ficha, já com a margem de segurança) × quantas você vendeu, dividido pelo faturamento. Se você gastou bem mais que isso, pode ser desperdício, sobra de estoque ou preço de insumo desatualizado.</Hint>
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
                <Hint>Salários mais encargos da sua equipe (cadastrada em Ajustes → Custos fixos), dividido pelo faturamento do mês.</Hint>
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
        <p className="card p-4 text-sm text-muted">
          Informe o faturamento, as compras e quantas unidades vendeu de cada produto. O app mostra se o que você gastou bate com o que deveria.
        </p>
      )}

      {hasData ? <ExportLinks base="/painel/exportar" params={`mes=${month.slice(0, 7)}`} label="Relatório do mês" hint="PDF e Excel com o resultado, as marmitas e os insumos deste mês, prontos para o contador." /> : null}
    </>
  );
}
