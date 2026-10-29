import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { loadFixedCosts, loadStaff } from "@/lib/costs-data";
import { summarizeFixedCosts } from "@/lib/fixed-costs-view";
import { comboUnits as calcComboUnits } from "@/lib/calc";
import { toCalcGroups } from "@/lib/combo-view";
import { loadCombos } from "@/lib/combos-data";
import { hasMenuConnection, loadMenuMonthly } from "@/lib/menu-data";
import { currentMonthStart, lastMonths } from "@/lib/month-view";
import type { PricingSettings } from "@/lib/pricing-view";

export type Channel = { id: string; name: string; fee_pct: number };

export type PricingContext = {
  unit: { id: string; name: string };
  settings: PricingSettings;
  /**
   * Despesa fixa calculada a partir dos custos cadastrados em Financeiro, aba Custos fixos (+ faturamento mensal informado).
   * Quando existe, ela SUBSTITUI o percentual digitado à mão em Custos.
   */
  fixedAuto: boolean;
  /** Custos fixos ÷ faturamento (fração), mesmo quando passa de 100% e por isso NÃO é usado no preço. */
  fixedPctOfRevenue: number | null;
  monthlyRevenue: number | null;
  monthlyUnits: number | null;
  /** De onde vêm o faturamento e as unidades por mês: média dos meses informados em Resultado do mês ("history"), número digitado ("manual") ou nada. */
  revenueSource: "history" | "manual" | null;
  /** Quantos meses entraram na média (0 quando não é "history"). */
  revenueMonths: number;
  /** O que o dono digitou à mão (vale no lugar da média quando existe). */
  manualRevenue: number | null;
  manualUnits: number | null;
  /** A média automática (cardápio digital + meses informados), mesmo quando um número à mão está valendo. */
  autoRevenue: { revenue: number; units: number | null; months: number } | null;
  /** Custos fixos + equipe por mês (0 se ainda não cadastrou). */
  fixedTotal: number;
  /** Parte do total acima que é equipe (salário + encargos). */
  staffTotal: number;
  /** Os lucros mostrados são só estimativa? `tax`: faltam os impostos em Custos; `expenses`: há contas cadastradas, mas falta o faturamento (ou elas passam dele) para ratear nas margens. */
  estimateReason: "tax" | "expenses" | null;
  estimate: boolean;
  /** O dono já salvou os ajustes ao menos uma vez? Se não, impostos e despesas ainda são zero e a margem é só estimativa. */
  configured: boolean;
  channels: Channel[];
};

export const DEFAULT_SETTINGS: PricingSettings = { taxPct: 0, fixedExpensePct: 0, profitPct: 0.15, minMarginPct: 0.1, otherPct: 0, safetyMarginPct: 0.1 };

/**
 * Unidade em uso. Hoje: a primeira da marmitaria (todo cliente começa com uma).
 * Quando houver seletor de unidade, é aqui que ele entra.
 */
export const activeUnit = cache(async (orgId: string): Promise<{ id: string; name: string } | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("units").select("id, name").eq("org_id", orgId).order("created_at").limit(1).maybeSingle();
  return data ?? null;
});

const toSettings = (r: {
  tax_pct: unknown;
  fixed_expense_pct: unknown;
  profit_pct: unknown;
  min_margin_pct: unknown;
  other_pct: unknown;
  safety_margin_pct: unknown;
}): PricingSettings => ({
  taxPct: Number(r.tax_pct),
  fixedExpensePct: Number(r.fixed_expense_pct),
  profitPct: Number(r.profit_pct),
  minMarginPct: Number(r.min_margin_pct),
  otherPct: Number(r.other_pct ?? 0),
  safetyMarginPct: Number(r.safety_margin_pct ?? 0.1),
});

/** Margem de segurança da unidade em uso (fichas e telas de custo usam). Sem ajustes salvos ainda, vale o padrão. */
export async function loadSafetyMargin(orgId: string): Promise<number> {
  const unit = await activeUnit(orgId);
  if (!unit) return DEFAULT_SETTINGS.safetyMarginPct ?? 0;
  const supabase = await createClient();
  const { data } = await supabase.from("unit_settings").select("safety_margin_pct").eq("unit_id", unit.id).maybeSingle();
  return data ? Number(data.safety_margin_pct) : (DEFAULT_SETTINGS.safetyMarginPct ?? 0);
}

/**
 * Faturamento e unidades "de um mês normal": a média dos meses FECHADOS (até 12) em que o dono informou faturamento em
 * Resultado do mês, como na planilha de precificação. O mês em andamento fica de fora: um valor parcial derrubaria a média. Sem nenhum mês informado, vale o número digitado em Financeiro, aba Custos fixos.
 */
async function monthlyAverages(orgId: string, unitId: string): Promise<{ revenue: number; units: number | null; months: number } | null> {
  const supabase = await createClient();
  const current = currentMonthStart();
  const { data: periods } = await supabase.from("periods").select("id, month, revenue").eq("unit_id", unitId).lt("month", current).order("month", { ascending: false }).limit(24); // folga: meses sem faturamento digitado não podem tirar a vez dos que têm
  const { data: sales } = periods?.length ? await supabase.from("period_sales").select("period_id, qty_sold").in("period_id", periods.map((p) => p.id as string)) : { data: [] };
  const unitsByPeriod = new Map<string, number>();
  for (const s of sales ?? []) unitsByPeriod.set(s.period_id as string, (unitsByPeriod.get(s.period_id as string) ?? 0) + Number(s.qty_sold));

  // Mês a mês: o que o dono digitou (venda por fora, quando há cardápio) + o que veio do cardápio digital.
  const byMonth = new Map<string, { revenue: number; units: number }>();
  for (const p of periods ?? []) byMonth.set(p.month as string, { revenue: Number(p.revenue), units: unitsByPeriod.get(p.id as string) ?? 0 });

  if (await hasMenuConnection(orgId)) {
    const oldest = lastMonths(current, 13).at(-1) ?? current;
    const menu = await loadMenuMonthly(unitId, oldest);
    // combos só entram na conta se o cardápio vendeu algum: evita uma consulta pesada em toda página para quem não usa
    const soldCombos = [...menu.values()].some((m) => m.comboQty.size > 0);
    const combos = soldCombos ? await loadCombos(orgId) : [];
    const comboUnits = new Map(combos.map((c) => [c.id, calcComboUnits(toCalcGroups(c, new Map(), new Map()))]));
    for (const m of menu.values()) {
      if (m.month >= current || m.orders === 0) continue; // o mês em andamento fica de fora, como no digitado
      const cur = byMonth.get(m.month) ?? { revenue: 0, units: 0 };
      let units = m.recipeUnits;
      for (const [comboId, qty] of m.comboQty) units += qty * (comboUnits.get(comboId) ?? 0);
      byMonth.set(m.month, { revenue: cur.revenue + m.revenue, units: cur.units + units });
    }
  }

  const months = [...byMonth.entries()].filter(([, v]) => v.revenue > 0).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 12).map(([, v]) => v);
  if (months.length === 0) return null;
  const withUnits = months.filter((m) => m.units > 0);
  return {
    revenue: months.reduce((s, m) => s + m.revenue, 0) / months.length,
    units: withUnits.length > 0 ? withUnits.reduce((s, m) => s + m.units, 0) / withUnits.length : null,
    months: months.length,
  };
}

/**
 * Ajustes de preço da unidade ativa. Na primeira visita de quem pode escrever, cria os padrões
 * (lucro 15%, meta 10%) e o canal "Venda direta". Quem só lê enxerga os padrões, sem gravar nada.
 */
export async function loadPricingContext(orgId: string, canWrite: boolean): Promise<PricingContext | null> {
  const unit = await activeUnit(orgId);
  if (!unit) return null;
  const supabase = await createClient();

  let { data: settingsRow } = await supabase.from("unit_settings").select("*").eq("unit_id", unit.id).maybeSingle();
  if (!settingsRow && canWrite) {
    await supabase.from("unit_settings").upsert({ unit_id: unit.id, org_id: orgId }, { onConflict: "unit_id", ignoreDuplicates: true });
    ({ data: settingsRow } = await supabase.from("unit_settings").select("*").eq("unit_id", unit.id).maybeSingle());
  }

  let { data: channels } = await supabase.from("sales_channels").select("id, name, fee_pct").eq("unit_id", unit.id).order("fee_pct").order("name");
  if ((!channels || channels.length === 0) && canWrite) {
    await supabase.from("sales_channels").insert({ org_id: orgId, unit_id: unit.id, name: "Venda direta", fee_pct: 0 });
    ({ data: channels } = await supabase.from("sales_channels").select("id, name, fee_pct").eq("unit_id", unit.id).order("fee_pct").order("name"));
  }

  const [fixedCosts, staff, history] = await Promise.all([loadFixedCosts(unit.id), loadStaff(unit.id), monthlyAverages(orgId, unit.id)]);
  const manualRevenue = settingsRow?.monthly_revenue ? Number(settingsRow.monthly_revenue) : null;
  const manualUnits = settingsRow?.monthly_units ? Number(settingsRow.monthly_units) : null;
  // O que o dono digitou à mão vale; sem isso, vale a média puxada do cardápio digital e dos meses informados.
  const monthlyRevenue = manualRevenue ?? history?.revenue ?? null;
  const monthlyUnits = manualUnits ?? history?.units ?? null;
  const fixed = summarizeFixedCosts({
    fixedCosts: fixedCosts.map((c) => c.monthly_amount),
    staff: staff.map((m) => ({ area: m.area, monthlySalary: m.monthly_salary, chargesPct: m.charges_pct })),
    monthlyRevenue,
    monthlyUnits,
    dishes: [],
    taxPct: 0,
    feePct: 0,
  });

  const base = settingsRow ? toSettings(settingsRow) : DEFAULT_SETTINGS;
  // Com custos cadastrados e faturamento informado, a despesa fixa do preço é calculada, não chutada.
  const fixedAuto = fixed.pctOfRevenue !== null && fixed.pctOfRevenue < 1;

  const configured = Boolean(settingsRow?.configured_at);
  const estimateReason: PricingContext["estimateReason"] = !configured ? "tax" : fixed.total > 0 && !fixedAuto ? "expenses" : null;

  return {
    unit,
    estimateReason,
    estimate: estimateReason !== null,
    settings: fixedAuto ? { ...base, fixedExpensePct: fixed.pctOfRevenue as number } : base,
    fixedAuto,
    fixedPctOfRevenue: fixed.pctOfRevenue,
    monthlyRevenue,
    monthlyUnits,
    revenueSource: manualRevenue ? "manual" : history ? "history" : null,
    revenueMonths: manualRevenue ? 0 : (history?.months ?? 0),
    manualRevenue,
    manualUnits,
    autoRevenue: history,
    fixedTotal: fixed.total,
    staffTotal: fixed.staffTotal,
    configured,
    channels: (channels ?? []).map((c) => ({ id: c.id, name: c.name, fee_pct: Number(c.fee_pct) })),
  };
}

/** Preço praticado de cada ficha na unidade ativa: recipe_id -> R$. */
export async function loadCurrentPrices(unitId: string): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("recipe_prices").select("recipe_id, current_price").eq("unit_id", unitId);
  return new Map((data ?? []).map((r) => [r.recipe_id as string, Number(r.current_price)]));
}
