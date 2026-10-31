import Link from "next/link";
import { ProducaoTabs } from "@/components/producao-tabs";
import { requireMember } from "@/lib/auth";
import { loadFichaOptions } from "@/lib/ficha-tecnica-data";
import { requireProductionAccess } from "@/lib/production-access";
import { FichasList } from "./fichas-list";

export const metadata = { title: "Fichas técnicas" };

export default async function FichasTecnicasPage() {
  await requireProductionAccess();
  const { orgId, canWrite } = await requireMember();
  const options = await loadFichaOptions(orgId, canWrite);

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Produção</h1>
        <p className="text-muted">Fichas técnicas para imprimir: escolha um produto ou receita e baixe em PDF ou Excel, com a marca da sua marmitaria.</p>
      </section>

      <ProducaoTabs active="fichas" />

      {options.length === 0 ? (
        <p className="card p-4 text-sm">
          Você ainda não tem produtos nem receitas. Crie em{" "}
          <Link href="/cardapio" className="tap-area font-semibold text-primary underline">
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
        A ficha leva os pesos líquido e bruto de cada ingrediente, o custo, o preço de venda e o CMV (nos produtos), e um espaço em branco para o modo de preparo.
      </p>
    </>
  );
}
