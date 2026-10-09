import { D, type Decimal, type Num, safeDiv } from "./decimal";

export type PurchaseUnit = "kg" | "g" | "l" | "ml" | "un";
export type BaseUnit = "g" | "ml" | "un";

const TO_BASE: Record<PurchaseUnit, { base: BaseUnit; factor: number }> = {
  kg: { base: "g", factor: 1000 },
  g: { base: "g", factor: 1 },
  l: { base: "ml", factor: 1000 },
  ml: { base: "ml", factor: 1 },
  un: { base: "un", factor: 1 },
};

export const baseUnitOf = (unit: PurchaseUnit): BaseUnit => TO_BASE[unit].base;

/** Converte uma quantidade na unidade de compra para a unidade-base (g/ml/un). */
export function toBaseQty(qty: Num, unit: PurchaseUnit): Decimal {
  return D(qty).mul(TO_BASE[unit].factor);
}

/**
 * Custo por unidade-base (R$/g, R$/ml ou R$/un) do que foi COMPRADO (bruto).
 * Ex.: frango a R$ 14,00 o kg => 0,014 R$/g.
 */
export function unitCost(input: {
  purchasePrice: Num;
  purchaseQty: Num;
  purchaseUnit: PurchaseUnit;
}): Decimal {
  return safeDiv(input.purchasePrice, toBaseQty(input.purchaseQty, input.purchaseUnit));
}

/**
 * Quantidade bruta = quantidade líquida × fator de correção (FC = bruto ÷ líquido).
 * FC precisa ser >= 1.
 */
export function grossQty(netQty: Num, correctionFactor: Num): Decimal {
  const fc = D(correctionFactor);
  if (fc.lt(1)) throw new RangeError("Fator de correção não pode ser menor que 1");
  return D(netQty).mul(fc);
}

/** Variação percentual entre dois preços (ex.: 0.08 = +8%). Zero se o anterior for zero. */
export function priceChangePct(previous: Num, current: Num): Decimal {
  return safeDiv(D(current).minus(previous), previous);
}

/** Inverso de `toBaseQty`: 1500 g -> 1,5 kg. */
export function fromBaseQty(baseQty: Num, unit: PurchaseUnit): Decimal {
  return D(baseQty).div(TO_BASE[unit].factor);
}

/** Unidades que o dono pode escolher para um item, conforme a unidade-base dele (g, ml ou un). */
export function unitsFor(base: BaseUnit): PurchaseUnit[] {
  return base === "g" ? ["g", "kg"] : base === "ml" ? ["ml", "l"] : ["un"];
}

export const isPurchaseUnit = (v: string): v is PurchaseUnit => Object.hasOwn(TO_BASE, v);

/** A unidade escolhida mede a mesma coisa que o item? (kg com insumo em gramas: sim; litro com gramas: não). */
export const isCompatibleUnit = (unit: PurchaseUnit, base: BaseUnit): boolean => TO_BASE[unit].base === base;
