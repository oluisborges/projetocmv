"use client";

import { SectionTabs } from "@/components/section-tabs";

/** Alternância dentro de Produção: as produções, o estoque do dia a dia, a contagem do mês e o fechamento do mês. */
export function ProducaoTabs({ active }: { active: "producoes" | "estoque" | "contagem" | "fechar" }) {
  return (
    <SectionTabs
      ariaLabel="Partes da produção"
      active={active}
      items={[
        { key: "producoes", href: "/producao", label: "Produções" },
        { key: "estoque", href: "/producao/estoque", label: "Estoque" },
        { key: "contagem", href: "/producao/contagem", label: "Contagem do mês" },
        { key: "fechar", href: "/producao/fechar-mes", label: "Fechar o mês" },
      ]}
    />
  );
}
