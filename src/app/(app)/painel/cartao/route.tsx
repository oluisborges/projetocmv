import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { requireMember } from "@/lib/auth";
import { loadDashboard } from "@/lib/dashboard-data";
import { currentMonthStart, monthLabel } from "@/lib/month-view";
import { shareCardImage } from "@/lib/share-card";

export const dynamic = "force-dynamic";

export async function GET() {
  const { orgId, orgName } = await requireMember();
  const data = await loadDashboard(orgId, false);
  if (!data?.panel) return new Response("Defina o preço de pelo menos um produto para gerar o cartão.", { status: 404 });

  // O logo vem do arquivo do projeto (nada de buscar na internet pelo endereço da requisição).
  const logo = await readFile(join(process.cwd(), "public/brand/logo-powered-by-shogun.png"))
    .then((b) => `data:image/png;base64,${b.toString("base64")}`)
    .catch(() => null);

  try {
    const image = shareCardImage({ orgName, month: monthLabel(currentMonthStart()), composition: data.panel.composition, configured: !data.ctx.estimate, logo });
    image.headers.set("Cache-Control", "private, max-age=300");
    return image;
  } catch {
    return new Response("Não foi possível gerar a imagem.", { status: 500 });
  }
}
