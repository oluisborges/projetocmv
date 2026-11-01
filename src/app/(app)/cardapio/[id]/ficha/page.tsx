import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/back-link";
import { BaixarFichaButton } from "@/components/baixar-ficha";
import { FichaItems } from "@/components/ficha-items";
import { ProductTabs } from "@/components/product-tabs";
import { requireMember } from "@/lib/auth";
import { fichaItems, loadFichaTecnica } from "@/lib/ficha-tecnica-data";

export const metadata = { title: "Ficha técnica" };

export default async function ProductFichaPage(props: PageProps<"/cardapio/[id]/ficha">) {
  const { orgId, canWrite } = await requireMember();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const ficha = await loadFichaTecnica(orgId, canWrite, id);
  if (!ficha || ficha.kind !== "marmita") notFound();

  return (
    <>
      <BackLink href="/cardapio">Cardápio</BackLink>
      <h1 className="text-2xl font-extrabold tracking-tight">{ficha.name}</h1>

      <ProductTabs id={ficha.id} active="ficha" />

      <section className="flex flex-col gap-3 card p-4">
        <div>
          <h2 className="font-semibold">Ficha técnica para imprimir</h2>
          <p className="text-sm text-muted">Escolha o modelo (Cozinha ou Financeiro), veja como fica e baixe em PDF ou Excel, com a sua marca.</p>
        </div>
        <BaixarFichaButton id={ficha.id} name={ficha.name} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">O que vai neste produto</h2>
        <FichaItems items={fichaItems(ficha)} />
      </section>
    </>
  );
}
