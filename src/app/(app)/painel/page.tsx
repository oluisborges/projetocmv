import { BrandFooter } from "@/components/brand-footer";
import { PainelTabs } from "@/components/painel-tabs";
import { requireMember } from "@/lib/auth";
import { loadDashboard } from "@/lib/dashboard-data";
import { hasHistory } from "@/lib/history-data";
import { PainelView } from "./painel-view";

export const metadata = { title: "Painel" };

export default async function PainelPage() {
  const { orgId, canWrite } = await requireMember();
  const data = await loadDashboard(orgId, canWrite);
  const showHistory = data ? await hasHistory(data.ctx.unit.id) : false;

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Painel</h1>
        <p className="text-muted">Como está o seu negócio, em números simples.</p>
      </section>
      <PainelTabs active="resumo" showHistory={showHistory} />
      {data ? <PainelView data={data} /> : <p className="card p-4 text-sm">Sua marmitaria ainda não tem unidade cadastrada. Fale com o suporte do Precificaí.</p>}
      <BrandFooter />
    </>
  );
}
