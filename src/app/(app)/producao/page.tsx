import Link from "next/link";
import { ProducaoTabs } from "@/components/producao-tabs";
import { requireMember } from "@/lib/auth";
import { suggestProduction, topSellers } from "@/lib/calc";
import { formatNumber } from "@/lib/format";
import { loadPlan, loadProductionBase, loadRecentPlans, loadWeeklySales } from "@/lib/production-data";
import { addDays, defaultPlanWeek, isMonday, weekLabel, weekStartOf } from "@/lib/week";
import { WeekPlanner, type PlannerRow, type PlanStatus } from "./week-planner";

export const metadata = { title: "Produção da semana" };

export default async function ProducaoPage(props: PageProps<"/producao">) {
  const { orgId, canWrite } = await requireMember();
  const sp = await props.searchParams;
  const now = new Date();
  const next = defaultPlanWeek(now);
  const requested = typeof sp.semana === "string" && isMonday(sp.semana) ? sp.semana : next;
  const weekStart = requested;

  const base = await loadProductionBase(orgId, canWrite);
  const header = (
    <section className="flex flex-col gap-1">
      <h1 className="text-2xl font-extrabold tracking-tight">Produção</h1>
      <p className="text-muted">O plano da semana: o que fazer, o que preparar e o que comprar.</p>
    </section>
  );
  if (!base) {
    return (
      <>
        {header}
        <p className="card p-4 text-sm">Sua marmitaria ainda não tem uma unidade cadastrada. Fale com o suporte do Precificaí.</p>
      </>
    );
  }

  const [weekly, plan, recent] = await Promise.all([loadWeeklySales(orgId, base.unitId, base.hasMenu, now), loadPlan(orgId, base.unitId, weekStart), loadRecentPlans(orgId, base.unitId, 5)]);

  const suggestions = base.recipes.map((r) => {
    const series = weekly.byRecipe[r.id] ?? Array(weekly.weeks.length).fill(0);
    const fin = base.finished[r.id];
    const finished = fin?.known ? Math.max(0, fin.balance) : null;
    return { r, series, finished, s: suggestProduction({ weekly: series, finished }) };
  });
  const top = topSellers(suggestions.map((x) => ({ id: x.r.id, forecast: x.s.forecast })));

  const rows: PlannerRow[] = suggestions
    .map(({ r, series, finished, s }) => ({
      id: r.id,
      name: r.name,
      weekly: series.map((n) => Math.round(n)),
      average: s.average,
      trendPct: s.trendPct,
      forecast: s.forecast,
      suggested: s.toProduce,
      finished,
      confidence: s.confidence,
      topSeller: top.has(r.id),
    }))
    .sort((a, b) => Number(b.topSeller) - Number(a.topSeller) || b.forecast - a.forecast || a.name.localeCompare(b.name, "pt-BR"));

  const initial: Record<string, number> = plan ? Object.fromEntries(plan.items.map((i) => [i.recipeId, i.planned])) : Object.fromEntries(rows.map((r) => [r.id, r.suggested]));
  const status: PlanStatus = plan?.status ?? "none";
  // Na segunda-feira o plano "da vez" é a própria semana; nos outros dias, a que vem.
  const nextIsCurrent = next === weekStartOf(now);
  const prevWeek = addDays(next, -7);
  const recentPast = recent.filter((p) => p.weekStart !== weekStart);
  const nameById = new Map(base.recipes.map((r) => [r.id, r.name]));

  const chip = (on: boolean) => `flex h-11 flex-1 items-center justify-center rounded-lg px-1 text-[13px] font-semibold ${on ? "bg-surface shadow-sm" : "text-muted"}`;

  return (
    <>
      {header}
      <ProducaoTabs active="semana" />

      <nav aria-label="Semana do plano" className="flex gap-1 rounded-xl bg-border/60 p-1">
        <Link href={`/producao?semana=${prevWeek}`} aria-current={weekStart === prevWeek ? "page" : undefined} className={chip(weekStart === prevWeek)}>
          Semana passada
        </Link>
        <Link href="/producao" aria-current={weekStart === next ? "page" : undefined} className={chip(weekStart === next)}>
          {nextIsCurrent ? "Esta semana" : "Próxima semana"}
        </Link>
      </nav>
      <p className="-mt-3 text-center text-xs text-muted">{weekLabel(weekStart)}</p>

      <WeekPlanner
        key={`${weekStart}-${plan?.status ?? "none"}-${plan?.items.length ?? 0}`}
        weekStart={weekStart}
        weekLabelText={weekLabel(weekStart)}
        status={status}
        planId={plan?.id ?? null}
        rows={rows}
        initial={initial}
        base={{ recipes: base.recipes, ingredients: base.ingredients, receitas: base.receitas, stock: base.stock }}
        canWrite={canWrite}
        source={weekly.source}
        weeksUsed={weekly.weeks.length}
      />

      {recentPast.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Semanas anteriores</h2>
          <ul className="divide-y divide-border card px-4">
            {recentPast.map((p) => {
              const planned = p.items.reduce((n, i) => n + i.planned, 0);
              const producedTotal = p.items.reduce((n, i) => n + (i.produced ?? 0), 0);
              return (
                <li key={p.id} className="flex flex-col gap-0.5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/producao?semana=${p.weekStart}`} className="tap-area font-semibold text-primary underline">
                      {weekLabel(p.weekStart)}
                    </Link>
                    <span className="text-xs text-muted">{p.status === "produced" ? "produzida" : p.status === "confirmed" ? "confirmada" : "rascunho"}</span>
                  </div>
                  <p className="tabular text-xs text-muted">
                    Planejado {formatNumber(planned, 0)}
                    {p.status === "produced" ? ` · saiu ${formatNumber(producedTotal, 0)}` : ""} · {p.items.length} {p.items.length === 1 ? "marmita" : "marmitas"}
                    {p.items.length > 0 ? ` (${p.items.slice(0, 2).map((i) => nameById.get(i.recipeId) ?? "—").join(", ")}${p.items.length > 2 ? "…" : ""})` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
