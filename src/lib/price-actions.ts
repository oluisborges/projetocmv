// "O que fazer agora": para cada marmita abaixo da meta, o preço que bateria a meta de margem líquida.
// Não é uma recomendação de mercado (o dono conhece a região e a concorrência): é a conta do piso. Só sobe, nunca sugere baixar.

export type PriceActionDish = { id: string; name: string; cost: number | null; price: number | null; netPct: number | null };

export type PriceActionSettings = { taxPct: number; otherPct?: number; fixedExpensePct: number; minMarginPct: number };

export type PriceAction = {
  id: string;
  name: string;
  price: number;
  /** Preço que bate a meta, arredondado para cima em R$ 0,50. */
  targetPrice: number;
  /** Aumento por marmita, R$. */
  rise: number;
  risePct: number;
  currentNetPct: number;
  /** Quanto passa a sobrar por mês nesta marmita com o preço novo, no ritmo de vendas dos últimos meses; `null` sem vendas. */
  gainPerMonth: number | null;
};

/** Preço para a margem líquida chegar à meta: custo ÷ (1 − impostos − taxas − despesa fixa − meta). `null` se a conta não fecha. */
export function priceForNetMargin(cost: number, settings: PriceActionSettings, feePct: number): number | null {
  const denominator = 1 - settings.taxPct - feePct - (settings.otherPct ?? 0) - settings.fixedExpensePct - settings.minMarginPct;
  if (!(cost > 0) || denominator <= 0.05) return null;
  return cost / denominator;
}

const ceilTo = (v: number, step: number) => Math.ceil(v / step - 1e-9) * step;

export function priceActions(input: {
  dishes: PriceActionDish[];
  settings: PriceActionSettings;
  feePct: number;
  /** Marmitas vendidas por produto nos últimos meses. */
  units?: Map<string, number>;
  /** Quantos meses de vendas o `units` cobre. */
  months?: number;
  limit?: number;
}): PriceAction[] {
  const { settings, feePct, units, months = 3, limit = 3 } = input;
  const out: PriceAction[] = [];
  for (const d of input.dishes) {
    if (d.cost === null || !(d.cost > 0) || d.price === null || !(d.price > 0) || d.netPct === null) continue;
    if (d.netPct >= settings.minMarginPct) continue;
    const exact = priceForNetMargin(d.cost, settings, feePct);
    if (exact === null) continue;
    const targetPrice = Math.round(ceilTo(exact, 0.5) * 100) / 100;
    if (targetPrice <= d.price) continue;
    const sold = units?.get(d.id) ?? 0;
    // Sobra a mais por marmita = aumento × (1 − impostos − taxas): o resto do aumento vai para imposto e taxa.
    const keep = 1 - settings.taxPct - feePct - (settings.otherPct ?? 0);
    out.push({
      id: d.id,
      name: d.name,
      price: d.price,
      targetPrice,
      rise: Math.round((targetPrice - d.price) * 100) / 100,
      risePct: (targetPrice - d.price) / d.price,
      currentNetPct: d.netPct,
      gainPerMonth: sold > 0 ? ((targetPrice - d.price) * keep * sold) / months : null,
    });
  }
  // Quem mais rende primeiro; sem vendas, quem está mais longe da meta.
  return out.sort((a, b) => (b.gainPerMonth ?? -1) - (a.gainPerMonth ?? -1) || a.currentNetPct - b.currentNetPct).slice(0, limit);
}
