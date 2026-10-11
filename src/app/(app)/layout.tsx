import Image from "next/image";
import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
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
      <header className={`sticky z-10 flex h-16 items-center justify-between gap-3 bg-primary px-4 text-primary-foreground shadow-md ${active?.viewingAs ? "top-[3.75rem]" : "top-0"}`}>
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
            <Image src="/brand/helmet.png" alt="Grupo Shogun" width={149} height={160} priority className="h-8 w-auto" />
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-[family-name:var(--font-heading)] text-base font-extrabold">{orgName ?? "Shogun Precificação"}</span>
            {orgName ? <span className="text-xs font-medium text-accent">Shogun Precificação</span> : null}
          </span>
        </Link>
        <AccountMenu isAdmin={session.isPlatformAdmin} signOutAction={signOut} />
      </header>
      <main className="flex flex-1 flex-col gap-6 px-4 py-6 pb-24">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
