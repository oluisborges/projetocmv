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
  /** salvo = a pessoa escolheu; sugerido = achado pelo nome com clareza (confira); possivel = há dúvida, fica fora da conta até confirmar; sem = nada encontrado. */
  source: "salvo" | "sugerido" | "possivel" | "sem";
  /** Só em "possivel": o alimento que parece o certo, para a pessoa confirmar com um toque. */
  candidateId: number | null;
  candidateName: string | null;
  /** O alimento da TACO escolhido não tem energia cadastrada. */
  lacksEnergy: boolean;
  /** Receita: os ingredientes dela e o alimento da TACO ligado a cada um (a quantidade é a do lote da receita). */
  children?: NutritionLine[];
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
  // Só entra na conta o alimento escolhido pela pessoa ou a sugestão clara; a "possível" espera a confirmação.
  const tacoOf = (ingredientId: string, name: string): { id: number | null; source: NutritionLine["source"]; candidate: number | null } => {
    const saved = links.get(ingredientId);
    if (saved !== undefined && tacoFood(saved)) return { id: saved, source: "salvo", candidate: null };
    const s = suggestTaco(name);
    if (!s) return { id: null, source: "sem", candidate: null };
    return s.confidence === "alta" ? { id: s.food.id, source: "sugerido", candidate: null } : { id: null, source: "possivel", candidate: s.food.id };
  };

  /** A linha de um insumo (e os nutrientes por 100 g que ela traz para a conta). */
  const insumoLine = (ing: { id: string; name: string }, grams: number | null): { line: NutritionLine; per100: Nutrition | null } => {
    const t = tacoOf(ing.id, ing.name);
    const per100 = t.id === null ? null : tacoNutrition(t.id);
    return {
      per100,
      line: {
        ingredientId: ing.id,
        name: ing.name,
        kind: "insumo",
        grams,
        tacoId: t.id,
        tacoName: t.id === null ? null : (tacoFood(t.id)?.name ?? null),
        source: t.source,
        candidateId: t.candidate,
        candidateName: t.candidate === null ? null : (tacoFood(t.candidate)?.name ?? null),
        lacksEnergy: per100 !== null && per100.kcal === null,
      },
    };
  };

  // Receitas (preparos) usadas no produto: nutrientes por 100 g pronto = soma dos insumos ÷ peso que a receita rende.
  const receitaPer100 = new Map<string, Nutrition | null>();
  const receitaChildren = new Map<string, NutritionLine[]>();
  // Quantos ingredientes de cada receita ficaram fora da conta dela (a dúvida sobe para o produto).
  const receitaMissing = new Map<string, number>();
  for (const r of receitaRows) {
    const parts: NutritionPart[] = [];
    const children: NutritionLine[] = [];
    let netGrams = 0;
    for (const it of r.items) {
      const ing = it.ingredient_id ? byId.get(it.ingredient_id) : undefined;
      if (!ing || ing.kind === "embalagem") continue;
      const unitless = ing.purchase_unit === "un";
      const { line, per100 } = insumoLine(ing, unitless ? null : it.net_qty);
      children.push(line);
      if (unitless) continue;
      netGrams += it.net_qty;
      parts.push({ grams: it.net_qty, per100 });
    }
    receitaChildren.set(r.id, children);
    const { total, missing: inside } = sumNutrition(parts);
    receitaMissing.set(r.id, inside);
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
      line = { ingredientId: ing.id, name: ing.name, kind: "receita", grams, tacoId: null, tacoName: null, source: per100 ? "salvo" : "sem", candidateId: null, candidateName: null, lacksEnergy: per100 !== null && per100.kcal === null, children: receitaChildren.get(ing.id) ?? [] };
    } else {
      ({ line, per100 } = insumoLine(ing, grams));
    }
    lines.push(line);
    if (grams !== null) weighed += grams;
    parts.push({ grams: grams ?? 0, per100: grams === null ? null : per100 });
  }

  const { total, missing: direct } = sumNutrition(parts);
  const missing = direct + lines.reduce((n, l) => n + (l.kind === "receita" ? (receitaMissing.get(l.ingredientId) ?? 0) : 0), 0);
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
