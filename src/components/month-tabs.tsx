"use client";

import Link, { useLinkStatus } from "next/link";

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse" : undefined}>{children}</span>;
}

/** Alternância dentro de Mês: fechar o mês, contar o estoque e ver o histórico mês a mês. */
export function MonthTabs({ active }: { active: "fechar" | "estoque" | "historico" }) {
  const item = (on: boolean) => `flex h-11 flex-1 items-center justify-center rounded-lg px-1 text-[13px] font-semibold ${on ? "bg-surface shadow-sm" : "text-muted"}`;
  return (
    <nav aria-label="Partes do mês" className="flex gap-1 rounded-xl bg-border/60 p-1">
      <Link href="/mes" aria-current={active === "fechar" ? "page" : undefined} className={item(active === "fechar")}>
        <Pending>Fechar o mês</Pending>
      </Link>
      <Link href="/mes/estoque" aria-current={active === "estoque" ? "page" : undefined} className={item(active === "estoque")}>
        <Pending>Estoque</Pending>
      </Link>
      <Link href="/mes/historico" aria-current={active === "historico" ? "page" : undefined} className={item(active === "historico")}>
        <Pending>Histórico</Pending>
      </Link>
    </nav>
  );
}
