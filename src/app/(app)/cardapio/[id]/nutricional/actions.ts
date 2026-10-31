"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { NUTRIENT_KEYS } from "@/lib/calc/nutrition";
import { parseDecimal } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { tacoFood } from "@/lib/taco";

type Result = { ok: true } | { ok: false; error: string };
const NO_PERMISSION = "Você só tem acesso de leitura. Peça a um gerente para alterar.";
const FAILED = "Não foi possível salvar agora. Tente de novo.";

/** Escolhe qual alimento da TACO vale para um ingrediente (vale para todos os produtos que o usam). */
export async function saveTacoLink(input: { recipeId: string; ingredientId: string; tacoId: number }): Promise<Result> {
  const parsed = z.object({ recipeId: z.uuid(), ingredientId: z.uuid(), tacoId: z.number().int() }).safeParse(input);
  if (!parsed.success || !tacoFood(parsed.data.tacoId)) return { ok: false, error: "Escolha um alimento da lista." };
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };
  const supabase = await createClient();
  const { error } = await supabase
    .from("ingredient_taco_links")
    .upsert({ org_id: orgId, ingredient_id: parsed.data.ingredientId, taco_id: parsed.data.tacoId, updated_at: new Date().toISOString() }, { onConflict: "ingredient_id" });
  if (error) return { ok: false, error: FAILED };
  revalidatePath(`/cardapio/${parsed.data.recipeId}/nutricional`);
  return { ok: true };
}

/** Valores digitados pelo cliente (por porção). Campo vazio = volta ao automático; número em formato brasileiro. */
export async function saveNutritionOverride(input: { recipeId: string; values: Record<string, string>; portionGrams: string; householdMeasure: string }): Promise<Result> {
  const id = z.uuid().safeParse(input.recipeId);
  if (!id.success) return { ok: false, error: "Produto inválido." };
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };

  const values: Record<string, number> = {};
  for (const k of NUTRIENT_KEYS) {
    const text = String(input.values[k] ?? "").trim();
    if (text === "") continue;
    const s = parseDecimal(text);
    const n = s === null ? NaN : Number(s);
    if (!Number.isFinite(n) || n < 0 || n > 100_000) return { ok: false, error: "Use só números, sem negativos (ex.: 12,5)." };
    values[k] = n;
  }
  let portionGrams: number | null = null;
  const gramsText = input.portionGrams.trim();
  if (gramsText !== "") {
    const s = parseDecimal(gramsText);
    const n = s === null ? NaN : Number(s);
    if (!Number.isFinite(n) || n <= 0 || n > 100_000) return { ok: false, error: "O peso da porção precisa ser um número maior que zero." };
    portionGrams = n;
  }
  const household = input.householdMeasure.trim().slice(0, 60) || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("recipe_nutrition_overrides")
    .upsert({ org_id: orgId, recipe_id: id.data, values, portion_grams: portionGrams, household_measure: household, updated_at: new Date().toISOString() }, { onConflict: "recipe_id" });
  if (error) return { ok: false, error: FAILED };
  revalidatePath(`/cardapio/${id.data}/nutricional`);
  return { ok: true };
}

/** Descarta as correções e volta à tabela automática. */
export async function resetNutritionOverride(recipeId: string): Promise<Result> {
  const id = z.uuid().safeParse(recipeId);
  if (!id.success) return { ok: false, error: "Produto inválido." };
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };
  const supabase = await createClient();
  const { error } = await supabase.from("recipe_nutrition_overrides").delete().eq("org_id", orgId).eq("recipe_id", id.data);
  if (error) return { ok: false, error: FAILED };
  revalidatePath(`/cardapio/${id.data}/nutricional`);
  return { ok: true };
}
