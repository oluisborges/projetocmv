import "server-only";
import { loadRecipeCosts } from "@/lib/combos-data";
import { hasMenuConnection, loadMenuRecipeSales } from "@/lib/menu-data";
import { engineerMenu, type EngineeringInput, type EngineeringResult } from "@/lib/menu-engineering";
import { monthBounds } from "@/lib/month-view";
import { loadPricingContext } from "@/lib/pricing-data";
import { createClient } from "@/lib/supabase/server";

export type EngineeringData = {
  unitName: string;
  month: string;
  menuConnected: boolean;
  result: EngineeringResult;
  /** Marmitas digitadas pelo dono em fichas sem preço cadastrado: ficam de fora porque não dá para saber o valor. */
  skippedManualUnits: number;
};

/**
 * Cruza as vendas do mês (cardápio, já sem a parte do cupom, e marmitas digitadas pelo dono × o preço que ele cadastrou)
 * com o custo de cada ficha. Os cardápios cobram mensalidade fixa, então só entram impostos e outras taxas.
 */
export async function loadMenuEngineering(orgId: string, canWrite: boolean, month: string): Promise<EngineeringData | null> {
  const ctx = await loadPricingContext(orgId, canWrite);
  if (!ctx) return null;
  const { start, end } = monthBounds(month);
  const supabase = await createClient();
  const connected = await hasMenuConnection(orgId);

  const [recipes, menuSales, { data: period }] = await Promise.all([
    loadRecipeCosts(orgId, ctx.unit.id, ctx.settings.safetyMarginPct ?? 0),
    connected ? loadMenuRecipeSales(ctx.unit.id, start, end) : Promise.resolve(new Map<string, { units: number; gross: number; net: number }>()),
    supabase.from("periods").select("id").eq("unit_id", ctx.unit.id).eq("month", month).maybeSingle(),
  ]);
  const { data: typed } = period ? await supabase.from("period_sales").select("recipe_id, qty_sold").eq("period_id", period.id) : { data: [] as { recipe_id: string; qty_sold: number }[] };
  const typedQty = new Map((typed ?? []).map((t) => [t.recipe_id as string, Number(t.qty_sold)]));

  let skippedManualUnits = 0;
  const inputs: EngineeringInput[] = recipes.flatMap((r) => {
    const menu = menuSales.get(r.id);
    const manualQty = typedQty.get(r.id) ?? 0;
    const manualUsable = manualQty > 0 && (r.price ?? 0) > 0;
    if (manualQty > 0 && !manualUsable) skippedManualUnits += manualQty;
    const units = (menu?.units ?? 0) + (manualUsable ? manualQty : 0);
    if (units <= 0) return [];
    return [{ id: r.id, name: r.name, units, revenue: (menu?.net ?? 0) + (manualUsable ? manualQty * (r.price as number) : 0), cost: r.cost }];
  });

  const variablePct = ctx.settings.taxPct + (ctx.settings.otherPct ?? 0);
  return { unitName: ctx.unit.name, month, menuConnected: connected, result: engineerMenu(inputs, variablePct), skippedManualUnits };
}
