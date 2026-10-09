import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadCurrentPrices, loadPricingContext } from "@/lib/pricing-data";
import { createClient } from "@/lib/supabase/server";

type Step = { key: string; title: string; detail: string; href: string; cta: string; done: boolean };

export default async function HomePage() {
  const session = await requireUser();
  const member = session.memberships[0];
  const firstName = session.fullName?.split(" ")[0];
  const canWrite = member ? member.role !== "viewer" : false;

  let steps: Step[] = [];
  if (member) {
    const supabase = await createClient();
    const ctx = await loadPricingContext(member.org.id, canWrite);
    const [{ data: ingredients }, { data: recipes }, prices] = await Promise.all([
      supabase.from("ingredients").select("purchase_price").is("archived_at", null),
      supabase.from("recipes").select("id").eq("active", true),
      ctx ? loadCurrentPrices(ctx.unit.id) : Promise.resolve(new Map<string, number>()),
    ]);

    const totalIng = ingredients?.length ?? 0;
    const pricedIng = (ingredients ?? []).filter((i) => Number(i.purchase_price) > 0).length;
    const recipeIds = (recipes ?? []).map((r) => r.id as string);
    const pricedRecipes = recipeIds.filter((id) => (prices.get(id) ?? 0) > 0).length;

    steps = [
      {
        key: "ingredients",
        title: "Cadastre seus insumos e preços",
        detail: totalIng === 0 ? "Comece pelo catálogo da Shogun: é só marcar o que você usa." : `${pricedIng} de ${totalIng} com preço preenchido`,
        href: totalIng === 0 ? "/insumos/catalogo" : "/insumos",
        cta: totalIng === 0 ? "Escolher do catálogo" : "Preencher preços",
        done: totalIng > 0 && pricedIng === totalIng,
      },
      {
        key: "recipes",
        title: "Monte a ficha de cada marmita",
        detail: recipeIds.length === 0 ? "A receita de uma marmita, com o custo calculado na hora." : `${recipeIds.length} ${recipeIds.length === 1 ? "ficha criada" : "fichas criadas"}`,
        href: recipeIds.length === 0 ? "/fichas/nova" : "/fichas",
        cta: recipeIds.length === 0 ? "Criar a primeira ficha" : "Ver fichas",
        done: recipeIds.length > 0,
      },
      {
        key: "settings",
        title: "Informe impostos e despesas",
        detail: ctx?.configured ? "Informados: o lucro mostrado já é o real." : "Sem isso o lucro mostrado é só uma estimativa.",
        href: "/precificacao/ajustes",
        cta: "Informar agora",
        done: Boolean(ctx?.configured),
      },
      {
        key: "costs",
        title: "Cadastre custos fixos e equipe",
        detail:
          (ctx?.fixedTotal ?? 0) > 0
            ? ctx?.fixedAuto
              ? "Cadastrados: o app já usa isso no preço e mostra seu ponto de equilíbrio."
              : "Cadastrados. Informe também o faturamento do mês para o app usar no preço."
            : "Aluguel, energia, equipe… para descobrir quanto precisa vender para empatar.",
        href: "/custos",
        cta: (ctx?.fixedTotal ?? 0) > 0 ? "Completar" : "Cadastrar custos",
        done: Boolean(ctx?.fixedAuto),
      },
      {
        key: "prices",
        title: "Defina o preço de venda",
        detail: recipeIds.length === 0 ? "Depois de criar as fichas." : `${pricedRecipes} de ${recipeIds.length} marmitas com preço`,
        href: "/precificacao",
        cta: "Definir preços",
        done: recipeIds.length > 0 && pricedRecipes === recipeIds.length,
      },
    ];
  }

  const next = steps.find((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Olá{firstName ? `, ${firstName}` : ""}!</h1>
        <p className="text-muted">
          {steps.length === 0
            ? "Aqui você acompanha o custo e o lucro de cada marmita."
            : next
              ? "Falta pouco para você saber quanto ganha em cada marmita."
              : "Tudo pronto! Agora é só manter os preços dos insumos em dia."}
        </p>
      </section>

      {!member && !session.isPlatformAdmin ? (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm">Sua conta ainda não está ligada a nenhuma marmitaria. Fale com a Shogun.</p>
      ) : null}

      {steps.length > 0 ? (
        <section className="flex flex-col gap-3" aria-label="Primeiros passos">
          <div className="flex items-center justify-between text-sm">
            <h2 className="font-semibold uppercase tracking-wider text-muted">Primeiros passos</h2>
            <span className="tabular text-muted">
              {doneCount} de {steps.length}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border" aria-hidden>
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>

          <ol className="flex flex-col gap-3">
            {steps.map((step, i) => {
              const isNext = step === next;
              return (
                <li key={step.key} className={`flex items-start gap-3 rounded-xl border p-4 ${isNext ? "border-primary bg-primary/5" : "border-border bg-surface"}`}>
                  <span
                    aria-hidden
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      step.done ? "bg-success text-primary-foreground" : isNext ? "bg-primary text-primary-foreground" : "bg-border text-muted"
                    }`}
                  >
                    {step.done ? "✓" : i + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="font-semibold">
                      {step.title}
                      {step.done ? <span className="sr-only"> (feito)</span> : null}
                    </p>
                    <p className="text-sm text-muted">{step.detail}</p>
                    {(isNext || !step.done) && canWrite ? (
                      <Link
                        href={step.href}
                        className={`mt-1 inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold ${
                          isNext ? "bg-primary text-primary-foreground" : "border border-border bg-surface"
                        }`}
                      >
                        {step.cta}
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {session.isPlatformAdmin ? (
        <Link href="/admin" className="rounded-xl bg-primary px-4 py-3 text-center font-semibold text-primary-foreground">
          Abrir painel Shogun
        </Link>
      ) : null}
    </>
  );
}
