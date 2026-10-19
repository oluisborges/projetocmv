"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICONS = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5" {...stroke} />,
  chart: <path d="M4 20V10m5.5 10V4M15 20v-7m5.5 7V8" {...stroke} />,
  basket: <path d="M3 9h18l-1.6 9.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.8L3 9Zm4-.5 3-5m7 5-3-5M9.5 13v3m5-3v3" {...stroke} />,
  recipe: <path d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2.5 5h5m-5 4h5m-5 4h3" {...stroke} />,
  calendar: <path d="M5 5.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1ZM4 10h16M8 3.5v4m8-4v4" {...stroke} />,
} as const;

type Item = { href: string; label: string; icon: keyof typeof ICONS; match: (p: string) => boolean; key?: "mes" | "painel" };

const ITEMS: Item[] = [
  { href: "/", label: "Início", icon: "home", match: (p) => p === "/" },
  { href: "/marmitas", label: "Marmitas", icon: "recipe", match: (p) => p.startsWith("/marmitas") },
  { href: "/insumos", label: "Insumos", icon: "basket", match: (p) => p.startsWith("/insumos") },
  { href: "/mes", label: "Mês", icon: "calendar", match: (p) => p.startsWith("/mes"), key: "mes" },
  { href: "/painel", label: "Painel", icon: "chart", match: (p) => p.startsWith("/painel"), key: "painel" },
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

/** Navegação inferior fixa: no celular o polegar alcança tudo. Mês e Painel só aparecem quando já fazem sentido (o item da tela atual nunca some). */
export function BottomNav({ show }: { show: { mes: boolean; painel: boolean } }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Menu principal" className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(28_59_51/0.3)] backdrop-blur">
      <ul className="mx-auto flex max-w-3xl">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          if (item.key && !show[item.key] && !active) return null;
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
