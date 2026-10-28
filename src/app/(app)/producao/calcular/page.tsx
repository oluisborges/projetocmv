import { ProducaoTabs } from "@/components/producao-tabs";
import { requireMember } from "@/lib/auth";
import { loadProductionBase } from "@/lib/production-data";
import { Calculator } from "./calculator";

export const metadata = { title: "Calcular produção" };

export default async function CalcularPage() {
  const { orgId, canWrite } = await requireMember();
  const base = await loadProductionBase(orgId, canWrite);

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Produção</h1>
        <p className="text-muted">Diga quantas marmitas quer fazer e veja o que preparar e o que comprar.</p>
      </section>

      <ProducaoTabs active="calcular" />

      {base ? (
        <Calculator
          base={{ recipes: base.recipes, ingredients: base.ingredients, receitas: base.receitas, stock: base.stock }}
          finished={Object.fromEntries(Object.entries(base.finished).map(([id, b]) => [id, { balance: b.balance, known: b.known }]))}
          incomplete={base.incomplete}
        />
      ) : (
        <p className="card p-4 text-sm">Sua marmitaria ainda não tem uma unidade cadastrada. Fale com o suporte do Precificaí.</p>
      )}
    </>
  );
}
