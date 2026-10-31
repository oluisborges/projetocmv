import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { loadFichaTecnica } from "@/lib/ficha-tecnica-data";
import { fichaToPdf, fichaToXlsx } from "@/lib/ficha-tecnica-export";
import { requireProductionAccess } from "@/lib/production-access";
import { slugify } from "@/lib/slug";

export const maxDuration = 60;

/** Ficha técnica de um produto ou receita em PDF ou Excel: `?id=<uuid>&formato=pdf|xlsx`. */
export async function GET(request: Request) {
  await requireProductionAccess();
  const { orgId, canWrite, orgName } = await requireMember();
  const params = new URL(request.url).searchParams;
  const id = z.uuid().safeParse(params.get("id"));
  if (!id.success) return new Response("Escolha um produto ou receita.", { status: 400 });
  const format = params.get("formato") === "xlsx" ? "xlsx" : "pdf";

  const ficha = await loadFichaTecnica(orgId, canWrite, id.data);
  if (!ficha) return new Response("Ficha não encontrada.", { status: 404 });

  const now = new Date();
  const body = format === "xlsx" ? await fichaToXlsx(ficha, orgName, now) : await fichaToPdf(ficha, orgName, now);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      "Content-Disposition": `attachment; filename="ficha-tecnica-${slugify(ficha.name)}.${format}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
