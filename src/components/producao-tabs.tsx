"use client";

import { SectionTabs } from "@/components/section-tabs";

/** Alternância dentro de Produção: as produções, o estoque (com o histórico dos meses dentro), as fichas técnicas para imprimir e o fechamento do mês. */
export function ProducaoTabs({ active }: { active: "producoes" | "estoque" | "fichas" | "fechar" }) {
  return (
    <SectionTabs
      ariaLabel="Partes da produção"
      active={active}
      items={[
        { key: "producoes", href: "/producao", label: "Produções" },
        { key: "estoque", href: "/producao/estoque", label: "Estoque" },
        { key: "fichas", href: "/producao/fichas", label: "Fichas técnicas" },
        { key: "fechar", href: "/producao/fechar-mes", label: "Fechar o mês" },
      ]}
    />
  );
}
