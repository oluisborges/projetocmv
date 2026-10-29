import { BackLink } from "@/components/back-link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ConfirmButton } from "@/components/confirm-button";
import { isPurchaseUnit, baseUnitOf } from "@/lib/calc";
import { ProductTabs } from "@/components/product-tabs";
import { requireMember } from "@/lib/auth";
import { loadSafetyMargin } from "@/lib/pricing-data";
import { loadIngredients, loadRecipe, loadRecipes } from "@/lib/recipes-data";
import { archiveRecipe, duplicateRecipe } from "../actions";
import { RecipeEditor } from "./recipe-editor";

export const metadata = { title: "Ficha técnica" };

export default async function RecipePage(props: PageProps<"/cardapio/[id]">) {
  const { orgId, canWrite } = await requireMember();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [loaded, ingredients, safetyMarginPct, all] = await Promise.all([loadRecipe(id), loadIngredients(), loadSafetyMargin(orgId), loadRecipes()]);
  if (!loaded) notFound();
  const { recipe, items } = loaded;
  if (recipe.kind === "receita") redirect(`/ingredientes/receitas/${recipe.id}`);

  // Em quantas fichas cada insumo é usado (avisa antes de mudar o preço de algo que vale para várias).
  const usedIn = new Map<string, Set<string>>();
  for (const it of all.items) usedIn.set(it.ingredient_id, (usedIn.get(it.ingredient_id) ?? new Set()).add(it.recipe_id));

  return (
    <>
      <BackLink href="/cardapio">Cardápio</BackLink>
      <div className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-extrabold tracking-tight">{recipe.name}</h1>
        {recipe.updated_at ? (
          <p className="text-xs text-muted">
            Última alteração em{" "}
            {new Date(recipe.updated_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}
          </p>
        ) : null}
      </div>

      <ProductTabs id={recipe.id} active="ficha" />

      <RecipeEditor
        recipe={{
          id: recipe.id,
          mode: recipe.mode,
          name: recipe.name,
          portions: recipe.portions,
          portionWeightGrams: recipe.portion_weight,
          portionWeightUnit: "g",
          cookingLossPct: recipe.cooking_loss_pct,
          code: recipe.code ?? "",
          portionNote: recipe.portion_note ?? "",
        }}
        safetyMarginPct={safetyMarginPct}
        initialItems={items.map((i) => {
          const base = ingredients.find((x) => x.id === i.ingredient_id)?.purchase_unit;
          const baseUnit = base && isPurchaseUnit(base) ? baseUnitOf(base) : "g";
          // Por unidade: tudo em g/ml/un (não existe produto de 1 kg). Em lote: a unidade em que o dono digitou.
          const typed = i.qty_unit && isPurchaseUnit(i.qty_unit) && i.scope === "batch" && recipe.mode === "batch" ? i.qty_unit : baseUnit;
          return { id: i.id, ingredientId: i.ingredient_id, netQty: i.net_qty, unit: typed, scope: i.scope };
        })}
        ingredients={ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          kind: i.kind,
          purchase_unit: i.purchase_unit,
          unit_cost: i.unit_cost,
          correction_factor: i.correction_factor,
          cooking_yield: i.cooking_yield,
          category: i.category,
          archived: Boolean(i.archived_at),
          purchase_qty: i.purchase_qty,
          purchase_price: i.purchase_price,
          usedIn: usedIn.get(i.id)?.size ?? 0,
        }))}
        canWrite={canWrite}
      />

      {canWrite ? (
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-6">
          <form action={duplicateRecipe}>
            <input type="hidden" name="id" value={recipe.id} />
            <ConfirmButton
              title="Duplicar esta ficha?"
              message="Cria uma cópia com os mesmos ingredientes, para você ajustar sem mexer na original."
              confirmLabel="Duplicar"
              destructive={false}
              className="h-11 w-full card text-sm font-semibold"
            >
              Duplicar
            </ConfirmButton>
          </form>
          <form action={archiveRecipe}>
            <input type="hidden" name="id" value={recipe.id} />
            <ConfirmButton
              title="Arquivar esta ficha?"
              message="Ela some da lista, mas dá para restaurar depois em Arquivadas."
              confirmLabel="Arquivar"
              className="h-11 w-full card text-sm font-semibold text-danger"
            >
              Arquivar
            </ConfirmButton>
          </form>
        </div>
      ) : null}
    </>
  );
}
