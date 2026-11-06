import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { requireProductionAccess } from "@/lib/production-access";
import { loadPlanPurchases, loadProduction, loadProductionBase } from "@/lib/production-data";
import { buildProductionSheet } from "@/lib/production-sheet";
import { productionSheetToPdf } from "@/lib/production-sheet-export";
import { slugify } from "@/lib/slug";

export const maxDuration = 60;

/** Ficha de produção em PDF: o que produzir, o que preparar em lote e o que comprar. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireProductionAccess();
  const { orgId, canWrite, orgName } = await requireMember();
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new Response("Produção não encontrada.", { status: 404 });

  const base = await loadProductionBase(orgId, canWrite);
  if (!base) return new Response("Produção não encontrada.", { status: 404 });
  const production = await loadProduction(orgId, base.unitId, id);
  if (!production) return new Response("Produção não encontrada.", { status: 404 });

  const bought = await loadPlanPurchases(orgId, production.id);
  const sheet = buildProductionSheet(production, base, bought);
  if (sheet.products.length === 0) return new Response("Esta produção ainda não tem produtos planejados.", { status: 404 });

  const body = await productionSheetToPdf(sheet, orgName);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ficha-de-producao-${slugify(sheet.title)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
