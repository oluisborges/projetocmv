import "server-only";
import { lastMonths, monthBounds } from "@/lib/month-view";
import { contributionSummary, realMargin, type ClientMonth, type NetworkClient, type RateSet } from "@/lib/network-view";
import { computeReceitas, computeRecipe, recipeCostSettings, type CostIngredient } from "@/lib/recipe-cost";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type NetworkData = {
  month: string;
  /** Meses da evolução, do mais antigo ao mais novo (termina no mês escolhido). */
  seriesMonths: string[];
  /** Faturamento da rede por mês: cardápio e digitado. */
  series: { month: string; menu: number; manual: number; total: number }[];
  clients: NetworkClient[];
};

const PAGE = 1000;

/** O PostgREST devolve no máximo 1000 linhas por consulta, sem erro: busca em páginas até acabar. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await page(from, from + PAGE - 1);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

const n = (v: unknown) => Number(v ?? 0);
const emptyMonth = (): ClientMonth => ({ revenue: 0, orders: 0, menuRevenue: 0, manualRevenue: 0, discount: 0 });
const key = (orgId: string, month: string) => `${orgId}|${month}`;

/**
 * Tudo o que o painel agregado precisa, de todos os clientes. Só chamar depois de `requireAdmin()`.
 * Os totais por mês/cliente vêm de funções do banco que só respondem ao admin; os custos das fichas usam as MESMAS funções de
 * cálculo das telas do cliente (computeRecipe), com os dados de todos os clientes carregados em bloco.
 */
export async function loadNetwork(month: string): Promise<NetworkData> {
  const session = await createClient(); // sessão do admin: as funções agregadas conferem quem pergunta
  const admin = createAdminClient();
  const { start, end } = monthBounds(month);
  const seriesMonths = lastMonths(month, 6).reverse();
  const prevMonth = lastMonths(month, 2)[1];
  const weightsFrom = monthBounds(lastMonths(month, 3)[2]).start;

  const [monthsRes, coverageRes, salesRes, weightsRes, setupRes, orgsRes, connsRes] = await Promise.all([
    session.rpc("admin_network_months", { p_from: seriesMonths[0] }),
    session.rpc("admin_network_coverage", { p_start: start.toISOString(), p_end: end.toISOString() }),
    session.rpc("admin_network_recipe_sales", { p_start: start.toISOString(), p_end: end.toISOString() }),
    session.rpc("admin_network_recipe_sales", { p_start: weightsFrom.toISOString(), p_end: end.toISOString() }),
    session.rpc("admin_network_setup"),
    admin.from("organizations").select("id, name").order("name"),
    admin.from("menu_connections").select("org_id, status"),
  ]);

  const [units, settings, channels, prices, ingredients, recipes, receitas, items] = await Promise.all([
    admin.from("units").select("id, org_id, created_at").order("created_at"),
    admin.from("unit_settings").select("unit_id, org_id, tax_pct, other_pct, safety_margin_pct"),
    admin.from("sales_channels").select("unit_id, fee_pct"),
    fetchAll((from, to) => admin.from("recipe_prices").select("recipe_id, unit_id, current_price").order("recipe_id").range(from, to)),
    fetchAll((from, to) => admin.from("ingredients").select("id, org_id, purchase_unit, unit_cost, correction_factor, cooking_yield").order("id").range(from, to)),
    fetchAll((from, to) => admin.from("recipes").select("id, org_id, portions, portion_weight, portion_weight_unit, cooking_loss_pct, mode").eq("kind", "marmita").eq("active", true).order("id").range(from, to)),
    // Receitas (arroz, estrogonofe…): entram como itens por grama, com o custo do lote ÷ peso pronto.
    fetchAll((from, to) => admin.from("recipes").select("id, org_id, portion_weight").eq("kind", "receita").order("id").range(from, to)),
    fetchAll((from, to) => admin.from("recipe_items").select("recipe_id, ingredient_id, receita_id, net_qty, scope").order("id").range(from, to)),
  ]);

  // ---- vendas por cliente e mês
  const byMonth = new Map<string, ClientMonth>();
  for (const r of (monthsRes.data as { org_id: string; month: string; menu_orders: number; menu_revenue: number; menu_discount: number; manual_revenue: number }[] | null) ?? []) {
    byMonth.set(key(r.org_id, r.month), {
      revenue: n(r.menu_revenue) + n(r.manual_revenue),
      orders: n(r.menu_orders),
      menuRevenue: n(r.menu_revenue),
      manualRevenue: n(r.manual_revenue),
      discount: n(r.menu_discount),
    });
  }

  const coverage = new Map(
    ((coverageRes.data as { org_id: string; total_net: number; linked_net: number | null; unlinked_products: number }[] | null) ?? []).map((c) => [
      c.org_id,
      { share: n(c.total_net) > 0 ? n(c.linked_net) / n(c.total_net) : null, unlinked: n(c.unlinked_products) },
    ]),
  );
  const setup = new Map(
    ((setupRes.data as { org_id: string; ingredients: number; recipes: number; priced_recipes: number; fixed_costs: number; staff: number; settings_done: boolean }[] | null) ?? []).map((s) => [
      s.org_id,
      { ingredients: n(s.ingredients), recipes: n(s.recipes), pricedRecipes: n(s.priced_recipes), fixedCosts: n(s.fixed_costs), staff: n(s.staff), settingsDone: Boolean(s.settings_done) },
    ]),
  );
  const salesByOrg = groupSales((salesRes.data as RecipeSalesRow[] | null) ?? []);
  const weightsByOrg = groupSales((weightsRes.data as RecipeSalesRow[] | null) ?? []);
  const connected = new Set(((connsRes.data as { org_id: string; status: string }[] | null) ?? []).filter((c) => c.status === "connected").map((c) => c.org_id));

  // ---- custos das fichas (mesmo cálculo das telas do cliente)
  const firstUnit = new Map<string, string>(); // org -> primeira unidade
  for (const u of (units.data as { id: string; org_id: string }[] | null) ?? []) if (!firstUnit.has(u.org_id)) firstUnit.set(u.org_id, u.id);
  const settingsByUnit = new Map(((settings.data as { unit_id: string; tax_pct: number; other_pct: number; safety_margin_pct: number }[] | null) ?? []).map((s) => [s.unit_id, s]));
  const cheapestFee = new Map<string, number>();
  for (const c of (channels.data as { unit_id: string; fee_pct: number }[] | null) ?? []) cheapestFee.set(c.unit_id, Math.min(cheapestFee.get(c.unit_id) ?? Infinity, n(c.fee_pct)));
  const priceOf = new Map(prices.map((p) => [`${p.unit_id}|${p.recipe_id}`, n(p.current_price)]));
  const ingredientsById = new Map<string, CostIngredient & { org_id: string }>(
    ingredients.map((i) => [i.id as string, { org_id: i.org_id as string, purchase_unit: i.purchase_unit as string, unit_cost: n(i.unit_cost), correction_factor: n(i.correction_factor), cooking_yield: n(i.cooking_yield) }]),
  );
  const receitaCosts = computeReceitas(
    receitas.map((r) => ({ id: r.id as string, portion_weight: r.portion_weight === null ? null : n(r.portion_weight) })),
    items.map((i) => ({ recipe_id: i.recipe_id as string, ingredient_id: (i.ingredient_id as string | null) ?? null, net_qty: n(i.net_qty) })),
    ingredientsById,
  );
  for (const r of receitas) {
    const c = receitaCosts.get(r.id as string);
    ingredientsById.set(r.id as string, { org_id: r.org_id as string, purchase_unit: "g", unit_cost: c?.costPerGram ?? 0, correction_factor: 1, cooking_yield: 1 });
  }
  const itemsByRecipe = new Map<string, { ingredient_id: string; net_qty: number; scope: "batch" | "portion" }[]>();
  for (const it of items) {
    const list = itemsByRecipe.get(it.recipe_id as string) ?? [];
    list.push({ ingredient_id: ((it.ingredient_id ?? it.receita_id) as string), net_qty: n(it.net_qty), scope: it.scope === "portion" ? "portion" : "batch" });
    itemsByRecipe.set(it.recipe_id as string, list);
  }
  const recipesByOrg = new Map<string, typeof recipes>();
  for (const r of recipes) recipesByOrg.set(r.org_id as string, [...(recipesByOrg.get(r.org_id as string) ?? []), r]);

  const clients: NetworkClient[] = ((orgsRes.data as { id: string; name: string }[] | null) ?? []).map((org) => {
    const unitId = firstUnit.get(org.id);
    const st = unitId ? settingsByUnit.get(unitId) : undefined;
    const rates: RateSet = { taxPct: n(st?.tax_pct), feePct: unitId ? (cheapestFee.get(unitId) ?? 0) : 0, otherPct: n(st?.other_pct) };

    const costed = (recipesByOrg.get(org.id) ?? []).map((r) => {
      const view = computeRecipe(
        recipeCostSettings(
          {
            portions: r.portions === null ? null : n(r.portions),
            portion_weight: r.portion_weight === null ? null : n(r.portion_weight),
            cooking_loss_pct: n(r.cooking_loss_pct),
            mode: r.mode === "serving" ? "serving" : "batch",
          },
          st ? n(st.safety_margin_pct) : 0.1,
        ),
        (itemsByRecipe.get(r.id as string) ?? []).flatMap((it) => {
          const ing = ingredientsById.get(it.ingredient_id);
          return ing ? [{ ingredient: ing, netQty: it.net_qty, scope: it.scope }] : [];
        }),
      );
      return { id: r.id as string, cost: view.ok ? view.cost.costPerPortion.toNumber() : null, price: unitId ? (priceOf.get(`${unitId}|${r.id}`) ?? null) : null };
    });

    const weights = new Map((weightsByOrg.get(org.id) ?? []).map((s) => [s.recipeId, s.units]));
    const costs = new Map(costed.map((c) => [c.id, c.cost]));

    return {
      id: org.id,
      name: org.name,
      hasMenu: connected.has(org.id),
      month: byMonth.get(key(org.id, month)) ?? emptyMonth(),
      prev: byMonth.get(key(org.id, prevMonth)) ?? emptyMonth(),
      coverage: coverage.get(org.id)?.share ?? null,
      unlinkedProducts: coverage.get(org.id)?.unlinked ?? 0,
      margin: {
        avgContributionPct: contributionSummary(costed, rates, weights),
        products: costed.length,
        priced: costed.filter((c) => c.cost !== null && (c.price ?? 0) > 0).length,
        incomplete: costed.filter((c) => c.cost === null).length,
        realPct: realMargin(salesByOrg.get(org.id) ?? [], costs, rates),
      },
      setup: setup.get(org.id) ?? { ingredients: 0, recipes: 0, pricedRecipes: 0, fixedCosts: 0, staff: 0, settingsDone: false },
    };
  });

  const series = seriesMonths.map((m) => {
    let menu = 0;
    let manual = 0;
    for (const c of clients) {
      const v = byMonth.get(key(c.id, m));
      if (v) {
        menu += v.menuRevenue;
        manual += v.manualRevenue;
      }
    }
    return { month: m, menu, manual, total: menu + manual };
  });

  return { month, seriesMonths, series, clients };
}

type RecipeSalesRow = { org_id: string; recipe_id: string; units: number | string; net: number | string };

function groupSales(rows: RecipeSalesRow[]): Map<string, { recipeId: string; units: number; net: number }[]> {
  const out = new Map<string, { recipeId: string; units: number; net: number }[]>();
  for (const r of rows) out.set(r.org_id, [...(out.get(r.org_id) ?? []), { recipeId: r.recipe_id, units: n(r.units), net: n(r.net) }]);
  return out;
}

