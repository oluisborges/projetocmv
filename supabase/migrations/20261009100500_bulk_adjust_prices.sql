-- Reajuste em % de vários insumos de uma vez ("carnes +8%"). SECURITY INVOKER: respeita o RLS do
-- usuário (só quem pode escrever na organização consegue). O histórico de preço é gravado pelo gatilho.
create function public.bulk_adjust_ingredient_prices(
  p_org uuid,
  p_pct numeric,
  p_category text default null,
  p_supplier uuid default null
) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_pct is null or p_pct <= -1 or p_pct > 5 then
    raise exception 'percentual inválido' using errcode = '22023';
  end if;

  update public.ingredients
  set purchase_price = round(purchase_price * (1 + p_pct), 4)
  where org_id = p_org
    and archived_at is null
    and purchase_price > 0
    and (p_category is null or category = p_category)
    and (p_supplier is null or supplier_id = p_supplier);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.bulk_adjust_ingredient_prices(uuid, numeric, text, uuid) from public, anon;
grant execute on function public.bulk_adjust_ingredient_prices(uuid, numeric, text, uuid) to authenticated;
