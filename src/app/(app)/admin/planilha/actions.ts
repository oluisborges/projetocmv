"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import readXlsxFile from "read-excel-file/node";
import { requireAdmin } from "@/lib/auth";
import { baseUnitOf, isCompatibleUnit, isPurchaseUnit, toBaseQty } from "@/lib/calc";
import { normalizeName } from "@/lib/names";
import { parseCsv, readIngredientSheet, readRecipeSheet, type Cell, type SheetIngredient, type SheetRecipe } from "@/lib/sheet-import";
import { recordSnapshot } from "@/lib/snapshot-record";
import { createClient } from "@/lib/supabase/server";
import type { SheetApplyResult, SheetKind, SheetPreview } from "./types";

const MAX_BYTES = 2_000_000;
const MAX_ROWS = 3000;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Só admin Shogun importa planilha, em uma marmitaria escolhida (`org` no formulário). Quem não é admin recebe "não existe". */
async function adminTarget(formData: FormData): Promise<{ orgId: string; userId: string; supabase: Supabase } | { error: string }> {
  const session = await requireAdmin();
  const org = z.uuid().safeParse(formData.get("org"));
  if (!org.success) return { error: "Escolha a marmitaria." };
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("id").eq("id", org.data).maybeSingle();
  if (!data) return { error: "Marmitaria não encontrada." };
  return { orgId: data.id as string, userId: session.userId, supabase };
}

type Existing = { id: string; name: string; kind: string; purchase_unit: string; purchase_qty: number };

/** Todas as abas do arquivo (CSV tem uma só). O cliente costuma mandar uma pasta com várias abas; a certa é a que tem as colunas. */
async function readSheets(formData: FormData): Promise<{ sheets: Cell[][][] } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha um arquivo .xlsx ou .csv." };
  if (file.size > MAX_BYTES) return { error: "Arquivo grande demais (máximo 2 MB)." };
  const lower = file.name.toLowerCase();
  try {
    let sheets: Cell[][][];
    if (lower.endsWith(".xlsx")) sheets = (await readXlsxFile(Buffer.from(await file.arrayBuffer()))).slice(0, 30).map((s) => s.data as Cell[][]);
    else if (lower.endsWith(".csv") || lower.endsWith(".txt")) sheets = [parseCsv(await file.text())];
    else return { error: "Use um arquivo .xlsx (Excel) ou .csv. Arquivos .xls antigos: salve como .xlsx." };
    return { sheets: sheets.map((rows) => rows.slice(0, MAX_ROWS)) };
  } catch {
    return { error: "Não consegui abrir o arquivo. Confira se é uma planilha válida." };
  }
}

/** A primeira aba em que o leitor encontra as colunas; se nenhuma, o erro da primeira aba com conteúdo. */
function firstSheet<T>(sheets: Cell[][][], parse: (rows: Cell[][]) => T | { error: string }): T | { error: string } {
  let firstError: { error: string } | null = null;
  for (const rows of sheets) {
    const r = parse(rows);
    if (!(typeof r === "object" && r !== null && "error" in r)) return r;
    firstError ??= r as { error: string };
  }
  return firstError ?? { error: "A planilha está vazia." };
}

async function existingIngredients(supabase: Supabase, orgId: string): Promise<Existing[]> {
  const { data } = await supabase.from("ingredients").select("id, name, kind, purchase_unit, purchase_qty").eq("org_id", orgId).is("archived_at", null);
  return (data ?? []).map((i) => ({ id: i.id as string, name: i.name as string, kind: i.kind as string, purchase_unit: i.purchase_unit as string, purchase_qty: Number(i.purchase_qty) }));
}

async function existingRecipeNames(supabase: Supabase, orgId: string): Promise<Set<string>> {
  const { data } = await supabase.from("recipes").select("name").eq("org_id", orgId);
  return new Set((data ?? []).map((r) => normalizeName(r.name as string)));
}

/** Insumo repetido dentro da própria planilha: vale a última linha. */
function dedupeIngredients(items: SheetIngredient[]): SheetIngredient[] {
  const map = new Map<string, SheetIngredient>();
  for (const i of items) map.set(normalizeName(i.name), i);
  return [...map.values()];
}

function classifyRecipes(recipes: SheetRecipe[], ingredients: Existing[], recipeNames: Set<string>) {
  const byName = new Map(ingredients.map((i) => [normalizeName(i.name), i]));
  return recipes.map((r) => {
    const missing = [...new Set(r.lines.flatMap((l) => (byName.has(normalizeName(l.ingredient)) ? [] : [l.ingredient])))];
    const badUnit = r.lines.flatMap((l) => {
      const ing = byName.get(normalizeName(l.ingredient));
      return ing && !(isPurchaseUnit(ing.purchase_unit) && isCompatibleUnit(l.unit, baseUnitOf(ing.purchase_unit))) ? [`${l.ingredient} (unidade ${l.unit} não combina)`] : [];
    });
    const problems = [...missing.map((m) => `${m} (não cadastrado)`), ...badUnit];
    const status: "new" | "exists" | "missing" = recipeNames.has(normalizeName(r.name)) ? "exists" : problems.length > 0 ? "missing" : "new";
    return { recipe: r, status, problems };
  });
}

export async function previewSheet(kind: SheetKind, formData: FormData): Promise<SheetPreview> {
  const target = await adminTarget(formData);
  if ("error" in target) return { ok: false, error: target.error };
  const { orgId, supabase } = target;
  const read = await readSheets(formData);
  if ("error" in read) return { ok: false, error: read.error };
  const ingredients = await existingIngredients(supabase, orgId);

  if (kind === "insumos") {
    const parsed = firstSheet(read.sheets, readIngredientSheet);
    if ("error" in parsed) return { ok: false, error: parsed.error };
    const have = new Set(ingredients.map((i) => normalizeName(i.name)));
    return {
      ok: true,
      kind,
      errors: parsed.errors,
      rows: dedupeIngredients(parsed.items).map((i) => ({ line: i.line, name: i.name, unit: i.unit, assumed: i.unitAssumed, qty: i.qty, price: i.price, category: i.category, status: have.has(normalizeName(i.name)) ? "exists" : "new" })),
    };
  }

  const parsed = firstSheet(read.sheets, readRecipeSheet);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const classified = classifyRecipes(parsed.recipes, ingredients, await existingRecipeNames(supabase, orgId));
  return { ok: true, kind, errors: parsed.errors, recipes: classified.map((c) => ({ name: c.recipe.name, items: c.recipe.lines.length, status: c.status, missing: c.problems })) };
}

export async function applySheet(kind: SheetKind, formData: FormData): Promise<SheetApplyResult> {
  const target = await adminTarget(formData);
  if ("error" in target) return { ok: false, error: target.error };
  const { orgId, supabase, userId } = target;
  const read = await readSheets(formData);
  if ("error" in read) return { ok: false, error: read.error };
  const ingredients = await existingIngredients(supabase, orgId);
  // Unidade escolhida na prévia para as linhas que vieram sem unidade: { "linha": "kg" | "l" | "un"... }
  let unitPicks: Record<string, string> = {};
  try {
    unitPicks = JSON.parse(String(formData.get("units") ?? "{}")) as Record<string, string>;
  } catch {
    return { ok: false, error: "Não entendi as unidades escolhidas. Recarregue a página e tente de novo." };
  }
  const updatePrices = formData.get("update_prices") === "1";
  let message: string;

  if (kind === "insumos") {
    const found = firstSheet(read.sheets, readIngredientSheet);
    if ("error" in found) return { ok: false, error: found.error };
    const parsed = {
      ...found,
      items: found.items.map((i) => {
        const pick = unitPicks[String(i.line)];
        return i.unitAssumed && typeof pick === "string" && isPurchaseUnit(pick) ? { ...i, unit: pick } : i;
      }),
    };
    const byName = new Map(ingredients.map((i) => [normalizeName(i.name), i]));
    const fresh: SheetIngredient[] = [];
    let updated = 0;
    let skipped = 0;
    for (const i of dedupeIngredients(parsed.items)) {
      const cur = byName.get(normalizeName(i.name));
      if (!cur) {
        fresh.push(i);
        continue;
      }
      // Só atualiza o preço se a medida for a mesma (kg↔g, l↔ml): trocar peso por unidade bagunçaria as fichas.
      if (!updatePrices || i.price <= 0 || cur.kind !== "insumo" || !isPurchaseUnit(cur.purchase_unit) || baseUnitOf(cur.purchase_unit) !== baseUnitOf(i.unit)) {
        skipped++;
        continue;
      }
      const { error } = await supabase.from("ingredients").update({ purchase_price: i.price, purchase_qty: i.qty, purchase_unit: i.unit }).eq("id", cur.id).eq("org_id", orgId);
      if (error) skipped++;
      else updated++;
    }
    let created = 0;
    for (let at = 0; at < fresh.length; at += 200) {
      const chunk = fresh.slice(at, at + 200);
      const { error } = await supabase.from("ingredients").insert(
        chunk.map((i) => ({ org_id: orgId, name: i.name, kind: "insumo", category: i.category, purchase_unit: i.unit, purchase_qty: i.qty, purchase_price: i.price, correction_factor: i.correctionFactor, cooking_yield: 1 })),
      );
      if (error) return { ok: false, error: `Não foi possível salvar os insumos${created > 0 ? ` (${created} já tinham entrado)` : ""}. Confira se não há nomes repetidos.` };
      created += chunk.length;
    }
    message = [created > 0 ? `${created} ${created === 1 ? "insumo criado" : "insumos criados"}` : null, updated > 0 ? `${updated} ${updated === 1 ? "preço atualizado" : "preços atualizados"}` : null, skipped > 0 ? `${skipped} já existiam e ficaram como estavam` : null]
      .filter(Boolean)
      .join(" · ");
  } else {
    const parsed = firstSheet(read.sheets, readRecipeSheet);
    if ("error" in parsed) return { ok: false, error: parsed.error };
    const classified = classifyRecipes(parsed.recipes, ingredients, await existingRecipeNames(supabase, orgId));
    const byName = new Map(ingredients.map((i) => [normalizeName(i.name), i]));
    let created = 0;
    let left = 0;
    for (const c of classified) {
      if (c.status !== "new") {
        left++;
        continue;
      }
      const { data: rec, error } = await supabase
        .from("recipes")
        .insert({ org_id: orgId, name: c.recipe.name, category: c.recipe.category, portions: 1, portion_weight: null, cooking_loss_pct: 0, mode: "serving" })
        .select("id")
        .single();
      if (error || !rec) {
        left++;
        continue;
      }
      const items = c.recipe.lines.map((l) => {
        const ing = byName.get(normalizeName(l.ingredient))!;
        const scope = ing.kind === "embalagem" ? "portion" : "batch";
        return { ingredient_id: ing.id, net_qty: toBaseQty(l.qty, l.unit).toNumber(), qty_unit: l.unit, scope, counts_for_yield: scope === "batch" };
      });
      const { error: itemsError } = await supabase.from("recipe_items").insert(items.map((i) => ({ ...i, org_id: orgId, recipe_id: rec.id })));
      if (itemsError) {
        await supabase.from("recipes").delete().eq("id", rec.id).eq("org_id", orgId); // sem ficha pela metade
        left++;
        continue;
      }
      created++;
    }
    message = [created > 0 ? `${created} ${created === 1 ? "ficha criada" : "fichas criadas"}` : null, left > 0 ? `${left} ficaram de fora (já existem ou faltam insumos)` : null].filter(Boolean).join(" · ");
    if (created === 0) return { ok: false, error: message || "Nenhuma ficha para importar." };
    revalidatePath("/marmitas");
  }

  await supabase.from("activity_log").insert({ org_id: orgId, user_id: userId, by_admin: true, kind: "change", summary: `Equipe Shogun importou planilha de ${kind}: ${message}` });
  recordSnapshot();
  revalidatePath("/insumos");
  return { ok: true, message: message || "Nada novo para importar." };
}
