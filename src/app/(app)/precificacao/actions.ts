"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { parseDecimal } from "@/lib/format";
import { activeUnit } from "@/lib/pricing-data";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string };

const NO_PERMISSION = "Você só tem acesso de leitura. Peça a um gerente para alterar.";

/** "6", "6,5" -> fração (0.06, 0.065). Aceita 0 a 99,99. */
function percent(raw: unknown, label: string): { ok: true; value: number } | { ok: false; error: string } {
  const text = parseDecimal(String(raw ?? "").trim() === "" ? "0" : String(raw));
  const n = text === null ? NaN : Number(text);
  if (!Number.isFinite(n) || n < 0 || n >= 100) return { ok: false, error: `${label}: digite um percentual entre 0 e 99.` };
  return { ok: true, value: Number((n / 100).toFixed(4)) };
}

export async function setRecipePrice(
  recipeId: string,
  rawPrice: string,
): Promise<{ ok: true; price: number } | { ok: false; error: string }> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };

  const id = z.uuid().safeParse(recipeId);
  const text = parseDecimal(rawPrice);
  const price = text === null ? NaN : Number(text);
  if (!id.success || !(price > 0) || price > 100_000) return { ok: false, error: "Digite o preço, como 18,90." };

  const unit = await activeUnit(); // a unidade vem do servidor, nunca do navegador
  if (!unit) return { ok: false, error: "Sua marmitaria ainda não tem unidade cadastrada." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe_prices")
    .upsert({ recipe_id: id.data, unit_id: unit.id, org_id: orgId, current_price: Number(price.toFixed(2)) }, { onConflict: "recipe_id,unit_id" })
    .select("current_price")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível salvar o preço." };

  revalidatePath("/precificacao");
  return { ok: true, price: Number(data.current_price) };
}

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { error: NO_PERMISSION };

  const tax = percent(formData.get("tax"), "Impostos");
  const fixed = percent(formData.get("fixed"), "Despesas fixas");
  const profit = percent(formData.get("profit"), "Lucro desejado");
  const min = percent(formData.get("min_margin"), "Margem mínima");
  for (const f of [tax, fixed, profit, min]) if (!f.ok) return { error: f.error };
  if (!tax.ok || !fixed.ok || !profit.ok || !min.ok) return { error: "Confira os campos." };

  const unit = await activeUnit();
  if (!unit) return { error: "Sua marmitaria ainda não tem unidade cadastrada." };

  const supabase = await createClient();
  const { error } = await supabase.from("unit_settings").upsert(
    {
      unit_id: unit.id,
      org_id: orgId,
      tax_pct: tax.value,
      fixed_expense_pct: fixed.value,
      profit_pct: profit.value,
      min_margin_pct: min.value,
    },
    { onConflict: "unit_id" },
  );
  if (error) return { error: "Não foi possível salvar os ajustes." };

  revalidatePath("/precificacao");
  return { ok: "Ajustes salvos." };
}

const channelInput = (formData: FormData) => {
  const name = String(formData.get("name") ?? "").trim();
  const fee = percent(formData.get("fee"), "Taxa");
  if (!name || name.length > 40) return { ok: false, error: "Dê um nome ao canal (até 40 letras)." } as const;
  if (!fee.ok) return fee;
  return { ok: true, name, fee: fee.value } as const;
};

export async function addChannel(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { error: NO_PERMISSION };
  const input = channelInput(formData);
  if (!input.ok) return { error: input.error };

  const unit = await activeUnit();
  if (!unit) return { error: "Sua marmitaria ainda não tem unidade cadastrada." };

  const supabase = await createClient();
  const { error } = await supabase.from("sales_channels").insert({ org_id: orgId, unit_id: unit.id, name: input.name, fee_pct: input.fee });
  if (error) return { error: error.code === "23505" ? "Já existe um canal com esse nome." : "Não foi possível adicionar o canal." };

  revalidatePath("/precificacao");
  return { ok: `${input.name} adicionado.` };
}

export async function updateChannel(_prev: FormState, formData: FormData): Promise<FormState> {
  const { canWrite } = await requireMember();
  if (!canWrite) return { error: NO_PERMISSION };
  const id = z.uuid().safeParse(formData.get("id"));
  const input = channelInput(formData);
  if (!id.success) return { error: "Canal inválido." };
  if (!input.ok) return { error: input.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("sales_channels").update({ name: input.name, fee_pct: input.fee }).eq("id", id.data).select("id").maybeSingle();
  if (error || !data) return { error: error?.code === "23505" ? "Já existe um canal com esse nome." : "Não foi possível salvar." };

  revalidatePath("/precificacao");
  return { ok: "Salvo." };
}

export async function deleteChannel(formData: FormData): Promise<void> {
  const { canWrite } = await requireMember();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!canWrite || !id.success) return;

  const supabase = await createClient();
  await supabase.from("sales_channels").delete().eq("id", id.data);
  revalidatePath("/precificacao");
}
