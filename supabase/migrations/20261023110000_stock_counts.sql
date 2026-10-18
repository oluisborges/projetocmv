-- Compras por insumo (vindas das notas fiscais ou informadas) e contagem de estoque no fim do mês: base do CMV real.
create table public.ingredient_purchases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  unit_id uuid not null,
  ingredient_id uuid not null,
  month date not null check (month = date_trunc('month', month)::date),
  -- na unidade-base do insumo (g, ml ou un)
  qty_base numeric(16, 4) not null check (qty_base >= 0),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  source text not null check (source in ('nfe', 'manual')),
  nfe_import_id uuid references public.nfe_imports (id) on delete cascade,
  created_at timestamptz not null default now(),
  foreign key (unit_id, org_id) references public.units (id, org_id) on delete cascade,
  foreign key (ingredient_id, org_id) references public.ingredients (id, org_id) on delete cascade
);
create index ingredient_purchases_org_id_idx on public.ingredient_purchases (org_id);
create index ingredient_purchases_unit_month_idx on public.ingredient_purchases (unit_id, month);
create index ingredient_purchases_nfe_idx on public.ingredient_purchases (nfe_import_id) where nfe_import_id is not null;
-- uma linha "informada pelo dono" por insumo e mês (as de nota fiscal podem ser várias)
create unique index ingredient_purchases_manual_uq on public.ingredient_purchases (unit_id, ingredient_id, month) where source = 'manual';

create table public.ingredient_stock_counts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  unit_id uuid not null,
  ingredient_id uuid not null,
  -- mês em que a contagem foi feita: o estoque no FIM desse mês (e portanto o do começo do seguinte)
  month date not null check (month = date_trunc('month', month)::date),
  qty_base numeric(16, 4) not null check (qty_base >= 0),
  updated_at timestamptz not null default now(),
  unique (unit_id, ingredient_id, month),
  foreign key (unit_id, org_id) references public.units (id, org_id) on delete cascade,
  foreign key (ingredient_id, org_id) references public.ingredients (id, org_id) on delete cascade
);
create index ingredient_stock_counts_org_id_idx on public.ingredient_stock_counts (org_id);
create trigger ingredient_stock_counts_touch before update on public.ingredient_stock_counts for each row execute function private.touch_updated_at();

alter table public.periods add column finished_stock_value numeric(14, 2) check (finished_stock_value is null or finished_stock_value >= 0);

alter table public.ingredient_purchases enable row level security;
alter table public.ingredient_stock_counts enable row level security;
create policy ingredient_purchases_select on public.ingredient_purchases for select to authenticated using (private.is_org_member(org_id));
create policy ingredient_purchases_insert on public.ingredient_purchases for insert to authenticated with check (private.can_write_org(org_id));
create policy ingredient_purchases_update on public.ingredient_purchases for update to authenticated using (private.can_write_org(org_id)) with check (private.can_write_org(org_id));
create policy ingredient_purchases_delete on public.ingredient_purchases for delete to authenticated using (private.can_write_org(org_id));
create policy ingredient_stock_counts_select on public.ingredient_stock_counts for select to authenticated using (private.is_org_member(org_id));
create policy ingredient_stock_counts_insert on public.ingredient_stock_counts for insert to authenticated with check (private.can_write_org(org_id));
create policy ingredient_stock_counts_update on public.ingredient_stock_counts for update to authenticated using (private.can_write_org(org_id)) with check (private.can_write_org(org_id));
create policy ingredient_stock_counts_delete on public.ingredient_stock_counts for delete to authenticated using (private.can_write_org(org_id));
