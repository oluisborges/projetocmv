"use client";

import { SectionTabs } from "@/components/section-tabs";

/** Alternância dentro de Produção: as produções (o que fazer, preparar e comprar) e o estoque do dia a dia. */
export function ProducaoTabs({ active }: { active: "producoes" | "estoque" }) {
  return (
    <SectionTabs
      ariaLabel="Partes da produção"
      active={active}
      items={[
        { key: "producoes", href: "/producao", label: "Produções" },
        { key: "estoque", href: "/producao/estoque", label: "Estoque" },
      ]}
    />
  );
}
