import { formatBRL, formatBaseQty } from "@/lib/format";
import type { Production, ProductionBase } from "@/lib/production-data";
import { batchesLabel, computeProduction, productionName, type BuyRow } from "@/lib/production-view";

export type SheetProduct = { id: string; name: string; units: number; /** R$ para produzir esse produto (custo da ficha × quantidade). */ cost: number };
export type SheetReceita = {
  id: string;
  name: string;
  /** Quanto de receita a produção pede, pronta, e quantos lotes isso dá ("2 lotes"). */
  ready: string;
  batches: string;
  /** Lotes inteiros a fazer (arredondado para cima). */
  wholeBatches: number;
  /** Os insumos já multiplicados para o total pedido (cru). */
  ingredients: { name: string; qty: string }[];
};
export type SheetBuyRow = BuyRow & {
  /** Preço estimado por kg, litro ou unidade ("R$ 18,30/kg"); `null` sem preço. */
  unitPrice: string | null;
};

export type ProductionSheet = {
  title: string;
  plannedFor: string;
  produced: boolean;
  units: number;
  products: SheetProduct[];
  receitas: SheetReceita[];
  toBuy: SheetBuyRow[];
  /** R$ para produzir tudo (custo das fichas) e R$ da compra estimada (embalagens inteiras). */
  cost: number;
  buyCost: number;
  /** Há produtos fora da conta por estarem com a ficha incompleta. */
  skipped: string[];
};

/** Preço por kg (de insumo em g), por litro (ml) ou por unidade, como o dono compra. */
function unitPriceLabel(ing: ProductionBase["ingredients"][string] | undefined): string | null {
  if (!ing || !(ing.unitCost > 0)) return null;
  if (ing.baseUnit === "g") return `${formatBRL(ing.unitCost * 1000)}/kg`;
  if (ing.baseUnit === "ml") return `${formatBRL(ing.unitCost * 1000)}/l`;
  return `${formatBRL(ing.unitCost)}/un`;
}

/**
 * O documento do dia: o que produzir (por produto), o que preparar (receitas em lote já com os insumos multiplicados) e o que comprar.
 * Usa a mesma conta da tela de Produção, então os números batem com "Preparar" e "Comprar".
 */
export function buildProductionSheet(production: Production, base: ProductionBase, bought: Record<string, number> = {}): ProductionSheet {
  const names = new Map(base.recipes.map((r) => [r.id, r.name]));
  const costOf = new Map(base.recipes.map((r) => [r.id, r.costPerPortion]));
  const lines = production.items.filter((i) => i.planned > 0).map((i) => ({ recipeId: i.recipeId, units: i.planned }));
  const calc = computeProduction(lines, base, bought);

  const products = lines
    .filter((l) => names.has(l.recipeId))
    .map((l) => ({ id: l.recipeId, name: names.get(l.recipeId)!, units: l.units, cost: l.units * (costOf.get(l.recipeId) ?? 0) }))
    .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name, "pt-BR"));

  const receitas: SheetReceita[] = [...calc.needs.receitas]
    .flatMap(([id, need]) => {
      const receita = base.receitas[id];
      if (!receita) return [];
      return [
        {
          id,
          name: receita.name,
          ready: formatBaseQty(need.grams, receita.base),
          batches: batchesLabel(need.batches),
          wholeBatches: need.wholeBatches,
          ingredients: receita.parts
            .flatMap((p) => {
              const ing = base.ingredients[p.ingredientId];
              return ing ? [{ name: ing.name, qty: formatBaseQty(need.grams * p.grossPerGram, ing.baseUnit) }] : [];
            })
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const skipped = production.items.filter((i) => i.planned > 0 && !names.has(i.recipeId)).map((i) => base.incomplete.find((x) => x.id === i.recipeId)?.name ?? "Produto sem ficha completa");

  return { title: productionName(production), plannedFor: production.plannedFor, produced: production.status === "produced", units: calc.marmitas, products, receitas, toBuy: calc.rows.toBuy.map((r) => ({ ...r, unitPrice: unitPriceLabel(base.ingredients[r.id]) })), cost: calc.cost, buyCost: calc.buyCost, skipped };
}
