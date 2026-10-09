import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { loadIngredients, loadRecipe } from "@/lib/recipes-data";
import { archiveRecipe, duplicateRecipe } from "../actions";
import { RecipeEditor } from "./recipe-editor";

export const metadata = { title: "Ficha técnica" };

export default async function RecipePage(props: PageProps<"/fichas/[id]">) {
  const { canWrite } = await requireMember();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [loaded, ingredients] = await Promise.all([loadRecipe(id), loadIngredients()]);
  if (!loaded) notFound();
  const { recipe, items } = loaded;

  return (
    <>
      <Link href="/fichas" className="text-sm font-semibold text-primary">
        ← Fichas
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight">{recipe.name}</h1>

      <RecipeEditor
        recipe={{ id: recipe.id, name: recipe.name, portions: recipe.portions, portionWeight: recipe.portion_weight, cookingLossPct: recipe.cooking_loss_pct }}
        initialItems={items.map((i) => ({ id: i.id, ingredientId: i.ingredient_id, netQty: i.net_qty, scope: i.scope }))}
        ingredients={ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          kind: i.kind,
          purchase_unit: i.purchase_unit,
          unit_cost: i.unit_cost,
          correction_factor: i.correction_factor,
          archived: Boolean(i.archived_at),
        }))}
        canWrite={canWrite}
      />

      {canWrite ? (
        <div className="grid grid-cols-2 gap-2 pt-2">
          <form action={duplicateRecipe}>
            <input type="hidden" name="id" value={recipe.id} />
            <button type="submit" className="h-11 w-full rounded-xl border border-border bg-surface text-sm font-semibold">
              Duplicar ficha
            </button>
          </form>
          <form action={archiveRecipe}>
            <input type="hidden" name="id" value={recipe.id} />
            <button type="submit" className="h-11 w-full rounded-xl border border-border bg-surface text-sm font-semibold text-danger">
              Arquivar ficha
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
