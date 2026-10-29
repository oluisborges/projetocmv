"use client";

import { SectionTabs } from "@/components/section-tabs";

const NOT_CONNECTED = "Esta parte é liberada quando o seu cardápio digital (CardápioWeb ou Prefiro) estiver conectado. Fale com o suporte do Precificaí para conectar.";

/** Custos: o que se paga todo mês, os impostos e a meta de lucro, e a ligação com o cardápio digital (travada sem cardápio conectado). */
export function CostsTabs({ active, menu = false }: { active: "fixed" | "taxes" | "menu"; menu?: boolean }) {
  return (
    <SectionTabs
      ariaLabel="Partes de Custos"
      active={active}
      items={[
        { key: "fixed", href: "/financeiro", label: "Custos fixos" },
        { key: "taxes", href: "/financeiro/impostos", label: "Impostos e meta" },
        { key: "menu", href: "/financeiro/cardapio", label: "Cardápio digital", lock: menu ? undefined : { message: NOT_CONNECTED } },
      ]}
    />
  );
}
