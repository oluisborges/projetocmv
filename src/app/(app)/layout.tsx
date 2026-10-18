import Image from "next/image";
import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { ActivityTracker } from "@/components/activity-tracker";
import { AdminAlertBanner } from "@/components/admin-alert-banner";
import { BottomNav } from "@/components/bottom-nav";
import { GlobalSearch } from "@/components/global-search";
import { NoticesBell } from "@/components/notices-bell";
import { getActiveOrg, requireUser } from "@/lib/auth";
import { loadMenuAlerts } from "@/lib/menu/server/alerts";
import { activeUnit } from "@/lib/pricing-data";
import { createClient } from "@/lib/supabase/server";
import { exitViewAs, signOut } from "./actions";
import { SubmitButton } from "@/components/submit-button";

/** Menus no momento certo: "Mês" depois da primeira marmita; "Painel" depois do primeiro preço de venda. */
async function menuVisibility(orgId: string): Promise<{ mes: boolean; painel: boolean }> {
  const supabase = await createClient();
  const unit = await activeUnit(orgId);
  const [recipes, priced] = await Promise.all([
    supabase.from("recipes").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("active", true),
    unit ? supabase.from("recipe_prices").select("recipe_id", { count: "exact", head: true }).eq("unit_id", unit.id).gt("current_price", 0) : Promise.resolve({ count: 0 }),
  ]);
  return { mes: (recipes.count ?? 0) > 0, painel: (priced.count ?? 0) > 0 };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const active = await getActiveOrg();
  const orgName = active?.orgName;
  // Equipe Shogun (fora do "ver como"): cardápios que pararam de importar aparecem em qualquer tela.
  // O aviso é um extra: se falhar (chave de serviço ausente, banco lento), a tela continua funcionando.
  const show = active ? await menuVisibility(active.orgId).catch(() => ({ mes: true, painel: true })) : { mes: true, painel: true };
  const alerts = session.isPlatformAdmin && !active?.viewingAs ? await loadMenuAlerts().catch(() => []) : [];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col" style={{ "--sticky-top": active?.viewingAs ? "7.75rem" : "4rem" } as React.CSSProperties}>
      {active?.viewingAs ? (
        <div role="status" className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-warning px-4 py-2 text-sm text-white">
          <p className="min-w-0 leading-tight">
            <span className="block text-xs font-semibold uppercase tracking-wider opacity-90">Visualizando como</span>
            <span className="block truncate text-base font-extrabold">{active.orgName}</span>
          </p>
          <form action={exitViewAs}>
            <SubmitButton pendingLabel="Saindo…" className="h-11 shrink-0 rounded-xl bg-white px-4 text-sm font-bold text-warning">
              Sair
            </SubmitButton>
          </form>
        </div>
      ) : null}
      <header className={`sticky z-10 flex h-16 items-center justify-between gap-3 bg-brand-deep px-4 text-primary-foreground shadow-md ${active?.viewingAs ? "top-[3.75rem]" : "top-0"}`}>
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex min-w-0 flex-col gap-1 leading-none">
            <Image src="/brand/logo-horizontal-escuro.svg" alt="Precificaí" width={635} height={128} priority className="h-6 w-auto self-start" />
            {orgName ? <span className="truncate text-xs font-medium text-white/80">{orgName}</span> : null}
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          {active ? (
            <>
              <GlobalSearch />
              <NoticesBell />
              <Link href="/ajustes" aria-label="Ajustes" className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white">
                <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 3.5v2.2m0 12.6v2.2M3.5 12h2.2m12.6 0h2.2M6 6l1.6 1.6m8.8 8.8L18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
                </svg>
              </Link>
            </>
          ) : null}
        {/* Em "ver como", a barra é a da marmitaria: sem menu de conta nem atalhos de admin; a saída é o botão da faixa laranja. */}
        {active?.viewingAs ? null : <AccountMenu isAdmin={session.isPlatformAdmin} alertCount={alerts.length} signOutAction={signOut} />}
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-6 px-4 py-6 pb-24">
        <AdminAlertBanner alerts={alerts} />
        {children}
      </main>
      <ActivityTracker />
      <BottomNav show={show} />
    </div>
  );
}
