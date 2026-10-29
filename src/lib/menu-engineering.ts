// Engenharia de cardápio: cruza o que cada marmita VENDEU com o que ela DEIXA de lucro, para decidir o que destacar, reajustar ou tirar.
// Regra pura (sem banco). Método clássico (Kasavana & Smith): popularidade × margem de contribuição.

export type EngineeringInput = {
  id: string;
  name: string;
  /** Marmitas vendidas no período (cardápio + digitadas). */
  units: number;
  /** Quanto foi pago por elas (cardápio já sem a parte do cupom; digitadas = quantidade × preço cadastrado). */
  revenue: number;
  /** Custo de uma marmita (ficha); `null` = ficha incompleta. */
  cost: number | null;
};

export type Quadrant = "star" | "plowhorse" | "puzzle" | "dog";

export type EngineeredProduct = EngineeringInput & {
  /** Preço médio realmente pago por marmita. */
  paidPrice: number;
  /** Quanto sobra em cada marmita: pago − custo − impostos e taxas. */
  unitContribution: number;
  /** Sobra ÷ pago. */
  marginPct: number;
  /** Sobra × marmitas vendidas. */
  totalContribution: number;
  /** Parte das marmitas vendidas (popularidade). */
  unitShare: number;
  quadrant: Quadrant;
  /** Parte acumulada do lucro total até este produto, do que mais dá lucro ao que menos dá. */
  cumulativeShare: number;
};

export type EngineeringResult = {
  products: EngineeredProduct[];
  /** Vendas com ficha incompleta ou sem valor: aparecem à parte, sem classificação. */
  unclassified: EngineeringInput[];
  totalUnits: number;
  totalContribution: number;
  /** Sobra média por marmita (ponderada pelas vendas): a régua da "margem alta". */
  avgUnitContribution: number;
  /** Corte de popularidade: 70% da fatia média. */
  popularityCut: number;
};

/** Um produto é "popular" se vende pelo menos 70% da fatia média (regra do método). */
export const POPULARITY_FACTOR = 0.7;

export function engineerMenu(inputs: EngineeringInput[], variablePct: number): EngineeringResult {
  const sold = inputs.filter((i) => i.units > 0);
  const classifiable = sold.filter((i) => i.cost !== null && i.revenue > 0);
  const unclassified = sold.filter((i) => !(i.cost !== null && i.revenue > 0));

  const totalUnits = classifiable.reduce((s, i) => s + i.units, 0);
  const rows = classifiable.map((i) => {
    const paidPrice = i.revenue / i.units;
    const unitContribution = paidPrice - (i.cost as number) - paidPrice * variablePct;
    return { ...i, paidPrice, unitContribution, marginPct: unitContribution / paidPrice, totalContribution: unitContribution * i.units, unitShare: totalUnits > 0 ? i.units / totalUnits : 0 };
  });

  const totalContribution = rows.reduce((s, r) => s + r.totalContribution, 0);
  const avgUnitContribution = totalUnits > 0 ? totalContribution / totalUnits : 0;
  const popularityCut = rows.length > 0 ? POPULARITY_FACTOR * (1 / rows.length) : 0;

  const withQuadrant = rows.map((r) => {
    const popular = r.unitShare >= popularityCut;
    const high = r.unitContribution >= avgUnitContribution;
    const quadrant: Quadrant = popular ? (high ? "star" : "plowhorse") : high ? "puzzle" : "dog";
    return { ...r, quadrant };
  });

  // curva ABC pelo lucro total (só soma o que é positivo para a parte acumulada ficar entre 0 e 1)
  const positive = withQuadrant.reduce((s, r) => s + Math.max(0, r.totalContribution), 0);
  let running = 0;
  const ranked = [...withQuadrant]
    .sort((a, b) => b.totalContribution - a.totalContribution || a.name.localeCompare(b.name, "pt-BR"))
    .map((r) => {
      running += Math.max(0, r.totalContribution);
      return { ...r, cumulativeShare: positive > 0 ? running / positive : 0 };
    });

  return { products: ranked, unclassified, totalUnits, totalContribution, avgUnitContribution, popularityCut };
}

export const QUADRANT_INFO: Record<Quadrant, { label: string; hint: string; action: string }> = {
  star: { label: "Estrelas", hint: "vendem bem e sobra bem", action: "Mantenha e destaque no cardápio." },
  plowhorse: { label: "Vendem bem, sobra pouco", hint: "o público gosta, mas o lucro por produto é baixo", action: "Teste um pequeno aumento de preço ou reduza o custo da ficha." },
  puzzle: { label: "Joias escondidas", hint: "sobra bem, mas vendem pouco", action: "Dê mais destaque: foto, combo ou promoção." },
  dog: { label: "Pouco retorno", hint: "vendem pouco e sobra pouco", action: "Reveja o preço ou considere tirar do cardápio." },
};

export type QuadrantSummary = { quadrant: Quadrant; count: number; totalContribution: number; units: number };

export function summarizeQuadrants(result: EngineeringResult): QuadrantSummary[] {
  return (["star", "plowhorse", "puzzle", "dog"] as const).map((q) => {
    const list = result.products.filter((p) => p.quadrant === q);
    return { quadrant: q, count: list.length, totalContribution: list.reduce((s, p) => s + p.totalContribution, 0), units: list.reduce((s, p) => s + p.units, 0) };
  });
}

/** Quantos produtos juntam `share` (ex.: 80%) do lucro: "3 produtos dão 80% do lucro". */
export function productsForShare(result: EngineeringResult, share: number): number {
  const i = result.products.findIndex((p) => p.cumulativeShare >= share);
  return i === -1 ? result.products.length : i + 1;
}
