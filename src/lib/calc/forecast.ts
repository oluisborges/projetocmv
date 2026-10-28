import { D } from "./decimal";

export type DemandInput = {
  /** Unidades vendidas em cada semana COMPLETA, da mais antiga para a mais recente (com zeros). */
  weekly: number[];
  /** Marmitas prontas no congelador agora (`null` = não se sabe). */
  finished: number | null;
};

export type Suggestion = {
  /** Semanas consideradas (descontadas as de antes da primeira venda) e quantas tiveram venda. */
  weeks: number;
  weeksWithSales: number;
  /** Média por semana, dando mais peso às semanas recentes. */
  average: number;
  /** Últimas 2 semanas contra as 2 anteriores (fração: 0.12 = +12%). `null` com pouco histórico. */
  trendPct: number | null;
  /** Demanda esperada para a semana que vem. */
  forecast: number;
  /** Quanto produzir: a demanda menos o que já está pronto, arredondado para cima em múltiplos de `step`. */
  toProduce: number;
  confidence: "none" | "low" | "ok";
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Sugestão de produção para a próxima semana a partir das vendas passadas. De propósito simples e explicável:
 * média ponderada (semana recente pesa mais) com um ajuste leve pela tendência (no máximo ±12,5%).
 * É uma sugestão, não uma previsão: o dono sempre ajusta.
 */
export function suggestProduction(input: DemandInput, opts: { step?: number } = {}): Suggestion {
  const step = opts.step ?? 5;
  // Semanas antes da primeira venda não contam: a marmita ainda não existia no cardápio.
  const firstSale = input.weekly.findIndex((v) => v > 0);
  const weekly = firstSale < 0 ? [] : input.weekly.slice(firstSale);
  if (weekly.length === 0) return { weeks: 0, weeksWithSales: 0, average: 0, trendPct: null, forecast: 0, toProduce: 0, confidence: "none" };

  let weighted = D(0);
  let weights = 0;
  weekly.forEach((v, i) => {
    weighted = weighted.plus(D(v).mul(i + 1));
    weights += i + 1;
  });
  const average = weighted.div(weights).toNumber();

  let trendPct: number | null = null;
  if (weekly.length >= 4) {
    const recent = (weekly[weekly.length - 1] + weekly[weekly.length - 2]) / 2;
    const prior = (weekly[weekly.length - 3] + weekly[weekly.length - 4]) / 2;
    trendPct = prior > 0 ? (recent - prior) / prior : null;
  }
  const adjust = trendPct === null ? 0 : clamp(trendPct, -0.25, 0.25) * 0.5;
  const forecast = Math.max(0, Math.round(D(average).mul(1 + adjust).toNumber()));

  const raw = Math.max(0, forecast - (input.finished === null ? 0 : Math.max(0, Math.floor(input.finished))));
  const toProduce = raw >= step * 2 ? Math.ceil(raw / step) * step : raw;

  const weeksWithSales = weekly.filter((v) => v > 0).length;
  return {
    weeks: weekly.length,
    weeksWithSales,
    average,
    trendPct,
    forecast,
    toProduce,
    confidence: weekly.length >= 4 && weeksWithSales >= 3 ? "ok" : "low",
  };
}

/** Marmitas que, somadas, respondem por `share` (0.8 = 80%) da demanda esperada: as mais vendidas. */
export function topSellers(forecasts: { id: string; forecast: number }[], share = 0.8): Set<string> {
  const total = forecasts.reduce((s, f) => s + f.forecast, 0);
  if (total <= 0) return new Set();
  const out = new Set<string>();
  let acc = 0;
  for (const f of [...forecasts].sort((a, b) => b.forecast - a.forecast)) {
    if (f.forecast <= 0 || acc / total >= share) break;
    out.add(f.id);
    acc += f.forecast;
  }
  return out;
}
