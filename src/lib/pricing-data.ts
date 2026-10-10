import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadFixedCosts, loadStaff } from "@/lib/costs-data";
import { summarizeFixedCosts } from "@/lib/fixed-costs-view";
import type { PricingSettings } from "@/lib/pricing-view";

export type Channel = { id: string; name: string; fee_pct: number };

export type PricingContext = {
  unit: { id: string; name: string };
  settings: PricingSettings;
  /**
   * Despesa fixa calculada a partir dos custos cadastrados em Custos (+ faturamento mensal informado).
   * Quando existe, ela SUBSTITUI o percentual digitado à mão em Ajustes.
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
  /** Custos fixos + equipe por mês (0 se ainda não cadastrou). */
  fixedTotal: number;
  /** Parte do total acima que é equipe (salário + encargos). */
  staffTotal: number;
  /** O dono já salvou os ajustes ao menos uma vez? Se não, impostos e despesas ainda são zero e a margem é só estimativa. */
  configured: boolean;
  channels: Channel[];
};

export const DEFAULT_SETTINGS: PricingSettings = { taxPct: 0, fixedExpensePct: 0, profitPct: 0.15, minMarginPct: 0.1, otherPct: 0, safetyMarginPct: 0.1 };

/**
 * Unidade em uso. Hoje: a primeira da marmitaria (todo cliente começa com uma).
 * Quando houver seletor de unidade, é aqui que ele entra.
 */
export async function activeUnit(orgId: string): Promise<{ id: string; name: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("units").select("id, name").eq("org_id", orgId).order("created_at").limit(1).maybeSingle();
  return data ?? null;
}

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
 * Faturamento e unidades "de um mês normal": a média dos meses (até 12) em que o dono informou faturamento em
 * Resultado do mês, como na planilha de precificação. Sem nenhum mês informado, vale o número digitado em Custos.
 */
async function monthlyAverages(unitId: string): Promise<{ revenue: number; units: number | null; months: number } | null> {
  const supabase = await createClient();
  const { data: periods } = await supabase.from("periods").select("id, revenue").eq("unit_id", unitId).gt("revenue", 0).order("month", { ascending: false }).limit(12);
  if (!periods || periods.length === 0) return null;
  const { data: sales } = await supabase.from("period_sales").select("period_id, qty_sold").in("period_id", periods.map((p) => p.id as string));
  const unitsByPeriod = new Map<string, number>();
  for (const s of sales ?? []) unitsByPeriod.set(s.period_id as string, (unitsByPeriod.get(s.period_id as string) ?? 0) + Number(s.qty_sold));
  const withUnits = periods.filter((p) => (unitsByPeriod.get(p.id as string) ?? 0) > 0);
  return {
    revenue: periods.reduce((s, p) => s + Number(p.revenue), 0) / periods.length,
    units: withUnits.length > 0 ? withUnits.reduce((s, p) => s + (unitsByPeriod.get(p.id as string) ?? 0), 0) / withUnits.length : null,
    months: periods.length,
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

  let { data: channels } = await supabase.from("sales_channels").select("id, name, fee_pct").eq("unit_id", unit.id).order("name");
  if ((!channels || channels.length === 0) && canWrite) {
    await supabase.from("sales_channels").insert({ org_id: orgId, unit_id: unit.id, name: "Venda direta", fee_pct: 0 });
    ({ data: channels } = await supabase.from("sales_channels").select("id, name, fee_pct").eq("unit_id", unit.id).order("name"));
  }

  const [fixedCosts, staff, history] = await Promise.all([loadFixedCosts(unit.id), loadStaff(unit.id), monthlyAverages(unit.id)]);
  const manualRevenue = settingsRow?.monthly_revenue ? Number(settingsRow.monthly_revenue) : null;
  const manualUnits = settingsRow?.monthly_units ? Number(settingsRow.monthly_units) : null;
  const monthlyRevenue = history ? history.revenue : manualRevenue;
  const monthlyUnits = history ? (history.units ?? manualUnits) : manualUnits;
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

  return {
    unit,
    settings: fixedAuto ? { ...base, fixedExpensePct: fixed.pctOfRevenue as number } : base,
    fixedAuto,
    fixedPctOfRevenue: fixed.pctOfRevenue,
    monthlyRevenue,
    monthlyUnits,
    revenueSource: history ? "history" : manualRevenue ? "manual" : null,
    revenueMonths: history?.months ?? 0,
    fixedTotal: fixed.total,
    staffTotal: fixed.staffTotal,
    configured: Boolean(settingsRow?.configured_at),
    channels: (channels ?? []).map((c) => ({ id: c.id, name: c.name, fee_pct: Number(c.fee_pct) })),
  };
}

/** Preço praticado de cada ficha na unidade ativa: recipe_id -> R$. */
export async function loadCurrentPrices(unitId: string): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("recipe_prices").select("recipe_id, current_price").eq("unit_id", unitId);
  return new Map((data ?? []).map((r) => [r.recipe_id as string, Number(r.current_price)]));
}
