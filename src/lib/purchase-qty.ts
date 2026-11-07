import { baseUnitOf, isCompatibleUnit, isPurchaseUnit, toBaseQty, type PurchaseUnit } from "@/lib/calc";
import { parseDecimal } from "@/lib/format";

/** Quanto o insumo tem em UMA unidade de compra, na unidade-base (kg = 1000 g; l = 1000 ml; g, ml e un = 1). */
export const baseFactor = (purchaseUnit: string): number => (purchaseUnit === "kg" || purchaseUnit === "l" ? 1000 : 1);

/** Quantidade guardada (unidade-base) -> texto para o campo, na unidade em que o insumo é comprado ("1,5" kg). */
export function qtyToField(baseQty: number, purchaseUnit: string): string {
  const v = baseQty / baseFactor(purchaseUnit);
  return String(Math.round(v * 1000) / 1000).replace(".", ",");
}

/** Quantidade digitada (vírgula ou ponto) na unidade escolhida -> unidade-base do insumo. */
export function parsePurchaseQty(text: string, unit: string, purchaseUnit: string): { qty: number } | { error: string } {
  const parsed = parseDecimal(text);
  const n = parsed === null ? NaN : Number(parsed);
  if (!(n > 0)) return { error: "Digite quanto você comprou, como 2,5." };
  if (!isPurchaseUnit(unit) || !isPurchaseUnit(purchaseUnit) || !isCompatibleUnit(unit, baseUnitOf(purchaseUnit))) return { error: "Essa unidade não combina com o insumo." };
  const base = toBaseQty(n, unit as PurchaseUnit).toNumber();
  if (base > 100_000_000) return { error: "Quantidade muito grande." };
  return { qty: base };
}

/** Valor em reais digitado ("48,90"); vazio = sem valor (`null`); inválido = `undefined`. */
export function parsePaid(text: string): number | null | undefined {
  if (text.trim() === "") return null;
  const p = parseDecimal(text);
  const n = p === null ? NaN : Number(p);
  return Number.isFinite(n) && n >= 0 && n <= 10_000_000 ? n : undefined;
}
