import Image from "next/image";
import Link from "next/link";
import { AdminLink, SettingsLink } from "@/components/header-icons";
import { ActivityTracker } from "@/components/activity-tracker";
import { AdminAlertBanner } from "@/components/admin-alert-banner";
import { BottomNav } from "@/components/bottom-nav";
import { MainFrame } from "@/components/main-frame";
import { SideNav } from "@/components/side-nav";
import { pickAnnouncement } from "@/lib/announcements";
import { AnnouncementModal } from "./announcement-modal";
import { devLockApplies, menuLocksFrom, PRODUCAO_DEV_LOCK, type MenuLock } from "@/lib/menu-locks";
import { NoticesBell } from "@/components/notices-bell";
import { getActiveOrg, requireUser } from "@/lib/auth";
import { loadMenuAlerts } from "@/lib/menu/server/alerts";
import { createClient } from "@/lib/supabase/server";
import { exitViewAs } from "./actions";
import { SubmitButton } from "@/components/submit-button";

/** Menus travados (sempre visíveis): "Produção" até a primeira marmita. */
async function menuLocks(orgId: string): Promise<{ producao: MenuLock | null }> {
  const supabase = await createClient();
  const recipes = await supabase.from("recipes").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("kind", "marmita").eq("active", true);
  return menuLocksFrom(recipes);
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const active = await getActiveOrg();
  const orgName = active?.orgName;
  // Equipe Shogun (fora do "ver como"): cardápios que pararam de importar aparecem em qualquer tela.
  // O aviso é um extra: se falhar (chave de serviço ausente, banco lento), a tela continua funcionando.
  const locks = devLockApplies(session.isPlatformAdmin)
    ? { producao: PRODUCAO_DEV_LOCK }
    : active
      ? await menuLocks(active.orgId).catch(() => ({ producao: null }))
      : { producao: null };
  // Aviso de novidades: o que está no ar e que esta PESSOA (não o cliente que o admin está vendo) ainda não dispensou.
  const supabaseForNotices = await createClient();
  const { data: dismissed } = await supabaseForNotices.from("notice_dismissals").select("notice_id").eq("user_id", session.userId);
  const notice = pickAnnouncement({ dismissedIds: (dismissed ?? []).map((d) => d.notice_id as string), previewAllowed: session.isPlatformAdmin });
  const alerts = session.isPlatformAdmin && !active?.viewingAs ? await loadMenuAlerts().catch(() => []) : [];

  const bannerH = active?.viewingAs ? "2.75rem" : "0rem";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col lg:max-w-none" style={{ "--sticky-top": active?.viewingAs ? "6.75rem" : "4rem", "--banner-h": bannerH } as React.CSSProperties}>
      {active?.viewingAs ? (
        <div role="status" className="sticky top-0 z-30 flex h-11 items-center justify-between gap-3 bg-warning px-4 text-sm text-white">
          <p className="min-w-0 truncate leading-tight">
            <span className="text-[11px] font-semibold uppercase tracking-wider opacity-90">Visualizando como </span>
            <span className="font-extrabold">{active.orgName}</span>
          </p>
          <form action={exitViewAs}>
            <SubmitButton pendingLabel="Saindo…" className="relative h-9 shrink-0 rounded-lg bg-white px-3 text-sm font-bold text-warning before:absolute before:-inset-1 before:content-['']">
              Sair
            </SubmitButton>
          </form>
        </div>
      ) : null}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Menu lateral: só no desktop. No celular o menu fica embaixo. */}
        <aside className="hidden shrink-0 border-r border-border bg-surface lg:sticky lg:top-[var(--banner-h)] lg:flex lg:h-[calc(100dvh-var(--banner-h))] lg:w-60 lg:flex-col">
          <Link href="/" className="flex h-16 shrink-0 items-center px-5">
            <Image src="/brand/logo-horizontal.svg" alt="Precificaí" width={635} height={128} priority className="h-6 w-auto" />
          </Link>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SideNav locks={locks} producaoOpen={session.isPlatformAdmin} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-[var(--banner-h)] z-10 flex h-16 items-center justify-between gap-3 bg-brand-deep px-4 text-primary-foreground shadow-md lg:px-8">
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />
            <Link href="/" className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex min-w-0 flex-col gap-1 leading-none">
                <Image src="/brand/logo-horizontal-escuro.svg" alt="Precificaí" width={635} height={128} priority className="h-6 w-auto shrink-0 self-start lg:hidden" />
                {orgName ? <span title={orgName} className="hidden truncate text-xs font-medium text-white/80 min-[360px]:block lg:text-base lg:font-bold lg:text-white">{orgName}</span> : null}
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-1.5">
              {active ? <NoticesBell orgId={active.orgId} /> : null}
              {/* Em "ver como", a barra é a da marmitaria: sem configurações nem atalhos de admin; a saída é o botão da faixa laranja. */}
              {active?.viewingAs ? null : (
                <>
                  {session.isStaff ? <AdminLink alertCount={alerts.length} /> : null}
                  <SettingsLink />
                </>
              )}
            </div>
          </header>
          <MainFrame>
            <AdminAlertBanner alerts={alerts} />
            {children}
          </MainFrame>
        </div>
      </div>
      <ActivityTracker />
      {notice ? <AnnouncementModal announcement={notice.announcement} preview={notice.preview} /> : null}
      <BottomNav locks={locks} producaoOpen={session.isPlatformAdmin} />
    </div>
  );
}
