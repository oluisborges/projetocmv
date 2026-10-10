import "server-only";
import { after } from "next/server";
import { getActiveOrg } from "@/lib/auth";
import { loadDashboard } from "@/lib/dashboard-data";

/**
 * Chame depois de uma mudança que altera custos, preços ou contas. Depois que a resposta já foi enviada
 * (a tela não espera), o app olha como o negócio ficou e guarda no histórico do mês se algo mudou.
 */
export function recordSnapshot(): void {
  after(async () => {
    try {
      const org = await getActiveOrg();
      if (org?.canWrite) await loadDashboard(org.orgId, true); // gravar a foto é efeito do carregamento
    } catch {
      /* histórico é bônus: nunca atrapalha a ação do usuário */
    }
  });
}
