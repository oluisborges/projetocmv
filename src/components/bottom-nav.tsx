"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { LockIcon, LockTip } from "@/components/lock-tip";
import type { MenuLock } from "@/lib/menu-locks";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICONS = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5" {...stroke} />,
  chart: <path d="M4 20V10m5.5 10V4M15 20v-7m5.5 7V8" {...stroke} />,
  basket: <path d="M3 9h18l-1.6 9.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.8L3 9Zm4-.5 3-5m7 5-3-5M9.5 13v3m5-3v3" {...stroke} />,
  recipe: <path d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2.5 5h5m-5 4h5m-5 4h3" {...stroke} />,
  wallet: <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5ZM16 13.5h.01" {...stroke} />,
  factory: <path d="M3 20V9l5 3V9l5 3V6h3l1 14M3 20h18M7 16h2m3 0h2" {...stroke} />,
} as const;

type Item = { href: string; label: string; icon: keyof typeof ICONS; match: (p: string) => boolean; lock?: "producao" };

const ITEMS: Item[] = [
  { href: "/", label: "Início", icon: "home", match: (p) => p === "/" || p.startsWith("/painel") },
  { href: "/cardapio", label: "Cardápio", icon: "recipe", match: (p) => p.startsWith("/cardapio") },
  { href: "/ingredientes", label: "Ingredientes", icon: "basket", match: (p) => p.startsWith("/ingredientes") },
  { href: "/financeiro", label: "Financeiro", icon: "wallet", match: (p) => p.startsWith("/financeiro") },
  { href: "/producao", label: "Produção", icon: "factory", match: (p) => p.startsWith("/producao"), lock: "producao" },
];

/** Ícone + nome. Enquanto a página do toque carrega, o ícone pulsa e uma barra lima corre no topo do botão. */
function NavLabel({ label, icon, active }: { label: string; icon: keyof typeof ICONS; active: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending ? <span aria-hidden className="nav-loading absolute inset-x-0 top-0 h-1 bg-accent" /> : null}
      <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-primary text-primary-foreground" : ""} ${pending ? "animate-pulse" : ""}`}>
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          {ICONS[icon]}
        </svg>
      </span>
      <span className="text-xs leading-none">{label}</span>
      {pending ? <span className="sr-only"> carregando</span> : null}
    </>
  );
}

/**
 * Menu de baixo, sempre com todos os itens. Um item que ainda não pode ser usado fica com a letra clara e um cadeado;
 * ao tocar, aparece o que fazer para liberar (nunca é um botão que não responde).
 */
export function BottomNav({ locks }: { locks: { producao: MenuLock | null } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<"producao" | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const tip = open ? locks[open] : null;

  return (
    <>
      {tip ? (
        <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md">
          <LockTip message={tip.message} href={tip.href} cta={tip.cta} onClose={close} />
        </div>
      ) : null}
      <nav aria-label="Menu principal" className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(28_59_51/0.3)] backdrop-blur">
        <ul className="mx-auto flex max-w-3xl">
          {ITEMS.map((item) => {
            const active = item.match(pathname);
            const locked = item.lock && !active ? locks[item.lock] : null;
            return (
              <li key={item.href} className="flex-1">
                {locked ? (
                  <button
                    type="button"
                    aria-disabled="true"
                    aria-expanded={open === item.lock}
                    onClick={() => setOpen(open === item.lock ? null : (item.lock ?? null))}
                    className="relative flex h-16 w-full flex-col items-center justify-center gap-1 font-semibold text-muted/50"
                  >
                    <span className="relative flex h-7 w-12 items-center justify-center">
                      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                        {ICONS[item.icon]}
                      </svg>
                      <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-surface text-muted">
                        <LockIcon className="size-3" />
                      </span>
                    </span>
                    <span className="text-xs leading-none">{item.label}</span>
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex h-16 flex-col items-center justify-center gap-1 ${active ? "font-extrabold text-primary" : "font-semibold text-muted"}`}
                  >
                    <NavLabel label={item.label} icon={item.icon} active={active} />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
