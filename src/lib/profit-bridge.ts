// "Por que o resultado mudou?": quanto de cada mudança veio das vendas, do preço médio, do custo dos insumos e das contas fixas.
// Resultado = marmitas × (preço médio × (1 − imposto e taxa) − custo dos insumos por marmita) − contas fixas e equipe.
// "Custo dos insumos" é o mesmo do resto do app: o das fichas (vendas × ficha); sem ele, as compras do mês. Só compara meses fechados.
// A decomposição é exata: os quatro passos somam a diferença entre os dois meses.
import type { HistoryMonth, PriceMove } from "@/lib/history-view";

export type BridgeStep = { key: "volume" | "price" | "cost" | "fixed"; label: string; value: number; text: string };

export type ProfitBridge = { from: number; to: number; delta: number; steps: BridgeStep[] };

const brl = (v: number, signed = false) => {
  const s = Math.abs(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  return signed ? `${v >= 0 ? "+" : "−"}${s}` : s;
};
const num = (v: number) => Math.round(v).toLocaleString("pt-BR");

export function profitBridge(prev: HistoryMonth, cur: HistoryMonth, moves: PriceMove[] = []): ProfitBridge | null {
  if (!prev.result || !cur.result || prev.insumosCost === null || cur.insumosCost === null || prev.partial || cur.partial || prev.soldUnits <= 0 || cur.soldUnits <= 0 || prev.revenue <= 0 || cur.revenue <= 0) return null;
  const u0 = prev.soldUnits;
  const u1 = cur.soldUnits;
  const t0 = prev.revenue / u0;
  const t1 = cur.revenue / u1;
  const tax0 = prev.taxesPct ?? 0;
  const tax1 = cur.taxesPct ?? 0;
  const c0 = prev.insumosCost / u0;
  const c1 = cur.insumosCost / u1;
  // Contas fixas + equipe = o que sobra da conta do resultado.
  const fixed0 = prev.revenue * (1 - tax0) - prev.insumosCost - prev.result.value;
  const fixed1 = cur.revenue * (1 - tax1) - cur.insumosCost - cur.result.value;

  const m0 = t0 * (1 - tax0) - c0;
  const volume = (u1 - u0) * m0;
  const price = u1 * (t1 * (1 - tax1) - t0 * (1 - tax0));
  const cost = -u1 * (c1 - c0);
  const fixed = -(fixed1 - fixed0);

  const steps: BridgeStep[] = [
    {
      key: "volume",
      label: "Quantidade vendida",
      value: volume,
      text: u1 === u0 ? "Você vendeu a mesma quantidade." : `Você vendeu ${num(Math.abs(u1 - u0))} marmitas ${u1 > u0 ? "a mais" : "a menos"} (${num(u0)} → ${num(u1)}).`,
    },
    {
      key: "price",
      label: "Preço médio por marmita",
      value: price,
      text:
        Math.abs(t1 - t0) < 0.005
          ? "O valor médio por marmita ficou igual."
          : `Cada marmita rendeu em média ${brl(t1)} (antes ${brl(t0)}). Descontos de cupom e mudança de preço entram aqui.`,
    },
    {
      key: "cost",
      label: "Custo dos insumos",
      value: cost,
      text:
        Math.abs(c1 - c0) < 0.005
          ? "O gasto com insumos por marmita ficou igual."
          : `Você gastou ${brl(c1)} de insumos por marmita (antes ${brl(c0)}).${moves.length > 0 ? ` Mudaram de preço: ${moves.map((m) => `${m.name} ${m.pct >= 0 ? "+" : "−"}${Math.round(Math.abs(m.pct) * 100)}%`).join(", ")}.` : ""}`,
    },
    {
      key: "fixed",
      label: "Contas fixas e equipe",
      value: fixed,
      text: Math.abs(fixed1 - fixed0) < 1 ? "As contas fixas e a equipe ficaram iguais." : `Contas fixas e equipe somaram ${brl(fixed1)} (antes ${brl(fixed0)}).`,
    },
  ];
  return { from: prev.result.value, to: cur.result.value, delta: cur.result.value - prev.result.value, steps: steps.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)) };
}

export { brl as formatSigned };
