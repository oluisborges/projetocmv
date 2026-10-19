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
  /** O que os clientes pagaram (total dos pedidos, já com cupom, entrega e taxas). */
  revenue: number;
  /** Cupons e descontos dados nos pedidos. */
  discount: number;
  /** Vendas por produto; `net` é o valor pago pelo produto já com a parte do cupom do pedido. */
  sales: MenuProductSales[];
};

/** Pedidos, faturamento e vendas por produto de um mês ("YYYY-MM-01", horário de Brasília). */
export async function loadMenuMonth(unitId: string, month: string): Promise<MenuMonthData> {
  const { start, end } = monthBounds(month);
  return loadMenuRange(unitId, start, end);
}

/** Só quantos pedidos o cardápio importou no mês (uma consulta leve, sem as linhas por produto). */
export async function loadMenuOrders(unitId: string, month: string): Promise<number> {
  const { start, end } = monthBounds(month);
  const supabase = await createClient();
  const { data } = await supabase.rpc("menu_month_orders", { p_unit: unitId, p_start: start.toISOString(), p_end: end.toISOString() });
  const t = (data as { orders: number | string }[] | null)?.[0];
  return Number(t?.orders ?? 0);
}

/** O mesmo, para qualquer intervalo (ex.: os 4 meses importados). */
export async function loadMenuRange(unitId: string, start: Date, end: Date): Promise<MenuMonthData> {
  const supabase = await createClient();
  const [{ data: totals }, { data: lines }] = await Promise.all([
    supabase.rpc("menu_month_orders", { p_unit: unitId, p_start: start.toISOString(), p_end: end.toISOString() }),
    supabase.rpc("menu_month_lines", { p_unit: unitId, p_start: start.toISOString(), p_end: end.toISOString() }),
  ]);
  const t = (totals as { orders: number | string; revenue: number | string; discount: number | string }[] | null)?.[0];
  return {
    orders: Number(t?.orders ?? 0),
    revenue: Number(t?.revenue ?? 0),
    discount: Number(t?.discount ?? 0),
    sales: ((lines as { product_id: string; qty: number | string; revenue: number | string; net_revenue: number | string }[] | null) ?? []).map((l) => ({
      product_id: l.product_id,
      qty: Number(l.qty),
      revenue: Number(l.revenue),
      net: Number(l.net_revenue),
    })),
  };
}

export type MenuRecipeSales = { units: number; gross: number; net: number };

/** Marmitas vendidas por ficha no intervalo, com o valor pago (já descontado o cupom). Base do preço médio vendido e dos pesos das médias. */
export async function loadMenuRecipeSales(unitId: string, start: Date, end: Date): Promise<Map<string, MenuRecipeSales>> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("menu_recipe_sales", { p_unit: unitId, p_start: start.toISOString(), p_end: end.toISOString() });
  return new Map(
    ((data as { recipe_id: string; units: number | string; gross: number | string; net: number | string }[] | null) ?? []).map((r) => [
      r.recipe_id,
      { units: Number(r.units), gross: Number(r.gross), net: Number(r.net) },
    ]),
  );
}

/** Quanto, em média, cada marmita foi paga no cardápio nos últimos 30 dias (já com o cupom). Só fichas com venda no período. */
export async function loadMenuAveragePrices(unitId: string, now: Date = new Date()): Promise<Map<string, { price: number; units: number }>> {
  const sales = await loadMenuRecipeSales(unitId, new Date(now.getTime() - 30 * 86_400_000), now);
  const out = new Map<string, { price: number; units: number }>();
  for (const [recipeId, s] of sales) if (s.units > 0 && s.net > 0) out.set(recipeId, { price: s.net / s.units, units: s.units });
  return out;
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

export type MenuStatus = {
  id: string;
  provider: "cardapioweb" | "prefiro";
  status: "connected" | "error";
  phase: "history" | "done";
  pending_orders: number;
  locked_until: string | null;
  last_sync_at: string | null;
  orders_imported: number;
};

/** Situação da importação de cada cardápio conectado (o dono vê o andamento; a fila em si é interna). */
export async function loadMenuStatus(orgId: string): Promise<MenuStatus[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("menu_connections")
    .select("id, provider, status, phase, pending_orders, locked_until, last_sync_at, orders_imported")
    .eq("org_id", orgId)
    .order("created_at");
  return (data ?? []).map((c) => ({
    id: c.id as string,
    provider: c.provider as MenuStatus["provider"],
    status: c.status as MenuStatus["status"],
    phase: c.phase as MenuStatus["phase"],
    pending_orders: Number(c.pending_orders),
    locked_until: (c.locked_until as string | null) ?? null,
    last_sync_at: (c.last_sync_at as string | null) ?? null,
    orders_imported: Number(c.orders_imported),
  }));
}

/** Ainda há pedidos para chegar? (carga do histórico em andamento ou fila com pedidos esperando) */
export const isImporting = (list: MenuStatus[]) => list.some((c) => c.status === "connected" && (c.phase === "history" || c.pending_orders > 0));
