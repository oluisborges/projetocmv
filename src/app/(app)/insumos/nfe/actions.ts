"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, requireMember } from "@/lib/auth";
import { isPurchaseUnit, type PurchaseUnit } from "@/lib/calc";
import { newPurchasePrice, nfeCostPerBase, parseNfeXml, suggestIngredient, classifyUnit, type NfeDoc, type NfeItem } from "@/lib/nfe";
import { normalizeName } from "@/lib/names";
import { activeUnit } from "@/lib/pricing-data";
import { recordSnapshot } from "@/lib/snapshot-record";
import { createClient } from "@/lib/supabase/server";
import type { NfeApplyNote, NfeApplyResult, NfeIngredient, NfePreview, NfePreviewNote } from "./types";

const NO_PERMISSION = "Você só tem acesso de leitura. Peça a um gerente para alterar.";
const MAX_FILES = 20;
const MAX_BYTES = 2_000_000;
const MAX_ITEMS = 500;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Lê os XMLs enviados. Nota inválida vira aviso, não derruba as outras. */
async function readFiles(formData: FormData): Promise<{ docs: { fileName: string; doc: NfeDoc }[]; problems: string[] } | { error: string }> {
  const files = formData.getAll("xml").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Escolha pelo menos um arquivo XML." };
  if (files.length > MAX_FILES) return { error: `Envie até ${MAX_FILES} notas por vez.` };
  const docs: { fileName: string; doc: NfeDoc }[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    if (f.size > MAX_BYTES) {
      problems.push(`${f.name}: arquivo grande demais.`);
      continue;
    }
    const parsed = parseNfeXml(await f.text());
    if (!parsed.ok) {
      problems.push(`${f.name}: ${parsed.error}`);
      continue;
    }
    if (parsed.doc.items.length > MAX_ITEMS) {
      problems.push(`${f.name}: nota com itens demais.`);
      continue;
    }
    if (seen.has(parsed.doc.accessKey)) continue; // o mesmo arquivo enviado duas vezes
    seen.add(parsed.doc.accessKey);
    docs.push({ fileName: f.name, doc: parsed.doc });
  }
  return { docs, problems };
}

async function loadIngredients(supabase: Supabase, orgId: string): Promise<NfeIngredient[]> {
  const { data } = await supabase.from("ingredients").select("id, name, purchase_qty, purchase_unit, purchase_price").eq("org_id", orgId).eq("kind", "insumo").is("archived_at", null).order("name");
  return (data ?? []).flatMap((i) =>
    isPurchaseUnit(i.purchase_unit) ? [{ id: i.id as string, name: i.name as string, purchase_qty: Number(i.purchase_qty), purchase_unit: i.purchase_unit as PurchaseUnit, purchase_price: Number(i.purchase_price) }] : [],
  );
}

export async function previewNfe(formData: FormData): Promise<NfePreview> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };
  const read = await readFiles(formData);
  if ("error" in read) return { ok: false, error: read.error };
  if (read.docs.length === 0) return { ok: false, error: read.problems[0] ?? "Nenhuma nota válida." };

  const supabase = await createClient();
  const ingredients = await loadIngredients(supabase, orgId);
  const keys = read.docs.map((d) => d.doc.accessKey);
  const cnpjs = [...new Set(read.docs.map((d) => d.doc.supplierCnpj || "0"))];

  const [{ data: done }, { data: maps }] = await Promise.all([
    supabase.from("nfe_imports").select("access_key").eq("org_id", orgId).in("access_key", keys),
    supabase.from("nfe_item_map").select("supplier_cnpj, supplier_code, ingredient_id, ignored, pack_qty, pack_unit").eq("org_id", orgId).in("supplier_cnpj", cnpjs),
  ]);
  const imported = new Set((done ?? []).map((r) => r.access_key as string));
  const known = new Set(ingredients.map((i) => i.id));
  const memory = new Map((maps ?? []).map((m) => [`${m.supplier_cnpj}|${m.supplier_code}`, m]));

  const notes: NfePreviewNote[] = read.docs.map(({ fileName, doc }) => ({
    fileName,
    accessKey: doc.accessKey,
    number: doc.number,
    supplierName: doc.supplierName,
    supplierCnpj: doc.supplierCnpj,
    issuedAt: doc.issuedAt,
    total: doc.total,
    alreadyImported: imported.has(doc.accessKey),
    items: doc.items.map((it) => {
      const m = memory.get(`${doc.supplierCnpj || "0"}|${it.code}`);
      const remembered = m
        ? m.ignored
          ? { choice: "ignore" as const, ingredientId: null, packQty: null, packUnit: null }
          : m.ingredient_id && known.has(m.ingredient_id as string)
            ? { choice: "update" as const, ingredientId: m.ingredient_id as string, packQty: m.pack_qty === null ? null : Number(m.pack_qty), packUnit: isPurchaseUnit(m.pack_unit) ? (m.pack_unit as PurchaseUnit) : null }
            : null
        : null;
      return {
        code: it.code,
        name: it.name,
        unit: it.unit,
        qty: it.qty,
        unitPrice: it.unitPrice,
        total: it.total,
        remembered,
        suggestedId: remembered ? null : (suggestIngredient(it.name, ingredients)?.id ?? null),
      };
    }),
  }));
  return { ok: true, notes, ingredients, problems: read.problems };
}

const decisionSchema = z.object({
  code: z.string().min(1).max(80),
  choice: z.enum(["update", "create", "ignore", "skip"]),
  ingredientId: z.uuid().optional(),
  packQty: z.number().positive().max(1_000_000).optional(),
  packUnit: z.enum(["kg", "g", "l", "ml", "un"]).optional(),
});
const payloadSchema = z.array(z.object({ accessKey: z.string().regex(/^\d{44}$/), addToPurchases: z.boolean(), decisions: z.array(decisionSchema).max(MAX_ITEMS) })).max(MAX_FILES);

/** Mês (AAAA-MM-01) da data de emissão, no horário de Brasília. */
const monthOf = (iso: string) => new Date(Date.parse(iso) - 3 * 3600_000).toISOString().slice(0, 7) + "-01";

export async function applyNfe(formData: FormData): Promise<NfeApplyResult> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };
  const session = await getSession();
  const unit = await activeUnit(orgId);
  if (!session || !unit) return { ok: false, error: "Sua marmitaria ainda não tem unidade cadastrada." };

  let payload: NfeApplyNote[];
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(String(formData.get("decisions") ?? "[]")));
    if (!parsed.success) return { ok: false, error: "Não entendi as escolhas enviadas. Recarregue a página e tente de novo." };
    payload = parsed.data;
  } catch {
    return { ok: false, error: "Não entendi as escolhas enviadas. Recarregue a página e tente de novo." };
  }
  const read = await readFiles(formData);
  if ("error" in read) return { ok: false, error: read.error };

  const supabase = await createClient();
  const ingredients = new Map((await loadIngredients(supabase, orgId)).map((i) => [i.id, i]));
  const names = new Set([...ingredients.values()].map((i) => normalizeName(i.name)));
  const byKey = new Map(read.docs.map((d) => [d.doc.accessKey, d.doc]));

  let updated = 0;
  let created = 0;
  let notesDone = 0;
  let skippedNotes = 0;
  let purchases = 0;
  const warnings: string[] = [];

  for (const note of payload) {
    const doc = byKey.get(note.accessKey);
    if (!doc) continue;
    const addTotal = note.addToPurchases ? Math.round((doc.total > 0 ? doc.total : doc.items.reduce((s, i) => s + i.total, 0)) * 100) / 100 : 0;

    // A nota entra primeiro: a chave única impede contar duas vezes (dois cliques, duas abas).
    const { error: importError } = await supabase.from("nfe_imports").insert({
      org_id: orgId,
      unit_id: unit.id,
      access_key: doc.accessKey,
      nfe_number: doc.number,
      supplier_name: doc.supplierName,
      supplier_cnpj: doc.supplierCnpj || null,
      issued_at: doc.issuedAt,
      total: doc.total,
      items_count: doc.items.length,
      added_to_purchases: addTotal,
      imported_by: session.userId,
    });
    if (importError?.code === "23505") {
      skippedNotes++;
      continue;
    }
    if (importError) {
      warnings.push(`Nota ${doc.number ?? doc.accessKey.slice(-8)}: não foi possível salvar.`);
      continue;
    }

    const items = new Map<string, NfeItem>(doc.items.map((i) => [i.code, i]));
    const cnpj = doc.supplierCnpj || "0";
    for (const d of note.decisions) {
      const item = items.get(d.code);
      if (!item || d.choice === "skip") continue;
      const pack = d.packQty && d.packUnit ? { qty: d.packQty, unit: d.packUnit } : null;

      if (d.choice === "ignore") {
        await supabase.from("nfe_item_map").upsert({ org_id: orgId, supplier_cnpj: cnpj, supplier_code: item.code, ingredient_id: null, ignored: true, pack_qty: null, pack_unit: null, name_hint: item.name.slice(0, 200) }, { onConflict: "org_id,supplier_cnpj,supplier_code" });
        continue;
      }

      const cost = nfeCostPerBase(item, pack);
      if (!cost) {
        warnings.push(`${item.name}: faltou informar o conteúdo da embalagem.`);
        continue;
      }

      let ingredientId = d.ingredientId;
      if (d.choice === "create") {
        const name = item.name.trim().slice(0, 80);
        if (names.has(normalizeName(name))) {
          warnings.push(`${name}: já existe um insumo com esse nome. Escolha "Atualizar" nele.`);
          continue;
        }
        // O novo insumo nasce com a embalagem da nota (1 kg, 1 l, 1 un ou o conteúdo da caixa).
        const k = classifyUnit(item.unit);
        const buyUnit: PurchaseUnit | null = k.kind === "measure" ? k.unit : (pack?.unit ?? null);
        const buyQty = k.kind === "measure" ? 1 : (pack?.qty ?? 0);
        if (!buyUnit || buyQty <= 0) continue;
        const price = newPurchasePrice(cost, { purchase_qty: buyQty, purchase_unit: buyUnit });
        if (price === null) continue;
        const { data, error } = await supabase
          .from("ingredients")
          .insert({ org_id: orgId, name, kind: "insumo", purchase_unit: buyUnit, purchase_qty: buyQty, purchase_price: price, correction_factor: 1, cooking_yield: 1 })
          .select("id")
          .single();
        if (error || !data) {
          warnings.push(`${name}: não foi possível criar o insumo.`);
          continue;
        }
        names.add(normalizeName(name));
        ingredientId = data.id as string;
        created++;
      } else {
        const ing = ingredientId ? ingredients.get(ingredientId) : undefined;
        if (!ing) {
          warnings.push(`${item.name}: escolha o insumo.`);
          continue;
        }
        const price = newPurchasePrice(cost, ing);
        if (price === null) {
          warnings.push(`${item.name}: a unidade da nota não combina com a do insumo "${ing.name}".`);
          continue;
        }
        const { error } = await supabase.from("ingredients").update({ purchase_price: price }).eq("id", ing.id).eq("org_id", orgId);
        if (error) {
          warnings.push(`${ing.name}: não foi possível atualizar o preço.`);
          continue;
        }
        updated++;
      }

      await supabase.from("nfe_item_map").upsert(
        { org_id: orgId, supplier_cnpj: cnpj, supplier_code: item.code, ingredient_id: ingredientId ?? null, ignored: false, pack_qty: pack?.qty ?? null, pack_unit: pack?.unit ?? null, name_hint: item.name.slice(0, 200) },
        { onConflict: "org_id,supplier_cnpj,supplier_code" },
      );
    }

    if (addTotal > 0) {
      const { error } = await supabase.rpc("nfe_add_purchases", { p_org: orgId, p_unit: unit.id, p_month: monthOf(doc.issuedAt), p_amount: addTotal });
      if (error) warnings.push(`Nota ${doc.number ?? ""}: não consegui somar ao total de compras do mês.`);
      else purchases += addTotal;
    }
    notesDone++;
  }

  if (notesDone > 0) {
    await supabase.from("activity_log").insert({ org_id: orgId, user_id: session.userId, by_admin: session.isPlatformAdmin, kind: "change", summary: `Importou ${notesDone} NF-e: ${updated} preço(s) atualizado(s), ${created} insumo(s) novo(s)` });
    recordSnapshot();
    revalidatePath("/insumos");
    revalidatePath("/custos/mes");
  }

  const parts = [
    notesDone > 0 ? `${notesDone} ${notesDone === 1 ? "nota importada" : "notas importadas"}` : null,
    updated > 0 ? `${updated} ${updated === 1 ? "preço atualizado" : "preços atualizados"}` : null,
    created > 0 ? `${created} ${created === 1 ? "insumo novo" : "insumos novos"}` : null,
    purchases > 0 ? `R$ ${purchases.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} somados às compras do mês` : null,
    skippedNotes > 0 ? `${skippedNotes} já ${skippedNotes === 1 ? "tinha entrado" : "tinham entrado"} antes` : null,
  ].filter(Boolean);
  const message = [parts.join(" · ") || "Nada para importar.", ...warnings.slice(0, 5)].join("\n");
  if (notesDone === 0 && skippedNotes === 0) return { ok: false, error: message };
  return { ok: true, message };
}
