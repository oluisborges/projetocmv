"use client";

import Link, { useLinkStatus } from "next/link";

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse" : undefined}>{children}</span>;
}

/** Dentro de uma marmita: a ficha (receita e custo) e o preço de venda. */
export function ProductTabs({ id, active }: { id: string; active: "ficha" | "preco" }) {
  const item = (on: boolean) => `flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold ${on ? "bg-surface shadow-sm" : "text-muted"}`;
  return (
    <nav aria-label="Partes da marmita" className="flex gap-1 rounded-xl bg-border/60 p-1">
      <Link href={`/cardapio/${id}`} aria-current={active === "ficha" ? "page" : undefined} className={item(active === "ficha")}>
        <Pending>Ficha</Pending>
      </Link>
      <Link href={`/cardapio/${id}/preco`} aria-current={active === "preco" ? "page" : undefined} className={item(active === "preco")}>
        <Pending>Preço de venda</Pending>
      </Link>
    </nav>
  );
}
