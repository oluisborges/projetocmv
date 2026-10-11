"use client";

import Link, { useLinkStatus } from "next/link";

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse" : undefined}>{children}</span>;
}

/** Alternância dentro do Painel: o retrato de hoje ou o histórico mês a mês. */
export function PainelTabs({ active, showHistory = true }: { active: "resumo" | "historico"; showHistory?: boolean }) {
  const item = (on: boolean) => `flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold ${on ? "bg-surface shadow-sm" : "text-muted"}`;
  return (
    <nav aria-label="Painel" className="flex gap-1 rounded-xl bg-border/60 p-1">
      <Link href="/painel" aria-current={active === "resumo" ? "page" : undefined} className={item(active === "resumo")}>
        <Pending>Resumo</Pending>
      </Link>
      {showHistory ? (
        <Link href="/painel/historico" aria-current={active === "historico" ? "page" : undefined} className={item(active === "historico")}>
          <Pending>Histórico</Pending>
        </Link>
      ) : null}
    </nav>
  );
}
