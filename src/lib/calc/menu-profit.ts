import { D, safeDiv, toCents, type Decimal, type Num } from "./decimal";

/**
 * Linha vendida no cardápio, já agregada por produto no mês.
 * `status`: "linked" = o dono vinculou a uma ficha/combo; "unlinked" = ainda sem vínculo; "ignored" = não é marmita (bebida, taxa).
 */
export type MenuLine = {
  status: "linked" | "unlinked" | "ignored";
  /** Quantas vezes o produto foi vendido. */
  qty: Num;
  /** Valor vendido (R$), como o cardápio informou. */
  revenue: Num;
  /** Custo de UMA venda: custo da ficha × marmitas por venda. `null` = ficha incompleta. Só vale para "linked". */
  costPerSale?: Num | null;
  /** Quantas marmitas uma venda leva (kit de 10 = 10). Padrão 1. */
  unitsPerSale?: number;
};

export type MenuMonth = {
  /** Soma de tudo que foi vendido nas linhas vinculadas. */
  linkedRevenue: Decimal;
  unlinkedRevenue: Decimal;
  ignoredRevenue: Decimal;
  /** Parte da receita (vinculada + sem vínculo) que já tem vínculo; `null` se não vendeu nada. Ignorados não contam. */
  coverage: Decimal | null;
  /** Marmitas vendidas nas linhas vinculadas. */
  linkedUnits: Decimal;
  /** Custo das marmitas vendidas (só linhas vinculadas e com custo). */
  cost: Decimal;
  /** Receita das linhas vinculadas cujo custo é conhecido. É a base da margem. */
  costedRevenue: Decimal;
  /** Linhas vinculadas cuja ficha está incompleta: ficam fora da margem. */
  linesWithoutCost: number;
  /** Lucro de contribuição real: receita − custo − impostos/taxas, só do que tem custo conhecido. */
  contribution: Decimal;
  /** Contribuição ÷ receita das linhas com custo; `null` se não há base. */
  contributionPct: Decimal | null;
};

/** `variablePct` = imposto + taxa do canal, em fração (0,06 = 6%). */
export function summarizeMenuMonth(lines: MenuLine[], variablePct: Num = 0): MenuMonth {
  let linkedRevenue = D(0);
  let unlinkedRevenue = D(0);
  let ignoredRevenue = D(0);
  let linkedUnits = D(0);
  let cost = D(0);
  let costedRevenue = D(0);
  let linesWithoutCost = 0;

  for (const l of lines) {
    const revenue = D(l.revenue);
    if (l.status === "ignored") ignoredRevenue = ignoredRevenue.plus(revenue);
    else if (l.status === "unlinked") unlinkedRevenue = unlinkedRevenue.plus(revenue);
    else {
      linkedRevenue = linkedRevenue.plus(revenue);
      linkedUnits = linkedUnits.plus(D(l.qty).mul(l.unitsPerSale ?? 1));
      if (l.costPerSale === null || l.costPerSale === undefined) linesWithoutCost++;
      else {
        cost = cost.plus(D(l.costPerSale).mul(l.qty));
        costedRevenue = costedRevenue.plus(revenue);
      }
    }
  }

  const known = linkedRevenue.plus(unlinkedRevenue);
  const contribution = costedRevenue.minus(cost).minus(costedRevenue.mul(variablePct));
  return {
    linkedRevenue,
    unlinkedRevenue,
    ignoredRevenue,
    coverage: known.isZero() ? null : linkedRevenue.div(known),
    linkedUnits,
    cost,
    costedRevenue,
    linesWithoutCost,
    contribution,
    contributionPct: costedRevenue.isZero() ? null : safeDiv(contribution, costedRevenue),
  };
}

/** Abaixo disso o lucro "por fora" não é estimado: a margem do cardápio ainda não representa o negócio. */
export const MIN_ESTIMATE_COVERAGE = 0.5;

export type OutsideEstimate =
  /** `source`: "mix" = calculado com as quantidades por ficha e os preços cadastrados; "menu" = mesma margem do cardápio. */
  | { ok: true; contribution: Decimal; pct: Decimal; source: "mix" | "menu" }
  | { ok: false; reason: "no-outside-revenue" | "no-margin" | "low-coverage" };

/**
 * Lucro estimado da venda por fora: o faturamento digitado × a margem do cardápio. É uma projeção (não sabemos o que foi vendido
 * por fora), por isso exige que boa parte do cardápio já tenha vínculo.
 */
export function estimateOutside(outsideRevenue: Num, menu: Pick<MenuMonth, "contributionPct" | "coverage">): OutsideEstimate {
  if (D(outsideRevenue).lte(0)) return { ok: false, reason: "no-outside-revenue" };
  if (menu.contributionPct === null) return { ok: false, reason: "no-margin" };
  if (menu.coverage === null || menu.coverage.lt(MIN_ESTIMATE_COVERAGE)) return { ok: false, reason: "low-coverage" };
  return { ok: true, contribution: toCents(D(outsideRevenue).mul(menu.contributionPct)), pct: menu.contributionPct, source: "menu" };
}

/** Uma ficha vendida por fora do cardápio: quantas unidades, o preço que o dono cadastrou e o custo da ficha (nulos = não conta). */
export type OutsideDish = { qty: Num; price: Num | null; cost: Num | null };

export type OutsideMix = {
  /** Quantidade × preço cadastrado, só das fichas com preço. */
  revenue: Decimal;
  /** Receita das fichas que têm preço E custo: a base da margem. */
  costedRevenue: Decimal;
  contribution: Decimal;
  /** Contribuição ÷ receita com custo; `null` se não há base. */
  pct: Decimal | null;
};

/** Venda por fora com quantidades por ficha: o valor vem do preço que o dono cadastrou no sistema (não do cardápio). */
export function summarizeOutsideMix(dishes: OutsideDish[], variablePct: Num = 0): OutsideMix {
  let revenue = D(0);
  let costedRevenue = D(0);
  let cost = D(0);
  for (const d of dishes) {
    const qty = D(d.qty);
    if (qty.lte(0) || d.price === null || D(d.price).lte(0)) continue;
    const r = qty.mul(d.price);
    revenue = revenue.plus(r);
    if (d.cost !== null) {
      costedRevenue = costedRevenue.plus(r);
      cost = cost.plus(qty.mul(d.cost));
    }
  }
  const contribution = costedRevenue.minus(cost).minus(costedRevenue.mul(variablePct));
  return { revenue, costedRevenue, contribution, pct: costedRevenue.isZero() ? null : contribution.div(costedRevenue) };
}

/**
 * Lucro da venda por fora. Se o dono informou as quantidades por ficha, vale o mix dele (preço cadastrado × custo da ficha);
 * senão, a margem do cardápio. O valor vendido é o que ele digitou; sem valor digitado, o das quantidades × preços cadastrados.
 */
export function estimateOutsideSales(input: {
  typedRevenue: Num;
  dishes: OutsideDish[];
  menu: Pick<MenuMonth, "contributionPct" | "coverage">;
  variablePct: Num;
}): { revenue: Decimal; fromDishes: boolean; estimate: OutsideEstimate } {
  const mix = summarizeOutsideMix(input.dishes, input.variablePct);
  const typed = D(input.typedRevenue);
  const revenue = typed.gt(0) ? typed : mix.revenue;
  const fromDishes = typed.lte(0) && mix.revenue.gt(0);
  if (revenue.lte(0)) return { revenue, fromDishes, estimate: { ok: false, reason: "no-outside-revenue" } };
  if (mix.pct !== null) return { revenue, fromDishes, estimate: { ok: true, contribution: toCents(revenue.mul(mix.pct)), pct: mix.pct, source: "mix" } };
  return { revenue, fromDishes, estimate: estimateOutside(revenue, input.menu) };
}

export type MonthTotals = {
  /** Cardápio (real) + digitado (venda por fora). */
  revenue: Decimal;
  units: Decimal;
};

/** Faturamento e marmitas do mês: o que veio do cardápio somado ao que o dono digitou de venda por fora. */
export function combineMonthTotals(input: { menuRevenue: Num; menuUnits: Num; outsideRevenue: Num; outsideUnits: Num }): MonthTotals {
  return {
    revenue: D(input.menuRevenue).plus(input.outsideRevenue),
    units: D(input.menuUnits).plus(input.outsideUnits),
  };
}
