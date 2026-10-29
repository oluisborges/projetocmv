"use client";

import { SectionTabs } from "@/components/section-tabs";
import type { MenuLock } from "@/lib/menu-locks";

/** Início: o resumo do dia a dia (alertas e números principais) e a Visão Avançada (os detalhes). A Visão Avançada espera a primeira marmita. */
export function InicioTabs({ active, advancedLock = null }: { active: "resumo" | "avancada"; advancedLock?: MenuLock | null }) {
  return (
    <SectionTabs
      ariaLabel="Partes do início"
      active={active}
      items={[
        { key: "resumo", href: "/", label: "Resumo" },
        { key: "avancada", href: "/painel", label: "Visão Avançada", lock: active !== "avancada" && advancedLock ? advancedLock : undefined },
      ]}
    />
  );
}
