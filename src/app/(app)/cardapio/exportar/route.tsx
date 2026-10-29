import { requireMember } from "@/lib/auth";
import { fichasToPdf, fichasToXlsx } from "@/lib/fichas-export";
import { loadFichasReport } from "@/lib/fichas-report";
import { slugify } from "@/lib/slug";

export const maxDuration = 60;

/** Fichas técnicas em PDF (uma por página, para a cozinha) ou Excel: `?formato=pdf|xlsx`. */
export async function GET(request: Request) {
  const { orgId, canWrite, orgName } = await requireMember();
  const format = new URL(request.url).searchParams.get("formato") === "xlsx" ? "xlsx" : "pdf";
  const report = await loadFichasReport(orgId, canWrite);
  if (!report || report.fichas.length === 0) return new Response("Você ainda não tem fichas para exportar.", { status: 404 });

  const body = format === "xlsx" ? await fichasToXlsx(report) : await fichasToPdf(report);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      "Content-Disposition": `attachment; filename="fichas-tecnicas-${slugify(orgName)}.${format}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
