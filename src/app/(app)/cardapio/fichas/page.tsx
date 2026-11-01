import Link from "next/link";
import { MarmitasTabs } from "@/components/marmitas-tabs";
import { requireMember } from "@/lib/auth";
import { loadFichaOptions } from "@/lib/ficha-tecnica-data";
import { hasMenuConnection } from "@/lib/menu-data";
import { FichasList } from "./fichas-list";

export const metadata = { title: "Fichas técnicas" };

export default async function FichasTecnicasPage() {
  const { orgId, canWrite } = await requireMember();
  const [options, connected] = await Promise.all([loadFichaOptions(orgId, canWrite), hasMenuConnection(orgId)]);

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Cardápio</h1>
        <p className="text-muted">Fichas técnicas para imprimir: escolha um produto ou receita, toque em Baixar ficha técnica, monte o modelo e baixe em PDF ou Excel, com a sua marca.</p>
      </section>

      <MarmitasTabs active="fichas" showCombos connected={connected} />

      {options.length === 0 ? (
        <p className="card p-4 text-sm">
          Você ainda não tem produtos nem receitas. Crie em{" "}
          <Link href="/cardapio/nova" className="tap-area font-semibold text-primary underline">
            Cardápio
          </Link>{" "}
          ou{" "}
          <Link href="/ingredientes" className="tap-area font-semibold text-primary underline">
            Ingredientes
          </Link>
          .
        </p>
      ) : (
        <FichasList options={options} />
      )}

      <p className="text-xs text-muted">
        Use o modelo Cozinha para quem prepara (pesos e modo de preparo, sem valores) e o Financeiro para quem cuida do custo (FC, custos, preço de venda e CMV). Sua escolha fica salva neste aparelho.
      </p>
    </>
  );
}
