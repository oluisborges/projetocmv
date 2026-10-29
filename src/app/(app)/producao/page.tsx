import Link from "next/link";
import { ProducaoTabs } from "@/components/producao-tabs";
import { SubmitButton } from "@/components/submit-button";
import { requireMember } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { loadProductionBase, loadProductions, type Production } from "@/lib/production-data";
import { productionDateLabel as dateLabel, productionName } from "@/lib/production-view";
import { createProduction } from "./actions";
import { requireProductionAccess } from "@/lib/production-access";

export const metadata = { title: "Produção" };

const totalOf = (p: Production, key: "planned" | "produced") => p.items.reduce((n, i) => n + (key === "planned" ? i.planned : (i.produced ?? 0)), 0);

export default async function ProducaoPage() {
  await requireProductionAccess();
  const { orgId, canWrite } = await requireMember();
  const base = await loadProductionBase(orgId, canWrite);

  const header = (
    <section className="flex flex-col gap-1">
      <h1 className="text-2xl font-extrabold tracking-tight">Produção</h1>
      <p className="text-muted">Decida o que fazer, veja o que preparar e o que comprar. Você pode montar quantas produções quiser.</p>
    </section>
  );

  if (!base) {
    return (
      <>
        {header}
        <p className="card p-4 text-sm">Sua marmitaria ainda não tem uma unidade cadastrada. Fale com o suporte do Precificaí.</p>
      </>
    );
  }

  const productions = await loadProductions(orgId, base.unitId);
  const inProgress = productions.filter((p) => p.status !== "produced");
  const made = productions.filter((p) => p.status === "produced");
  const counted = Object.values(base.stock).filter((b) => b.lastCountAt).length;
  const trackable = Object.values(base.ingredients).filter((i) => i.kind !== "receita").length;

  const row = (p: Production) => (
    <li key={p.id}>
      <Link href={`/producao/${p.id}`} className="flex items-center justify-between gap-3 card p-4">
        <span className="min-w-0">
          <span className="block truncate font-semibold">{productionName(p)}</span>
          <span className="block text-xs text-muted">
            {dateLabel(p.plannedFor)} · {p.items.length} {p.items.length === 1 ? "marmita" : "marmitas"}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="tabular block font-extrabold">{formatNumber(p.status === "produced" ? totalOf(p, "produced") : totalOf(p, "planned"), 0)} un</span>
          <span className={`block text-xs ${p.status === "produced" ? "text-success" : "text-warning"}`}>{p.status === "produced" ? "feita" : "em montagem"}</span>
        </span>
      </Link>
    </li>
  );

  return (
    <>
      {header}
      <ProducaoTabs active="producoes" />

      {canWrite ? (
        <section className="flex flex-col gap-2 card p-4">
          <p className="font-semibold">{inProgress.length > 0 ? "Quer começar outra produção?" : "Vamos montar uma produção?"}</p>
          <p className="text-sm text-muted">O sistema sugere as marmitas e as quantidades pelas suas vendas; você ajusta. Depois mostra o que preparar e o que comprar.</p>
          <form action={createProduction} className="flex flex-col gap-2">
            <input type="hidden" name="mode" value="suggestion" />
            <SubmitButton pendingLabel="Montando…" className="h-12 rounded-xl bg-primary font-semibold text-primary-foreground">
              Nova produção com sugestão
            </SubmitButton>
          </form>
          <form action={createProduction}>
            <input type="hidden" name="mode" value="blank" />
            <SubmitButton pendingLabel="Criando…" className="h-11 w-full rounded-xl border border-border bg-surface text-sm font-semibold">
              Começar do zero
            </SubmitButton>
          </form>
        </section>
      ) : null}

      {inProgress.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Em montagem</h2>
          <ul className="flex flex-col gap-2">{inProgress.map(row)}</ul>
        </section>
      ) : null}

      {made.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Feitas</h2>
          <ul className="flex flex-col gap-2">{made.map(row)}</ul>
        </section>
      ) : null}

      {trackable > 0 && counted < trackable ? (
        <p className="rounded-xl bg-background px-4 py-3 text-sm text-muted">
          Estoque contado: <strong className="text-foreground">{counted} de {trackable}</strong> itens. Quanto mais certo o estoque, mais certa a lista de compras.{" "}
          <Link href="/producao/estoque" className="font-semibold text-primary underline">
            Conferir o estoque
          </Link>
        </p>
      ) : null}
    </>
  );
}
