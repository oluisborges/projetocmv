import "server-only";
import { getActiveOrg } from "@/lib/auth";
import { computeReceitas } from "@/lib/recipe-cost";
import { createClient } from "@/lib/supabase/server";

/** Marmitaria em uso (do vínculo do usuário ou, para admin, a escolhida em "ver como"). Sem ela = sem dados. */
async function currentOrgId(): Promise<string | null> {
  return (await getActiveOrg())?.orgId ?? null;
}

export type IngredientRecord = {
  id: string;
  name: string;
  /** "receita": preparo em lote (arroz, estrogonofe) que a marmita usa por grama; não é um insumo comprado. */
  kind: "insumo" | "embalagem" | "receita";
  purchase_unit: string;
  unit_cost: number;
  correction_factor: number;
  /** Peso pronto ÷ peso cru. 1 = não muda de peso ao preparar. */
  cooking_yield: number;
  category: string | null;
  archived_at: string | null;
  /** Quanto vem na compra e quanto se paga por isso (para editar o preço de dentro da ficha). */
  purchase_qty: number;
  purchase_price: number;
};

export type RecipeRecord = {
  id: string;
  kind: "marmita" | "receita";
  name: string;
  category: string | null;
  portions: number | null;
  portion_weight: number | null;
  portion_weight_unit: "g" | "kg";
  cooking_loss_pct: number;
  /** serving = quantidades de UMA unidade; batch = receita em lote que rende N porções. */
  mode: "serving" | "batch";
  /** Só vêm na ficha aberta (loadRecipe). */
  code?: string | null;
  portion_note?: string | null;
  updated_at?: string;
};

/** `ingredient_id` é o insumo OU a receita usada (os dois nunca se repetem, então a marmita trata igual); `is_receita` diz qual dos dois. */
export type RecipeItemRecord = { id: string; recipe_id: string; ingredient_id: string; is_receita: boolean; net_qty: number; qty_unit: string | null; scope: "batch" | "portion" };

type ItemRow = { id: string; recipe_id: string; ingredient_id: string | null; receita_id: string | null; net_qty: unknown; qty_unit: string | null; scope: string };
const toItem = (i: ItemRow): RecipeItemRecord => ({
  id: i.id,
  recipe_id: i.recipe_id,
  ingredient_id: (i.ingredient_id ?? i.receita_id) as string,
  is_receita: i.receita_id !== null,
  net_qty: Number(i.net_qty),
  qty_unit: i.qty_unit,
  scope: i.scope === "portion" ? "portion" : "batch",
});
const ITEM_COLUMNS = "id, recipe_id, ingredient_id, receita_id, net_qty, qty_unit, scope";

/** O PostgREST devolve no máximo 1000 linhas por consulta, sem erro. Busca em páginas até acabar. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await page(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/** Insumos (inclusive arquivados: fichas antigas continuam calculando) — RLS limita à organização do usuário. Junto vêm as Receitas, como itens "virtuais" com o custo por grama. */
export async function loadIngredients(): Promise<IngredientRecord[]> {
  const orgId = await currentOrgId();
  if (!orgId) return [];
  const supabase = await createClient();
  const [data, receitas] = await Promise.all([
    fetchAll((from, to) =>
      supabase.from("ingredients").select("id, name, category, kind, purchase_unit, purchase_qty, purchase_price, unit_cost, correction_factor, cooking_yield, archived_at").eq("org_id", orgId).order("id").range(from, to),
    ),
    loadReceitaRows(orgId),
  ]);
  const real = data.map((i) => ({ ...i, unit_cost: Number(i.unit_cost), correction_factor: Number(i.correction_factor), cooking_yield: Number(i.cooking_yield), purchase_qty: Number(i.purchase_qty), purchase_price: Number(i.purchase_price) })) as IngredientRecord[];
  return [...real, ...receitaIngredients(receitas, new Map(real.map((i) => [i.id, i])))];
}

type ReceitaRow = { id: string; name: string; portion_weight: number | null; active: boolean; items: { recipe_id: string; ingredient_id: string | null; net_qty: number }[] };

/** Receitas da marmitaria (inclusive arquivadas: marmitas que já usam continuam calculando) com os ingredientes de cada uma. */
async function loadReceitaRows(orgId: string): Promise<ReceitaRow[]> {
  const supabase = await createClient();
  const { data: recipes } = await supabase.from("recipes").select("id, name, portion_weight, active").eq("org_id", orgId).eq("kind", "receita");
  if (!recipes?.length) return [];
  const rows = await fetchAll((from, to) =>
    supabase.from("recipe_items").select("recipe_id, ingredient_id, net_qty").eq("org_id", orgId).in("recipe_id", recipes.map((r) => r.id)).order("id").range(from, to),
  );
  const items = rows.map((i) => ({ recipe_id: i.recipe_id as string, ingredient_id: i.ingredient_id as string | null, net_qty: Number(i.net_qty) }));
  return recipes.map((r) => ({ id: r.id as string, name: r.name as string, portion_weight: num(r.portion_weight), active: Boolean(r.active), items: items.filter((i) => i.recipe_id === r.id) }));
}

function receitaIngredients(receitas: ReceitaRow[], byId: Map<string, IngredientRecord>): IngredientRecord[] {
  const costs = computeReceitas(receitas, receitas.flatMap((r) => r.items), byId);
  return receitas.map((r) => {
    const c = costs.get(r.id);
    return {
      id: r.id,
      name: r.name,
      kind: "receita" as const,
      purchase_unit: "g",
      unit_cost: c?.costPerGram ?? 0,
      correction_factor: 1,
      cooking_yield: 1,
      category: "Receita",
      archived_at: r.active ? null : "archived",
      // Para exibir: "lote de X g por R$ Y" (a edição de preço não vale para receita).
      purchase_qty: c?.readyWeightGrams ?? 1,
      purchase_price: c?.batchCost ?? 0,
    };
  });
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function loadRecipe(id: string): Promise<{ recipe: RecipeRecord; items: RecipeItemRecord[] } | null> {
  const orgId = await currentOrgId();
  if (!orgId) return null;
  const supabase = await createClient();
  const [{ data: recipe }, { data: items }] = await Promise.all([
    supabase.from("recipes").select("id, kind, name, category, portions, portion_weight, portion_weight_unit, cooking_loss_pct, mode, code, portion_note, updated_at").eq("id", id).eq("org_id", orgId).eq("active", true).maybeSingle(),
    supabase.from("recipe_items").select(ITEM_COLUMNS).eq("recipe_id", id).eq("org_id", orgId).order("id"),
  ]);
  if (!recipe) return null;
  return { recipe: toRecipe(recipe), items: (items ?? []).map((i) => toItem(i as ItemRow)) };
}

const toRecipe = (r: Record<string, unknown>): RecipeRecord =>
  ({
    ...r,
    kind: r.kind === "receita" ? "receita" : "marmita",
    portions: num(r.portions),
    portion_weight: num(r.portion_weight),
    portion_weight_unit: r.portion_weight_unit === "kg" ? "kg" : "g",
    cooking_loss_pct: Number(r.cooking_loss_pct),
    mode: r.mode === "serving" ? "serving" : "batch",
  }) as RecipeRecord;

/** Marmitas ativas e os itens delas (as Receitas ficam de fora: têm a própria lista em `loadReceitas`). */
export async function loadRecipes(): Promise<{ recipes: RecipeRecord[]; items: RecipeItemRecord[] }> {
  const orgId = await currentOrgId();
  if (!orgId) return { recipes: [], items: [] };
  const supabase = await createClient();
  const [{ data: recipes }, items] = await Promise.all([
    supabase.from("recipes").select("id, kind, name, category, portions, portion_weight, portion_weight_unit, cooking_loss_pct, mode").eq("org_id", orgId).eq("kind", "marmita").eq("active", true).order("name"),
    fetchAll((from, to) => supabase.from("recipe_items").select(ITEM_COLUMNS).eq("org_id", orgId).order("id").range(from, to)),
  ]);
  // Os itens das receitas (que também moram em recipe_items) ficam de fora: aqui só os das marmitas.
  const ids = new Set((recipes ?? []).map((r) => r.id as string));
  return {
    recipes: (recipes ?? []).map((r) => toRecipe(r)),
    items: items.filter((i) => ids.has(i.recipe_id as string)).map((i) => toItem(i as ItemRow)),
  };
}

export type ReceitaListItem = { id: string; name: string; readyWeightGrams: number | null; batchCost: number | null; costPerKg: number | null; ingredientCount: number; usedIn: number };

/** Receitas ativas com custo do lote, custo por kg e em quantas marmitas são usadas. */
export async function loadReceitas(): Promise<ReceitaListItem[]> {
  const orgId = await currentOrgId();
  if (!orgId) return [];
  const supabase = await createClient();
  const [rows, ingredients, used] = await Promise.all([
    loadReceitaRows(orgId),
    fetchAll((from, to) => supabase.from("ingredients").select("id, unit_cost, correction_factor, purchase_unit").eq("org_id", orgId).order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("recipe_items").select("recipe_id, receita_id").eq("org_id", orgId).not("receita_id", "is", null).order("id").range(from, to)),
  ]);
  const byId = new Map(ingredients.map((i) => [i.id as string, { unit_cost: Number(i.unit_cost), correction_factor: Number(i.correction_factor), purchase_unit: i.purchase_unit as string }]));
  const costs = computeReceitas(rows, rows.flatMap((r) => r.items), byId);
  return rows
    .filter((r) => r.active)
    .map((r) => {
      const c = costs.get(r.id);
      return {
        id: r.id,
        name: r.name,
        readyWeightGrams: r.portion_weight,
        batchCost: c?.batchCost ?? null,
        costPerKg: c ? c.costPerGram * 1000 : null,
        ingredientCount: r.items.length,
        usedIn: new Set(used.filter((u) => u.receita_id === r.id).map((u) => u.recipe_id as string)).size,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function loadArchivedRecipes(kind: "marmita" | "receita" = "marmita"): Promise<{ id: string; name: string }[]> {
  const orgId = await currentOrgId();
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("recipes").select("id, name").eq("org_id", orgId).eq("kind", kind).eq("active", false).order("name");
  return data ?? [];
}

/**
 * De que insumos é feita cada Receita, por grama pronto: quanto de cada insumo COMPRADO (já com fator de correção) sai em 1 g da receita.
 * Serve para o estoque, que precisa saber que 120 g de arroz pronto gastaram arroz cru, sal e cebola de verdade.
 */
export async function loadReceitaUsage(ingredients: IngredientRecord[]): Promise<Map<string, { ingredientId: string; grossPerGram: number }[]>> {
  const orgId = await currentOrgId();
  const out = new Map<string, { ingredientId: string; grossPerGram: number }[]>();
  if (!orgId) return out;
  const fc = new Map(ingredients.map((i) => [i.id, i.correction_factor]));
  for (const r of await loadReceitaRows(orgId)) {
    if (!r.portion_weight || r.portion_weight <= 0) continue;
    const sums = new Map<string, number>();
    for (const it of r.items) if (it.ingredient_id) sums.set(it.ingredient_id, (sums.get(it.ingredient_id) ?? 0) + it.net_qty * (fc.get(it.ingredient_id) ?? 1));
    out.set(r.id, [...sums].map(([ingredientId, gross]) => ({ ingredientId, grossPerGram: gross / r.portion_weight! })));
  }
  return out;
}
