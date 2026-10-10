"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Início", match: (p: string) => p === "/" },
  { href: "/painel", label: "Painel", match: (p: string) => p.startsWith("/painel") },
  { href: "/insumos", label: "Insumos", match: (p: string) => p.startsWith("/insumos") },
  { href: "/fichas", label: "Fichas", match: (p: string) => p.startsWith("/fichas") },
  { href: "/precificacao", label: "Preços", match: (p: string) => p.startsWith("/precificacao") },
  { href: "/custos", label: "Custos", match: (p: string) => p.startsWith("/custos") },
];

/** Enquanto a página do toque carrega, o botão mostra uma barra animada no topo e o texto "pulsa". */
function NavLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending ? <span aria-hidden className="nav-loading absolute inset-x-0 top-0 h-1 bg-accent" /> : null}
      <span className={pending ? "animate-pulse" : undefined}>{label}</span>
      {pending ? <span className="sr-only"> carregando</span> : null}
    </>
  );
}

/** Navegação inferior fixa: no celular o polegar alcança tudo. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-3xl">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-14 items-center justify-center text-sm ${active ? "bg-primary/10 font-extrabold text-primary" : "font-semibold text-muted"}`}
              >
                {active ? <span aria-hidden className="absolute inset-x-5 top-0 h-1 rounded-b-full bg-primary" /> : null}
                <NavLabel label={item.label} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
