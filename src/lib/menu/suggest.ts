import { normalizeName } from "@/lib/names";

export type LinkCandidate = { id: string; name: string; kind: "recipe" | "combo" };

/** Palavras que não ajudam a reconhecer o prato: pesos, tamanhos, ligações. */
const NOISE = new Set(["de", "da", "do", "com", "e", "a", "o", "com", "c", "marmita", "marmitas", "un", "und", "unidade", "unidades", "g", "gr", "kg", "ml", "p", "m", "g"]);

function tokens(name: string): string[] {
  return normalizeName(name)
    .replace(/[^a-z0-9 ]/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 && !NOISE.has(t) && !/^\d+(g|gr|kg|ml)?$/.test(t));
}

/**
 * Sugere a ficha ou o combo mais parecido com o nome vendido no cardápio ("Strogonoff de frango 350g" → "Strogonoff de frango").
 * Compara as palavras que sobram sem pesos nem tamanhos. Só sugere quando a semelhança é clara; o dono sempre confirma.
 */
export function suggestLink(productName: string, candidates: LinkCandidate[]): LinkCandidate | null {
  const wanted = new Set(tokens(productName));
  if (wanted.size === 0) return null;
  let best: { c: LinkCandidate; score: number } | null = null;
  let tie = false;
  for (const c of candidates) {
    const have = new Set(tokens(c.name));
    if (have.size === 0) continue;
    const common = [...have].filter((t) => wanted.has(t)).length;
    if (common === 0) continue;
    // todas as palavras da ficha aparecem no produto vendido (ou vice-versa) conta mais que sobreposição parcial
    const score = common / Math.max(wanted.size, have.size) + (common === have.size || common === wanted.size ? 0.25 : 0);
    if (!best || score > best.score + 1e-9) {
      best = { c, score };
      tie = false;
    } else if (Math.abs(score - best.score) <= 1e-9) tie = true;
  }
  return best && !tie && best.score >= 0.75 ? best.c : null;
}
