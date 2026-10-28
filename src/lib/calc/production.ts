import { D, type Decimal } from "./decimal";

/** Receita (arroz, estrogonofe…): quanto rende pronta por lote e o que cada grama pronto gasta de insumo comprado. */
export type ReceitaBlueprint = { readyGrams: number; parts: { ingredientId: string; grossPerGram: number }[] };

export type ProductionLine = {
  /** Quantas marmitas desta ficha produzir. */
  units: number;
  /**
   * O que UMA marmita gasta, por id, na unidade-base (g, ml ou un), já com fator de correção e rendimento.
   * Um id pode ser de insumo ou de receita (neste caso, gramas prontos da receita).
   */
  perUnit: Map<string, number>;
};

export type ProductionNeeds = {
  /** Total de cada insumo COMPRADO (cru, bruto) para produzir tudo. Inclui o que as receitas gastam. */
  ingredients: Map<string, number>;
  /** Gramas prontos de cada receita que a produção pede, e quantos lotes isso dá (fracionado). */
  receitas: Map<string, { grams: number; batches: number; wholeBatches: number }>;
};

const EPS = 1e-9;

/**
 * Quanto de cada insumo e de cada receita é preciso para produzir as marmitas planejadas.
 * O que as marmitas pedem de uma receita (gramas prontos) vira lotes dela e, por baixo, os insumos do lote.
 */
export function productionNeeds(lines: ProductionLine[], receitas: Map<string, ReceitaBlueprint>): ProductionNeeds {
  const ingredients = new Map<string, Decimal>();
  const grams = new Map<string, Decimal>();
  const add = (m: Map<string, Decimal>, id: string, qty: Decimal) => m.set(id, (m.get(id) ?? D(0)).plus(qty));

  for (const line of lines) {
    if (!(line.units > 0)) continue;
    for (const [id, perUnit] of line.perUnit) {
      const total = D(perUnit).mul(line.units);
      const receita = receitas.get(id);
      if (receita) {
        add(grams, id, total);
        for (const part of receita.parts) add(ingredients, part.ingredientId, total.mul(part.grossPerGram));
      } else {
        add(ingredients, id, total);
      }
    }
  }

  const receitaOut = new Map<string, { grams: number; batches: number; wholeBatches: number }>();
  for (const [id, g] of grams) {
    const ready = receitas.get(id)?.readyGrams ?? 0;
    const batches = ready > 0 ? g.div(ready) : D(0);
    receitaOut.set(id, { grams: g.toNumber(), batches: batches.toNumber(), wholeBatches: ready > 0 ? Math.ceil(batches.toNumber() - EPS) : 0 });
  }
  return { ingredients: new Map([...ingredients].map(([id, v]) => [id, v.toNumber()])), receitas: receitaOut };
}

export type PurchaseItem = {
  id: string;
  /** Quanto a produção pede, quanto há no estoque e quanto falta (unidade-base). */
  need: number;
  stock: number;
  missing: number;
  /** Quantas embalagens de compra inteiras cobrem o que falta (`null` se o insumo não tem tamanho de embalagem). */
  packs: number | null;
  /** O que realmente se compra (embalagens inteiras) e o que sobra depois da produção. */
  buyQty: number;
  leftover: number;
};

/**
 * Lista de compras: o que falta (pedido − estoque), arredondado para embalagens inteiras de compra.
 * `packSize` = quanto vem em uma embalagem, na unidade-base (5 kg = 5000).
 */
export function shoppingList(needs: Map<string, number>, stock: Map<string, number>, packSize: Map<string, number>): PurchaseItem[] {
  const out: PurchaseItem[] = [];
  for (const [id, need] of needs) {
    const have = Math.max(0, stock.get(id) ?? 0);
    const missingRaw = D(need).minus(have);
    const missing = missingRaw.lte(1e-6) ? D(0) : missingRaw;
    const size = packSize.get(id);
    const packs = size && size > 0 ? Math.max(0, Math.ceil(missing.div(size).toNumber() - EPS)) : null;
    const buy = packs !== null ? D(packs).mul(size as number) : missing;
    out.push({ id, need, stock: have, missing: missing.toNumber(), packs, buyQty: buy.toNumber(), leftover: buy.minus(missing).toNumber() });
  }
  return out;
}
