import Link from "next/link";
import { Hint } from "@/components/hint";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import type { Dashboard } from "@/lib/dashboard-data";

const card = "flex flex-col gap-1 rounded-xl border border-border bg-surface p-4";

type Part = { key: string; label: string; pct: number; swatch: string; hint: string };

function Tile({ label, value, hint, help, tone = "default" }: { label: string; value: string; hint?: string; help: React.ReactNode; tone?: "default" | "bad" | "good" }) {
  return (
    <div className={card}>
      <p className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
        <Hint label={`O que é ${label}?`}>{help}</Hint>
      </p>
      <p className={`tabular text-2xl font-extrabold tracking-tight ${tone === "bad" ? "text-danger" : tone === "good" ? "text-success" : ""}`}>{value}</p>
      {hint ? <p className="line-clamp-2 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/** Painel completo: números do dia a dia, sempre em "% do preço de venda", com o jeito de ler ao lado. */
export function PainelView({ data }: { data: Dashboard }) {
  const { ctx, panel, month, breakEven } = data;
  const estimate = !ctx.configured;

  if (!panel) {
    return (
      <p className="rounded-xl border border-border bg-surface p-4 text-sm">
        O painel aparece quando você tiver pelo menos uma marmita com custo e preço de venda. <Link href="/precificacao" className="font-semibold text-primary underline">Definir preços</Link>
      </p>
    );
  }

  const c = panel.composition;
  const highest = panel.cmvRanking[0];
  const lowest = panel.cmvRanking[panel.cmvRanking.length - 1];
  const parts: Part[] = [
    { key: "cmv", label: "Ingredientes e embalagem (CMV)", pct: c.cmv, swatch: "bg-primary", hint: "O que você gasta em insumos e embalagem para fazer a marmita." },
    { key: "cmo", label: "Equipe (CMO)", pct: c.cmo, swatch: "bg-[#4d7c6f]", hint: "Salários e encargos da equipe." },
    { key: "fixed", label: "Despesas fixas", pct: c.fixed, swatch: "bg-[#a3a8a6]", hint: "Aluguel, energia, gás e outras contas que não mudam com a venda." },
    { key: "commercial", label: "Impostos e taxas de venda", pct: c.commercial, swatch: "bg-warning", hint: "Imposto sobre a venda e taxa do canal (cartão, aplicativo)." },
    { key: "profit", label: "Lucro líquido", pct: c.profit, swatch: c.profit >= 0 ? "bg-success" : "bg-danger", hint: "O que sobra no seu bolso depois de pagar tudo." },
  ];
  const belowGoal = c.profit < ctx.settings.minMarginPct;
  const barParts = parts.filter((p) => p.pct > 0);
  const barTotal = barParts.reduce((s, p) => s + p.pct, 0) || 1;
  const maxCmv = highest.pct || 1;

  return (
    <div className="flex flex-col gap-5">
      {estimate ? (
        <p className="rounded-xl bg-warning/10 p-3 text-sm">
          <strong>Números aproximados:</strong> faltam impostos e despesas.{" "}
          <Link href="/precificacao/ajustes" className="font-semibold text-primary underline">
            Informar agora
          </Link>
        </p>
      ) : null}

      <section aria-label="Lucro líquido" className="flex flex-col gap-3 rounded-2xl bg-primary p-5 text-primary-foreground">
        <p className="flex items-center text-sm font-semibold uppercase tracking-wider opacity-90">
          Lucro líquido médio
          <Hint label="O que é lucro líquido?">Em média, quanto sobra de cada R$ 100 vendidos depois de pagar ingredientes, equipe, despesas, impostos e taxas.</Hint>
        </p>
        <p className="flex flex-wrap items-center gap-3">
          <span className="tabular text-5xl font-extrabold tracking-tight">{formatPct(c.profit)}</span>
          {!estimate ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-primary">{belowGoal ? "Abaixo da meta" : "Dentro da meta"}</span>
          ) : null}
        </p>
        <p className="text-sm opacity-90">
          Em cada R$ 100 que você vende, sobram <strong>{formatBRL(c.profit * 100)}</strong>
          {" · "}meta mínima {formatPct(ctx.settings.minMarginPct, 0)}
          {estimate ? " · estimativa" : ""}
        </p>
        <p className="text-xs opacity-80">Média de {panel.count} {panel.count === 1 ? "marmita com preço" : "marmitas com preço"}, vendendo por {data.channelName}.</p>
      </section>

      <section aria-label="Para onde vai cada real" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Para onde vai cada R$ 100 que você vende</h2>
        <div className="flex h-5 overflow-hidden rounded-full bg-border" role="img" aria-label={parts.map((p) => `${p.label}: ${formatPct(p.pct)}`).join(", ")}>
          {barParts.map((p) => (
            <span key={p.key} className={`${p.swatch} h-full`} style={{ width: `${(Math.max(p.pct, 0) / barTotal) * 100}%` }} />
          ))}
        </div>
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface px-4">
          {parts.map((p) => (
            <li key={p.key} className="flex items-center gap-3 py-3">
              <span aria-hidden className={`size-3.5 shrink-0 rounded-full ${p.swatch}`} />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="text-sm font-medium">{p.label}</span>
                <span className="text-xs text-muted">{p.hint}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end leading-tight">
                <span className="tabular font-bold">{formatPct(p.pct)}</span>
                <span className="tabular text-xs text-muted">{formatBRL(p.pct * 100)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3">
        <Tile
          label="CMV médio"
          value={formatPct(c.cmv)}
          hint={month.cmvRealPct !== null ? `No mês, pelas compras: ${formatPct(month.cmvRealPct)}` : "do preço, em ingredientes e embalagem"}
          help="CMV é quanto do preço de venda vai para ingredientes e embalagem. Quanto menor, mais sobra para o resto."
        />
        <Tile
          label="CMO"
          value={formatPct(c.cmo)}
          hint={month.cmoPct !== null ? `No mês, com o faturamento real: ${formatPct(month.cmoPct)}` : ctx.staffTotal > 0 ? `${formatBRL(ctx.staffTotal)} por mês de equipe` : "cadastre a equipe em Custos"}
          help="CMO é quanto do preço de venda paga a equipe (salário mais encargos)."
        />
        {highest ? (
          <Tile label="CMV mais alto" value={formatPct(highest.pct)} hint={highest.name} tone={panel.cmvRanking.length > 1 ? "bad" : "default"} help="A marmita que gasta mais em ingredientes em relação ao preço. Candidata a rever receita ou preço." />
        ) : null}
        {lowest ? (
          <Tile label="CMV mais baixo" value={formatPct(lowest.pct)} hint={lowest.name} tone={panel.cmvRanking.length > 1 ? "good" : "default"} help="A marmita que gasta menos em ingredientes em relação ao preço. A que mais deixa sobrar." />
        ) : null}
        <Tile
          label="Despesas fixas"
          value={formatPct(c.fixed)}
          hint={ctx.fixedTotal - ctx.staffTotal > 0 ? `${formatBRL(ctx.fixedTotal - ctx.staffTotal)} por mês, sem a equipe` : "cadastre em Custos"}
          help="Contas que você paga todo mês, vendendo muito ou pouco: aluguel, energia, gás, internet."
        />
        <Tile
          label="Impostos e taxas"
          value={formatPct(c.commercial)}
          hint={`${formatPct(ctx.settings.taxPct)} de imposto + ${formatPct(c.commercial - ctx.settings.taxPct)} de taxa de venda`}
          help="Imposto sobre a venda mais a taxa do canal (maquininha, aplicativo de entrega)."
        />
      </section>

      <section aria-label="Marmitas por CMV" className="flex flex-col gap-3">
        <h2 className="flex items-center text-sm font-semibold uppercase tracking-wider text-muted">
          CMV de cada marmita
          <Hint label="Como ler?">Quanto de cada R$ 100 do preço vai para ingredientes e embalagem. Barras maiores pedem atenção.</Hint>
        </h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-4">
          {panel.cmvRanking.slice(0, 8).map((d, i) => (
            <li key={d.id}>
              <Link href={`/precificacao/${d.id}`} className="flex min-h-14 flex-col justify-center gap-1.5 py-3">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="line-clamp-1 text-sm font-medium">{d.name}</span>
                  <span className="tabular shrink-0 text-sm font-bold">{formatPct(d.pct)}</span>
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-border" aria-hidden>
                  <span className={`block h-full rounded-full ${i === 0 && panel.cmvRanking.length > 1 ? "bg-danger" : "bg-primary"}`} style={{ width: `${(d.pct / maxCmv) * 100}%` }} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {panel.cmvRanking.length > 8 ? <p className="text-xs text-muted">Mostrando as 8 de maior CMV.</p> : null}
      </section>

      <section aria-label="Ponto de equilíbrio" className={card}>
        <p className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted">
          Para empatar no mês
          <Hint label="O que é ponto de equilíbrio?">Quanto você precisa vender por mês só para pagar todas as contas, sem lucro e sem prejuízo.</Hint>
        </p>
        {breakEven ? (
          <>
            <p className="tabular text-2xl font-extrabold tracking-tight">{formatNumber(breakEven.units, 0)} marmitas</p>
            <p className="text-sm text-muted">
              Cerca de {formatNumber(breakEven.perDay, 0)} por dia · {formatBRL(breakEven.revenue)} de faturamento
            </p>
            {ctx.monthlyUnits ? (
              <>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-border" aria-hidden>
                  <div className={`h-full rounded-full ${ctx.monthlyUnits >= breakEven.units ? "bg-success" : "bg-danger"}`} style={{ width: `${Math.min(100, (ctx.monthlyUnits / breakEven.units) * 100)}%` }} />
                </div>
                <p className="text-xs text-muted">
                  Você vende cerca de {formatNumber(ctx.monthlyUnits, 0)} por mês: {ctx.monthlyUnits >= breakEven.units ? "acima" : "abaixo"} do equilíbrio.
                </p>
              </>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">
            Cadastre seus custos fixos e a equipe para ver quanto precisa vender. <Link href="/custos" className="font-semibold text-primary underline">Abrir Custos</Link>
          </p>
        )}
      </section>
    </div>
  );
}
