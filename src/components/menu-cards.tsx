import { Hint } from "@/components/hint";
import type { MenuMonth, OutsideEstimate } from "@/lib/calc";
import { formatBRL, formatPct } from "@/lib/format";

const REASON: Record<Extract<OutsideEstimate, { ok: false }>["reason"], string> = {
  "no-outside-revenue": "Informe quanto vendeu por fora do cardápio para ver a estimativa.",
  "no-margin": "Ainda não dá para estimar: faltam produtos do cardápio vinculados a fichas completas.",
  "low-coverage": "Ainda não dá para estimar: menos da metade do que o cardápio vendeu tem ficha vinculada.",
};

/**
 * Lucro do cardápio (real, pelo valor realmente pago) e da venda por fora (estimado), sempre rotulados.
 * Com `fixedCosts`, mostra também o que sobra depois das despesas fixas do mês.
 */
export function MenuProfitCard({
  summary,
  outside,
  outsideRevenue,
  outsideFromDishes = false,
  fixedCosts = 0,
  partialMonth = false,
}: {
  summary: MenuMonth;
  outside: OutsideEstimate;
  outsideRevenue: number;
  /** O valor da venda por fora foi calculado (quantidades × preços cadastrados), não digitado. */
  outsideFromDishes?: boolean;
  /** Custos fixos + equipe do mês (aluguel, equipe, mensalidade do cardápio…). */
  fixedCosts?: number;
  /** O mês ainda não acabou: as despesas fixas são do mês inteiro. */
  partialMonth?: boolean;
}) {
  const real = summary.costedRevenue.gt(0);
  const afterSales = real ? summary.contribution.plus(outside.ok ? outside.contribution : 0) : null;
  const total = real && outside.ok ? afterSales : null;
  const left = afterSales !== null && fixedCosts > 0 ? afterSales.minus(fixedCosts) : null;
  const estimated = !real || outside.ok; // parte da conta é projeção quando a venda por fora entrou

  return (
    <section aria-live="polite" className="flex flex-col gap-3 card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        Quanto sobrou das vendas
        <Hint>
          O que os clientes pagaram (já sem o cupom), menos o custo da comida e da embalagem das fichas, menos impostos e outras taxas. O cardápio digital cobra mensalidade fixa, não
          porcentagem por pedido: ela é um custo fixo e entra em Financeiro, aba Custos fixos.
        </Hint>
      </h2>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            No cardápio <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">real</span>
          </p>
          <p className="tabular text-2xl font-extrabold">{real ? formatBRL(summary.contribution.toNumber()) : "—"}</p>
        </div>
        {summary.contributionPct ? <p className="tabular text-sm text-muted">{formatPct(summary.contributionPct.toNumber())} do vendido</p> : null}
      </div>
      {!real ? <p className="text-xs text-muted">Vincule os produtos do cardápio a fichas completas para ver o lucro real.</p> : null}
      {summary.linesWithoutCost > 0 ? (
        <p className="text-xs text-warning">
          {summary.linesWithoutCost} {summary.linesWithoutCost === 1 ? "produto vinculado está" : "produtos vinculados estão"} com a ficha incompleta e ficou fora da conta.
        </p>
      ) : null}

      <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
        <div>
          <p className="text-sm text-muted">
            Venda por fora ({formatBRL(outsideRevenue)}){" "}
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">{outside.ok && outside.source === "mix" ? "calculado" : "estimado"}</span>
            <Hint>
              {outside.ok && outside.source === "mix"
                ? "Calculado com as quantidades por ficha que você informou, os preços que você cadastrou e o custo de cada ficha."
                : "Não sabemos o que foi vendido por fora, então usamos a mesma margem do cardápio. Informe as quantidades por ficha abaixo para um cálculo mais fiel."}
              {outsideFromDishes ? " O valor vendido foi calculado com quantidade × seu preço cadastrado, porque você não digitou o total." : ""}
            </Hint>
          </p>
          <p className="tabular text-2xl font-extrabold">{outside.ok ? formatBRL(outside.contribution.toNumber()) : "—"}</p>
        </div>
        {outside.ok ? <p className="tabular text-sm text-muted">{formatPct(outside.pct.toNumber())} do vendido</p> : null}
      </div>
      {!outside.ok ? <p className="text-xs text-muted">{REASON[outside.reason]}</p> : null}

      {total ? (
        <p className="border-t border-border pt-3 text-sm">
          Somando os dois, sobraram cerca de <strong className="tabular">{formatBRL(total.toNumber())}</strong> <span className="text-muted">(parte estimada)</span>.
        </p>
      ) : null}

      {left !== null ? (
        <div className="flex flex-col gap-1 rounded-lg bg-border/50 p-3 text-sm">
          <p className="flex justify-between gap-3">
            <span className="text-muted">Despesas fixas do mês (aluguel, equipe, mensalidade do cardápio…)</span>
            <span className="tabular shrink-0">−{formatBRL(fixedCosts)}</span>
          </p>
          <p className="flex items-baseline justify-between gap-3 font-semibold">
            <span>Sobra no mês{estimated ? " (estimativa)" : ""}</span>
            <span className={`tabular text-xl font-extrabold ${left.lt(0) ? "text-danger" : ""}`}>{formatBRL(left.toNumber())}</span>
          </p>
          {partialMonth ? <p className="text-xs text-muted">O mês ainda não acabou: as despesas fixas são do mês inteiro, então o número tende a melhorar até o fim do mês.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
