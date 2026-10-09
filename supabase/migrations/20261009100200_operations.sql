-- Operação por unidade: parâmetros de preço, canais, preço praticado, custos fixos, equipe,
-- períodos (faturamento/compras) e vendas por prato. Mais a tabela de integrações (futuro).
-- FKs compostas (unit_id, org_id) impedem gravar uma unidade de outra organização.

create table public.unit_settings (
  unit_id uuid primary key,
  org_id uuid not null,
  tax_pct numeric(5, 4) not null default 0 check (tax_pct >= 0 and tax_pct < 1),
  profit_pct numeric(5, 4) not null default 0.15 check (profit_pct >= 0 and profit_pct < 1),
  min_margin_pct numeric(5, 4) not null default 0.10 check (min_margin_pct >= 0 and min_margin_pct < 1),
  default_charges_pct numeric(5, 4) not null default 0 check (default_charges_pct >= 0),
  updated_at timestamptz not null default now(),
  foreign key (unit_id, org_id) references public.units (id, org_id) on delete cascade
);
create index unit_settings_org_id_idx on public.unit_settings (org_id);
create trigger unit_settings_touch before update on public.unit_settings
  for each row execute function private.touch_updated_at();

create table public.sales_channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  unit_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  fee_pct numeric(5, 4) not null default 0 check (fee_pct >= 0 and fee_pct < 1),
  foreign key (unit_id, org_id) references public.units (id, org_id) on delete cascade
);
create index sales_channels_org_id_idx on public.sales_channels (org_id);
create index sales_channels_unit_idx on public.sales_channels (unit_id);

create table public.recipe_prices (
  recipe_id uuid not null,
  unit_id uuid not null,
  org_id uuid not null,
  current_price numeric(14, 2) not null check (current_price >= 0),
  updated_at timestamptz not null default now(),
  primary key (recipe_id, unit_id),
  foreign key (recipe_id, org_id) references public.recipes (id, org_id) on delete cascade,
  foreign key (unit_id, org_id) references public.units (id, org_id) on delete cascade
);
create index recipe_prices_org_id_idx on public.recipe_prices (org_id);
create index recipe_prices_unit_idx on public.recipe_prices (unit_id);
create trigger recipe_prices_touch before update on public.recipe_prices
  for each row execute function private.touch_updated_at();

create table public.fixed_costs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  unit_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  category text,
  monthly_amount numeric(14, 2) not null check (monthly_amount >= 0),
  foreign key (unit_id, org_id) references public.units (id, org_id) on delete cascade
);
create index fixed_costs_org_id_idx on public.fixed_costs (org_id);
create index fixed_costs_unit_idx on public.fixed_costs (unit_id);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  unit_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  area text not null check (area in ('cozinha', 'embalagem', 'entrega')),
  monthly_salary numeric(14, 2) not null check (monthly_salary >= 0),
  charges_pct numeric(5, 4) not null default 0 check (charges_pct >= 0),
  foreign key (unit_id, org_id) references public.units (id, org_id) on delete cascade
);
create index staff_org_id_idx on public.staff (org_id);
create index staff_unit_idx on public.staff (unit_id);

create table public.periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  unit_id uuid not null,
  month date not null check (month = date_trunc('month', month)::date),
  revenue numeric(14, 2) not null default 0 check (revenue >= 0),
  purchases numeric(14, 2) not null default 0 check (purchases >= 0),
  -- Estoque fica para depois do MVP; colunas já prontas (nulas = CMV aproximado).
  opening_stock numeric(14, 2) check (opening_stock >= 0),
  closing_stock numeric(14, 2) check (closing_stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, month),
  unique (id, org_id),
  foreign key (unit_id, org_id) references public.units (id, org_id) on delete cascade
);
create index periods_org_id_idx on public.periods (org_id);
create trigger periods_touch before update on public.periods
  for each row execute function private.touch_updated_at();

create table public.period_sales (
  period_id uuid not null,
  recipe_id uuid not null,
  org_id uuid not null,
  qty_sold numeric(14, 2) not null check (qty_sold >= 0),
  primary key (period_id, recipe_id),
  foreign key (period_id, org_id) references public.periods (id, org_id) on delete cascade,
  foreign key (recipe_id, org_id) references public.recipes (id, org_id) on delete cascade
);
create index period_sales_org_id_idx on public.period_sales (org_id);
create index period_sales_recipe_idx on public.period_sales (recipe_id);

-- Integrações futuras (Cardápio Web etc.). Segredos NUNCA aqui: só metadados.
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null,
  status text not null default 'disconnected' check (status in ('disconnected', 'connected', 'error')),
  external_account_id text,
  created_at timestamptz not null default now(),
  unique (org_id, provider)
);
create index integrations_org_id_idx on public.integrations (org_id);

-- ---------------------------------------------------------------------------
-- RLS padrão
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'unit_settings', 'sales_channels', 'recipe_prices', 'fixed_costs',
    'staff', 'periods', 'period_sales', 'integrations'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_org_member(org_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_write_org(org_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_write_org(org_id)) with check (private.can_write_org(org_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.can_write_org(org_id))', t || '_delete', t);
  end loop;
end $$;
