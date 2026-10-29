import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ConfirmButton } from "@/components/confirm-button";
import { requireMember } from "@/lib/auth";
import { formatBRL, formatPurchaseSize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { archiveIngredient, updateIngredient } from "../actions";
import { IngredientForm } from "../ingredient-form";

export const metadata = { title: "Insumo" };

export default async function IngredientPage(props: PageProps<"/ingredientes/[id]">) {
  const { orgId, canWrite } = await requireMember();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [{ data: ing }, { data: history }, { data: cats }] = await Promise.all([
    supabase.from("ingredients").select("*").eq("id", id).eq("org_id", orgId).maybeSingle(),
    supabase
      .from("ingredient_price_history")
      .select("id, purchase_price, purchase_qty, changed_at")
      .eq("ingredient_id", id)
      .eq("org_id", orgId)
      .order("changed_at", { ascending: false })
      .limit(8),
    supabase.from("ingredients").select("category").eq("org_id", orgId).not("category", "is", null),
  ]);
  if (!ing) notFound();

  const categories = [...new Set((cats ?? []).map((r) => r.category as string))].sort();
  const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <>
      <BackLink href="/ingredientes">Insumos</BackLink>
      <h1 className="text-2xl font-extrabold tracking-tight">{ing.name}</h1>

      {canWrite ? (
        <IngredientForm action={updateIngredient} submitLabel="Salvar alterações" defaults={ing} categories={categories} />
      ) : (
        <p className="card p-4 text-sm">
          {formatBRL(ing.purchase_price)} por {formatPurchaseSize(ing.purchase_qty, ing.purchase_unit)}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Histórico de preço</h2>
        {history && history.length > 0 ? (
          <ul className="divide-y divide-border card px-4">
            {history.map((h) => (
              <li key={h.id} className="flex items-baseline justify-between py-3 text-sm">
                <span className="text-muted">{date.format(new Date(h.changed_at))}</span>
                <span className="tabular font-medium">
                  {formatBRL(h.purchase_price)} <span className="font-normal text-muted">/ {formatPurchaseSize(h.purchase_qty, ing.purchase_unit)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Ainda sem histórico.</p>
        )}
      </section>

      {canWrite ? (
        <form action={archiveIngredient} className="pt-2">
          <input type="hidden" name="id" value={ing.id} />
          <ConfirmButton
            title="Arquivar este insumo?"
            confirmLabel="Arquivar"
            message="Ele some da lista, mas as fichas que o usam continuam calculando."
            className="h-11 w-full card text-sm font-semibold text-danger"
          >
            Arquivar insumo
          </ConfirmButton>
          <p className="pt-2 text-center text-xs text-muted">Some da lista, mas as fichas técnicas antigas continuam funcionando.</p>
        </form>
      ) : null}
    </>
  );
}
