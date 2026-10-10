import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { loadCurrentPrices, loadPricingContext } from "@/lib/pricing-data";
import { computeRecipe } from "@/lib/recipe-cost";
import { loadIngredients, loadRecipe } from "@/lib/recipes-data";
import { Simulator } from "./simulator";

export const metadata = { title: "Preço do produto" };

export default async function RecipePricingPage(props: PageProps<"/precificacao/[id]">) {
  const { orgId, canWrite } = await requireMember();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const ctx = await loadPricingContext(orgId, canWrite);
  const [loaded, ingredients] = await Promise.all([loadRecipe(id), loadIngredients()]);
  if (!ctx || !loaded) notFound();

  const prices = await loadCurrentPrices(ctx.unit.id);
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const { recipe, items } = loaded;

  const view = computeRecipe(
    { portions: recipe.portions, portionWeight: recipe.portion_weight, cookingLossPct: recipe.cooking_loss_pct, useCookingYield: recipe.mode === "serving" },
    items.filter((i) => byId.has(i.ingredient_id)).map((i) => ({ ingredient: byId.get(i.ingredient_id)!, netQty: i.net_qty, scope: i.scope })),
  );

  return (
    <>
      <Link href="/precificacao" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
        ← Preços
      </Link>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">{recipe.name}</h1>
        {view.ok ? (
          <p className="text-muted">
            Custa <strong className="tabular text-foreground">{formatBRL(view.cost.costPerPortion.toNumber())}</strong> por porção.{" "}
            <Link href={`/fichas/${recipe.id}`} className="font-semibold text-primary">
              Ver ficha
            </Link>
          </p>
        ) : null}
        {view.ok && view.missingPrices > 0 ? (
          <p className="text-sm text-warning">{view.missingPrices} insumo(s) sem preço: o custo e a margem estão incompletos.</p>
        ) : null}
      </section>

      {view.ok ? (
        <Simulator
          recipeId={recipe.id}
          cost={view.cost.costPerPortion.toNumber()}
          currentPrice={prices.get(recipe.id) ?? null}
          settings={ctx.settings}
          configured={ctx.configured}
          fixedAuto={ctx.fixedAuto}
          channels={ctx.channels}
          canWrite={canWrite}
        />
      ) : (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm">
          A ficha ainda está incompleta. <Link href={`/fichas/${recipe.id}`} className="font-semibold text-primary">Termine a ficha</Link> para calcular o preço.
        </p>
      )}
    </>
  );
}
