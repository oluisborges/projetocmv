"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { parseDecimal } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string };
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const NO_PERMISSION = "Você só tem acesso de leitura. Peça a um gerente para alterar.";

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Número em formato brasileiro. Vazio = null (campo opcional). */
function optionalNumber(raw: unknown, label: string, { min = 0, max = 1_000_000 } = {}): Parsed<number | null> {
  const text = String(raw ?? "").trim();
  if (text === "") return { ok: true, value: null };
  const s = parseDecimal(text);
  const n = s === null ? NaN : Number(s);
  if (!Number.isFinite(n) || n <= min || n > max) {
    return { ok: false, error: `${label}: digite um número maior que ${min}.` };
  }
  return { ok: true, value: n };
}

type RecipeSettingsInput = { name: string; category: string | null; portions: number | null; portionWeight: number | null; cookingLossPct: number };

function readSettings(raw: { name: unknown; category?: unknown; portions: unknown; portionWeight: unknown; cookingLoss: unknown }): Parsed<RecipeSettingsInput> {
  const name = String(raw.name ?? "").trim();
  if (!name || name.length > 80) return { ok: false, error: "Dê um nome à ficha (até 80 letras)." };

  const category = String(raw.category ?? "").trim() || null;
  if (category && category.length > 40) return { ok: false, error: "Categoria muito longa." };

  const portions = optionalNumber(raw.portions, "Porções", { max: 100_000 });
  if (!portions.ok) return portions;
  const weight = optionalNumber(raw.portionWeight, "Peso da porção", { max: 100_000 });
  if (!weight.ok) return weight;
  if (portions.value === null && weight.value === null) {
    return { ok: false, error: "Informe quantas porções a receita rende, ou o peso de cada porção." };
  }

  let loss = 0;
  const lossText = String(raw.cookingLoss ?? "").trim();
  if (lossText !== "") {
    const s = parseDecimal(lossText);
    const n = s === null ? NaN : Number(s);
    if (!Number.isFinite(n) || n < 0 || n >= 100) return { ok: false, error: "Perda de cocção: digite um valor entre 0 e 99 (%)." };
    loss = n / 100;
  }

  return { ok: true, value: { name, category, portions: portions.value, portionWeight: weight.value, cookingLossPct: loss } };
}

const toRow = (v: RecipeSettingsInput) => ({
  name: v.name,
  category: v.category,
  portions: v.portions,
  portion_weight: v.portionWeight,
  cooking_loss_pct: v.cookingLossPct,
});

export async function createRecipe(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { error: NO_PERMISSION };

  const read = readSettings({
    name: formData.get("name"),
    category: formData.get("category"),
    portions: formData.get("portions"),
    portionWeight: formData.get("portion_weight"),
    cookingLoss: formData.get("cooking_loss"),
  });
  if (!read.ok) return { error: read.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("recipes").insert({ ...toRow(read.value), org_id: orgId }).select("id").single();
  if (error || !data) return { error: "Não foi possível criar a ficha." };

  revalidatePath("/fichas");
  redirect(`/fichas/${data.id}`);
}

export async function updateRecipeSettings(input: {
  id: string;
  name: string;
  portions: string;
  portionWeight: string;
  cookingLoss: string;
}): Promise<Result> {
  const { canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };

  const id = z.uuid().safeParse(input.id);
  if (!id.success) return { ok: false, error: "Ficha inválida." };
  const read = readSettings(input);
  if (!read.ok) return read;

  const supabase = await createClient();
  const v = read.value;
  const row = { name: v.name, portions: v.portions, portion_weight: v.portionWeight, cooking_loss_pct: v.cookingLossPct };
  const { data, error } = await supabase.from("recipes").update(row).eq("id", id.data).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível salvar." };

  revalidatePath("/fichas");
  return { ok: true };
}

export async function addRecipeItem(input: { recipeId: string; ingredientId: string; qty: string }): Promise<Result<{ itemId: string }>> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };

  const ids = z.object({ recipeId: z.uuid(), ingredientId: z.uuid() }).safeParse(input);
  const qtyText = parseDecimal(input.qty);
  const qty = qtyText === null ? NaN : Number(qtyText);
  if (!ids.success) return { ok: false, error: "Item inválido." };
  if (!(qty > 0) || qty > 10_000_000) return { ok: false, error: "Digite a quantidade, como 500." };

  const supabase = await createClient();
  const { data: ing } = await supabase.from("ingredients").select("kind").eq("id", ids.data.ingredientId).maybeSingle();
  if (!ing) return { ok: false, error: "Insumo não encontrado." };

  // Insumo entra no lote; embalagem é por porção. O servidor decide, não o navegador.
  const scope = ing.kind === "embalagem" ? "portion" : "batch";
  const { data, error } = await supabase
    .from("recipe_items")
    .insert({
      org_id: orgId,
      recipe_id: ids.data.recipeId,
      ingredient_id: ids.data.ingredientId,
      net_qty: qty,
      scope,
      counts_for_yield: scope === "batch",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Não foi possível adicionar o item." };

  revalidatePath("/fichas");
  return { ok: true, itemId: data.id };
}

export async function updateRecipeItemQty(itemId: string, rawQty: string): Promise<Result<{ qty: number }>> {
  const { canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };

  const id = z.uuid().safeParse(itemId);
  const text = parseDecimal(rawQty);
  const qty = text === null ? NaN : Number(text);
  if (!id.success || !(qty > 0) || qty > 10_000_000) return { ok: false, error: "Digite uma quantidade maior que zero." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("recipe_items").update({ net_qty: qty }).eq("id", id.data).select("net_qty").maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível salvar." };

  revalidatePath("/fichas");
  return { ok: true, qty: Number(data.net_qty) };
}

export async function removeRecipeItem(itemId: string): Promise<Result> {
  const { canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };
  const id = z.uuid().safeParse(itemId);
  if (!id.success) return { ok: false, error: "Item inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("recipe_items").delete().eq("id", id.data);
  if (error) return { ok: false, error: "Não foi possível remover." };

  revalidatePath("/fichas");
  return { ok: true };
}

export async function duplicateRecipe(formData: FormData): Promise<void> {
  const { orgId, canWrite } = await requireMember();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!canWrite || !id.success) return;

  const supabase = await createClient();
  const [{ data: recipe }, { data: items }] = await Promise.all([
    supabase.from("recipes").select("name, category, portions, portion_weight, cooking_loss_pct").eq("id", id.data).maybeSingle(),
    supabase.from("recipe_items").select("ingredient_id, net_qty, scope, counts_for_yield").eq("recipe_id", id.data),
  ]);
  if (!recipe) return;

  const { data: copy } = await supabase
    .from("recipes")
    .insert({ ...recipe, name: `${recipe.name} (cópia)`.slice(0, 80), org_id: orgId })
    .select("id")
    .single();
  if (!copy) return;

  if (items && items.length > 0) {
    await supabase.from("recipe_items").insert(items.map((i) => ({ ...i, org_id: orgId, recipe_id: copy.id })));
  }

  revalidatePath("/fichas");
  redirect(`/fichas/${copy.id}`);
}

export async function archiveRecipe(formData: FormData): Promise<void> {
  const { canWrite } = await requireMember();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!canWrite || !id.success) return;

  const supabase = await createClient();
  await supabase.from("recipes").update({ active: false }).eq("id", id.data);
  revalidatePath("/fichas");
  redirect("/fichas");
}
