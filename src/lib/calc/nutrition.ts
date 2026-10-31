import { D } from "./decimal";

/** Os nutrientes da tabela nutricional (RDC 429/2020 e IN 75/2020), na unidade em que aparecem: kcal, g e mg (sódio). */
export const NUTRIENT_KEYS = ["kcal", "carbs", "sugars", "addedSugars", "protein", "fat", "satFat", "transFat", "fiber", "sodium"] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
/** `null` = sem dado (a TACO não traz, ou ninguém preencheu). */
export type Nutrition = Record<NutrientKey, number | null>;

export const emptyNutrition = (): Nutrition => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, null])) as Nutrition;

/** Valores Diários de Referência (adultos, dieta de 2.000 kcal) usados no %VD da IN 75/2020. */
export const DAILY_VALUES: Partial<Record<NutrientKey, number>> = { kcal: 2000, carbs: 300, addedSugars: 50, protein: 75, fat: 55, satFat: 22, fiber: 25, sodium: 2400 };

export const KJ_PER_KCAL = 4.184;

export type NutritionPart = {
  /** Quanto entra na porção, em gramas (ml contam como g). */
  grams: number;
  /** Nutrientes por 100 g do ingrediente; `null` = ingrediente sem alimento da TACO ligado. */
  per100: Nutrition | null;
};

/**
 * Soma o que cada ingrediente traz para a porção. Um nutriente só fica `null` se NENHUM ingrediente tiver o dado
 * (assim "sem dado" não vira zero escondido). Ingredientes sem nutrição ligada entram em `missing`.
 */
export function sumNutrition(parts: NutritionPart[]): { total: Nutrition; missing: number } {
  const acc = new Map<NutrientKey, ReturnType<typeof D>>();
  let missing = 0;
  for (const p of parts) {
    if (!p.per100) {
      missing++;
      continue;
    }
    for (const k of NUTRIENT_KEYS) {
      const v = p.per100[k];
      if (v === null) continue;
      acc.set(k, (acc.get(k) ?? D(0)).plus(D(v).times(p.grams).div(100)));
    }
  }
  const total = emptyNutrition();
  for (const [k, v] of acc) total[k] = v.toNumber();
  return { total, missing };
}

/** Reescala valores de `fromGrams` para `toGrams` do mesmo alimento (ex.: da porção para 100 g). */
export function scaleNutrition(n: Nutrition, fromGrams: number, toGrams: number): Nutrition {
  const out = emptyNutrition();
  if (!(fromGrams > 0)) return out;
  for (const k of NUTRIENT_KEYS) out[k] = n[k] === null ? null : D(n[k]).times(toGrams).div(fromGrams).toNumber();
  return out;
}

/** %VD de uma quantidade; `null` quando o nutriente não tem valor de referência (ex.: açúcares totais e gorduras trans). */
export function percentDV(key: NutrientKey, value: number | null): number | null {
  const ref = DAILY_VALUES[key];
  if (ref === undefined || value === null) return null;
  return D(value).div(ref).times(100).toDecimalPlaces(0).toNumber();
}

/**
 * Arredondamento do rótulo (aproximação das regras da IN 75/2020): energia e sódio sem casas (sódio abaixo de 5 mg vale 0),
 * gramas abaixo de 0,5 viram 0, até 10 g com uma casa e a partir de 10 g inteiro; gorduras trans abaixo de 0,2 g valem 0.
 */
export function roundForLabel(key: NutrientKey, value: number | null): number | null {
  if (value === null) return null;
  if (key === "kcal") return D(value).toDecimalPlaces(0).toNumber();
  if (key === "sodium") return value < 5 ? 0 : D(value).toDecimalPlaces(0).toNumber();
  if (key === "transFat") return value < 0.2 ? 0 : D(value).toDecimalPlaces(1).toNumber();
  if (value < 0.5) return 0;
  return value < 10 ? D(value).toDecimalPlaces(1).toNumber() : D(value).toDecimalPlaces(0).toNumber();
}

/** Energia em kJ a partir de kcal. */
export const kcalToKj = (kcal: number): number => D(kcal).times(KJ_PER_KCAL).toDecimalPlaces(0).toNumber();
