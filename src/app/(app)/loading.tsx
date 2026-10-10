/** Aparece na hora ao trocar de menu, enquanto a página nova carrega no servidor. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">Carregando…</span>
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-border" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-border" />
      <div className="h-24 animate-pulse rounded-xl bg-border" />
      <div className="h-24 animate-pulse rounded-xl bg-border" />
      <div className="h-24 animate-pulse rounded-xl bg-border" />
    </div>
  );
}
