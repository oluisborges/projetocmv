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
