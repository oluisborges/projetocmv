import Link from "next/link";
import { MarmitasTabs } from "@/components/marmitas-tabs";
import { Hint } from "@/components/hint";
import { requireMember } from "@/lib/auth";
import { loadCombos } from "@/lib/combos-data";
import { formatPct } from "@/lib/format";
import { hasMenuConnection, isImporting, loadMenuMonth, loadMenuProducts, loadMenuRange, loadMenuStatus } from "@/lib/menu-data";
import { kickStalled } from "@/lib/menu/server/kick";
import { suggestLink } from "@/lib/menu/suggest";
import { menuLookbackStart } from "@/lib/menu/window";
import { currentMonthStart, monthBounds } from "@/lib/month-view";
import { activeUnit } from "@/lib/pricing-data";
import { loadRecipes } from "@/lib/recipes-data";
import { ImportProgress } from "@/components/import-progress";
import type { TargetOption } from "./link-row";
import { LinksBrowser, type LinkItem } from "./links-browser";

export const metadata = { title: "Sincronizar Cardápio" };

export default async function MenuLinksPage() {
  const { orgId, canWrite } = await requireMember();
  const connected = await hasMenuConnection(orgId);
  const unit = await activeUnit(orgId);

  const header = (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Cardápio</h1>
        <p className="text-muted">Sincronizar Cardápio: diga a qual ficha cada produto que o cardápio vende corresponde.</p>
      </section>
      <MarmitasTabs active="sync" connected={connected} />
    </>
  );

  if (!connected || !unit) {
    return (
      <>
        {header}
        <p className="card p-4 text-sm">
          Seu cardápio digital ainda não está conectado. Fale com o suporte do Precificaí para conectar o CardápioWeb ou a Prefiro Delivery.
        </p>
      </>
    );
  }

  const month = currentMonthStart();
  const [products, { recipes }, combos, menu, menuRange, status] = await Promise.all([
    loadMenuProducts(orgId),
    loadRecipes(),
    loadCombos(orgId, { active: true }),
    loadMenuMonth(unit.id, month),
    loadMenuRange(unit.id, menuLookbackStart(), monthBounds(month).end), // mês atual + 3 anteriores
    loadMenuStatus(orgId),
  ]);
  await kickStalled(status); // importação parada? quem abre esta tela a retoma
  const importing = isImporting(status);
  const pendingOrders = status.reduce((n, c) => n + c.pending_orders, 0);

  const recipeOptions: TargetOption[] = recipes.map((r) => ({ value: `r:${r.id}`, label: r.name }));
  const comboOptions: TargetOption[] = combos.map((c) => ({ value: `c:${c.id}`, label: c.name }));
  const candidates = [
    ...recipes.map((r) => ({ id: `r:${r.id}`, name: r.name, kind: "recipe" as const })),
    ...combos.map((c) => ({ id: `c:${c.id}`, name: c.name, kind: "combo" as const })),
  ];
  const label = new Map([...recipeOptions, ...comboOptions].map((o) => [o.value, o.label]));
  const soldBy = new Map(menu.sales.map((s) => [s.product_id, s]));
  const soldInRange = new Map(menuRange.sales.map((s) => [s.product_id, s]));

  const targetOf = (p: (typeof products)[number]) => (p.ignored ? "ignore" : p.recipe_id ? `r:${p.recipe_id}` : p.combo_id ? `c:${p.combo_id}` : "");
  // os mais vendidos primeiro (no mês, depois no período todo); sem venda, por nome
  const sorted = [...products].sort(
    (a, b) =>
      (soldBy.get(b.id)?.net ?? 0) - (soldBy.get(a.id)?.net ?? 0) ||
      (soldInRange.get(b.id)?.net ?? 0) - (soldInRange.get(a.id)?.net ?? 0) ||
      a.name.localeCompare(b.name, "pt-BR"),
  );

  const pendingCount = products.filter((p) => targetOf(p) === "").length;
  const totalRevenue = menu.sales.reduce((s, x) => s + x.net, 0);
  const linkedIds = new Set(products.filter((p) => targetOf(p) !== "").map((p) => p.id));
  const linkedRevenue = menu.sales.filter((s) => linkedIds.has(s.product_id)).reduce((s, x) => s + x.net, 0);
  const coverage = totalRevenue > 0 ? linkedRevenue / totalRevenue : null;

  const items: LinkItem[] = sorted.map((p) => {
    const sug = targetOf(p) === "" ? suggestLink(p.name, candidates) : null;
    const sold = soldBy.get(p.id);
    const inRange = soldInRange.get(p.id);
    return {
      id: p.id,
      name: p.name,
      kind: p.kind,
      target: targetOf(p),
      units: p.units_per_sale,
      sold: sold ? { qty: sold.qty, revenue: sold.net } : null,
      soldRange: inRange ? { qty: inRange.qty, revenue: inRange.net } : null,
      suggestion: sug ? { value: sug.id, label: label.get(sug.id) ?? sug.name } : null,
    };
  });

  return (
    <>
      {header}

      <ImportProgress initialImporting={importing} initialPending={pendingOrders} />

      <section className="flex flex-col gap-2 card p-4">
        {products.length === 0 ? (
          <p className="text-sm">Ainda não chegou nenhum pedido do cardápio. Assim que chegarem, os produtos aparecem aqui para você vincular às fichas.</p>
        ) : pendingCount > 0 ? (
          <p className="text-sm">
            <strong>{pendingCount}</strong> {pendingCount === 1 ? "produto ainda não tem" : "produtos ainda não têm"} ficha.
            {coverage !== null ? (
              <>
                {" "}
                Já temos o custo de <strong>{formatPct(coverage)}</strong> do que você vendeu neste mês.
              </>
            ) : null}
            <Hint>Sem o vínculo, o app sabe quanto você vendeu mas não quanto custou, e o lucro fica de fora da conta. Vários produtos podem apontar para a mesma ficha.</Hint>
          </p>
        ) : (
          <p className="text-sm">
            <strong>Tudo vinculado.</strong> O lucro do cardápio já considera tudo que você vendeu. Veja o resultado em{" "}
            <Link href="/financeiro/mes" className="tap-area font-semibold text-primary">
              Mês, Fechar o mês
            </Link>
            .
          </p>
        )}
      </section>

      <p className="text-xs text-muted">
        Os valores aqui já são o que os clientes realmente pagaram, com a parte do cupom de cada pedido descontada. O CardápioWeb e a Prefiro cobram mensalidade fixa, sem porcentagem por pedido: cadastre a mensalidade em{" "}
        <Link href="/financeiro" className="tap-area font-semibold text-primary">
          Financeiro, aba Custos fixos
        </Link>
        .
      </p>

      {products.length > 0 ? <LinksBrowser items={items} recipes={recipeOptions} combos={comboOptions} canWrite={canWrite} /> : null}
    </>
  );
}
