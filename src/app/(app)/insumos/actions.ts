"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { parseDecimal } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string };

const fail = (error: string): FormState => ({ error });
const NO_PERMISSION = "Você só tem acesso de leitura. Peça a um gerente para alterar.";

const UNITS = ["kg", "g", "l", "ml", "un"] as const;
const KINDS = ["insumo", "embalagem"] as const;

/** Campo numérico em formato brasileiro -> número positivo (ou null). */
const num = (raw: FormDataEntryValue | null, opts?: { allowZero?: boolean }) => {
  const s = parseDecimal(String(raw ?? ""));
  if (s === null) return null;
  const n = Number(s);
  return n > 0 || (opts?.allowZero && n === 0) ? n : null;
};

/** Salva só o preço (edição rápida na lista). */
export async function updateIngredientPrice(id: string, rawPrice: string): Promise<{ ok: true; price: number } | { ok: false; error: string }> {
  const { canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };

  const parsed = z.uuid().safeParse(id);
  const price = parseDecimal(rawPrice);
  if (!parsed.success || price === null) return { ok: false, error: "Digite um valor válido, como 14,50." };
  if (Number(price) > 1_000_000) return { ok: false, error: "Valor alto demais." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredients")
    .update({ purchase_price: Number(price) })
    .eq("id", parsed.data)
    .select("purchase_price")
    .maybeSingle();

  if (error || !data) return { ok: false, error: "Não foi possível salvar. Tente de novo." };
  revalidatePath("/insumos");
  return { ok: true, price: Number(data.purchase_price) };
}

type IngredientInput = {
  name: string;
  kind: string;
  category: string | null;
  purchase_unit: string;
  purchase_qty: number;
  purchase_price: number;
  correction_factor: number;
};

function readIngredientForm(formData: FormData): { ok: true; value: IngredientInput } | { ok: false; error: string } {
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("purchase_unit") ?? "");
  const kind = String(formData.get("kind") ?? "insumo");
  const category = String(formData.get("category") ?? "").trim() || null;
  const qty = num(formData.get("purchase_qty"));
  const price = num(formData.get("purchase_price"), { allowZero: true });
  const fc = kind === "embalagem" ? 1 : num(formData.get("correction_factor"));

  if (!name || name.length > 80) return { ok: false, error: "Dê um nome ao insumo (até 80 letras)." };
  if (!(UNITS as readonly string[]).includes(unit)) return { ok: false, error: "Escolha a unidade de compra." };
  if (!(KINDS as readonly string[]).includes(kind)) return { ok: false, error: "Tipo inválido." };
  if (qty === null) return { ok: false, error: "Informe quanto vem na compra (ex.: 1 para 1 kg, 100 para 100 unidades)." };
  if (price === null) return { ok: false, error: "Informe o preço pago, como 14,50." };
  if (fc === null || fc < 1 || fc > 10) return { ok: false, error: "O fator de correção precisa ser 1 ou mais (ex.: 1,15)." };
  if (category && category.length > 40) return { ok: false, error: "Categoria muito longa." };

  return { ok: true, value: { name, kind, category, purchase_unit: unit, purchase_qty: qty, purchase_price: price, correction_factor: fc } };
}

export async function createIngredient(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return fail(NO_PERMISSION);

  const read = readIngredientForm(formData);
  if (!read.ok) return fail(read.error);

  const supabase = await createClient();
  const { error } = await supabase.from("ingredients").insert({ ...read.value, org_id: orgId });
  if (error) return fail("Não foi possível salvar o insumo.");

  revalidatePath("/insumos");
  redirect("/insumos");
}

export async function updateIngredient(_prev: FormState, formData: FormData): Promise<FormState> {
  const { canWrite } = await requireMember();
  if (!canWrite) return fail(NO_PERMISSION);

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Insumo inválido.");
  const read = readIngredientForm(formData);
  if (!read.ok) return fail(read.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from("ingredients").update(read.value).eq("id", id.data).select("id").maybeSingle();
  if (error || !data) return fail("Não foi possível salvar as alterações.");

  revalidatePath("/insumos");
  redirect("/insumos");
}

export async function archiveIngredient(formData: FormData): Promise<void> {
  const { canWrite } = await requireMember();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!canWrite || !id.success) return;

  const supabase = await createClient();
  // Arquiva (não apaga): fichas técnicas antigas continuam funcionando.
  await supabase.from("ingredients").update({ archived_at: new Date().toISOString() }).eq("id", id.data);
  revalidatePath("/insumos");
  redirect("/insumos");
}

export async function adjustPrices(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return fail(NO_PERMISSION);

  const raw = parseDecimal(String(formData.get("percent") ?? ""), { allowNegative: true });
  if (raw === null) return fail("Digite o percentual, como 8 (aumento) ou -5 (queda).");
  const pct = Number(raw) / 100;
  if (pct <= -1 || pct > 5) return fail("Percentual fora do limite.");
  if (pct === 0) return fail("Percentual zero não muda nada.");

  const category = String(formData.get("category") ?? "").trim() || null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bulk_adjust_ingredient_prices", {
    p_org: orgId,
    p_pct: pct,
    p_category: category,
  });
  if (error) return fail("Não foi possível reajustar os preços.");

  revalidatePath("/insumos");
  const n = Number(data ?? 0);
  if (n === 0) return { ok: "Nenhum insumo com preço foi encontrado para reajustar." };
  return { ok: `${n} ${n === 1 ? "insumo reajustado" : "insumos reajustados"}.` };
}

export async function importFromCatalog(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return fail(NO_PERMISSION);

  const ids = z.array(z.uuid()).min(1).max(200).safeParse(formData.getAll("ids"));
  if (!ids.success) return fail("Marque pelo menos um item.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("import_template", { p_org: orgId, p_ingredient_ids: ids.data, p_recipe_ids: [] });
  if (error) return fail("Não foi possível importar.");

  revalidatePath("/insumos");
  redirect("/insumos?importado=1");
}
