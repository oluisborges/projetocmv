"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type LinkResult = { ok: true } | { ok: false; error: string };

const NO_PERMISSION = "Você só tem acesso de leitura. Peça a um gerente para alterar.";

/**
 * Vincula um produto do cardápio a uma ficha ou combo (vários produtos podem apontar para o mesmo), ou marca como "não é marmita".
 * `target`: "" = sem vínculo · "ignore" = não é marmita · "r:<id>" = ficha · "c:<id>" = combo.
 * A marmitaria vem da sessão; o banco (RLS + chave composta) impede apontar para ficha de outra marmitaria.
 */
export async function saveMenuLink(productId: string, target: string, rawUnits: string): Promise<LinkResult> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };

  const id = z.uuid().safeParse(productId);
  if (!id.success) return { ok: false, error: "Produto inválido." };

  const units = Number(String(rawUnits).trim() === "" ? "1" : rawUnits);
  if (!Number.isInteger(units) || units < 1 || units > 1000) return { ok: false, error: "Digite quantas marmitas a venda leva, como 1 ou 10." };

  let patch: { recipe_id: string | null; combo_id: string | null; ignored: boolean; units_per_sale: number };
  if (target === "") patch = { recipe_id: null, combo_id: null, ignored: false, units_per_sale: 1 };
  else if (target === "ignore") patch = { recipe_id: null, combo_id: null, ignored: true, units_per_sale: 1 };
  else {
    const m = /^([rc]):(.+)$/.exec(target);
    const ref = z.uuid().safeParse(m?.[2]);
    if (!m || !ref.success) return { ok: false, error: "Escolha uma ficha ou um combo da lista." };
    patch = m[1] === "r" ? { recipe_id: ref.data, combo_id: null, ignored: false, units_per_sale: units } : { recipe_id: null, combo_id: ref.data, ignored: false, units_per_sale: 1 };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("menu_products").update(patch).eq("id", id.data).eq("org_id", orgId).select("id");
  if (error || !data?.length) return { ok: false, error: "Não foi possível salvar o vínculo." };

  revalidatePath("/custos/cardapio");
  revalidatePath("/custos/mes");
  return { ok: true };
}
