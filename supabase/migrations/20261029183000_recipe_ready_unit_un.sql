-- A receita também pode render em unidades (ex.: 30 pães). Só afrouxa a regra: nenhum dado muda.
alter table public.recipes drop constraint if exists recipes_portion_weight_unit_check;
alter table public.recipes add constraint recipes_portion_weight_unit_check check (portion_weight_unit in ('g', 'kg', 'ml', 'l', 'un'));
