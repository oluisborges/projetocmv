import Link from "next/link";
import { MarginBadge } from "@/components/margin-badge";
import { formatBRL, formatPct } from "@/lib/format";
import type { Dashboard } from "@/lib/dashboard-data";

const card = "flex flex-col gap-1 rounded-xl border border-border bg-surface p-4";

function Kpi({ label, value, hint, tone = "default", href }: { label: string; value: string; hint?: string; tone?: "default" | "bad"; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={`tabular text-2xl font-extrabold tracking-tight ${tone === "bad" ? "text-danger" : ""}`}>{value}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </>
  );
  return href ? (
    <Link href={href} className={`${card} min-h-11`}>
      {body}
    </Link>
  ) : (
    <div className={card}>{body}</div>
  );
}

/** Painel do Início: o que o dono precisa ver em 10 segundos. Só aparece quando já há marmita com preço. */
export function DashboardView({ data, variant = "full" }: { data: Dashboard; variant?: "full" | "alerts" }) {
  const { ctx, month } = data;
  const estimate = !ctx.configured;

  const worst = data.dishes
    .filter((d) => d.analysis?.at)
    .sort((a, b) => a.analysis!.at!.netPct - b.analysis!.at!.netPct)
    .slice(0, 5);

  const alerts: { key: string; tone: "bad" | "warn"; text: React.ReactNode; href: string; cta: string }[] = [];
  if (data.belowTarget.length > 0) {
    const names = data.belowTarget.slice(0, 2).map((d) => d.name).join(", ");
    alerts.push({
      key: "below",
      tone: "bad",
      text: (
        <>
          <strong>
            {data.belowTarget.length} {data.belowTarget.length === 1 ? "marmita está" : "marmitas estão"} abaixo da sua meta de lucro
          </strong>{" "}
          ({names}
          {data.belowTarget.length > 2 ? "…" : ""})
        </>
      ),
      href: "/precificacao",
      cta: "Ajustar preços",
    });
  }
  for (const inc of data.increases.slice(0, 3)) {
    alerts.push({
      key: `inc-${inc.ingredientId}`,
      tone: "warn",
      text: (
        <>
          <strong>{inc.name} subiu {formatPct(inc.pct, 0)}</strong> nos últimos dias
          {inc.recipes > 0 ? `: afeta ${inc.recipes} ${inc.recipes === 1 ? "marmita" : "marmitas"}` : ""}
        </>
      ),
      href: "/insumos",
      cta: "Ver insumos",
    });
  }
  if (data.noPriceCount > 0) {
    alerts.push({
      key: "noprice",
      tone: "warn",
      text: (
        <>
          <strong>{data.noPriceCount} {data.noPriceCount === 1 ? "insumo sem preço" : "insumos sem preço"}</strong>: o custo das marmitas está incompleto
        </>
      ),
      href: "/insumos",
      cta: "Preencher",
    });
  }
  if (data.staleCount > 0) {
    alerts.push({
      key: "stale",
      tone: "warn",
      text: (
        <>
          <strong>{data.staleCount} {data.staleCount === 1 ? "preço de insumo" : "preços de insumos"} sem atualizar há mais de 30 dias</strong>
        </>
      ),
      href: "/insumos",
      cta: "Atualizar",
    });
  }
  if (month.deviationCost !== null && month.deviationPct !== null && month.deviationPct >= 0.03) {
    alerts.push({
      key: "gap",
      tone: "bad",
      text: (
        <>
          <strong>Você gastou {formatBRL(month.deviationCost)} a mais em insumos</strong> do que as vendas do mês explicam
        </>
      ),
      href: "/custos/mes",
      cta: "Ver o mês",
    });
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Painel">
      {variant === "full" ? (
      <div className="grid grid-cols-2 gap-3">
        <Kpi
          label="Lucro médio"
          value={data.avgNetPct !== null ? formatPct(data.avgNetPct) : "—"}
          hint={estimate ? "estimativa: faltam impostos" : `por marmita, vendendo por ${data.channelName}`}
          href="/precificacao"
        />
        <Kpi
          label="Abaixo da meta"
          value={String(data.belowTarget.length)}
          hint={`de ${data.pricedCount} ${data.pricedCount === 1 ? "marmita com preço" : "marmitas com preço"}`}
          tone={data.belowTarget.length > 0 && !estimate ? "bad" : "default"}
          href="/precificacao"
        />
        <Kpi
          label="Gasto com insumos"
          value={month.cmvRealPct !== null ? formatPct(month.cmvRealPct) : "—"}
          hint={month.cmvRealPct !== null ? "do faturamento neste mês" : "informe o mês em Custos"}
          href="/custos/mes"
        />
        <Kpi
          label="Mão de obra"
          value={month.cmoPct !== null ? formatPct(month.cmoPct) : "—"}
          hint={month.cmoPct !== null ? "do faturamento neste mês" : "equipe e faturamento em Custos"}
          href="/custos"
        />
      </div>
      ) : null}

      {alerts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Atenção</h2>
          <ul className="flex flex-col gap-2">
            {alerts.map((a) => (
              <li key={a.key} className={`flex items-center justify-between gap-3 rounded-xl p-3 text-sm ${a.tone === "bad" ? "bg-danger/10" : "bg-warning/10"}`}>
                <p className="min-w-0 flex-1 leading-snug">{a.text}</p>
                <Link href={a.href} className="flex h-11 shrink-0 items-center rounded-lg border border-border bg-surface px-3 font-semibold">
                  {a.cta}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-xl bg-success/10 p-3 text-sm text-success">Nada pedindo atenção agora. Preços em dia e marmitas dentro da meta.</p>
      )}

      {variant === "full" && worst.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Das que dão menos lucro para as que dão mais</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-4">
            {worst.map((d) => (
              <li key={d.id}>
                <Link href={`/precificacao/${d.id}`} className="flex min-h-14 items-center justify-between gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-medium leading-snug">{d.name}</span>
                    <span className="tabular text-xs text-muted">
                      {d.analysis!.at!.net >= 0 ? "sobra" : "falta"} {formatBRL(Math.abs(d.analysis!.at!.net))} por marmita
                    </span>
                  </span>
                  <MarginBadge status={d.analysis!.at!.status} pct={d.analysis!.at!.netPct} estimate={estimate} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
