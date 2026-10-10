"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { baseUnitOf, isCompatibleUnit, isPurchaseUnit, toBaseQty, type PurchaseUnit } from "@/lib/calc";
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

type RecipeSettingsInput = {
  name: string;
  category: string | null;
  portions: number | null;
  /** sempre em gramas */
  portionWeight: number | null;
  portionWeightUnit: "g" | "kg";
  cookingLossPct: number;
};

function readSettings(raw: {
  name: unknown;
  category?: unknown;
  portions: unknown;
  portionWeight: unknown;
  portionWeightUnit?: unknown;
  cookingLoss: unknown;
}): Parsed<RecipeSettingsInput> {
  const name = String(raw.name ?? "").trim();
  if (!name || name.length > 80) return { ok: false, error: "Dê um nome à ficha (até 80 letras)." };

  const category = String(raw.category ?? "").trim() || null;
  if (category && category.length > 40) return { ok: false, error: "Categoria muito longa." };

  const portions = optionalNumber(raw.portions, "Porções", { max: 100_000 });
  if (!portions.ok) return portions;
  const weightUnit = raw.portionWeightUnit === "kg" ? "kg" : "g";
  const weightTyped = optionalNumber(raw.portionWeight, "Peso da porção", { max: 100_000 });
  if (!weightTyped.ok) return weightTyped;
  // O que o dono digitou (em g ou kg) vira gramas, que é o que o cálculo usa.
  const weight: { value: number | null } = {
    value: weightTyped.value === null ? null : toBaseQty(weightTyped.value, weightUnit).toNumber(),
  };
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

  return {
    ok: true,
    value: { name, category, portions: portions.value, portionWeight: weight.value, portionWeightUnit: weightUnit, cookingLossPct: loss },
  };
}

const toRow = (v: RecipeSettingsInput) => ({
  name: v.name,
  category: v.category,
  portions: v.portions,
  portion_weight: v.portionWeight,
  portion_weight_unit: v.portionWeightUnit,
  cooking_loss_pct: v.cookingLossPct,
});

export async function createRecipe(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { error: NO_PERMISSION };

  // Por unidade (padrão): uma porção, sem perda de cocção. Em lote: o dono informa porções/peso.
  if (formData.get("mode") !== "batch") {
    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim() || null;
    if (!name || name.length > 80) return { error: "Dê um nome à ficha (até 80 letras)." };
    if (category && category.length > 40) return { error: "Categoria muito longa." };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("recipes")
      .insert({ org_id: orgId, name, category, portions: 1, portion_weight: null, cooking_loss_pct: 0, mode: "serving" })
      .select("id")
      .single();
    if (error || !data) return { error: "Não foi possível criar a ficha." };

    revalidatePath("/fichas");
    redirect(`/fichas/${data.id}`);
  }

  const read = readSettings({
    name: formData.get("name"),
    category: formData.get("category"),
    portions: formData.get("portions"),
    portionWeight: formData.get("portion_weight"),
    portionWeightUnit: formData.get("portion_weight_unit"),
    cookingLoss: formData.get("cooking_loss"),
  });
  if (!read.ok) return { error: read.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("recipes").insert({ ...toRow(read.value), org_id: orgId, mode: "batch" }).select("id").single();
  if (error || !data) return { error: "Não foi possível criar a ficha." };

  revalidatePath("/fichas");
  redirect(`/fichas/${data.id}`);
}

export async function updateRecipeSettings(input: {
  id: string;
  name: string;
  portions: string;
  portionWeight: string;
  portionWeightUnit: string;
  cookingLoss: string;
}): Promise<Result> {
  const { canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };

  const id = z.uuid().safeParse(input.id);
  if (!id.success) return { ok: false, error: "Ficha inválida." };

  const supabase = await createClient();
  const { data: current } = await supabase.from("recipes").select("mode").eq("id", id.data).maybeSingle();
  if (!current) return { ok: false, error: "Ficha não encontrada." };

  if (current.mode === "serving") {
    // Ficha por unidade: porções e perda de cocção não existem; só o nome muda.
    const name = input.name.trim();
    if (!name || name.length > 80) return { ok: false, error: "Dê um nome à ficha (até 80 letras)." };
    const { data, error } = await supabase.from("recipes").update({ name }).eq("id", id.data).select("id").maybeSingle();
    if (error || !data) return { ok: false, error: "Não foi possível salvar." };
    revalidatePath("/fichas");
    return { ok: true };
  }

  const read = readSettings(input);
  if (!read.ok) return read;

  const v = read.value;
  const row = {
    name: v.name,
    portions: v.portions,
    portion_weight: v.portionWeight,
    portion_weight_unit: v.portionWeightUnit,
    cooking_loss_pct: v.cookingLossPct,
  };
  const { data, error } = await supabase.from("recipes").update(row).eq("id", id.data).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível salvar." };

  revalidatePath("/fichas");
  return { ok: true };
}

/** Código do produto e observação sobre a porção: campos de organização, opcionais. */
export async function updateRecipeDetails(input: { id: string; code: string; note: string }): Promise<Result> {
  const { canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };

  const id = z.uuid().safeParse(input.id);
  if (!id.success) return { ok: false, error: "Ficha inválida." };
  const code = input.code.trim();
  const note = input.note.trim();
  if (code.length > 40) return { ok: false, error: "O código pode ter até 40 caracteres." };
  if (note.length > 200) return { ok: false, error: "A observação pode ter até 200 caracteres." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("recipes").update({ code: code || null, portion_note: note || null }).eq("id", id.data).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível salvar." };
  revalidatePath("/fichas");
  return { ok: true };
}

/** Quantidade + unidade escolhida -> quantidade na unidade-base do item (g/ml/un). `null` se inválida. */
function toBase(qtyText: string, unit: string, ingredientUnit: string): { qty: number; unit: PurchaseUnit } | { error: string } {
  const parsed = parseDecimal(qtyText);
  const typed = parsed === null ? NaN : Number(parsed);
  if (!(typed > 0)) return { error: "Digite uma quantidade maior que zero, como 500." };
  if (!isPurchaseUnit(unit) || !isPurchaseUnit(ingredientUnit) || !isCompatibleUnit(unit, baseUnitOf(ingredientUnit))) {
    return { error: "Essa unidade não combina com o item (ex.: litro para algo em gramas)." };
  }
  const base = toBaseQty(typed, unit).toNumber();
  if (base > 10_000_000) return { error: "Quantidade muito grande." };
  if (base < 0.0001) return { error: "Quantidade muito pequena." };
  return { qty: base, unit };
}

export async function addRecipeItem(input: { recipeId: string; ingredientId: string; qty: string; unit: string }): Promise<Result<{ itemId: string; qty: number; unit: string }>> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };

  const ids = z.object({ recipeId: z.uuid(), ingredientId: z.uuid() }).safeParse(input);
  if (!ids.success) return { ok: false, error: "Item inválido." };

  const supabase = await createClient();
  const { data: ing } = await supabase.from("ingredients").select("kind, purchase_unit").eq("id", ids.data.ingredientId).maybeSingle();
  if (!ing) return { ok: false, error: "Insumo não encontrado." };

  const base = toBase(input.qty, input.unit, ing.purchase_unit);
  if ("error" in base) return { ok: false, error: base.error };

  // Insumo entra no lote; embalagem é por porção. O servidor decide, não o navegador.
  const scope = ing.kind === "embalagem" ? "portion" : "batch";
  const { data, error } = await supabase
    .from("recipe_items")
    .insert({
      org_id: orgId,
      recipe_id: ids.data.recipeId,
      ingredient_id: ids.data.ingredientId,
      net_qty: base.qty,
      qty_unit: base.unit,
      scope,
      counts_for_yield: scope === "batch",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Não foi possível adicionar o item." };

  revalidatePath("/fichas");
  return { ok: true, itemId: data.id, qty: base.qty, unit: base.unit };
}

export async function updateRecipeItemQty(itemId: string, rawQty: string, unit: string): Promise<Result<{ qty: number; unit: string }>> {
  const { canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };

  const id = z.uuid().safeParse(itemId);
  if (!id.success) return { ok: false, error: "Item inválido." };

  const supabase = await createClient();
  const { data: item } = await supabase.from("recipe_items").select("ingredient_id").eq("id", id.data).maybeSingle();
  const { data: ing } = item ? await supabase.from("ingredients").select("purchase_unit").eq("id", item.ingredient_id).maybeSingle() : { data: null };
  if (!item || !ing) return { ok: false, error: "Item não encontrado." };

  const base = toBase(rawQty, unit, ing.purchase_unit);
  if ("error" in base) return { ok: false, error: base.error };

  const { data, error } = await supabase
    .from("recipe_items")
    .update({ net_qty: base.qty, qty_unit: base.unit })
    .eq("id", id.data)
    .select("net_qty")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível salvar." };

  revalidatePath("/fichas");
  return { ok: true, qty: Number(data.net_qty), unit: base.unit };
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
    supabase.from("recipes").select("name, category, portions, portion_weight, portion_weight_unit, cooking_loss_pct, mode").eq("id", id.data).maybeSingle(),
    supabase.from("recipe_items").select("ingredient_id, net_qty, qty_unit, scope, counts_for_yield").eq("recipe_id", id.data),
  ]);
  if (!recipe) return;

  const { data: copy } = await supabase
    .from("recipes")
    .insert({ ...recipe, name: `${recipe.name} (cópia)`.slice(0, 80), org_id: orgId })
    .select("id")
    .single();
  if (!copy) return;

  if (items && items.length > 0) {
    const { error } = await supabase.from("recipe_items").insert(items.map((i) => ({ ...i, org_id: orgId, recipe_id: copy.id })));
    if (error) {
      await supabase.from("recipes").delete().eq("id", copy.id); // não deixa uma cópia vazia para trás
      return;
    }
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

export async function restoreRecipe(formData: FormData): Promise<void> {
  const { canWrite } = await requireMember();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!canWrite || !id.success) return;

  const supabase = await createClient();
  await supabase.from("recipes").update({ active: true }).eq("id", id.data);
  revalidatePath("/fichas");
  redirect(`/fichas/${id.data}`);
}
