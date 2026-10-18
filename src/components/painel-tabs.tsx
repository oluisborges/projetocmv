"use client";

import Link, { useLinkStatus } from "next/link";

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse" : undefined}>{children}</span>;
}

/** Alternância dentro do Painel: o retrato de hoje, a análise das marmitas ou os cupons (só com cardápio conectado). */
export function PainelTabs({
  active,
  showCoupons = false,
}: {
  active: "resumo" | "cardapio" | "cupons";
  showCoupons?: boolean;
}) {
  const item = (on: boolean) => `flex h-11 flex-1 items-center justify-center rounded-lg px-1 text-sm font-semibold ${on ? "bg-surface shadow-sm" : "text-muted"}`;
  return (
    <nav aria-label="Painel" className="flex gap-1 rounded-xl bg-border/60 p-1">
      <Link href="/painel" aria-current={active === "resumo" ? "page" : undefined} className={item(active === "resumo")}>
        <Pending>Resumo</Pending>
      </Link>
      <Link href="/painel/cardapio" aria-current={active === "cardapio" ? "page" : undefined} className={item(active === "cardapio")}>
        <Pending>Cardápio</Pending>
      </Link>
      {showCoupons ? (
        <Link href="/painel/cupons" aria-current={active === "cupons" ? "page" : undefined} className={item(active === "cupons")}>
          <Pending>Cupons</Pending>
        </Link>
      ) : null}
    </nav>
  );
}
