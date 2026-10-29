import Link from "next/link";
import { Hint } from "@/components/hint";
import { EstimateNotice } from "@/components/estimate-notice";
import { ShareButton } from "@/components/share-button";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import type { Dashboard } from "@/lib/dashboard-data";

const card = "flex flex-col gap-1 card p-4";

type Part = { key: string; label: string; pct: number; swatch: string; hint: string };

function Tile({ label, value, hint, help, tone = "default" }: { label: string; value: string; hint?: string; help: React.ReactNode; tone?: "default" | "bad" | "good" }) {
  return (
    <div className={`${card} border-l-4 ${tone === "bad" ? "border-l-danger" : tone === "good" ? "border-l-success" : "border-l-accent"}`}>
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
  const { ctx, panel, breakEven } = data;
  const estimate = ctx.estimate;

  if (!panel) {
    return (
      <p className="card p-4 text-sm">
        O painel aparece quando você tiver pelo menos um produto com custo e preço de venda. <Link href="/cardapio" className="font-semibold text-primary underline">Definir preços</Link>
      </p>
    );
  }

  const c = panel.composition;
  const highest = panel.cmvRanking[0];
  const lowest = panel.cmvRanking[panel.cmvRanking.length - 1];
  const parts: Part[] = [
    { key: "cmv", label: "Gasto com insumos", pct: c.cmv, swatch: "bg-primary", hint: "O que você gasta em insumos e embalagem para fazer o produto." },
    { key: "cmo", label: "Equipe", pct: c.cmo, swatch: "bg-[#4d7c6f]", hint: "Salários e encargos da equipe." },
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
      <EstimateNotice reason={ctx.estimateReason} />

      <section aria-label="Lucro líquido" className="relative flex flex-col gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[#2f5d4f] p-5 text-primary-foreground shadow-lg">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-accent" />
        <p className="flex items-center text-sm font-semibold uppercase tracking-wider opacity-90">
          Lucro por marmita (pelo preço cadastrado)
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
        <ShareButton className="mt-1 h-12 rounded-xl bg-accent px-5 text-base font-bold text-primary active:scale-[0.99]">Compartilhar meu resultado</ShareButton>
        <p className="text-xs opacity-80">
          {panel.weighted
            ? `Média de ${panel.count} ${panel.count === 1 ? "produto" : "produtos"}, dando mais peso aos que você mais vende.`
            : `Média simples de ${panel.count} ${panel.count === 1 ? "produto com preço" : "produtos com preço"} (sem vendas informadas para pesar).`}{" "}
          Vendendo por {data.channelName}.
        </p>
      </section>

      <section aria-label="Para onde vai cada real" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Para onde vai cada R$ 100 que você vende</h2>
        <div className="flex h-5 overflow-hidden rounded-full bg-border" role="img" aria-label={parts.map((p) => `${p.label}: ${formatPct(p.pct)}`).join(", ")}>
          {barParts.map((p) => (
            <span key={p.key} className={`${p.swatch} h-full`} style={{ width: `${(Math.max(p.pct, 0) / barTotal) * 100}%` }} />
          ))}
        </div>
        <ul className="flex flex-col divide-y divide-border card px-4">
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

      {panel.cmvRanking.length > 1 ? (
        <section aria-label="Maior e menor gasto com insumos" className="grid grid-cols-2 gap-3">
          <Tile label="Maior gasto com insumos" value={formatPct(highest.pct)} hint={highest.name} tone="bad" help="O produto que gasta mais em ingredientes em relação ao preço (também chamado de CMV). Candidato a rever receita ou preço." />
          <Tile label="Menor gasto com insumos" value={formatPct(lowest.pct)} hint={lowest.name} tone="good" help="O produto que gasta menos em ingredientes em relação ao preço. O que mais deixa sobrar." />
        </section>
      ) : null}

      <section aria-label="Produtos por gasto com insumos" className="flex flex-col gap-3">
        <h2 className="flex items-center text-sm font-semibold uppercase tracking-wider text-muted">
          Gasto com insumos de cada produto
          <Hint label="Como ler?">Quanto de cada R$ 100 do preço vai para ingredientes e embalagem. Barras maiores pedem atenção.</Hint>
        </h2>
        <ul className="divide-y divide-border card px-4">
          {panel.cmvRanking.slice(0, 8).map((d, i) => (
            <li key={d.id}>
              <Link href={`/cardapio/${d.id}/preco`} className="flex min-h-14 flex-col justify-center gap-1.5 py-3">
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
        {panel.cmvRanking.length > 8 ? <p className="text-xs text-muted">Mostrando os 8 com maior gasto.</p> : null}
      </section>

      <section aria-label="Ponto de equilíbrio" className={card}>
        <p className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted">
          Para empatar no mês
          <Hint label="O que é ponto de equilíbrio?">Quanto você precisa vender por mês só para pagar todas as contas, sem lucro e sem prejuízo.</Hint>
        </p>
        {breakEven ? (
          <>
            <p className="tabular text-2xl font-extrabold tracking-tight">{formatNumber(breakEven.units, 0)} unidades</p>
            <p className="text-sm text-muted">
              Cerca de {formatNumber(breakEven.perDay, 0)} por dia · {formatBRL(breakEven.revenue)} de faturamento
            </p>
            {ctx.monthlyRevenue ? (
              <>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-border" aria-hidden>
                  <div className={`h-full rounded-full ${ctx.monthlyRevenue >= breakEven.revenue ? "bg-success" : "bg-danger"}`} style={{ width: `${Math.min(100, (ctx.monthlyRevenue / breakEven.revenue) * 100)}%` }} />
                </div>
                <p className="text-xs text-muted">
                  Pela sua média de faturamento ({formatBRL(ctx.monthlyRevenue)} por mês), você está {ctx.monthlyRevenue >= breakEven.revenue ? "acima" : "abaixo"} do equilíbrio. O mês em andamento aparece no Início.
                </p>
              </>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">
            Cadastre seus custos fixos e a equipe para ver quanto precisa vender. <Link href="/financeiro" className="font-semibold text-primary underline">Abrir Custos fixos e equipe</Link>
          </p>
        )}
      </section>
    </div>
  );
}
