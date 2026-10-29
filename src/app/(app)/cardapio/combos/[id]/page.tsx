import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ConfirmButton } from "@/components/confirm-button";
import { requireMember } from "@/lib/auth";
import { loadCombo, loadRecipeCosts, loadSalesWeights } from "@/lib/combos-data";
import { loadPricingContext } from "@/lib/pricing-data";
import { archiveCombo } from "../actions";
import { ComboEditor } from "./combo-editor";

export const metadata = { title: "Combo" };

export default async function ComboPage(props: PageProps<"/cardapio/combos/[id]">) {
  const { orgId, canWrite } = await requireMember();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const ctx = await loadPricingContext(orgId, canWrite);
  if (!ctx) notFound();
  const [combo, recipes, weights] = await Promise.all([loadCombo(orgId, id), loadRecipeCosts(orgId, ctx.unit.id, ctx.settings.safetyMarginPct ?? 0), loadSalesWeights(ctx.unit.id)]);
  if (!combo || !combo.active) notFound();

  return (
    <>
      <BackLink href="/cardapio/combos">Combos</BackLink>
      <h1 className="text-2xl font-extrabold tracking-tight">{combo.name}</h1>

      <ComboEditor
        combo={{ id: combo.id, name: combo.name }}
        initialGroups={combo.groups}
        recipes={recipes}
        weights={Object.fromEntries(weights)}
        settings={ctx.settings}
        feePct={ctx.channels[0]?.fee_pct ?? 0}
        estimateReason={ctx.estimateReason}
        canWrite={canWrite}
      />

      {canWrite ? (
        <form action={archiveCombo} className="border-t border-border pt-6">
          <input type="hidden" name="id" value={combo.id} />
          <ConfirmButton
            title="Arquivar este combo?"
            message="Ele some da lista, mas dá para restaurar depois em Combos arquivados."
            confirmLabel="Arquivar"
            className="h-11 w-full rounded-xl border border-border bg-surface text-sm font-semibold text-danger"
          >
            Arquivar combo
          </ConfirmButton>
        </form>
      ) : null}
    </>
  );
}
