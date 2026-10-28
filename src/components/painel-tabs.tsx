"use client";

import { SectionTabs } from "@/components/section-tabs";

const NO_COUPONS = "Os cupons aparecem quando o seu cardápio digital (CardápioWeb ou Prefiro) estiver conectado. Fale com o suporte do Precificaí para conectar.";

/** Alternância dentro do Painel: o retrato de hoje, a análise por marmita, o fechamento do mês e os cupons (travados sem cardápio digital conectado). */
export function PainelTabs({ active, showCoupons = false }: { active: "resumo" | "cardapio" | "mes" | "cupons"; showCoupons?: boolean }) {
  return (
    <SectionTabs
      ariaLabel="Partes do painel"
      active={active}
      items={[
        { key: "resumo", href: "/painel", label: "Resumo" },
        { key: "cardapio", href: "/painel/cardapio", label: "Por marmita" },
        { key: "mes", href: "/mes", label: "Mês" },
        { key: "cupons", href: "/painel/cupons", label: "Cupons", lock: showCoupons ? undefined : { message: NO_COUPONS } },
      ]}
    />
  );
}
