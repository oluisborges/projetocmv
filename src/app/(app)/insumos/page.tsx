import Link from "next/link";
import { Hint } from "@/components/hint";
import { SectionTabs } from "@/components/section-tabs";
import { SubmitButton } from "@/components/submit-button";
import { requireMember } from "@/lib/auth";
import { formatBRL, formatNumber } from "@/lib/format";
import { loadArchivedRecipes, loadReceitas, type ReceitaListItem } from "@/lib/recipes-data";
import { createClient } from "@/lib/supabase/server";
import { restoreRecipe } from "../marmitas/actions";
import { PriceList, type IngredientRow } from "./price-list";

export const metadata = { title: "Insumos" };

const button = "flex h-11 items-center justify-center rounded-xl border px-2 text-sm font-semibold";
const primary = "border-primary bg-primary text-primary-foreground";

type Tab = "todos" | "receitas" | "insumos" | "embalagens";
const TABS: { key: Tab; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "receitas", label: "Receitas" },
  { key: "insumos", label: "Insumos" },
  { key: "embalagens", label: "Embalagens" },
];

function ReceitaList({ receitas }: { receitas: ReceitaListItem[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        Receitas
        <Hint>O que você faz em lote (arroz, estrogonofe, purê) e usa em várias marmitas. O sal e o tempero ficam dentro do custo por kg.</Hint>
      </h2>
      <ul className="flex flex-col gap-2">
        {receitas.map((r) => (
          <li key={r.id}>
            <Link href={`/insumos/receitas/${r.id}`} className="flex flex-col gap-0.5 card p-4">
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-semibold">{r.name}</span>
                {r.costPerKg !== null ? <span className="tabular shrink-0 font-extrabold">{formatBRL(r.costPerKg)}/kg</span> : <span className="shrink-0 text-xs text-warning">incompleta</span>}
              </span>
              <span className="text-xs text-muted">
                {r.readyWeightGrams ? `rende ${formatNumber(r.readyWeightGrams / 1000, 2)} kg pronto` : "informe quanto rende"}
                {r.batchCost !== null ? ` · lote ${formatBRL(r.batchCost)}` : ""}
                {" · "}
                {r.usedIn === 0 ? "ainda não usada" : `usada em ${r.usedIn} ${r.usedIn === 1 ? "marmita" : "marmitas"}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function IngredientsPage(props: PageProps<"/insumos">) {
  const { orgId, canWrite } = await requireMember();
  const { importado, aba } = await props.searchParams;
  const tab: Tab = TABS.some((t) => t.key === aba) ? (aba as Tab) : "todos";

  const supabase = await createClient();
  const { data } = await supabase
    .from("ingredients")
    .select("id, name, category, kind, purchase_unit, purchase_qty, purchase_price, price_updated_at")
    .eq("org_id", orgId)
    .is("archived_at", null)
    .order("name");
  const [receitas, archivedReceitas] = await Promise.all([loadReceitas(), loadArchivedRecipes("receita")]);
  const all = (data ?? []) as IngredientRow[];

  // O que aparece na lista de preços depende da aba (receitas têm lista própria, com custo por kg).
  const items = tab === "insumos" ? all.filter((i) => i.kind === "insumo") : tab === "embalagens" ? all.filter((i) => i.kind === "embalagem") : tab === "receitas" ? [] : all;
  const pricedCount = items.filter((i) => Number(i.purchase_price) > 0).length;
  const missing = items.length - pricedCount;
  const showReceitas = tab === "todos" || tab === "receitas";
  const showPrices = tab !== "receitas";
  const optionLink = "inline-flex min-h-11 items-center justify-center text-sm font-semibold text-primary";

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Insumos</h1>
        <p className="text-muted">Toque no preço, digite o valor novo e pronto: salva sozinho.</p>
      </section>

      <SectionTabs
        ariaLabel="Tipos de item"
        active={tab}
        items={TABS.map((t) => ({ key: t.key, label: t.label, href: t.key === "todos" ? "/insumos" : `/insumos?aba=${t.key}` }))}
      />

      {importado === "fichas" ? (
        <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
          Fichas criadas em <Link href="/marmitas" className="tap-area font-semibold underline">Marmitas</Link>, com os insumos e as embalagens delas. Preencha aqui o preço que você paga em cada
          insumo e confira as gramas de cada produto.
        </p>
      ) : importado ? (
        <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
          Itens importados! Agora é só preencher o preço que você paga em cada um.
        </p>
      ) : null}

      {showPrices && items.length > 0 ? (
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
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-2 items-start gap-2">
            <Link href="/insumos/novo" className={`${button} ${primary}`}>
              + Novo insumo
            </Link>
            <Link href="/insumos/receitas/nova" className={`${button} ${primary}`}>
              + Nova receita
            </Link>
          </div>
          <details className="text-center">
            <summary className="inline-flex min-h-11 cursor-pointer items-center justify-center text-sm font-semibold text-muted">Mais opções</summary>
            <div className="flex flex-col">
              <Link href="/insumos/nfe" className={optionLink}>
                Importar nota fiscal (XML)
              </Link>
              <Link href="/insumos/catalogo" className={optionLink}>
                Importar do catálogo de insumos
              </Link>
              <Link href="/insumos/reajuste" className={optionLink}>
                Reajustar vários preços de uma vez (%)
              </Link>
            </div>
          </details>
        </div>
      ) : null}

      {showReceitas ? (
        receitas.length > 0 ? (
          <ReceitaList receitas={receitas} />
        ) : tab === "receitas" ? (
          <p className="card p-4 text-sm text-muted">
            Nenhuma receita ainda. Cadastre o que você faz em lote (arroz, feijão, estrogonofe): quanto entra cru e quanto sai pronto. Depois é só usar por grama nas marmitas.
          </p>
        ) : null
      ) : null}

      {showPrices ? (
        all.length === 0 ? (
          <div className="flex flex-col gap-3 card p-5">
            <h2 className="text-lg font-bold">Comece pelo catálogo de insumos</h2>
            <p className="text-sm text-muted">
              Escolha os insumos e embalagens que você usa e só preencha o preço de cada um. Dá muito menos trabalho do que cadastrar do zero.
            </p>
            {canWrite ? (
              <Link href="/insumos/catalogo" className="flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground">
                Escolher do catálogo
              </Link>
            ) : null}
          </div>
        ) : items.length === 0 ? (
          <p className="card p-4 text-sm text-muted">{tab === "embalagens" ? "Nenhuma embalagem cadastrada ainda." : "Nenhum insumo cadastrado ainda."}</p>
        ) : (
          <>
            {tab === "todos" && receitas.length > 0 ? <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Insumos e embalagens</h2> : null}
            <PriceList items={items} canWrite={canWrite} />
          </>
        )
      ) : null}

      {showReceitas && archivedReceitas.length > 0 ? (
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
