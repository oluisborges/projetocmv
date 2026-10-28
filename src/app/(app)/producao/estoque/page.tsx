import Link from "next/link";
import { ProducaoTabs } from "@/components/producao-tabs";
import { requireMember } from "@/lib/auth";
import { loadProductionBase, loadProductions } from "@/lib/production-data";
import { computeProduction, productionName } from "@/lib/production-view";
import { StockManager, type FinishedRowData, type StockRowData } from "./stock-manager";

export const metadata = { title: "Estoque" };

export default async function EstoquePage() {
  const { orgId, canWrite } = await requireMember();
  const base = await loadProductionBase(orgId, canWrite);

  // Itens que as produções em montagem vão usar: são os primeiros a conferir.
  const open = base ? (await loadProductions(orgId, base.unitId)).filter((p) => p.status !== "produced") : [];
  const focus = new Set<string>();
  if (base) {
    for (const p of open) {
      const calc = computeProduction(p.items.map((i) => ({ recipeId: i.recipeId, units: i.planned })), base);
      for (const id of calc.needs.ingredients.keys()) focus.add(id);
    }
  }

  const ingredients: StockRowData[] = base
    ? Object.entries(base.ingredients)
        .filter(([, i]) => i.kind !== "receita")
        .map(([id, i]) => {
          const b = base.stock[id];
          return { id, name: i.name, kind: i.kind as "insumo" | "embalagem", baseUnit: i.baseUnit, unit: i.purchaseUnit, balance: b?.balance ?? 0, known: b?.known ?? false, lastCountAt: b?.lastCountAt ?? null };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    : [];
  const finished: FinishedRowData[] = base
    ? [...base.recipes, ...base.incomplete.map((r) => ({ id: r.id, name: r.name }))]
        .map((r) => {
          const b = base.finished[r.id];
          return { id: r.id, name: r.name, balance: b?.balance ?? 0, known: b?.known ?? false, lastCountAt: b?.lastCountAt ?? null };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    : [];

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Produção</h1>
        <p className="text-muted">O que você tem agora: insumos, embalagens e marmitas prontas. Toque em um item para contar, lançar uma compra ou uma perda.</p>
      </section>

      <ProducaoTabs active="estoque" />

      {base ? (
        <StockManager ingredients={ingredients} finished={finished} canWrite={canWrite} focusIds={[...focus]} focusLabel={open.length === 1 ? productionName(open[0]) : open.length > 1 ? `${open.length} produções em montagem` : null} />
      ) : (
        <p className="card p-4 text-sm">Sua marmitaria ainda não tem uma unidade cadastrada. Fale com o suporte do Precificaí.</p>
      )}

      <p className="text-xs text-muted">
        As compras por nota fiscal entram aqui sozinhas. A contagem do fim do mês (para o CMV real) continua em{" "}
        <Link href="/mes/estoque" className="font-semibold text-primary underline">
          Painel → Mês → Contagem
        </Link>
        .
      </p>
    </>
  );
}
