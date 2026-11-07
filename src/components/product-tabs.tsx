"use client";

import Link, { useLinkStatus } from "next/link";

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse" : undefined}>{children}</span>;
}

export type ProductTab = "itens" | "ficha" | "nutricional" | "preco";

/** Dentro de um produto: os itens (receita e custo), a ficha de montagem para baixar, a tabela nutricional e o preço de venda. */
export function ProductTabs({ id, active }: { id: string; active: ProductTab }) {
  const item = (on: boolean) => `flex min-h-11 flex-1 items-center justify-center rounded-lg px-1 text-center text-[13px] font-semibold leading-tight ${on ? "bg-surface shadow-sm" : "text-muted"}`;
  const tabs: { key: ProductTab; href: string; label: string }[] = [
    { key: "itens", href: `/cardapio/${id}`, label: "Itens" },
    { key: "ficha", href: `/cardapio/${id}/ficha`, label: "Ficha de Montagem" },
    { key: "nutricional", href: `/cardapio/${id}/nutricional`, label: "Tabela Nutricional" },
    { key: "preco", href: `/cardapio/${id}/preco`, label: "Preço de Venda" },
  ];
  return (
    <nav aria-label="Partes do produto" className="flex gap-1 rounded-xl bg-border/60 p-1">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} aria-current={active === t.key ? "page" : undefined} className={item(active === t.key)}>
          <Pending>{t.label}</Pending>
        </Link>
      ))}
    </nav>
  );
}
