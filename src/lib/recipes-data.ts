import "server-only";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Organização do usuário logado (a mais antiga, ver getSession). Sem vínculo = sem dados. */
async function currentOrgId(): Promise<string | null> {
  const session = await getSession();
  return session?.memberships[0]?.org.id ?? null;
}

export type IngredientRecord = {
  id: string;
  name: string;
  kind: "insumo" | "embalagem";
  purchase_unit: string;
  unit_cost: number;
  correction_factor: number;
  /** Peso pronto ÷ peso cru. 1 = não muda de peso ao preparar. */
  cooking_yield: number;
  category: string | null;
  archived_at: string | null;
};

export type RecipeRecord = {
  id: string;
  name: string;
  category: string | null;
  portions: number | null;
  portion_weight: number | null;
  portion_weight_unit: "g" | "kg";
  cooking_loss_pct: number;
  /** serving = quantidades de UMA marmita; batch = receita em lote que rende N porções. */
  mode: "serving" | "batch";
};

export type RecipeItemRecord = { id: string; recipe_id: string; ingredient_id: string; net_qty: number; qty_unit: string | null; scope: "batch" | "portion" };

/** O PostgREST devolve no máximo 1000 linhas por consulta, sem erro. Busca em páginas até acabar. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await page(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/** Insumos (inclusive arquivados: fichas antigas continuam calculando) — RLS limita à organização do usuário. */
export async function loadIngredients(): Promise<IngredientRecord[]> {
  const orgId = await currentOrgId();
  if (!orgId) return [];
  const supabase = await createClient();
  const data = await fetchAll((from, to) =>
    supabase.from("ingredients").select("id, name, category, kind, purchase_unit, unit_cost, correction_factor, cooking_yield, archived_at").eq("org_id", orgId).order("id").range(from, to),
  );
  return data.map((i) => ({ ...i, unit_cost: Number(i.unit_cost), correction_factor: Number(i.correction_factor), cooking_yield: Number(i.cooking_yield) })) as IngredientRecord[];
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function loadRecipe(id: string): Promise<{ recipe: RecipeRecord; items: RecipeItemRecord[] } | null> {
  const orgId = await currentOrgId();
  if (!orgId) return null;
  const supabase = await createClient();
  const [{ data: recipe }, { data: items }] = await Promise.all([
    supabase.from("recipes").select("id, name, category, portions, portion_weight, portion_weight_unit, cooking_loss_pct, mode").eq("id", id).eq("org_id", orgId).eq("active", true).maybeSingle(),
    supabase.from("recipe_items").select("id, recipe_id, ingredient_id, net_qty, qty_unit, scope").eq("recipe_id", id).order("id"),
  ]);
  if (!recipe) return null;
  return {
    recipe: { ...recipe, portions: num(recipe.portions), portion_weight: num(recipe.portion_weight), portion_weight_unit: recipe.portion_weight_unit === "kg" ? "kg" : "g", cooking_loss_pct: Number(recipe.cooking_loss_pct), mode: recipe.mode === "serving" ? "serving" : "batch" },
    items: (items ?? []).map((i) => ({ ...i, net_qty: Number(i.net_qty) })) as RecipeItemRecord[],
  };
}

export async function loadRecipes(): Promise<{ recipes: RecipeRecord[]; items: RecipeItemRecord[] }> {
  const orgId = await currentOrgId();
  if (!orgId) return { recipes: [], items: [] };
  const supabase = await createClient();
  const [{ data: recipes }, items] = await Promise.all([
    supabase.from("recipes").select("id, name, category, portions, portion_weight, portion_weight_unit, cooking_loss_pct, mode").eq("org_id", orgId).eq("active", true).order("name"),
    fetchAll((from, to) => supabase.from("recipe_items").select("id, recipe_id, ingredient_id, net_qty, qty_unit, scope").eq("org_id", orgId).order("id").range(from, to)),
  ]);
  return {
    recipes: (recipes ?? []).map((r) => ({ ...r, portions: num(r.portions), portion_weight: num(r.portion_weight), portion_weight_unit: r.portion_weight_unit === "kg" ? "kg" : "g", cooking_loss_pct: Number(r.cooking_loss_pct), mode: r.mode === "serving" ? "serving" : "batch" })) as RecipeRecord[],
    items: items.map((i) => ({ ...i, net_qty: Number(i.net_qty) })) as RecipeItemRecord[],
  };
}

export async function loadArchivedRecipes(): Promise<{ id: string; name: string }[]> {
  const orgId = await currentOrgId();
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("recipes").select("id, name").eq("org_id", orgId).eq("active", false).order("name");
  return data ?? [];
}
