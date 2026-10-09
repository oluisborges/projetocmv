-- O dono escolhe a unidade de medida que quiser (kg, g, l, ml, un). A quantidade continua guardada na
-- unidade-base (g/ml/un) para o cálculo; estas colunas só lembram em que unidade ele digitou.
alter table public.recipe_items
  add column qty_unit text check (qty_unit in ('kg', 'g', 'l', 'ml', 'un'));

alter table public.recipes
  add column portion_weight_unit text check (portion_weight_unit in ('g', 'kg'));
