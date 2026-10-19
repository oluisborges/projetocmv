import { estimateOutsideSales, summarizeMenuMonth, type MenuLine, type MenuMonth, type OutsideDish, type OutsideEstimate } from "@/lib/calc";

/** Produto do cardápio com o vínculo que o dono fez. */
export type MenuProductLink = {
  id: string;
  recipe_id: string | null;
  combo_id: string | null;
  units_per_sale: number;
  ignored: boolean;
};

/**
 * Vendas do mês de um produto (já somadas pelo banco). `revenue` é o valor da linha no cardápio; `net` é o valor realmente pago,
 * depois de tirar a parte do cupom do pedido (o cupom vale para o pedido todo, então cada linha leva a mesma fração).
 * O lucro e a cobertura usam `net`.
 */
export type MenuProductSales = { product_id: string; qty: number; revenue: number; net: number };

/** Custo e marmitas de uma ficha ou combo, vindos das telas de Marmitas e Combos. `cost` nulo = ficha incompleta. */
export type LinkTarget = { cost: number | null; units?: number };

export type MenuMonthView = {
  summary: MenuMonth;
  lines: MenuLine[];
  /** Produtos vendidos no mês que ainda não têm vínculo (e não foram marcados como "não é marmita"). */
  unlinkedProducts: number;
};

/**
 * Junta as vendas do mês com os vínculos e os custos das fichas. Ficha: o custo de uma venda é o da ficha × marmitas por venda.
 * Combo: o custo de uma venda é o do combo inteiro, e ele já leva as marmitas que tem.
 */
export function buildMenuMonth(input: {
  products: MenuProductLink[];
  sales: MenuProductSales[];
  recipes: Map<string, LinkTarget>;
  combos: Map<string, LinkTarget>;
  /** imposto + taxa do canal, em fração */
  variablePct: number;
}): MenuMonthView {
  const byId = new Map(input.products.map((p) => [p.id, p]));
  const lines: MenuLine[] = [];
  let unlinkedProducts = 0;

  for (const s of input.sales) {
    const p = byId.get(s.product_id);
    if (!p || s.qty <= 0) continue;
    if (p.ignored) {
      lines.push({ status: "ignored", qty: s.qty, revenue: s.net });
    } else if (p.recipe_id) {
      const t = input.recipes.get(p.recipe_id);
      lines.push({
        status: "linked",
        qty: s.qty,
        revenue: s.net,
        costPerSale: t?.cost == null ? null : t.cost * p.units_per_sale,
        unitsPerSale: p.units_per_sale,
      });
    } else if (p.combo_id) {
      const t = input.combos.get(p.combo_id);
      lines.push({ status: "linked", qty: s.qty, revenue: s.net, costPerSale: t?.cost ?? null, unitsPerSale: t?.units ?? 1 });
    } else {
      unlinkedProducts++;
      lines.push({ status: "unlinked", qty: s.qty, revenue: s.net });
    }
  }
  return { summary: summarizeMenuMonth(lines, input.variablePct), lines, unlinkedProducts };
}

/**
 * Resultado de um mês com cardápio: lucro real do cardápio e estimado da venda por fora.
 * A venda por fora vale o que o dono digitou; com quantidades por ficha, o lucro vem do preço que ele cadastrou e do custo da ficha.
 */
export function menuProfit(
  view: MenuMonthView,
  outside: { typedRevenue: number; dishes: OutsideDish[]; variablePct: number },
): { menu: MenuMonth; outside: OutsideEstimate; outsideRevenue: number; outsideFromDishes: boolean } {
  const r = estimateOutsideSales({ typedRevenue: outside.typedRevenue, dishes: outside.dishes, menu: view.summary, variablePct: outside.variablePct });
  return { menu: view.summary, outside: r.estimate, outsideRevenue: r.revenue.toNumber(), outsideFromDishes: r.fromDishes };
}

/**
 * Este mês usa os números do cardápio? Só quando a conexão existe E há pedidos no mês. Mês anterior à conexão (sem pedidos)
 * continua com o faturamento digitado como total, como sempre foi.
 */
export function usesMenu(connected: boolean, orders: number): boolean {
  return connected && orders > 0;
}
