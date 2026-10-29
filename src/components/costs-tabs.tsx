"use client";

import { SectionTabs } from "@/components/section-tabs";

/** Financeiro: o que se paga todo mês, os impostos e a meta de lucro e o histórico mês a mês. */
export function CostsTabs({ active }: { active: "fixed" | "taxes" | "history" }) {
  return (
    <SectionTabs
      ariaLabel="Partes do Financeiro"
      active={active}
      items={[
        { key: "fixed", href: "/financeiro", label: "Custos fixos" },
        { key: "taxes", href: "/financeiro/impostos", label: "Impostos e meta" },
        { key: "history", href: "/financeiro/historico", label: "Histórico" },
      ]}
    />
  );
}
