"use client";

import { SectionTabs } from "@/components/section-tabs";

const NOT_CONNECTED = "Esta parte é liberada quando o seu cardápio digital (CardápioWeb ou Prefiro) estiver conectado. Fale com o suporte do Precificaí para conectar.";

/** Financeiro: o que se paga todo mês, os impostos e a meta de lucro, o fechamento do mês e a ligação com o cardápio digital (travada sem cardápio conectado). */
export function CostsTabs({ active, menu = false }: { active: "fixed" | "taxes" | "month" | "menu"; menu?: boolean }) {
  return (
    <SectionTabs
      ariaLabel="Partes do Financeiro"
      active={active}
      items={[
        { key: "fixed", href: "/financeiro", label: "Custos fixos" },
        { key: "taxes", href: "/financeiro/impostos", label: "Impostos e meta" },
        { key: "month", href: "/financeiro/mes", label: "Fechar o mês" },
        { key: "menu", href: "/financeiro/cardapio", label: "Cardápio digital", lock: menu ? undefined : { message: NOT_CONNECTED } },
      ]}
    />
  );
}
