import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/back-link";
import { ProductTabs } from "@/components/product-tabs";
import { requireMember } from "@/lib/auth";
import type { NutrientKey } from "@/lib/calc/nutrition";
import { loadProductNutrition } from "@/lib/nutrition-data";
import { nutritionRows } from "@/lib/nutrition-rows";
import { NutritionView } from "./nutrition-view";

export const metadata = { title: "Tabela nutricional" };

export default async function ProductNutritionPage(props: PageProps<"/cardapio/[id]/nutricional">) {
  await requireMember();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const data = await loadProductNutrition(id);
  if (!data) notFound();

  return (
    <>
      <BackLink href="/cardapio">Cardápio</BackLink>
      <h1 className="text-2xl font-extrabold tracking-tight">{data.name}</h1>

      <ProductTabs id={data.id} active="nutricional" />

      <NutritionView
        recipeId={data.id}
        rows={nutritionRows(data.per100, data.perPortion)}
        perPortion={data.perPortion}
        portionGrams={data.portionGrams}
        householdMeasure={data.householdMeasure}
        lines={data.lines}
        missing={data.missing}
        hasOverride={data.override !== null}
        overriddenKeys={Object.keys(data.override?.values ?? {}) as NutrientKey[]}
        canWrite={data.canWrite}
      />
    </>
  );
}
