-- A receita pode render em litros ou ml (1 ml conta como 1 g no custo). Só afrouxa a regra: nenhum dado muda.
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.recipes'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%portion_weight_unit%';
  if c is not null then execute format('alter table public.recipes drop constraint %I', c); end if;
end $$;
alter table public.recipes add constraint recipes_portion_weight_unit_check check (portion_weight_unit in ('g', 'kg', 'ml', 'l'));
