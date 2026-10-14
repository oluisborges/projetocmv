"use client";

import Link, { useLinkStatus } from "next/link";

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse" : undefined}>{children}</span>;
}

/** Alternância entre as marmitas (fichas) e os combos que as juntam. */
export function FichasTabs({ active }: { active: "marmitas" | "combos" }) {
  const item = (on: boolean) => `flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold ${on ? "bg-surface shadow-sm" : "text-muted"}`;
  return (
    <nav aria-label="Fichas" className="flex gap-1 rounded-xl bg-border/60 p-1">
      <Link href="/fichas" aria-current={active === "marmitas" ? "page" : undefined} className={item(active === "marmitas")}>
        <Pending>Marmitas</Pending>
      </Link>
      <Link href="/fichas/combos" aria-current={active === "combos" ? "page" : undefined} className={item(active === "combos")}>
        <Pending>Combos</Pending>
      </Link>
    </nav>
  );
}
