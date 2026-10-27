import Link from "next/link";
import { Hint } from "@/components/hint";
import { MarmitasTabs } from "@/components/marmitas-tabs";
import { SubmitButton } from "@/components/submit-button";
import { requireMember } from "@/lib/auth";
import { formatBRL, formatNumber } from "@/lib/format";
import { loadArchivedRecipes, loadReceitas } from "@/lib/recipes-data";
import { restoreRecipe } from "../actions";
import { NewReceitaForm } from "./new-receita-form";

export const metadata = { title: "Receitas" };

export default async function ReceitasPage() {
  const { canWrite } = await requireMember();
  const [receitas, archived] = await Promise.all([loadReceitas(), loadArchivedRecipes("receita")]);

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Receitas</h1>
        <p className="text-muted">
          O que você faz em lote e usa em várias marmitas: arroz, feijão, estrogonofe, purê. O sal e o tempero ficam dentro do custo.
          <Hint>
            Cadastre a receita uma vez, com tudo que vai no lote e quanto rende pronta. Na marmita, você só diz quantos gramas leva (150 g de estrogonofe, 120 g de arroz).
          </Hint>
        </p>
      </section>

      <MarmitasTabs active="receitas" />

      {canWrite ? (
        <details className="card" open={receitas.length === 0}>
          <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold text-primary">+ Nova receita</summary>
          <div className="border-t border-border p-4">
            <NewReceitaForm />
          </div>
        </details>
      ) : null}

      {receitas.length === 0 ? (
        <p className="card p-4 text-sm text-muted">Nenhuma receita ainda. Comece pelo arroz: quantos kg crus entram no lote e quantos kg saem cozidos.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {receitas.map((r) => (
            <li key={r.id}>
              <Link href={`/marmitas/receitas/${r.id}`} className="flex flex-col gap-1 card p-4">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold">{r.name}</span>
                  {r.costPerKg !== null ? <span className="tabular shrink-0 font-extrabold">{formatBRL(r.costPerKg)}/kg</span> : <span className="shrink-0 text-xs text-warning">incompleta</span>}
                </span>
                <span className="text-xs text-muted">
                  {r.readyWeightGrams ? `rende ${formatNumber(r.readyWeightGrams / 1000, 2)} kg pronto` : "informe quanto rende"}
                  {r.batchCost !== null ? ` · lote ${formatBRL(r.batchCost)}` : ""}
                  {r.ingredientCount === 0 ? " · sem ingredientes" : ""}
                  {" · "}
                  {r.usedIn === 0 ? "ainda não usada" : `usada em ${r.usedIn} ${r.usedIn === 1 ? "marmita" : "marmitas"}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 ? (
        <details className="card px-4">
          <summary className="flex h-12 cursor-pointer items-center text-sm font-semibold text-muted">Arquivadas ({archived.length})</summary>
          <ul className="divide-y divide-border">
            {archived.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 truncate text-sm">{a.name}</span>
                {canWrite ? (
                  <form action={restoreRecipe}>
                    <input type="hidden" name="id" value={a.id} />
                    <SubmitButton pendingLabel="Restaurando…" className="h-11 shrink-0 px-2 text-sm font-semibold text-primary">
                      Restaurar
                    </SubmitButton>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
