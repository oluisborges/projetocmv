-- Fotografia mensal do que valia em cada mês (custos, preços, equipe, impostos), para o histórico.
-- Faturamento, compras e vendas por produto já ficam em periods/period_sales; aqui fica o resto,
-- que muda com o tempo e se perderia (preço de venda, custo da ficha, equipe, contas fixas).
create table public.month_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  unit_id uuid not null,
  month date not null check (month = date_trunc('month', month)::date),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, month),
  foreign key (unit_id, org_id) references public.units (id, org_id) on delete cascade
);
create index month_snapshots_org_id_idx on public.month_snapshots (org_id);
create trigger month_snapshots_touch before update on public.month_snapshots
  for each row execute function private.touch_updated_at();

alter table public.month_snapshots enable row level security;
create policy month_snapshots_select on public.month_snapshots for select to authenticated using (private.is_org_member(org_id));
create policy month_snapshots_insert on public.month_snapshots for insert to authenticated with check (private.can_write_org(org_id));
create policy month_snapshots_update on public.month_snapshots for update to authenticated using (private.can_write_org(org_id)) with check (private.can_write_org(org_id));
create policy month_snapshots_delete on public.month_snapshots for delete to authenticated using (private.can_write_org(org_id));
