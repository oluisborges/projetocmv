import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PricingSettings } from "@/lib/pricing-view";

export type Channel = { id: string; name: string; fee_pct: number };

export type PricingContext = {
  unit: { id: string; name: string };
  settings: PricingSettings;
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

  return {
    unit,
    settings: settingsRow ? toSettings(settingsRow) : DEFAULT_SETTINGS,
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
