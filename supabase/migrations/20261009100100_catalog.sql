-- Catálogo da organização (compartilhado entre unidades): fornecedores, insumos, histórico de preço,
-- fichas técnicas. Mais o catálogo-modelo global da Shogun e a função de importação.

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Catálogo-modelo (global, gerenciado por admin Shogun) — criado antes para as FKs de template_id
-- ---------------------------------------------------------------------------
create table public.template_ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  kind text not null default 'insumo' check (kind in ('insumo', 'embalagem')),
  purchase_unit text not null check (purchase_unit in ('kg', 'g', 'l', 'ml', 'un')),
  purchase_qty numeric(14, 4) not null check (purchase_qty > 0),
  reference_price numeric(14, 4) not null default 0 check (reference_price >= 0),
  correction_factor numeric(6, 3) not null default 1 check (correction_factor >= 1)
);

create table public.template_recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  portions numeric(10, 2) check (portions > 0),
  portion_weight numeric(10, 2) check (portion_weight > 0),
  cooking_loss_pct numeric(5, 4) not null default 0 check (cooking_loss_pct >= 0 and cooking_loss_pct < 1),
  check (portions is not null or portion_weight is not null)
);

create table public.template_recipe_items (
  template_recipe_id uuid not null references public.template_recipes (id) on delete cascade,
  template_ingredient_id uuid not null references public.template_ingredients (id) on delete cascade,
  net_qty numeric(14, 4) not null check (net_qty > 0),
  scope text not null default 'batch' check (scope in ('batch', 'portion')),
  primary key (template_recipe_id, template_ingredient_id, scope)
);
create index template_recipe_items_ingredient_idx on public.template_recipe_items (template_ingredient_id);

-- ---------------------------------------------------------------------------
-- Dados da organização
-- ---------------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  phone text,
  created_at timestamptz not null default now(),
  unique (id, org_id)
);
create index suppliers_org_id_idx on public.suppliers (org_id);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text,
  kind text not null default 'insumo' check (kind in ('insumo', 'embalagem')),
  purchase_unit text not null check (purchase_unit in ('kg', 'g', 'l', 'ml', 'un')),
  purchase_qty numeric(14, 4) not null check (purchase_qty > 0),
  purchase_price numeric(14, 4) not null default 0 check (purchase_price >= 0),
  correction_factor numeric(6, 3) not null default 1 check (correction_factor >= 1),
  -- R$ por unidade-base (g/ml/un) do que foi comprado (bruto). Espelha calc/unitCost.
  unit_cost numeric(18, 8) generated always as (
    purchase_price / (purchase_qty * case purchase_unit when 'kg' then 1000 when 'l' then 1000 else 1 end)
  ) stored,
  supplier_id uuid,
  template_id uuid references public.template_ingredients (id) on delete set null,
  external_source text,
  external_id text,
  archived_at timestamptz,
  price_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (supplier_id, org_id) references public.suppliers (id, org_id)
);
create index ingredients_org_id_idx on public.ingredients (org_id);
create index ingredients_supplier_idx on public.ingredients (supplier_id);
create index ingredients_template_idx on public.ingredients (template_id);
create unique index ingredients_org_template_uq on public.ingredients (org_id, template_id) where template_id is not null;
create unique index ingredients_external_uq on public.ingredients (org_id, external_source, external_id) where external_id is not null;
create trigger ingredients_touch before update on public.ingredients
  for each row execute function private.touch_updated_at();

create table public.ingredient_price_history (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  ingredient_id uuid not null,
  purchase_price numeric(14, 4) not null,
  purchase_qty numeric(14, 4) not null,
  unit_cost numeric(18, 8) not null,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now(),
  foreign key (ingredient_id, org_id) references public.ingredients (id, org_id) on delete cascade
);
create index ingredient_price_history_ingredient_idx on public.ingredient_price_history (ingredient_id, changed_at desc);
create index ingredient_price_history_org_idx on public.ingredient_price_history (org_id);

-- Grava histórico (e carimba price_updated_at) a cada mudança real de preço/quantidade.
create function private.ingredient_price_trigger() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.purchase_price is not distinct from old.purchase_price
       and new.purchase_qty is not distinct from old.purchase_qty
       and new.purchase_unit is not distinct from old.purchase_unit then
      return new;
    end if;
    new.price_updated_at = now();
  end if;
  return new;
end;
$$;

create function private.ingredient_price_history_trigger() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.purchase_price is not distinct from old.purchase_price
     and new.purchase_qty is not distinct from old.purchase_qty
     and new.purchase_unit is not distinct from old.purchase_unit then
    return new;
  end if;
  insert into public.ingredient_price_history
    (org_id, ingredient_id, purchase_price, purchase_qty, unit_cost, changed_by)
  values (new.org_id, new.id, new.purchase_price, new.purchase_qty, new.unit_cost, (select auth.uid()));
  return new;
end;
$$;

create trigger ingredients_price_stamp before update on public.ingredients
  for each row execute function private.ingredient_price_trigger();
create trigger ingredients_price_history after insert or update on public.ingredients
  for each row execute function private.ingredient_price_history_trigger();

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text,
  portions numeric(10, 2) check (portions > 0),
  portion_weight numeric(10, 2) check (portion_weight > 0),
  cooking_loss_pct numeric(5, 4) not null default 0 check (cooking_loss_pct >= 0 and cooking_loss_pct < 1),
  active boolean not null default true,
  template_id uuid references public.template_recipes (id) on delete set null,
  external_source text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  check (portions is not null or portion_weight is not null)
);
create index recipes_org_id_idx on public.recipes (org_id);
create index recipes_template_idx on public.recipes (template_id);
create unique index recipes_org_template_uq on public.recipes (org_id, template_id) where template_id is not null;
create unique index recipes_external_uq on public.recipes (org_id, external_source, external_id) where external_id is not null;
create trigger recipes_touch before update on public.recipes
  for each row execute function private.touch_updated_at();

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  recipe_id uuid not null,
  ingredient_id uuid not null,
  net_qty numeric(14, 4) not null check (net_qty > 0),
  -- Opcional: sobrescreve net_qty × FC quando o dono mede o bruto direto.
  gross_qty numeric(14, 4) check (gross_qty > 0),
  scope text not null default 'batch' check (scope in ('batch', 'portion')),
  counts_for_yield boolean not null default true,
  foreign key (recipe_id, org_id) references public.recipes (id, org_id) on delete cascade,
  foreign key (ingredient_id, org_id) references public.ingredients (id, org_id) on delete restrict
);
create index recipe_items_org_id_idx on public.recipe_items (org_id);
create index recipe_items_recipe_idx on public.recipe_items (recipe_id);
create index recipe_items_ingredient_idx on public.recipe_items (ingredient_id);

-- ---------------------------------------------------------------------------
-- RLS padrão para tabelas com org_id
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['suppliers', 'ingredients', 'recipes', 'recipe_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_org_member(org_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_write_org(org_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_write_org(org_id)) with check (private.can_write_org(org_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.can_write_org(org_id))', t || '_delete', t);
  end loop;
end $$;

-- Histórico: leitura para membros; escrita só pelo trigger (security definer).
alter table public.ingredient_price_history enable row level security;
create policy ingredient_price_history_select on public.ingredient_price_history for select to authenticated
  using (private.is_org_member(org_id));

-- Catálogo-modelo: todo usuário logado lê; só admin Shogun escreve.
do $$
declare t text;
begin
  foreach t in array array['template_ingredients', 'template_recipes', 'template_recipe_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.is_platform_admin())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.is_platform_admin())', t || '_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Importação do catálogo-modelo para uma organização (idempotente).
-- Receitas trazem junto os insumos que usam.
-- ---------------------------------------------------------------------------
create function public.import_template(
  p_org uuid,
  p_ingredient_ids uuid[] default '{}',
  p_recipe_ids uuid[] default '{}'
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ing_ids uuid[];
begin
  if not private.can_write_org(p_org) then
    raise exception 'sem permissão nesta organização' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct x), '{}') into v_ing_ids
  from (
    select unnest(coalesce(p_ingredient_ids, '{}')) as x
    union
    select tri.template_ingredient_id
    from public.template_recipe_items tri
    where tri.template_recipe_id = any (coalesce(p_recipe_ids, '{}'))
  ) s;

  insert into public.ingredients
    (org_id, name, category, kind, purchase_unit, purchase_qty, purchase_price, correction_factor, template_id)
  select p_org, ti.name, ti.category, ti.kind, ti.purchase_unit, ti.purchase_qty, ti.reference_price,
         ti.correction_factor, ti.id
  from public.template_ingredients ti
  where ti.id = any (v_ing_ids)
  on conflict (org_id, template_id) where template_id is not null do nothing;

  with new_recipes as (
    insert into public.recipes
      (org_id, name, category, portions, portion_weight, cooking_loss_pct, template_id)
    select p_org, tr.name, tr.category, tr.portions, tr.portion_weight, tr.cooking_loss_pct, tr.id
    from public.template_recipes tr
    where tr.id = any (coalesce(p_recipe_ids, '{}'))
    on conflict (org_id, template_id) where template_id is not null do nothing
    returning id, template_id
  )
  insert into public.recipe_items (org_id, recipe_id, ingredient_id, net_qty, scope, counts_for_yield)
  select p_org, nr.id, i.id, tri.net_qty, tri.scope, (tri.scope = 'batch')
  from new_recipes nr
  join public.template_recipe_items tri on tri.template_recipe_id = nr.template_id
  join public.ingredients i on i.org_id = p_org and i.template_id = tri.template_ingredient_id;
end;
$$;

revoke all on function public.import_template(uuid, uuid[], uuid[]) from public;
grant execute on function public.import_template(uuid, uuid[], uuid[]) to authenticated;
