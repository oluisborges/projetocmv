import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O admin Shogun enxerga TODAS as marmitarias pelo banco (RLS). Por isso, no modo "ver como", só um filtro explícito
 * por marmitaria/unidade no código garante que ele veja apenas os dados daquela marmitaria. Este teste varre o código e
 * falha se alguma consulta a uma tabela de negócio não filtrar por org_id/unit_id (ou pelo pai: período, ficha, insumo).
 */
const TABLES = [
  "ingredients",
  "recipes",
  "recipe_items",
  "recipe_prices",
  "fixed_costs",
  "staff",
  "periods",
  "period_sales",
  "sales_channels",
  "unit_settings",
  "month_snapshots",
  "ingredient_price_history",
  "activity_log",
];
const SCOPE = /org_id|unit_id|period_id|recipe_id|ingredient_id/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

describe("filtro por marmitaria nas consultas do app", () => {
  const files = [...walk("src/app"), ...walk("src/lib")].filter((f) => !/[\\/]admin[\\/]/.test(f) && !/supabase[\\/]admin/.test(f));

  it("toda consulta a tabela de negócio filtra por marmitaria, unidade ou pelo registro pai", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf-8");
      for (const table of TABLES) {
        const re = new RegExp(`\\.from\\("${table}"\\)`, "g");
        for (const m of text.matchAll(re)) {
          // a consulta vai até o ponto e vírgula que fecha a instrução
          const rest = text.slice(m.index);
          const end = rest.indexOf(";");
          const statement = end === -1 ? rest : rest.slice(0, end);
          if (!SCOPE.test(statement)) offenders.push(`${file.replace(/\\/g, "/")}: from("${table}") sem filtro de marmitaria`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
