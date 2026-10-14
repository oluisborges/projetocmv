"use server";

import { revalidatePath } from "next/cache";
import { recordSnapshot } from "@/lib/snapshot-record";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession, requireMember } from "@/lib/auth";
import { normalizeName } from "@/lib/names";
import { baseUnitOf, isPurchaseUnit } from "@/lib/calc";
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
  const { orgId, canWrite } = await requireMember();
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
    .eq("org_id", orgId)
    .select("purchase_price")
    .maybeSingle();

  if (error || !data) return { ok: false, error: "Não foi possível salvar. Tente de novo." };
  recordSnapshot();
  revalidatePath("/insumos");
  return { ok: true, price: Number(data.purchase_price) };
}

type IngredientInput = {
  cooking_yield: number;
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
  // Rendimento depois de pronto: "1 kg cru vira quantos kg?" (arroz 2,5; frango 0,75). Vazio = 1. Embalagem não rende.
  const yieldText = String(formData.get("cooking_yield") ?? "").trim();
  const cookingYield = kind === "embalagem" || yieldText === "" ? 1 : Number(parseDecimal(yieldText) ?? NaN);

  if (!name || name.length > 80) return { ok: false, error: "Dê um nome ao insumo (até 80 letras)." };
  if (!(UNITS as readonly string[]).includes(unit)) return { ok: false, error: "Escolha a unidade de compra." };
  if (!(KINDS as readonly string[]).includes(kind)) return { ok: false, error: "Tipo inválido." };
  if (qty === null) return { ok: false, error: "Informe quanto vem na compra (ex.: 1 para 1 kg, 100 para 100 unidades)." };
  if (price === null) return { ok: false, error: "Informe o preço pago, como 14,50." };
  if (fc === null || fc < 1 || fc > 10) return { ok: false, error: "O fator de correção precisa ser 1 ou mais (ex.: 1,15)." };
  if (category && category.length > 40) return { ok: false, error: "Categoria muito longa." };
  if (!Number.isFinite(cookingYield) || cookingYield < 0.1 || cookingYield > 10) {
    return { ok: false, error: "Depois de pronto, 1 kg vira quantos kg? Digite entre 0,1 e 10. Ex.: 2,5 para arroz, 0,75 para frango, 1 se não muda." };
  }

  return {
    ok: true,
    value: {
      name,
      kind,
      category,
      purchase_unit: unit,
      purchase_qty: qty,
      purchase_price: price,
      correction_factor: fc,
      cooking_yield: Number(cookingYield.toFixed(3)),
    },
  };
}

/** Insumo ativo da marmitaria com o mesmo nome (sem contar maiúsculas, acentos nem espaços); `exceptId` ignora o próprio item ao editar. */
async function findSameName(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string, name: string, exceptId?: string): Promise<string | null> {
  const wanted = normalizeName(name);
  const { data } = await supabase.from("ingredients").select("id, name").eq("org_id", orgId).is("archived_at", null);
  const hit = (data ?? []).find((i) => i.id !== exceptId && normalizeName(i.name as string) === wanted);
  return hit ? (hit.name as string) : null;
}

const duplicateMessage = (existing: string, typed: string) =>
  `Você já tem "${existing}". Use o que já existe. Se for outra marca, coloque a marca no nome (por exemplo, "${typed.trim()} Tio João").`;

/** Como o insumo se comporta no fogo (para quem cria um insumo de dentro da ficha, sem abrir o cadastro completo). */
const COOKING_CHOICES: Record<string, number> = { none: 1, grows: 2.5, shrinks: 0.75 };

export type InlineIngredient = {
  id: string;
  name: string;
  kind: "insumo" | "embalagem";
  category: string | null;
  purchase_unit: string;
  purchase_qty: number;
  purchase_price: number;
  unit_cost: number;
  correction_factor: number;
  cooking_yield: number;
};

/**
 * Cria um insumo/embalagem direto da ficha. Ele vai para a lista geral de Insumos como qualquer outro
 * (mesma regra de nome repetido) e já volta pronto para entrar na ficha.
 */
export async function createIngredientInline(input: {
  name: string;
  kind: string;
  qty: string;
  unit: string;
  price: string;
  cooking: string;
}): Promise<{ ok: true; ingredient: InlineIngredient } | { ok: false; error: string }> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };

  const fd = new FormData();
  fd.set("name", input.name);
  fd.set("kind", input.kind);
  fd.set("purchase_unit", input.unit);
  fd.set("purchase_qty", input.qty);
  fd.set("purchase_price", input.price);
  fd.set("correction_factor", "1");
  fd.set("cooking_yield", String(COOKING_CHOICES[input.cooking] ?? 1));
  const read = readIngredientForm(fd);
  if (!read.ok) return { ok: false, error: read.error };

  const supabase = await createClient();
  const same = await findSameName(supabase, orgId, read.value.name);
  if (same) return { ok: false, error: duplicateMessage(same, read.value.name) };

  const { data, error } = await supabase
    .from("ingredients")
    .insert({ ...read.value, org_id: orgId })
    .select("id, name, kind, category, purchase_unit, purchase_qty, purchase_price, unit_cost, correction_factor, cooking_yield")
    .single();
  if (error?.code === "23505") return { ok: false, error: duplicateMessage(read.value.name, read.value.name) };
  if (error || !data) return { ok: false, error: "Não foi possível criar o item." };

  recordSnapshot();
  revalidatePath("/insumos");
  return {
    ok: true,
    ingredient: {
      id: data.id,
      name: data.name,
      kind: data.kind === "embalagem" ? "embalagem" : "insumo",
      category: data.category,
      purchase_unit: data.purchase_unit,
      purchase_qty: Number(data.purchase_qty),
      purchase_price: Number(data.purchase_price),
      unit_cost: Number(data.unit_cost),
      correction_factor: Number(data.correction_factor),
      cooking_yield: Number(data.cooking_yield),
    },
  };
}

export async function createIngredient(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return fail(NO_PERMISSION);

  const read = readIngredientForm(formData);
  if (!read.ok) return fail(read.error);

  const supabase = await createClient();
  const same = await findSameName(supabase, orgId, read.value.name);
  if (same) return fail(duplicateMessage(same, read.value.name));

  const { error } = await supabase.from("ingredients").insert({ ...read.value, org_id: orgId });
  if (error?.code === "23505") return fail(duplicateMessage(read.value.name, read.value.name));
  if (error) return fail("Não foi possível salvar o insumo.");

  recordSnapshot();
  revalidatePath("/insumos");
  redirect("/insumos");
}

export async function updateIngredient(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return fail(NO_PERMISSION);

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Insumo inválido.");
  const read = readIngredientForm(formData);
  if (!read.ok) return fail(read.error);

  const supabase = await createClient();

  const same = await findSameName(supabase, orgId, read.value.name, id.data);
  if (same) return fail(duplicateMessage(same, read.value.name));

  // As fichas guardam a quantidade na unidade-base do insumo (g, ml ou un). Trocar a base, ou trocar entre
  // insumo e embalagem, de um insumo que já está numa ficha mudaria o custo dela sem ninguém perceber.
  const { data: current } = await supabase.from("ingredients").select("kind, purchase_unit").eq("id", id.data).eq("org_id", orgId).maybeSingle();
  if (!current) return fail("Insumo não encontrado.");
  const baseOf = (u: string) => (isPurchaseUnit(u) ? baseUnitOf(u) : u);
  const changesMeaning = current.kind !== read.value.kind || baseOf(current.purchase_unit) !== baseOf(read.value.purchase_unit);
  if (changesMeaning) {
    const { count, error: countError } = await supabase.from("recipe_items").select("id", { count: "exact", head: true }).eq("ingredient_id", id.data);
    if (countError) return fail("Não foi possível conferir se esse item está em alguma ficha. Tente de novo.");
    if ((count ?? 0) > 0) {
      return fail(
        `Esse item está em ${count} ${count === 1 ? "ficha" : "fichas"}. Só dá para trocar entre kg e g, ou entre litro e ml. Para mudar o tipo ou a medida de verdade, crie um item novo e troque nas fichas.`,
      );
    }
  }

  const { data, error } = await supabase.from("ingredients").update(read.value).eq("id", id.data).eq("org_id", orgId).select("id").maybeSingle();
  if (error?.code === "23514") return fail("Esse item está em fichas: não dá para mudar o tipo ou a medida dele.");
  if (error?.code === "23505") return fail(duplicateMessage(read.value.name, read.value.name));
  if (error || !data) return fail("Não foi possível salvar as alterações.");

  recordSnapshot();
  revalidatePath("/insumos");
  redirect("/insumos");
}

export async function archiveIngredient(formData: FormData): Promise<void> {
  const { orgId, canWrite } = await requireMember();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!canWrite || !id.success) return;

  const supabase = await createClient();
  // Arquiva (não apaga): fichas técnicas antigas continuam funcionando.
  await supabase.from("ingredients").update({ archived_at: new Date().toISOString() }).eq("id", id.data).eq("org_id", orgId);
  recordSnapshot();
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

  recordSnapshot();
  revalidatePath("/insumos");
  const n = Number(data ?? 0);
  if (n === 0) return { ok: "Nenhum insumo com preço foi encontrado para reajustar." };
  return { ok: `${n} ${n === 1 ? "insumo reajustado" : "insumos reajustados"}.` };
}

export async function importFromCatalog(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return fail(NO_PERMISSION);

  const ids = z.array(z.uuid()).max(200).safeParse(formData.getAll("ids"));
  const recipeIds = z.array(z.uuid()).max(50).safeParse(formData.getAll("recipes"));
  if (!ids.success || !recipeIds.success || ids.data.length + recipeIds.data.length === 0) return fail("Marque pelo menos um item.");

  const supabase = await createClient();
  // As fichas prontas trazem junto os insumos e as embalagens que usam.
  const { error } = await supabase.rpc("import_template", { p_org: orgId, p_ingredient_ids: ids.data, p_recipe_ids: recipeIds.data });
  if (!error) {
    const parts = [ids.data.length > 0 ? `${ids.data.length} insumo(s)` : null, recipeIds.data.length > 0 ? `${recipeIds.data.length} ficha(s) pronta(s)` : null].filter(Boolean);
    const session = await getSession();
    if (session && parts.length > 0) {
      await supabase.from("activity_log").insert({ org_id: orgId, user_id: session.userId, by_admin: session.isPlatformAdmin, kind: "change", summary: `Importou do catálogo da Shogun: ${parts.join(" e ")}` });
    }
  }
  if (error) return fail("Não foi possível importar.");

  recordSnapshot();
  revalidatePath("/insumos");
  redirect(recipeIds.data.length > 0 ? `/insumos?importado=fichas&n=${recipeIds.data.length}` : "/insumos?importado=1");
}
