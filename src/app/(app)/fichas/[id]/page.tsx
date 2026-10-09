import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ConfirmButton } from "@/components/confirm-button";
import { isPurchaseUnit, baseUnitOf } from "@/lib/calc";
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
        recipe={{
          id: recipe.id,
          name: recipe.name,
          portions: recipe.portions,
          portionWeightGrams: recipe.portion_weight,
          portionWeightUnit: "g",
          cookingLossPct: recipe.cooking_loss_pct,
        }}
        initialItems={items.map((i) => {
          const base = ingredients.find((x) => x.id === i.ingredient_id)?.purchase_unit;
          const baseUnit = base && isPurchaseUnit(base) ? baseUnitOf(base) : "g";
          // Na ficha tudo é g/ml/un (não existe marmita de 1 kg): sempre a unidade-base do item.
          return { id: i.id, ingredientId: i.ingredient_id, netQty: i.net_qty, unit: baseUnit, scope: i.scope };
        })}
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
        <div className="flex flex-col gap-6 border-t border-border pt-6">
          <form action={duplicateRecipe}>
            <input type="hidden" name="id" value={recipe.id} />
            <button type="submit" className="h-11 w-full rounded-xl border border-border bg-surface text-sm font-semibold">
              Duplicar ficha
            </button>
          </form>
          <form action={archiveRecipe} className="flex flex-col gap-1.5">
            <input type="hidden" name="id" value={recipe.id} />
            <ConfirmButton
              message="Arquivar esta ficha? Ela some da lista, mas dá para restaurar depois em Arquivadas."
              className="h-11 w-full rounded-xl border border-border bg-surface text-sm font-semibold text-danger"
            >
              Arquivar ficha
            </ConfirmButton>
            <p className="text-center text-xs text-muted">Não é para salvar: o que você digita já é salvo sozinho.</p>
          </form>
        </div>
      ) : null}
    </>
  );
}
