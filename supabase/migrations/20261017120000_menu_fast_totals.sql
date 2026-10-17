-- Totais do cardápio sem RLS linha a linha. Com milhares de pedidos por mês e dezenas de clientes, avaliar a policy em cada linha
-- seria o gargalo das telas. As funções passam a rodar como definer, mas só devolvem algo se quem chama é membro da marmitaria
-- dona da unidade (private.is_org_member, avaliado UMA vez por chamada). Quem não é membro recebe zero linhas.

create or replace function public.menu_month_orders(p_unit uuid, p_start timestamptz, p_end timestamptz)
returns table (orders bigint, revenue numeric)
language sql stable security definer set search_path = ''
as $$
  select count(o.id), coalesce(sum(o.total), 0)
  from public.units u
  left join public.menu_orders o on o.unit_id = u.id and o.ordered_at >= p_start and o.ordered_at < p_end
  where u.id = p_unit and private.is_org_member(u.org_id);
$$;

create or replace function public.menu_month_lines(p_unit uuid, p_start timestamptz, p_end timestamptz)
returns table (product_id uuid, qty numeric, revenue numeric)
language sql stable security definer set search_path = ''
as $$
  select l.product_id, sum(l.qty), sum(l.line_total)
  from public.units u
  join public.menu_orders o on o.unit_id = u.id and o.ordered_at >= p_start and o.ordered_at < p_end
  join public.menu_order_lines l on l.order_id = o.id and l.org_id = o.org_id
  where u.id = p_unit and private.is_org_member(u.org_id)
  group by l.product_id;
$$;

create or replace function public.menu_monthly(p_unit uuid, p_from timestamptz)
returns table (month date, orders bigint, revenue numeric, recipe_units numeric)
language sql stable security definer set search_path = ''
as $$
  with scope as (
    select u.id from public.units u where u.id = p_unit and private.is_org_member(u.org_id)
  ), o as (
    select (date_trunc('month', od.ordered_at at time zone 'America/Sao_Paulo'))::date as month, count(*) as orders, sum(od.total) as revenue
    from scope join public.menu_orders od on od.unit_id = scope.id and od.ordered_at >= p_from
    group by 1
  ), u as (
    select (date_trunc('month', od.ordered_at at time zone 'America/Sao_Paulo'))::date as month, sum(l.qty * p.units_per_sale) as recipe_units
    from scope
    join public.menu_orders od on od.unit_id = scope.id and od.ordered_at >= p_from
    join public.menu_order_lines l on l.order_id = od.id and l.org_id = od.org_id
    join public.menu_products p on p.id = l.product_id and p.org_id = l.org_id
    where p.recipe_id is not null and not p.ignored
    group by 1
  )
  select o.month, o.orders, o.revenue, coalesce(u.recipe_units, 0)
  from o left join u using (month)
  order by o.month desc;
$$;

create or replace function public.menu_monthly_combos(p_unit uuid, p_from timestamptz)
returns table (month date, combo_id uuid, qty numeric)
language sql stable security definer set search_path = ''
as $$
  select (date_trunc('month', od.ordered_at at time zone 'America/Sao_Paulo'))::date, p.combo_id, sum(l.qty)
  from public.units u
  join public.menu_orders od on od.unit_id = u.id and od.ordered_at >= p_from
  join public.menu_order_lines l on l.order_id = od.id and l.org_id = od.org_id
  join public.menu_products p on p.id = l.product_id and p.org_id = l.org_id
  where u.id = p_unit and private.is_org_member(u.org_id) and p.combo_id is not null
  group by 1, 2;
$$;

revoke all on function public.menu_month_orders(uuid, timestamptz, timestamptz), public.menu_month_lines(uuid, timestamptz, timestamptz),
  public.menu_monthly(uuid, timestamptz), public.menu_monthly_combos(uuid, timestamptz) from public, anon;
grant execute on function public.menu_month_orders(uuid, timestamptz, timestamptz), public.menu_month_lines(uuid, timestamptz, timestamptz),
  public.menu_monthly(uuid, timestamptz), public.menu_monthly_combos(uuid, timestamptz) to authenticated;

-- a fila de pedidos pendentes é consultada a cada ciclo de cada conexão
create index if not exists menu_connections_status_idx on public.menu_connections (status, phase);
