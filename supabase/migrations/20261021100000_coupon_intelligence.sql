-- Inteligência de cupom: guarda QUAL cupom foi usado em cada pedido e agrega por cupom e produto (valor pago, já sem a parte do desconto).
--   coupon_code: o código do cupom; '' = o pedido foi lido e não tem código (desconto de fidelidade, etc.); NULL = pedido antigo ainda
--   não relido (a importação completa isso sozinha para os pedidos que têm desconto).
alter table public.menu_orders add column coupon_code text check (coupon_code is null or length(coupon_code) <= 60);
create index menu_orders_coupon_idx on public.menu_orders (unit_id, coupon_code) where discount > 0;

-- Um grupo por cupom: pedidos, desconto, valor dos itens antes e depois do desconto.
create function public.menu_coupon_groups(p_unit uuid, p_start timestamptz, p_end timestamptz)
returns table (coupon_code text, orders bigint, discount numeric, gross numeric, net numeric)
language sql stable security definer set search_path = ''
as $$
  with per_order as (
    select o.id, o.coupon_code, o.discount, sum(n.gross) as gross, sum(n.net) as net
    from private.menu_net_lines(p_unit, p_start, p_end) n
    join public.menu_orders o on o.id = n.order_id
    where o.discount > 0
    group by o.id, o.coupon_code, o.discount
  )
  select coalesce(coupon_code, '?'), count(*), sum(discount), sum(gross), sum(net)
  from per_order
  group by coalesce(coupon_code, '?');
$$;

-- O mesmo, por cupom e produto (para ligar cada produto ao custo da ficha).
create function public.menu_coupon_products(p_unit uuid, p_start timestamptz, p_end timestamptz)
returns table (coupon_code text, product_id uuid, qty numeric, gross numeric, net numeric)
language sql stable security definer set search_path = ''
as $$
  select coalesce(o.coupon_code, '?'), n.product_id, sum(n.qty), sum(n.gross), sum(n.net)
  from private.menu_net_lines(p_unit, p_start, p_end) n
  join public.menu_orders o on o.id = n.order_id
  where o.discount > 0
  group by coalesce(o.coupon_code, '?'), n.product_id;
$$;

revoke all on function public.menu_coupon_groups(uuid, timestamptz, timestamptz), public.menu_coupon_products(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.menu_coupon_groups(uuid, timestamptz, timestamptz), public.menu_coupon_products(uuid, timestamptz, timestamptz) to authenticated;

-- Releitura: as conexões voltam a listar os 4 meses; só os pedidos com desconto e sem código são buscados de novo.
update public.menu_connections set phase = 'history', history_cursor = null where status = 'connected';
