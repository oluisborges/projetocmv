-- Valor realmente pago por linha, já descontado o cupom. O desconto vale para o PEDIDO TODO, então cada linha leva a mesma fração:
--   fator = 1 - desconto / soma das linhas do pedido        (nunca menos que 0)
--   valor pago da linha = valor da linha × fator
-- Não dependemos de o total do pedido "fechar" com as linhas: o CardápioWeb soma taxas fora das linhas, a Prefiro soma a entrega.
-- Todas as funções checam a marmitaria uma vez por chamada (sem RLS linha a linha) e devolvem vazio a quem não é membro.

create or replace function private.menu_net_lines(p_unit uuid, p_start timestamptz, p_end timestamptz)
returns table (order_id uuid, product_id uuid, qty numeric, gross numeric, net numeric, ordered_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  with scope as (
    select u.id from public.units u where u.id = p_unit and private.is_org_member(u.org_id)
  ), ord as (
    select o.id, o.ordered_at,
      case when s.lines_sum > 0 then greatest(0::numeric, 1 - o.discount / s.lines_sum) else 1::numeric end as factor
    from scope
    join public.menu_orders o on o.unit_id = scope.id and o.ordered_at >= p_start and o.ordered_at < p_end
    left join lateral (select sum(l.line_total) as lines_sum from public.menu_order_lines l where l.order_id = o.id) s on true
  )
  select l.order_id, l.product_id, l.qty, l.line_total, l.line_total * ord.factor, ord.ordered_at
  from ord join public.menu_order_lines l on l.order_id = ord.id;
$$;
revoke all on function private.menu_net_lines(uuid, timestamptz, timestamptz) from public, anon, authenticated;

drop function if exists public.menu_month_orders(uuid, timestamptz, timestamptz);
create function public.menu_month_orders(p_unit uuid, p_start timestamptz, p_end timestamptz)
returns table (orders bigint, revenue numeric, discount numeric)
language sql stable security definer set search_path = ''
as $$
  select count(o.id), coalesce(sum(o.total), 0), coalesce(sum(o.discount), 0)
  from public.units u
  left join public.menu_orders o on o.unit_id = u.id and o.ordered_at >= p_start and o.ordered_at < p_end
  where u.id = p_unit and private.is_org_member(u.org_id);
$$;

drop function if exists public.menu_month_lines(uuid, timestamptz, timestamptz);
create function public.menu_month_lines(p_unit uuid, p_start timestamptz, p_end timestamptz)
returns table (product_id uuid, qty numeric, revenue numeric, net_revenue numeric)
language sql stable security definer set search_path = ''
as $$
  select n.product_id, sum(n.qty), sum(n.gross), sum(n.net)
  from private.menu_net_lines(p_unit, p_start, p_end) n
  group by n.product_id;
$$;

-- Por ficha: marmitas vendidas (qtd × marmitas por venda) e quanto foi pago por elas. Base do preço médio vendido e dos pesos das médias.
create function public.menu_recipe_sales(p_unit uuid, p_start timestamptz, p_end timestamptz)
returns table (recipe_id uuid, units numeric, gross numeric, net numeric)
language sql stable security definer set search_path = ''
as $$
  select p.recipe_id, sum(n.qty * p.units_per_sale), sum(n.gross), sum(n.net)
  from private.menu_net_lines(p_unit, p_start, p_end) n
  join public.menu_products p on p.id = n.product_id
  where p.recipe_id is not null and not p.ignored
  group by p.recipe_id;
$$;

revoke all on function public.menu_month_orders(uuid, timestamptz, timestamptz), public.menu_month_lines(uuid, timestamptz, timestamptz),
  public.menu_recipe_sales(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.menu_month_orders(uuid, timestamptz, timestamptz), public.menu_month_lines(uuid, timestamptz, timestamptz),
  public.menu_recipe_sales(uuid, timestamptz, timestamptz) to authenticated;
