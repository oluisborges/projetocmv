import Link from "next/link";
import { EstoqueTabs } from "@/components/estoque-tabs";
import { ProducaoTabs } from "@/components/producao-tabs";
import { requireMember } from "@/lib/auth";
import { allocateLots, expiringSoon } from "@/lib/lots";
import { loadLots, loadProductionBase, loadProductions } from "@/lib/production-data";
import { computeProduction, productionName } from "@/lib/production-view";
import { StockManager, type FinishedRowData, type StockRowData } from "./stock-manager";
import { requireProductionAccess } from "@/lib/production-access";
import { brtDate } from "@/lib/week";

export const metadata = { title: "Estoque" };

export default async function EstoquePage() {
  await requireProductionAccess();
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

  // Lotes das marmitas prontas: o saldo do congelador fica nos lotes mais novos; o mais antigo com saldo diz quando vence.
  const today = brtDate(new Date());
  const lots = base ? await loadLots(orgId, base.unitId) : [];
  const allocated = base ? Object.keys(base.finished).flatMap((rid) => allocateLots(lots.filter((l) => l.recipeId === rid), base.finished[rid]?.balance ?? 0)) : [];
  const nameOf = new Map(base ? [...base.recipes, ...base.incomplete].map((r) => [r.id, r.name] as const) : []);
  const expiring = expiringSoon(allocated, today, 15).map((x) => ({ name: nameOf.get(x.lot.recipeId) ?? "Marmita", code: x.lot.code, remaining: x.lot.remaining, expiresOn: x.lot.expiresOn as string, daysLeft: x.daysLeft }));
  const expiryOf = (rid: string) => {
    const next = expiringSoon(allocated.filter((l) => l.recipeId === rid), today, 100_000)[0];
    return next ? { code: next.lot.code, expiresOn: next.lot.expiresOn as string, daysLeft: next.daysLeft } : null;
  };

  const ingredients: StockRowData[] = base
    ? Object.entries(base.ingredients)
        .filter(([, i]) => i.kind !== "receita")
        .map(([id, i]) => {
          const b = base.stock[id];
          return { id, name: i.name, kind: i.kind as "insumo" | "embalagem", baseUnit: i.baseUnit, unit: i.purchaseUnit, balance: b?.balance ?? 0, known: b?.known ?? false, lastCountAt: b?.lastCountAt ?? null, minimum: base.minimums[id] ?? null };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    : [];
  const finished: FinishedRowData[] = base
    ? [...base.recipes, ...base.incomplete.map((r) => ({ id: r.id, name: r.name }))]
        .map((r) => {
          const b = base.finished[r.id];
          return { id: r.id, name: r.name, balance: b?.balance ?? 0, known: b?.known ?? false, lastCountAt: b?.lastCountAt ?? null, expiry: expiryOf(r.id) };
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
      <EstoqueTabs active="agora" />

      {base ? (
        <StockManager ingredients={ingredients} finished={finished} canWrite={canWrite} expiring={expiring} focusIds={[...focus]} focusLabel={open.length === 1 ? productionName(open[0]) : open.length > 1 ? `${open.length} produções em montagem` : null} />
      ) : (
        <p className="card p-4 text-sm">Sua marmitaria ainda não tem uma unidade cadastrada. Fale com o suporte do Precificaí.</p>
      )}

      <p className="text-xs text-muted">
        As compras por nota fiscal entram aqui sozinhas. O fechamento de cada mês (CMV real) sai do que você conta e lança aqui e fica guardado em{" "}
        <Link href="/producao/estoque/historico" className="tap-area font-semibold text-primary underline">
          Histórico dos meses
        </Link>
        .
      </p>
    </>
  );
}
