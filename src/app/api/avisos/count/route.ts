import { getActiveOrg, getSession } from "@/lib/auth";
import { loadNotices } from "@/lib/notices-data";

/** Quantos avisos a marmitaria tem agora (para a bolinha do sino). Sem login, sem marmitaria ou com senha provisória, 401. */
export async function GET() {
  const session = await getSession();
  if (!session || session.mustChangePassword) return Response.json({ count: 0 }, { status: 401 });
  const active = await getActiveOrg();
  if (!active) return Response.json({ count: 0 }, { status: 401 });
  const notices = await loadNotices(active.orgId, false);
  // Sem cache no navegador: a contagem depende da marmitaria (o admin troca de "ver como"); o sino já guarda 60 s por organização.
  return Response.json({ count: notices.length }, { headers: { "Cache-Control": "private, no-store" } });
}
