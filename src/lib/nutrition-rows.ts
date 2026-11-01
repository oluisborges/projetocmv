import { kcalToKj, percentDV, roundForLabel, type NutrientKey, type Nutrition } from "@/lib/calc/nutrition";

/** As linhas da tabela, na ordem da RDC 429/2020. */
export const ROWS: { key: NutrientKey; label: string; unit: string; /** Recuo: subitem do de cima. */ indent?: boolean }[] = [
  { key: "kcal", label: "Valor energético", unit: "kcal" },
  { key: "carbs", label: "Carboidratos totais", unit: "g" },
  { key: "sugars", label: "Açúcares totais", unit: "g", indent: true },
  { key: "addedSugars", label: "Açúcares adicionados", unit: "g", indent: true },
  { key: "protein", label: "Proteínas", unit: "g" },
  { key: "fat", label: "Gorduras totais", unit: "g" },
  { key: "satFat", label: "Gorduras saturadas", unit: "g", indent: true },
  { key: "transFat", label: "Gorduras trans", unit: "g", indent: true },
  { key: "fiber", label: "Fibra alimentar", unit: "g" },
  { key: "sodium", label: "Sódio", unit: "mg" },
];

const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** `*Sub` é a segunda linha da célula (a energia também em kJ). */
export type NutritionRowView = { key: NutrientKey; label: string; unit: string; indent: boolean; per100: string; per100Sub: string | null; perPortion: string; perPortionSub: string | null; vd: string };

const show = (key: NutrientKey, unit: string, v: number | null): { main: string; sub: string | null } => {
  const r = roundForLabel(key, v);
  if (r === null) return { main: "—", sub: null };
  return key === "kcal" ? { main: `${fmt(r)} kcal`, sub: `${fmt(kcalToKj(r))} kJ` } : { main: `${fmt(r)} ${unit}`, sub: null };
};

/** A tabela pronta para mostrar: valores arredondados como no rótulo e o %VD da porção. */
export function nutritionRows(per100: Nutrition | null, perPortion: Nutrition): NutritionRowView[] {
  return ROWS.map((r) => {
    const vd = percentDV(r.key, roundForLabel(r.key, perPortion[r.key]));
    const a = per100 ? show(r.key, r.unit, per100[r.key]) : { main: "—", sub: null };
    const b = show(r.key, r.unit, perPortion[r.key]);
    return {
      key: r.key,
      label: r.label,
      unit: r.unit,
      indent: Boolean(r.indent),
      per100: a.main,
      per100Sub: a.sub,
      perPortion: b.main,
      perPortionSub: b.sub,
      vd: vd === null ? "**" : `${vd}`,
    };
  });
}
