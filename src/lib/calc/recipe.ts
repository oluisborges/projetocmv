import { D, type Decimal, type Num, safeDiv } from "./decimal";
import { grossQty } from "./ingredient";

/** Faltou informar quantas porções a receita rende (ou o peso da porção). */
export class NoPortionsError extends Error {
  constructor() {
    super("Informe o número de porções ou o peso da porção");
    this.name = "NoPortionsError";
  }
}

export type RecipeItem = {
  /** Custo por unidade-base do insumo comprado (bruto). Ver `unitCost`. */
  unitCost: Num;
  /** Fator de correção do insumo (>= 1). Embalagens normalmente 1. */
  correctionFactor: Num;
  /** Quantidade LÍQUIDA na unidade-base. Em itens `portion`, é por porção. */
  netQty: Num;
  /** `batch` entra no lote; `portion` (embalagem, etiqueta, lacre) é por porção. */
  scope: "batch" | "portion";
  /**
   * Rendimento depois de pronto = peso pronto ÷ peso cru e limpo (arroz 2,5; frango grelhado 0,75). Padrão 1.
   * Quando informado, `netQty` é o peso PRONTO (o que vai na marmita) e o cru comprado é `netQty ÷ rendimento`.
   */
  cookingYield?: Num;
  /** O peso do item entra no rendimento? Padrão: true. */
  countsForYield?: boolean;
};

export type RecipeInput = {
  items: RecipeItem[];
  /** Perda de cocção, fração (0.25 = perde 25% do peso). */
  cookingLossPct?: Num;
  /** Número de porções informado. Se ausente, usa `portionWeight`. */
  portions?: Num;
  /** Peso de cada porção pronta (g). */
  portionWeight?: Num;
};

export type RecipeCost = {
  batchCost: Decimal;
  /** Peso pronto do lote (g) depois da perda de cocção. */
  yieldWeight: Decimal;
  portions: Decimal;
  /** Parte do custo que vem do lote, por porção. */
  ingredientCostPerPortion: Decimal;
  /** Embalagens e itens por porção. */
  packagingCostPerPortion: Decimal;
  costPerPortion: Decimal;
};

const itemCost = (i: RecipeItem): Decimal => {
  const y = D(i.cookingYield ?? 1);
  if (y.lte(0)) throw new RangeError("Rendimento depois de pronto precisa ser maior que zero");
  // pronto -> cru limpo (÷ rendimento) -> cru comprado (× fator de correção) -> custo
  return D(i.unitCost).mul(grossQty(D(i.netQty).div(y), i.correctionFactor));
};

export function recipeCost(r: RecipeInput): RecipeCost {
  const loss = D(r.cookingLossPct ?? 0);
  if (loss.lt(0) || loss.gte(1)) throw new RangeError("Perda de cocção deve estar entre 0 e 100%");

  const batchItems = r.items.filter((i) => i.scope === "batch");
  const portionItems = r.items.filter((i) => i.scope === "portion");

  const batchCost = batchItems.reduce((s, i) => s.plus(itemCost(i)), D(0));
  const yieldWeight = batchItems
    .filter((i) => i.countsForYield !== false)
    .reduce((s, i) => s.plus(i.netQty), D(0))
    .mul(D(1).minus(loss));

  let portions: Decimal;
  if (r.portions !== undefined) portions = D(r.portions);
  else if (r.portionWeight !== undefined && D(r.portionWeight).gt(0))
    portions = yieldWeight.div(r.portionWeight).floor();
  else throw new NoPortionsError();
  if (portions.lte(0)) throw new RangeError("Número de porções deve ser maior que zero");

  const ingredientCostPerPortion = safeDiv(batchCost, portions);
  const packagingCostPerPortion = portionItems.reduce((s, i) => s.plus(itemCost(i)), D(0));

  return {
    batchCost,
    yieldWeight,
    portions,
    ingredientCostPerPortion,
    packagingCostPerPortion,
    costPerPortion: ingredientCostPerPortion.plus(packagingCostPerPortion),
  };
}
