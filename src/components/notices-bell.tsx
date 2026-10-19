"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const cacheKey = (orgId: string) => `notices-count:${orgId}`;
const CACHE_MS = 60_000;

function readCache(orgId: string): number | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(orgId));
    if (!raw) return null;
    const { at, count } = JSON.parse(raw) as { at: number; count: number };
    return Date.now() - at < CACHE_MS ? count : null;
  } catch {
    return null;
  }
}

/** Sino do cabeçalho: refaz a contagem de avisos a cada tela nova (com cache de 60 s para não sobrecarregar). */
/** `orgId` entra na chave do cache: quem troca de marmitaria ("ver como") não vê a contagem da outra. */
export function NoticesBell({ orgId }: { orgId: string }) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    // Na tela de Avisos a lista já é fresca: o número do sino acompanha, sem esperar o cache vencer.
    if (pathname.startsWith("/avisos")) {
      try {
        sessionStorage.removeItem(cacheKey(orgId));
      } catch {}
    }
    const cached = readCache(orgId);
    const load: Promise<number> =
      cached !== null
        ? Promise.resolve(cached)
        : fetch("/api/avisos/count")
            .then((r) => (r.ok ? r.json() : null))
            .then((j: { count?: number } | null) => {
              const next = j?.count ?? 0;
              try {
                sessionStorage.setItem(cacheKey(orgId), JSON.stringify({ at: Date.now(), count: next }));
              } catch {}
              return next;
            });
    load.then((n) => alive && setCount(n)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname, orgId]);

  const on = pathname.startsWith("/avisos");
  return (
    <Link
      href="/avisos"
      aria-label={count > 0 ? `Avisos (${count})` : "Avisos"}
      aria-current={on ? "page" : undefined}
      className={`relative flex size-11 shrink-0 items-center justify-center rounded-xl border text-white ${on ? "border-accent bg-white/30" : "border-white/25 bg-white/10"}`}
    >
      {count > 0 ? <span aria-hidden className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-bold leading-5 text-white">{count > 9 ? "9+" : count}</span> : null}
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2ZM10 20.5a2 2 0 0 0 4 0" />
      </svg>
    </Link>
  );
}
