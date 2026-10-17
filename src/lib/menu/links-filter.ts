import { normalizeName } from "@/lib/names";

export type LinkTab = "pending" | "done";
export type LinkKind = "all" | "item" | "option";

/** O mínimo que a lista precisa de um produto para filtrar. `target`: "" = sem vínculo; qualquer outro valor = já resolvido. */
export type Filterable = { id: string; name: string; kind: "item" | "option"; target: string };

/** Em qual aba o produto nasce: sem vínculo, ou resolvido (ficha, combo ou "não é marmita"). */
export const tabOf = (i: Pick<Filterable, "target">): LinkTab => (i.target === "" ? "pending" : "done");

/**
 * Lista da tela de vínculos: aba, tipo (produto/opção) e busca. A busca ignora acento e maiúsculas e exige TODAS as palavras
 * digitadas ("strog frango" acha "Strogonoff de Frango 350g", em qualquer ordem). `pinned` mantém uma linha recém-salva na aba
 * onde estava, para o dono ajustar o vínculo sem ela sumir da frente.
 */
export function filterLinkItems<T extends Filterable>(items: T[], opts: { tab: LinkTab; kind: LinkKind; query: string; pinned?: Map<string, LinkTab> }): T[] {
  const words = normalizeName(opts.query).split(" ").filter(Boolean);
  return items.filter((i) => {
    if ((opts.pinned?.get(i.id) ?? tabOf(i)) !== opts.tab) return false;
    if (opts.kind !== "all" && i.kind !== opts.kind) return false;
    if (words.length === 0) return true;
    const hay = normalizeName(i.name);
    return words.every((w) => hay.includes(w));
  });
}
