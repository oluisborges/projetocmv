// NF-e: unidades, preço de cada item e ligação com os insumos. Regras puras, sem leitor de XML (por isso a tela do navegador pode usar).
import { baseUnitOf, isPurchaseUnit, toBaseQty, type BaseUnit, type PurchaseUnit } from "@/lib/calc";
import { normalizeName } from "@/lib/names";

export type NfeItem = {
  /** Posição na nota (nItem). */
  index: number;
  /** Código do produto no fornecedor (cProd). */
  code: string;
  name: string;
  /** Unidade comercial como veio (KG, UN, CX…), sem acento e em maiúsculas. */
  unit: string;
  qty: number;
  /** Preço unitário da nota (vUnCom). */
  unitPrice: number;
  /** Valor do item depois do desconto (vProd − vDesc). */
  total: number;
};

/** Texto da unidade sem acento, em maiúsculas e sem ponto ("Pç." → "PC"). */
export const normalizeUnit = (u: string): string => normalizeName(u).replace(/[^a-z0-9]/g, "").toUpperCase();

/**
 * Como a unidade da nota se relaciona com os insumos: peso, volume, contagem ("UN") ou embalagem (CX, PCT, SC…), em que
 * não dá para saber o conteúdo pela nota e o dono informa uma vez (que o sistema lembra nas próximas notas).
 */
export type UnitKind = { kind: "measure"; unit: PurchaseUnit } | { kind: "pack" };

const MEASURES: Record<string, PurchaseUnit> = {
  KG: "kg", QUILO: "kg", KGS: "kg", QUILOGRAMA: "kg",
  G: "g", GR: "g", GRAMA: "g", GRAMAS: "g",
  L: "l", LT: "l", LTS: "l", LITRO: "l", LITROS: "l",
  ML: "ml",
  UN: "un", UND: "un", UNID: "un", UNIDADE: "un", UNIDADES: "un", PC: "un", PECA: "un", PEC: "un",
};

export function classifyUnit(unit: string): UnitKind {
  const u = MEASURES[normalizeUnit(unit)];
  return u ? { kind: "measure", unit: u } : { kind: "pack" };
}

/** Quantidade de uma embalagem informada pelo dono ("CX com 12 un", "SC de 5 kg"). */
export type PackSize = { qty: number; unit: PurchaseUnit };

export type CostPerBase = { base: BaseUnit; perBase: number };

/**
 * Quanto custa cada grama, ml ou unidade neste item da nota (já com o desconto da nota).
 * Unidade medida: direto. Embalagem (CX, PCT…): precisa do conteúdo (`pack`); sem ele, `null`.
 */
export function nfeCostPerBase(item: Pick<NfeItem, "unit" | "qty" | "total" | "unitPrice">, pack?: PackSize | null): CostPerBase | null {
  const perUnit = item.qty > 0 && item.total > 0 ? item.total / item.qty : item.unitPrice; // preço de UMA unidade comercial, já sem desconto
  if (!(perUnit > 0)) return null;
  const k = classifyUnit(item.unit);
  if (k.kind === "measure") {
    const grams = toBaseQty(1, k.unit).toNumber();
    return { base: baseUnitOf(k.unit), perBase: perUnit / grams };
  }
  if (!pack || !(pack.qty > 0) || !isPurchaseUnit(pack.unit)) return null;
  return { base: baseUnitOf(pack.unit), perBase: perUnit / toBaseQty(pack.qty, pack.unit).toNumber() };
}

/**
 * Novo preço de compra do insumo, mantendo a embalagem de compra dele (quantidade e unidade) e trocando só o preço.
 * `null` se a nota mede outra coisa (insumo em gramas, nota em litros).
 */
export function newPurchasePrice(cost: CostPerBase, ingredient: { purchase_qty: number; purchase_unit: PurchaseUnit }): number | null {
  if (baseUnitOf(ingredient.purchase_unit) !== cost.base) return null;
  const price = cost.perBase * toBaseQty(ingredient.purchase_qty, ingredient.purchase_unit).toNumber();
  return Math.round(price * 10_000) / 10_000;
}

// ---------------------------------------------------------------- ligar o item da nota a um insumo

export type MatchCandidate = { id: string; name: string };

const NOISE = new Set(["de", "da", "do", "com", "e", "a", "o", "em", "para", "tipo", "kg", "g", "gr", "l", "ml", "un", "und", "cx", "pct", "sc", "fd", "c", "p"]);
const tokens = (name: string): string[] =>
  normalizeName(name)
    .replace(/[^a-z0-9 ]/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 && !NOISE.has(t) && !/^\d+([.,]\d+)?(g|gr|kg|ml|l|un)?$/.test(t));

/**
 * Sugere o insumo cujo nome mais combina com o do item ("FILE PEITO FRANGO CONG KG" → "Peito de frango"). Só sugere quando é claro
 * (todas as palavras do insumo aparecem no item e não há empate); o dono sempre confirma na prévia.
 */
export function suggestIngredient(itemName: string, candidates: MatchCandidate[]): MatchCandidate | null {
  const wanted = new Set(tokens(itemName));
  if (wanted.size === 0) return null;
  let best: { c: MatchCandidate; score: number } | null = null;
  let tie = false;
  for (const c of candidates) {
    const have = tokens(c.name);
    if (have.length === 0) continue;
    const common = have.filter((t) => wanted.has(t)).length;
    if (common === 0 || common < have.length) continue; // todas as palavras do insumo precisam estar no item
    const score = common / Math.max(wanted.size, have.length);
    if (!best || score > best.score + 1e-9) {
      best = { c, score };
      tie = false;
    } else if (Math.abs(score - best.score) <= 1e-9) tie = true;
  }
  return best && !tie ? best.c : null;
}
