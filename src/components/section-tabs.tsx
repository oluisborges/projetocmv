"use client";

import Link, { useLinkStatus } from "next/link";
import { useCallback, useState } from "react";
import { LockIcon, LockTip } from "@/components/lock-tip";

export type TabItem = {
  key: string;
  href: string;
  label: string;
  /** Aba travada: aparece com letra clara e cadeado; ao tocar, mostra por que e o que fazer. */
  lock?: { message: string; href?: string; cta?: string };
};

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse" : undefined}>{children}</span>;
}

/** Abas de uma seção (mesmo visual de todas as outras). Aba travada continua visível e explica como liberar. */
export function SectionTabs({ ariaLabel, active, items }: { ariaLabel: string; active: string; items: TabItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const base = "flex h-11 flex-1 items-center justify-center gap-1 rounded-lg px-1 text-[13px] font-semibold sm:text-sm";
  const tip = items.find((i) => i.key === open)?.lock;

  return (
    <div className="flex flex-col gap-2">
      <nav aria-label={ariaLabel} className="flex gap-1 rounded-xl bg-border/60 p-1">
        {items.map((item) =>
          item.lock ? (
            <button key={item.key} type="button" aria-disabled="true" aria-expanded={open === item.key} onClick={() => setOpen(open === item.key ? null : item.key)} className={`${base} text-muted/60`}>
              <LockIcon />
              {item.label}
            </button>
          ) : (
            <Link key={item.key} href={item.href} aria-current={active === item.key ? "page" : undefined} className={`${base} ${active === item.key ? "bg-surface shadow-sm" : "text-muted"}`}>
              <Pending>{item.label}</Pending>
            </Link>
          ),
        )}
      </nav>
      {tip ? <LockTip message={tip.message} href={tip.href} cta={tip.cta} onClose={close} /> : null}
    </div>
  );
}
