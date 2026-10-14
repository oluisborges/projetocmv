import { D, type Decimal, type Num } from "./decimal";

/** Uma marmita dentro de um grupo do combo. `cost` é o custo da ficha; `null` = ficha incompleta/sem custo. */
export type ComboOption = {
  cost: Num | null;
  /** Grupo FIXO: quantas unidades dessa marmita entram no combo. */
  qty?: number;
  /** Grupo FIXO: quanto cada unidade sai dentro do combo (R$). */
  unitPrice?: Num;
  /** Grupo de ESCOLHA: peso para a média (vendas recentes dessa marmita). */
  weight?: Num;
};

export type ComboGroup =
  | { kind: "fixed"; options: ComboOption[] }
  | { kind: "choice"; pickQty: number; unitPrice: Num; options: ComboOption[] };

/** Preço do combo: soma do que cada marmita sai dentro dele. */
export function comboPrice(groups: ComboGroup[]): Decimal {
  return groups.reduce((total, g) => {
    if (g.kind === "fixed") return g.options.reduce((s, o) => s.plus(D(o.unitPrice ?? 0).mul(o.qty ?? 0)), total);
    return total.plus(D(g.unitPrice).mul(g.pickQty));
  }, D(0));
}

/** Quantas marmitas vêm no combo. */
export function comboUnits(groups: ComboGroup[]): number {
  return groups.reduce((n, g) => (g.kind === "fixed" ? g.options.reduce((s, o) => s + (o.qty ?? 0), n) : n + g.pickQty), 0);
}

export type ComboCost = {
  /** Custo esperado do combo. No grupo de escolha, a média do custo das opções pesada pelas vendas (média simples se ninguém vendeu ainda). */
  cost: Decimal;
  /** Melhor e pior caso: o cliente escolhendo sempre a opção mais barata / mais cara de cada grupo. */
  min: Decimal;
  max: Decimal;
  /** Alguma marmita do combo está sem custo (ficha incompleta): o custo está subestimado. */
  incomplete: boolean;
};

export function comboCost(groups: ComboGroup[]): ComboCost {
  let cost = D(0);
  let min = D(0);
  let max = D(0);
  let incomplete = false;

  for (const g of groups) {
    if (g.kind === "fixed") {
      for (const o of g.options) {
        if (o.cost === null) {
          incomplete = true;
          continue;
        }
        const part = D(o.cost).mul(o.qty ?? 0);
        cost = cost.plus(part);
        min = min.plus(part);
        max = max.plus(part);
      }
      continue;
    }

    const costed = g.options.filter((o): o is ComboOption & { cost: Num } => o.cost !== null);
    if (costed.length < g.options.length) incomplete = true;
    if (costed.length === 0) continue;

    const weighted = costed.some((o) => D(o.weight ?? 0).gt(0));
    const weights = costed.map((o) => (weighted ? D(o.weight ?? 0) : D(1)));
    const totalWeight = weights.reduce((s, w) => s.plus(w), D(0));
    const avg = costed.reduce((s, o, i) => s.plus(D(o.cost).mul(weights[i])), D(0)).div(totalWeight);

    const costs = costed.map((o) => D(o.cost));
    cost = cost.plus(avg.mul(g.pickQty));
    min = min.plus(Decimal_min(costs).mul(g.pickQty));
    max = max.plus(Decimal_max(costs).mul(g.pickQty));
  }

  return { cost, min, max, incomplete };
}

const Decimal_min = (v: Decimal[]) => v.reduce((a, b) => (b.lt(a) ? b : a));
const Decimal_max = (v: Decimal[]) => v.reduce((a, b) => (b.gt(a) ? b : a));
