// Compras, uso e estoque por insumo no mês, e o CMV real que sai daí.
//   esperado em estoque = estoque do começo + comprado − usado pelas fichas
//   CMV real = estoque do começo (R$) + compras do mês (R$) − estoque do fim (R$) + marmitas prontas do começo − do fim
// Estoque do fim: o que a dona contou; insumo não contado vale o esperado (só o contado revela diferença).

export type StockIngredient = { id: string; name: string; purchaseUnit: string; /** R$ por g, ml ou un */ unitCost: number };

export type StockRow = {
  id: string;
  name: string;
  /** Unidade em que mostrar as quantidades (kg, l, un…) e quanto vale 1 dela na unidade-base. */
  displayUnit: string;
  perDisplay: number;
  opening: number;
  purchased: number;
  purchasedNfe: number;
  used: number;
  expected: number;
  counted: number | null;
  /** Esperado − contado, na unidade-base: positivo = sumiu insumo. `null` sem contagem. */
  missingQty: number | null;
  missingValue: number | null;
  unitCost: number;
};

/** 1 kg = 1000 g, 1 l = 1000 ml. */
export const perDisplayUnit = (unit: string): number => (unit === "kg" || unit === "l" ? 1000 : 1);

export function buildStock(input: {
  ingredients: StockIngredient[];
  /** Estoque contado no fim do mês anterior (unidade-base). */
  opening: Map<string, number>;
  purchasedNfe: Map<string, number>;
  purchasedManual: Map<string, number>;
  /** Total que as vendas do mês consomem, pelas fichas (unidade-base). */
  used: Map<string, number>;
  /** Contagem do fim do mês. */
  counts: Map<string, number>;
}): StockRow[] {
  const rows: StockRow[] = [];
  for (const ing of input.ingredients) {
    const opening = input.opening.get(ing.id) ?? 0;
    const nfe = input.purchasedNfe.get(ing.id) ?? 0;
    const purchased = nfe + (input.purchasedManual.get(ing.id) ?? 0);
    const used = input.used.get(ing.id) ?? 0;
    const counted = input.counts.get(ing.id) ?? null;
    if (opening === 0 && purchased === 0 && used === 0 && counted === null) continue; // não apareceu no mês
    const expected = opening + purchased - used;
    const missingQty = counted === null ? null : expected - counted;
    rows.push({
      id: ing.id,
      name: ing.name,
      displayUnit: ing.purchaseUnit,
      perDisplay: perDisplayUnit(ing.purchaseUnit),
      opening,
      purchased,
      purchasedNfe: nfe,
      used,
      expected,
      counted,
      missingQty,
      missingValue: missingQty === null ? null : missingQty * ing.unitCost,
      unitCost: ing.unitCost,
    });
  }
  // Quem mais consumiu em R$ vem primeiro: é onde a atenção rende.
  return rows.sort((a, b) => b.used * b.unitCost - a.used * a.unitCost);
}

export type StockResult = {
  openingValue: number;
  closingValue: number;
  /** Quantos insumos foram contados. */
  countedCount: number;
  /** Consumo de insumos no mês: começo + compras − fim. */
  consumption: number;
  /** Custo das marmitas vendidas: consumo ajustado pelas marmitas prontas que ficaram no freezer. */
  cogs: number;
  theoreticalCost: number | null;
  /** Real − esperado pelas fichas. Positivo = gastou mais do que as vendas explicam. */
  gap: number | null;
  gapPct: number | null;
};

/** Só tem CMV real quando algo foi contado no fim do mês. */
export function stockResult(input: {
  rows: StockRow[];
  purchasesTotal: number;
  theoreticalCost: number | null;
  revenue: number;
  finishedOpening: number;
  finishedClosing: number;
}): StockResult | null {
  const countedCount = input.rows.filter((r) => r.counted !== null).length;
  if (countedCount === 0) return null;
  const openingValue = input.rows.reduce((s, r) => s + r.opening * r.unitCost, 0);
  const closingValue = input.rows.reduce((s, r) => s + (r.counted ?? Math.max(0, r.expected)) * r.unitCost, 0);
  const consumption = openingValue + input.purchasesTotal - closingValue;
  const cogs = consumption + input.finishedOpening - input.finishedClosing;
  const gap = input.theoreticalCost === null ? null : cogs - input.theoreticalCost;
  return {
    openingValue,
    closingValue,
    countedCount,
    consumption,
    cogs,
    theoreticalCost: input.theoreticalCost,
    gap,
    gapPct: gap !== null && input.revenue > 0 ? gap / input.revenue : null,
  };
}
