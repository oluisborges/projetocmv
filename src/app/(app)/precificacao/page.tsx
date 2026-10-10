import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { computeRecipe, type CostItem } from "@/lib/recipe-cost";
import { loadCurrentPrices, loadPricingContext } from "@/lib/pricing-data";
import { loadIngredients, loadRecipes } from "@/lib/recipes-data";
import { PricingList, type PricingRowData } from "./pricing-list";

export const metadata = { title: "Preços" };

export default async function PricingPage() {
  const { orgId, canWrite } = await requireMember();
  const ctx = await loadPricingContext(orgId, canWrite);

  if (!ctx) {
    return (
      <>
        <h1 className="text-2xl font-extrabold tracking-tight">Preços</h1>
        <p className="rounded-xl border border-border bg-surface p-4 text-sm">Sua marmitaria ainda não tem uma unidade cadastrada. Fale com a Shogun.</p>
      </>
    );
  }

  const [ingredients, { recipes, items }, prices] = await Promise.all([loadIngredients(), loadRecipes(), loadCurrentPrices(ctx.unit.id)]);
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  const rows: PricingRowData[] = recipes.map((r) => {
    const costItems: CostItem[] = items
      .filter((i) => i.recipe_id === r.id && byId.has(i.ingredient_id))
      .map((i) => ({ ingredient: byId.get(i.ingredient_id)!, netQty: i.net_qty, scope: i.scope }));
    const view = computeRecipe({ portions: r.portions, portionWeight: r.portion_weight, cookingLossPct: r.cooking_loss_pct, useCookingYield: r.mode === "serving" }, costItems);
    return {
      id: r.id,
      name: r.name,
      cost: view.ok ? view.cost.costPerPortion.toNumber() : null,
      missingPrices: view.ok ? view.missingPrices : 0,
      currentPrice: prices.get(r.id) ?? null,
    };
  });

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Preços</h1>
        <p className="text-muted">Quanto cobrar em cada produto e quanto sobra de verdade.</p>
      </section>

      <Link href="/precificacao/ajustes" className="flex h-11 items-center justify-between rounded-xl border border-border bg-surface px-4 text-sm font-semibold">
        <span>Impostos, taxas e meta de lucro</span>
        <span className="text-primary">Ajustar →</span>
      </Link>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted">
          Ainda não há fichas técnicas. Monte a primeira em <Link href="/fichas" className="font-semibold text-primary">Fichas</Link>: o preço sai do custo dela.
        </p>
      ) : (
        <PricingList rows={rows} channels={ctx.channels} settings={ctx.settings} configured={ctx.configured} fixedAuto={ctx.fixedAuto} canWrite={canWrite} />
      )}
    </>
  );
}
