-- Painel agregado da Shogun: números de todos os clientes de uma vez. Só o admin Shogun recebe linhas
-- (private.is_platform_admin() usa a sessão de quem pergunta); para qualquer outra pessoa tudo volta vazio.

-- Faturamento por cliente e mês: cardápio (pedidos importados) + o que o dono digitou (periods).
create function public.admin_network_months(p_from date)
returns table (org_id uuid, month date, menu_orders bigint, menu_revenue numeric, menu_discount numeric, manual_revenue numeric, manual_purchases numeric)
language sql stable security definer set search_path = ''
as $$
  with menu as (
    select o.org_id,
           (date_trunc('month', o.ordered_at at time zone 'America/Sao_Paulo'))::date as month,
           count(*) as orders, sum(o.total) as revenue, sum(o.discount) as discount
    from public.menu_orders o
    where private.is_platform_admin()
      and o.ordered_at >= (p_from::timestamp at time zone 'America/Sao_Paulo')
    group by 1, 2
  ), manual as (
    select p.org_id, p.month, sum(p.revenue) as revenue, sum(p.purchases) as purchases
    from public.periods p
    where private.is_platform_admin() and p.month >= p_from
    group by 1, 2
  )
  select coalesce(m.org_id, x.org_id), coalesce(m.month, x.month),
         coalesce(m.orders, 0), coalesce(m.revenue, 0), coalesce(m.discount, 0),
         coalesce(x.revenue, 0), coalesce(x.purchases, 0)
  from menu m full join manual x on x.org_id = m.org_id and x.month = m.month;
$$;

-- Vendas do cardápio por ficha (marmitas e valor pago, já sem a parte do cupom) em todos os clientes.
create function public.admin_network_recipe_sales(p_start timestamptz, p_end timestamptz)
returns table (org_id uuid, recipe_id uuid, units numeric, net numeric)
language sql stable security definer set search_path = ''
as $$
  select u.org_id, p.recipe_id, sum(n.qty * p.units_per_sale), sum(n.net)
  from public.units u
  cross join lateral private.menu_net_lines(u.id, p_start, p_end) n
  join public.menu_products p on p.id = n.product_id
  where private.is_platform_admin() and p.recipe_id is not null and not p.ignored
  group by u.org_id, p.recipe_id;
$$;

-- Quanto do que o cardápio vendeu já tem ficha vinculada (por valor pago).
create function public.admin_network_coverage(p_start timestamptz, p_end timestamptz)
returns table (org_id uuid, total_net numeric, linked_net numeric, ignored_net numeric, unlinked_products bigint)
language sql stable security definer set search_path = ''
as $$
  select u.org_id,
         sum(n.net),
         sum(n.net) filter (where not p.ignored and (p.recipe_id is not null or p.combo_id is not null)),
         sum(n.net) filter (where p.ignored),
         count(distinct n.product_id) filter (where not p.ignored and p.recipe_id is null and p.combo_id is null)
  from public.units u
  cross join lateral private.menu_net_lines(u.id, p_start, p_end) n
  join public.menu_products p on p.id = n.product_id
  where private.is_platform_admin()
  group by u.org_id;
$$;

-- Quanto cada cliente já montou no sistema (para ver quem ainda não começou).
create function public.admin_network_setup()
returns table (org_id uuid, ingredients bigint, recipes bigint, priced_recipes bigint, fixed_costs bigint, staff bigint, settings_done boolean)
language sql stable security definer set search_path = ''
as $$
  select o.id,
         (select count(*) from public.ingredients i where i.org_id = o.id and i.archived_at is null),
         (select count(*) from public.recipes r where r.org_id = o.id and r.active),
         (select count(*) from public.recipe_prices rp join public.recipes r on r.id = rp.recipe_id where rp.org_id = o.id and r.active and rp.current_price > 0),
         (select count(*) from public.fixed_costs f where f.org_id = o.id),
         (select count(*) from public.staff s where s.org_id = o.id),
         exists (select 1 from public.unit_settings us where us.org_id = o.id and us.configured_at is not null)
  from public.organizations o
  where private.is_platform_admin();
$$;

revoke all on function public.admin_network_months(date), public.admin_network_recipe_sales(timestamptz, timestamptz),
  public.admin_network_coverage(timestamptz, timestamptz), public.admin_network_setup() from public, anon;
grant execute on function public.admin_network_months(date), public.admin_network_recipe_sales(timestamptz, timestamptz),
  public.admin_network_coverage(timestamptz, timestamptz), public.admin_network_setup() to authenticated;
