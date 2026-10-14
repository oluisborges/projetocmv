import { comboCost, comboPrice, comboUnits, type ComboGroup } from "@/lib/calc";
import { analyzePrice, type PriceAnalysis, type PricingSettings } from "@/lib/pricing-view";

/** O mínimo que o combo precisa saber de uma ficha. */
export type ComboRecipeInfo = { cost: number | null };

export type ComboShape = {
  groups: {
    kind: "fixed" | "choice";
    pick_qty: number | null;
    unit_price: number | null;
    options: { recipe_id: string; qty: number | null; unit_price: number | null }[];
  }[];
};

/** Monta os grupos no formato do cálculo. `weights` = vendas recentes por ficha (peso da média nos grupos de escolha). */
export function toCalcGroups(combo: ComboShape, recipes: Map<string, ComboRecipeInfo>, weights: Map<string, number>): ComboGroup[] {
  return combo.groups.map((g): ComboGroup => {
    const options = g.options.map((o) => ({
      // ficha arquivada ou inexistente: sem custo (o combo avisa que está incompleto)
      cost: recipes.get(o.recipe_id)?.cost ?? null,
      qty: o.qty ?? undefined,
      unitPrice: o.unit_price ?? undefined,
      weight: weights.get(o.recipe_id) ?? 0,
    }));
    return g.kind === "fixed" ? { kind: "fixed", options } : { kind: "choice", pickQty: g.pick_qty ?? 0, unitPrice: g.unit_price ?? 0, options };
  });
}

export type ComboSummary = {
  units: number;
  price: number;
  cost: number;
  costMin: number;
  costMax: number;
  /** Alguma marmita do combo está sem custo (ficha incompleta ou arquivada). */
  incomplete: boolean;
  /** Algum grupo de escolha usa média: o custo real depende do que o cliente escolhe. */
  hasChoice: boolean;
  /** Quanto, em média, cada marmita sai dentro do combo. */
  pricePerUnit: number | null;
  /** Lucro do combo (mesma conta das marmitas: imposto, taxa do canal e despesas fixas). `null` se falta preço ou custo. */
  analysis: PriceAnalysis | null;
  empty: boolean;
};

export function summarizeCombo(
  combo: ComboShape,
  recipes: Map<string, ComboRecipeInfo>,
  weights: Map<string, number>,
  settings: PricingSettings,
  feePct: number,
): ComboSummary {
  const groups = toCalcGroups(combo, recipes, weights);
  const units = comboUnits(groups);
  const price = comboPrice(groups).toNumber();
  const c = comboCost(groups);
  const cost = c.cost.toNumber();
  return {
    units,
    price,
    cost,
    costMin: c.min.toNumber(),
    costMax: c.max.toNumber(),
    incomplete: c.incomplete,
    hasChoice: combo.groups.some((g) => g.kind === "choice"),
    pricePerUnit: units > 0 ? price / units : null,
    analysis: price > 0 && cost > 0 ? analyzePrice({ cost, settings, feePct, price }) : null,
    empty: units === 0,
  };
}
