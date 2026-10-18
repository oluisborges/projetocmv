import type { PriceIncreaseAlert } from "@/lib/price-alerts";

export type Notice = {
  key: string;
  tone: "bad" | "warn" | "info";
  title: string;
  detail: string;
  href: string;
  cta: string;
};

export type NoticesInput = {
  /** Insumos que subiram de preço (já vêm com o aumento mínimo aplicado). */
  increases: PriceIncreaseAlert[];
  /** Nomes das marmitas com lucro abaixo da meta. */
  belowTarget: string[];
  /** Insumos ativos sem preço. */
  noPriceCount: number;
  /** Insumos com preço parado há muito tempo. */
  staleCount: number;
  /** `month` = "YYYY-MM" ou "YYYY-MM-01"; `label` = nome do mês ("setembro"). */
  previousMonth: { label: string; month: string; closed: boolean; soldOrRevenue: boolean };
  dayOfMonth: number;
};

const RANK = { bad: 0, warn: 1, info: 2 } as const;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Avisos da central, do mais urgente ao menos. Dentro do mesmo nível, mantém a ordem de importância das regras. */
export function buildNotices(input: NoticesInput): Notice[] {
  const out: Notice[] = [];

  if (input.belowTarget.length > 0) {
    const names = input.belowTarget.slice(0, 3).join(", ") + (input.belowTarget.length > 3 ? "…" : "");
    out.push({
      key: "below-target",
      tone: "bad",
      title: `${plural(input.belowTarget.length, "marmita abaixo", "marmitas abaixo")} da meta de lucro`,
      detail: names,
      href: "/marmitas",
      cta: "Ajustar preços",
    });
  }

  const prev = input.previousMonth;
  if (prev.soldOrRevenue && !prev.closed && input.dayOfMonth > 3) {
    out.push({
      key: "close-month",
      tone: "warn",
      title: `Feche ${prev.label}`,
      detail: "Falta informar o faturamento do mês para saber se deu lucro.",
      href: `/mes?mes=${prev.month.slice(0, 7)}`,
      cta: "Fechar o mês",
    });
  }

  for (const inc of input.increases) {
    if (inc.pct < 0.05) continue;
    out.push({
      key: `increase-${inc.ingredientId}`,
      tone: "warn",
      title: `${inc.name} subiu ${Math.round(inc.pct * 100)}%`,
      detail: inc.recipes > 0 ? `Afeta ${plural(inc.recipes, "ficha", "fichas")}.` : "Nenhuma ficha usa este insumo ainda.",
      href: "/insumos",
      cta: "Ver insumos",
    });
  }

  if (input.noPriceCount > 0) {
    out.push({
      key: "no-price",
      tone: "warn",
      title: plural(input.noPriceCount, "insumo sem preço", "insumos sem preço"),
      detail: "Sem o preço, o custo das marmitas que usam esse insumo fica errado.",
      href: "/insumos",
      cta: "Preencher preços",
    });
  }

  if (input.staleCount > 0) {
    out.push({
      key: "stale",
      tone: "info",
      title: `${plural(input.staleCount, "preço parado", "preços parados")} há muito tempo`,
      detail: "Confira se ainda é o que você paga hoje.",
      href: "/insumos",
      cta: "Conferir preços",
    });
  }

  return out.sort((a, b) => RANK[a.tone] - RANK[b.tone]);
}
