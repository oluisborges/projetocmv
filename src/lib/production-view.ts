import { formatBRL, formatBaseQty, formatNumber } from "@/lib/format";
import type { ProdIngredient } from "@/lib/production-data";
import type { PurchaseItem } from "@/lib/calc";

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
};

const pluralPack = (n: number) => (n === 1 ? "pacote" : "pacotes");

/** O que a lista de compras mostra: só o que falta comprar, já com texto pronto e agrupável por fornecedor. */
export function buyRows(list: PurchaseItem[], ingredients: Record<string, ProdIngredient>, stockKnown: (id: string) => boolean): { toBuy: BuyRow[]; enough: BuyRow[] } {
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
    for (const r of g.rows) lines.push(`• ${r.name}: ${r.packs ?? r.buy}${r.packs ? ` (${r.buy})` : ""}`);
    lines.push("");
  }
  if (total > 0) lines.push(`Total estimado: ${formatBRL(total)}`);
  return lines.join("\n").trim();
}

/** "1,2 lote" / "3 lotes": quantos lotes de uma receita. */
export function batchesLabel(batches: number): string {
  return `${formatNumber(Math.round(batches * 100) / 100, 2)} ${Math.abs(batches - 1) < 0.005 ? "lote" : "lotes"}`;
}
