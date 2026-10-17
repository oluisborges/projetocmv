-- Integração com o cardápio digital (CardápioWeb e Prefiro Delivery). Veja docs/superpowers/specs/2026-10-17-menu-integration-design.md.
--   menu_connections  = uma conexão por unidade e provedor (só metadados; quem conecta é o admin Shogun, pelo servidor)
--   menu_credentials  = chave de API e token do webhook. RLS ligada SEM policy: só o service role lê, nunca o navegador
--   menu_orders       = pedidos que viraram venda (total, desconto, entrega, canal, data)
--   menu_products     = itens e opções vendidos, com o vínculo à ficha/combo (vários produtos podem apontar para a mesma ficha)
--   menu_order_lines  = linhas de cada pedido
--   menu_order_queue  = pedidos avisados pelo webhook, à espera do detalhe

create table public.menu_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  unit_id uuid not null,
  provider text not null check (provider in ('cardapioweb', 'prefiro')),
  status text not null default 'connected' check (status in ('connected', 'error')),
  merchant_name text,
  -- carga inicial retomável: 'history' lista o passado em janelas, 'done' só confere o que mudou
  phase text not null default 'history' check (phase in ('history', 'done')),
  history_cursor timestamptz,
  lookback_from timestamptz not null default (now() - interval '6 months'),
  last_incremental_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  locked_until timestamptz,
  orders_imported integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, provider),
  unique (id, org_id),
  foreign key (unit_id, org_id) references public.units (id, org_id) on delete cascade
);
create index menu_connections_org_id_idx on public.menu_connections (org_id);
create trigger menu_connections_touch before update on public.menu_connections
  for each row execute function private.touch_updated_at();

create table public.menu_credentials (
  connection_id uuid primary key references public.menu_connections (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  api_key text not null,
  config jsonb not null default '{}'::jsonb,
  webhook_token text not null
);
create index menu_credentials_org_id_idx on public.menu_credentials (org_id);
alter table public.menu_credentials enable row level security;
-- nenhuma policy: anon e authenticated não leem nem escrevem; só o service role (servidor)
revoke all on public.menu_credentials from anon, authenticated;

create table public.menu_products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null check (provider in ('cardapioweb', 'prefiro')),
  -- id do item no cardápio; se o provedor não der id, o nome normalizado
  external_key text not null check (length(external_key) between 1 and 200),
  name text not null check (length(btrim(name)) between 1 and 200),
  kind text not null default 'item' check (kind in ('item', 'option')),
  -- vínculo (feito pelo dono; o admin Shogun também pode alterar)
  recipe_id uuid,
  combo_id uuid,
  -- quantas marmitas uma venda deste produto leva (ex.: "Kit 10" vinculado à ficha = 10)
  units_per_sale integer not null default 1 check (units_per_sale between 1 and 1000),
  ignored boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (org_id, provider, external_key),
  unique (id, org_id),
  foreign key (recipe_id, org_id) references public.recipes (id, org_id) on delete set null (recipe_id),
  foreign key (combo_id, org_id) references public.combos (id, org_id) on delete set null (combo_id),
  check (num_nonnulls(recipe_id, combo_id) <= 1),
  check (not ignored or (recipe_id is null and combo_id is null))
);
create index menu_products_org_id_idx on public.menu_products (org_id);
create index menu_products_recipe_idx on public.menu_products (recipe_id) where recipe_id is not null;
create index menu_products_combo_idx on public.menu_products (combo_id) where combo_id is not null;

create table public.menu_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  unit_id uuid not null,
  connection_id uuid not null,
  external_id text not null check (length(external_id) between 1 and 100),
  ordered_at timestamptz not null,
  total numeric(14, 2) not null check (total >= 0),
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  delivery_fee numeric(14, 2) not null default 0 check (delivery_fee >= 0),
  channel text,
  unique (connection_id, external_id),
  unique (id, org_id),
  foreign key (connection_id, org_id) references public.menu_connections (id, org_id) on delete cascade,
  foreign key (unit_id, org_id) references public.units (id, org_id) on delete cascade
);
create index menu_orders_org_id_idx on public.menu_orders (org_id);
create index menu_orders_unit_date_idx on public.menu_orders (unit_id, ordered_at);

create table public.menu_order_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  order_id uuid not null,
  product_id uuid not null,
  qty numeric(10, 2) not null check (qty > 0),
  -- valor da linha (quantidade × preço, como o cardápio informou)
  line_total numeric(14, 2) not null check (line_total >= 0),
  foreign key (order_id, org_id) references public.menu_orders (id, org_id) on delete cascade,
  foreign key (product_id, org_id) references public.menu_products (id, org_id) on delete cascade
);
create index menu_order_lines_org_id_idx on public.menu_order_lines (org_id);
create index menu_order_lines_order_idx on public.menu_order_lines (order_id);
create index menu_order_lines_product_idx on public.menu_order_lines (product_id);

create table public.menu_order_queue (
  connection_id uuid not null references public.menu_connections (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  order_id text not null,
  state text not null default 'pending' check (state in ('pending', 'done', 'skipped', 'failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  primary key (connection_id, order_id)
);
create index menu_order_queue_org_id_idx on public.menu_order_queue (org_id);
create index menu_order_queue_pending_idx on public.menu_order_queue (connection_id) where state = 'pending';

-- ---------------------------------------------------------------------------
-- RLS. Conexões, pedidos e linhas: membros leem; só o servidor (service role) escreve.
-- Produtos: membros leem; quem pode escrever na marmitaria muda SÓ o vínculo (grant por coluna abaixo).
-- ---------------------------------------------------------------------------
alter table public.menu_connections enable row level security;
alter table public.menu_orders enable row level security;
alter table public.menu_order_lines enable row level security;
alter table public.menu_products enable row level security;
alter table public.menu_order_queue enable row level security;

create policy menu_connections_select on public.menu_connections for select to authenticated using (private.is_org_member(org_id));
create policy menu_orders_select on public.menu_orders for select to authenticated using (private.is_org_member(org_id));
create policy menu_order_lines_select on public.menu_order_lines for select to authenticated using (private.is_org_member(org_id));
create policy menu_products_select on public.menu_products for select to authenticated using (private.is_org_member(org_id));
create policy menu_products_update on public.menu_products for update to authenticated
  using (private.can_write_org(org_id)) with check (private.can_write_org(org_id));
-- a fila é interna: sem policy para o navegador

revoke all on public.menu_connections, public.menu_orders, public.menu_order_lines, public.menu_products, public.menu_order_queue from anon, authenticated;
grant select on public.menu_connections, public.menu_orders, public.menu_order_lines, public.menu_products to authenticated;
grant update (recipe_id, combo_id, units_per_sale, ignored) on public.menu_products to authenticated;

-- ---------------------------------------------------------------------------
-- Totais do mês de uma unidade (security invoker: o RLS decide o que cada pessoa vê).
-- p_start/p_end = limites do mês no horário de Brasília (o app calcula, veja monthBounds).
-- ---------------------------------------------------------------------------
create function public.menu_month_orders(p_unit uuid, p_start timestamptz, p_end timestamptz)
returns table (orders bigint, revenue numeric)
language sql stable security invoker set search_path = ''
as $$
  select count(*), coalesce(sum(o.total), 0)
  from public.menu_orders o
  where o.unit_id = p_unit and o.ordered_at >= p_start and o.ordered_at < p_end;
$$;

create function public.menu_month_lines(p_unit uuid, p_start timestamptz, p_end timestamptz)
returns table (product_id uuid, qty numeric, revenue numeric)
language sql stable security invoker set search_path = ''
as $$
  select l.product_id, sum(l.qty), sum(l.line_total)
  from public.menu_order_lines l
  join public.menu_orders o on o.id = l.order_id and o.org_id = l.org_id
  where o.unit_id = p_unit and o.ordered_at >= p_start and o.ordered_at < p_end
  group by l.product_id;
$$;

revoke all on function public.menu_month_orders(uuid, timestamptz, timestamptz), public.menu_month_lines(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.menu_month_orders(uuid, timestamptz, timestamptz), public.menu_month_lines(uuid, timestamptz, timestamptz) to authenticated;
