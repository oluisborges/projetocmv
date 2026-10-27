import Image from "next/image";
import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { ActivityTracker } from "@/components/activity-tracker";
import { AdminAlertBanner } from "@/components/admin-alert-banner";
import { BottomNav } from "@/components/bottom-nav";
import { menuLocksFrom, type MenuLock } from "@/lib/menu-locks";
import { NoticesBell } from "@/components/notices-bell";
import { getActiveOrg, requireUser } from "@/lib/auth";
import { loadMenuAlerts } from "@/lib/menu/server/alerts";
import { activeUnit } from "@/lib/pricing-data";
import { createClient } from "@/lib/supabase/server";
import { exitViewAs, signOut } from "./actions";
import { SubmitButton } from "@/components/submit-button";

/** Menus travados (sempre visíveis): "Mês" até a primeira marmita; "Painel" até o primeiro preço de venda. */
async function menuLocks(orgId: string): Promise<{ mes: MenuLock | null; painel: MenuLock | null }> {
  const supabase = await createClient();
  const unit = await activeUnit(orgId);
  const [recipes, priced] = await Promise.all([
    supabase.from("recipes").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("kind", "marmita").eq("active", true),
    unit
      ? // Só conta preço de marmita ativa: arquivar a única marmita com preço esconde o Painel de novo.
        supabase.from("recipe_prices").select("recipe_id, recipes!inner(active)", { count: "exact", head: true }).eq("unit_id", unit.id).gt("current_price", 0).eq("recipes.active", true)
      : Promise.resolve({ count: 0, error: null }),
  ]);
  return menuLocksFrom(recipes, priced);
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const active = await getActiveOrg();
  const orgName = active?.orgName;
  // Equipe Shogun (fora do "ver como"): cardápios que pararam de importar aparecem em qualquer tela.
  // O aviso é um extra: se falhar (chave de serviço ausente, banco lento), a tela continua funcionando.
  const locks = active ? await menuLocks(active.orgId).catch(() => ({ mes: null, painel: null })) : { mes: null, painel: null };
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
            <Image src="/brand/logo-horizontal-escuro.svg" alt="Precificaí" width={635} height={128} priority className="h-6 w-auto shrink-0 self-start" />
            {orgName ? <span title={orgName} className="hidden truncate text-xs font-medium text-white/80 min-[360px]:block">{orgName}</span> : null}
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          {active ? (
            <>
              <NoticesBell orgId={active.orgId} />
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
      <BottomNav locks={locks} />
    </div>
  );
}
