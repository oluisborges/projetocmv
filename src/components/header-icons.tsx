"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const base = "relative flex size-11 shrink-0 items-center justify-center rounded-xl border text-white";
const idle = "border-white/25 bg-white/10";
const current = "border-accent bg-white/30";

/** Engrenagem do cabeçalho (ao lado do sino): leva às configurações da conta. */
export function SettingsLink() {
  const on = usePathname().startsWith("/configuracoes");
  return (
    <Link href="/configuracoes" aria-label="Configurações" aria-current={on ? "page" : undefined} className={`${base} ${on ? current : idle}`}>
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.4 13.5a7.5 7.5 0 0 0 0-3l1.7-1.3-1.7-3-2 .8a7.5 7.5 0 0 0-2.6-1.5L14.5 3h-3l-.3 2.5A7.5 7.5 0 0 0 8.6 7l-2-.8-1.7 3 1.7 1.3a7.5 7.5 0 0 0 0 3l-1.7 1.3 1.7 3 2-.8a7.5 7.5 0 0 0 2.6 1.5l.3 2.5h3l.3-2.5a7.5 7.5 0 0 0 2.6-1.5l2 .8 1.7-3-1.7-1.3Z" />
      </svg>
    </Link>
  );
}

/** Só para a equipe Shogun: entrada do Painel Shogun, com o número de cardápios parados. */
export function AdminLink({ alertCount = 0 }: { alertCount?: number }) {
  const on = usePathname().startsWith("/admin");
  return (
    <Link href="/admin" aria-label={alertCount > 0 ? `Painel Shogun (${alertCount} ${alertCount === 1 ? "alerta" : "alertas"})` : "Painel Shogun"} aria-current={on ? "page" : undefined} className={`${base} ${on ? current : idle}`}>
      {alertCount > 0 ? <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-bold leading-5 text-white">{alertCount}</span> : null}
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 8h16v11H4zM9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M4 13h16" />
      </svg>
    </Link>
  );
}
