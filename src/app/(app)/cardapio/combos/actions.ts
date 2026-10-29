"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { parseDecimal } from "@/lib/format";
import { loadCurrentPrices, activeUnit } from "@/lib/pricing-data";
import { createClient } from "@/lib/supabase/server";
import type { ComboGroupRow, ComboOptionRow } from "@/lib/combos-data";

export type FormState = { error?: string };
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const NO_PERMISSION = "Você só tem acesso de leitura. Peça a um gerente para alterar.";
const SAME_NAME = "Você já tem um combo com esse nome. Escolha outro nome (por exemplo, acrescente a quantidade).";
const GENERIC = "Não foi possível salvar. Tente de novo.";

const nameSchema = z.string().trim().min(1, "Dê um nome ao combo.").max(80, "Nome muito longo (até 80 letras).");

/** Inteiro de 1 a 1000 digitado pela pessoa, ou null. */
function wholeNumber(raw: string): number | null {
  const p = parseDecimal(String(raw));
  if (p === null) return null;
  const n = Number(p);
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : null;
}

/** Dinheiro >= 0 digitado pela pessoa, ou null. */
function money(raw: string): number | null {
  const p = parseDecimal(String(raw));
  if (p === null) return null;
  const n = Number(p);
  return n >= 0 && n <= 100_000 ? Math.round(n * 100) / 100 : null;
}

export async function createCombo(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { error: NO_PERMISSION };
  const name = nameSchema.safeParse(formData.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.from("combos").insert({ org_id: orgId, name: name.data }).select("id").single();
  if (error?.code === "23505") return { error: SAME_NAME };
  if (error || !data) return { error: GENERIC };

  revalidatePath("/cardapio/combos");
  redirect(`/cardapio/combos/${data.id}`);
}

export async function renameCombo(id: string, rawName: string): Promise<Result> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };
  const uuid = z.uuid().safeParse(id);
  const name = nameSchema.safeParse(rawName);
  if (!uuid.success) return { ok: false, error: "Combo inválido." };
  if (!name.success) return { ok: false, error: name.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.from("combos").update({ name: name.data }).eq("id", uuid.data).eq("org_id", orgId).select("id").maybeSingle();
  if (error?.code === "23505") return { ok: false, error: SAME_NAME };
  if (error || !data) return { ok: false, error: GENERIC };
  revalidatePath("/cardapio/combos");
  return { ok: true };
}

async function setActive(formData: FormData, active: boolean) {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return;
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("combos").update({ active }).eq("id", id.data).eq("org_id", orgId);
  revalidatePath("/cardapio/combos");
  redirect("/cardapio/combos");
}

export async function archiveCombo(formData: FormData): Promise<void> {
  await setActive(formData, false);
}

export async function restoreCombo(formData: FormData): Promise<void> {
  await setActive(formData, true);
}

export async function addGroup(input: { comboId: string; kind: string }): Promise<Result<{ group: ComboGroupRow }>> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };
  const parsed = z.object({ comboId: z.uuid(), kind: z.enum(["fixed", "choice"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Grupo inválido." };

  const supabase = await createClient();
  const { data: combo } = await supabase.from("combos").select("id").eq("id", parsed.data.comboId).eq("org_id", orgId).maybeSingle();
  if (!combo) return { ok: false, error: "Combo não encontrado." };
  const { data: last } = await supabase.from("combo_groups").select("position").eq("combo_id", combo.id).eq("org_id", orgId).order("position", { ascending: false }).limit(1).maybeSingle();

  const choice = parsed.data.kind === "choice";
  const { data, error } = await supabase
    .from("combo_groups")
    .insert({
      org_id: orgId,
      combo_id: combo.id,
      kind: parsed.data.kind,
      name: choice ? "Escolha suas marmitas" : "Marmitas fixas",
      pick_qty: choice ? 5 : null,
      unit_price: choice ? 0 : null,
      position: (last?.position ?? -1) + 1,
    })
    .select("id, combo_id, name, kind, pick_qty, unit_price, position")
    .single();
  if (error || !data) return { ok: false, error: GENERIC };

  revalidatePath("/cardapio/combos");
  return {
    ok: true,
    group: { id: data.id, combo_id: data.combo_id, name: data.name, kind: choice ? "choice" : "fixed", pick_qty: data.pick_qty, unit_price: data.unit_price === null ? null : Number(data.unit_price), position: Number(data.position), options: [] },
  };
}

export async function updateGroup(input: { groupId: string; name?: string; pickQty?: string; unitPrice?: string }): Promise<Result<{ name: string; pick_qty: number | null; unit_price: number | null }>> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };
  const id = z.uuid().safeParse(input.groupId);
  if (!id.success) return { ok: false, error: "Grupo inválido." };

  const supabase = await createClient();
  const { data: group } = await supabase.from("combo_groups").select("kind").eq("id", id.data).eq("org_id", orgId).maybeSingle();
  if (!group) return { ok: false, error: "Grupo não encontrado." };

  const patch: { name?: string; pick_qty?: number; unit_price?: number } = {};
  if (input.name !== undefined) {
    const name = nameSchema.safeParse(input.name);
    if (!name.success) return { ok: false, error: "Dê um nome ao grupo (até 80 letras)." };
    patch.name = name.data;
  }
  if (group.kind === "choice") {
    if (input.pickQty !== undefined) {
      const q = wholeNumber(input.pickQty);
      if (q === null) return { ok: false, error: "Digite quantas marmitas o cliente escolhe (um número inteiro, como 10)." };
      patch.pick_qty = q;
    }
    if (input.unitPrice !== undefined) {
      const p = money(input.unitPrice);
      if (p === null) return { ok: false, error: "Digite quanto cada marmita sai no combo, como 22,50." };
      patch.unit_price = p;
    }
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: "Nada para salvar." };

  const { data, error } = await supabase.from("combo_groups").update(patch).eq("id", id.data).eq("org_id", orgId).select("name, pick_qty, unit_price").maybeSingle();
  if (error || !data) return { ok: false, error: GENERIC };
  revalidatePath("/cardapio/combos");
  return { ok: true, name: data.name, pick_qty: data.pick_qty, unit_price: data.unit_price === null ? null : Number(data.unit_price) };
}

export async function deleteGroup(groupId: string): Promise<Result> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };
  const id = z.uuid().safeParse(groupId);
  if (!id.success) return { ok: false, error: "Grupo inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("combo_groups").delete().eq("id", id.data).eq("org_id", orgId);
  if (error) return { ok: false, error: GENERIC };
  revalidatePath("/cardapio/combos");
  return { ok: true };
}

export async function addOption(input: { groupId: string; recipeId: string }): Promise<Result<{ option: ComboOptionRow }>> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };
  const parsed = z.object({ groupId: z.uuid(), recipeId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Marmita inválida." };

  const supabase = await createClient();
  const [{ data: group }, { data: recipe }, { data: last }] = await Promise.all([
    supabase.from("combo_groups").select("id, kind").eq("id", parsed.data.groupId).eq("org_id", orgId).maybeSingle(),
    supabase.from("recipes").select("id").eq("id", parsed.data.recipeId).eq("org_id", orgId).eq("kind", "marmita").eq("active", true).maybeSingle(),
    supabase.from("combo_group_options").select("position").eq("group_id", parsed.data.groupId).eq("org_id", orgId).order("position", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!group || !recipe) return { ok: false, error: "Marmita ou grupo não encontrado." };

  // Grupo fixo começa com 1 unidade pelo preço avulso da marmita (a pessoa ajusta para o preço de dentro do combo).
  let unitPrice = 0;
  if (group.kind === "fixed") {
    const unit = await activeUnit(orgId);
    if (unit) unitPrice = (await loadCurrentPrices(unit.id)).get(recipe.id) ?? 0;
  }

  const { data, error } = await supabase
    .from("combo_group_options")
    .insert({
      org_id: orgId,
      group_id: group.id,
      recipe_id: recipe.id,
      qty: group.kind === "fixed" ? 1 : null,
      unit_price: group.kind === "fixed" ? unitPrice : null,
      position: (last?.position ?? -1) + 1,
    })
    .select("id, group_id, recipe_id, qty, unit_price, position")
    .single();
  if (error?.code === "23505") return { ok: false, error: "Essa marmita já está neste grupo." };
  if (error || !data) return { ok: false, error: GENERIC };

  revalidatePath("/cardapio/combos");
  return { ok: true, option: { id: data.id, group_id: data.group_id, recipe_id: data.recipe_id, qty: data.qty, unit_price: data.unit_price === null ? null : Number(data.unit_price), position: Number(data.position) } };
}

export async function updateOption(input: { optionId: string; qty?: string; unitPrice?: string }): Promise<Result<{ qty: number | null; unit_price: number | null }>> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };
  const id = z.uuid().safeParse(input.optionId);
  if (!id.success) return { ok: false, error: "Marmita inválida." };

  const patch: { qty?: number; unit_price?: number | null } = {};
  let patchNull = false;
  if (input.qty !== undefined) {
    const q = wholeNumber(input.qty);
    if (q === null) return { ok: false, error: "Digite quantas unidades (um número inteiro, como 5)." };
    patch.qty = q;
  }
  const supabase = await createClient();
  if (input.unitPrice !== undefined) {
    // Em grupo de escolha o preço da opção é opcional: vazio volta a valer o preço do grupo.
    const { data: opt } = await supabase.from("combo_group_options").select("group_id").eq("id", id.data).eq("org_id", orgId).maybeSingle();
    const { data: grp } = opt ? await supabase.from("combo_groups").select("kind").eq("id", opt.group_id).eq("org_id", orgId).maybeSingle() : { data: null };
    if (grp?.kind === "choice" && input.unitPrice.trim() === "") {
      patchNull = true;
    } else {
      const p = money(input.unitPrice);
      if (p === null) return { ok: false, error: "Digite quanto cada uma sai no combo, como 23,50." };
      patch.unit_price = p;
    }
  }
  if (Object.keys(patch).length === 0 && !patchNull) return { ok: false, error: "Nada para salvar." };

  const { data, error } = await supabase.from("combo_group_options").update(patchNull ? { ...patch, unit_price: null } : patch).eq("id", id.data).eq("org_id", orgId).select("qty, unit_price").maybeSingle();
  if (error || !data) return { ok: false, error: GENERIC };
  revalidatePath("/cardapio/combos");
  return { ok: true, qty: data.qty, unit_price: data.unit_price === null ? null : Number(data.unit_price) };
}

export async function removeOption(optionId: string): Promise<Result> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };
  const id = z.uuid().safeParse(optionId);
  if (!id.success) return { ok: false, error: "Marmita inválida." };
  const supabase = await createClient();
  const { error } = await supabase.from("combo_group_options").delete().eq("id", id.data).eq("org_id", orgId);
  if (error) return { ok: false, error: GENERIC };
  revalidatePath("/cardapio/combos");
  return { ok: true };
}
