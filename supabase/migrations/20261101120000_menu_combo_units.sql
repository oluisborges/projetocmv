-- Marmitas vendidas por ficha contando o que vem dentro dos combos, sem tirar duas vezes. Só acrescenta (duas funções novas).
--
-- Regra por pedido:
--  * Venda de ficha (item ou opção vinculada a uma ficha): conta qtd × marmitas por venda.
--  * Venda de combo SEM opções vinculadas a fichas no pedido: conta as marmitas dos grupos FIXOS do combo (qtd do grupo × qtd vendida).
--    Grupos de escolha não dá para saber sem as opções, então ficam de fora.
--  * Venda de combo COM opções vinculadas a fichas no pedido: as opções são as marmitas do combo (escolhidas ou fixas), então valem
--    elas e o combo NÃO é expandido (combo e opções são a mesma coisa; nunca tira duas vezes).
-- `menu_combo_covered` diz, por produto-combo, quantas vendas já foram cobertas pelas opções (para não custear de novo).

create function public.menu_recipe_units(p_unit uuid, p_start timestamptz, p_end timestamptz)
returns table (recipe_id uuid, units numeric)
language sql stable security definer set search_path = ''
as $$
  with scope as (
    select u.id from public.units u where u.id = p_unit and private.is_org_member(u.org_id)
  ), ln as (
    select l.order_id, l.qty, p.kind, p.recipe_id, p.combo_id, p.units_per_sale
    from scope
    join public.menu_orders o on o.unit_id = scope.id and o.ordered_at >= p_start and o.ordered_at < p_end
    join public.menu_order_lines l on l.order_id = o.id
    join public.menu_products p on p.id = l.product_id
    where not p.ignored
  ), with_options as (
    select distinct order_id from ln where kind = 'option' and recipe_id is not null
  ), direct as (
    select ln.recipe_id, ln.qty * ln.units_per_sale as units from ln where ln.recipe_id is not null
  ), fixed as (
    select go.recipe_id, ln.qty * go.qty as units
    from ln
    join public.combo_groups g on g.combo_id = ln.combo_id and g.kind = 'fixed'
    join public.combo_group_options go on go.group_id = g.id
    where ln.combo_id is not null and ln.order_id not in (select order_id from with_options)
  )
  select x.recipe_id, sum(x.units) from (select * from direct union all select * from fixed) x group by x.recipe_id;
$$;

create function public.menu_combo_covered(p_unit uuid, p_start timestamptz, p_end timestamptz)
returns table (product_id uuid, qty numeric)
language sql stable security definer set search_path = ''
as $$
  with scope as (
    select u.id from public.units u where u.id = p_unit and private.is_org_member(u.org_id)
  ), ord as (
    select o.id from scope join public.menu_orders o on o.unit_id = scope.id and o.ordered_at >= p_start and o.ordered_at < p_end
  ), with_options as (
    select distinct l.order_id
    from ord
    join public.menu_order_lines l on l.order_id = ord.id
    join public.menu_products p on p.id = l.product_id
    where p.kind = 'option' and p.recipe_id is not null and not p.ignored
  )
  select p.id, sum(l.qty)
  from with_options w
  join public.menu_order_lines l on l.order_id = w.order_id
  join public.menu_products p on p.id = l.product_id
  where p.combo_id is not null and not p.ignored
  group by p.id;
$$;

revoke all on function public.menu_recipe_units(uuid, timestamptz, timestamptz), public.menu_combo_covered(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.menu_recipe_units(uuid, timestamptz, timestamptz), public.menu_combo_covered(uuid, timestamptz, timestamptz) to authenticated;
