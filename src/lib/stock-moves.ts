import { formatBaseQty, formatNumber } from "@/lib/format";

export type MoveKind = "count" | "purchase" | "production" | "waste" | "adjust" | "produced";

export const MOVE_KINDS: { key: MoveKind; label: string; plural: string }[] = [
  { key: "purchase", label: "Compra", plural: "Compras" },
  { key: "production", label: "Uso na produção", plural: "Uso na produção" },
  { key: "produced", label: "Produzida", plural: "Produzidas" },
  { key: "count", label: "Contagem", plural: "Contagens" },
  { key: "waste", label: "Perda", plural: "Perdas" },
  { key: "adjust", label: "Ajuste", plural: "Ajustes" },
];

export const isMoveKind = (v: unknown): v is MoveKind => MOVE_KINDS.some((k) => k.key === v);

export type MoveRow = {
  id: string;
  at: string;
  kind: MoveKind;
  /** Insumo ou marmita pronta. */
  name: string;
  baseUnit: "g" | "ml" | "un";
  /** Marmita pronta (sempre em unidades). */
  finished: boolean;
  qty: number;
  note: string | null;
  paid: number | null;
};

const kindLabel = (k: MoveKind) => MOVE_KINDS.find((m) => m.key === k)?.label ?? k;

/** "+2,5 kg", "−300 g" ou, na contagem, "contou 8 kg": a quantidade como a pessoa lê. */
export function moveQtyText(m: Pick<MoveRow, "kind" | "qty" | "baseUnit" | "finished">): string {
  const fmt = (q: number) => (m.finished ? `${formatNumber(Math.abs(q), 0)} un` : formatBaseQty(Math.abs(q), m.baseUnit));
  if (m.kind === "count") return `contou ${fmt(m.qty)}`;
  return `${m.qty < 0 ? "−" : "+"}${fmt(m.qty)}`;
}

/** Texto da linha: "Compra · Frango" etc. */
export const moveTitle = (m: Pick<MoveRow, "kind" | "name">): string => `${kindLabel(m.kind)} · ${m.name}`;

const norm = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/** Filtra por tipo e por parte do nome. */
export function filterMoves(rows: MoveRow[], opts: { kind?: MoveKind | null; query?: string | null }): MoveRow[] {
  const q = opts.query ? norm(opts.query) : "";
  return rows.filter((r) => (!opts.kind || r.kind === opts.kind) && (q === "" || norm(r.name).includes(q)));
}

/** Quanto de cada tipo houve (para os números nas pílulas de filtro). */
export function countByKind(rows: MoveRow[]): Record<MoveKind, number> {
  const out: Record<MoveKind, number> = { count: 0, purchase: 0, production: 0, waste: 0, adjust: 0, produced: 0 };
  for (const r of rows) out[r.kind]++;
  return out;
}
