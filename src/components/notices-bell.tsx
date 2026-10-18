"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Sino do cabeçalho: busca a contagem de avisos uma vez, depois que a página carregou. */
export function NoticesBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/avisos/count")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { count?: number } | null) => {
        if (alive) setCount(j?.count ?? 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Link
      href="/avisos"
      aria-label={count > 0 ? `Avisos (${count})` : "Avisos"}
      className="relative flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white"
    >
      {count > 0 ? <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold leading-5 text-white">{count > 9 ? "9+" : count}</span> : null}
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2ZM10 20.5a2 2 0 0 0 4 0" />
      </svg>
    </Link>
  );
}
