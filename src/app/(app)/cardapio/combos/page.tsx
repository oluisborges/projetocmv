import Link from "next/link";
import { EstimateNotice } from "@/components/estimate-notice";
import { MarmitasTabs } from "@/components/marmitas-tabs";
import { MarginBadge } from "@/components/margin-badge";
import { requireMember } from "@/lib/auth";
import { summarizeCombo } from "@/lib/combo-view";
import { loadCombos, loadRecipeCosts, loadSalesWeights } from "@/lib/combos-data";
import { formatBRL, formatNumber } from "@/lib/format";
import { loadPricingContext } from "@/lib/pricing-data";
import { restoreCombo } from "./actions";
import { NewComboForm } from "./new-combo-form";
import { SubmitButton } from "@/components/submit-button";

export const metadata = { title: "Combos" };

export default async function CombosPage() {
  const { orgId, canWrite } = await requireMember();
  const ctx = await loadPricingContext(orgId, canWrite);

  const header = (
    <section className="flex flex-col gap-1">
      <h1 className="text-2xl font-extrabold tracking-tight">Combos</h1>
      <p className="text-muted">Combos: o que você vende em kit, com o preço de cada marmita dentro dele.</p>
    </section>
  );

  if (!ctx) {
    return (
      <>
        {header}
        <p className="card p-4 text-sm">Sua marmitaria ainda não tem uma unidade cadastrada. Fale com o suporte do Precificaí.</p>
      </>
    );
  }

  const [combos, archived, recipes, weights] = await Promise.all([
    loadCombos(orgId, { active: true }),
    loadCombos(orgId, { active: false }),
    loadRecipeCosts(orgId, ctx.unit.id, ctx.settings.safetyMarginPct ?? 0),
    loadSalesWeights(ctx.unit.id),
  ]);
  const byRecipe = new Map(recipes.map((r) => [r.id, r]));
  const feePct = ctx.channels[0]?.fee_pct ?? 0;

  return (
    <>
      {header}
      <MarmitasTabs active="combos" />
      <EstimateNotice reason={ctx.estimateReason} />

      {canWrite ? (
        recipes.length === 0 ? (
          <p className="card p-4 text-sm text-muted">
            Antes de montar um combo, crie as fichas das marmitas em <Link href="/cardapio" className="font-semibold text-primary underline">Marmitas</Link>.
          </p>
        ) : (
          <details className="card" open={combos.length === 0}>
            <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold text-primary">+ Novo combo</summary>
            <div className="border-t border-border p-4">
              <NewComboForm />
            </div>
          </details>
        )
      ) : null}

      {combos.length === 0 ? (
        <p className="card p-5 text-sm text-muted">
          Nenhum combo ainda. Um combo junta marmitas: por exemplo, 5 marmitas do mesmo sabor, ou &quot;escolha 10 entre estes sabores&quot;, cada uma com o preço que sai dentro do combo.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {combos.map((combo) => {
            const s = summarizeCombo(combo, byRecipe, weights, ctx.settings, feePct);
            const at = s.analysis?.at;
            return (
              <li key={combo.id}>
                <Link href={`/cardapio/combos/${combo.id}`} className="flex items-center justify-between gap-3 card p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{combo.name}</p>
                    {s.empty ? (
                      <p className="text-xs text-warning">Combo vazio: adicione as marmitas</p>
                    ) : (
                      <p className="tabular truncate text-xs text-muted">
                        {formatNumber(s.units, 0)} {s.units === 1 ? "marmita" : "marmitas"} · {formatBRL(s.price)} · custa {formatBRL(s.cost)}
                      </p>
                    )}
                    {s.incomplete ? <p className="text-xs text-warning">Tem marmita sem custo: o custo está incompleto</p> : null}
                  </div>
                  {at ? <MarginBadge status={at.status} pct={at.netPct} estimate={ctx.estimate} /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {archived.length > 0 && canWrite ? (
        <details className="card">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold text-muted">Combos arquivados ({archived.length})</summary>
          <ul className="divide-y divide-border border-t border-border px-4">
            {archived.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm">{c.name}</span>
                <form action={restoreCombo}>
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton pendingLabel="Restaurando…" className="h-11 px-3 text-sm font-semibold text-primary">
                    Restaurar
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
