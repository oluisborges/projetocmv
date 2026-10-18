// "Como estou este mês?": o retrato do mês em andamento (ou do último mês fechado) numa conta só.
// Sobra = faturamento − insumos (pelas fichas) − impostos e taxas − contas fixas do período. Regras puras, testadas.

export type MonthHealthInput = {
  /** Primeiro dia do mês, "AAAA-MM-01". */
  monthStart: string;
  /** Agora (o horário de Brasília é calculado aqui dentro). */
  now: Date;
  revenue: number;
  /** O que as vendas deveriam ter custado em insumos, pelas fichas; `null` sem nenhuma venda com ficha completa. */
  insumosCost: number | null;
  /** Impostos + outras taxas sobre a venda, fração. */
  variablePct: number;
  /** Contas fixas + equipe do mês inteiro. */
  fixedTotal: number;
  /** Faturamento mensal que paga as contas (ponto de equilíbrio). */
  breakEvenRevenue: number | null;
};

export type MonthHealthTone = "good" | "warn" | "bad" | "neutral";

export type MonthHealth = {
  /** O mês ainda está correndo. */
  partial: boolean;
  day: number;
  daysInMonth: number;
  revenue: number;
  /** Sobra até agora (contas fixas só na proporção dos dias). `null` sem custo de insumos. */
  profit: number | null;
  projectedRevenue: number | null;
  projectedProfit: number | null;
  breakEvenRevenue: number | null;
  /** Faturamento ÷ ponto de equilíbrio (1 = empatou). */
  breakEvenProgress: number | null;
  /** Quanto falta vender para empatar (0 se já passou). */
  missingToBreakEven: number | null;
  tone: MonthHealthTone;
  headline: string;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Projeção só depois de alguns dias: nos primeiros dias a média diária engana. */
const MIN_DAYS_TO_PROJECT = 5;

export function monthHealth(input: MonthHealthInput): MonthHealth {
  const [y, m] = input.monthStart.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const br = new Date(input.now.getTime() - 3 * 3600_000); // Brasília
  const sameMonth = br.getUTCFullYear() === y && br.getUTCMonth() + 1 === m;
  const partial = sameMonth;
  const day = partial ? br.getUTCDate() : daysInMonth;

  const { revenue, fixedTotal } = input;
  const taxes = revenue * input.variablePct;
  const fixedShare = fixedTotal * (day / daysInMonth);
  const profit = input.insumosCost === null ? null : revenue - input.insumosCost - taxes - fixedShare;

  const canProject = partial && day >= MIN_DAYS_TO_PROJECT && revenue > 0;
  const projectedRevenue = canProject ? (revenue / day) * daysInMonth : partial ? null : revenue;
  const projectedProfit =
    projectedRevenue !== null && input.insumosCost !== null && revenue > 0
      ? projectedRevenue - (input.insumosCost / revenue) * projectedRevenue - projectedRevenue * input.variablePct - fixedTotal
      : null;

  const be = input.breakEvenRevenue !== null && input.breakEvenRevenue > 0 ? input.breakEvenRevenue : null;
  const breakEvenProgress = be !== null ? revenue / be : null;
  const missingToBreakEven = be !== null ? Math.max(0, be - revenue) : null;

  let tone: MonthHealthTone = "neutral";
  let headline: string;
  if (revenue <= 0) {
    headline = partial ? "Ainda não há vendas neste mês." : "Este mês não teve vendas registradas.";
  } else if (profit === null) {
    headline = "Falta completar as fichas das marmitas vendidas para calcular quanto sobra.";
  } else if (partial && !canProject) {
    headline = `Faturou ${brl(revenue)} nos primeiros ${day} ${day === 1 ? "dia" : "dias"}. Em alguns dias dá para projetar o mês.`;
  } else if (partial && projectedProfit !== null && projectedRevenue !== null) {
    if (projectedProfit >= 0 && (be === null || projectedRevenue >= be)) {
      tone = "good";
      headline = `No ritmo de hoje, o mês fecha com sobra de cerca de ${brl(projectedProfit)}.`;
    } else if (be !== null && projectedRevenue < be) {
      tone = projectedRevenue < be * 0.85 ? "bad" : "warn";
      headline = `No ritmo de hoje, o mês fecha em ${brl(projectedRevenue)}, abaixo dos ${brl(be)} que pagam suas contas.`;
    } else {
      tone = "warn";
      headline = `No ritmo de hoje, o mês fecha no vermelho (${brl(projectedProfit)}).`;
    }
  } else {
    tone = profit >= 0 ? "good" : "bad";
    headline = profit >= 0 ? `O mês fechou com sobra de ${brl(profit)}.` : `O mês fechou no vermelho: ${brl(profit)}.`;
  }

  return { partial, day, daysInMonth, revenue, profit, projectedRevenue, projectedProfit, breakEvenRevenue: be, breakEvenProgress, missingToBreakEven, tone, headline };
}
