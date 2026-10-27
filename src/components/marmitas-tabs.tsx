"use client";

import Link, { useLinkStatus } from "next/link";

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse" : undefined}>{children}</span>;
}

/** Alternância entre as marmitas (fichas), as receitas-base (arroz, estrogonofe…) e os combos que juntam marmitas. */
export function MarmitasTabs({ active, showCombos = true }: { active: "marmitas" | "receitas" | "combos"; /** Sem nenhum combo cadastrado a aba some; o atalho fica no fim da lista. */ showCombos?: boolean }) {
  const item = (on: boolean) => `flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold ${on ? "bg-surface shadow-sm" : "text-muted"}`;
  return (
    <nav aria-label="Marmitas, receitas e combos" className="flex gap-1 rounded-xl bg-border/60 p-1">
      <Link href="/marmitas" aria-current={active === "marmitas" ? "page" : undefined} className={item(active === "marmitas")}>
        <Pending>Marmitas</Pending>
      </Link>
      <Link href="/marmitas/receitas" aria-current={active === "receitas" ? "page" : undefined} className={item(active === "receitas")}>
        <Pending>Receitas</Pending>
      </Link>
      {showCombos ? <Link href="/marmitas/combos" aria-current={active === "combos" ? "page" : undefined} className={item(active === "combos")}>
        <Pending>Combos</Pending>
      </Link> : null}
    </nav>
  );
}
