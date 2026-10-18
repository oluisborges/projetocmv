"use client";

import Link, { useLinkStatus } from "next/link";

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse" : undefined}>{children}</span>;
}

/** Abas do painel Shogun: o dia a dia dos clientes e os resultados da rede. */
export function AdminTabs({ active }: { active: "clients" | "results" }) {
  const item = (on: boolean) => `flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold ${on ? "bg-surface shadow-sm" : "text-muted"}`;
  return (
    <nav aria-label="Painel Shogun" className="flex gap-1 rounded-xl bg-border/60 p-1">
      <Link href="/admin" aria-current={active === "clients" ? "page" : undefined} className={item(active === "clients")}>
        <Pending>Clientes</Pending>
      </Link>
      <Link href="/admin/resultados" aria-current={active === "results" ? "page" : undefined} className={item(active === "results")}>
        <Pending>Resultados</Pending>
      </Link>
    </nav>
  );
}
