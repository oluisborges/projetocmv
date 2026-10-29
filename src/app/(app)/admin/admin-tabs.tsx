"use client";

import Link, { useLinkStatus } from "next/link";

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse" : undefined}>{children}</span>;
}

/** Abas do painel Shogun: o dia a dia dos clientes e os resultados da rede. */
export function AdminTabs({ active, errorCount = 0 }: { active: "clients" | "results" | "errors" | "team"; errorCount?: number }) {
  const item = (on: boolean) => `flex min-h-11 flex-1 items-center justify-center rounded-lg px-1 text-center text-[13px] font-semibold leading-tight sm:text-sm ${on ? "bg-surface shadow-sm" : "text-muted"}`;
  return (
    <nav aria-label="Painel Shogun" className="flex gap-1 rounded-xl bg-border/60 p-1">
      <Link href="/admin" aria-current={active === "clients" ? "page" : undefined} className={item(active === "clients")}>
        <Pending>Clientes</Pending>
      </Link>
      <Link href="/admin/resultados" aria-current={active === "results" ? "page" : undefined} className={item(active === "results")}>
        <Pending>Resultados</Pending>
      </Link>
      <Link href="/admin/erros" aria-current={active === "errors" ? "page" : undefined} className={item(active === "errors")}>
        <Pending>
          Erros
          {errorCount > 0 ? <span className="tabular ml-1.5 rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">{errorCount}</span> : null}
        </Pending>
      </Link>
      <Link href="/admin/equipe" aria-current={active === "team" ? "page" : undefined} className={item(active === "team")}>
        <Pending>Equipe Shogun</Pending>
      </Link>
    </nav>
  );
}
