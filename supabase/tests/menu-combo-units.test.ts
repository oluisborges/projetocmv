/**
 * Marmitas vendidas com combos (menu_recipe_units / menu_combo_covered), num Postgres embutido (PGlite) com as migrations reais.
 * A regra: combo e opções são a mesma coisa; nunca se tira duas vezes.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS = path.resolve(import.meta.dirname, "../migrations");

const STUB = `
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb, raw_app_meta_data jsonb);
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const U = { owner: id(1), other: id(2), org: id(10), unit: id(20), x: id(30), y: id(31), fixo: id(40), escolha: id(41), connection: id(50) };

let db: PGlite;
const q = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as Record<string, unknown>[];

async function asUser<T>(user: string, fn: () => Promise<T>): Promise<T> {
  await db.exec("set role authenticated");
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: user })]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

const product = async (key: string, kind: "item" | "option", opts: { recipe?: string; combo?: string; units?: number }) => {
  const [p] = await q(
    `insert into public.menu_products (org_id, provider, external_key, name, kind, recipe_id, combo_id, units_per_sale) values ($1,'cardapioweb',$2,$2,$3,$4,$5,$6) returning id`,
    [U.org, key, kind, opts.recipe ?? null, opts.combo ?? null, opts.units ?? 1],
  );
  return p.id as string;
};

const order = async (ext: string, lines: [string, number][]) => {
  const [o] = await q(
    `insert into public.menu_orders (org_id, unit_id, connection_id, external_id, ordered_at, total) values ($1,$2,$3,$4,'2026-11-01T15:00:00Z',100) returning id`,
    [U.org, U.unit, U.connection, ext],
  );
  for (const [productId, qty] of lines) {
    await q(`insert into public.menu_order_lines (org_id, order_id, product_id, qty, line_total) values ($1,$2,$3,$4,10)`, [U.org, o.id, productId, qty]);
  }
};

let prod: Record<string, string>;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUB);
  for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort()) await db.exec(readFileSync(path.join(MIGRATIONS, f), "utf8"));

  await q(`insert into auth.users (id, email) values ($1,'dono@x.com'), ($2,'outro@x.com')`, [U.owner, U.other]);
  await q(`insert into public.organizations (id, name, slug) values ($1,'Marmita','marmita'), ($2,'Outra','outra')`, [U.org, id(11)]);
  await q(`insert into public.memberships (org_id, user_id, role) values ($1,$2,'owner'), ($3,$4,'owner')`, [U.org, U.owner, id(11), U.other]);
  await q(`insert into public.units (id, org_id, name) values ($1,$2,'Matriz')`, [U.unit, U.org]);
  await q(`insert into public.recipes (id, org_id, name, portions) values ($1,$3,'Marmita X',1), ($2,$3,'Marmita Y',1)`, [U.x, U.y, U.org]);
  await q(`insert into public.menu_connections (id, org_id, unit_id, provider) values ($1,$2,$3,'cardapioweb')`, [U.connection, U.org, U.unit]);

  // Combo fixo: 2 X + 3 Y. Combo de escolha: 5 marmitas entre X e Y.
  await q(`insert into public.combos (id, org_id, name) values ($1,$3,'Combo fixo'), ($2,$3,'Combo escolha')`, [U.fixo, U.escolha, U.org]);
  const [gf] = await q(`insert into public.combo_groups (org_id, combo_id, name, kind) values ($1,$2,'Fixas','fixed') returning id`, [U.org, U.fixo]);
  await q(`insert into public.combo_group_options (org_id, group_id, recipe_id, qty, unit_price) values ($1,$2,$3,2,20), ($1,$2,$4,3,20)`, [U.org, gf.id, U.x, U.y]);
  const [gc] = await q(`insert into public.combo_groups (org_id, combo_id, name, kind, pick_qty, unit_price) values ($1,$2,'Escolha','choice',5,20) returning id`, [U.org, U.escolha]);
  await q(`insert into public.combo_group_options (org_id, group_id, recipe_id) values ($1,$2,$3), ($1,$2,$4)`, [U.org, gc.id, U.x, U.y]);

  prod = {
    itemX: await product("item-x", "item", { recipe: U.x }),
    kit3X: await product("kit3-x", "item", { recipe: U.x, units: 3 }),
    optionY: await product("opt-y", "option", { recipe: U.y }),
    comboFixo: await product("combo-fixo", "item", { combo: U.fixo }),
    comboEscolha: await product("combo-escolha", "item", { combo: U.escolha }),
  };

  await order("O1", [[prod.comboFixo, 2]]); // combo fixo sem opções: 2 × (2 X + 3 Y) = 4 X + 6 Y
  await order("O2", [[prod.comboEscolha, 1], [prod.optionY, 5]]); // escolha com opções: 5 Y (o combo não é expandido)
  await order("O3", [[prod.comboFixo, 1], [prod.optionY, 3]]); // fixo COM opções: valem as opções (3 Y); nada de 2 X + 3 Y por cima
  await order("O4", [[prod.itemX, 2], [prod.kit3X, 1]]); // fichas: 2 X + kit de 3 X
});

afterAll(async () => {
  await db.close();
});

const range = [new Date("2026-11-01T00:00:00Z").toISOString(), new Date("2026-12-01T00:00:00Z").toISOString()];

describe("marmitas vendidas com combos", () => {
  it("conta cada marmita uma vez: combo fixo expande, opções valem sozinhas", async () => {
    const rows = await asUser(U.owner, () => q(`select recipe_id, units from public.menu_recipe_units($1,$2,$3)`, [U.unit, ...range]));
    const units = Object.fromEntries(rows.map((r) => [r.recipe_id, Number(r.units)]));
    expect(units[U.x]).toBe(4 + 2 + 3); // O1 (fixo) + O4 (item) + O4 (kit de 3)
    expect(units[U.y]).toBe(6 + 5 + 3); // O1 (fixo) + O2 (opções) + O3 (opções)
  });

  it("diz quantas vendas de combo já foram cobertas pelas opções", async () => {
    const rows = await asUser(U.owner, () => q(`select product_id, qty from public.menu_combo_covered($1,$2,$3)`, [U.unit, ...range]));
    const covered = Object.fromEntries(rows.map((r) => [r.product_id, Number(r.qty)]));
    expect(covered[prod.comboEscolha]).toBe(1); // O2
    expect(covered[prod.comboFixo]).toBe(1); // O3 (o do O1 não tinha opções)
  });

  it("fora do período não conta", async () => {
    const rows = await asUser(U.owner, () => q(`select * from public.menu_recipe_units($1,$2,$3)`, [U.unit, "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z"]));
    expect(rows).toEqual([]);
  });

  it("quem não é da marmitaria não vê nada", async () => {
    const rows = await asUser(U.other, () => q(`select * from public.menu_recipe_units($1,$2,$3)`, [U.unit, ...range]));
    expect(rows).toEqual([]);
    const covered = await asUser(U.other, () => q(`select * from public.menu_combo_covered($1,$2,$3)`, [U.unit, ...range]));
    expect(covered).toEqual([]);
  });
});
