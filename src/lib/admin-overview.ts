import { isStale } from "@/lib/menu/window";

/** Sem nenhuma interação do cliente há mais que isso = "sumido". */
export const INACTIVE_DAYS = 7;

export type MenuConnSummary = {
  provider: "cardapioweb" | "prefiro";
  status: "connected" | "error";
  phase: "history" | "done";
  last_sync_at: string | null;
  pending_orders: number;
};

/** Situação da integração com o cardápio, da pior para a melhor: erro > atrasada > importando > em dia. */
export type MenuHealth = "error" | "late" | "importing" | "ok";

export function menuHealth(c: MenuConnSummary, now: Date = new Date()): MenuHealth {
  if (c.status !== "connected") return "error";
  if (c.phase === "history" || c.pending_orders > 0) return "importing";
  return isStale(c.last_sync_at, now) ? "late" : "ok";
}

const ORDER: MenuHealth[] = ["error", "late", "importing", "ok"];

/** A pior situação entre as conexões da marmitaria; `null` se não há cardápio conectado. */
export function worstMenuHealth(conns: MenuConnSummary[], now: Date = new Date()): MenuHealth | null {
  if (conns.length === 0) return null;
  return conns.map((c) => menuHealth(c, now)).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))[0];
}

export const MENU_HEALTH_LABEL: Record<MenuHealth, string> = {
  error: "Com erro",
  late: "Atrasado",
  importing: "Importando",
  ok: "Em dia",
};

export type OrgFlags = {
  /** Nunca interagiu ou está há mais de 7 dias sem interagir. */
  inactive: boolean;
  /** Integração com erro ou atrasada. */
  menuProblem: boolean;
  noMenu: boolean;
};

export function orgFlags(input: { lastActivity: string | null; conns: MenuConnSummary[]; now?: Date }): OrgFlags {
  const now = input.now ?? new Date();
  const worst = worstMenuHealth(input.conns, now);
  return {
    inactive: !input.lastActivity || now.getTime() - Date.parse(input.lastActivity) > INACTIVE_DAYS * 86_400_000,
    menuProblem: worst === "error" || worst === "late",
    noMenu: worst === null,
  };
}

export type OrgSort = "name" | "recent" | "stale";

/** Ordena para a leitura do admin: por nome, por quem acessou há menos tempo ou por quem está há mais tempo sem acessar (sumidos primeiro). */
export function sortOrgs<T extends { name: string; lastActivity: string | null }>(items: T[], sort: OrgSort): T[] {
  const at = (i: T) => (i.lastActivity ? Date.parse(i.lastActivity) : -Infinity);
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, "pt-BR");
  return [...items].sort((a, b) => {
    if (sort === "recent") return at(b) - at(a) || byName(a, b);
    if (sort === "stale") return at(a) - at(b) || byName(a, b);
    return byName(a, b);
  });
}

export type OrgSeverity = "ok" | "attention" | "critical";

/** Gravidade da marmitaria: crítica se o cardápio parou por erro; atenção se está sumida ou com cardápio atrasado. */
export function orgSeverity(flags: OrgFlags, worst: MenuHealth | null): OrgSeverity {
  if (worst === "error") return "critical";
  return flags.inactive || flags.menuProblem ? "attention" : "ok";
}

export type AttentionReason = {
  key: "menu-error" | "menu-late" | "never" | "inactive";
  text: string;
  /** aba do painel de gerenciamento onde se resolve */
  tab: "users" | "menu";
  /** menor = mais urgente */
  urgency: number;
};

/** Por que esta marmitaria pede atenção, do mais ao menos urgente (lista vazia = tudo em ordem). */
export function attentionReasons(input: {
  lastActivity: string | null;
  conns: (MenuConnSummary & { providerLabel: string })[];
  now?: Date;
  /** "há 3 dias" etc., injetado para manter este módulo sem formatação */
  ago: (iso: string | null) => string;
}): AttentionReason[] {
  const now = input.now ?? new Date();
  const out: AttentionReason[] = [];
  for (const c of input.conns) {
    const h = menuHealth(c, now);
    if (h === "error") out.push({ key: "menu-error", text: `${c.providerLabel} desconectado ou com erro`, tab: "menu", urgency: 0 });
    else if (h === "late") out.push({ key: "menu-late", text: `${c.providerLabel} sem atualizar (última leitura ${input.ago(c.last_sync_at)})`, tab: "menu", urgency: 1 });
  }
  if (!input.lastActivity) out.push({ key: "never", text: "Ainda não acessou o sistema", tab: "users", urgency: 3 });
  else if (now.getTime() - Date.parse(input.lastActivity) > INACTIVE_DAYS * 86_400_000) out.push({ key: "inactive", text: `Sem acessar (último acesso ${input.ago(input.lastActivity)})`, tab: "users", urgency: 2 });
  return out.sort((a, b) => a.urgency - b.urgency);
}

export type MenuAlert = {
  connectionId: string;
  orgId: string;
  orgName: string;
  health: "error" | "late";
  /** "Vida Mais Fitt · CardápioWeb parou: chave recusada" */
  text: string;
};

/**
 * Cardápios que pararam de importar (erro ou sem leitura há mais de 30 h), do mais grave ao menos grave.
 * Quem usa mostra isso à equipe em qualquer tela do sistema, sem precisar abrir o painel.
 */
export function menuAlerts(input: {
  conns: (MenuConnSummary & { id: string; orgId: string; orgName: string; providerLabel: string })[];
  now?: Date;
  ago: (iso: string | null) => string;
}): MenuAlert[] {
  const now = input.now ?? new Date();
  const out: MenuAlert[] = [];
  for (const c of input.conns) {
    const h = menuHealth(c, now);
    if (h === "error") out.push({ connectionId: c.id, orgId: c.orgId, orgName: c.orgName, health: "error", text: `${c.orgName} · ${c.providerLabel} parou de importar (desconectado ou chave recusada)` });
    else if (h === "late") out.push({ connectionId: c.id, orgId: c.orgId, orgName: c.orgName, health: "late", text: `${c.orgName} · ${c.providerLabel} sem importar (última leitura ${input.ago(c.last_sync_at)})` });
  }
  return out.sort((a, b) => (a.health === b.health ? a.orgName.localeCompare(b.orgName, "pt-BR") : a.health === "error" ? -1 : 1));
}
