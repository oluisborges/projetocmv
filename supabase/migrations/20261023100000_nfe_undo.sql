-- NF-e: guarda o que cada importação mudou (para poder desfazer) e uma função para tirar das compras do mês.
alter table public.nfe_imports add column changes jsonb not null default '[]'::jsonb;
alter table public.nfe_imports add column items_in_stock_total numeric(14, 2) not null default 0 check (items_in_stock_total >= 0);

create function public.nfe_remove_purchases(p_org uuid, p_unit uuid, p_month date, p_amount numeric)
returns void
language sql security invoker set search_path = ''
as $$
  update public.periods
     set purchases = greatest(0, purchases - p_amount)
   where org_id = p_org and unit_id = p_unit and month = date_trunc('month', p_month)::date;
$$;
revoke all on function public.nfe_remove_purchases(uuid, uuid, date, numeric) from public, anon;
grant execute on function public.nfe_remove_purchases(uuid, uuid, date, numeric) to authenticated;
