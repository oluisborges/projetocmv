import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { loadProductNutrition } from "@/lib/nutrition-data";
import { nutritionToPdf } from "@/lib/nutrition-export";
import { slugify } from "@/lib/slug";

export const maxDuration = 60;

/** Tabela nutricional de um produto em PDF. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { orgName } = await requireMember();
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return new Response("Produto inválido.", { status: 400 });
  const data = await loadProductNutrition(id.data);
  if (!data) return new Response("Produto não encontrado.", { status: 404 });
  const body = await nutritionToPdf(data, orgName, new Date());
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="tabela-nutricional-${slugify(data.name)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
