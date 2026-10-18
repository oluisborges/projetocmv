"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { isPurchaseUnit, toBaseQty } from "@/lib/calc";
import { parseDecimal } from "@/lib/format";
import { monthStart } from "@/lib/month-view";
import { activeUnit } from "@/lib/pricing-data";
import { createClient } from "@/lib/supabase/server";

const NO_PERMISSION = "Você só tem acesso de leitura. Peça a um gerente para alterar.";

type Saved = { ok: true; qtyBase: number | null } | { ok: false; error: string };

/** Quantidade digitada (vírgula brasileira) na unidade do insumo -> unidade-base. Vazio = `null` (apagar). */
async function readQty(orgId: string, ingredientId: string, raw: string): Promise<{ qtyBase: number | null; unit: string } | { error: string }> {
  const supabase = await createClient();
  const { data: ing } = await supabase.from("ingredients").select("purchase_unit").eq("id", ingredientId).eq("org_id", orgId).maybeSingle();
  if (!ing || !isPurchaseUnit(ing.purchase_unit)) return { error: "Insumo não encontrado." };
  if (raw.trim() === "") return { qtyBase: null, unit: ing.purchase_unit };
  const parsed = parseDecimal(raw);
  const qty = parsed === null ? NaN : Number(parsed);
  if (!Number.isFinite(qty) || qty < 0 || qty > 1_000_000) return { error: `Digite a quantidade em ${ing.purchase_unit}, como 12,5.` };
  return { qtyBase: toBaseQty(qty, ing.purchase_unit).toNumber(), unit: ing.purchase_unit };
}

type Ctx = { orgId: string; unitId: string; month: string; ingredientId: string };

async function context(month: string, ingredientId: string): Promise<Ctx | { error: string }> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { error: NO_PERMISSION };
  const start = monthStart(month);
  const id = z.uuid().safeParse(ingredientId);
  if (!start || !id.success) return { error: "Dados inválidos." };
  const unit = await activeUnit(orgId);
  if (!unit) return { error: "Sua marmitaria ainda não tem unidade cadastrada." };
  return { orgId, unitId: unit.id, month: start, ingredientId: id.data };
}

/** Contagem do estoque no fim do mês (na unidade do insumo). Vazio apaga a contagem. */
export async function saveStockCount(month: string, ingredientId: string, rawQty: string): Promise<Saved> {
  const c = await context(month, ingredientId);
  if ("error" in c) return { ok: false, error: c.error };
  const q = await readQty(c.orgId, c.ingredientId, rawQty);
  if ("error" in q) return { ok: false, error: q.error };

  const supabase = await createClient();
  if (q.qtyBase === null) {
    await supabase.from("ingredient_stock_counts").delete().eq("unit_id", c.unitId).eq("ingredient_id", c.ingredientId).eq("month", c.month);
  } else {
    const { error } = await supabase
      .from("ingredient_stock_counts")
      .upsert({ org_id: c.orgId, unit_id: c.unitId, ingredient_id: c.ingredientId, month: c.month, qty_base: q.qtyBase }, { onConflict: "unit_id,ingredient_id,month" });
    if (error) return { ok: false, error: "Não foi possível salvar." };
  }
  revalidatePath("/mes/estoque");
  return { ok: true, qtyBase: q.qtyBase };
}

/** Quanto o dono comprou do insumo no mês SEM nota fiscal importada (as notas somam sozinhas). Vazio apaga. */
export async function saveManualPurchase(month: string, ingredientId: string, rawQty: string): Promise<Saved> {
  const c = await context(month, ingredientId);
  if ("error" in c) return { ok: false, error: c.error };
  const q = await readQty(c.orgId, c.ingredientId, rawQty);
  if ("error" in q) return { ok: false, error: q.error };

  const supabase = await createClient();
  const existing = supabase.from("ingredient_purchases").select("id").eq("unit_id", c.unitId).eq("ingredient_id", c.ingredientId).eq("month", c.month).eq("source", "manual");
  const { data: row } = await existing.maybeSingle();
  if (q.qtyBase === null || q.qtyBase === 0) {
    if (row) await supabase.from("ingredient_purchases").delete().eq("id", row.id).eq("org_id", c.orgId);
  } else if (row) {
    const { error } = await supabase.from("ingredient_purchases").update({ qty_base: q.qtyBase }).eq("id", row.id).eq("org_id", c.orgId);
    if (error) return { ok: false, error: "Não foi possível salvar." };
  } else {
    const { error } = await supabase.from("ingredient_purchases").insert({ org_id: c.orgId, unit_id: c.unitId, ingredient_id: c.ingredientId, month: c.month, qty_base: q.qtyBase, amount: 0, source: "manual" });
    if (error) return { ok: false, error: "Não foi possível salvar." };
  }
  revalidatePath("/mes/estoque");
  return { ok: true, qtyBase: q.qtyBase };
}

/** Valor, ao custo, das marmitas prontas que sobraram no freezer no fim do mês. Vazio apaga. */
export async function saveFinishedStock(month: string, rawValue: string): Promise<{ ok: true; value: number | null } | { ok: false; error: string }> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };
  const start = monthStart(month);
  const unit = await activeUnit(orgId);
  if (!start || !unit) return { ok: false, error: "Dados inválidos." };

  let value: number | null = null;
  if (rawValue.trim() !== "") {
    const parsed = parseDecimal(rawValue);
    value = parsed === null ? NaN : Number(parsed);
    if (!Number.isFinite(value) || value < 0 || value > 100_000_000) return { ok: false, error: "Digite um valor em reais, como 3500." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("periods").upsert({ org_id: orgId, unit_id: unit.id, month: start, finished_stock_value: value }, { onConflict: "unit_id,month" });
  if (error) return { ok: false, error: "Não foi possível salvar." };
  revalidatePath("/mes/estoque");
  return { ok: true, value };
}
