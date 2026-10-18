import { getActiveOrg } from "@/lib/auth";
import { loadNotices } from "@/lib/notices-data";

/** Quantos avisos a marmitaria tem agora (para a bolinha do sino). Sem login ou sem marmitaria, 401. */
export async function GET() {
  const active = await getActiveOrg();
  if (!active) return Response.json({ count: 0 }, { status: 401 });
  const notices = await loadNotices(active.orgId, false);
  return Response.json({ count: notices.length }, { headers: { "Cache-Control": "private, max-age=60" } });
}
