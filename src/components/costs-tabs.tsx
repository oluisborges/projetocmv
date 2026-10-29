"use client";

import { SectionTabs } from "@/components/section-tabs";

/** Financeiro: o que se paga todo mês, os impostos e a meta de lucro e o fechamento do mês. */
export function CostsTabs({ active }: { active: "fixed" | "taxes" | "month" }) {
  return (
    <SectionTabs
      ariaLabel="Partes do Financeiro"
      active={active}
      items={[
        { key: "fixed", href: "/financeiro", label: "Custos fixos" },
        { key: "taxes", href: "/financeiro/impostos", label: "Impostos e meta" },
        { key: "month", href: "/financeiro/mes", label: "Fechar o mês" },
      ]}
    />
  );
}
