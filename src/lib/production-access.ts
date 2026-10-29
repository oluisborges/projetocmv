import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { PRODUCAO_IN_DEVELOPMENT } from "@/lib/menu-locks";

/**
 * Produção em desenvolvimento: só a equipe Shogun entra (pelo menu, por link ou por chamada direta).
 * Chamar no começo de cada página e de cada ação do menu Produção. Quem não é admin volta para o Início.
 */
export async function requireProductionAccess(): Promise<void> {
  if (!PRODUCAO_IN_DEVELOPMENT) return;
  const session = await requireUser();
  if (!session.isPlatformAdmin) redirect("/");
}
