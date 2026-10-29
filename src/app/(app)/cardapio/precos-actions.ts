"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { parseDecimal } from "@/lib/format";
import { activeUnit } from "@/lib/pricing-data";
import { recordSnapshot } from "@/lib/snapshot-record";
import { createClient } from "@/lib/supabase/server";

const NO_PERMISSION = "Você só tem acesso de leitura. Peça a um gerente para alterar.";

export async function setRecipePrice(
  recipeId: string,
  rawPrice: string,
): Promise<{ ok: true; price: number } | { ok: false; error: string }> {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) return { ok: false, error: NO_PERMISSION };

  const id = z.uuid().safeParse(recipeId);
  const text = parseDecimal(rawPrice);
  const price = text === null ? NaN : Number(text);
  if (!id.success || !(price > 0) || price > 100_000) return { ok: false, error: "Digite o preço, como 18,90." };

  const unit = await activeUnit(orgId); // a unidade vem do servidor, nunca do navegador
  if (!unit) return { ok: false, error: "Sua marmitaria ainda não tem unidade cadastrada." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe_prices")
    .upsert({ recipe_id: id.data, unit_id: unit.id, org_id: orgId, current_price: Number(price.toFixed(2)) }, { onConflict: "recipe_id,unit_id" })
    .select("current_price")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível salvar o preço." };

  recordSnapshot();
  revalidatePath("/cardapio");
  revalidatePath("/");
  return { ok: true, price: Number(data.current_price) };
}
