import { PainelTabs } from "@/components/painel-tabs";
import { requireMember } from "@/lib/auth";
import { loadDashboard } from "@/lib/dashboard-data";
import { PainelView } from "./painel-view";

export const metadata = { title: "Painel" };

export default async function PainelPage() {
  const { orgId, canWrite } = await requireMember();
  const data = await loadDashboard(orgId, canWrite);

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Painel</h1>
        <p className="text-muted">Como está o seu negócio, em números simples.</p>
      </section>
      <PainelTabs active="resumo" />
      {data ? <PainelView data={data} /> : <p className="rounded-xl border border-border bg-surface p-4 text-sm">Sua marmitaria ainda não tem unidade cadastrada. Fale com a Shogun.</p>}
    </>
  );
}
