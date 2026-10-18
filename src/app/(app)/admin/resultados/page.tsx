import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { countOpenErrors } from "@/lib/errors/data";
import { currentMonthStart, lastMonths, monthLabel, monthStart } from "@/lib/month-view";
import { loadNetwork } from "@/lib/network-data";
import { boardRow } from "@/lib/network-board";
import { buildInsights, summarizeNetwork } from "@/lib/network-view";
import { AdminTabs } from "../admin-tabs";
import { ClientsBoard } from "./clients-board";
import { AdoptionFunnel, InsightList, NetworkKpis, RevenueChart, shortMonth } from "./sections";

export const metadata = { title: "Resultados da rede" };

export default async function NetworkPage(props: PageProps<"/admin/resultados">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const now = new Date();
  const current = currentMonthStart(now);
  const month = monthStart(typeof sp.mes === "string" ? sp.mes : undefined) ?? current;
  // do mais novo ao mais antigo, e nunca um mês no futuro
  const months = lastMonths(current, 6);
  const chosen = month > current ? current : month;
  if (!months.includes(chosen)) months.push(chosen);
  months.sort().reverse();

  const data = await loadNetwork(chosen);
  const totals = summarizeNetwork(data.clients, chosen, now);
  const insights = buildInsights(data.clients, chosen, now);
  const rows = data.clients.map((c) => boardRow(c, chosen, now));

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Painel Shogun</h1>
        <p className="text-muted">Como a rede está vendendo, quanto sobra e quem precisa de ajuda.</p>
      </section>

      <AdminTabs active="results" errorCount={await countOpenErrors()} />

      <div>
        <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted">Mês</p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {months.slice(0, 6).map((m) => {
            const on = m === chosen;
            return (
              <Link
                key={m}
                href={`/admin/resultados?mes=${m.slice(0, 7)}`}
                aria-current={on ? "page" : undefined}
                className={`flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`}
              >
                {shortMonth(m)}
              </Link>
            );
          })}
        </div>
        <h2 className="pt-3 text-lg font-bold first-letter:uppercase">{monthLabel(chosen)}</h2>
      </div>

      {data.clients.length === 0 ? (
        <p className="card p-4 text-sm text-muted">Ainda não há clientes. Crie a primeira marmitaria na aba Clientes.</p>
      ) : (
        <>
          <NetworkKpis totals={totals} />
          <RevenueChart series={data.series} selected={chosen} />
          <InsightList insights={insights} />
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Clientes</h2>
            <ClientsBoard rows={rows} />
          </section>
          <AdoptionFunnel clients={data.clients} />
        </>
      )}
    </>
  );
}
