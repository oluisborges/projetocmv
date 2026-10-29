import "server-only";
import { summarizeCombo } from "@/lib/combo-view";
import { loadCombos, loadRecipeCosts, loadSalesWeights } from "@/lib/combos-data";
import { analyzeCoupons, maxDiscountPct, type CouponAnalysis, type CouponGroupInput } from "@/lib/coupon-view";
import { hasMenuConnection, loadMenuMonth, loadMenuProducts, loadMenuRecipeSales } from "@/lib/menu-data";
import { monthBounds } from "@/lib/month-view";
import { loadPricingContext } from "@/lib/pricing-data";
import { createClient } from "@/lib/supabase/server";

export type DiscountRoom = { id: string; name: string; price: number; cost: number; units: number; maxDiscountPct: number | null };

export type CouponData = {
  unitName: string;
  month: string;
  analysis: CouponAnalysis;
  /** Margem mínima desejada do cliente (Financeiro, aba Impostos e meta), usada para dizer "margem baixa". */
  minMarginPct: number;
  /** Desconto que as marmitas mais vendidas aguentam sem passar da margem mínima. */
  room: DiscountRoom[];
  /** Todos os pedidos com desconto vieram sem código (o cardápio não informa o cupom)? */
  noCodesAtAll: boolean;
};

type GroupRow = { coupon_code: string; orders: number | string; discount: number | string; gross: number | string; net: number | string };
type ProductRow = { coupon_code: string; product_id: string; qty: number | string; gross: number | string; net: number | string };

const PAGE = 1000;
const n = (v: unknown) => Number(v ?? 0);

/** Lê todas as linhas de uma função do banco (o PostgREST corta em 1000 por consulta). */
async function rpcAll<T>(name: string, args: Record<string, unknown>): Promise<T[]> {
  const supabase = await createClient();
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase.rpc(name, args).range(from, from + PAGE - 1);
    const rows = (data as T[] | null) ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** Nulo = esta marmitaria não tem cardápio conectado (ou unidade). */
export async function loadCoupons(orgId: string, canWrite: boolean, month: string): Promise<CouponData | null> {
  if (!(await hasMenuConnection(orgId))) return null;
  const ctx = await loadPricingContext(orgId, canWrite);
  if (!ctx) return null;
  const { start, end } = monthBounds(month);
  const args = { p_unit: ctx.unit.id, p_start: start.toISOString(), p_end: end.toISOString() };

  const [groupRows, productRows, menu, products, recipes, combos, weights, recipeSales] = await Promise.all([
    rpcAll<GroupRow>("menu_coupon_groups", args),
    rpcAll<ProductRow>("menu_coupon_products", args),
    loadMenuMonth(ctx.unit.id, month),
    loadMenuProducts(orgId),
    loadRecipeCosts(orgId, ctx.unit.id, ctx.settings.safetyMarginPct ?? 0),
    loadCombos(orgId, { active: true }),
    loadSalesWeights(ctx.unit.id),
    loadMenuRecipeSales(ctx.unit.id, start, end),
  ]);

  // custo de UMA venda de cada produto do cardápio (ficha × marmitas por venda; combo = custo do combo inteiro)
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const recipeCosts = new Map(recipes.map((r) => [r.id, { cost: r.cost }]));
  const comboCost = new Map(
    combos.map((c) => {
      const s = summarizeCombo(c, recipeCosts, weights, ctx.settings, 0);
      return [c.id, s.cost > 0 ? s.cost : null] as const;
    }),
  );
  const costPerSale = new Map<string, number | null>();
  for (const p of products) {
    if (p.ignored) continue;
    if (p.recipe_id) {
      const c = recipeById.get(p.recipe_id)?.cost ?? null;
      costPerSale.set(p.id, c === null ? null : c * p.units_per_sale);
    } else if (p.combo_id) costPerSale.set(p.id, comboCost.get(p.combo_id) ?? null);
  }

  const byCode = new Map<string, CouponGroupInput>();
  for (const g of groupRows) byCode.set(g.coupon_code, { code: g.coupon_code, orders: n(g.orders), discount: n(g.discount), gross: n(g.gross), net: n(g.net), products: [] });
  const inCoupons = new Map<string, { qty: number; net: number }>();
  for (const p of productRows) {
    byCode.get(p.coupon_code)?.products.push({ productId: p.product_id, qty: n(p.qty), gross: n(p.gross), net: n(p.net) });
    const t = inCoupons.get(p.product_id) ?? { qty: 0, net: 0 };
    inCoupons.set(p.product_id, { qty: t.qty + n(p.qty), net: t.net + n(p.net) });
  }
  // o que foi vendido nos pedidos SEM desconto: tudo do mês menos o que veio nos pedidos com desconto
  const baseline = menu.sales
    .map((s) => ({ productId: s.product_id, qty: Math.max(0, s.qty - (inCoupons.get(s.product_id)?.qty ?? 0)), net: Math.max(0, s.net - (inCoupons.get(s.product_id)?.net ?? 0)) }))
    .filter((b) => b.qty > 0);

  const variablePct = ctx.settings.taxPct + (ctx.settings.otherPct ?? 0);
  const minMarginPct = ctx.settings.minMarginPct;
  const analysis = analyzeCoupons({ groups: [...byCode.values()], costPerSale, variablePct, minMarginPct, totalOrders: menu.orders, baseline });

  const room: DiscountRoom[] = [...recipeSales.entries()]
    .flatMap(([id, s]) => {
      const r = recipeById.get(id);
      if (!r || r.cost === null || !(r.price && r.price > 0)) return [];
      return [{ id, name: r.name, price: r.price, cost: r.cost, units: s.units, maxDiscountPct: maxDiscountPct({ price: r.price, cost: r.cost, variablePct, minMarginPct }) }];
    })
    .sort((a, b) => b.units - a.units)
    .slice(0, 8);

  const noCodesAtAll = analysis.reports.length > 0 && analysis.reports.every((r) => r.code === "" || r.code === "?");
  return { unitName: ctx.unit.name, month, analysis, minMarginPct, room, noCodesAtAll };
}
