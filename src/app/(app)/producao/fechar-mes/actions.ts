"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { parseDecimal } from "@/lib/format";
import { monthStart } from "@/lib/month-view";
import { activeUnit } from "@/lib/pricing-data";
import { createClient } from "@/lib/supabase/server";
import { requireProductionAccess } from "@/lib/production-access";

export type FormState = { error?: string; ok?: string };

const NO_PERMISSION = "Você só tem acesso de leitura. Peça a um gerente para alterar.";

/** Valor em R$ (zero vale: mês sem compras). Vazio = 0. */
function amount(raw: unknown, label: string): { ok: true; value: number } | { ok: false; error: string } {
  const text = String(raw ?? "").trim();
  if (text === "") return { ok: true, value: 0 };
  const s = parseDecimal(text);
  const n = s === null ? NaN : Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return { ok: false, error: `${label}: digite um valor em reais, como 60000.` };
  return { ok: true, value: n };
}

/** Garante a linha do mês (sem mexer nos valores se já existir) e devolve o id. */
async function ensurePeriod(orgId: string, unitId: string, month: string): Promise<string | null> {
  const supabase = await createClient();
  await supabase.from("periods").upsert({ org_id: orgId, unit_id: unitId, month }, { onConflict: "unit_id,month", ignoreDuplicates: true });
  const { data } = await supabase.from("periods").select("id").eq("unit_id", unitId).eq("month", month).maybeSingle();
  return data?.id ?? null;
}

export async function savePeriod(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireProductionAccess();
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { error: NO_PERMISSION };

  const month = monthStart(String(formData.get("month") ?? ""));
  const revenue = amount(formData.get("revenue"), "Faturamento");
  const purchases = amount(formData.get("purchases"), "Compras de insumos");
  if (!month) return { error: "Mês inválido." };
  if (!revenue.ok) return { error: revenue.error };
  if (!purchases.ok) return { error: purchases.error };

  const unit = await activeUnit(orgId);
  if (!unit) return { error: "Sua marmitaria ainda não tem unidade cadastrada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("periods")
    .upsert({ org_id: orgId, unit_id: unit.id, month, revenue: revenue.value, purchases: purchases.value }, { onConflict: "unit_id,month" });
  if (error) return { error: "Não foi possível salvar." };

  revalidatePath("/producao/fechar-mes");
  return { ok: "Salvo." };
}

export async function setComboSoldQty(month: string, comboId: string, rawQty: string): Promise<{ ok: true; qty: number } | { ok: false; error: string }> {
  await requireProductionAccess();
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };

  const start = monthStart(month);
  const id = z.uuid().safeParse(comboId);
  const text = rawQty.trim() === "" ? "0" : parseDecimal(rawQty);
  const qty = text === null ? NaN : Number(text);
  if (!start || !id.success) return { ok: false, error: "Dados inválidos." };
  if (!Number.isFinite(qty) || qty < 0 || qty > 10_000_000) return { ok: false, error: "Digite quantos combos vendeu, como 40." };
  if (!Number.isInteger(qty)) return { ok: false, error: "Digite um número inteiro de combos (sem vírgula)." };

  const unit = await activeUnit(orgId);
  if (!unit) return { ok: false, error: "Sua marmitaria ainda não tem unidade cadastrada." };
  const periodId = await ensurePeriod(orgId, unit.id, start);
  if (!periodId) return { ok: false, error: "Não foi possível abrir o mês." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("period_combo_sales")
    .upsert({ period_id: periodId, combo_id: id.data, org_id: orgId, qty_sold: Math.round(qty) }, { onConflict: "period_id,combo_id" })
    .select("qty_sold")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível salvar." };

  revalidatePath("/producao/fechar-mes");
  return { ok: true, qty: Number(data.qty_sold) };
}

export async function setSoldQty(month: string, recipeId: string, rawQty: string): Promise<{ ok: true; qty: number } | { ok: false; error: string }> {
  await requireProductionAccess();
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };

  const start = monthStart(month);
  const id = z.uuid().safeParse(recipeId);
  const text = rawQty.trim() === "" ? "0" : parseDecimal(rawQty);
  const qty = text === null ? NaN : Number(text);
  if (!start || !id.success) return { ok: false, error: "Dados inválidos." };
  if (!Number.isFinite(qty) || qty < 0 || qty > 10_000_000) return { ok: false, error: "Digite quantas unidades vendeu, como 120." };
  if (!Number.isInteger(qty)) return { ok: false, error: "Digite um número inteiro de unidades (sem vírgula)." };

  const unit = await activeUnit(orgId);
  if (!unit) return { ok: false, error: "Sua marmitaria ainda não tem unidade cadastrada." };
  const periodId = await ensurePeriod(orgId, unit.id, start);
  if (!periodId) return { ok: false, error: "Não foi possível abrir o mês." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("period_sales")
    .upsert({ period_id: periodId, recipe_id: id.data, org_id: orgId, qty_sold: Math.round(qty) }, { onConflict: "period_id,recipe_id" })
    .select("qty_sold")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível salvar." };

  revalidatePath("/producao/fechar-mes");
  return { ok: true, qty: Number(data.qty_sold) };
}
