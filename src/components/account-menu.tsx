"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { SubmitButton } from "@/components/submit-button";

/** Menu da conta no cabeçalho: tira o "Sair" (botão de risco) do lugar nobre e reúne o que é de uso raro. */
export function AccountMenu({ isAdmin, signOutAction }: { isAdmin: boolean; signOutAction: () => Promise<void> }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = (e: Event) => {
      if (ref.current?.open && e.target instanceof Node && !ref.current.contains(e.target)) ref.current.open = false;
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && ref.current && (ref.current.open = false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const item = "flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-foreground active:bg-primary/10";
  return (
    <details ref={ref} className="relative">
      <summary
        aria-label="Menu da conta"
        className="flex size-11 cursor-pointer list-none items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white [&::-webkit-details-marker]:hidden"
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
        </svg>
      </summary>
      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 flex w-60 flex-col gap-0.5 card p-2 text-foreground shadow-xl">
        {isAdmin ? (
          <Link href="/admin" className={`${item} font-semibold text-primary`}>
            Painel Shogun
          </Link>
        ) : null}
        <Link href="/conta/senha" className={item}>
          Trocar minha senha
        </Link>
        <Link href="/privacidade" className={item}>
          Como seus dados são tratados
        </Link>
        <form action={signOutAction} className="border-t border-border pt-1">
          <SubmitButton pendingLabel="Saindo…" className={`${item} w-full text-danger`}>
            Sair da conta
          </SubmitButton>
        </form>
      </div>
    </details>
  );
}
