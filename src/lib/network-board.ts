import { formatBRL, formatPct } from "@/lib/format";
import { BIG_DROP, HIGH_COUPON, LINK_COVERAGE_OK, LOW_MARGIN, couponPct, revenueTrend, setupScore, setupSteps, ticket, type NetworkClient } from "@/lib/network-view";

export type Tone = "good" | "warn" | "bad" | "none";

const GOOD_MARGIN = 0.45;
const WARN_COUPON = 0.06;

/** "↑ 12% no ritmo" / "↓ 30% vs mês anterior". Sem base de comparação, "—". */
export function trendLabel(pct: number | null, basis: "closed" | "pace"): { text: string; tone: Tone } {
  if (pct === null) return { text: "—", tone: "none" };
  const arrow = pct >= 0 ? "↑" : "↓";
  const text = `${arrow} ${formatPct(Math.abs(pct), 0)} ${basis === "pace" ? "no ritmo" : "vs mês anterior"}`;
  return { text, tone: pct >= 0 ? "good" : pct > BIG_DROP ? "warn" : "bad" };
}

export const marginTone = (m: number | null): Tone => (m === null ? "none" : m < LOW_MARGIN ? "bad" : m < GOOD_MARGIN ? "warn" : "good");
export const couponTone = (c: number | null): Tone => (c === null ? "none" : c > HIGH_COUPON ? "bad" : c > WARN_COUPON ? "warn" : "good");
export const coverageTone = (c: number | null): Tone => (c === null ? "none" : c < 0.5 ? "bad" : c < LINK_COVERAGE_OK ? "warn" : "good");

/** Tudo de um cliente já formatado para o cartão do quadro (os textos são montados no servidor). */
export function boardRow(c: NetworkClient, monthKey: string, now: Date = new Date()) {
  const trend = revenueTrend(c.month, c.prev, monthKey, now);
  const t = trendLabel(trend.pct, trend.basis);
  const coupon = couponPct(c.month);
  const tk = ticket(c.month);
  const missing = setupSteps(c)
    .filter((s) => !s.done)
    .map((s) => s.label.toLowerCase());
  return {
    id: c.id,
    name: c.name,
    hasMenu: c.hasMenu,
    revenue: c.month.revenue > 0 ? formatBRL(c.month.revenue) : "—",
    trend: t.text,
    trendTone: t.tone,
    orders: c.month.orders > 0 ? String(c.month.orders) : "—",
    ticket: tk !== null ? formatBRL(tk) : "—",
    coupon: coupon !== null ? formatPct(coupon) : "—",
    couponAmount: coupon !== null ? `${formatBRL(c.month.discount)} em cupons` : "",
    couponTone: couponTone(coupon),
    margin: c.margin.avgContributionPct !== null ? formatPct(c.margin.avgContributionPct, 0) : "—",
    marginTone: marginTone(c.margin.avgContributionPct),
    realMargin: c.margin.realPct !== null ? formatPct(c.margin.realPct, 0) : "—",
    coverage: c.coverage !== null ? formatPct(c.coverage, 0) : "—",
    coverageTone: c.hasMenu ? coverageTone(c.coverage) : ("none" as Tone),
    setupPct: setupScore(c),
    setupMissing: missing.join(", "),
    sort: { revenue: c.month.revenue, trend: trend.pct, margin: c.margin.avgContributionPct, setup: setupScore(c) },
  };
}
