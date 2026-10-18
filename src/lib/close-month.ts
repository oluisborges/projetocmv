// "Fechar o mês" em poucos toques: o que o app já sabe e o que ainda falta informar.

export type CloseItem = {
  key: "menu" | "purchases" | "outside" | "recipes" | "fixed";
  title: string;
  detail: string;
  done: boolean;
  /** Item que não bloqueia o fechamento (a dona pode não ter vendas por fora). */
  optional?: boolean;
  href?: string;
  cta?: string;
};

export type CloseMonth = { items: CloseItem[]; required: number; requiredDone: number; ready: boolean };

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function closeMonthChecklist(input: {
  month: string;
  connected: boolean;
  menuOrders: number;
  menuRevenue: number;
  purchases: number;
  /** Parte das compras que veio das notas fiscais importadas. */
  purchasesFromNfe: number;
  outsideRevenue: number;
  /** Quanto informou de venda por fora no mês anterior (para lembrar). */
  prevOutsideRevenue: number;
  hasFixedCosts: boolean;
  /** Produtos vendidos cuja ficha está incompleta. */
  recipesWithoutCost: number;
  soldUnits: number;
}): CloseMonth {
  const mes = input.month.slice(0, 7);
  const items: CloseItem[] = [];

  if (input.connected) {
    items.push({
      key: "menu",
      title: "Vendas do cardápio digital",
      done: input.menuOrders > 0,
      detail: input.menuOrders > 0 ? `${input.menuOrders.toLocaleString("pt-BR")} pedidos · ${brl(input.menuRevenue)} já importados, sem digitar nada.` : "Ainda não chegou nenhum pedido deste mês.",
      href: input.menuOrders > 0 ? undefined : "/custos/cardapio",
      cta: input.menuOrders > 0 ? undefined : "Ver vínculos",
    });
  }

  items.push({
    key: "purchases",
    title: "Compras de insumos",
    done: input.purchases > 0,
    detail:
      input.purchases > 0
        ? input.purchasesFromNfe > 0
          ? `${brl(input.purchases)} (${brl(input.purchasesFromNfe)} vieram de notas fiscais importadas).`
          : `${brl(input.purchases)} informados.`
        : "Nada lançado. Importe as notas dos fornecedores ou digite o total do mês.",
    href: input.purchases > 0 ? undefined : "/insumos/nfe",
    cta: input.purchases > 0 ? undefined : "Importar nota fiscal",
  });

  items.push({
    key: "outside",
    title: input.connected ? "Vendas por fora do cardápio" : "Faturamento do mês",
    optional: input.connected,
    done: input.outsideRevenue > 0,
    detail:
      input.outsideRevenue > 0
        ? `${brl(input.outsideRevenue)} informados.`
        : input.connected
          ? `WhatsApp, balcão, feira… Só se vendeu por fora.${input.prevOutsideRevenue > 0 ? ` Mês passado: ${brl(input.prevOutsideRevenue)}.` : ""}`
          : `Informe quanto faturou.${input.prevOutsideRevenue > 0 ? ` Mês passado: ${brl(input.prevOutsideRevenue)}.` : ""}`,
    href: input.outsideRevenue > 0 ? undefined : `/custos/mes?mes=${mes}#contas-do-mes`,
    cta: input.outsideRevenue > 0 ? undefined : "Informar",
  });

  items.push({
    key: "recipes",
    title: "Fichas das marmitas vendidas",
    done: input.recipesWithoutCost === 0 && input.soldUnits > 0,
    detail:
      input.soldUnits === 0
        ? "Sem marmitas vendidas informadas ainda."
        : input.recipesWithoutCost === 0
          ? "Todas com custo calculado."
          : `${input.recipesWithoutCost} ${input.recipesWithoutCost === 1 ? "marmita vendida está" : "marmitas vendidas estão"} com a ficha incompleta; o custo esperado fica subestimado.`,
    href: input.recipesWithoutCost > 0 ? "/fichas" : undefined,
    cta: input.recipesWithoutCost > 0 ? "Completar fichas" : undefined,
  });

  items.push({
    key: "fixed",
    title: "Contas fixas e equipe",
    done: input.hasFixedCosts,
    detail: input.hasFixedCosts ? "Cadastradas (valem para todos os meses até você mudar)." : "Aluguel, energia, salários… sem isso não dá para saber quanto sobrou.",
    href: input.hasFixedCosts ? undefined : "/custos",
    cta: input.hasFixedCosts ? undefined : "Cadastrar",
  });

  const required = items.filter((i) => !i.optional);
  const requiredDone = required.filter((i) => i.done).length;
  return { items, required: required.length, requiredDone, ready: requiredDone === required.length };
}
