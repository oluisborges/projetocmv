"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { productionNeeds } from "@/lib/calc";
import { activeUnit } from "@/lib/pricing-data";
import { loadProductionBase } from "@/lib/production-data";
import { createClient } from "@/lib/supabase/server";
import { isMonday } from "@/lib/week";
import type { Result } from "../marmitas/actions";

const NO_PERMISSION = "Você só tem acesso de leitura. Peça a um gerente para alterar.";

type Context = { ok: true; orgId: string; unitId: string } | { ok: false; error: string };

async function context(): Promise<Context> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };
  const unit = await activeUnit(orgId);
  if (!unit) return { ok: false, error: "Sua marmitaria ainda não tem uma unidade cadastrada." };
  return { ok: true, orgId, unitId: unit.id };
}

const planInput = z.object({
  weekStart: z.string().refine(isMonday, "Semana inválida."),
  items: z.array(z.object({ recipeId: z.uuid(), planned: z.number().int().min(0).max(100_000), suggested: z.number().int().min(0).max(100_000).nullable() })).max(300),
  confirm: z.boolean(),
  note: z.string().max(500).optional(),
});

/** Salva o plano da semana (rascunho) ou já confirma. Não mexe em plano cuja produção já foi registrada. */
export async function savePlan(input: z.input<typeof planInput>): Promise<Result<{ planId: string }>> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const parsed = planInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Plano inválido." };
  const v = parsed.data;
  const items = v.items.filter((i) => i.planned > 0);
  if (v.confirm && items.length === 0) return { ok: false, error: "Coloque ao menos uma marmita no plano para confirmar." };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("production_plans").select("id, status").eq("org_id", ctx.orgId).eq("unit_id", ctx.unitId).eq("week_start", v.weekStart).maybeSingle();
  if (existing?.status === "produced") return { ok: false, error: "A produção desta semana já foi registrada. Não dá mais para mudar o plano." };

  const patch = { status: v.confirm ? "confirmed" : "draft", confirmed_at: v.confirm ? new Date().toISOString() : null, note: v.note?.trim() || null };
  let planId = existing?.id as string | undefined;
  if (planId) {
    const { error } = await supabase.from("production_plans").update(patch).eq("id", planId).eq("org_id", ctx.orgId);
    if (error) return { ok: false, error: "Não foi possível salvar o plano." };
  } else {
    const { data, error } = await supabase.from("production_plans").insert({ org_id: ctx.orgId, unit_id: ctx.unitId, week_start: v.weekStart, ...patch }).select("id").single();
    if (error || !data) return { ok: false, error: "Não foi possível salvar o plano." };
    planId = data.id as string;
  }

  const { error: delError } = await supabase.from("production_plan_items").delete().eq("org_id", ctx.orgId).eq("plan_id", planId);
  if (delError) return { ok: false, error: "Não foi possível salvar o plano." };
  if (items.length > 0) {
    const { error } = await supabase.from("production_plan_items").insert(items.map((i) => ({ org_id: ctx.orgId, plan_id: planId, recipe_id: i.recipeId, planned_qty: i.planned, suggested_qty: i.suggested })));
    if (error) return { ok: false, error: "Não foi possível salvar as marmitas do plano." };
  }

  revalidatePath("/producao");
  return { ok: true, planId };
}

/** Volta um plano confirmado para rascunho (para ajustar de novo). */
export async function reopenPlan(planId: string): Promise<Result> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const id = z.uuid().safeParse(planId);
  if (!id.success) return { ok: false, error: "Plano inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("production_plans").update({ status: "draft", confirmed_at: null }).eq("id", id.data).eq("org_id", ctx.orgId).eq("status", "confirmed").select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível reabrir o plano." };
  revalidatePath("/producao");
  return { ok: true };
}

const productionInput = z.object({ planId: z.uuid(), produced: z.array(z.object({ recipeId: z.uuid(), qty: z.number().int().min(0).max(100_000) })).max(300) });

/**
 * Registra o que foi produzido: as marmitas entram no estoque de prontas e os insumos (e o que as receitas gastaram)
 * saem do estoque de insumos, pelas fichas. Só uma vez por plano.
 */
export async function registerProduction(input: z.input<typeof productionInput>): Promise<Result<{ ingredients: number; marmitas: number }>> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const parsed = productionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Produção inválida." };
  const { planId, produced } = parsed.data;
  const done = produced.filter((p) => p.qty > 0);
  if (done.length === 0) return { ok: false, error: "Informe quantas marmitas saíram." };

  const supabase = await createClient();
  const { data: plan } = await supabase.from("production_plans").select("id, status").eq("id", planId).eq("org_id", ctx.orgId).eq("unit_id", ctx.unitId).maybeSingle();
  if (!plan) return { ok: false, error: "Plano não encontrado." };
  if (plan.status === "produced") return { ok: false, error: "A produção deste plano já foi registrada." };
  const { count: already } = await supabase.from("stock_movements").select("id", { count: "exact", head: true }).eq("org_id", ctx.orgId).eq("plan_id", planId);
  if ((already ?? 0) > 0) return { ok: false, error: "A produção deste plano já foi registrada." };

  const base = await loadProductionBase(ctx.orgId, true);
  if (!base) return { ok: false, error: "Não foi possível calcular os insumos." };
  const byId = new Map(base.recipes.map((r) => [r.id, r]));
  const missing = done.filter((p) => !byId.has(p.recipeId));
  if (missing.length > 0) return { ok: false, error: "Uma das marmitas está com a ficha incompleta: termine a ficha para registrar a produção." };

  const needs = productionNeeds(
    done.map((p) => ({ units: p.qty, perUnit: new Map(Object.entries(byId.get(p.recipeId)!.usage)) })),
    new Map(Object.entries(base.receitas).map(([id, r]) => [id, { readyGrams: r.readyGrams, parts: r.parts }])),
  );

  const now = new Date().toISOString();
  const rows = [
    ...[...needs.ingredients].filter(([, qty]) => qty > 0).map(([ingredientId, qty]) => ({ org_id: ctx.orgId, unit_id: ctx.unitId, ingredient_id: ingredientId, kind: "production" as const, qty_base: -qty, plan_id: planId, occurred_at: now })),
    ...done.map((p) => ({ org_id: ctx.orgId, unit_id: ctx.unitId, recipe_id: p.recipeId, kind: "produced" as const, qty_base: p.qty, plan_id: planId, occurred_at: now })),
  ];
  const { error } = await supabase.from("stock_movements").insert(rows);
  if (error) return { ok: false, error: "Não foi possível registrar a produção." };

  for (const p of produced) await supabase.from("production_plan_items").update({ produced_qty: p.qty }).eq("org_id", ctx.orgId).eq("plan_id", planId).eq("recipe_id", p.recipeId);
  await supabase.from("production_plans").update({ status: "produced", produced_at: now }).eq("id", planId).eq("org_id", ctx.orgId);

  revalidatePath("/producao");
  revalidatePath("/producao/estoque");
  return { ok: true, ingredients: needs.ingredients.size, marmitas: done.reduce((n, p) => n + p.qty, 0) };
}
