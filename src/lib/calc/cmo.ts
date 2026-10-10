import { D, type Decimal, type Num, safeDiv } from "./decimal";

export type StaffArea = "cozinha" | "entrega" | "marketing" | "limpeza" | "comercial" | "outros";
export type StaffMember = { area: StaffArea; monthlySalary: Num; chargesPct: Num };

/** Custo mensal total de um colaborador = salário × (1 + encargos). */
export const staffMonthlyCost = (s: StaffMember): Decimal =>
  D(s.monthlySalary).mul(D(1).plus(s.chargesPct));

export function cmo(staff: StaffMember[], revenue: Num) {
  const byArea: Record<StaffArea, Decimal> = { cozinha: D(0), entrega: D(0), marketing: D(0), limpeza: D(0), comercial: D(0), outros: D(0) };
  for (const s of staff) byArea[s.area] = byArea[s.area].plus(staffMonthlyCost(s));
  const total = Object.values(byArea).reduce((a, b) => a.plus(b), D(0));
  return {
    total,
    pct: safeDiv(total, revenue),
    byArea,
    pctByArea: {
      cozinha: safeDiv(byArea.cozinha, revenue),
      entrega: safeDiv(byArea.entrega, revenue),
      marketing: safeDiv(byArea.marketing, revenue),
      limpeza: safeDiv(byArea.limpeza, revenue),
      comercial: safeDiv(byArea.comercial, revenue),
      outros: safeDiv(byArea.outros, revenue),
    },
  };
}
