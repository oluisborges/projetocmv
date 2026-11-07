"use client";

import Link, { useLinkStatus } from "next/link";

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse" : undefined}>{children}</span>;
}

/** Dentro do Estoque: o estoque de agora (onde se conta, compra e dá baixa), os movimentos (tudo o que aconteceu, com filtros) e o histórico dos meses (CMV real). */
export function EstoqueTabs({ active }: { active: "agora" | "movimentos" | "historico" }) {
  const chip = (on: boolean) => `flex h-11 shrink-0 items-center rounded-full border px-3.5 text-sm font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground"}`;
  const items = [
    { key: "agora", href: "/producao/estoque", label: "Estoque agora" },
    { key: "movimentos", href: "/producao/estoque/movimentos", label: "Movimentos" },
    { key: "historico", href: "/producao/estoque/historico", label: "Histórico" },
  ] as const;
  return (
    <nav aria-label="Partes do estoque" className="-mx-4 flex gap-2 no-scrollbar overflow-x-auto px-4">
      {items.map((i) => (
        <Link key={i.key} href={i.href} aria-current={active === i.key ? "page" : undefined} className={chip(active === i.key)}>
          <Pending>{i.label}</Pending>
        </Link>
      ))}
    </nav>
  );
}
