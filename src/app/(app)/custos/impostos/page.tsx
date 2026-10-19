import { CostsTabs } from "@/components/costs-tabs";
import { requireMember } from "@/lib/auth";
import { Hint } from "@/components/hint";
import { hasMenuConnection } from "@/lib/menu-data";
import { loadPricingContext } from "@/lib/pricing-data";
import { AddChannelForm, ChannelRow, SettingsForm } from "./forms";

export const metadata = { title: "Impostos e meta de lucro" };

export default async function PricingSettingsPage() {
  const { orgId, canWrite } = await requireMember();
  const ctx = await loadPricingContext(orgId, canWrite);
  const connected = await hasMenuConnection(orgId);

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Custos</h1>
        <p className="text-muted">Impostos, taxas e a meta de lucro: esses números entram na conta do lucro de todos os produtos.</p>
      </section>
      <CostsTabs active="taxes" menu={connected} />

      {!ctx ? (
        <p className="card p-4 text-sm">Sua marmitaria ainda não tem uma unidade cadastrada. Fale com o suporte do Precificaí.</p>
      ) : canWrite ? (
        <>
          <SettingsForm settings={ctx.settings} fixedAuto={ctx.fixedAuto} configured={ctx.configured} />

          <section className="flex flex-col gap-3 pt-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
              Canais de venda
              <Hint>
                Cada lugar onde você vende cobra uma taxa diferente: cartão, iFood, aplicativo próprio. O app calcula o preço certo para cada um. Venda direta,
                sem taxa, deixe em 0%.
              </Hint>
            </h2>
            <ul className="divide-y divide-border card px-4">
              {ctx.channels.map((c) => (
                <ChannelRow key={c.id} channel={c} />
              ))}
            </ul>
            <AddChannelForm />
          </section>
        </>
      ) : (
        <p className="card p-4 text-sm">Só quem tem acesso de gerente ou dono altera os ajustes.</p>
      )}
    </>
  );
}
