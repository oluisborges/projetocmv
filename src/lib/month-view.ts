import { D, cmo, cmvDeviation, cmvReal, cmvTheoretical, type StaffMember } from "@/lib/calc";

export type MonthSale = {
  recipeId: string;
  qty: number;
  /** custo por porção da ficha (ou do combo inteiro); `null` se está incompleto */
  cost: number | null;
  /** Quantas marmitas cada venda leva (combo de 10 = 10). Padrão 1. */
  unitsPerSale?: number;
};

export type MonthSummary = {
  revenue: number;
  purchases: number;
  /** Compras ÷ faturamento. Sem controle de estoque é uma aproximação. */
  cmvRealPct: number | null;
  /** O que as marmitas vendidas DEVERIAM ter custado, pelas fichas (custo × quantidade) ÷ faturamento. */
  cmvTheoreticalPct: number | null;
  theoreticalCost: number | null;
  /** Real − teórico, em fração do faturamento. Positivo = comprou mais do que as vendas explicam. */
  deviationPct: number | null;
  /** Mesma diferença em R$ (compras − custo teórico). */
  deviationCost: number | null;
  /** Mão de obra (salário + encargos) ÷ faturamento. */
  cmoPct: number | null;
  cmoCost: number;
  /** Vendas informadas cuja ficha está incompleta: o custo teórico fica subestimado. */
  salesWithoutCost: number;
  soldUnits: number;
};

/**
 * Resultado do mês. Sem estoque no MVP: o CMV real é "compras do mês ÷ faturamento", então comprar estoque
 * extra aparece como desvio (e usar estoque antigo aparece como desvio negativo). A tela explica isso.
 */
export function summarizeMonth(input: { revenue: number; purchases: number; sales: MonthSale[]; staff: StaffMember[] }): MonthSummary {
  const { revenue, purchases } = input;
  const hasRevenue = revenue > 0;

  const costed = input.sales.filter((s) => s.qty > 0 && s.cost !== null);
  const salesWithoutCost = input.sales.filter((s) => s.qty > 0 && s.cost === null).length;
  const soldUnits = input.sales.reduce((s, x) => s + (x.qty > 0 ? x.qty * (x.unitsPerSale ?? 1) : 0), 0);

  const real = hasRevenue && purchases > 0 ? cmvReal({ purchases, revenue }) : null;
  const theoretical = costed.length > 0 ? cmvTheoretical(costed.map((s) => ({ costPerPortion: s.cost as number, qtySold: s.qty })), hasRevenue ? revenue : 0) : null;
  const staffCost = cmo(input.staff, hasRevenue ? revenue : 0);

  return {
    revenue,
    purchases,
    cmvRealPct: real ? real.pct.toNumber() : null,
    cmvTheoreticalPct: theoretical && hasRevenue ? theoretical.pct.toNumber() : null,
    theoreticalCost: theoretical ? theoretical.cost.toNumber() : null,
    deviationPct: real && theoretical && hasRevenue ? cmvDeviation(real.pct, theoretical.pct).toNumber() : null,
    deviationCost: theoretical && purchases > 0 ? D(purchases).minus(theoretical.cost).toNumber() : null,
    cmoPct: hasRevenue && staffCost.total.gt(0) ? staffCost.pct.toNumber() : null,
    cmoCost: staffCost.total.toNumber(),
    salesWithoutCost,
    soldUnits,
  };
}

/**
 * Início e fim de um mês no horário de Brasília (UTC−3; o Brasil não tem horário de verão desde 2019).
 * `month` = "YYYY-MM-01". Todo corte de mês do app usa isto, nunca UTC, para um registro das 22h do último dia
 * não cair no mês seguinte.
 */
export function monthBounds(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { start: new Date(`${month}T00:00:00-03:00`), end: new Date(`${next}T00:00:00-03:00`) };
}

/** "2026-10" (ou "2026-10-09") -> "2026-10-01"; `null` se inválido. A coluna do banco exige o dia 1. */
export function monthStart(input: string | undefined | null): string | null {
  const m = /^(20\d{2})-(0[1-9]|1[0-2])(?:-\d{2})?$/.exec(input ?? "");
  return m ? `${m[1]}-${m[2]}-01` : null;
}

/** Mês atual no fuso de São Paulo, como "YYYY-MM-01" (o servidor roda em UTC). */
export function currentMonthStart(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  return `${year}-${month}-01`;
}

/** Últimos `count` meses (do mais recente para o mais antigo), a partir de um mês "YYYY-MM-01". */
export function lastMonths(from: string, count: number): string[] {
  const [y, m] = from.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const total = y * 12 + (m - 1) - i;
    const yy = Math.floor(total / 12);
    const mm = (total % 12) + 1;
    return `${yy}-${String(mm).padStart(2, "0")}-01`;
  });
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-10-01" -> "outubro de 2026" (sem depender de fuso nem de Intl). */
export function monthLabel(start: string): string {
  const [y, m] = start.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}
