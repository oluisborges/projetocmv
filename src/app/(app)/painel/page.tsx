import { BrandFooter } from "@/components/brand-footer";
import { InicioTabs } from "@/components/inicio-tabs";
import { PainelTabs } from "@/components/painel-tabs";
import { requireMember } from "@/lib/auth";
import { loadDashboard } from "@/lib/dashboard-data";
import { hasMenuConnection } from "@/lib/menu-data";
import { PainelView } from "./painel-view";

export const metadata = { title: "Visão Avançada" };

export default async function PainelPage() {
  const { orgId, canWrite } = await requireMember();
  const data = await loadDashboard(orgId, canWrite);

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Início</h1>
        <p className="text-muted">Como está o seu negócio, em números simples.</p>
      </section>
      <InicioTabs active="avancada" />
      <PainelTabs active="resumo" showCoupons={await hasMenuConnection(orgId)} />
      {data ? <PainelView data={data} /> : <p className="card p-4 text-sm">Sua marmitaria ainda não tem unidade cadastrada. Fale com o suporte do Precificaí.</p>}
      <BrandFooter />
    </>
  );
}
