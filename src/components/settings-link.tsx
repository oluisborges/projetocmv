"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Engrenagem do cabeçalho (Ajustes). Fica com fundo mais forte quando a pessoa está em Ajustes. */
export function SettingsLink() {
  const on = usePathname().startsWith("/ajustes");
  return (
    <Link
      href="/ajustes"
      aria-label="Ajustes"
      aria-current={on ? "page" : undefined}
      className={`flex size-11 shrink-0 items-center justify-center rounded-xl border text-white ${on ? "border-accent bg-white/30" : "border-white/25 bg-white/10"}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5v2.2m0 12.6v2.2M3.5 12h2.2m12.6 0h2.2M6 6l1.6 1.6m8.8 8.8L18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
      </svg>
    </Link>
  );
}
