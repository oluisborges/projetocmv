import Link from "next/link";
import { FichasTabs } from "@/components/fichas-tabs";
import { requireMember } from "@/lib/auth";
import { loadSafetyMargin } from "@/lib/pricing-data";
import { formatBRL, formatNumber } from "@/lib/format";
import { computeRecipe, recipeCostSettings, type CostItem } from "@/lib/recipe-cost";
import { loadArchivedRecipes, loadIngredients, loadRecipes } from "@/lib/recipes-data";
import { restoreRecipe } from "./actions";

export const metadata = { title: "Fichas técnicas" };

export default async function RecipesPage() {
  const { orgId, canWrite } = await requireMember();
  const [ingredients, { recipes, items }, archived, safetyMarginPct] = await Promise.all([loadIngredients(), loadRecipes(), loadArchivedRecipes(), loadSafetyMargin(orgId)]);
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  const cards = recipes.map((r) => {
    const costItems: CostItem[] = items
      .filter((i) => i.recipe_id === r.id && byId.has(i.ingredient_id))
      .map((i) => ({ ingredient: byId.get(i.ingredient_id)!, netQty: i.net_qty, scope: i.scope }));
    const view = computeRecipe(recipeCostSettings(r, safetyMarginPct), costItems);
    return { recipe: r, view };
  });

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Fichas técnicas</h1>
        <p className="text-muted">A receita de cada produto, com o custo por porção sempre atualizado.</p>
      </section>

      <FichasTabs active="marmitas" />

      {canWrite ? (
        <Link href="/fichas/nova" className="flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground">
          + Nova ficha
        </Link>
      ) : null}

      {cards.length === 0 ? (
        <p className="card p-5 text-sm text-muted">
          Nenhuma ficha ainda. Antes, cadastre os preços dos insumos em <Link href="/insumos" className="font-semibold text-primary">Insumos</Link>; depois monte a primeira ficha.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.map(({ recipe, view }) => (
            <li key={recipe.id}>
              <Link href={`/fichas/${recipe.id}`} className="flex items-center justify-between gap-3 card p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{recipe.name}</p>
                  <p className="truncate text-xs text-muted">
                    {recipe.category ? `${recipe.category} · ` : ""}
                    {view.ok ? (recipe.mode === "serving" ? "por unidade" : `lote de ${formatNumber(view.cost.portions.toNumber(), 0)} porções`) : "ficha incompleta"}
                  </p>
                  {view.ok && view.missingPrices > 0 ? (
                    <p className="text-xs text-warning">
                      {view.missingPrices} {view.missingPrices === 1 ? "item sem preço" : "itens sem preço"}: custo incompleto
                    </p>
                  ) : null}
                  {!view.ok ? (
                    <p className="text-xs text-warning">
                      {view.reason === "no-items" ? "Adicione os ingredientes" : view.reason === "no-portions" ? "Informe as porções" : "Confira os dados"}
                    </p>
                  ) : null}
                </div>
                {view.ok ? (
                  <div className="shrink-0 text-right">
                    <p className="tabular text-xl font-extrabold">{formatBRL(view.cost.costPerPortion.toNumber())}</p>
                    <p className="text-xs text-muted">custo por porção</p>
                  </div>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 ? (
        <details className="card px-4">
          <summary className="flex h-12 cursor-pointer items-center text-sm font-semibold text-muted">Arquivadas ({archived.length})</summary>
          <ul className="divide-y divide-border">
            {archived.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 truncate text-sm">{a.name}</span>
                {canWrite ? (
                  <form action={restoreRecipe}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="h-11 shrink-0 px-2 text-sm font-semibold text-primary">
                      Restaurar
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
