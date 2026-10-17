import "server-only";
import { cache } from "react";
import { monthBounds } from "@/lib/month-view";
import type { MenuProductLink, MenuProductSales } from "@/lib/menu-view";
import { createClient } from "@/lib/supabase/server";

export type MenuProduct = MenuProductLink & {
  provider: "cardapioweb" | "prefiro";
  name: string;
  kind: "item" | "option";
  last_seen_at: string;
};

/** A marmitaria tem algum cardápio conectado? (uma consulta por requisição) */
export const hasMenuConnection = cache(async (orgId: string): Promise<boolean> => {
  const supabase = await createClient();
  const { count } = await supabase.from("menu_connections").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "connected");
  return (count ?? 0) > 0;
});

export type MenuMonthData = {
  orders: number;
  revenue: number;
  sales: MenuProductSales[];
};

/** Pedidos, faturamento e vendas por produto de um mês ("YYYY-MM-01", horário de Brasília). */
export async function loadMenuMonth(unitId: string, month: string): Promise<MenuMonthData> {
  const { start, end } = monthBounds(month);
  const supabase = await createClient();
  const [{ data: totals }, { data: lines }] = await Promise.all([
    supabase.rpc("menu_month_orders", { p_unit: unitId, p_start: start.toISOString(), p_end: end.toISOString() }),
    supabase.rpc("menu_month_lines", { p_unit: unitId, p_start: start.toISOString(), p_end: end.toISOString() }),
  ]);
  const t = (totals as { orders: number | string; revenue: number | string }[] | null)?.[0];
  return {
    orders: Number(t?.orders ?? 0),
    revenue: Number(t?.revenue ?? 0),
    sales: ((lines as { product_id: string; qty: number | string; revenue: number | string }[] | null) ?? []).map((l) => ({
      product_id: l.product_id,
      qty: Number(l.qty),
      revenue: Number(l.revenue),
    })),
  };
}

/** Todos os produtos já vistos no cardápio da marmitaria, com o vínculo atual. */
export async function loadMenuProducts(orgId: string): Promise<MenuProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("menu_products")
    .select("id, provider, name, kind, recipe_id, combo_id, units_per_sale, ignored, last_seen_at")
    .eq("org_id", orgId)
    .order("name");
  return (data ?? []).map((p) => ({
    id: p.id as string,
    provider: p.provider as MenuProduct["provider"],
    name: p.name as string,
    kind: p.kind as MenuProduct["kind"],
    recipe_id: (p.recipe_id as string | null) ?? null,
    combo_id: (p.combo_id as string | null) ?? null,
    units_per_sale: Number(p.units_per_sale),
    ignored: Boolean(p.ignored),
    last_seen_at: p.last_seen_at as string,
  }));
}

export type MenuMonthlyRow = { month: string; orders: number; revenue: number; recipeUnits: number; comboQty: Map<string, number> };

/** Faturamento e marmitas do cardápio por mês nos últimos meses (para a média que alimenta o preço). */
export async function loadMenuMonthly(unitId: string, fromMonth: string): Promise<Map<string, MenuMonthlyRow>> {
  const from = monthBounds(fromMonth).start.toISOString();
  const supabase = await createClient();
  const [{ data: months }, { data: combos }] = await Promise.all([
    supabase.rpc("menu_monthly", { p_unit: unitId, p_from: from }),
    supabase.rpc("menu_monthly_combos", { p_unit: unitId, p_from: from }),
  ]);
  const out = new Map<string, MenuMonthlyRow>();
  for (const m of (months as { month: string; orders: number | string; revenue: number | string; recipe_units: number | string }[] | null) ?? []) {
    out.set(m.month, { month: m.month, orders: Number(m.orders), revenue: Number(m.revenue), recipeUnits: Number(m.recipe_units), comboQty: new Map() });
  }
  for (const c of (combos as { month: string; combo_id: string; qty: number | string }[] | null) ?? []) {
    out.get(c.month)?.comboQty.set(c.combo_id, Number(c.qty));
  }
  return out;
}
