import { baseUnitOf, isPurchaseUnit } from "@/lib/calc";
import { formatBaseQty, formatNumber } from "@/lib/format";
import { computeRecipe, type CostItem } from "@/lib/recipe-cost";

/** Insumo como a ficha o enxerga (inclusive a Receita usada numa marmita, que vem como item "por grama"). */
export type FichaIngredient = {
  id: string;
  name: string;
  kind: "insumo" | "embalagem" | "receita";
  purchase_unit: string;
  unit_cost: number;
  correction_factor: number;
  cooking_yield: number;
};

export type FichaRecipeInput = {
  id: string;
  kind: "marmita" | "receita";
  name: string;
  category: string | null;
  mode: "serving" | "batch";
  portions: number | null;
  portion_weight: number | null;
  portion_weight_unit: "g" | "kg" | "ml" | "l" | "un";
  cooking_loss_pct: number;
};

export type FichaItemInput = { ingredient_id: string; net_qty: number; qty_unit: string | null; scope: "batch" | "portion" };

export type FichaLine = {
  name: string;
  tag: "insumo" | "receita" | "embalagem";
  /** Peso líquido, na unidade em que foi digitado ("115 g", "0,5 kg"). */
  net: string;
  /** Fator de correção/rendimento: bruto ÷ líquido. */
  factor: number;
  /** Peso bruto (o que se compra para ter o líquido). */
  gross: string;
  /** R$ da linha; `null` sem preço. */
  cost: number | null;
};

export type FichaTecnica = {
  id: string;
  kind: "marmita" | "receita";
  name: string;
  category: string | null;
  /** "Quantidades de uma marmita" / "Receita em lote que rende 12 porções" / "Receita: rende 20,7 kg". */
  typeLabel: string;
  lines: FichaLine[];
  packaging: FichaLine[];
  totals: {
    ingredients: number;
    packaging: number;
    /** Margem de segurança em R$ sobre o custo dos ingredientes e embalagem. */
    safety: number;
    safetyPct: number;
    /** Custo final por marmita (com a margem de segurança); para receita, o custo do lote. */
    total: number | null;
  };
  /** Marmita: peso aproximado de uma porção. */
  portionWeight: string | null;
  price: number | null;
  /** Custo ÷ preço de venda. */
  cmvPct: number | null;
  receita: { yield: string; perUnitLabel: string; perUnit: number | null; per100Label: string; per100: number | null } | null;
  /** Insumos sem preço ou ficha sem itens: o custo está incompleto. */
  incomplete: boolean;
  warnings: string[];
};

const FACTOR_OF: Record<string, number> = { kg: 1000, g: 1, l: 1000, ml: 1, un: 1 };

/** Quantidade na unidade-base -> como foi digitada ("0,5 kg"). */
function netLabel(qtyBase: number, qtyUnit: string | null, purchaseUnit: string): string {
  const base = isPurchaseUnit(purchaseUnit) ? baseUnitOf(purchaseUnit) : "g";
  if (qtyUnit && FACTOR_OF[qtyUnit] !== undefined) return `${formatNumber(qtyBase / FACTOR_OF[qtyUnit], 3)} ${qtyUnit === "l" ? "l" : qtyUnit}`;
  return formatBaseQty(qtyBase, base);
}

/**
 * Monta a ficha técnica de uma marmita ou receita: cada linha com peso líquido, fator, peso bruto e custo, os totais e,
 * na marmita, a margem de segurança e o CMV. Só lê o que recebe (sem banco), para ser testável.
 */
export function buildFichaTecnica(input: { recipe: FichaRecipeInput; items: FichaItemInput[]; ingredients: Map<string, FichaIngredient>; safetyMarginPct: number; price: number | null }): FichaTecnica {
  const { recipe, items, ingredients } = input;
  const serving = recipe.mode === "serving";
  const warnings: string[] = [];
  const lines: FichaLine[] = [];
  const packaging: FichaLine[] = [];
  let missing = 0;
  let weightGrams = 0;
  let weighed = 0;

  const costItems: CostItem[] = [];
  for (const it of items) {
    const ing = ingredients.get(it.ingredient_id);
    if (!ing) continue;
    costItems.push({ ingredient: { unit_cost: ing.unit_cost, correction_factor: ing.correction_factor, cooking_yield: ing.cooking_yield, purchase_unit: ing.purchase_unit }, netQty: it.net_qty, scope: it.scope });
    const yieldFactor = serving && it.scope === "batch" ? (ing.cooking_yield > 0 ? ing.cooking_yield : 1) : 1;
    const gross = (it.net_qty / yieldFactor) * ing.correction_factor;
    const base = isPurchaseUnit(ing.purchase_unit) ? baseUnitOf(ing.purchase_unit) : "g";
    const hasPrice = ing.unit_cost > 0;
    if (!hasPrice) missing++;
    const line: FichaLine = {
      name: ing.name,
      tag: ing.kind,
      net: netLabel(it.net_qty, it.qty_unit, ing.purchase_unit),
      factor: it.net_qty > 0 ? gross / it.net_qty : 1,
      gross: formatBaseQty(gross, base),
      cost: hasPrice ? gross * ing.unit_cost : null,
    };
    (ing.kind === "embalagem" ? packaging : lines).push(line);
    if (ing.kind !== "embalagem" && it.scope === "batch" && base !== "un") {
      weightGrams += it.net_qty;
      weighed++;
    }
  }
  lines.sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0));

  const sum = (ls: FichaLine[]) => ls.reduce((s, l) => s + (l.cost ?? 0), 0);
  const ingredientsCost = sum(lines);
  const packagingCost = sum(packaging);
  const portions = recipe.portions && recipe.portions > 0 ? recipe.portions : 1;

  if (items.length === 0 || lines.length === 0) warnings.push("Esta ficha ainda não tem ingredientes.");
  if (missing > 0) warnings.push(`${missing} ${missing === 1 ? "item está" : "itens estão"} sem preço: o custo está incompleto.`);

  if (recipe.kind === "receita") {
    const base = recipe.portion_weight_unit === "ml" || recipe.portion_weight_unit === "l" ? "ml" : recipe.portion_weight_unit === "un" ? "un" : "g";
    const readyBase = recipe.portion_weight && recipe.portion_weight > 0 ? recipe.portion_weight : null;
    if (!readyBase) warnings.push("Falta informar quanto a receita rende pronta.");
    const per = readyBase ? ingredientsCost / readyBase : null;
    return {
      id: recipe.id,
      kind: "receita",
      name: recipe.name,
      category: recipe.category,
      typeLabel: readyBase ? `Receita em lote: rende ${formatBaseQty(readyBase, base)} pronta` : "Receita em lote",
      lines,
      packaging,
      totals: { ingredients: ingredientsCost, packaging: 0, safety: 0, safetyPct: 0, total: lines.length > 0 ? ingredientsCost : null },
      portionWeight: null,
      price: null,
      cmvPct: null,
      receita: {
        yield: readyBase ? formatBaseQty(readyBase, base) : "—",
        perUnitLabel: base === "un" ? "Custo por unidade" : base === "ml" ? "Custo por litro" : "Custo por kg",
        perUnit: per === null ? null : base === "un" ? per : per * 1000,
        per100Label: base === "un" ? "Custo por 10 unidades" : base === "ml" ? "Custo por 100 ml" : "Custo por 100 g",
        per100: per === null ? null : base === "un" ? per * 10 : per * 100,
      },
      incomplete: warnings.length > 0,
      warnings,
    };
  }

  const view = computeRecipe(
    { portions: recipe.portions, portionWeight: recipe.portion_weight, cookingLossPct: recipe.cooking_loss_pct, useCookingYield: serving, safetyMarginPct: input.safetyMarginPct },
    costItems,
  );
  const perPortionBase = ingredientsCost / portions + packagingCost;
  const total = view.ok ? view.cost.costPerPortion.toNumber() : null;
  if (!view.ok) warnings.push(view.reason === "no-portions" ? "Falta informar quantas porções a ficha rende." : "A ficha está incompleta.");
  const safety = total !== null ? Math.max(0, total - perPortionBase) : 0;
  const price = input.price && input.price > 0 ? input.price : null;

  return {
    id: recipe.id,
    kind: "marmita",
    name: recipe.name,
    category: recipe.category,
    typeLabel: serving ? "Quantidades de uma marmita" : `Receita em lote${recipe.portions ? ` que rende ${formatNumber(recipe.portions, 0)} porções` : ""}`,
    lines,
    packaging,
    totals: { ingredients: ingredientsCost / portions, packaging: packagingCost, safety, safetyPct: input.safetyMarginPct, total },
    portionWeight: serving && weighed > 0 ? formatBaseQty(weightGrams, "g") : null,
    price,
    cmvPct: price !== null && total !== null ? total / price : null,
    receita: null,
    incomplete: warnings.length > 0,
    warnings,
  };
}
