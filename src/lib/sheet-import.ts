// Planilha (CSV ou Excel) de insumos e de fichas: leitura tolerante (colunas em qualquer ordem, nomes parecidos, vírgula brasileira).
// Regras puras, sem banco: o servidor confere nomes e grava depois da prévia.
import type { PurchaseUnit } from "@/lib/calc";
import { parseDecimal } from "@/lib/format";
import { normalizeName } from "@/lib/names";
import { classifyUnit } from "./nfe-price";

export type Cell = string | number | boolean | Date | null | undefined;
export type RowError = { line: number; message: string };

/** CSV do Excel brasileiro (ponto e vírgula) ou internacional (vírgula/tab), com aspas e BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const count = (c: string) => firstLine.split(c).length - 1;
  const delim = count(";") >= count(",") && count(";") >= count("\t") ? ";" : count("\t") > count(",") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur !== "" || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

const text = (c: Cell): string => (c === null || c === undefined ? "" : c instanceof Date ? "" : String(c).trim());
const header = (c: Cell): string => normalizeName(text(c)).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function numberOf(c: Cell): number | null {
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  const s = parseDecimal(text(c));
  return s === null ? null : Number(s);
}

type Columns<K extends string> = Partial<Record<K, number>>;

/** Procura a linha de cabeçalho (nas 10 primeiras) e a posição de cada coluna pelos nomes que o dono costuma usar. */
function findColumns<K extends string>(rows: Cell[][], synonyms: Record<K, string[]>, required: NoInfer<K>[]): { headerRow: number; cols: Columns<K> } | null {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const heads = rows[r].map(header);
    const cols: Columns<K> = {};
    for (const key of Object.keys(synonyms) as K[]) {
      const idx = heads.findIndex((h) => synonyms[key].includes(h));
      if (idx >= 0) cols[key] = idx;
    }
    if (required.every((k) => cols[k] !== undefined)) return { headerRow: r, cols };
  }
  return null;
}

export type SheetIngredient = {
  line: number;
  name: string;
  category: string | null;
  unit: PurchaseUnit;
  qty: number;
  price: number;
  correctionFactor: number;
};

const ING_COLUMNS = {
  name: ["nome", "insumo", "produto", "item", "ingrediente", "descricao"],
  unit: ["unidade", "un", "medida", "unidade de compra", "und"],
  qty: ["quantidade", "qtd", "qtde", "quantidade de compra", "qtd compra", "embalagem"],
  price: ["preco", "valor", "preco pago", "preco de compra", "custo", "preco r"],
  category: ["categoria", "grupo", "tipo"],
  fc: ["fc", "fator de correcao", "fator correcao", "fator"],
};

export function readIngredientSheet(rows: Cell[][]): { items: SheetIngredient[]; errors: RowError[] } | { error: string } {
  const found = findColumns(rows, ING_COLUMNS, ["name", "unit"]);
  if (!found) return { error: "Não achei as colunas. A primeira linha precisa ter pelo menos “Nome” e “Unidade” (veja o modelo)." };
  const { headerRow, cols } = found;
  const items: SheetIngredient[] = [];
  const errors: RowError[] = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => text(c) === "")) continue;
    const line = r + 1;
    const name = text(row[cols.name!]);
    if (!name) {
      errors.push({ line, message: "Sem nome." });
      continue;
    }
    if (name.length > 80) {
      errors.push({ line, message: `“${name.slice(0, 20)}…”: nome com mais de 80 letras.` });
      continue;
    }
    const k = classifyUnit(text(row[cols.unit!]));
    if (k.kind !== "measure") {
      errors.push({ line, message: `${name}: unidade “${text(row[cols.unit!])}” não é válida. Use kg, g, l, ml ou un.` });
      continue;
    }
    const qty = cols.qty === undefined || text(row[cols.qty]) === "" ? 1 : numberOf(row[cols.qty]);
    if (qty === null || !(qty > 0)) {
      errors.push({ line, message: `${name}: quantidade inválida.` });
      continue;
    }
    const price = cols.price === undefined || text(row[cols.price]) === "" ? 0 : numberOf(row[cols.price]);
    if (price === null || price < 0 || price > 1_000_000) {
      errors.push({ line, message: `${name}: preço inválido.` });
      continue;
    }
    const fc = cols.fc === undefined || text(row[cols.fc]) === "" ? 1 : numberOf(row[cols.fc]);
    if (fc === null || fc < 1 || fc > 10) {
      errors.push({ line, message: `${name}: o fator de correção precisa ser 1 ou mais.` });
      continue;
    }
    const category = cols.category === undefined ? "" : text(row[cols.category]);
    items.push({ line, name, category: category ? category.slice(0, 40) : null, unit: k.unit, qty, price, correctionFactor: fc });
  }
  if (items.length === 0 && errors.length === 0) return { error: "A planilha não tem linhas com insumos." };
  return { items, errors };
}

export type SheetRecipeLine = { line: number; ingredient: string; qty: number; unit: PurchaseUnit };
export type SheetRecipe = { name: string; category: string | null; lines: SheetRecipeLine[] };

const REC_COLUMNS = {
  recipe: ["ficha", "marmita", "prato", "receita", "produto final", "nome da ficha"],
  ingredient: ["insumo", "ingrediente", "item", "componente"],
  qty: ["quantidade", "qtd", "qtde", "gramas", "peso"],
  unit: ["unidade", "un", "medida", "und"],
  category: ["categoria", "grupo"],
};

/** Planilha "longa": uma linha por insumo, repetindo o nome da ficha. Ficha por unidade (uma marmita), como o cadastro simples. */
export function readRecipeSheet(rows: Cell[][]): { recipes: SheetRecipe[]; errors: RowError[] } | { error: string } {
  const found = findColumns(rows, REC_COLUMNS, ["recipe", "ingredient", "qty"]);
  if (!found) return { error: "Não achei as colunas. A primeira linha precisa ter “Ficha”, “Insumo” e “Quantidade” (veja o modelo)." };
  const { headerRow, cols } = found;
  const recipes = new Map<string, SheetRecipe>();
  const errors: RowError[] = [];
  let lastRecipe = "";
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => text(c) === "")) continue;
    const line = r + 1;
    // Nome da ficha em branco = continua a ficha da linha de cima (planilha com células mescladas ou só o 1º nome preenchido).
    const recipeName = text(row[cols.recipe!]) || lastRecipe;
    lastRecipe = recipeName;
    const ingredient = text(row[cols.ingredient!]);
    if (!recipeName) {
      errors.push({ line, message: "Sem nome da ficha." });
      continue;
    }
    if (recipeName.length > 80) {
      errors.push({ line, message: `Ficha “${recipeName.slice(0, 20)}…”: nome com mais de 80 letras.` });
      continue;
    }
    if (!ingredient) {
      errors.push({ line, message: `${recipeName}: linha sem insumo.` });
      continue;
    }
    const qty = numberOf(row[cols.qty!]);
    if (qty === null || !(qty > 0)) {
      errors.push({ line, message: `${recipeName} → ${ingredient}: quantidade inválida.` });
      continue;
    }
    const rawUnit = cols.unit === undefined ? "" : text(row[cols.unit]);
    const k = rawUnit === "" ? ({ kind: "measure", unit: "g" } as const) : classifyUnit(rawUnit);
    if (k.kind !== "measure") {
      errors.push({ line, message: `${recipeName} → ${ingredient}: unidade “${rawUnit}” não é válida. Use kg, g, l, ml ou un.` });
      continue;
    }
    const key = normalizeName(recipeName);
    const rec = recipes.get(key) ?? { name: recipeName, category: null, lines: [] };
    const category = cols.category === undefined ? "" : text(row[cols.category]);
    if (category && !rec.category) rec.category = category.slice(0, 40);
    rec.lines.push({ line, ingredient, qty, unit: k.unit });
    recipes.set(key, rec);
  }
  if (recipes.size === 0 && errors.length === 0) return { error: "A planilha não tem linhas de fichas." };
  return { recipes: [...recipes.values()], errors };
}

/** Modelos para baixar (CSV com ponto e vírgula e BOM, que o Excel brasileiro abre direto). */
export const INGREDIENT_TEMPLATE = "﻿Nome;Unidade;Quantidade;Preço;Categoria;Fator de correção\r\nPeito de frango;kg;1;17,90;Carnes;1,15\r\nArroz branco;kg;5;28,00;Grãos;1\r\nÓleo de soja;l;0,9;8,50;Mercearia;1\r\n";
export const RECIPE_TEMPLATE = "﻿Ficha;Insumo;Quantidade;Unidade\r\nFrango com arroz;Peito de frango;120;g\r\nFrango com arroz;Arroz branco;100;g\r\nFrango com arroz;Óleo de soja;5;ml\r\n";
