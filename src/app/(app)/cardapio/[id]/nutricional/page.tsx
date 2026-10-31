import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/back-link";
import { ProductTabs } from "@/components/product-tabs";
import { requireMember } from "@/lib/auth";
import { loadRecipe } from "@/lib/recipes-data";

export const metadata = { title: "Tabela nutricional" };

export default async function ProductNutritionPage(props: PageProps<"/cardapio/[id]/nutricional">) {
  await requireMember();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const loaded = await loadRecipe(id);
  if (!loaded || loaded.recipe.kind !== "marmita") notFound();

  return (
    <>
      <BackLink href="/cardapio">Cardápio</BackLink>
      <h1 className="text-2xl font-extrabold tracking-tight">{loaded.recipe.name}</h1>

      <ProductTabs id={loaded.recipe.id} active="nutricional" />

      <section className="flex flex-col gap-1 card p-4">
        <h2 className="font-semibold">Tabela nutricional</h2>
        <p className="text-sm text-muted">Em breve: a tabela nutricional deste produto, calculada a partir dos ingredientes da ficha.</p>
      </section>
    </>
  );
}
