-- Produção e estoque do dia a dia.
--   production_plans / production_plan_items = o plano de produção da semana (sugerido pelo sistema, ajustado e confirmado pelo dono)
--   stock_movements = o livro do estoque: contagens, compras, uso na produção, perdas e ajustes, de insumos e de marmitas prontas
-- Tudo novo e aditivo: o código antigo não conhece estas tabelas e continua funcionando.

create table public.production_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  unit_id uuid not null,
  -- segunda-feira da semana que o plano cobre
  week_start date not null check (extract(isodow from week_start) = 1),
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'produced')),
  note text check (note is null or length(note) <= 500),
  confirmed_at timestamptz,
  produced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, week_start),
  unique (id, org_id),
  foreign key (unit_id, org_id) references public.units (id, org_id) on delete cascade
);
create index production_plans_org_id_idx on public.production_plans (org_id);
create trigger production_plans_touch before update on public.production_plans for each row execute function private.touch_updated_at();

create table public.production_plan_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  plan_id uuid not null,
  recipe_id uuid not null,
  -- o que o sistema sugeriu (null = o dono adicionou) e o que o dono decidiu produzir
  suggested_qty integer check (suggested_qty is null or suggested_qty >= 0),
  planned_qty integer not null check (planned_qty >= 0 and planned_qty <= 100000),
  -- quanto saiu de verdade (preenchido ao registrar a produção)
  produced_qty integer check (produced_qty is null or produced_qty >= 0),
  unique (plan_id, recipe_id),
  foreign key (plan_id, org_id) references public.production_plans (id, org_id) on delete cascade,
  foreign key (recipe_id, org_id) references public.recipes (id, org_id) on delete cascade
);
create index production_plan_items_org_id_idx on public.production_plan_items (org_id);
create index production_plan_items_recipe_idx on public.production_plan_items (recipe_id);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  unit_id uuid not null,
  -- um movimento é de um insumo OU de uma marmita pronta
  ingredient_id uuid,
  recipe_id uuid,
  occurred_at timestamptz not null default now(),
  -- count = contagem (quantidade REAL naquele momento); os demais são variações com sinal, na unidade-base (g, ml, un)
  kind text not null check (kind in ('count', 'purchase', 'production', 'waste', 'adjust', 'produced')),
  qty_base numeric(16, 4) not null,
  plan_id uuid references public.production_plans (id) on delete set null,
  note text check (note is null or length(note) <= 200),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (num_nonnulls(ingredient_id, recipe_id) = 1),
  check (kind <> 'count' or qty_base >= 0),
  -- insumo: compra entra, produção e perda saem; marmita pronta: produzida entra
  check (kind <> 'purchase' or (ingredient_id is not null and qty_base > 0)),
  check (kind not in ('production', 'waste') or qty_base < 0),
  check (kind <> 'produced' or (recipe_id is not null and qty_base > 0)),
  foreign key (unit_id, org_id) references public.units (id, org_id) on delete cascade,
  foreign key (ingredient_id, org_id) references public.ingredients (id, org_id) on delete cascade,
  foreign key (recipe_id, org_id) references public.recipes (id, org_id) on delete cascade
);
create index stock_movements_org_id_idx on public.stock_movements (org_id);
create index stock_movements_ingredient_idx on public.stock_movements (unit_id, ingredient_id, occurred_at desc) where ingredient_id is not null;
create index stock_movements_recipe_idx on public.stock_movements (unit_id, recipe_id, occurred_at desc) where recipe_id is not null;
create index stock_movements_plan_idx on public.stock_movements (plan_id) where plan_id is not null;

do $$
declare t text;
begin
  foreach t in array array['production_plans', 'production_plan_items', 'stock_movements'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_org_member(org_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_write_org(org_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_write_org(org_id)) with check (private.can_write_org(org_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.can_write_org(org_id))', t || '_delete', t);
  end loop;
end $$;
