import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PriceList, type IngredientRow } from "./price-list";

export const metadata = { title: "Insumos" };

const button = "flex h-11 items-center justify-center rounded-xl border px-2 text-sm font-semibold";
const secondary = "border-border bg-surface";
const primary = "border-primary bg-primary text-primary-foreground";

export default async function IngredientsPage(props: PageProps<"/insumos">) {
  const { canWrite } = await requireMember();
  const { importado } = await props.searchParams;

  const supabase = await createClient();
  const { data } = await supabase
    .from("ingredients")
    .select("id, name, category, kind, purchase_unit, purchase_qty, purchase_price, price_updated_at")
    .is("archived_at", null)
    .order("name");
  const items = (data ?? []) as IngredientRow[];
  const pricedCount = items.filter((i) => Number(i.purchase_price) > 0).length;
  const missing = items.length - pricedCount;

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Insumos</h1>
        <p className="text-muted">Toque no preço, digite o valor novo e pronto: salva sozinho.</p>
      </section>

      {importado === "fichas" ? (
        <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
          Fichas criadas em <Link href="/fichas" className="font-semibold underline">Fichas</Link>, com os insumos e as embalagens delas. Preencha aqui o preço que você paga em cada
          insumo e confira as gramas de cada produto.
        </p>
      ) : importado ? (
        <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
          Itens importados! Agora é só preencher o preço que você paga em cada um.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="flex flex-col gap-1.5" role="status">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold">{missing === 0 ? "Todos os preços preenchidos" : `${pricedCount} de ${items.length} com preço`}</span>
            {missing > 0 ? <span className="text-muted">faltam {missing}</span> : <span className="text-success">✓</span>}
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-border" aria-hidden>
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(pricedCount / items.length) * 100}%` }} />
          </div>
        </div>
      ) : null}

      {canWrite ? (
        <div className="grid grid-cols-3 gap-2">
          <Link href="/insumos/novo" className={`${button} ${primary}`}>
            + Novo
          </Link>
          <Link href="/insumos/reajuste" className={`${button} ${secondary}`}>
            Reajustar
          </Link>
          <Link href="/insumos/catalogo" className={`${button} ${secondary}`}>
            Catálogo
          </Link>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-lg font-bold">Comece pelo catálogo da Shogun</h2>
          <p className="text-sm text-muted">
            Escolha os insumos e embalagens que você usa e só preencha o preço de cada um. Dá muito menos trabalho do que cadastrar do zero.
          </p>
          {canWrite ? (
            <Link href="/insumos/catalogo" className="flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground">
              Escolher do catálogo
            </Link>
          ) : null}
        </div>
      ) : (
        <PriceList items={items} canWrite={canWrite} />
      )}
    </>
  );
}
