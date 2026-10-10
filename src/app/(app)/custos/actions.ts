"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { parseDecimal } from "@/lib/format";
import { activeUnit } from "@/lib/pricing-data";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string };
export type Result = { ok: true } | { ok: false; error: string };

const NO_PERMISSION = "Você só tem acesso de leitura. Peça a um gerente para alterar.";
const NO_UNIT = "Sua marmitaria ainda não tem unidade cadastrada.";
const AREAS = ["cozinha", "entrega", "marketing", "limpeza", "comercial", "outros"] as const;

/** Valor em reais (> 0) ou nulo se vazio. Erro se preenchido e inválido. */
function money(raw: unknown, label: string, { optional = false, max = 10_000_000 } = {}): { ok: true; value: number | null } | { ok: false; error: string } {
  const text = String(raw ?? "").trim();
  if (text === "" && optional) return { ok: true, value: null };
  const s = parseDecimal(text);
  const n = s === null ? NaN : Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > max) return { ok: false, error: `${label}: digite um valor maior que zero, como 1500.` };
  return { ok: true, value: n };
}

/** Percentual de encargos (0 a 300%) -> fração. Vazio = 0. */
function charges(raw: unknown): { ok: true; value: number } | { ok: false; error: string } {
  const text = String(raw ?? "").trim();
  if (text === "") return { ok: true, value: 0 };
  const s = parseDecimal(text);
  const n = s === null ? NaN : Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 300) return { ok: false, error: "Encargos: digite um percentual entre 0 e 300." };
  return { ok: true, value: Number((n / 100).toFixed(4)) };
}

const name80 = (raw: unknown) => {
  const v = String(raw ?? "").trim();
  return v && v.length <= 80 ? v : null;
};

export async function saveMonthlyNumbers(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { error: NO_PERMISSION };

  const revenue = money(formData.get("revenue"), "Faturamento do mês", { optional: true });
  const units = money(formData.get("units"), "Unidades por mês", { optional: true, max: 1_000_000 });
  if (!revenue.ok) return { error: revenue.error };
  if (!units.ok) return { error: units.error };
  if (units.value !== null && Math.round(units.value) < 1) return { error: "Unidades por mês: digite pelo menos 1." };

  const unit = await activeUnit(orgId);
  if (!unit) return { error: NO_UNIT };

  const supabase = await createClient();
  const { error } = await supabase.from("unit_settings").upsert(
    { unit_id: unit.id, org_id: orgId, monthly_revenue: revenue.value, monthly_units: units.value === null ? null : Math.round(units.value) },
    { onConflict: "unit_id" },
  );
  if (error) return { error: "Não foi possível salvar." };

  revalidatePath("/custos");
  revalidatePath("/precificacao");
  return { ok: "Salvo." };
}

export async function addFixedCost(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { error: NO_PERMISSION };

  const name = name80(formData.get("name"));
  const amount = money(formData.get("amount"), "Valor mensal");
  if (!name) return { error: "Dê um nome ao custo (até 80 letras)." };
  if (!amount.ok) return { error: amount.error };

  const unit = await activeUnit(orgId);
  if (!unit) return { error: NO_UNIT };

  const supabase = await createClient();
  const { error } = await supabase.from("fixed_costs").insert({ org_id: orgId, unit_id: unit.id, name, monthly_amount: amount.value });
  if (error) return { error: "Não foi possível adicionar." };

  revalidatePath("/custos");
  revalidatePath("/precificacao");
  return { ok: `${name} adicionado.` };
}

export async function updateFixedCostAmount(id: string, raw: string): Promise<Result & { amount?: number }> {
  const { canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };

  const uuid = z.uuid().safeParse(id);
  const amount = money(raw, "Valor");
  if (!uuid.success) return { ok: false, error: "Custo inválido." };
  if (!amount.ok) return { ok: false, error: amount.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("fixed_costs").update({ monthly_amount: amount.value }).eq("id", uuid.data).select("monthly_amount").maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível salvar." };

  revalidatePath("/custos");
  revalidatePath("/precificacao");
  return { ok: true, amount: Number(data.monthly_amount) };
}

export async function deleteFixedCost(formData: FormData): Promise<void> {
  const { canWrite } = await requireMember();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!canWrite || !id.success) return;

  const supabase = await createClient();
  await supabase.from("fixed_costs").delete().eq("id", id.data);
  revalidatePath("/custos");
  revalidatePath("/precificacao");
}

export async function addStaff(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { error: NO_PERMISSION };

  const name = name80(formData.get("name"));
  const area = String(formData.get("area") ?? "");
  const salary = money(formData.get("salary"), "Salário");
  const enc = charges(formData.get("charges"));
  if (!name) return { error: "Dê um nome (até 80 letras)." };
  if (!(AREAS as readonly string[]).includes(area)) return { error: "Escolha a área." };
  if (!salary.ok) return { error: salary.error };
  if (!enc.ok) return { error: enc.error };

  const unit = await activeUnit(orgId);
  if (!unit) return { error: NO_UNIT };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .insert({ org_id: orgId, unit_id: unit.id, name, area, monthly_salary: salary.value, charges_pct: enc.value });
  if (error) return { error: "Não foi possível adicionar." };

  revalidatePath("/custos");
  revalidatePath("/precificacao");
  return { ok: `${name} adicionado(a).` };
}

export async function updateStaffPay(id: string, rawSalary: string, rawCharges: string): Promise<Result & { salary?: number; charges?: number }> {
  const { canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };

  const uuid = z.uuid().safeParse(id);
  const salary = money(rawSalary, "Salário");
  const enc = charges(rawCharges);
  if (!uuid.success) return { ok: false, error: "Pessoa inválida." };
  if (!salary.ok) return { ok: false, error: salary.error };
  if (!enc.ok) return { ok: false, error: enc.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .update({ monthly_salary: salary.value, charges_pct: enc.value })
    .eq("id", uuid.data)
    .select("monthly_salary, charges_pct")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível salvar." };

  revalidatePath("/custos");
  revalidatePath("/precificacao");
  return { ok: true, salary: Number(data.monthly_salary), charges: Number(data.charges_pct) };
}

export async function deleteStaff(formData: FormData): Promise<void> {
  const { canWrite } = await requireMember();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!canWrite || !id.success) return;

  const supabase = await createClient();
  await supabase.from("staff").delete().eq("id", id.data);
  revalidatePath("/custos");
  revalidatePath("/precificacao");
}
