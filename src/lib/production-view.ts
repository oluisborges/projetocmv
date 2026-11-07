import { formatBRL, formatBaseQty, formatNumber } from "@/lib/format";
import { productionNeeds, shoppingList, suggestProduction, topSellers, type ProductionNeeds, type PurchaseItem } from "@/lib/calc";
import type { ProdIngredient, ProductionBase, WeeklySales } from "@/lib/production-data";

export type BuyRow = {
  id: string;
  name: string;
  supplier: string | null;
  /** O que falta, "12 kg"; e quantas embalagens ("3 pacotes de 5 kg"), se houver. */
  buy: string;
  packs: string | null;
  need: string;
  stock: string | null;
  /** R$ da compra (embalagens inteiras × custo). */
  cost: number;
  /** O que se compra, na unidade-base (g, ml, un): é o que entra no estoque ao marcar "comprei". */
  buyQty: number;
  /** Quanto vem em uma embalagem de compra (unidade-base), para calcular o preço pago por embalagem. */
  packSize: number | null;
  /** Unidade em que o insumo é comprado e digitado (kg, g, l, ml, un). */
  unit: string;
  /** Estoque mínimo que entra na conta ("2 kg"), se houver. */
  minimum: string | null;
};

const pluralPack = (n: number) => (n === 1 ? "pacote" : "pacotes");

/** O que a lista de compras mostra: só o que falta comprar, já com texto pronto e agrupável por fornecedor. */
export function buyRows(list: PurchaseItem[], ingredients: Record<string, ProdIngredient>, stockKnown: (id: string) => boolean, minimums: Record<string, number> = {}): { toBuy: BuyRow[]; enough: BuyRow[] } {
  const toBuy: BuyRow[] = [];
  const enough: BuyRow[] = [];
  for (const item of list) {
    const ing = ingredients[item.id];
    if (!ing) continue;
    const row: BuyRow = {
      id: item.id,
      name: ing.name,
      supplier: ing.supplier,
      buy: formatBaseQty(item.buyQty, ing.baseUnit),
      packs: item.packs !== null && item.packs > 0 && ing.packLabel ? `${item.packs} ${pluralPack(item.packs)} de ${ing.packLabel}` : null,
      need: formatBaseQty(item.need, ing.baseUnit),
      stock: stockKnown(item.id) ? formatBaseQty(item.stock, ing.baseUnit) : null,
      cost: item.buyQty * ing.unitCost,
      buyQty: item.buyQty,
      packSize: ing.packSize,
      unit: ing.purchaseUnit,
      minimum: minimums[item.id] ? formatBaseQty(minimums[item.id], ing.baseUnit) : null,
    };
    (item.missing > 0 ? toBuy : enough).push(row);
  }
  const byName = (a: BuyRow, b: BuyRow) => a.name.localeCompare(b.name, "pt-BR");
  return { toBuy: toBuy.sort(byName), enough: enough.sort(byName) };
}

/** Agrupa por fornecedor (os sem fornecedor ficam no fim, em "Sem fornecedor"). Sem nenhum fornecedor, um grupo só sem título. */
export function groupBySupplier(rows: BuyRow[]): { supplier: string | null; rows: BuyRow[] }[] {
  if (!rows.some((r) => r.supplier)) return rows.length > 0 ? [{ supplier: null, rows }] : [];
  const groups = new Map<string, BuyRow[]>();
  for (const r of rows) groups.set(r.supplier ?? "", [...(groups.get(r.supplier ?? "") ?? []), r]);
  return [...groups]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "pt-BR")))
    .map(([supplier, list]) => ({ supplier: supplier === "" ? "Sem fornecedor" : supplier, rows: list }));
}

/** Texto da lista de compras para copiar ou mandar no WhatsApp. */
export function shoppingText(title: string, rows: BuyRow[], total: number): string {
  const lines: string[] = [title, ""];
  for (const g of groupBySupplier(rows)) {
    if (g.supplier) lines.push(`*${g.supplier}*`);
    for (const r of g.rows) {
      // O parêntese é o total comprado (3 pacotes de 500 g = 1,5 kg). Com 1 pacote só, seria repetir a mesma quantidade.
      const onePack = r.packs !== null && /^1 \S+ de /.test(r.packs);
      lines.push(`• ${r.name}: ${r.packs ?? r.buy}${r.packs && !onePack ? ` (${r.buy})` : ""}`);
    }
    lines.push("");
  }
  if (total > 0) lines.push(`Total estimado: ${formatBRL(total)}`);
  return lines.join("\n").trim();
}

/** "1,2 lote" / "3 lotes": quantos lotes de uma receita. */
export function batchesLabel(batches: number): string {
  return `${formatNumber(Math.round(batches * 100) / 100, 2)} ${Math.abs(batches - 1) < 0.005 ? "lote" : "lotes"}`;
}

export type ProductionInput = Pick<ProductionBase, "recipes" | "ingredients" | "receitas" | "stock"> & { /** Estoque mínimo por insumo (unidade-base): entra na lista de compras mesmo sem a produção pedir. */ minimums?: Record<string, number> };
export type PlanLine = { recipeId: string; units: number };

export type ProductionCalc = {
  needs: ProductionNeeds;
  rows: { toBuy: BuyRow[]; enough: BuyRow[] };
  marmitas: number;
  /** R$ para produzir tudo (custo das fichas, com a margem de segurança). */
  cost: number;
  /** R$ da compra (embalagens inteiras pelo preço cadastrado). */
  buyCost: number;
};

/**
 * Tudo o que a produção pede: o que preparar (receitas em lote), o que comprar (necessário − estoque) e quanto custa.
 * `alreadyBought`: o que já foi marcado como comprado NESTA produção. Já está no estoque, mas continua na lista (marcado),
 * para a lista não sumir à medida que a pessoa compra.
 */
export function computeProduction(lines: PlanLine[], base: ProductionInput, alreadyBought: Record<string, number> = {}): ProductionCalc {
  const recipeById = new Map(base.recipes.map((r) => [r.id, r]));
  const active = lines.filter((l) => l.units > 0 && recipeById.has(l.recipeId));
  const receitas = new Map(Object.entries(base.receitas).map(([id, r]) => [id, { readyGrams: r.readyGrams, parts: r.parts }]));
  const needs = productionNeeds(
    active.map((l) => ({ units: l.units, perUnit: new Map(Object.entries(recipeById.get(l.recipeId)!.usage)) })),
    receitas,
  );
  const stock = new Map(Object.entries(base.stock).map(([id, b]) => [id, b.balance - (alreadyBought[id] ?? 0)]));
  const pack = new Map(Object.entries(base.ingredients).flatMap(([id, i]) => (i.packSize ? [[id, i.packSize] as const] : [])));
  // O estoque mínimo soma ao que a produção pede: quem está abaixo do mínimo entra na lista de compras, mesmo sem produção usar.
  const minimums = base.minimums ?? {};
  const wanted = new Map(needs.ingredients);
  for (const [id, min] of Object.entries(minimums)) if (min > 0 && base.ingredients[id]) wanted.set(id, (wanted.get(id) ?? 0) + min);
  const rows = buyRows(shoppingList(wanted, stock, pack), base.ingredients, (id) => base.stock[id]?.known === true && base.stock[id]?.lastCountAt !== null, minimums);
  return {
    needs,
    rows,
    marmitas: active.reduce((n, l) => n + l.units, 0),
    cost: active.reduce((sum, l) => sum + l.units * recipeById.get(l.recipeId)!.costPerPortion, 0),
    buyCost: rows.toBuy.reduce((sum, r) => sum + r.cost, 0),
  };
}

export type SuggestionRow = {
  id: string;
  name: string;
  /** Vendas das últimas semanas (da mais antiga para a mais recente). */
  weekly: number[];
  average: number;
  trendPct: number | null;
  forecast: number;
  /** Quanto produzir: a demanda menos o que está pronto e menos o que outras produções da semana já cobrem. */
  suggested: number;
  finished: number | null;
  confidence: "none" | "low" | "ok";
  topSeller: boolean;
};

/**
 * Sugestão de cada marmita para uma produção. `plannedElsewhere`: o que as outras produções da mesma semana já têm planejado
 * (sai da sugestão, para não pedir em dobro).
 */
export function suggestionRows(base: Pick<ProductionBase, "recipes" | "finished">, weekly: WeeklySales, plannedElsewhere: Record<string, number> = {}): SuggestionRow[] {
  const items = base.recipes.map((r) => {
    const series = weekly.byRecipe[r.id] ?? Array(weekly.weeks.length).fill(0);
    const fin = base.finished[r.id];
    const finished = fin?.known ? Math.max(0, fin.balance) : null;
    return { r, series, finished, s: suggestProduction({ weekly: series, finished: (finished ?? 0) + (plannedElsewhere[r.id] ?? 0) || null }) };
  });
  const top = topSellers(items.map((x) => ({ id: x.r.id, forecast: x.s.forecast })));
  return items
    .map(({ r, series, finished, s }) => ({
      id: r.id,
      name: r.name,
      weekly: series.map((n) => Math.round(n)),
      average: s.average,
      trendPct: s.trendPct,
      forecast: s.forecast,
      suggested: s.toProduce,
      finished,
      confidence: s.confidence,
      topSeller: top.has(r.id),
    }))
    .sort((a, b) => Number(b.topSeller) - Number(a.topSeller) || b.forecast - a.forecast || a.name.localeCompare(b.name, "pt-BR"));
}

export type YieldRow = { id: string; name: string; planned: number; produced: number; diff: number; lossPct: number | null };
export type YieldSummary = { planned: number; produced: number; diff: number; lossPct: number | null; rows: YieldRow[]; /** Perda acima do limite (10%): vale um aviso. */ high: boolean };

/** Rendimento real de uma produção: quanto saiu comparado ao planejado, no total e por produto (perda = o que faltou, em % do planejado). */
export function yieldSummary(rows: { id: string; name: string; planned: number; produced: number }[], limit = 0.1): YieldSummary {
  const list: YieldRow[] = rows
    .filter((r) => r.planned > 0 || r.produced > 0)
    .map((r) => ({ ...r, diff: r.produced - r.planned, lossPct: r.planned > 0 ? Math.max(0, (r.planned - r.produced) / r.planned) : null }));
  const planned = list.reduce((n, r) => n + r.planned, 0);
  const produced = list.reduce((n, r) => n + r.produced, 0);
  const lossPct = planned > 0 ? Math.max(0, (planned - produced) / planned) : null;
  return { planned, produced, diff: produced - planned, lossPct, rows: list, high: lossPct !== null && lossPct > limit };
}

/** "2026-10-28" -> "28/10". */
export const productionDateLabel = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** O nome que a pessoa deu ou, sem nome, "Produção de 28/10". */
export const productionName = (p: { name: string | null; plannedFor: string }): string => p.name ?? `Produção de ${productionDateLabel(p.plannedFor)}`;
