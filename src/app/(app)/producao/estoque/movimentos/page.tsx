import Link from "next/link";
import { EstoqueTabs } from "@/components/estoque-tabs";
import { MonthChips } from "@/components/month-chips";
import { ProducaoTabs } from "@/components/producao-tabs";
import { requireMember } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { currentMonthStart, lastMonths, monthLabel, monthStart } from "@/lib/month-view";
import { requireProductionAccess } from "@/lib/production-access";
import { activeUnit } from "@/lib/pricing-data";
import { MOVE_KINDS, countByKind, filterMoves, isMoveKind, moveQtyText, type MoveKind } from "@/lib/stock-moves";
import { loadMoves } from "@/lib/stock-moves-data";

export const metadata = { title: "Movimentos do estoque" };

const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const TONE: Record<MoveKind, string> = { purchase: "bg-success/10 text-success", produced: "bg-success/10 text-success", count: "bg-primary/10 text-primary", production: "bg-black/10 text-muted", waste: "bg-danger/10 text-danger", adjust: "bg-warning/10 text-warning" };

export default async function MovimentosPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireProductionAccess();
  const { orgId } = await requireMember();
  const sp = await props.searchParams;
  const now = currentMonthStart();
  const month = monthStart(typeof sp.mes === "string" ? sp.mes : undefined) ?? now;
  const kind = isMoveKind(sp.tipo) ? sp.tipo : null;
  const query = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  const unit = await activeUnit(orgId);

  const months = lastMonths(now, 6);
  if (!months.includes(month)) months.push(month);
  months.sort().reverse();

  const header = (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Produção</h1>
        <p className="text-muted">Tudo o que mexeu no estoque, do mais novo ao mais antigo: compras, contagens, uso na produção, perdas e marmitas produzidas.</p>
      </section>
      <ProducaoTabs active="estoque" />
      <EstoqueTabs active="movimentos" />
    </>
  );

  if (!unit) {
    return (
      <>
        {header}
        <p className="card p-4 text-sm">Sua marmitaria ainda não tem uma unidade cadastrada. Fale com o suporte do Precificaí.</p>
      </>
    );
  }

  const { rows: all, truncated } = await loadMoves(orgId, unit.id, month);
  // Os números das pílulas seguem a busca; o filtro de tipo só escolhe o que a lista mostra.
  const searched = filterMoves(all, { query });
  const counts = countByKind(searched);
  const rows = filterMoves(all, { kind, query });
  const href = (over: { tipo?: string | null; q?: string | null }) => {
    const p = new URLSearchParams();
    p.set("mes", month.slice(0, 7));
    const t = over.tipo === undefined ? kind : over.tipo;
    const q = over.q === undefined ? query : over.q;
    if (t) p.set("tipo", t);
    if (q) p.set("q", q);
    return `/producao/estoque/movimentos?${p.toString()}`;
  };
  const chip = (on: boolean) => `flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`;

  return (
    <>
      {header}

      <MonthChips months={months} current={month} basePath="/producao/estoque/movimentos" />
      <h2 className="text-lg font-bold first-letter:uppercase">{monthLabel(month)}</h2>

      <div role="group" aria-label="Tipo de movimento" className="-mx-4 flex gap-2 no-scrollbar overflow-x-auto px-4 pb-1">
        <Link href={href({ tipo: null })} aria-current={!kind ? "page" : undefined} className={chip(!kind)}>
          Todos ({searched.length})
        </Link>
        {MOVE_KINDS.filter((k) => counts[k.key] > 0 || kind === k.key).map((k) => (
          <Link key={k.key} href={href({ tipo: k.key })} aria-current={kind === k.key ? "page" : undefined} className={chip(kind === k.key)}>
            {k.plural} ({counts[k.key]})
          </Link>
        ))}
      </div>

      <form action="/producao/estoque/movimentos" className="flex gap-2">
        <input type="hidden" name="mes" value={month.slice(0, 7)} />
        {kind ? <input type="hidden" name="tipo" value={kind} /> : null}
        <input type="search" name="q" defaultValue={query} placeholder="Buscar insumo ou marmita…" aria-label="Buscar" className="h-12 min-w-0 flex-1 card px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        <button type="submit" className="h-12 rounded-xl border border-border bg-surface px-4 text-sm font-semibold">
          Buscar
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="card p-4 text-sm text-muted">{all.length === 0 ? "Nenhum movimento neste mês ainda. Contagens, compras, perdas e produções aparecem aqui." : "Nada encontrado com esse filtro."}</p>
      ) : (
        <ul className="divide-y divide-border card px-4">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.name}</p>
                <p className="text-xs text-muted">
                  <span className={`mr-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[r.kind]}`}>{MOVE_KINDS.find((k) => k.key === r.kind)?.label}</span>
                  {when(r.at)}
                  {r.note ? ` · ${r.note}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular font-extrabold">{moveQtyText(r)}</p>
                {r.paid !== null ? <p className="tabular text-xs text-muted">pagou {formatBRL(r.paid)}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {truncated ? <p className="text-xs text-muted">Mostrando os 500 movimentos mais recentes do mês. Use o filtro para achar um mais antigo.</p> : null}
    </>
  );
}
