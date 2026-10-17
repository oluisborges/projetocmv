import Link from "next/link";
import { CostsTabs } from "@/components/costs-tabs";
import { Hint } from "@/components/hint";
import { requireMember } from "@/lib/auth";
import { loadCombos } from "@/lib/combos-data";
import { formatPct } from "@/lib/format";
import { hasMenuConnection, loadMenuMonth, loadMenuProducts } from "@/lib/menu-data";
import { suggestLink } from "@/lib/menu/suggest";
import { currentMonthStart } from "@/lib/month-view";
import { activeUnit } from "@/lib/pricing-data";
import { loadRecipes } from "@/lib/recipes-data";
import { LinkRow, type TargetOption } from "./link-row";

export const metadata = { title: "Cardápio" };

export default async function MenuLinksPage() {
  const { orgId, canWrite } = await requireMember();
  const connected = await hasMenuConnection(orgId);
  const unit = await activeUnit(orgId);

  const header = (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Custos</h1>
        <p className="text-muted">Diga a qual ficha cada produto do seu cardápio corresponde.</p>
      </section>
      <CostsTabs active="menu" menu={connected} />
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
  const [products, { recipes }, combos, menu] = await Promise.all([loadMenuProducts(orgId), loadRecipes(), loadCombos(orgId, { active: true }), loadMenuMonth(unit.id, month)]);

  const recipeOptions: TargetOption[] = recipes.map((r) => ({ value: `r:${r.id}`, label: r.name }));
  const comboOptions: TargetOption[] = combos.map((c) => ({ value: `c:${c.id}`, label: c.name }));
  const candidates = [
    ...recipes.map((r) => ({ id: `r:${r.id}`, name: r.name, kind: "recipe" as const })),
    ...combos.map((c) => ({ id: `c:${c.id}`, name: c.name, kind: "combo" as const })),
  ];
  const label = new Map([...recipeOptions, ...comboOptions].map((o) => [o.value, o.label]));
  const soldBy = new Map(menu.sales.map((s) => [s.product_id, s]));

  const targetOf = (p: (typeof products)[number]) => (p.ignored ? "ignore" : p.recipe_id ? `r:${p.recipe_id}` : p.combo_id ? `c:${p.combo_id}` : "");
  // sem vínculo primeiro (os mais vendidos no topo), depois os já vinculados, depois os ignorados
  const rank = (p: (typeof products)[number]) => (targetOf(p) === "" ? 0 : targetOf(p) === "ignore" ? 2 : 1);
  const sorted = [...products].sort((a, b) => rank(a) - rank(b) || (soldBy.get(b.id)?.revenue ?? 0) - (soldBy.get(a.id)?.revenue ?? 0) || a.name.localeCompare(b.name, "pt-BR"));

  const pendingCount = products.filter((p) => targetOf(p) === "").length;
  const totalRevenue = menu.sales.reduce((s, x) => s + x.revenue, 0);
  const linkedRevenue = menu.sales.filter((s) => products.find((p) => p.id === s.product_id && targetOf(p) !== "")).reduce((s, x) => s + x.revenue, 0);
  const coverage = totalRevenue > 0 ? linkedRevenue / totalRevenue : null;

  const rows = sorted.map((p) => {
    const sug = targetOf(p) === "" ? suggestLink(p.name, candidates) : null;
    return (
      <LinkRow
        key={p.id}
        product={{ id: p.id, name: p.name, kind: p.kind, target: targetOf(p), units: p.units_per_sale }}
        sold={soldBy.get(p.id) ? { qty: soldBy.get(p.id)!.qty, revenue: soldBy.get(p.id)!.revenue } : null}
        recipes={recipeOptions}
        combos={comboOptions}
        suggestion={sug ? { value: sug.id, label: label.get(sug.id) ?? sug.name } : null}
        canWrite={canWrite}
      />
    );
  });

  return (
    <>
      {header}

      <section className="flex flex-col gap-2 card p-4">
        {products.length === 0 ? (
          <p className="text-sm">Ainda não chegou nenhum pedido do cardápio. Assim que chegarem, os produtos aparecem aqui para você vincular às fichas.</p>
        ) : pendingCount > 0 ? (
          <p className="text-sm">
            <strong>{pendingCount}</strong> {pendingCount === 1 ? "produto ainda não tem" : "produtos ainda não têm"} ficha.
            {coverage !== null ? <> Já temos o custo de <strong>{formatPct(coverage)}</strong> do que você vendeu neste mês.</> : null}
            <Hint>Sem o vínculo, o app sabe quanto você vendeu mas não quanto custou, e o lucro fica de fora da conta. Vários produtos podem apontar para a mesma ficha.</Hint>
          </p>
        ) : (
          <p className="text-sm">
            <strong>Tudo vinculado.</strong> O lucro do cardápio já considera tudo que você vendeu. Veja o resultado em{" "}
            <Link href="/custos/mes" className="font-semibold text-primary">Fechar o mês</Link>.
          </p>
        )}
      </section>

      {products.length > 0 ? (
        <ul className="divide-y divide-border card px-4">{rows}</ul>
      ) : null}
    </>
  );
}
