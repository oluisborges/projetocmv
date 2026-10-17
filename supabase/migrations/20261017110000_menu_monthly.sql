-- Totais do cardápio por mês (horário de Brasília), para a média de faturamento e de marmitas que alimenta o preço.
--   menu_monthly        = pedidos, faturamento e marmitas das fichas vinculadas (qtd × marmitas por venda)
--   menu_monthly_combos = quantidade vendida de cada combo vinculado (as marmitas dele dependem do combo, calculadas no app)
-- security invoker: o RLS decide o que cada pessoa vê.

create function public.menu_monthly(p_unit uuid, p_from timestamptz)
returns table (month date, orders bigint, revenue numeric, recipe_units numeric)
language sql stable security invoker set search_path = ''
as $$
  with o as (
    select (date_trunc('month', ordered_at at time zone 'America/Sao_Paulo'))::date as month, count(*) as orders, sum(total) as revenue
    from public.menu_orders
    where unit_id = p_unit and ordered_at >= p_from
    group by 1
  ), u as (
    select (date_trunc('month', od.ordered_at at time zone 'America/Sao_Paulo'))::date as month, sum(l.qty * p.units_per_sale) as recipe_units
    from public.menu_order_lines l
    join public.menu_orders od on od.id = l.order_id and od.org_id = l.org_id
    join public.menu_products p on p.id = l.product_id and p.org_id = l.org_id
    where od.unit_id = p_unit and od.ordered_at >= p_from and p.recipe_id is not null and not p.ignored
    group by 1
  )
  select o.month, o.orders, o.revenue, coalesce(u.recipe_units, 0)
  from o left join u using (month)
  order by o.month desc;
$$;

create function public.menu_monthly_combos(p_unit uuid, p_from timestamptz)
returns table (month date, combo_id uuid, qty numeric)
language sql stable security invoker set search_path = ''
as $$
  select (date_trunc('month', od.ordered_at at time zone 'America/Sao_Paulo'))::date, p.combo_id, sum(l.qty)
  from public.menu_order_lines l
  join public.menu_orders od on od.id = l.order_id and od.org_id = l.org_id
  join public.menu_products p on p.id = l.product_id and p.org_id = l.org_id
  where od.unit_id = p_unit and od.ordered_at >= p_from and p.combo_id is not null
  group by 1, 2;
$$;

revoke all on function public.menu_monthly(uuid, timestamptz), public.menu_monthly_combos(uuid, timestamptz) from public, anon;
grant execute on function public.menu_monthly(uuid, timestamptz), public.menu_monthly_combos(uuid, timestamptz) to authenticated;
