import Image from "next/image";
import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { getActiveOrg, requireUser } from "@/lib/auth";
import { exitViewAs, signOut } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const active = await getActiveOrg();
  const orgName = active?.orgName;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      {active?.viewingAs ? (
        <div role="status" className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-warning px-4 py-2 text-sm text-white">
          <p className="min-w-0 leading-tight">
            <span className="block text-xs font-semibold uppercase tracking-wider opacity-90">Visualizando como</span>
            <span className="block truncate text-base font-extrabold">{active.orgName}</span>
          </p>
          <form action={exitViewAs}>
            <button type="submit" className="h-11 shrink-0 rounded-xl bg-white px-4 text-sm font-bold text-warning">
              Sair
            </button>
          </form>
        </div>
      ) : null}
      <header className={`sticky z-10 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur ${active?.viewingAs ? "top-[3.75rem]" : "top-0"}`}>
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Image src="/brand/helmet.png" alt="Grupo Shogun" width={149} height={160} priority className="h-9 w-auto shrink-0" />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-[family-name:var(--font-heading)] text-base font-extrabold">{orgName ?? "Shogun Precificação"}</span>
            {orgName ? <span className="text-xs text-muted">Shogun Precificação</span> : null}
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          {session.isPlatformAdmin ? (
            <Link href="/admin" className="rounded-lg px-3 py-2 text-sm font-semibold text-primary">
              Admin
            </Link>
          ) : null}
          <form action={signOut}>
            <button type="submit" className="h-10 rounded-lg border border-border bg-surface px-3 text-sm font-medium">
              Sair
            </button>
          </form>
        </nav>
      </header>
      <main className="flex flex-1 flex-col gap-6 px-4 py-6 pb-24">
        {children}
        <footer className="mt-4 flex flex-col items-center gap-1.5 pt-2 text-center">
          <Image src="/brand/logo-stacked.png" alt="Grupo Shogun" width={560} height={359} className="h-14 w-auto opacity-90" />
          <p className="text-xs text-muted">Shogun Precificação · uma ferramenta do Grupo Shogun</p>
        </footer>
      </main>
      <BottomNav />
    </div>
  );
}
