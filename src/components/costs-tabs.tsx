"use client";

import Link, { useLinkStatus } from "next/link";

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse" : undefined}>{children}</span>;
}

/**
 * Alternância entre as telas de custos: o que se paga todo mês, o resultado de um mês fechado e, para quem tem cardápio digital
 * conectado, os vínculos entre o que o cardápio vende e as fichas.
 */
export function CostsTabs({ active, menu = false }: { active: "fixed" | "month" | "menu"; menu?: boolean }) {
  const item = (on: boolean) => `flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold ${on ? "bg-surface shadow-sm" : "text-muted"}`;
  return (
    <nav aria-label="Custos" className="flex gap-1 rounded-xl bg-border/60 p-1">
      <Link href="/custos" aria-current={active === "fixed" ? "page" : undefined} className={item(active === "fixed")}>
        <Pending>Custos fixos</Pending>
      </Link>
      <Link href="/custos/mes" aria-current={active === "month" ? "page" : undefined} className={item(active === "month")}>
        <Pending>Fechar o mês</Pending>
      </Link>
      {menu ? (
        <Link href="/custos/cardapio" aria-current={active === "menu" ? "page" : undefined} className={item(active === "menu")}>
          <Pending>Cardápio</Pending>
        </Link>
      ) : null}
    </nav>
  );
}
