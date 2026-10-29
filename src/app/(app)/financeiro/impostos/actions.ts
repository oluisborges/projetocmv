"use server";

import { revalidatePath } from "next/cache";
import { recordSnapshot } from "@/lib/snapshot-record";
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

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { error: NO_PERMISSION };

  const tax = percent(formData.get("tax"), "Impostos");
  // Despesa fixa calculada em Custos: o campo não é enviado, e o valor digitado antes fica como está.
  const fixedSent = formData.has("fixed");
  const fixed = fixedSent ? percent(formData.get("fixed"), "Despesas fixas") : ({ ok: true, value: 0 } as const);
  // O lucro desejado saiu da tela (não há mais preço sugerido): se não vier no formulário, o valor guardado fica como está.
  const profitSent = formData.has("profit");
  const profit = profitSent ? percent(formData.get("profit"), "Lucro desejado") : ({ ok: true, value: 0 } as const);
  const min = percent(formData.get("min_margin"), "Margem mínima");
  // Campos opcionais: se não vierem no formulário, o valor guardado fica como está.
  const otherSent = formData.has("other");
  const other = otherSent ? percent(formData.get("other"), "Outras taxas") : ({ ok: true, value: 0 } as const);
  const safetySent = formData.has("safety");
  const safety = safetySent ? percent(formData.get("safety"), "Margem de segurança") : ({ ok: true, value: 0 } as const);
  for (const f of [tax, fixed, profit, min, other, safety]) if (!f.ok) return { error: f.error };
  if (!tax.ok || !fixed.ok || !profit.ok || !min.ok || !other.ok || !safety.ok) return { error: "Confira os campos." };

  const unit = await activeUnit(orgId);
  if (!unit) return { error: "Sua marmitaria ainda não tem unidade cadastrada." };

  const supabase = await createClient();
  const { error } = await supabase.from("unit_settings").upsert(
    {
      unit_id: unit.id,
      org_id: orgId,
      tax_pct: tax.value,
      ...(fixedSent ? { fixed_expense_pct: fixed.value } : {}),
      ...(profitSent ? { profit_pct: profit.value } : {}),
      min_margin_pct: min.value,
      ...(otherSent ? { other_pct: other.value } : {}),
      ...(safetySent ? { safety_margin_pct: safety.value } : {}),
      configured_at: new Date().toISOString(),
    },
    { onConflict: "unit_id" },
  );
  if (error) return { error: "Não foi possível salvar os ajustes." };

  recordSnapshot();
  revalidatePath("/financeiro/impostos");
  revalidatePath("/cardapio");
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

  const unit = await activeUnit(orgId);
  if (!unit) return { error: "Sua marmitaria ainda não tem unidade cadastrada." };

  const supabase = await createClient();
  const { error } = await supabase.from("sales_channels").insert({ org_id: orgId, unit_id: unit.id, name: input.name, fee_pct: input.fee });
  if (error) return { error: error.code === "23505" ? "Já existe um canal com esse nome." : "Não foi possível adicionar o canal." };

  recordSnapshot();
  revalidatePath("/financeiro/impostos");
  revalidatePath("/cardapio");
  return { ok: `${input.name} adicionado.` };
}

export async function updateChannel(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { error: NO_PERMISSION };
  const id = z.uuid().safeParse(formData.get("id"));
  const input = channelInput(formData);
  if (!id.success) return { error: "Canal inválido." };
  if (!input.ok) return { error: input.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("sales_channels").update({ name: input.name, fee_pct: input.fee }).eq("id", id.data).eq("org_id", orgId).select("id").maybeSingle();
  if (error || !data) return { error: error?.code === "23505" ? "Já existe um canal com esse nome." : "Não foi possível salvar." };

  recordSnapshot();
  revalidatePath("/financeiro/impostos");
  revalidatePath("/cardapio");
  return { ok: "Salvo." };
}

export async function deleteChannel(formData: FormData): Promise<void> {
  const { orgId, canWrite } = await requireMember();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!canWrite || !id.success) return;

  const supabase = await createClient();
  await supabase.from("sales_channels").delete().eq("id", id.data).eq("org_id", orgId);
  recordSnapshot();
  revalidatePath("/financeiro/impostos");
  revalidatePath("/cardapio");
}
