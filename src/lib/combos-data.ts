import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadCurrentPrices } from "@/lib/pricing-data";
import { computeRecipe, recipeCostSettings } from "@/lib/recipe-cost";
import { loadIngredients, loadRecipes } from "@/lib/recipes-data";

export type ComboOptionRow = { id: string; group_id: string; recipe_id: string; qty: number | null; unit_price: number | null; position: number };
export type ComboGroupRow = {
  id: string;
  combo_id: string;
  name: string;
  kind: "fixed" | "choice";
  pick_qty: number | null;
  unit_price: number | null;
  position: number;
  options: ComboOptionRow[];
};
export type ComboRow = { id: string; name: string; active: boolean; groups: ComboGroupRow[] };

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Combos da marmitaria com seus grupos e opções (toda consulta filtrada pela marmitaria em uso). */
export async function loadCombos(orgId: string, opts: { active?: boolean } = {}): Promise<ComboRow[]> {
  const supabase = await createClient();
  let q = supabase.from("combos").select("id, name, active").eq("org_id", orgId).order("name");
  if (opts.active !== undefined) q = q.eq("active", opts.active);
  const [{ data: combos }, { data: groups }, { data: options }] = await Promise.all([
    q,
    supabase.from("combo_groups").select("id, combo_id, name, kind, pick_qty, unit_price, position").eq("org_id", orgId).order("position").order("id"),
    supabase.from("combo_group_options").select("id, group_id, recipe_id, qty, unit_price, position").eq("org_id", orgId).order("position").order("id"),
  ]);

  const optionsByGroup = new Map<string, ComboOptionRow[]>();
  for (const o of options ?? []) {
    const list = optionsByGroup.get(o.group_id as string) ?? [];
    list.push({ id: o.id, group_id: o.group_id, recipe_id: o.recipe_id, qty: n(o.qty), unit_price: n(o.unit_price), position: Number(o.position) });
    optionsByGroup.set(o.group_id as string, list);
  }
  const groupsByCombo = new Map<string, ComboGroupRow[]>();
  for (const g of groups ?? []) {
    const list = groupsByCombo.get(g.combo_id as string) ?? [];
    list.push({
      id: g.id,
      combo_id: g.combo_id,
      name: g.name,
      kind: g.kind === "choice" ? "choice" : "fixed",
      pick_qty: n(g.pick_qty),
      unit_price: n(g.unit_price),
      position: Number(g.position),
      options: optionsByGroup.get(g.id as string) ?? [],
    });
    groupsByCombo.set(g.combo_id as string, list);
  }
  return (combos ?? []).map((c) => ({ id: c.id, name: c.name, active: Boolean(c.active), groups: groupsByCombo.get(c.id as string) ?? [] }));
}

export async function loadCombo(orgId: string, id: string): Promise<ComboRow | null> {
  const all = await loadCombos(orgId);
  return all.find((c) => c.id === id) ?? null;
}

export type RecipeCostInfo = { id: string; name: string; cost: number | null; price: number | null };

/** Custo (já com a margem de segurança) e preço avulso de cada ficha ativa, para montar e avaliar combos. */
export async function loadRecipeCosts(orgId: string, unitId: string, safetyMarginPct: number): Promise<RecipeCostInfo[]> {
  void orgId;
  const [ingredients, { recipes, items }, prices] = await Promise.all([loadIngredients(), loadRecipes(), loadCurrentPrices(unitId)]);
  const byIngredient = new Map(ingredients.map((i) => [i.id, i]));
  return recipes.map((r) => {
    const view = computeRecipe(
      recipeCostSettings(r, safetyMarginPct),
      items.filter((i) => i.recipe_id === r.id && byIngredient.has(i.ingredient_id)).map((i) => ({ ingredient: byIngredient.get(i.ingredient_id)!, netQty: i.net_qty, scope: i.scope })),
    );
    return { id: r.id, name: r.name, cost: view.ok ? view.cost.costPerPortion.toNumber() : null, price: prices.get(r.id) ?? null };
  });
}

/** Vendas dos últimos meses informados (até 3) por ficha avulsa: os pesos da média do custo nos grupos de escolha. */
export async function loadSalesWeights(unitId: string): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data: periods } = await supabase.from("periods").select("id").eq("unit_id", unitId).gt("revenue", 0).order("month", { ascending: false }).limit(3);
  const weights = new Map<string, number>();
  if (!periods || periods.length === 0) return weights;
  const { data: sales } = await supabase.from("period_sales").select("recipe_id, qty_sold").in("period_id", periods.map((p) => p.id as string));
  for (const s of sales ?? []) weights.set(s.recipe_id as string, (weights.get(s.recipe_id as string) ?? 0) + Number(s.qty_sold));
  return weights;
}
