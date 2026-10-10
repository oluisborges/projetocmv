import { requireMember } from "@/lib/auth";
import { loadDashboard } from "@/lib/dashboard-data";
import { currentMonthStart, monthLabel } from "@/lib/month-view";
import { shareCardImage } from "@/lib/share-card";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { orgId, orgName } = await requireMember();
  const data = await loadDashboard(orgId, false);
  if (!data?.panel) return new Response("Defina o preço de pelo menos um produto para gerar o cartão.", { status: 404 });

  const logo = await fetch(new URL("/brand/logo-stacked.png", request.url))
    .then((r) => r.arrayBuffer())
    .then((b) => `data:image/png;base64,${Buffer.from(b).toString("base64")}`)
    .catch(() => null);

  try {
    return shareCardImage({ orgName, month: monthLabel(currentMonthStart()), composition: data.panel.composition, configured: data.ctx.configured, logo });
  } catch {
    return new Response("Não foi possível gerar a imagem.", { status: 500 });
  }
}
