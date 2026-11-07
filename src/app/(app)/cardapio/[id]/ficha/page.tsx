import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/back-link";
import { BaixarFichaButton } from "@/components/baixar-ficha";
import { FichaItems } from "@/components/ficha-items";
import { InstructionsCard } from "@/components/instructions-card";
import { MontagemOrder } from "@/components/montagem-order";
import { PhotoCard } from "@/components/photo-card";
import { ProductTabs } from "@/components/product-tabs";
import { requireMember } from "@/lib/auth";
import { fichaItems, loadFichaTecnica } from "@/lib/ficha-tecnica-data";

export const metadata = { title: "Ficha de montagem" };

export default async function ProductFichaPage(props: PageProps<"/cardapio/[id]/ficha">) {
  const { orgId, canWrite } = await requireMember();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const ficha = await loadFichaTecnica(orgId, canWrite, id, true);
  if (!ficha || ficha.kind !== "marmita") notFound();

  const ordered = ficha.lines.flatMap((l) => (l.id ? [{ id: l.id, name: l.name, net: l.net, tag: l.tag === "receita" ? ("receita" as const) : ("insumo" as const) }] : []));

  return (
    <>
      <BackLink href="/cardapio">Cardápio</BackLink>
      <h1 className="text-2xl font-extrabold tracking-tight">{ficha.name}</h1>

      <ProductTabs id={ficha.id} active="ficha" />

      <section className="flex flex-col gap-3 card p-4">
        <div>
          <h2 className="font-semibold">Ficha de montagem para imprimir</h2>
          <p className="text-sm text-muted">Escolha o modelo (Cozinha ou Financeiro), veja como fica e baixe em PDF ou Excel, com a sua marca.</p>
        </div>
        <BaixarFichaButton id={ficha.id} name={ficha.name} kind={ficha.kind} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Ordem de montagem</h2>
        <MontagemOrder recipeId={ficha.id} items={ordered} ordered={ficha.lines.some((l) => l.order !== null)} canWrite={canWrite} />
        {ficha.packaging.length > 0 ? (
          <>
            <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">Embalagem</h3>
            <FichaItems items={fichaItems({ ...ficha, lines: [] })} />
          </>
        ) : null}
      </section>

      <PhotoCard recipeId={ficha.id} initial={ficha.photo} canWrite={canWrite} />
      <InstructionsCard recipeId={ficha.id} initial={ficha.instructions} kind="marmita" canWrite={canWrite} />
    </>
  );
}
