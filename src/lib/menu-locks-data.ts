import "server-only";
import { advancedLockFrom, type MenuLock } from "@/lib/menu-locks";
import { createClient } from "@/lib/supabase/server";

/** A trava da Visão Avançada (espera a primeira marmita). Erro de consulta não trava nada. */
export async function loadAdvancedLock(orgId: string): Promise<MenuLock | null> {
  const supabase = await createClient();
  const recipes = await supabase.from("recipes").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("kind", "marmita").eq("active", true);
  return advancedLockFrom(recipes);
}
