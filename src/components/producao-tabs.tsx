"use client";

import { SectionTabs } from "@/components/section-tabs";

/** Alternância dentro de Produção: as produções, o estoque (com o histórico dos meses dentro) e o fechamento do mês. */
export function ProducaoTabs({ active }: { active: "producoes" | "estoque" | "fechar" }) {
  return (
    <SectionTabs
      ariaLabel="Partes da produção"
      active={active}
      items={[
        { key: "producoes", href: "/producao", label: "Produções" },
        { key: "estoque", href: "/producao/estoque", label: "Estoque" },
        { key: "fechar", href: "/producao/fechar-mes", label: "Fechar o mês" },
      ]}
    />
  );
}
