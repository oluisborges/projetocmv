"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { baseUnitOf, isCompatibleUnit, isPurchaseUnit, toBaseQty, type PurchaseUnit } from "@/lib/calc";
import { parseDecimal } from "@/lib/format";
import { activeUnit } from "@/lib/pricing-data";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "../../cardapio/actions";

const NO_PERMISSION = "Você só tem acesso de leitura. Peça a um gerente para alterar.";

/** "8,5" -> 8.5 (aceita vírgula). `null` se não for um número. */
function toNumber(text: string): number | null {
  const parsed = parseDecimal(text);
  if (parsed === null) return null;
  const n = Number(parsed);
  return Number.isFinite(n) ? n : null;
}

type Context = { ok: true; orgId: string; unitId: string } | { ok: false; error: string };

async function context(): Promise<Context> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };
  const unit = await activeUnit(orgId);
  if (!unit) return { ok: false, error: "Sua marmitaria ainda não tem uma unidade cadastrada." };
  return { ok: true, orgId, unitId: unit.id };
}

const countItem = z.object({ ingredientId: z.uuid(), text: z.string().max(30), unit: z.string().max(4) });

/** Quantidade digitada na unidade que o dono vê (kg, g, l, ml, un) -> unidade-base do insumo. */
function toBaseFor(purchaseUnit: string, text: string, unit: string, { allowZero }: { allowZero: boolean }): { qty: number } | { error: string } {
  const n = toNumber(text);
  if (n === null || n < 0 || (!allowZero && n === 0)) return { error: allowZero ? "Digite uma quantidade (pode ser zero)." : "Digite uma quantidade maior que zero." };
  if (!isPurchaseUnit(unit) || !isPurchaseUnit(purchaseUnit) || !isCompatibleUnit(unit, baseUnitOf(purchaseUnit))) return { error: "Essa unidade não combina com o insumo." };
  const base = toBaseQty(n, unit as PurchaseUnit).toNumber();
  if (base > 100_000_000) return { error: "Quantidade muito grande." };
  return { qty: base };
}

/** Contagem do estoque: o que há de verdade agora. Salva só as linhas preenchidas. */
export async function saveStockCounts(input: { counts: { ingredientId: string; text: string; unit: string }[] }): Promise<Result<{ saved: number }>> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const parsed = z.array(countItem).max(500).safeParse(input.counts);
  if (!parsed.success) return { ok: false, error: "Contagem inválida." };
  const filled = parsed.data.filter((c) => c.text.trim() !== "");
  if (filled.length === 0) return { ok: false, error: "Preencha ao menos um insumo." };

  const supabase = await createClient();
  const { data: ings } = await supabase.from("ingredients").select("id, purchase_unit").eq("org_id", ctx.orgId).in("id", filled.map((c) => c.ingredientId));
  const unitOf = new Map((ings ?? []).map((i) => [i.id as string, i.purchase_unit as string]));
  const rows: { org_id: string; unit_id: string; ingredient_id: string; kind: "count"; qty_base: number }[] = [];
  for (const c of filled) {
    const pu = unitOf.get(c.ingredientId);
    if (!pu) return { ok: false, error: "Um dos insumos não foi encontrado." };
    const base = toBaseFor(pu, c.text, c.unit, { allowZero: true });
    if ("error" in base) return { ok: false, error: base.error };
    rows.push({ org_id: ctx.orgId, unit_id: ctx.unitId, ingredient_id: c.ingredientId, kind: "count", qty_base: base.qty });
  }
  const { error } = await supabase.from("stock_movements").insert(rows);
  if (error) return { ok: false, error: "Não foi possível salvar a contagem." };

  revalidatePath("/producao/estoque");
  revalidatePath("/producao/calcular");
  return { ok: true, saved: rows.length };
}

const moveInput = z.object({
  ingredientId: z.uuid(),
  kind: z.enum(["count", "purchase", "waste"]),
  text: z.string().max(30),
  unit: z.string().max(4),
  note: z.string().max(200).optional(),
});

/** Um movimento de um insumo: contei (valor real), comprei (+) ou perdi (−). */
export async function addIngredientMovement(input: z.input<typeof moveInput>): Promise<Result> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const parsed = moveInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Movimento inválido." };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: ing } = await supabase.from("ingredients").select("purchase_unit").eq("id", v.ingredientId).eq("org_id", ctx.orgId).maybeSingle();
  if (!ing) return { ok: false, error: "Insumo não encontrado." };
  const base = toBaseFor(ing.purchase_unit as string, v.text, v.unit, { allowZero: v.kind === "count" });
  if ("error" in base) return { ok: false, error: base.error };

  const qty = v.kind === "waste" ? -base.qty : base.qty;
  const { error } = await supabase.from("stock_movements").insert({ org_id: ctx.orgId, unit_id: ctx.unitId, ingredient_id: v.ingredientId, kind: v.kind, qty_base: qty, note: v.note?.trim() || null });
  if (error) return { ok: false, error: "Não foi possível salvar." };

  revalidatePath("/producao/estoque");
  revalidatePath("/producao/calcular");
  return { ok: true };
}

const finishedInput = z.object({ recipeId: z.uuid(), kind: z.enum(["count", "produced", "waste"]), text: z.string().max(12) });

/** Marmitas prontas (congelador): contei (valor real), produzi (+) ou perdi (−). Sempre em unidades inteiras. */
export async function addFinishedMovement(input: z.input<typeof finishedInput>): Promise<Result> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const parsed = finishedInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Movimento inválido." };
  const v = parsed.data;

  const n = toNumber(v.text);
  if (n === null || n < 0 || (v.kind !== "count" && n === 0) || n > 100_000) return { ok: false, error: v.kind === "count" ? "Digite quantas marmitas há (pode ser zero)." : "Digite quantas marmitas, maior que zero." };
  const units = Math.floor(n);

  const supabase = await createClient();
  const { data: recipe } = await supabase.from("recipes").select("id").eq("id", v.recipeId).eq("org_id", ctx.orgId).eq("kind", "marmita").maybeSingle();
  if (!recipe) return { ok: false, error: "Marmita não encontrada." };

  const { error } = await supabase
    .from("stock_movements")
    .insert({ org_id: ctx.orgId, unit_id: ctx.unitId, recipe_id: v.recipeId, kind: v.kind, qty_base: v.kind === "waste" ? -units : units });
  if (error) return { ok: false, error: "Não foi possível salvar." };

  revalidatePath("/producao/estoque");
  revalidatePath("/producao");
  return { ok: true };
}
