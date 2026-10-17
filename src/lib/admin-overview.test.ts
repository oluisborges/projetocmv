import { describe, expect, it } from "vitest";
import { attentionReasons, menuHealth, orgFlags, orgSeverity, sortOrgs, worstMenuHealth, type MenuConnSummary } from "./admin-overview";
import { timeAgo } from "./relative-time";

const now = new Date("2026-10-18T15:00:00Z");
const conn = (over: Partial<MenuConnSummary> = {}): MenuConnSummary => ({
  provider: "cardapioweb",
  status: "connected",
  phase: "done",
  last_sync_at: "2026-10-18T14:00:00Z",
  pending_orders: 0,
  ...over,
});

describe("tempo relativo", () => {
  it("escala de minutos a dias", () => {
    expect(timeAgo("2026-10-18T14:59:50Z", now)).toBe("agora há pouco");
    expect(timeAgo("2026-10-18T14:55:00Z", now)).toBe("há 5 min");
    expect(timeAgo("2026-10-18T12:00:00Z", now)).toBe("há 3 h");
    expect(timeAgo("2026-10-17T10:00:00Z", now)).toBe("ontem");
    expect(timeAgo("2026-10-10T15:00:00Z", now)).toBe("há 8 dias");
  });
  it("passando de 30 dias mostra a data (horário de Brasília)", () => {
    expect(timeAgo("2026-08-01T12:00:00Z", now)).toBe("01/08/2026");
  });
  it("sem data ou data inválida = nunca; futuro = agora", () => {
    expect(timeAgo(null, now)).toBe("nunca");
    expect(timeAgo("lixo", now)).toBe("nunca");
    expect(timeAgo("2026-10-18T15:05:00Z", now)).toBe("agora há pouco");
  });
});

describe("saúde do cardápio", () => {
  it("em dia", () => expect(menuHealth(conn(), now)).toBe("ok"));
  it("importando: histórico em andamento ou fila", () => {
    expect(menuHealth(conn({ phase: "history" }), now)).toBe("importing");
    expect(menuHealth(conn({ pending_orders: 12 }), now)).toBe("importing");
  });
  it("atrasada: mais de 30 h sem ler", () => expect(menuHealth(conn({ last_sync_at: "2026-10-16T15:00:00Z" }), now)).toBe("late"));
  it("erro de chave", () => expect(menuHealth(conn({ status: "error" }), now)).toBe("error"));
  it("a pior situação manda", () => {
    expect(worstMenuHealth([conn(), conn({ status: "error", provider: "prefiro" })], now)).toBe("error");
    expect(worstMenuHealth([conn(), conn({ phase: "history" })], now)).toBe("importing");
    expect(worstMenuHealth([], now)).toBeNull();
  });
});

describe("sinais da marmitaria", () => {
  it("nunca acessou = sumido", () => expect(orgFlags({ lastActivity: null, conns: [], now })).toEqual({ inactive: true, menuProblem: false, noMenu: true }));
  it("acessou há 2 dias, cardápio em dia", () => {
    expect(orgFlags({ lastActivity: "2026-10-16T15:00:00Z", conns: [conn()], now })).toEqual({ inactive: false, menuProblem: false, noMenu: false });
  });
  it("sem acesso há 9 dias e cardápio com erro", () => {
    expect(orgFlags({ lastActivity: "2026-10-09T15:00:00Z", conns: [conn({ status: "error" })], now })).toEqual({ inactive: true, menuProblem: true, noMenu: false });
  });
  it("importando não conta como problema", () => expect(orgFlags({ lastActivity: "2026-10-18T14:00:00Z", conns: [conn({ phase: "history" })], now }).menuProblem).toBe(false));
});

describe("ordenação", () => {
  const items = [
    { name: "Bela Marmita", lastActivity: "2026-10-18T10:00:00Z" },
    { name: "Açaí & Cia", lastActivity: null },
    { name: "Casa da Vovó", lastActivity: "2026-10-01T10:00:00Z" },
  ];
  const names = (l: typeof items) => l.map((i) => i.name);
  it("por nome", () => expect(names(sortOrgs(items, "name"))).toEqual(["Açaí & Cia", "Bela Marmita", "Casa da Vovó"]));
  it("acessou há menos tempo primeiro; quem nunca acessou por último", () => expect(names(sortOrgs(items, "recent"))).toEqual(["Bela Marmita", "Casa da Vovó", "Açaí & Cia"]));
  it("sumidos primeiro", () => expect(names(sortOrgs(items, "stale"))).toEqual(["Açaí & Cia", "Casa da Vovó", "Bela Marmita"]));
});

describe("gravidade e motivos de atenção", () => {
  const ago = (iso: string | null) => timeAgo(iso, now);
  const labelled = (over: Partial<MenuConnSummary> = {}) => ({ ...conn(over), providerLabel: "CardápioWeb" });

  it("gravidade", () => {
    expect(orgSeverity({ inactive: false, menuProblem: false, noMenu: true }, null)).toBe("ok");
    expect(orgSeverity({ inactive: true, menuProblem: false, noMenu: true }, null)).toBe("attention");
    expect(orgSeverity({ inactive: false, menuProblem: true, noMenu: false }, "late")).toBe("attention");
    expect(orgSeverity({ inactive: false, menuProblem: true, noMenu: false }, "error")).toBe("critical");
  });

  it("tudo em ordem = sem motivos", () => {
    expect(attentionReasons({ lastActivity: "2026-10-18T10:00:00Z", conns: [labelled()], now, ago })).toEqual([]);
  });

  it("do mais ao menos urgente: erro do cardápio, atraso, sumiço", () => {
    const r = attentionReasons({
      lastActivity: "2026-10-01T10:00:00Z",
      conns: [labelled({ last_sync_at: "2026-10-15T10:00:00Z" }), labelled({ status: "error" })],
      now,
      ago,
    });
    expect(r.map((x) => x.key)).toEqual(["menu-error", "menu-late", "inactive"]);
    expect(r[0].tab).toBe("menu");
    expect(r[2].tab).toBe("users");
    expect(r[2].text).toContain("há 17 dias");
  });

  it("nunca acessou", () => {
    expect(attentionReasons({ lastActivity: null, conns: [], now, ago }).map((x) => x.key)).toEqual(["never"]);
  });
});
