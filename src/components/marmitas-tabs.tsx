"use client";

import { SectionTabs } from "@/components/section-tabs";

const NOT_CONNECTED = "Esta parte é liberada quando o seu cardápio digital (CardápioWeb ou Prefiro) estiver conectado. Fale com o suporte do Precificaí para conectar.";

/** Partes do Cardápio: as marmitas, os combos que as juntam, as fichas para baixar e a sincronização com o cardápio digital (travada sem cardápio conectado). */
export function MarmitasTabs({ active, showCombos = true, connected = false }: { active: "marmitas" | "combos" | "fichas" | "sync"; /** Sem nenhum combo cadastrado a aba some; o atalho fica no fim da lista. */ showCombos?: boolean; connected?: boolean }) {
  return (
    <SectionTabs
      ariaLabel="Partes do Cardápio"
      active={active}
      items={[
        { key: "marmitas", href: "/cardapio", label: "Produtos" },
        ...(showCombos || active === "combos" ? [{ key: "combos", href: "/cardapio/combos", label: "Combos" }] : []),
        { key: "fichas", href: "/cardapio/fichas", label: "Baixar Fichas" },
        { key: "sync", href: "/cardapio/sincronizar", label: "Sincronizar Cardápio", lock: connected ? undefined : { message: NOT_CONNECTED } },
      ]}
    />
  );
}
