import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { requireMember } from "@/lib/auth";
import { loadArchivedRecipes, loadReceitas } from "@/lib/recipes-data";
import { createClient } from "@/lib/supabase/server";
import { restoreRecipe } from "../cardapio/actions";
import { InsumosLists, type TypeFilter } from "./insumos-lists";
import { NewSheet } from "./new-sheet";
import type { IngredientRow } from "./price-list";

export const metadata = { title: "Ingredientes" };

/** Endereços antigos (?aba=receitas…) continuam abrindo no filtro certo. */
const FILTERS: Record<string, TypeFilter> = { todos: "todos", insumos: "insumos", receitas: "receitas", embalagens: "embalagens" };

export default async function IngredientsPage(props: PageProps<"/ingredientes">) {
  const { orgId, canWrite } = await requireMember();
  const { importado, aba } = await props.searchParams;
  const initialType = (typeof aba === "string" && FILTERS[aba]) || "todos";

  const supabase = await createClient();
  const { data } = await supabase
    .from("ingredients")
    .select("id, name, category, kind, purchase_unit, purchase_qty, purchase_price, price_updated_at")
    .eq("org_id", orgId)
    .is("archived_at", null)
    .order("name");
  const [receitas, archivedReceitas] = await Promise.all([loadReceitas(), loadArchivedRecipes("receita")]);
  const all = (data ?? []) as IngredientRow[];

  // A barra de preços é do conjunto todo (insumos e embalagens), não importa o filtro escolhido.
  const pricedCount = all.filter((i) => Number(i.purchase_price) > 0).length;
  const missing = all.length - pricedCount;

  return (
    <>
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight">Ingredientes</h1>
          <p className="text-muted">Toque no preço, digite o valor novo e pronto: salva sozinho.</p>
        </div>
        {canWrite ? <NewSheet /> : null}
      </section>

      {importado === "fichas" ? (
        <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
          Fichas criadas em <Link href="/cardapio" className="tap-area font-semibold underline">Cardápio</Link>, com os insumos e as embalagens delas. Preencha aqui o preço que você paga em cada
          insumo e confira as gramas de cada produto.
        </p>
      ) : importado ? (
        <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
          Itens importados! Agora é só preencher o preço que você paga em cada um.
        </p>
      ) : null}

      {all.length > 0 ? (
        <div className="flex flex-col gap-1.5" role="status">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold">{missing === 0 ? "Todos os preços preenchidos" : `${pricedCount} de ${all.length} com preço`}</span>
            {missing > 0 ? <span className="text-muted">faltam {missing}</span> : <span className="text-success">✓</span>}
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-border" aria-hidden>
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(pricedCount / all.length) * 100}%` }} />
          </div>
        </div>
      ) : null}

      {all.length === 0 && receitas.length === 0 ? (
        <div className="flex flex-col gap-3 card p-5">
          <h2 className="text-lg font-bold">Comece pelo catálogo de insumos</h2>
          <p className="text-sm text-muted">
            Escolha os insumos e embalagens que você usa e só preencha o preço de cada um. Dá muito menos trabalho do que cadastrar do zero.
          </p>
          {canWrite ? (
            <Link href="/ingredientes/catalogo" className="flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground">
              Escolher do catálogo
            </Link>
          ) : null}
        </div>
      ) : (
        <InsumosLists initialType={initialType} receitas={receitas} items={all} canWrite={canWrite} />
      )}

      {archivedReceitas.length > 0 ? (
        <details className="card px-4">
          <summary className="flex h-12 cursor-pointer items-center text-sm font-semibold text-muted">Receitas arquivadas ({archivedReceitas.length})</summary>
          <ul className="divide-y divide-border">
            {archivedReceitas.map((a) => (
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
