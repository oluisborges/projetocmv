"use server";

import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SearchResult = { type: "insumo" | "marmita"; id: string; name: string; detail: string; href: string };

const LIMIT = 6;

/** Busca global: insumos ativos e marmitas (fichas) ativas da marmitaria. Mínimo de 2 letras. */
export async function searchAll(q: string): Promise<SearchResult[]> {
  const { orgId } = await requireMember();
  // Tira os caracteres que têm sentido no filtro do PostgREST/ilike; sobra só o texto digitado.
  const term = String(q ?? "").replace(/[%_\\,()*]/g, " ").trim().slice(0, 60);
  if (term.length < 2) return [];

  const supabase = await createClient();
  const [{ data: ingredients }, { data: recipes }] = await Promise.all([
    supabase.from("ingredients").select("id, name, kind, category").eq("org_id", orgId).is("archived_at", null).ilike("name", `%${term}%`).order("name").limit(LIMIT),
    supabase.from("recipes").select("id, name, category").eq("org_id", orgId).eq("active", true).ilike("name", `%${term}%`).order("name").limit(LIMIT),
  ]);

  return [
    ...(recipes ?? []).map((r) => ({ type: "marmita" as const, id: r.id as string, name: r.name as string, detail: (r.category as string | null) ?? "Marmita", href: `/marmitas/${r.id}` })),
    ...(ingredients ?? []).map((i) => ({
      type: "insumo" as const,
      id: i.id as string,
      name: i.name as string,
      detail: i.kind === "embalagem" ? "Embalagem" : ((i.category as string | null) ?? "Insumo"),
      href: `/insumos/${i.id}`,
    })),
  ];
}
