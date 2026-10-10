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
  /** Custos fixos + equipe por mês (0 se ainda não cadastrou). */
  fixedTotal: number;
  /** Parte do total acima que é equipe (salário + encargos). */
  staffTotal: number;
  /** O dono já salvou os ajustes ao menos uma vez? Se não, impostos e despesas ainda são zero e a margem é só estimativa. */
  configured: boolean;
  channels: Channel[];
};

export const DEFAULT_SETTINGS: PricingSettings = { taxPct: 0, fixedExpensePct: 0, profitPct: 0.15, minMarginPct: 0.1 };

/**
 * Unidade em uso. Hoje: a primeira da marmitaria (todo cliente começa com uma).
 * Quando houver seletor de unidade, é aqui que ele entra.
 */
export async function activeUnit(orgId: string): Promise<{ id: string; name: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("units").select("id, name").eq("org_id", orgId).order("created_at").limit(1).maybeSingle();
  return data ?? null;
}

const toSettings = (r: { tax_pct: unknown; fixed_expense_pct: unknown; profit_pct: unknown; min_margin_pct: unknown }): PricingSettings => ({
  taxPct: Number(r.tax_pct),
  fixedExpensePct: Number(r.fixed_expense_pct),
  profitPct: Number(r.profit_pct),
  minMarginPct: Number(r.min_margin_pct),
});

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

  const [fixedCosts, staff] = await Promise.all([loadFixedCosts(unit.id), loadStaff(unit.id)]);
  const monthlyRevenue = settingsRow?.monthly_revenue ? Number(settingsRow.monthly_revenue) : null;
  const monthlyUnits = settingsRow?.monthly_units ? Number(settingsRow.monthly_units) : null;
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
