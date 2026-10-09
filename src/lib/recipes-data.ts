import "server-only";
import { createClient } from "@/lib/supabase/server";

export type IngredientRecord = {
  id: string;
  name: string;
  kind: "insumo" | "embalagem";
  purchase_unit: string;
  unit_cost: number;
  correction_factor: number;
  archived_at: string | null;
};

export type RecipeRecord = {
  id: string;
  name: string;
  category: string | null;
  portions: number | null;
  portion_weight: number | null;
  cooking_loss_pct: number;
};

export type RecipeItemRecord = { id: string; recipe_id: string; ingredient_id: string; net_qty: number; scope: "batch" | "portion" };

/** Insumos (inclusive arquivados: fichas antigas continuam calculando) — RLS limita à organização do usuário. */
export async function loadIngredients(): Promise<IngredientRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("ingredients").select("id, name, kind, purchase_unit, unit_cost, correction_factor, archived_at");
  return (data ?? []).map((i) => ({ ...i, unit_cost: Number(i.unit_cost), correction_factor: Number(i.correction_factor) })) as IngredientRecord[];
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function loadRecipe(id: string): Promise<{ recipe: RecipeRecord; items: RecipeItemRecord[] } | null> {
  const supabase = await createClient();
  const [{ data: recipe }, { data: items }] = await Promise.all([
    supabase.from("recipes").select("id, name, category, portions, portion_weight, cooking_loss_pct").eq("id", id).eq("active", true).maybeSingle(),
    supabase.from("recipe_items").select("id, recipe_id, ingredient_id, net_qty, scope").eq("recipe_id", id).order("id"),
  ]);
  if (!recipe) return null;
  return {
    recipe: { ...recipe, portions: num(recipe.portions), portion_weight: num(recipe.portion_weight), cooking_loss_pct: Number(recipe.cooking_loss_pct) },
    items: (items ?? []).map((i) => ({ ...i, net_qty: Number(i.net_qty) })) as RecipeItemRecord[],
  };
}

export async function loadRecipes(): Promise<{ recipes: RecipeRecord[]; items: RecipeItemRecord[] }> {
  const supabase = await createClient();
  const [{ data: recipes }, { data: items }] = await Promise.all([
    supabase.from("recipes").select("id, name, category, portions, portion_weight, cooking_loss_pct").eq("active", true).order("name"),
    supabase.from("recipe_items").select("id, recipe_id, ingredient_id, net_qty, scope"),
  ]);
  return {
    recipes: (recipes ?? []).map((r) => ({ ...r, portions: num(r.portions), portion_weight: num(r.portion_weight), cooking_loss_pct: Number(r.cooking_loss_pct) })) as RecipeRecord[],
    items: (items ?? []).map((i) => ({ ...i, net_qty: Number(i.net_qty) })) as RecipeItemRecord[],
  };
}
