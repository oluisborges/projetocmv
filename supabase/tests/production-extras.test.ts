/**
 * Valor pago, lotes de marmitas prontas e estoque mínimo (migration production_extras), num Postgres embutido (PGlite)
 * com as migrations reais: isolamento entre marmitarias (RLS) e as travas dos campos.
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
const U = { owner: id(1), other: id(2), orgA: id(10), orgB: id(11), unitA: id(20), prodA: id(30), ingA: id(40) };

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

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUB);
  for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort()) await db.exec(readFileSync(path.join(MIGRATIONS, f), "utf8"));

  await q(`insert into auth.users (id, email) values ($1,'dono@x.com'), ($2,'outro@x.com')`, [U.owner, U.other]);
  await q(`insert into public.organizations (id, name, slug) values ($1,'Marmita A','marmita-a'), ($2,'Marmita B','marmita-b')`, [U.orgA, U.orgB]);
  await q(`insert into public.memberships (org_id, user_id, role) values ($1,$2,'owner'), ($3,$4,'owner')`, [U.orgA, U.owner, U.orgB, U.other]);
  await q(`insert into public.units (id, org_id, name) values ($1,$2,'Matriz')`, [U.unitA, U.orgA]);
  await q(`insert into public.recipes (id, org_id, name, portions) values ($1,$2,'Marmita A',1)`, [U.prodA, U.orgA]);
  await q(`insert into public.ingredients (id, org_id, name, kind, purchase_unit, purchase_qty, purchase_price) values ($1,$2,'Arroz','insumo','kg',1,5)`, [U.ingA, U.orgA]);
});

afterAll(async () => {
  await db.close();
});

describe("production_extras", () => {
  it("compra com valor pago, sem valor negativo", async () => {
    await asUser(U.owner, () => q(`insert into public.stock_movements (org_id, unit_id, ingredient_id, kind, qty_base, paid_amount) values ($1,$2,$3,'purchase',5000,24.9)`, [U.orgA, U.unitA, U.ingA]));
    expect((await q(`select paid_amount from public.stock_movements where kind = 'purchase'`))[0].paid_amount).toBe("24.90");
    await expect(q(`insert into public.stock_movements (org_id, unit_id, ingredient_id, kind, qty_base, paid_amount) values ($1,$2,$3,'purchase',1000,-1)`, [U.orgA, U.unitA, U.ingA])).rejects.toThrow();
  });

  it("lote: o dono guarda e a validade não pode ser antes da produção", async () => {
    await asUser(U.owner, () => q(`insert into public.finished_lots (org_id, unit_id, recipe_id, code, qty, produced_on, expires_on) values ($1,$2,$3,'L0711',92,'2026-11-07','2027-02-05')`, [U.orgA, U.unitA, U.prodA]));
    expect(await asUser(U.owner, () => q(`select qty from public.finished_lots`))).toHaveLength(1);
    await expect(q(`insert into public.finished_lots (org_id, unit_id, recipe_id, qty, produced_on, expires_on) values ($1,$2,$3,10,'2026-11-07','2026-11-01')`, [U.orgA, U.unitA, U.prodA])).rejects.toThrow();
    await expect(q(`insert into public.finished_lots (org_id, unit_id, recipe_id, qty, produced_on) values ($1,$2,$3,0,'2026-11-07')`, [U.orgA, U.unitA, U.prodA])).rejects.toThrow();
  });

  it("outra marmitaria não vê nem cria lote ou mínimo", async () => {
    expect(await asUser(U.other, () => q(`select id from public.finished_lots`))).toHaveLength(0);
    await expect(asUser(U.other, () => q(`insert into public.finished_lots (org_id, unit_id, recipe_id, qty, produced_on) values ($1,$2,$3,5,'2026-11-07')`, [U.orgA, U.unitA, U.prodA]))).rejects.toThrow();
    await asUser(U.owner, () => q(`insert into public.stock_minimums (org_id, unit_id, ingredient_id, min_qty) values ($1,$2,$3,2000)`, [U.orgA, U.unitA, U.ingA]));
    expect(await asUser(U.other, () => q(`select id from public.stock_minimums`))).toHaveLength(0);
    expect(await asUser(U.owner, () => q(`select min_qty from public.stock_minimums`))).toHaveLength(1);
  });

  it("estoque mínimo: um por insumo na unidade e sempre maior que zero", async () => {
    await expect(q(`insert into public.stock_minimums (org_id, unit_id, ingredient_id, min_qty) values ($1,$2,$3,3000)`, [U.orgA, U.unitA, U.ingA])).rejects.toThrow();
    await expect(q(`update public.stock_minimums set min_qty = 0`)).rejects.toThrow();
  });

  it("apagar o produto apaga os lotes", async () => {
    await q(`delete from public.recipes where id = $1`, [U.prodA]);
    expect(await q(`select 1 from public.finished_lots where recipe_id = $1`, [U.prodA])).toHaveLength(0);
  });
});
