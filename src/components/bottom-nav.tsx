"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICONS = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5" {...stroke} />,
  chart: <path d="M4 20V10m5.5 10V4M15 20v-7m5.5 7V8" {...stroke} />,
  basket: <path d="M3 9h18l-1.6 9.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.8L3 9Zm4-.5 3-5m7 5-3-5M9.5 13v3m5-3v3" {...stroke} />,
  recipe: <path d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2.5 5h5m-5 4h5m-5 4h3" {...stroke} />,
  tag: <path d="M3.5 12.4V4.5a1 1 0 0 1 1-1h7.9a1 1 0 0 1 .7.3l7.4 7.4a1 1 0 0 1 0 1.4l-7.9 7.9a1 1 0 0 1-1.4 0l-7.4-7.4a1 1 0 0 1-.3-.7ZM8 8h.01" {...stroke} />,
  wallet: <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5ZM16 13.5h.01" {...stroke} />,
} as const;

const ITEMS: { href: string; label: string; icon: keyof typeof ICONS; match: (p: string) => boolean }[] = [
  { href: "/", label: "Início", icon: "home", match: (p) => p === "/" },
  { href: "/painel", label: "Painel", icon: "chart", match: (p) => p.startsWith("/painel") },
  { href: "/insumos", label: "Insumos", icon: "basket", match: (p) => p.startsWith("/insumos") },
  { href: "/fichas", label: "Fichas", icon: "recipe", match: (p) => p.startsWith("/fichas") },
  { href: "/precificacao", label: "Preços", icon: "tag", match: (p) => p.startsWith("/precificacao") },
  { href: "/custos", label: "Custos", icon: "wallet", match: (p) => p.startsWith("/custos") },
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
      <span className="text-[11px] leading-none">{label}</span>
      {pending ? <span className="sr-only"> carregando</span> : null}
    </>
  );
}

/** Navegação inferior fixa: no celular o polegar alcança tudo. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(28_59_51/0.3)] backdrop-blur">
      <ul className="mx-auto flex max-w-3xl">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-1 ${active ? "font-extrabold text-primary" : "font-semibold text-muted"}`}
              >
                <NavLabel label={item.label} icon={item.icon} active={active} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
