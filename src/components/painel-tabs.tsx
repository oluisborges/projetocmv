import Link from "next/link";

/** Alternância dentro do Painel: o retrato de hoje ou o histórico mês a mês. */
export function PainelTabs({ active }: { active: "resumo" | "historico" }) {
  const item = (on: boolean) => `flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold ${on ? "bg-surface shadow-sm" : "text-muted"}`;
  return (
    <nav aria-label="Painel" className="flex gap-1 rounded-xl bg-border/60 p-1">
      <Link href="/painel" aria-current={active === "resumo" ? "page" : undefined} className={item(active === "resumo")}>
        Resumo
      </Link>
      <Link href="/painel/historico" aria-current={active === "historico" ? "page" : undefined} className={item(active === "historico")}>
        Histórico
      </Link>
    </nav>
  );
}
