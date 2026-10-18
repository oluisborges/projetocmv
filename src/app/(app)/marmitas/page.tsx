import Link from "next/link";
import { ExportLinks } from "@/components/export-links";
import { MarmitasTabs } from "@/components/marmitas-tabs";
import { SubmitButton } from "@/components/submit-button";
import { requireMember } from "@/lib/auth";
import { loadCombos } from "@/lib/combos-data";
import { formatBRL, formatNumber } from "@/lib/format";
import { hasMenuConnection, loadMenuAveragePrices } from "@/lib/menu-data";
import { loadCurrentPrices, loadPricingContext } from "@/lib/pricing-data";
import { computeRecipe, recipeCostSettings, type CostItem } from "@/lib/recipe-cost";
import { loadArchivedRecipes, loadIngredients, loadRecipes } from "@/lib/recipes-data";
import { restoreRecipe } from "./actions";
import { PricingList, type PricingRowData } from "./pricing-list";

export const metadata = { title: "Marmitas" };

export default async function RecipesPage() {
  const { orgId, canWrite } = await requireMember();
  const ctx = await loadPricingContext(orgId, canWrite);
  const [ingredients, { recipes, items }, archived, combos, prices] = await Promise.all([
    loadIngredients(),
    loadRecipes(),
    loadArchivedRecipes(),
    loadCombos(orgId),
    ctx ? loadCurrentPrices(ctx.unit.id) : Promise.resolve(new Map<string, number>()),
  ]);
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  // Cardápio digital: quanto cada marmita está saindo (média paga, já com cupom). Só aviso; o preço é do dono.
  const menuAverage = ctx && (await hasMenuConnection(orgId)) ? await loadMenuAveragePrices(ctx.unit.id) : new Map<string, { price: number; units: number }>();

  const rows: PricingRowData[] = recipes.map((r) => {
    const costItems: CostItem[] = items
      .filter((i) => i.recipe_id === r.id && byId.has(i.ingredient_id))
      .map((i) => ({ ingredient: byId.get(i.ingredient_id)!, netQty: i.net_qty, scope: i.scope }));
    const view = computeRecipe(recipeCostSettings(r, ctx?.settings.safetyMarginPct ?? 0), costItems);
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      subtitle: view.ok
        ? r.mode === "serving"
          ? "por unidade"
          : `lote de ${formatNumber(view.cost.portions.toNumber(), 0)} porções`
        : view.reason === "no-items"
          ? "adicione os ingredientes"
          : view.reason === "no-portions"
            ? "informe as porções"
            : "confira os dados",
      cost: view.ok ? view.cost.costPerPortion.toNumber() : null,
      missingPrices: view.ok ? view.missingPrices : 0,
      currentPrice: prices.get(r.id) ?? null,
      menuAverage: menuAverage.get(r.id) ?? null,
    };
  });

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Marmitas</h1>
        <p className="text-muted">Cada produto com o custo por porção, o preço de venda e quanto sobra.</p>
      </section>

      <MarmitasTabs active="marmitas" showCombos={combos.length > 0} />

      {canWrite ? (
        <Link href="/marmitas/nova" className="flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground">
          + Nova ficha
        </Link>
      ) : null}

      <Link href="/ajustes/impostos" className="flex h-11 items-center justify-between card px-4 text-sm font-semibold">
        <span>Impostos, taxas e meta de lucro</span>
        <span className="text-primary">Ajustar →</span>
      </Link>

      {rows.length > 0 ? <ExportLinks base="/marmitas/exportar" label="Baixar todas as fichas" hint="PDF com uma ficha por página (para a cozinha) ou Excel (cópia de segurança, no mesmo formato da planilha de importação)." /> : null}

      {rows.length === 0 ? (
        <p className="card p-5 text-sm text-muted">
          Nenhuma ficha ainda. Antes, cadastre os preços dos insumos em <Link href="/insumos" className="font-semibold text-primary">Insumos</Link>; depois monte a primeira ficha.
        </p>
      ) : ctx ? (
        <PricingList rows={rows} channels={ctx.channels} settings={ctx.settings} configured={!ctx.estimate} estimateReason={ctx.estimateReason} canWrite={canWrite} />
      ) : (
        <>
          <p className="card p-4 text-sm">Sua marmitaria ainda não tem uma unidade cadastrada, então não dá para ver preços. Fale com o suporte do Precificaí.</p>
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.id}>
                <Link href={`/marmitas/${row.id}`} className="flex items-center justify-between gap-3 card p-4">
                  <span className="min-w-0 truncate font-semibold">{row.name}</span>
                  {row.cost !== null ? <span className="tabular shrink-0 font-extrabold">{formatBRL(row.cost)}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {combos.length === 0 && canWrite && rows.length > 0 ? (
        <Link href="/marmitas/combos" className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-primary">
          Vende combos ou kits? Monte um combo
        </Link>
      ) : null}

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
                    <SubmitButton pendingLabel="Restaurando…" className="h-11 shrink-0 px-2 text-sm font-semibold text-primary">
                      Restaurar
                    </SubmitButton>
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
