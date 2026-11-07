/**
 * Foto do produto, texto de preparo/montagem e ordem dos itens (migration ficha_extras), num Postgres embutido (PGlite)
 * com as migrations reais: isolamento entre marmitarias (RLS) e as travas de formato e tamanho.
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
const U = { owner: id(1), other: id(2), orgA: id(10), orgB: id(11), prodA: id(30), ingA: id(40) };
const PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";

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
  await q(`insert into public.recipes (id, org_id, name, portions) values ($1,$2,'Marmita A',1)`, [U.prodA, U.orgA]);
  await q(`insert into public.ingredients (id, org_id, name, kind, purchase_unit, purchase_qty, purchase_price) values ($1,$2,'Arroz','insumo','kg',1,5)`, [U.ingA, U.orgA]);
});

afterAll(async () => {
  await db.close();
});

describe("ficha_extras", () => {
  it("o dono guarda a foto do produto e a própria marmitaria lê", async () => {
    await asUser(U.owner, () => q(`insert into public.recipe_photos (recipe_id, org_id, data_url) values ($1,$2,$3)`, [U.prodA, U.orgA, PHOTO]));
    const rows = await asUser(U.owner, () => q(`select recipe_id from public.recipe_photos`));
    expect(rows).toHaveLength(1);
  });

  it("outra marmitaria não vê nem altera a foto", async () => {
    expect(await asUser(U.other, () => q(`select recipe_id from public.recipe_photos`))).toHaveLength(0);
    await asUser(U.other, () => q(`update public.recipe_photos set data_url = $1 where recipe_id = $2`, [PHOTO + "x", U.prodA]));
    expect((await q(`select data_url from public.recipe_photos where recipe_id = $1`, [U.prodA]))[0].data_url).toBe(PHOTO);
    await expect(asUser(U.other, () => q(`insert into public.recipe_photos (recipe_id, org_id, data_url) values ($1,$2,$3)`, [U.prodA, U.orgA, PHOTO]))).rejects.toThrow();
  });

  it("só aceita JPEG e até 400 mil caracteres", async () => {
    await expect(q(`update public.recipe_photos set data_url = 'data:image/png;base64,AAAA' where recipe_id = $1`, [U.prodA])).rejects.toThrow();
    await expect(q(`update public.recipe_photos set data_url = $1 where recipe_id = $2`, ["data:image/jpeg;base64," + "A".repeat(400_000), U.prodA])).rejects.toThrow();
  });

  it("texto de preparo até 4 mil letras e ordem sem número negativo", async () => {
    await q(`update public.recipes set instructions = 'Montar o arroz primeiro.' where id = $1`, [U.prodA]);
    await expect(q(`update public.recipes set instructions = $1 where id = $2`, ["a".repeat(4001), U.prodA])).rejects.toThrow();
    await q(`insert into public.recipe_items (org_id, recipe_id, ingredient_id, net_qty, sort_order) values ($1,$2,$3,150,1)`, [U.orgA, U.prodA, U.ingA]);
    await expect(q(`update public.recipe_items set sort_order = -1 where recipe_id = $1`, [U.prodA])).rejects.toThrow();
  });

  it("apagar o produto apaga a foto junto", async () => {
    await q(`delete from public.recipe_items where recipe_id = $1`, [U.prodA]);
    await q(`delete from public.recipes where id = $1`, [U.prodA]);
    expect(await q(`select 1 from public.recipe_photos where recipe_id = $1`, [U.prodA])).toHaveLength(0);
  });
});
