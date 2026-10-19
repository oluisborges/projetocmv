"use server";

import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SearchResult = { type: "insumo" | "marmita" | "combo"; id: string; name: string; detail: string; href: string };
/** `total` = quantos existem no banco para o termo (pode ser maior que `results.length`, que é limitado por tipo). */
export type SearchResponse = { results: SearchResult[]; total: number };

const LIMIT = 8;

/** Busca global: insumos ativos, marmitas (fichas) e combos ativos da marmitaria. Mínimo de 2 letras. */
export async function searchAll(q: string): Promise<SearchResponse> {
  const { orgId } = await requireMember();
  // Tira os caracteres que têm sentido no filtro do PostgREST/ilike; sobra só o texto digitado.
  const term = String(q ?? "").replace(/[%_\,()*]/g, " ").trim().slice(0, 60);
  if (term.length < 2) return { results: [], total: 0 };

  const supabase = await createClient();
  const [ingredients, recipes, combos] = await Promise.all([
    supabase.from("ingredients").select("id, name, kind, category", { count: "exact" }).eq("org_id", orgId).is("archived_at", null).ilike("name", `%${term}%`).order("name").limit(LIMIT),
    supabase.from("recipes").select("id, name, category", { count: "exact" }).eq("org_id", orgId).eq("active", true).ilike("name", `%${term}%`).order("name").limit(LIMIT),
    supabase.from("combos").select("id, name", { count: "exact" }).eq("org_id", orgId).eq("active", true).ilike("name", `%${term}%`).order("name").limit(LIMIT),
  ]);

  const results: SearchResult[] = [
    ...(recipes.data ?? []).map((r) => ({ type: "marmita" as const, id: r.id as string, name: r.name as string, detail: (r.category as string | null) ?? "Marmita", href: `/marmitas/${r.id}` })),
    ...(combos.data ?? []).map((c) => ({ type: "combo" as const, id: c.id as string, name: c.name as string, detail: "Combo", href: `/marmitas/combos/${c.id}` })),
    ...(ingredients.data ?? []).map((i) => ({
      type: "insumo" as const,
      id: i.id as string,
      name: i.name as string,
      detail: i.kind === "embalagem" ? "Embalagem" : ((i.category as string | null) ?? "Insumo"),
      href: `/insumos/${i.id}`,
    })),
  ];
  const total = (recipes.count ?? recipes.data?.length ?? 0) + (combos.count ?? combos.data?.length ?? 0) + (ingredients.count ?? ingredients.data?.length ?? 0);
  return { results, total: Math.max(total, results.length) };
}
