import "server-only";
import { createClient } from "@/lib/supabase/server";

export type FixedCostRow = { id: string; name: string; monthly_amount: number };
export type StaffRow = { id: string; name: string; area: "cozinha" | "entrega" | "marketing" | "limpeza" | "comercial" | "outros"; monthly_salary: number; charges_pct: number };

export async function loadFixedCosts(unitId: string): Promise<FixedCostRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("fixed_costs").select("id, name, monthly_amount").eq("unit_id", unitId).order("name");
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, monthly_amount: Number(r.monthly_amount) }));
}

export async function loadStaff(unitId: string): Promise<StaffRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("staff").select("id, name, area, monthly_salary, charges_pct").eq("unit_id", unitId).order("name");
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    area: r.area as StaffRow["area"],
    monthly_salary: Number(r.monthly_salary),
    charges_pct: Number(r.charges_pct),
  }));
}
