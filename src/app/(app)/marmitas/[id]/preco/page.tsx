import { BackLink } from "@/components/back-link";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ProductTabs } from "@/components/product-tabs";
import { requireMember } from "@/lib/auth";
import { formatBRL, formatNumber } from "@/lib/format";
import { hasMenuConnection, loadMenuAveragePrices } from "@/lib/menu-data";
import { loadCurrentPrices, loadPricingContext } from "@/lib/pricing-data";
import { computeRecipe, recipeCostSettings } from "@/lib/recipe-cost";
import { loadIngredients, loadRecipe } from "@/lib/recipes-data";
import { Simulator } from "./simulator";

export const metadata = { title: "Preço de venda" };

export default async function RecipePricingPage(props: PageProps<"/marmitas/[id]/preco">) {
  const { orgId, canWrite } = await requireMember();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const ctx = await loadPricingContext(orgId, canWrite);
  const [loaded, ingredients] = await Promise.all([loadRecipe(id), loadIngredients()]);
  if (!ctx || !loaded || loaded.recipe.kind !== "marmita") notFound();

  const prices = await loadCurrentPrices(ctx.unit.id);
  const menuAverage = (await hasMenuConnection(orgId)) ? (await loadMenuAveragePrices(ctx.unit.id)).get(id) : undefined;
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const { recipe, items } = loaded;

  const view = computeRecipe(
    recipeCostSettings(recipe, ctx.settings.safetyMarginPct),
    items.filter((i) => byId.has(i.ingredient_id)).map((i) => ({ ingredient: byId.get(i.ingredient_id)!, netQty: i.net_qty, scope: i.scope })),
  );

  return (
    <>
      <BackLink href="/marmitas">Marmitas</BackLink>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">{recipe.name}</h1>
        {view.ok ? (
          <p className="text-muted">
            Custa <strong className="tabular text-foreground">{formatBRL(view.cost.costPerPortion.toNumber())}</strong> por porção.
          </p>
        ) : null}
        {view.ok && view.missingPrices > 0 ? (
          <p className="text-sm text-warning">{view.missingPrices} insumo(s) sem preço: o custo e a margem estão incompletos.</p>
        ) : null}
      </section>

      <ProductTabs id={recipe.id} active="preco" />

      {menuAverage ? (
        <p className="card p-4 text-sm">
          No cardápio, esta marmita saiu a <strong className="tabular">{formatBRL(menuAverage.price)}</strong> em média nos últimos 30 dias ({formatNumber(menuAverage.units, 0)} unidades,
          já descontado o cupom de cada pedido).
          {prices.get(recipe.id) ? (
            <>
              {" "}
              Seu preço cadastrado é <strong className="tabular">{formatBRL(prices.get(recipe.id)!)}</strong>.
            </>
          ) : (
            " Você ainda não cadastrou um preço para ela."
          )}{" "}
          <span className="text-muted">É só um aviso: o preço que vale nas contas continua sendo o que você cadastrar.</span>
        </p>
      ) : null}

      {view.ok ? (
        <Simulator
          recipeId={recipe.id}
          cost={view.cost.costPerPortion.toNumber()}
          currentPrice={prices.get(recipe.id) ?? null}
          settings={ctx.settings}
          configured={!ctx.estimate}
          estimateReason={ctx.estimateReason}
          channels={ctx.channels}
          canWrite={canWrite}
        />
      ) : (
        <p className="card p-4 text-sm">
          A ficha ainda está incompleta. <Link href={`/marmitas/${recipe.id}`} className="tap-area font-semibold text-primary">Termine a ficha</Link> para calcular o preço.
        </p>
      )}
    </>
  );
}
