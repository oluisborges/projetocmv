import { describe, expect, it } from "vitest";
import { filterLinkItems, tabOf, type Filterable } from "./links-filter";

const items: Filterable[] = [
  { id: "1", name: "Strogonoff de Frango 350g", kind: "item", target: "" },
  { id: "2", name: "Feijoada Completa", kind: "item", target: "r:abc" },
  { id: "3", name: "Arroz extra", kind: "option", target: "" },
  { id: "4", name: "Refrigerante Lata", kind: "item", target: "ignore" },
  { id: "5", name: "Açaí Pequeno", kind: "option", target: "c:xyz" },
];
const ids = (l: Filterable[]) => l.map((i) => i.id);

describe("abas", () => {
  it("sem vínculo = target vazio; ignorado e combo contam como resolvidos", () => {
    expect(tabOf(items[0])).toBe("pending");
    expect(tabOf(items[3])).toBe("done");
    expect(ids(filterLinkItems(items, { tab: "pending", kind: "all", query: "" }))).toEqual(["1", "3"]);
    expect(ids(filterLinkItems(items, { tab: "done", kind: "all", query: "" }))).toEqual(["2", "4", "5"]);
  });
});

describe("tipo", () => {
  it("separa produtos de opções", () => {
    expect(ids(filterLinkItems(items, { tab: "pending", kind: "option", query: "" }))).toEqual(["3"]);
    expect(ids(filterLinkItems(items, { tab: "done", kind: "item", query: "" }))).toEqual(["2", "4"]);
  });
});

describe("busca", () => {
  it("ignora acento e maiúsculas", () => {
    expect(ids(filterLinkItems(items, { tab: "done", kind: "all", query: "ACAI" }))).toEqual(["5"]);
    expect(ids(filterLinkItems(items, { tab: "done", kind: "all", query: "açaí" }))).toEqual(["5"]);
  });

  it("exige todas as palavras, em qualquer ordem, e aceita pedaço de palavra", () => {
    expect(ids(filterLinkItems(items, { tab: "pending", kind: "all", query: "frango strog" }))).toEqual(["1"]);
    expect(ids(filterLinkItems(items, { tab: "pending", kind: "all", query: "strog arroz" }))).toEqual([]);
  });

  it("espaços sobrando não atrapalham", () => {
    expect(ids(filterLinkItems(items, { tab: "pending", kind: "all", query: "   arroz   " }))).toEqual(["3"]);
  });

  it("a busca vale só dentro da aba escolhida", () => {
    expect(filterLinkItems(items, { tab: "pending", kind: "all", query: "feijoada" })).toEqual([]);
  });
});

describe("linha recém-salva", () => {
  it("continua na aba de origem até o dono trocar de aba", () => {
    // o produto 1 acabou de ser vinculado (target virou "r:..."), mas ficou fixo em "sem vínculo"
    const saved = items.map((i) => (i.id === "1" ? { ...i, target: "r:novo" } : i));
    const pinned = new Map([["1", "pending" as const]]);
    expect(ids(filterLinkItems(saved, { tab: "pending", kind: "all", query: "", pinned }))).toEqual(["1", "3"]);
    expect(ids(filterLinkItems(saved, { tab: "done", kind: "all", query: "", pinned }))).toEqual(["2", "4", "5"]);
    // sem fixar, ela já aparece em "Vinculados"
    expect(ids(filterLinkItems(saved, { tab: "done", kind: "all", query: "" }))).toContain("1");
  });
});
