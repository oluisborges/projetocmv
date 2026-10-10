"use client";

import Link, { useLinkStatus } from "next/link";

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse" : undefined}>{children}</span>;
}

/** Alternância entre as duas telas de custos: o que se paga todo mês e o resultado de um mês fechado. */
export function CostsTabs({ active }: { active: "fixed" | "month" }) {
  const item = (on: boolean) => `flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold ${on ? "bg-surface shadow-sm" : "text-muted"}`;
  return (
    <nav aria-label="Custos" className="flex gap-1 rounded-xl bg-border/60 p-1">
      <Link href="/custos" aria-current={active === "fixed" ? "page" : undefined} className={item(active === "fixed")}>
        <Pending>Custos fixos</Pending>
      </Link>
      <Link href="/custos/mes" aria-current={active === "month" ? "page" : undefined} className={item(active === "month")}>
        <Pending>Resultado do mês</Pending>
      </Link>
    </nav>
  );
}
