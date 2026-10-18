import { requireMember } from "@/lib/auth";
import { monthStart, currentMonthStart } from "@/lib/month-view";
import { loadReport } from "@/lib/report-data";
import { reportToPdf } from "@/lib/report-pdf";
import { reportToXlsx } from "@/lib/report-xlsx";
import { slugify } from "@/lib/slug";

export const maxDuration = 60;

/** Relatório do mês para o contador e o financeiro: `?mes=2026-09&formato=pdf|xlsx`. */
export async function GET(request: Request) {
  const { orgId, canWrite, orgName } = await requireMember();
  const url = new URL(request.url);
  const month = monthStart(url.searchParams.get("mes") ?? undefined) ?? currentMonthStart();
  const format = url.searchParams.get("formato") === "xlsx" ? "xlsx" : "pdf";

  const report = await loadReport(orgId, canWrite, month);
  if (!report) return new Response("Este mês ainda não tem números para o relatório.", { status: 404 });

  const body = format === "xlsx" ? await reportToXlsx(report) : await reportToPdf(report);
  const name = `relatorio-${slugify(orgName)}-${month.slice(0, 7)}.${format}`;
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
