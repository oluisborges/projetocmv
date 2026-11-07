"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { ICONS, ITEMS } from "@/components/bottom-nav";
import { LockIcon, LockTip } from "@/components/lock-tip";
import type { MenuLock } from "@/lib/menu-locks";

function SideLabel({ label, icon, lockBadge }: { label: string; icon: keyof typeof ICONS; lockBadge: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <svg viewBox="0 0 24 24" className={`size-5 shrink-0 ${pending ? "animate-pulse" : ""}`} aria-hidden>
        {ICONS[icon]}
      </svg>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {lockBadge ? <LockIcon className="size-3.5 shrink-0 text-muted" /> : null}
      {pending ? <span className="sr-only"> carregando</span> : null}
    </>
  );
}

/**
 * Menu lateral do desktop (do `lg` para cima), com os mesmos itens e o mesmo cadeado do menu de baixo do celular.
 * Um item travado mostra o que fazer para liberar, igual ao celular.
 */
export function SideNav({ locks, producaoOpen = false }: { locks: { producao: MenuLock | null }; producaoOpen?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<"producao" | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const tip = open ? locks[open] : null;
  const base = "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm";

  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-1 px-3 py-4">
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        const locked = item.lock && !active ? locks[item.lock] : null;
        const passThrough = Boolean(locked && item.lock === "producao" && producaoOpen);
        if (locked && !passThrough) {
          return (
            <button key={item.href} type="button" aria-disabled="true" aria-expanded={open === item.lock} onClick={() => setOpen(open === item.lock ? null : (item.lock ?? null))} className={`${base} font-semibold text-muted/60`}>
              <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden>
                {ICONS[item.icon]}
              </svg>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <LockIcon className="size-3.5 shrink-0" />
            </button>
          );
        }
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`${base} ${active ? "bg-primary/10 font-extrabold text-primary" : "font-semibold text-muted hover:bg-black/5"}`}>
            <SideLabel label={item.label} icon={item.icon} lockBadge={passThrough} />
          </Link>
        );
      })}
      {tip ? (
        <div className="mt-2">
          <LockTip message={tip.message} href={tip.href} cta={tip.cta} onClose={close} />
        </div>
      ) : null}
    </nav>
  );
}
