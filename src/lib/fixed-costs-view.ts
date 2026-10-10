import { D, breakEven, contributionMargin, fixedCostPerUnit, fixedExpensePct, staffMonthlyCost, type StaffMember } from "@/lib/calc";

export type FixedCostSummary = {
  fixedTotal: number;
  staffTotal: number;
  /** Custos fixos + equipe, por mês. */
  total: number;
  /** Quanto cada marmita precisa pagar de custo fixo (precisa das marmitas por mês). */
  perUnit: number | null;
  /** Fração do faturamento que vai para custo fixo (precisa do faturamento mensal). Alimenta o preço sugerido. */
  pctOfRevenue: number | null;
  /** Quanto vender por mês para empatar (precisa de ao menos um produto com preço). */
  breakEven: null | { units: number; revenue: number; perDay: number; avgPrice: number; avgContribution: number };
};

/**
 * Resumo dos custos fixos do mês. A equipe entra como custo fixo (salário + encargos): em marmitaria pequena
 * a mão de obra não varia com a venda do dia. O ponto de equilíbrio usa a contribuição média dos produtos com preço,
 * todas com o mesmo peso (não há vendas por prato nesta etapa).
 */
export function summarizeFixedCosts(input: {
  fixedCosts: number[];
  staff: StaffMember[];
  monthlyRevenue: number | null;
  monthlyUnits: number | null;
  dishes: { price: number; cost: number }[];
  taxPct: number;
  feePct: number;
}): FixedCostSummary {
  const fixedTotal = input.fixedCosts.reduce((s, v) => s.plus(v), D(0));
  const staffTotal = input.staff.reduce((s, m) => s.plus(staffMonthlyCost(m)), D(0));
  const total = fixedTotal.plus(staffTotal);

  const perUnit = input.monthlyUnits && input.monthlyUnits > 0 && total.gt(0) ? fixedCostPerUnit(total, input.monthlyUnits).toNumber() : null;
  const pctOfRevenue = input.monthlyRevenue && input.monthlyRevenue > 0 && total.gt(0) ? fixedExpensePct(total, input.monthlyRevenue).toNumber() : null;

  let be: FixedCostSummary["breakEven"] = null;
  const priced = input.dishes.filter((d) => d.price > 0);
  if (total.gt(0) && priced.length > 0) {
    const rates = { taxPct: input.taxPct, salesFeePct: input.feePct };
    const mix = priced.map((d) => ({ price: d.price, margin: contributionMargin(d.price, d.cost, rates).toNumber(), qtySold: 1 }));
    const result = breakEven(total, mix);
    if (result) {
      const units = result.units.toNumber();
      be = {
        units,
        revenue: result.revenue.toNumber(),
        perDay: Math.ceil(units / 30),
        avgPrice: D(priced.reduce((s, d) => s + d.price, 0)).div(priced.length).toNumber(),
        avgContribution: D(mix.reduce((s, m) => s + m.margin, 0)).div(mix.length).toNumber(),
      };
    }
  }

  return { fixedTotal: fixedTotal.toNumber(), staffTotal: staffTotal.toNumber(), total: total.toNumber(), perUnit, pctOfRevenue, breakEven: be };
}
