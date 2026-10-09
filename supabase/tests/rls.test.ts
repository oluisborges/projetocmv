/**
 * Testes de isolamento multi-tenant (RLS) rodando num Postgres embutido (PGlite),
 * aplicando as migrations reais de supabase/migrations. Nenhuma conta externa necessária.
 * O Supabase é simulado só no mínimo: schema auth, auth.uid()/auth.jwt() e os papéis anon/authenticated.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS = path.resolve(import.meta.dirname, "../migrations");

const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb
  );
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

let db: PGlite;

const ids = {
  admin: "00000000-0000-4000-8000-0000000000a0",
  ownerA: "00000000-0000-4000-8000-0000000000a1",
  viewerA: "00000000-0000-4000-8000-0000000000a2",
  ownerB: "00000000-0000-4000-8000-0000000000b1",
  newbie: "00000000-0000-4000-8000-0000000000c1",
  orgA: "10000000-0000-4000-8000-0000000000a1",
  orgB: "10000000-0000-4000-8000-0000000000b1",
  unitA: "20000000-0000-4000-8000-0000000000a1",
  unitB: "20000000-0000-4000-8000-0000000000b1",
  ingA: "30000000-0000-4000-8000-0000000000a1",
  ingB: "30000000-0000-4000-8000-0000000000b1",
};

/** Executa `fn` como o usuário (papel authenticated + claims) e volta ao superusuário. */
async function as<T>(user: string | null, email: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    user ? JSON.stringify({ sub: user, email }) : "{}",
  ]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

const q = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as Record<string, unknown>[];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(MIGRATIONS, f), "utf8"));
  }

  const users: [string, string][] = [
    [ids.admin, "admin@shogun.com"],
    [ids.ownerA, "dono-a@marmita.com"],
    [ids.viewerA, "viewer-a@marmita.com"],
    [ids.ownerB, "dono-b@marmita.com"],
    [ids.newbie, "novo@marmita.com"],
  ];
  for (const [id, email] of users) {
    await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
  }
  await db.query(`update public.profiles set is_platform_admin = true where id = $1`, [ids.admin]);

  await db.query(`insert into public.organizations (id, name, slug) values ($1,'Marmita A','marmita-a'), ($2,'Marmita B','marmita-b')`, [ids.orgA, ids.orgB]);
  await db.query(
    `insert into public.memberships (org_id, user_id, role) values ($1,$2,'owner'), ($1,$3,'viewer'), ($4,$5,'owner')`,
    [ids.orgA, ids.ownerA, ids.viewerA, ids.orgB, ids.ownerB],
  );
  await db.query(`insert into public.units (id, org_id, name) values ($1,$2,'Matriz A'), ($3,$4,'Matriz B')`, [ids.unitA, ids.orgA, ids.unitB, ids.orgB]);
  await db.query(
    `insert into public.ingredients (id, org_id, name, purchase_unit, purchase_qty, purchase_price, correction_factor)
     values ($1,$2,'Frango A','kg',1,14,1.15), ($3,$4,'Frango B','kg',1,20,1)`,
    [ids.ingA, ids.orgA, ids.ingB, ids.orgB],
  );
});

afterAll(async () => {
  await db.close();
});

describe("isolamento entre organizações", () => {
  it("dono só enxerga os dados da própria organização", async () => {
    const rows = await as(ids.ownerA, "dono-a@marmita.com", () => q(`select name from public.ingredients order by name`));
    expect(rows.map((r) => r.name)).toEqual(["Frango A"]);

    const orgs = await as(ids.ownerA, "dono-a@marmita.com", () => q(`select slug from public.organizations`));
    expect(orgs.map((r) => r.slug)).toEqual(["marmita-a"]);
  });

  it("não consegue inserir na organização de outro", async () => {
    await expect(
      as(ids.ownerA, "dono-a@marmita.com", () =>
        q(`insert into public.ingredients (org_id, name, purchase_unit, purchase_qty) values ($1,'Invasor','kg',1)`, [ids.orgB]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("update/delete em dados de outra organização não afeta nada", async () => {
    await as(ids.ownerA, "dono-a@marmita.com", async () => {
      await q(`update public.ingredients set purchase_price = 1 where id = $1`, [ids.ingB]);
      await q(`delete from public.ingredients where id = $1`, [ids.ingB]);
    });
    const [row] = await q(`select purchase_price from public.ingredients where id = $1`, [ids.ingB]);
    expect(Number(row.purchase_price)).toBe(20);
  });

  it("FK composta impede ligar ficha a insumo de outra organização", async () => {
    const [rec] = await q(
      `insert into public.recipes (org_id, name, portions) values ($1,'Prato A',10) returning id`,
      [ids.orgA],
    );
    await expect(
      q(`insert into public.recipe_items (org_id, recipe_id, ingredient_id, net_qty) values ($1,$2,$3,100)`, [ids.orgA, rec.id, ids.ingB]),
    ).rejects.toThrow(/foreign key/i);
  });

  it("FK composta impede unidade de outra organização", async () => {
    await expect(
      q(`insert into public.fixed_costs (org_id, unit_id, name, monthly_amount) values ($1,$2,'Aluguel',1000)`, [ids.orgA, ids.unitB]),
    ).rejects.toThrow(/foreign key/i);
  });

  it("admin Shogun enxerga todas as organizações", async () => {
    const rows = await as(ids.admin, "admin@shogun.com", () => q(`select slug from public.organizations order by slug`));
    expect(rows.map((r) => r.slug)).toEqual(["marmita-a", "marmita-b"]);
  });

  it("anônimo não acessa nada", async () => {
    await expect(as(null, null, () => q(`select * from public.ingredients`))).rejects.toThrow(/permission denied/i);
  });
});

describe("papéis dentro da organização", () => {
  it("viewer lê mas não escreve", async () => {
    const rows = await as(ids.viewerA, "viewer-a@marmita.com", () => q(`select name from public.ingredients`));
    expect(rows).toHaveLength(1);
    await expect(
      as(ids.viewerA, "viewer-a@marmita.com", () =>
        q(`insert into public.ingredients (org_id, name, purchase_unit, purchase_qty) values ($1,'X','kg',1)`, [ids.orgA]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("só admin Shogun cria organização", async () => {
    await expect(
      as(ids.ownerA, "dono-a@marmita.com", () => q(`insert into public.organizations (name, slug) values ('Nova','nova-org')`)),
    ).rejects.toThrow(/row-level security/i);
  });

  it("usuário não promove a si mesmo a admin", async () => {
    await expect(
      as(ids.ownerA, "dono-a@marmita.com", () => q(`update public.profiles set is_platform_admin = true where id = $1`, [ids.ownerA])),
    ).rejects.toThrow(/permission denied/i);
    await as(ids.ownerA, "dono-a@marmita.com", () => q(`update public.profiles set full_name = 'Dono A' where id = $1`, [ids.ownerA]));
  });
});

describe("insumos", () => {
  it("custo unitário gerado: R$ 14,00 o kg = 0,014 por grama", async () => {
    const [row] = await q(`select unit_cost from public.ingredients where id = $1`, [ids.ingA]);
    expect(Number(row.unit_cost)).toBeCloseTo(0.014, 8);
  });

  it("mudança de preço grava histórico e carimba a data; mudar só o nome não", async () => {
    const [before] = await q(`select count(*)::int as n from public.ingredient_price_history where ingredient_id = $1`, [ids.ingA]);
    expect(before.n).toBe(1); // criação
    await as(ids.ownerA, "dono-a@marmita.com", () =>
      q(`update public.ingredients set purchase_price = 15.5 where id = $1`, [ids.ingA]),
    );
    await as(ids.ownerA, "dono-a@marmita.com", () =>
      q(`update public.ingredients set name = 'Frango peito A' where id = $1`, [ids.ingA]),
    );
    const hist = await q(`select purchase_price, changed_by from public.ingredient_price_history where ingredient_id = $1 order by id`, [ids.ingA]);
    expect(hist).toHaveLength(2);
    expect(Number(hist[1].purchase_price)).toBe(15.5);
    expect(hist[1].changed_by).toBe(ids.ownerA);
  });

  it("usuário não consegue forjar histórico direto", async () => {
    await expect(
      as(ids.ownerA, "dono-a@marmita.com", () =>
        q(`insert into public.ingredient_price_history (org_id, ingredient_id, purchase_price, purchase_qty, unit_cost) values ($1,$2,1,1,1)`, [ids.orgA, ids.ingA]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});

describe("catálogo-modelo", () => {
  let tplRecipe: string;

  beforeAll(async () => {
    const [i1] = await q(
      `insert into public.template_ingredients (name, purchase_unit, purchase_qty, reference_price, correction_factor)
       values ('Frango (peito)','kg',1,16,1.15) returning id`,
    );
    const [i2] = await q(
      `insert into public.template_ingredients (name, kind, purchase_unit, purchase_qty, reference_price)
       values ('Bandeja 750ml','embalagem','un',100,90) returning id`,
    );
    const [r] = await q(
      `insert into public.template_recipes (name, portions, cooking_loss_pct) values ('Frango grelhado', 25, 0.25) returning id`,
    );
    tplRecipe = r.id as string;
    await q(
      `insert into public.template_recipe_items (template_recipe_id, template_ingredient_id, net_qty, scope)
       values ($1,$2,10000,'batch'), ($1,$3,1,'portion')`,
      [tplRecipe, i1.id, i2.id],
    );
  });

  it("importa receita com seus insumos e é idempotente", async () => {
    const run = () =>
      as(ids.ownerA, "dono-a@marmita.com", () => q(`select public.import_template($1, '{}', array[$2]::uuid[])`, [ids.orgA, tplRecipe]));
    await run();
    await run();
    const recs = await q(`select id from public.recipes where org_id = $1 and template_id = $2`, [ids.orgA, tplRecipe]);
    expect(recs).toHaveLength(1);
    const items = await q(`select scope from public.recipe_items where recipe_id = $1 order by scope`, [recs[0].id]);
    expect(items.map((i) => i.scope)).toEqual(["batch", "portion"]);
    const ings = await q(`select count(*)::int as n from public.ingredients where org_id = $1 and template_id is not null`, [ids.orgA]);
    expect(ings[0].n).toBe(2);
  });

  it("não importa para organização alheia", async () => {
    await expect(
      as(ids.ownerB, "dono-b@marmita.com", () => q(`select public.import_template($1, '{}', array[$2]::uuid[])`, [ids.orgA, tplRecipe])),
    ).rejects.toThrow(/sem permissão/);
  });

  it("cliente não edita o catálogo-modelo", async () => {
    await expect(
      as(ids.ownerA, "dono-a@marmita.com", () => q(`insert into public.template_ingredients (name, purchase_unit, purchase_qty) values ('X','kg',1)`)),
    ).rejects.toThrow(/row-level security/i);
  });
});

describe("reajuste em lote de preços", () => {
  const adjust = (user: string, email: string, org: string, pct: number, category: string | null = null) =>
    as(user, email, () => q(`select public.bulk_adjust_ingredient_prices($1, $2, $3) as n`, [org, pct, category]));

  it("dono reajusta só os insumos da própria organização", async () => {
    const [before] = await q(`select purchase_price from public.ingredients where id = $1`, [ids.ingA]);
    const [res] = await adjust(ids.ownerA, "dono-a@marmita.com", ids.orgA, 0.1);
    expect(Number(res.n)).toBeGreaterThanOrEqual(1);
    const [after] = await q(`select purchase_price from public.ingredients where id = $1`, [ids.ingA]);
    expect(Number(after.purchase_price)).toBeCloseTo(Number(before.purchase_price) * 1.1, 4);
  });

  it("não afeta outra organização, nem com o id dela", async () => {
    const [res] = await adjust(ids.ownerA, "dono-a@marmita.com", ids.orgB, 0.5);
    expect(Number(res.n)).toBe(0);
    const [row] = await q(`select purchase_price from public.ingredients where id = $1`, [ids.ingB]);
    expect(Number(row.purchase_price)).toBe(20);
  });

  it("viewer não consegue reajustar", async () => {
    const [res] = await adjust(ids.viewerA, "viewer-a@marmita.com", ids.orgA, 0.5);
    expect(Number(res.n)).toBe(0);
  });

  it("filtra por categoria e grava histórico", async () => {
    await q(`update public.ingredients set category = 'Proteínas' where id = $1`, [ids.ingA]);
    const [{ n: histBefore }] = await q(`select count(*)::int as n from public.ingredient_price_history where ingredient_id = $1`, [ids.ingA]);
    const [none] = await adjust(ids.ownerA, "dono-a@marmita.com", ids.orgA, 0.1, "Embalagens");
    expect(Number(none.n)).toBe(0);
    const [some] = await adjust(ids.ownerA, "dono-a@marmita.com", ids.orgA, 0.1, "Proteínas");
    expect(Number(some.n)).toBe(1);
    const [{ n: histAfter }] = await q(`select count(*)::int as n from public.ingredient_price_history where ingredient_id = $1`, [ids.ingA]);
    expect(Number(histAfter)).toBe(Number(histBefore) + 1);
  });

  it("recusa percentual absurdo", async () => {
    await expect(adjust(ids.ownerA, "dono-a@marmita.com", ids.orgA, -1)).rejects.toThrow(/inválido/);
    await expect(adjust(ids.ownerA, "dono-a@marmita.com", ids.orgA, 9)).rejects.toThrow(/inválido/);
  });
});

describe("catálogo-modelo inicial", () => {
  it("vem populado, sem preço, e sem duplicar nomes", async () => {
    const [row] = await q(
      `select count(*)::int as n, count(distinct lower(name))::int as nomes, max(reference_price) as preco,
              count(*) filter (where kind = 'embalagem')::int as embalagens
       from public.template_ingredients where name in ('Peito de frango','Arroz branco','Bandeja 750 ml','Etiqueta')`,
    );
    expect(row.n).toBe(4);
    expect(row.nomes).toBe(4);
    expect(Number(row.preco)).toBe(0);
    expect(row.embalagens).toBe(2);
  });
});

describe("unidades escolhidas pelo dono", () => {
  it("guarda a unidade de exibição e recusa unidades inventadas", async () => {
    const [rec] = await q(
      `insert into public.recipes (org_id, name, portions, portion_weight, portion_weight_unit) values ($1,'Prato kg',10,300,'kg') returning id`,
      [ids.orgA],
    );
    await q(`insert into public.recipe_items (org_id, recipe_id, ingredient_id, net_qty, qty_unit) values ($1,$2,$3,2000,'kg')`, [ids.orgA, rec.id, ids.ingA]);
    const [item] = await q(`select net_qty, qty_unit from public.recipe_items where recipe_id = $1`, [rec.id]);
    expect(Number(item.net_qty)).toBe(2000);
    expect(item.qty_unit).toBe("kg");

    await expect(
      q(`insert into public.recipe_items (org_id, recipe_id, ingredient_id, net_qty, qty_unit) values ($1,$2,$3,1,'colher')`, [ids.orgA, rec.id, ids.ingA]),
    ).rejects.toThrow(/check constraint/i);
    await expect(q(`update public.recipes set portion_weight_unit = 'lb' where id = $1`, [rec.id])).rejects.toThrow(/check constraint/i);
  });
});
