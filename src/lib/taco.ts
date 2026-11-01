import { emptyNutrition, type Nutrition } from "@/lib/calc/nutrition";
import { TACO_CATEGORIES, TACO_FOODS, type TacoRow } from "@/lib/taco-data";

export type TacoFood = { id: number; name: string; category: string };

const BY_ID = new Map<number, TacoRow>(TACO_FOODS.map((r) => [r[0], r]));

export const tacoFood = (id: number): TacoFood | null => {
  const r = BY_ID.get(id);
  return r ? { id: r[0], name: r[1], category: TACO_CATEGORIES[r[2]] } : null;
};

/** Nutrientes por 100 g de um alimento da TACO. A TACO não traz açúcares, então ficam sem dado. */
export function tacoNutrition(id: number): Nutrition | null {
  const r = BY_ID.get(id);
  if (!r) return null;
  const n = emptyNutrition();
  // Sal (516, 517) não tem energia: a TACO deixa em branco, mas o valor é zero.
  n.kcal = r[3] ?? (id === 516 || id === 517 ? 0 : null);
  n.protein = r[4];
  n.fat = r[5];
  n.carbs = r[6];
  n.fiber = r[7];
  n.sodium = r[8];
  n.satFat = r[9];
  n.transFat = r[10];
  return n;
}

const fold = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const STOP = new Set(["de", "da", "do", "das", "dos", "com", "sem", "em", "e", "a", "o", "in", "natura", "tipo", "para"]);
/** Tira plural e gênero ("crua" e "cru", "cebolas" e "cebola" viram a mesma raiz). */
const stem = (w: string) => {
  let s = w.replace(/s$/, "");
  if (s.length > 3 && /[ao]$/.test(s)) s = s.slice(0, -1);
  return s;
};
const tokens = (t: string) =>
  fold(t)
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w))
    .map(stem);

const INDEX = TACO_FOODS.map((r) => ({ id: r[0], toks: tokens(r[1]), first: tokens(r[1])[0] }));
/** Miúdos: só entram na sugestão se o nome do ingrediente os pedir. */
const OFFAL = new Set(["coracao", "figado", "moela", "miolo", "rim", "bucho", "lingua", "pele"].map(stem));
const PREPARED = new Set(["cozid", "grelhad", "frit", "assad", "refogad", "ensopad", "cru", "defumad", "empanad", "braseado"].map(stem));

/** Busca alimentos da TACO pelo nome (todas as palavras digitadas precisam aparecer), para a pessoa escolher o certo. */
export function searchTaco(query: string, limit = 40): TacoFood[] {
  const q = tokens(query);
  if (q.length === 0) return [];
  const out: TacoFood[] = [];
  for (const f of INDEX) {
    if (q.every((w) => f.toks.some((t) => t.startsWith(w)))) {
      const food = tacoFood(f.id);
      if (food) out.push(food);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Nomes curtos do dia a dia que o casamento por palavras erraria ("leite" não é leite condensado). Chave: nome sem acento, minúsculo. */
const ALIASES: Record<string, number> = {
  sal: 517,
  azeite: 260,
  "azeite de oliva": 260,
  leite: 458,
  "leite integral": 458,
  mussarela: 463,
  mozarela: 463,
  "queijo mussarela": 463,
  "queijo mozarela": 463,
  "queijo parmesao": 464,
  parmesao: 464,
  arroz: 3,
  "arroz branco": 3,
  frango: 405,
  "peito de frango": 409,
  "file de frango": 409,
  "coxa de frango": 399,
  "sobrecoxa de frango": 414,
  sobrecoxa: 414,
  ovo: 489,
  ovos: 489,
  "ovo de galinha": 489,
};

export type TacoSuggestion = {
  food: TacoFood;
  /** alta = pode entrar na conta (nome bate de forma clara); possivel = há dúvida, só vale depois da pessoa confirmar. */
  confidence: "alta" | "possivel";
};

/**
 * Sugere o alimento da TACO para o nome de um ingrediente ("Cebola in natura" → "Cebola, crua"). A sugestão é "alta" quando
 * todas as palavras do ingrediente aparecem no alimento, sobra no máximo uma palavra a mais (cru/cozido…) e nenhum outro
 * alimento chega perto; do contrário é só "possível" (ex.: "Carne moída" tem vários cortes), e a pessoa precisa confirmar.
 */
export function suggestTaco(ingredientName: string): TacoSuggestion | null {
  const alias = ALIASES[fold(ingredientName).replace(/[^a-z0-9]+/g, " ").trim()];
  if (alias !== undefined) {
    const food = tacoFood(alias);
    return food ? { food, confidence: "alta" } : null;
  }
  const q = tokens(ingredientName);
  if (q.length === 0) return null;
  const wantsState = q.some((w) => PREPARED.has(w));
  const found: { id: number; score: number; hits: number; extra: number }[] = [];
  for (const f of INDEX) {
    const hits = q.filter((w) => f.toks.includes(w)).length;
    if (hits === 0 || hits < Math.ceil(q.length * 0.6)) continue;
    if (!f.toks.includes(q[0]) && !f.toks.slice(0, 2).some((t) => q.includes(t))) continue;
    const extra = Math.max(0, f.toks.length - hits);
    let score = hits / q.length;
    score += f.toks[0] === q[0] ? 0.3 : 0;
    score -= extra * 0.04;
    if (!wantsState && f.toks.includes(stem("cru"))) score += 0.12;
    if (f.toks.some((w) => OFFAL.has(w) && !q.includes(w))) score -= 0.5;
    found.push({ id: f.id, score, hits, extra });
  }
  found.sort((a, b) => b.score - a.score);
  const [best, second] = found;
  if (!best) return null;
  const food = tacoFood(best.id);
  if (!food) return null;
  const clear = best.hits === q.length && best.extra <= 1 && (!second || best.score - second.score >= 0.08);
  return { food, confidence: clear ? "alta" : "possivel" };
}
