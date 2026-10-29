"use client";

import { SectionTabs } from "@/components/section-tabs";

const NO_COUPONS = "Os cupons aparecem quando o seu cardápio digital (CardápioWeb ou Prefiro) estiver conectado. Fale com o suporte do Precificaí para conectar.";

/** Dentro da Visão Avançada: o retrato geral, a análise por produto e os cupons (travados sem cardápio digital conectado). */
export function PainelTabs({ active, showCoupons = false }: { active: "resumo" | "cardapio" | "cupons"; showCoupons?: boolean }) {
  return (
    <SectionTabs
      ariaLabel="Partes da visão avançada"
      active={active}
      items={[
        { key: "resumo", href: "/painel", label: "Geral" },
        { key: "cardapio", href: "/painel/cardapio", label: "Por produto" },
        { key: "cupons", href: "/painel/cupons", label: "Cupons", lock: showCoupons ? undefined : { message: NO_COUPONS } },
      ]}
    />
  );
}
