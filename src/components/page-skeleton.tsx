/** Esqueleto de carregamento: mesma "forma" das telas (título, abas opcionais e cartões), em cinza pulsando. */
export function PageSkeleton({ tabs = false }: { tabs?: boolean }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-5">
      <span className="sr-only">Carregando…</span>
      <div className="flex flex-col gap-2">
        <div className="h-8 w-2/5 animate-pulse rounded-lg bg-border" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-border" />
      </div>
      {tabs ? <div className="h-[3.25rem] animate-pulse rounded-xl bg-border/70" /> : null}
      <div className="h-36 animate-pulse rounded-2xl bg-border" />
      <div className="h-20 animate-pulse rounded-2xl bg-border/80" />
      <div className="h-20 animate-pulse rounded-2xl bg-border/80" />
      <div className="h-20 animate-pulse rounded-2xl bg-border/60" />
    </div>
  );
}
