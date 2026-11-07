-- Produção: valor pago nas compras, lote e validade das marmitas prontas e estoque mínimo dos insumos.
-- Só acrescenta, compatível com o código que já está no ar: uma coluna nova e anulável e duas tabelas novas.
--  1) stock_movements.paid_amount: quanto a pessoa pagou numa compra lançada em Estoque ou marcada na lista de compras.
--  2) finished_lots: um lote por produto em cada produção feita (quantidade, dia e validade). O saldo do congelador continua
--     vindo do livro de estoque; os lotes só dizem DE QUANDO são as marmitas e quando vencem.
--  3) stock_minimums: o estoque mínimo que o dono quer manter de cada insumo (na unidade-base), por unidade.
-- RLS padrão: quem é da marmitaria lê; quem pode escrever altera.

alter table public.stock_movements add column paid_amount numeric(12, 2) check (paid_amount is null or paid_amount >= 0);

create table public.finished_lots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  unit_id uuid not null,
  recipe_id uuid not null,
  plan_id uuid references public.production_plans (id) on delete set null,
  code text check (code is null or char_length(code) <= 30),
  qty integer not null check (qty > 0 and qty <= 100000),
  produced_on date not null,
  expires_on date check (expires_on is null or expires_on >= produced_on),
  created_at timestamptz not null default now(),
  foreign key (unit_id, org_id) references public.units (id, org_id) on delete cascade,
  foreign key (recipe_id, org_id) references public.recipes (id, org_id) on delete cascade
);
create index finished_lots_org_id_idx on public.finished_lots (org_id);
create index finished_lots_recipe_idx on public.finished_lots (unit_id, recipe_id, produced_on desc);
create index finished_lots_plan_idx on public.finished_lots (plan_id) where plan_id is not null;

create table public.stock_minimums (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  unit_id uuid not null,
  ingredient_id uuid not null,
  min_qty numeric(16, 4) not null check (min_qty > 0),
  updated_at timestamptz not null default now(),
  unique (unit_id, ingredient_id),
  foreign key (unit_id, org_id) references public.units (id, org_id) on delete cascade,
  foreign key (ingredient_id, org_id) references public.ingredients (id, org_id) on delete cascade
);
create index stock_minimums_org_id_idx on public.stock_minimums (org_id);
create trigger stock_minimums_touch before update on public.stock_minimums for each row execute function private.touch_updated_at();

do $$
declare t text;
begin
  foreach t in array array['finished_lots', 'stock_minimums'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_org_member(org_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_write_org(org_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_write_org(org_id)) with check (private.can_write_org(org_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.can_write_org(org_id))', t || '_delete', t);
  end loop;
end $$;
