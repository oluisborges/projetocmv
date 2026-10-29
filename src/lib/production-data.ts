import "server-only";
import { baseUnitOf, finishedBalance, isPurchaseUnit, stockBalance, type BaseUnit, type Movement } from "@/lib/calc";
import { hasMenuConnection, loadMenuRecipeSales } from "@/lib/menu-data";
import { loadPricingContext } from "@/lib/pricing-data";
import { lastFullWeeks, weekBounds } from "@/lib/week";
import { computeRecipe, recipeCostSettings, recipeUsage } from "@/lib/recipe-cost";
import { loadIngredients, loadReceitaBlueprints, loadRecipes } from "@/lib/recipes-data";
import { createClient } from "@/lib/supabase/server";

export type ProdIngredient = {
  name: string;
  kind: "insumo" | "embalagem" | "receita";
  baseUnit: BaseUnit;
  /** Unidade em que o dono compra e digita (kg, g, l, ml, un). */
  purchaseUnit: string;
  /** R$ por unidade-base (g, ml, un). */
  unitCost: number;
  /** Quanto vem em uma embalagem de compra, na unidade-base (5 kg = 5000). `null` se não faz sentido (receita). */
  packSize: number | null;
  /** Texto da embalagem, para a lista de compras ("pacote de 5 kg"). */
  packLabel: string | null;
  supplier: string | null;
};

export type ProdRecipe = {
  id: string;
  name: string;
  /** Custo de uma marmita (com a margem de segurança), como nas outras telas. */
  costPerPortion: number;
  /** O que UMA marmita gasta, por id de insumo (ou de receita, em gramas prontos), na unidade-base. */
  usage: Record<string, number>;
};

export type ProdBalance = { balance: number; known: boolean; lastCountAt: string | null };

export type ProductionBase = {
  unitId: string;
  recipes: ProdRecipe[];
  /** Marmitas com a ficha incompleta (sem ingredientes ou porções): não entram na conta. */
  incomplete: { id: string; name: string }[];
  ingredients: Record<string, ProdIngredient>;
  receitas: Record<string, { name: string; base: "g" | "ml" | "un"; readyGrams: number; parts: { ingredientId: string; grossPerGram: number }[] }>;
  /** Saldo dos insumos (do livro de estoque). Insumo sem movimento não aparece. */
  stock: Record<string, ProdBalance>;
  /** Saldo das marmitas prontas (congeladas): contado + produzido − vendido no cardápio digital. */
  finished: Record<string, ProdBalance>;
  hasMenu: boolean;
};

type MovementRow = { ingredient_id: string | null; recipe_id: string | null; kind: string; qty_base: unknown; occurred_at: string };

/** O PostgREST devolve no máximo 1000 linhas por consulta: busca em páginas até acabar. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await page(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

const toMovement = (m: MovementRow): Movement => ({ kind: m.kind as Movement["kind"], qty: Number(m.qty_base), at: m.occurred_at });

/** Saldo de cada insumo e de cada marmita pronta a partir do livro de movimentos da unidade. */
export async function loadStockBalances(orgId: string, unitId: string): Promise<{ stock: Record<string, ProdBalance>; finished: Record<string, ProdBalance> }> {
  const supabase = await createClient();
  const rows = await fetchAll<MovementRow>((from, to) =>
    supabase.from("stock_movements").select("ingredient_id, recipe_id, kind, qty_base, occurred_at").eq("org_id", orgId).eq("unit_id", unitId).order("occurred_at").order("id").range(from, to),
  );
  const byIngredient = new Map<string, Movement[]>();
  const byRecipe = new Map<string, Movement[]>();
  for (const r of rows) {
    const map = r.ingredient_id ? byIngredient : byRecipe;
    const id = (r.ingredient_id ?? r.recipe_id) as string;
    map.set(id, [...(map.get(id) ?? []), toMovement(r)]);
  }

  const stock: Record<string, ProdBalance> = {};
  for (const [id, list] of byIngredient) stock[id] = stockBalance(list);

  // Marmitas prontas: o que o cardápio vendeu desde a última contagem (ou o primeiro movimento) sai do saldo.
  const finished: Record<string, ProdBalance> = {};
  if (byRecipe.size > 0) {
    const connected = await hasMenuConnection(orgId);
    const soldCache = new Map<string, Map<string, number>>();
    const now = new Date();
    for (const [id, list] of byRecipe) {
      const base = stockBalance(list);
      const since = base.lastCountAt ?? list.map((m) => m.at).sort()[0];
      let sold = 0;
      if (connected && since) {
        const key = since.slice(0, 10);
        if (!soldCache.has(key)) {
          const sales = await loadMenuRecipeSales(unitId, new Date(since), now);
          soldCache.set(key, new Map([...sales].map(([rid, s]) => [rid, s.units])));
        }
        sold = soldCache.get(key)?.get(id) ?? 0;
      }
      finished[id] = finishedBalance(list, sold);
    }
  }
  return { stock, finished };
}

/** Tudo que a calculadora, o estoque e o plano da semana precisam para fazer as contas da marmitaria. */
export async function loadProductionBase(orgId: string, canWrite: boolean): Promise<ProductionBase | null> {
  const ctx = await loadPricingContext(orgId, canWrite);
  if (!ctx) return null;
  const supabase = await createClient();
  const [ingredientRecords, { recipes, items }, suppliers, hasMenu] = await Promise.all([
    loadIngredients(),
    loadRecipes(),
    supabase.from("suppliers").select("id, name").eq("org_id", orgId),
    hasMenuConnection(orgId),
  ]);
  const [blueprints, balances] = await Promise.all([loadReceitaBlueprints(ingredientRecords), loadStockBalances(orgId, ctx.unit.id)]);
  const supplierName = new Map((suppliers.data ?? []).map((s) => [s.id as string, s.name as string]));
  const byId = new Map(ingredientRecords.map((i) => [i.id, i]));

  const ingredients: Record<string, ProdIngredient> = {};
  for (const i of ingredientRecords) {
    if (i.archived_at && i.kind !== "receita") continue;
    const baseUnit: BaseUnit = isPurchaseUnit(i.purchase_unit) ? baseUnitOf(i.purchase_unit) : "g";
    const factor = i.purchase_unit === "kg" || i.purchase_unit === "l" ? 1000 : 1;
    const isReceita = i.kind === "receita";
    ingredients[i.id] = {
      name: i.name,
      kind: i.kind,
      baseUnit,
      purchaseUnit: i.purchase_unit,
      unitCost: i.unit_cost,
      packSize: isReceita ? null : i.purchase_qty * factor,
      packLabel: isReceita ? null : `${i.purchase_qty * factor >= 1000 && baseUnit !== "un" ? `${String(Number((i.purchase_qty * factor / 1000).toFixed(3))).replace(".", ",")} ${baseUnit === "g" ? "kg" : "l"}` : `${String(Number((i.purchase_qty * factor).toFixed(3))).replace(".", ",")} ${baseUnit}`}`,
      supplier: i.supplier_id ? (supplierName.get(i.supplier_id) ?? null) : null,
    };
  }

  const ready: ProdRecipe[] = [];
  const incomplete: { id: string; name: string }[] = [];
  for (const r of recipes) {
    const recipeItems = items
      .filter((i) => i.recipe_id === r.id && byId.has(i.ingredient_id))
      .map((i) => ({ ingredientId: i.ingredient_id, ingredient: byId.get(i.ingredient_id)!, netQty: i.net_qty, scope: i.scope }));
    const view = computeRecipe(recipeCostSettings(r, ctx.settings.safetyMarginPct), recipeItems);
    // Sem margem de segurança: ela cobre perda no custo, não é insumo que sai da prateleira.
    const usage = recipeUsage(recipeCostSettings(r, 0), recipeItems);
    if (!view.ok || !usage) {
      incomplete.push({ id: r.id, name: r.name });
      continue;
    }
    ready.push({ id: r.id, name: r.name, costPerPortion: view.cost.costPerPortion.toNumber(), usage: Object.fromEntries(usage) });
  }
  ready.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  incomplete.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return {
    unitId: ctx.unit.id,
    recipes: ready,
    incomplete,
    ingredients,
    receitas: Object.fromEntries([...blueprints].map(([id, b]) => [id, { name: b.name, base: b.base, readyGrams: b.readyGrams, parts: b.parts }])),
    stock: balances.stock,
    finished: balances.finished,
    hasMenu,
  };
}

export type WeeklySales = {
  /** Semanas (segundas-feiras), da mais antiga para a mais recente. */
  weeks: string[];
  /** Por marmita: unidades vendidas em cada uma dessas semanas. */
  byRecipe: Record<string, number[]>;
  /** `menu` = vendas reais do cardápio digital; `manual` = estimado pela média mensal digitada; `none` = sem vendas. */
  source: "menu" | "manual" | "none";
};

/** Vendas por semana (as últimas `count` semanas completas) de cada marmita. */
export async function loadWeeklySales(orgId: string, unitId: string, hasMenu: boolean, now: Date = new Date(), count = 6): Promise<WeeklySales> {
  const weeks = lastFullWeeks(now, count);
  if (hasMenu) {
    const perWeek = await Promise.all(weeks.map((w) => loadMenuRecipeSales(unitId, weekBounds(w).start, weekBounds(w).end)));
    const byRecipe: Record<string, number[]> = {};
    perWeek.forEach((sales, i) => {
      for (const [recipeId, s] of sales) {
        byRecipe[recipeId] ??= Array(weeks.length).fill(0);
        byRecipe[recipeId][i] = s.units;
      }
    });
    if (Object.keys(byRecipe).length > 0) return { weeks, byRecipe, source: "menu" };
  }

  // Sem cardápio digital (ou ainda sem vendas nele): média dos últimos meses informados, dividida em semanas.
  const supabase = await createClient();
  const { data: periods } = await supabase.from("periods").select("id").eq("org_id", orgId).eq("unit_id", unitId).order("month", { ascending: false }).limit(3);
  if (!periods?.length) return { weeks, byRecipe: {}, source: "none" };
  const { data: rows } = await supabase.from("period_sales").select("recipe_id, qty_sold").eq("org_id", orgId).in("period_id", periods.map((p) => p.id as string));
  const total = new Map<string, number>();
  for (const r of rows ?? []) total.set(r.recipe_id as string, (total.get(r.recipe_id as string) ?? 0) + Number(r.qty_sold));
  if (total.size === 0) return { weeks, byRecipe: {}, source: "none" };
  const perWeek = (months: number) => (v: number) => v / months / 4.345;
  const weekly = perWeek(periods.length);
  return { weeks, byRecipe: Object.fromEntries([...total].map(([id, v]) => [id, Array(weeks.length).fill(weekly(v))])), source: "manual" };
}

export type PlanItem = { recipeId: string; suggested: number | null; planned: number; produced: number | null };

/** Uma produção: um conjunto de marmitas que o dono decidiu fazer (pode haver várias por semana). */
export type Production = {
  id: string;
  name: string | null;
  /** Dia em que vai produzir. */
  plannedFor: string;
  weekStart: string;
  /** `draft` = em montagem; `produced` = feita. (`confirmed` não é mais usado pela tela.) */
  status: "draft" | "confirmed" | "produced";
  producedAt: string | null;
  createdAt: string;
  items: PlanItem[];
};

type PlanRow = { id: string; name: string | null; planned_for: string; week_start: string; status: string; produced_at: string | null; created_at: string };
type ItemRow = { plan_id: string; recipe_id: string; suggested_qty: number | null; planned_qty: number; produced_qty: number | null };

const toProduction = (p: PlanRow, items: ItemRow[]): Production => ({
  id: p.id,
  name: p.name,
  plannedFor: p.planned_for,
  weekStart: p.week_start,
  status: p.status as Production["status"],
  producedAt: p.produced_at,
  createdAt: p.created_at,
  items: items.filter((i) => i.plan_id === p.id).map((i) => ({ recipeId: i.recipe_id, suggested: i.suggested_qty, planned: i.planned_qty, produced: i.produced_qty })),
});

const PLAN_COLUMNS = "id, name, planned_for, week_start, status, produced_at, created_at";
const ITEM_COLUMNS = "plan_id, recipe_id, suggested_qty, planned_qty, produced_qty";

/** As produções da unidade, da mais nova para a mais antiga. */
export async function loadProductions(orgId: string, unitId: string, limit = 30): Promise<Production[]> {
  const supabase = await createClient();
  const { data: plans } = await supabase.from("production_plans").select(PLAN_COLUMNS).eq("org_id", orgId).eq("unit_id", unitId).order("planned_for", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
  if (!plans?.length) return [];
  const { data: items } = await supabase.from("production_plan_items").select(ITEM_COLUMNS).eq("org_id", orgId).in("plan_id", plans.map((p) => p.id as string));
  return plans.map((p) => toProduction(p as PlanRow, (items ?? []) as ItemRow[]));
}

export async function loadProduction(orgId: string, unitId: string, id: string): Promise<Production | null> {
  const supabase = await createClient();
  const { data: plan } = await supabase.from("production_plans").select(PLAN_COLUMNS).eq("org_id", orgId).eq("unit_id", unitId).eq("id", id).maybeSingle();
  if (!plan) return null;
  const { data: items } = await supabase.from("production_plan_items").select(ITEM_COLUMNS).eq("org_id", orgId).eq("plan_id", id);
  return toProduction(plan as PlanRow, (items ?? []) as ItemRow[]);
}

/** O que as OUTRAS produções da mesma semana já têm planejado por marmita (para a sugestão não pedir em dobro). */
export async function loadWeekPlanned(orgId: string, unitId: string, weekStart: string, excludeId?: string): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data: plans } = await supabase.from("production_plans").select("id").eq("org_id", orgId).eq("unit_id", unitId).eq("week_start", weekStart);
  const ids = (plans ?? []).map((p) => p.id as string).filter((id) => id !== excludeId);
  if (ids.length === 0) return {};
  const { data: items } = await supabase.from("production_plan_items").select("recipe_id, planned_qty").eq("org_id", orgId).in("plan_id", ids);
  const out: Record<string, number> = {};
  for (const i of items ?? []) out[i.recipe_id as string] = (out[i.recipe_id as string] ?? 0) + Number(i.planned_qty);
  return out;
}

/** O que já foi marcado como comprado nesta produção (insumo -> quantidade que entrou no estoque, na unidade-base). */
export async function loadPlanPurchases(orgId: string, planId: string): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("stock_movements").select("ingredient_id, qty_base").eq("org_id", orgId).eq("plan_id", planId).eq("kind", "purchase");
  const out: Record<string, number> = {};
  for (const r of data ?? []) if (r.ingredient_id) out[r.ingredient_id as string] = (out[r.ingredient_id as string] ?? 0) + Number(r.qty_base);
  return out;
}
