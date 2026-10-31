"use client";

import Link, { useLinkStatus } from "next/link";

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse" : undefined}>{children}</span>;
}

/** Dentro do Estoque: o estoque de agora (onde se conta, compra e dá baixa) e o histórico dos meses (só leitura, vem do que foi lançado no estoque). */
export function EstoqueTabs({ active }: { active: "agora" | "historico" }) {
  const chip = (on: boolean) => `flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground"}`;
  return (
    <nav aria-label="Partes do estoque" className="flex gap-2">
      <Link href="/producao/estoque" aria-current={active === "agora" ? "page" : undefined} className={chip(active === "agora")}>
        <Pending>Estoque agora</Pending>
      </Link>
      <Link href="/producao/estoque/historico" aria-current={active === "historico" ? "page" : undefined} className={chip(active === "historico")}>
        <Pending>Histórico dos meses</Pending>
      </Link>
    </nav>
  );
}
