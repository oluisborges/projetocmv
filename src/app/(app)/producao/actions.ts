"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { productionNeeds } from "@/lib/calc";
import { activeUnit } from "@/lib/pricing-data";
import { loadProductionBase, loadWeekPlanned, loadWeeklySales } from "@/lib/production-data";
import { suggestionRows } from "@/lib/production-view";
import { createClient } from "@/lib/supabase/server";
import { brtDate, weekStartOf } from "@/lib/week";
import type { Result } from "../cardapio/actions";
import { requireProductionAccess } from "@/lib/production-access";
import { lotCode } from "@/lib/lots";
import { syncMonthFromLedger } from "@/lib/stock-sync";
import { parseDecimal } from "@/lib/format";

const NO_PERMISSION = "Você só tem acesso de leitura. Peça a um gerente para alterar.";

type Context = { ok: true; orgId: string; unitId: string } | { ok: false; error: string };

async function context(): Promise<Context> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };
  const unit = await activeUnit(orgId);
  if (!unit) return { ok: false, error: "Sua marmitaria ainda não tem uma unidade cadastrada." };
  return { ok: true, orgId, unitId: unit.id };
}

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());

/** Começa uma produção nova: com a sugestão do sistema, repetindo a última produção ou vazia. */
export async function createProduction(formData: FormData): Promise<void> {
  await requireProductionAccess();
  const ctx = await context();
  if (!ctx.ok) return;
  const mode = formData.get("mode");
  const withSuggestion = mode !== "blank" && mode !== "repeat";
  const today = brtDate(new Date());
  const weekStart = weekStartOf(new Date());

  const supabase = await createClient();
  const { data: plan, error } = await supabase.from("production_plans").insert({ org_id: ctx.orgId, unit_id: ctx.unitId, week_start: weekStart, planned_for: today, status: "draft" }).select("id").single();
  if (error || !plan) return;

  if (withSuggestion) {
    const base = await loadProductionBase(ctx.orgId, true);
    if (base) {
      const [weekly, elsewhere] = await Promise.all([loadWeeklySales(ctx.orgId, ctx.unitId, base.hasMenu), loadWeekPlanned(ctx.orgId, ctx.unitId, weekStart, plan.id as string)]);
      const items = suggestionRows(base, weekly, elsewhere)
        .filter((r) => r.suggested > 0)
        .map((r) => ({ org_id: ctx.orgId, plan_id: plan.id as string, recipe_id: r.id, planned_qty: r.suggested, suggested_qty: r.suggested }));
      if (items.length > 0) await supabase.from("production_plan_items").insert(items);
    }
  }
  if (mode === "repeat") {
    // As quantidades da última produção (o que saiu de verdade, se já foi feita); só marmitas que ainda têm a ficha completa.
    const { data: lastPlans } = await supabase.from("production_plans").select("id").eq("org_id", ctx.orgId).eq("unit_id", ctx.unitId).neq("id", plan.id as string).order("planned_for", { ascending: false }).order("created_at", { ascending: false }).limit(10);
    const ids = (lastPlans ?? []).map((p) => p.id as string);
    if (ids.length > 0) {
      const { data: past } = await supabase.from("production_plan_items").select("plan_id, recipe_id, planned_qty, produced_qty").eq("org_id", ctx.orgId).in("plan_id", ids);
      const source = ids.find((id) => (past ?? []).some((i) => i.plan_id === id && Number(i.planned_qty) > 0));
      const base = await loadProductionBase(ctx.orgId, true);
      if (source && base) {
        const ready = new Set(base.recipes.map((r) => r.id));
        const items = (past ?? [])
          .filter((i) => i.plan_id === source && ready.has(i.recipe_id as string))
          .map((i) => ({ org_id: ctx.orgId, plan_id: plan.id as string, recipe_id: i.recipe_id as string, planned_qty: Number(i.produced_qty ?? i.planned_qty), suggested_qty: null }))
          .filter((i) => i.planned_qty > 0);
        if (items.length > 0) await supabase.from("production_plan_items").insert(items);
      }
    }
  }
  revalidatePath("/producao");
  redirect(`/producao/${plan.id}`);
}

const updateInput = z.object({
  id: z.uuid(),
  name: z.string().trim().max(80).optional(),
  plannedFor: z.string().refine(isDate, "Data inválida.").optional(),
  items: z.array(z.object({ recipeId: z.uuid(), planned: z.number().int().min(0).max(100_000) })).max(300),
});

/** Salva a produção (nome, dia e quantidades). Chamada sozinha enquanto a pessoa edita. */
export async function updateProduction(input: z.input<typeof updateInput>): Promise<Result> {
  await requireProductionAccess();
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const parsed = updateInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Produção inválida." };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: plan } = await supabase.from("production_plans").select("id, status").eq("id", v.id).eq("org_id", ctx.orgId).eq("unit_id", ctx.unitId).maybeSingle();
  if (!plan) return { ok: false, error: "Produção não encontrada." };
  if (plan.status === "produced") return { ok: false, error: "Esta produção já foi feita e não pode mais ser alterada." };

  const patch: Record<string, unknown> = { name: v.name ? v.name : null };
  if (v.plannedFor) {
    patch.planned_for = v.plannedFor;
    patch.week_start = weekStartOf(new Date(`${v.plannedFor}T12:00:00Z`));
  }
  const { error } = await supabase.from("production_plans").update(patch).eq("id", v.id).eq("org_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível salvar." };

  // Guarda o que foi sugerido para comparar depois; muda só as quantidades decididas pela pessoa.
  const { data: current } = await supabase.from("production_plan_items").select("recipe_id, suggested_qty").eq("org_id", ctx.orgId).eq("plan_id", v.id);
  const suggested = new Map((current ?? []).map((i) => [i.recipe_id as string, i.suggested_qty as number | null]));
  const items = v.items.filter((i) => i.planned > 0);
  const { error: delError } = await supabase.from("production_plan_items").delete().eq("org_id", ctx.orgId).eq("plan_id", v.id);
  if (delError) return { ok: false, error: "Não foi possível salvar." };
  if (items.length > 0) {
    const { error: insError } = await supabase.from("production_plan_items").insert(items.map((i) => ({ org_id: ctx.orgId, plan_id: v.id, recipe_id: i.recipeId, planned_qty: i.planned, suggested_qty: suggested.get(i.recipeId) ?? null })));
    if (insError) return { ok: false, error: "Não foi possível salvar." };
  }
  revalidatePath("/producao");
  return { ok: true };
}

/** Apaga uma produção que ainda não foi feita. */
export async function deleteProduction(formData: FormData): Promise<void> {
  await requireProductionAccess();
  const ctx = await context();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!ctx.ok || !id.success) return;
  const supabase = await createClient();
  const { data: plan } = await supabase.from("production_plans").select("status").eq("id", id.data).eq("org_id", ctx.orgId).maybeSingle();
  if (!plan || plan.status === "produced") return;
  // As compras marcadas nesta produção continuam valendo no estoque (o dinheiro já foi gasto); só saem do vínculo.
  await supabase.from("production_plans").delete().eq("id", id.data).eq("org_id", ctx.orgId);
  revalidatePath("/producao");
  redirect("/producao");
}

const paidInput = z.object({ planId: z.uuid(), ingredientId: z.uuid(), paid: z.string().max(20) });

/** Quanto a pessoa pagou numa compra marcada na lista (vazio apaga o valor). */
export async function setPurchasePaid(input: z.input<typeof paidInput>): Promise<Result> {
  await requireProductionAccess();
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const parsed = paidInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Valor inválido." };
  const text = parsed.data.paid.trim();
  let paid: number | null = null;
  if (text !== "") {
    const p = parseDecimal(text);
    paid = p === null ? NaN : Number(p);
    if (!Number.isFinite(paid) || paid < 0 || paid > 10_000_000) return { ok: false, error: "Digite um valor, como 48,90." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("stock_movements").update({ paid_amount: paid }).eq("org_id", ctx.orgId).eq("plan_id", parsed.data.planId).eq("ingredient_id", parsed.data.ingredientId).eq("kind", "purchase").select("id");
  if (error || !data?.length) return { ok: false, error: "Marque a compra primeiro e tente de novo." };
  revalidatePath("/producao/estoque/movimentos");
  return { ok: true };
}

const boughtInput = z.object({ planId: z.uuid(), ingredientId: z.uuid(), bought: z.boolean(), qtyBase: z.number().positive().max(100_000_000) });

/** Marcar um item da lista de compras como comprado dá entrada no estoque; desmarcar desfaz. */
export async function setBought(input: z.input<typeof boughtInput>): Promise<Result> {
  await requireProductionAccess();
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const parsed = boughtInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Item inválido." };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: plan } = await supabase.from("production_plans").select("id").eq("id", v.planId).eq("org_id", ctx.orgId).eq("unit_id", ctx.unitId).maybeSingle();
  if (!plan) return { ok: false, error: "Produção não encontrada." };

  if (v.bought) {
    const { count } = await supabase.from("stock_movements").select("id", { count: "exact", head: true }).eq("org_id", ctx.orgId).eq("plan_id", v.planId).eq("ingredient_id", v.ingredientId).eq("kind", "purchase");
    if ((count ?? 0) === 0) {
      const { error } = await supabase.from("stock_movements").insert({ org_id: ctx.orgId, unit_id: ctx.unitId, ingredient_id: v.ingredientId, kind: "purchase", qty_base: v.qtyBase, plan_id: v.planId });
      if (error) return { ok: false, error: "Não foi possível marcar como comprado." };
    }
  } else {
    const { error } = await supabase.from("stock_movements").delete().eq("org_id", ctx.orgId).eq("plan_id", v.planId).eq("ingredient_id", v.ingredientId).eq("kind", "purchase");
    if (error) return { ok: false, error: "Não foi possível desmarcar." };
  }
  await syncMonthFromLedger(ctx.orgId, ctx.unitId, { ingredientIds: [v.ingredientId] });
  revalidatePath("/producao/estoque");
  revalidatePath("/producao/estoque/historico");
  return { ok: true };
}

const productionInput = z.object({ planId: z.uuid(), produced: z.array(z.object({ recipeId: z.uuid(), qty: z.number().int().min(0).max(100_000) })).max(300), /** Validade das marmitas deste lote ("2027-02-05"); vazio = sem controle de validade. */ expiresOn: z.string().refine(isDate, "Validade inválida.").nullable().optional() });

/**
 * "Já fiz": as marmitas entram no estoque de prontas e os insumos (e o que as receitas gastaram) saem do estoque, pelas fichas.
 * Só uma vez por produção.
 */
export async function registerProduction(input: z.input<typeof productionInput>): Promise<Result<{ ingredients: number; marmitas: number }>> {
  await requireProductionAccess();
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const parsed = productionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Produção inválida." };
  const { planId, produced, expiresOn } = parsed.data;
  const done = produced.filter((p) => p.qty > 0);
  if (done.length === 0) return { ok: false, error: "Informe quantas marmitas saíram." };

  const supabase = await createClient();
  const { data: plan } = await supabase.from("production_plans").select("id, status").eq("id", planId).eq("org_id", ctx.orgId).eq("unit_id", ctx.unitId).maybeSingle();
  if (!plan) return { ok: false, error: "Produção não encontrada." };
  if (plan.status === "produced") return { ok: false, error: "Esta produção já foi feita." };

  const base = await loadProductionBase(ctx.orgId, true);
  if (!base) return { ok: false, error: "Não foi possível calcular os insumos." };
  const byId = new Map(base.recipes.map((r) => [r.id, r]));
  if (done.some((p) => !byId.has(p.recipeId))) return { ok: false, error: "Uma das marmitas está com a ficha incompleta: termine a ficha para dar baixa." };

  const needs = productionNeeds(
    done.map((p) => ({ units: p.qty, perUnit: new Map(Object.entries(byId.get(p.recipeId)!.usage)) })),
    new Map(Object.entries(base.receitas).map(([id, r]) => [id, { readyGrams: r.readyGrams, parts: r.parts }])),
  );

  const now = new Date().toISOString();
  const rows = [
    ...[...needs.ingredients].filter(([, qty]) => qty > 0).map(([ingredientId, qty]) => ({ org_id: ctx.orgId, unit_id: ctx.unitId, ingredient_id: ingredientId, kind: "production" as const, qty_base: -qty, plan_id: planId, occurred_at: now })),
    ...done.map((p) => ({ org_id: ctx.orgId, unit_id: ctx.unitId, recipe_id: p.recipeId, kind: "produced" as const, qty_base: p.qty, plan_id: planId, occurred_at: now })),
  ];
  // Marcar como feita primeiro (com a condição de ainda não estar feita) evita baixar duas vezes se a pessoa tocar duas vezes.
  const { data: claimed } = await supabase.from("production_plans").update({ status: "produced", produced_at: now }).eq("id", planId).eq("org_id", ctx.orgId).neq("status", "produced").select("id").maybeSingle();
  if (!claimed) return { ok: false, error: "Esta produção já foi feita." };
  const { error } = await supabase.from("stock_movements").insert(rows);
  if (error) {
    await supabase.from("production_plans").update({ status: "draft", produced_at: null }).eq("id", planId).eq("org_id", ctx.orgId);
    return { ok: false, error: "Não foi possível dar baixa no estoque." };
  }
  for (const p of produced) await supabase.from("production_plan_items").update({ produced_qty: p.qty }).eq("org_id", ctx.orgId).eq("plan_id", planId).eq("recipe_id", p.recipeId);

  // Um lote por produto, com o dia e a validade. Auxiliar: se não salvar, a produção continua valendo (o saldo vem do livro de estoque).
  const producedOn = brtDate(new Date(now));
  await supabase.from("finished_lots").insert(
    done.map((p) => ({ org_id: ctx.orgId, unit_id: ctx.unitId, recipe_id: p.recipeId, plan_id: planId, code: lotCode(producedOn), qty: p.qty, produced_on: producedOn, expires_on: expiresOn && expiresOn >= producedOn ? expiresOn : null })),
  );

  await syncMonthFromLedger(ctx.orgId, ctx.unitId, { ingredientIds: [...needs.ingredients.keys()], finished: true });
  revalidatePath("/producao");
  revalidatePath("/producao/estoque");
  revalidatePath("/producao/estoque/historico");
  return { ok: true, ingredients: needs.ingredients.size, marmitas: done.reduce((n, p) => n + p.qty, 0) };
}
