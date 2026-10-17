import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrgDirectory, type OrgItem } from "./org-directory";

const base = (over: Partial<OrgItem>): OrgItem => ({
  id: "o1",
  name: "Marmita da Bela",
  searchText: "Marmita da Bela bela@exemplo.com",
  members: 2,
  lastActivity: "2026-10-18T13:00:00Z",
  lastActivityLabel: "há 2 h",
  lastActivityTitle: "18/10/2026 10:00",
  activityTone: "ok",
  lastAction: "Atualizou o preço de venda de Strogonoff",
  lastActor: "Bela",
  events7d: 31,
  menu: [],
  flags: { inactive: false, menuProblem: false, noMenu: true },
  actions: <button>Ver como cliente</button>,
  manage: <p>área de gestão</p>,
  ...over,
});

const items: OrgItem[] = [
  base({
    menu: [{ id: "c1", providerLabel: "CardápioWeb", health: "ok", healthLabel: "Em dia", lastSyncLabel: "há 3 h", lastSyncTitle: "18/10/2026 09:00", ordersLabel: "1.961", pending: 0, error: null }],
    flags: { inactive: false, menuProblem: false, noMenu: false },
  }),
  base({ id: "o2", name: "Casa do Sabor", lastActivity: null, lastActivityLabel: "nunca", lastActivityTitle: "", activityTone: "bad", lastAction: null, lastActor: null, events7d: 0, flags: { inactive: true, menuProblem: false, noMenu: true } }),
  base({
    id: "o3",
    name: "Dona Maria",
    menu: [{ id: "c2", providerLabel: "Prefiro Delivery", health: "error", healthLabel: "Com erro", lastSyncLabel: "há 5 dias", lastSyncTitle: "13/10/2026 09:00", ordersLabel: "420", pending: 0, error: "A Prefiro recusou a hash e a chave de API." }],
    flags: { inactive: false, menuProblem: true, noMenu: false },
  }),
];

describe("painel Shogun: lista de marmitarias", () => {
  const html = renderToStaticMarkup(<OrgDirectory items={items} />);

  it("mostra o último acesso e o que o cliente fez, sem abrir o histórico", () => {
    expect(html).toContain("Último acesso do cliente");
    expect(html).toContain("há 2 h");
    expect(html).toContain("31 ações na semana");
    expect(html).toContain("Bela: Atualizou o preço de venda de Strogonoff");
  });

  it("quem nunca acessou aparece como tal", () => {
    expect(html).toContain("Ainda não acessou");
  });

  it("mostra a integração: provedor, situação e a última leitura de pedidos", () => {
    expect(html).toContain("CardápioWeb");
    expect(html).toContain("Em dia");
    expect(html).toContain("Puxou pedidos há 3 h");
    expect(html).toContain("1.961 pedidos");
    expect(html).toContain("Com erro");
    expect(html).toContain("A Prefiro recusou a hash e a chave de API.");
    expect(html).toContain("Não conectado");
  });

  it("resumo do topo e filtros com contagem", () => {
    expect(html).toContain("Marmitarias");
    expect(html).toContain("Cardápio com problema");
    expect(html).toContain("Sem acessar há 7+ dias");
    expect(html).toContain("Sem cardápio");
    expect(html).toContain("3 marmitarias");
  });

  it("o gerenciamento fica recolhido mas presente", () => {
    expect(html).toContain("Gerenciar usuários e cardápio");
    expect(html).toContain("Ver como cliente");
  });
});
