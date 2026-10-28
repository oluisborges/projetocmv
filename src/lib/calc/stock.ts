import { D } from "./decimal";

export type MovementKind = "count" | "purchase" | "production" | "waste" | "adjust" | "produced";

export type Movement = {
  kind: MovementKind;
  /** `count`: a quantidade REAL naquele momento. Os outros: variação com sinal (+ entra, − sai), na unidade-base. */
  qty: number;
  /** ISO 8601. */
  at: string;
};

export type Balance = {
  /** Saldo atual (pode ficar negativo quando a produção gastou mais do que foi contado: sinal de contagem desatualizada). */
  balance: number;
  /** Data da última contagem, base do saldo. `null` = nunca foi contado. */
  lastCountAt: string | null;
  /** Há algum movimento? Sem nenhum, o saldo é desconhecido (não é "zero"). */
  known: boolean;
};

/**
 * Saldo de um item: a última contagem manda (é o que existe de verdade); depois dela, somam-se as variações.
 * Sem nenhuma contagem, parte de zero. Contagens e variações no mesmo instante: a contagem vale primeiro.
 */
export function stockBalance(movements: Movement[]): Balance {
  if (movements.length === 0) return { balance: 0, lastCountAt: null, known: false };
  const sorted = [...movements].sort((a, b) => (a.at === b.at ? (a.kind === "count" ? 0 : 1) - (b.kind === "count" ? 0 : 1) : a.at < b.at ? -1 : 1));
  let lastCount = -1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].kind === "count") {
      lastCount = i;
      break;
    }
  }
  let balance = lastCount >= 0 ? D(sorted[lastCount].qty) : D(0);
  for (const m of sorted.slice(lastCount + 1)) if (m.kind !== "count") balance = balance.plus(m.qty);
  return { balance: balance.toNumber(), lastCountAt: lastCount >= 0 ? sorted[lastCount].at : null, known: true };
}

/**
 * Saldo de marmitas prontas (congeladas): contagem + produzidas − vendidas desde então.
 * As vendas vêm do cardápio digital (`soldSince`), que não fica no livro de movimentos.
 */
export function finishedBalance(movements: Movement[], soldSince: number): Balance {
  const base = stockBalance(movements);
  if (!base.known) return base;
  return { ...base, balance: D(base.balance).minus(Math.max(0, soldSince)).toNumber() };
}

/** Variações que a contagem corrige: o quanto o saldo estimado estava errado (contado − estimado). */
export function countDifference(estimated: number, counted: number): number {
  return D(counted).minus(estimated).toNumber();
}
