/** Nome do documento impresso: o produto leva "Ficha de montagem" (junta receitas, insumos e embalagem); a receita leva "Ficha técnica" (a preparação em lote). */
export const fichaDocNome = (kind: "marmita" | "receita"): string => (kind === "marmita" ? "Ficha de montagem" : "Ficha técnica");
