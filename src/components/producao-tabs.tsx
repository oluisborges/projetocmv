"use client";

import { SectionTabs } from "@/components/section-tabs";

/** Alternância dentro de Produção: o plano da semana, a calculadora (quero produzir X) e o estoque do dia a dia. */
export function ProducaoTabs({ active }: { active: "semana" | "calcular" | "estoque" }) {
  return (
    <SectionTabs
      ariaLabel="Partes da produção"
      active={active}
      items={[
        { key: "semana", href: "/producao", label: "Semana" },
        { key: "calcular", href: "/producao/calcular", label: "Calcular" },
        { key: "estoque", href: "/producao/estoque", label: "Estoque" },
      ]}
    />
  );
}
