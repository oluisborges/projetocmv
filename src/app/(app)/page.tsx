import Link from "next/link";
import { getActiveOrg, requireUser } from "@/lib/auth";
import { loadDashboard } from "@/lib/dashboard-data";
import { formatPct } from "@/lib/format";
import { MonthHealthCard, PriceActionsCard } from "@/components/home-cards";
import { monthHealth } from "@/lib/month-health";
import { priceActions } from "@/lib/price-actions";
import { BrandFooter } from "@/components/brand-footer";
import { InicioTabs } from "@/components/inicio-tabs";
import { loadAdvancedLock } from "@/lib/menu-locks-data";
import { DashboardView } from "./dashboard";

type Step = { key: string; title: string; detail: string; href: string; cta: string; minutes: number; done: boolean };

export default async function HomePage() {
  const session = await requireUser();
  const member = await getActiveOrg();
  // Em "ver como", quem aparece no cumprimento é a marmitaria, não o admin.
  const firstName = member?.viewingAs ? null : session.fullName?.split(" ")[0];
  const canWrite = member?.canWrite ?? false;

  const [data, advancedLock] = member ? await Promise.all([loadDashboard(member.orgId, canWrite), loadAdvancedLock(member.orgId)]) : [null, null];

  let steps: Step[] = [];
  if (data) {
    const { ctx } = data;
    const pricedIng = data.ingredientCount - data.noPriceCount;
    steps = [
      {
        key: "ingredients",
        minutes: 5,
        title: "Cadastre seus insumos e preços",
        detail: data.ingredientCount === 0 ? "Comece pelo catálogo de insumos: é só marcar o que você usa." : `${pricedIng} de ${data.ingredientCount} com preço preenchido`,
        href: data.ingredientCount === 0 ? "/ingredientes/catalogo" : "/ingredientes",
        cta: data.ingredientCount === 0 ? "Escolher do catálogo" : "Preencher preços",
        done: data.ingredientCount > 0 && data.noPriceCount === 0,
      },
      {
        key: "recipes",
        minutes: 5,
        title: "Monte a ficha de cada produto",
        detail: data.recipeCount === 0 ? "A receita de um produto, com o custo calculado na hora." : `${data.recipeCount} ${data.recipeCount === 1 ? "ficha criada" : "fichas criadas"}`,
        href: data.recipeCount === 0 ? "/cardapio/nova" : "/cardapio",
        cta: data.recipeCount === 0 ? "Criar a primeira ficha" : "Ver marmitas",
        done: data.recipeCount > 0,
      },
      {
        key: "settings",
        minutes: 2,
        title: "Informe impostos e despesas",
        detail: ctx.configured
          ? "Informados: o lucro mostrado já é o real."
          : ctx.fixedAuto
            ? "Falta só informar os impostos para o lucro mostrado ser o real."
            : "Sem isso o lucro mostrado é só uma estimativa.",
        href: "/financeiro/impostos",
        cta: "Informar agora",
        done: ctx.configured,
      },
      {
        key: "costs",
        minutes: 5,
        title: "Cadastre custos fixos e equipe",
        detail:
          ctx.fixedTotal > 0
            ? ctx.fixedAuto
              ? "Cadastrados: o app já usa isso no preço e mostra seu ponto de equilíbrio."
              : "Cadastrados. Informe também o faturamento do mês para o app usar no preço."
            : "Aluguel, energia, equipe… para descobrir quanto precisa vender para empatar.",
        href: "/financeiro",
        cta: ctx.fixedTotal > 0 ? "Completar" : "Cadastrar custos",
        done: ctx.fixedAuto,
      },
      {
        key: "prices",
        minutes: 3,
        title: "Defina o preço de venda",
        detail: data.recipeCount === 0 ? "Depois de criar as fichas." : `${data.withPriceCount} de ${data.recipeCount} produtos com preço`,
        href: "/cardapio",
        cta: "Definir preços",
        done: data.recipeCount > 0 && data.withPriceCount === data.recipeCount,
      },
    ];
  }

  const next = steps.find((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = steps.length > 0 && !next;
  const showDashboard = Boolean(data && data.pricedCount > 0);

  // "Como estou este mês?" e "O que fazer agora": só com algum número no mês e produto com preço.
  const health =
    data && showDashboard && data.month.hasData
      ? monthHealth({
          monthStart: data.month.start,
          now: new Date(),
          revenue: data.month.revenue,
          insumosCost: data.month.theoreticalCost,
          variablePct: data.monthBasis.variablePct,
          fixedTotal: data.monthBasis.fixedTotal,
          breakEvenRevenue: data.breakEven?.revenue ?? null,
        })
      : null;
  const actions = data
    ? priceActions({
        dishes: data.dishes.map((d) => ({ id: d.id, name: d.name, cost: d.cost, price: d.price, netPct: d.analysis?.at?.netPct ?? null })),
        settings: data.ctx.settings,
        feePct: data.ctx.channels[0]?.fee_pct ?? 0,
        units: new Map(data.dishes.map((d) => [d.id, d.weight])),
      })
    : [];

  const remainingMinutes = steps.filter((s) => !s.done).reduce((sum, s) => sum + s.minutes, 0);

  const checklist =
    steps.length > 0 && !allDone && next ? (
      <section className="flex flex-col gap-4" aria-label="Primeiros passos">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between text-sm">
            <h2 className="font-semibold">
              {doneCount === 0 ? "Vamos começar" : `Você já fez ${doneCount} de ${steps.length}`}
            </h2>
            <span className="text-muted">faltam cerca de {remainingMinutes} min</span>
          </div>
          <ol className="flex gap-1.5" aria-label={`${doneCount} de ${steps.length} passos feitos`}>
            {steps.map((step) => (
              <li key={step.key} className={`h-2.5 flex-1 rounded-full ${step.done ? "bg-success" : step === next ? "bg-primary/40" : "bg-border"}`}>
                <span className="sr-only">{step.title}{step.done ? " (feito)" : ""}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border-2 border-primary bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Próximo passo · ~{next.minutes} min</p>
          <p className="text-xl font-extrabold leading-tight tracking-tight">{next.title}</p>
          <p className="text-sm text-muted">{next.detail}</p>
          {canWrite ? (
            <Link href={next.href} className="mt-2 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground">
              {next.cta}
            </Link>
          ) : null}
        </div>

        <details className="card">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold text-primary">Ver todos os passos</summary>
        <ul className="divide-y divide-border border-t border-border px-4">
          {steps.map((step, i) => (
            <li key={step.key}>
              <Link href={step.href} className="flex min-h-12 items-center gap-3 py-2.5 text-sm">
                <span
                  aria-hidden
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.done ? "bg-success text-primary-foreground" : "bg-border text-muted"}`}
                >
                  {step.done ? "✓" : i + 1}
                </span>
                <span className={`min-w-0 flex-1 ${step.done ? "text-muted line-through" : "font-medium"}`}>{step.title}</span>
                {step.done ? <span className="sr-only">(feito)</span> : <span className="shrink-0 text-xs text-muted">~{step.minutes} min</span>}
              </Link>
            </li>
          ))}
        </ul>
        </details>
      </section>
    ) : null;

  const summary =
    data && data.panel ? (
      <Link href="/painel" className="flex items-center justify-between gap-3 rounded-2xl bg-primary p-5 text-primary-foreground">
        <span className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Lucro por marmita (preço cadastrado)</span>
          <span className="tabular text-4xl font-extrabold tracking-tight">{formatPct(data.panel.composition.profit)}</span>
          <span className="text-sm opacity-90">de cada venda sobra para você{data.ctx.estimate ? " (estimativa)" : ""}</span>
        </span>
        <span className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-primary">Ver detalhes</span>
      </Link>
    ) : null;

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Olá{firstName ? `, ${firstName}` : ""}!</h1>
        <p className="text-muted">
          {steps.length === 0
            ? "Aqui você acompanha o custo e o lucro de cada produto."
            : next
              ? "Falta pouco para você saber quanto ganha em cada produto."
              : "Tudo pronto! Agora é só manter os preços dos insumos em dia."}
        </p>
      </section>

      {member ? <InicioTabs active="resumo" advancedLock={advancedLock} /> : null}

      {!member && !session.isPlatformAdmin ? (
        <p className="card p-4 text-sm">Sua conta ainda não está ligada a nenhuma marmitaria. Fale com o suporte do Precificaí.</p>
      ) : null}

      {allDone ? (
        <section className="flex items-center gap-4 rounded-2xl border border-success/30 bg-success/10 p-4">
          <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success text-2xl font-bold text-primary-foreground">
            ✓
          </span>
          <p className="text-sm">
            <strong className="block text-base">Tudo organizado!</strong>
            Seus custos, preços e contas estão em dia. Veja os detalhes na Visão Avançada.
          </p>
        </section>
      ) : null}
      {health && data ? <MonthHealthCard health={health} month={data.month.start} canWrite={canWrite} /> : null}
      {checklist}
      {actions.length > 0 && data ? <PriceActionsCard actions={actions} targetPct={data.ctx.settings.minMarginPct} canWrite={canWrite} /> : null}
      {summary}
      {showDashboard && data ? <DashboardView data={data} variant="alerts" hideBelowTarget={actions.length > 0} /> : null}

      {session.isPlatformAdmin && !member?.viewingAs ? (
        <Link href="/admin" className="rounded-xl bg-primary px-4 py-3 text-center font-semibold text-primary-foreground">
          Abrir painel Shogun
        </Link>
      ) : null}

      <BrandFooter />
    </>
  );
}
