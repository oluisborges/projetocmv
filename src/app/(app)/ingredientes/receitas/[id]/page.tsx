import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/confirm-button";
import { isPurchaseUnit, baseUnitOf } from "@/lib/calc";
import { requireMember } from "@/lib/auth";
import { loadIngredients, loadRecipe, loadRecipes } from "@/lib/recipes-data";
import { archiveRecipe, duplicateRecipe } from "@/app/(app)/cardapio/actions";
import { ReceitaEditor } from "./receita-editor";

export const metadata = { title: "Receita" };

export default async function ReceitaPage(props: PageProps<"/ingredientes/receitas/[id]">) {
  const { canWrite } = await requireMember();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [loaded, ingredients, marmitas] = await Promise.all([loadRecipe(id), loadIngredients(), loadRecipes()]);
  if (!loaded) notFound();
  if (loaded.recipe.kind !== "receita") redirect(`/cardapio/${id}`);
  const { recipe, items } = loaded;

  // Marmitas que usam esta receita, e em quantas fichas cada insumo é usado (para avisar antes de mudar um preço).
  const usedBy = marmitas.recipes.filter((r) => marmitas.items.some((i) => i.recipe_id === r.id && i.ingredient_id === recipe.id));
  const usedIn = new Map<string, Set<string>>();
  for (const it of [...marmitas.items, ...items]) if (!it.is_receita) usedIn.set(it.ingredient_id, (usedIn.get(it.ingredient_id) ?? new Set()).add(it.recipe_id));

  return (
    <>
      <BackLink href="/ingredientes">Ingredientes</BackLink>
      <div className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-extrabold tracking-tight">{recipe.name}</h1>
        <p className="text-xs text-muted">Receita em lote. As marmitas usam por grama pronto.</p>
      </div>

      <ReceitaEditor
        recipe={{ id: recipe.id, name: recipe.name, readyWeightGrams: recipe.portion_weight, readyWeightUnit: recipe.portion_weight_unit }}
        initialItems={items
          .filter((i) => !i.is_receita)
          .map((i) => {
            const base = ingredients.find((x) => x.id === i.ingredient_id)?.purchase_unit;
            const baseUnit = base && isPurchaseUnit(base) ? baseUnitOf(base) : "g";
            return { id: i.id, ingredientId: i.ingredient_id, netQty: i.net_qty, unit: i.qty_unit && isPurchaseUnit(i.qty_unit) ? i.qty_unit : baseUnit, scope: "batch" as const };
          })}
        ingredients={ingredients
          .filter((i) => i.kind === "insumo")
          .map((i) => ({
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

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Onde é usada</h2>
        {usedBy.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma marmita usa esta receita ainda. Abra uma marmita e adicione esta receita junto com os insumos.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {usedBy.map((r) => (
              <li key={r.id}>
                <Link href={`/cardapio/${r.id}`} className="tap-area font-medium text-primary underline">
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canWrite ? (
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-6">
          <form action={duplicateRecipe}>
            <input type="hidden" name="id" value={recipe.id} />
            <ConfirmButton title="Duplicar esta receita?" message="Cria uma cópia com os mesmos ingredientes, para você ajustar sem mexer na original." confirmLabel="Duplicar" destructive={false} className="h-11 w-full card text-sm font-semibold">
              Duplicar
            </ConfirmButton>
          </form>
          <form action={archiveRecipe}>
            <input type="hidden" name="id" value={recipe.id} />
            <ConfirmButton
              title="Arquivar esta receita?"
              message={usedBy.length > 0 ? `Ela some da lista, mas as ${usedBy.length} marmitas que a usam continuam calculando com ela. Dá para restaurar depois em Arquivadas.` : "Ela some da lista, mas dá para restaurar depois em Arquivadas."}
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
