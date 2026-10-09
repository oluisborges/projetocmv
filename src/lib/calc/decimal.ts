import Decimal from "decimal.js";

export { Decimal };
export type Num = Decimal.Value;

export const D = (v: Num): Decimal => new Decimal(v);

/** Arredonda para centavos (meio para cima), como o dono espera ver na tela. */
export const toCents = (v: Num): Decimal => D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/** Divisão que devolve zero em vez de Infinity/NaN quando o divisor é zero. */
export const safeDiv = (a: Num, b: Num): Decimal => (D(b).isZero() ? D(0) : D(a).div(b));
