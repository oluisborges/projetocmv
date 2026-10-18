import "server-only";
import { getActiveOrg } from "@/lib/auth";
import { loadHistory } from "@/lib/history-data";
import type { PriceMove } from "@/lib/history-view";
import { loadIngredients } from "@/lib/recipes-data";
import { loadStockMonth } from "@/lib/stock-data";

/** Tudo que o relatório do mês (PDF e Excel) mostra, num só lugar: o mesmo número em todos os formatos. */
export type Report = {
  orgName: string;
  unitName: string;
  month: string;
  generatedAt: Date;
  revenue: { total: number; menu: number; outside: number; orders: number };
  purchases: number;
  soldUnits: number;
  insumosPct: number | null;
  expectedPct: number | null;
  taxesValue: number | null;
  staffValue: number | null;
  fixedValue: number | null;
  result: { value: number; pct: number } | null;
  hasSnapshot: boolean;
  products: { name: string; cost: number | null; price: number | null; costPct: number | null; sold: number }[];
  moves: PriceMove[];
  ingredients: { name: string; kind: string; category: string | null; purchaseQty: number; purchaseUnit: string; purchasePrice: number }[];
  stock: null | {
    cogs: number;
    theoretical: number | null;
    gap: number | null;
    rows: { name: string; unit: string; perDisplay: number; opening: number; purchased: number; used: number; expected: number; counted: number | null; missingValue: number | null }[];
  };
};

export async function loadReport(orgId: string, canWrite: boolean, month: string): Promise<Report | null> {
  const [history, stock, ingredients, active] = await Promise.all([loadHistory(orgId, canWrite), loadStockMonth(orgId, canWrite, month), loadIngredients(), getActiveOrg()]);
  const entry = history?.entries.find((e) => e.month === month);
  if (!history || !entry) return null;
  const s = entry.summary;
  const rev = s.revenue;

  return {
    orgName: active?.orgName ?? "Marmitaria",
    unitName: history.unitName,
    month,
    generatedAt: new Date(),
    revenue: { total: rev, menu: entry.menuRevenue, outside: Math.max(0, rev - entry.menuRevenue), orders: entry.menuOrders },
    purchases: s.purchases,
    soldUnits: s.soldUnits,
    insumosPct: s.insumosPct,
    expectedPct: s.expectedPct,
    taxesValue: s.taxesPct !== null ? s.taxesPct * rev : null,
    staffValue: s.staffPct !== null ? s.staffPct * rev : null,
    fixedValue: s.fixedPct !== null ? s.fixedPct * rev : null,
    result: s.result,
    hasSnapshot: entry.hasSnapshot,
    products: entry.products
      .map((p) => ({ name: p.name, cost: p.avgCost, price: p.avgPrice, costPct: p.avgCost !== null && p.avgPrice ? p.avgCost / p.avgPrice : null, sold: p.sold }))
      .sort((a, b) => b.sold - a.sold || a.name.localeCompare(b.name, "pt-BR")),
    moves: entry.moves,
    ingredients: ingredients
      .filter((i) => !i.archived_at)
      .map((i) => ({ name: i.name, kind: i.kind, category: i.category, purchaseQty: i.purchase_qty, purchaseUnit: i.purchase_unit, purchasePrice: i.purchase_price }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    stock:
      stock && stock.result
        ? {
            cogs: stock.result.cogs,
            theoretical: stock.result.theoreticalCost,
            gap: stock.result.gap,
            rows: stock.rows.map((r) => ({ name: r.name, unit: r.displayUnit, perDisplay: r.perDisplay, opening: r.opening, purchased: r.purchased, used: r.used, expected: r.expected, counted: r.counted, missingValue: r.missingValue })),
          }
        : null,
  };
}
