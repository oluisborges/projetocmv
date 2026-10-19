"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/** Cadeado pequeno (item travado). */
export function LockIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/**
 * Aviso curto de por que um menu está travado e o que fazer para liberar. Fecha tocando fora, com Esc ou no X.
 * `className` posiciona (embaixo de uma aba ou em cima do menu de baixo).
 */
export function LockTip({ message, href, cta, onClose, className = "" }: { message: string; href?: string; cta?: string; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: Event) => e.target instanceof Node && !ref.current?.contains(e.target) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // Atrasa um tick: o toque que abriu o aviso não pode fechá-lo.
    const t = setTimeout(() => document.addEventListener("pointerdown", away), 0);
    document.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  return (
    <div ref={ref} role="status" className={`flex items-start gap-3 rounded-xl bg-foreground p-3 text-sm leading-snug text-background shadow-xl ${className}`}>
      <LockIcon className="mt-0.5 size-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p>{message}</p>
        {href && cta ? (
          <Link href={href} onClick={onClose} className="inline-flex h-11 items-center justify-center self-start rounded-lg bg-accent px-4 font-bold text-accent-foreground">
            {cta}
          </Link>
        ) : null}
      </div>
      <button type="button" onClick={onClose} aria-label="Fechar aviso" className="-m-2 flex size-11 shrink-0 items-center justify-center text-lg text-background/80">
        ×
      </button>
    </div>
  );
}
