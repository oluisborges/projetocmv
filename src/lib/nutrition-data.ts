import "server-only";
import { NUTRIENT_KEYS, emptyNutrition, scaleNutrition, sumNutrition, type NutrientKey, type Nutrition, type NutritionPart } from "@/lib/calc/nutrition";
import { requireMember } from "@/lib/auth";
import { loadIngredients, loadReceitaRows, loadRecipe } from "@/lib/recipes-data";
import { createClient } from "@/lib/supabase/server";
import { suggestTaco, tacoFood, tacoNutrition } from "@/lib/taco";

export type NutritionLine = {
  ingredientId: string;
  name: string;
  kind: "insumo" | "receita";
  /** Quanto entra em uma porção, em gramas; `null` = ingrediente medido em unidade (sem peso conhecido). */
  grams: number | null;
  tacoId: number | null;
  tacoName: string | null;
  /** salvo = a pessoa escolheu; sugerido = achado pelo nome (confira); sem = nada encontrado. */
  source: "salvo" | "sugerido" | "sem";
  /** O alimento da TACO escolhido não tem energia cadastrada. */
  lacksEnergy: boolean;
};

export type Override = { values: Partial<Record<NutrientKey, number>>; portionGrams: number | null; householdMeasure: string | null };

export type ProductNutrition = {
  id: string;
  name: string;
  lines: NutritionLine[];
  /** Ingredientes sem alimento da TACO ou sem peso: ficam fora da soma. */
  missing: number;
  auto: { perPortion: Nutrition; portionGrams: number | null };
  override: Override | null;
  /** O que a tabela mostra: o automático com as correções do cliente por cima. */
  perPortion: Nutrition;
  per100: Nutrition | null;
  portionGrams: number | null;
  householdMeasure: string;
  canWrite: boolean;
};

const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** A tabela nutricional de um produto: soma dos ingredientes (TACO) pelo peso de cada um, com as correções salvas do cliente. */
export async function loadProductNutrition(id: string): Promise<ProductNutrition | null> {
  const { orgId, canWrite } = await requireMember();
  const supabase = await createClient();
  const [loaded, ingredients, receitaRows, linksRes, overrideRes] = await Promise.all([
    loadRecipe(id),
    loadIngredients(),
    loadReceitaRows(orgId),
    supabase.from("ingredient_taco_links").select("ingredient_id, taco_id").eq("org_id", orgId),
    supabase.from("recipe_nutrition_overrides").select("\"values\", portion_grams, household_measure").eq("org_id", orgId).eq("recipe_id", id).maybeSingle(),
  ]);
  if (!loaded || loaded.recipe.kind !== "marmita") return null;
  const { recipe, items } = loaded;
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const links = new Map<string, number>((linksRes.data ?? []).map((l) => [l.ingredient_id as string, Number(l.taco_id)]));

  // Alimento da TACO de um ingrediente real: o escolhido, ou o sugerido pelo nome.
  const tacoOf = (ingredientId: string, name: string): { id: number | null; source: NutritionLine["source"] } => {
    const saved = links.get(ingredientId);
    if (saved !== undefined && tacoFood(saved)) return { id: saved, source: "salvo" };
    const suggested = suggestTaco(name);
    return suggested ? { id: suggested.id, source: "sugerido" } : { id: null, source: "sem" };
  };

  // Receitas (preparos) usadas no produto: nutrientes por 100 g pronto = soma dos insumos ÷ peso que a receita rende.
  const receitaPer100 = new Map<string, Nutrition | null>();
  for (const r of receitaRows) {
    const parts: NutritionPart[] = [];
    let netGrams = 0;
    for (const it of r.items) {
      const ing = it.ingredient_id ? byId.get(it.ingredient_id) : undefined;
      if (!ing || ing.purchase_unit === "un") continue;
      netGrams += it.net_qty;
      const t = tacoOf(ing.id, ing.name);
      parts.push({ grams: it.net_qty, per100: t.id === null ? null : tacoNutrition(t.id) });
    }
    const { total } = sumNutrition(parts);
    const ready = r.portion_weight && r.portion_weight > 0 ? r.portion_weight : netGrams;
    receitaPer100.set(r.id, ready > 0 && parts.length > 0 ? scaleNutrition(total, ready, 100) : null);
  }

  const portions = recipe.portions && recipe.portions > 0 ? recipe.portions : 1;
  const lines: NutritionLine[] = [];
  const parts: NutritionPart[] = [];
  let weighed = 0;
  for (const it of items) {
    const ing = byId.get(it.ingredient_id);
    if (!ing || ing.kind === "embalagem") continue;
    const unitless = ing.purchase_unit === "un";
    const grams = unitless ? null : it.scope === "batch" ? it.net_qty / portions : it.net_qty;
    let per100: Nutrition | null;
    let line: NutritionLine;
    if (ing.kind === "receita") {
      per100 = receitaPer100.get(ing.id) ?? null;
      line = { ingredientId: ing.id, name: ing.name, kind: "receita", grams, tacoId: null, tacoName: null, source: per100 ? "salvo" : "sem", lacksEnergy: per100 !== null && per100.kcal === null };
    } else {
      const t = tacoOf(ing.id, ing.name);
      per100 = t.id === null ? null : tacoNutrition(t.id);
      line = { ingredientId: ing.id, name: ing.name, kind: "insumo", grams, tacoId: t.id, tacoName: t.id === null ? null : (tacoFood(t.id)?.name ?? null), source: t.source, lacksEnergy: per100 !== null && per100.kcal === null };
    }
    lines.push(line);
    if (grams !== null) weighed += grams;
    parts.push({ grams: grams ?? 0, per100: grams === null ? null : per100 });
  }

  const { total, missing } = sumNutrition(parts);
  const autoPortionGrams = recipe.portion_weight && recipe.portion_weight > 0 ? recipe.portion_weight : weighed > 0 ? weighed : null;

  const o = overrideRes.data as { values: Record<string, unknown> | null; portion_grams: unknown; household_measure: string | null } | null;
  const override: Override | null = o
    ? {
        values: Object.fromEntries(NUTRIENT_KEYS.flatMap((k) => (num(o.values?.[k]) === null ? [] : [[k, num(o.values?.[k])!]]))),
        portionGrams: num(o.portion_grams),
        householdMeasure: o.household_measure,
      }
    : null;

  const perPortion = emptyNutrition();
  for (const k of NUTRIENT_KEYS) perPortion[k] = override?.values[k] ?? total[k];
  const portionGrams = override?.portionGrams ?? autoPortionGrams;
  return {
    id: recipe.id,
    name: recipe.name,
    lines,
    missing,
    auto: { perPortion: total, portionGrams: autoPortionGrams },
    override,
    perPortion,
    per100: portionGrams && portionGrams > 0 ? scaleNutrition(perPortion, portionGrams, 100) : null,
    portionGrams,
    householdMeasure: override?.householdMeasure ?? "1 porção",
    canWrite,
  };
}
