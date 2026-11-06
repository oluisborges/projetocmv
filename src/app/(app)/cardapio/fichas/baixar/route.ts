import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { camposFromParam } from "@/lib/ficha-campos";
import { loadFichaTecnica } from "@/lib/ficha-tecnica-data";
import { fichaToPdf, fichaToXlsx } from "@/lib/ficha-tecnica-export";
import { fichaDocNome } from "@/lib/ficha-nome";
import { slugify } from "@/lib/slug";

export const maxDuration = 60;

/** Ficha técnica de um produto ou receita em PDF ou Excel: `?id=<uuid>&formato=pdf|xlsx&campos=ingredientes,custo,…` (sem `campos`, vale o modelo Financeiro). */
export async function GET(request: Request) {
  const { orgId, canWrite, orgName } = await requireMember();
  const params = new URL(request.url).searchParams;
  const id = z.uuid().safeParse(params.get("id"));
  if (!id.success) return new Response("Escolha um produto ou receita.", { status: 400 });
  const format = params.get("formato") === "xlsx" ? "xlsx" : "pdf";

  const ficha = await loadFichaTecnica(orgId, canWrite, id.data);
  if (!ficha) return new Response("Ficha não encontrada.", { status: 404 });

  const campos = camposFromParam(params.get("campos"));
  const now = new Date();
  const body = format === "xlsx" ? await fichaToXlsx(ficha, orgName, now, campos) : await fichaToPdf(ficha, orgName, now, campos);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      "Content-Disposition": `attachment; filename="${slugify(fichaDocNome(ficha.kind))}-${slugify(ficha.name)}.${format}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
