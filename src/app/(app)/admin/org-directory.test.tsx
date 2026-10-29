import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OrgDirectory, type OrgItem } from "./org-directory";

// As ações do servidor não existem no teste (importam módulos só de servidor); a lista só precisa do botão.
vi.mock("./menu-actions", () => ({ syncMenuNow: vi.fn(), connectMenu: vi.fn(), disconnectMenu: vi.fn() }));

const base = (over: Partial<OrgItem>): OrgItem => ({
  id: "o1",
  name: "Marmita da Bela",
  searchText: "Marmita da Bela bela@exemplo.com",
  owner: { name: "Bela", email: "bela@exemplo.com" },
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
  severity: "ok",
  reasons: [],
  historyHref: "/admin/uso/o1",
  viewAs: <button>Ver como</button>,
  usersPanel: <p>painel de usuários</p>,
  menuPanel: <p>painel do cardápio</p>,
  ...over,
});

const items: OrgItem[] = [
  base({
    menu: [{ id: "c1", providerLabel: "CardápioWeb", health: "ok", healthLabel: "Em dia", lastSyncLabel: "há 3 h", lastSyncTitle: "18/10/2026 09:00", ordersLabel: "1.961", pending: 0, progress: null, error: null }],
    flags: { inactive: false, menuProblem: false, noMenu: false },
  }),
  base({
    id: "o2",
    name: "Casa do Sabor",
    owner: null,
    members: 0,
    lastActivity: null,
    lastActivityLabel: "nunca",
    lastActivityTitle: "",
    activityTone: "bad",
    lastAction: null,
    lastActor: null,
    events7d: 0,
    flags: { inactive: true, menuProblem: false, noMenu: true },
    severity: "attention",
    reasons: [{ key: "never", text: "Ainda não acessou o sistema", tab: "users" }],
  }),
  base({
    id: "o3",
    name: "Dona Maria",
    menu: [{ id: "c2", providerLabel: "Prefiro Delivery", health: "error", healthLabel: "Com erro", lastSyncLabel: "há 5 dias", lastSyncTitle: "13/10/2026 09:00", ordersLabel: "420", pending: 0, progress: null, error: "A Prefiro recusou a hash e a chave de API." }],
    flags: { inactive: false, menuProblem: true, noMenu: false },
    severity: "critical",
    reasons: [{ key: "menu-error", text: "Prefiro Delivery desconectado ou com erro", tab: "menu" }],
  }),
  base({
    id: "o4",
    name: "Sabor Caseiro",
    menu: [{ id: "c3", providerLabel: "CardápioWeb", health: "importing", healthLabel: "Importando", lastSyncLabel: "agora há pouco", lastSyncTitle: "", ordersLabel: "300", pending: 200, progress: 60, error: null }],
    flags: { inactive: false, menuProblem: false, noMenu: false },
  }),
];

describe("painel Shogun: visão geral", () => {
  const html = renderToStaticMarkup(<OrgDirectory items={items} createForm={<form>formulário de criação</form>} />);

  it("mostra o último acesso e o que o cliente fez, sem abrir o histórico", () => {
    expect(html).toContain("Último acesso do cliente");
    expect(html).toContain("há 2 h");
    expect(html).toContain("31 ações na semana");
    expect(html).toContain("Bela: Atualizou o preço de venda de Strogonoff");
    expect(html).toContain("Ainda não acessou");
  });

  it("mostra a integração: provedor, situação, última leitura e pedidos", () => {
    expect(html).toContain("CardápioWeb");
    expect(html).toContain("Em dia");
    expect(html).toContain("Puxou pedidos há 3 h");
    expect(html).toContain("1.961 pedidos");
    expect(html).toContain("A Prefiro recusou a hash e a chave de API.");
    expect(html).toContain("Não conectado");
  });

  it("mostra o andamento da importação", () => {
    expect(html).toContain("Importando");
    expect(html).toContain("60% · faltam 200");
  });

  it("destaca o que precisa de atenção, com a ação certa para cada caso", () => {
    expect(html).toContain("Precisa de atenção (2)");
    expect(html).toContain("Prefiro Delivery desconectado ou com erro");
    expect(html).toContain("Resolver"); // cardápio com erro abre o gerenciamento
    expect(html).toContain("Ver uso"); // sumido leva ao histórico
  });

  it("cartões com gravidade e dono", () => {
    expect(html).toContain("Urgente");
    expect(html).toContain("Atenção");
    expect(html).toContain("Bela · bela@exemplo.com");
    expect(html).toContain("Sem dono cadastrado");
  });

  it("resumo, filtros com contagem e ações do cartão", () => {
    expect(html).toContain("Cardápio com problema");
    expect(html).toContain("Sem acessar há 7+ dias");
    expect(html).toContain("4 marmitarias");
    expect(html).toContain("Ver como");
    expect(html).toContain("Histórico");
    expect(html).toContain("Gerenciar");
    expect(html).toContain("+ Nova marmitaria");
  });

  it("sem marmitarias, convida a criar a primeira", () => {
    const empty = renderToStaticMarkup(<OrgDirectory items={[]} createForm={null} />);
    expect(empty).toContain("Nenhuma marmitaria ainda");
    expect(empty).toContain("Criar a primeira marmitaria");
  });

  it("tudo em ordem quando ninguém pede atenção", () => {
    const ok = renderToStaticMarkup(<OrgDirectory items={[items[0]]} createForm={null} />);
    expect(ok).toContain("Tudo em ordem");
  });

  it("cliente de teste aparece com a marca, mas fica fora das contagens e da atenção", () => {
    const withTest = [
      ...items,
      base({ id: "t1", name: "Conta de Teste", isTest: true, flags: { inactive: true, menuProblem: true, noMenu: false }, severity: "ok", reasons: [{ key: "menu-error", text: "Teste com erro", tab: "menu" }] }),
    ];
    const html = renderToStaticMarkup(<OrgDirectory items={withTest} createForm={null} />);
    expect(html).toContain("Conta de Teste");
    expect(html).toContain(">Teste<");
    const chip = (h: string) => /Sem acessar há 7\+ dias<span[^>]*>(\d+)</.exec(h)?.[1];
    expect(chip(html)).toBe(chip(renderToStaticMarkup(<OrgDirectory items={items} createForm={null} />))); // a de teste não entra na contagem
    expect(html).not.toContain("Teste com erro");
  });

  it("gestor só visualiza: sem criar marmitaria nem gerenciar", () => {
    const html = renderToStaticMarkup(<OrgDirectory items={items} createForm={null} canManage={false} />);
    expect(html).toContain("Ver como");
    expect(html).not.toContain("+ Nova marmitaria");
    expect(html).not.toContain("Gerenciar</button>");
  });
});
