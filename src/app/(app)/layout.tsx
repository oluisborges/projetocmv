import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { requireUser } from "@/lib/auth";
import { signOut } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const orgName = session.memberships[0]?.org.name;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link href="/" className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-[family-name:var(--font-heading)] text-base font-extrabold">
            {orgName ?? "Shogun Precificação"}
          </span>
          {orgName ? <span className="text-xs text-muted">Shogun Precificação</span> : null}
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
      <main className="flex flex-1 flex-col gap-6 px-4 py-6 pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
