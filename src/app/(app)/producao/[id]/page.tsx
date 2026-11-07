import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/confirm-button";
import { requireMember } from "@/lib/auth";
import { loadPlanPurchases, loadProduction, loadProductionBase, loadWeekPlanned, loadWeeklySales } from "@/lib/production-data";
import { productionName, suggestionRows } from "@/lib/production-view";
import { deleteProduction } from "../actions";
import { ProductionWizard } from "./production-wizard";
import { requireProductionAccess } from "@/lib/production-access";

export const metadata = { title: "Produção" };

export default async function ProductionPage(props: PageProps<"/producao/[id]">) {
  await requireProductionAccess();
  const { orgId, canWrite } = await requireMember();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const base = await loadProductionBase(orgId, canWrite);
  if (!base) notFound();
  const production = await loadProduction(orgId, base.unitId, id);
  if (!production) notFound();

  const [weekly, elsewhere, bought] = await Promise.all([
    loadWeeklySales(orgId, base.unitId, base.hasMenu),
    loadWeekPlanned(orgId, base.unitId, production.weekStart, production.id),
    loadPlanPurchases(orgId, production.id),
  ]);
  const rows = suggestionRows(base, weekly, elsewhere);
  const initial = Object.fromEntries(production.items.map((i) => [i.recipeId, i.planned]));
  const producedQty = Object.fromEntries(production.items.map((i) => [i.recipeId, i.produced ?? 0]));
  const defaultName = productionName({ name: null, plannedFor: production.plannedFor });

  return (
    <>
      <BackLink href="/producao">Produções</BackLink>
      <h1 className="text-2xl font-extrabold tracking-tight">{productionName(production)}</h1>

      <ProductionWizard
        key={production.id}
        id={production.id}
        defaultName={defaultName}
        initialName={productionName(production)}
        plannedFor={production.plannedFor}
        done={production.status === "produced"}
        rows={rows}
        initial={initial}
        boughtQty={bought}
        base={{ recipes: base.recipes, ingredients: base.ingredients, receitas: base.receitas, stock: base.stock }}
        canWrite={canWrite}
        source={weekly.source}
        weeksUsed={weekly.weeks.length}
        plannedElsewhere={Object.values(elsewhere).reduce((n, v) => n + v, 0)}
        producedQty={producedQty}
      />

      {canWrite && production.status !== "produced" ? (
        <form action={deleteProduction} className="border-t border-border pt-4">
          <input type="hidden" name="id" value={production.id} />
          <ConfirmButton
            title="Apagar esta produção?"
            message="A produção some da lista. As compras que você marcou continuam no estoque."
            confirmLabel="Apagar"
            className="h-11 w-full card text-sm font-semibold text-danger"
          >
            Apagar esta produção
          </ConfirmButton>
        </form>
      ) : null}
    </>
  );
}
