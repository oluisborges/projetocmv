import { D, type Decimal, type Num, safeDiv } from "./decimal";

export type StaffArea = "cozinha" | "embalagem" | "entrega";
export type StaffMember = { area: StaffArea; monthlySalary: Num; chargesPct: Num };

/** Custo mensal total de um colaborador = salário × (1 + encargos). */
export const staffMonthlyCost = (s: StaffMember): Decimal =>
  D(s.monthlySalary).mul(D(1).plus(s.chargesPct));

export function cmo(staff: StaffMember[], revenue: Num) {
  const byArea: Record<StaffArea, Decimal> = { cozinha: D(0), embalagem: D(0), entrega: D(0) };
  for (const s of staff) byArea[s.area] = byArea[s.area].plus(staffMonthlyCost(s));
  const total = Object.values(byArea).reduce((a, b) => a.plus(b), D(0));
  return {
    total,
    pct: safeDiv(total, revenue),
    byArea,
    pctByArea: {
      cozinha: safeDiv(byArea.cozinha, revenue),
      embalagem: safeDiv(byArea.embalagem, revenue),
      entrega: safeDiv(byArea.entrega, revenue),
    },
  };
}
