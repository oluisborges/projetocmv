-- Rendimento depois de pronto. Na ficha "por marmita" o dono digita os gramas PRONTOS (150 g de arroz cozido),
-- mas o preço é do insumo CRU. cooking_yield = peso pronto ÷ peso cru e limpo (arroz 2,5; frango grelhado 0,75).
-- O custo usa: gramas prontos ÷ rendimento × fator de correção × preço por grama comprado.
alter table public.ingredients
  add column cooking_yield numeric(5, 3) not null default 1 check (cooking_yield > 0 and cooking_yield <= 10);
alter table public.template_ingredients
  add column cooking_yield numeric(5, 3) not null default 1 check (cooking_yield > 0 and cooking_yield <= 10);

-- Fichas-modelo seguem o modo "por marmita" (padrão do produto).
alter table public.template_recipes
  add column mode text not null default 'serving' check (mode in ('serving', 'batch'));

-- Mesma regra das fichas: "por marmita" é sempre 1 porção, sem perda de cocção.
alter table public.template_recipes
  add constraint template_recipes_serving_shape check (mode <> 'serving' or (portions = 1 and cooking_loss_pct = 0));

-- Valores TÍPICOS de mercado (revisar com a equipe de nutrição/cozinha da Shogun).
update public.template_ingredients t set cooking_yield = v.y
from (values
  ('Arroz branco', 2.5), ('Feijão carioca', 2.2), ('Macarrão penne', 2.3),
  ('Peito de frango', 0.75), ('Coxa e sobrecoxa de frango', 0.75), ('Carne moída', 0.7), ('Acém em cubos', 0.6),
  ('Patinho em bife', 0.75), ('Filé de tilápia', 0.8), ('Linguiça toscana', 0.8), ('Copa lombo suíno', 0.75), ('Bacon', 0.35),
  ('Cebola', 0.8), ('Cenoura', 0.95), ('Brócolis', 0.9), ('Couve-flor', 0.9), ('Abobrinha', 0.85), ('Vagem', 0.9),
  ('Pimentão', 0.9), ('Repolho', 0.8), ('Chuchu', 0.95)
) as v(name, y)
where lower(t.name) = lower(v.name);

-- Importar do catálogo passa a copiar o rendimento dos insumos e o modo das fichas.
create or replace function public.import_template(
  p_org uuid,
  p_ingredient_ids uuid[] default '{}',
  p_recipe_ids uuid[] default '{}'
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ing_ids uuid[];
begin
  if not private.can_write_org(p_org) then
    raise exception 'sem permissão nesta organização' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct x), '{}') into v_ing_ids
  from (
    select unnest(coalesce(p_ingredient_ids, '{}')) as x
    union
    select tri.template_ingredient_id
    from public.template_recipe_items tri
    where tri.template_recipe_id = any (coalesce(p_recipe_ids, '{}'))
  ) s;

  insert into public.ingredients
    (org_id, name, category, kind, purchase_unit, purchase_qty, purchase_price, correction_factor, cooking_yield, template_id)
  select p_org, ti.name, ti.category, ti.kind, ti.purchase_unit, ti.purchase_qty, ti.reference_price,
         ti.correction_factor, ti.cooking_yield, ti.id
  from public.template_ingredients ti
  where ti.id = any (v_ing_ids)
  on conflict (org_id, template_id) where template_id is not null do nothing;

  with new_recipes as (
    insert into public.recipes
      (org_id, name, category, portions, portion_weight, cooking_loss_pct, mode, template_id)
    select p_org, tr.name, tr.category, tr.portions, tr.portion_weight, tr.cooking_loss_pct, tr.mode, tr.id
    from public.template_recipes tr
    where tr.id = any (coalesce(p_recipe_ids, '{}'))
    on conflict (org_id, template_id) where template_id is not null do nothing
    returning id, template_id
  )
  insert into public.recipe_items (org_id, recipe_id, ingredient_id, net_qty, scope, counts_for_yield)
  select p_org, nr.id, i.id, tri.net_qty, tri.scope, (tri.scope = 'batch')
  from new_recipes nr
  join public.template_recipe_items tri on tri.template_recipe_id = nr.template_id
  join public.ingredients i on i.org_id = p_org and i.template_id = tri.template_ingredient_id;
end;
$$;

-- Fichas-modelo: gramas PRONTOS em UMA marmita (valores de partida; o dono ajusta ao que realmente serve).
create unique index if not exists template_recipes_name_uq on public.template_recipes (lower(name));

with r as (
  insert into public.template_recipes (name, category, portions, cooking_loss_pct, mode) values
    ('Frango grelhado, arroz e feijão', 'Tradicional', 1, 0, 'serving'),
    ('Strogonoff de carne com arroz', 'Tradicional', 1, 0, 'serving'),
    ('Carne moída com legumes e arroz', 'Tradicional', 1, 0, 'serving'),
    ('Tilápia com purê de batata', 'Peixes', 1, 0, 'serving'),
    ('Macarrão à bolonhesa', 'Massas', 1, 0, 'serving'),
    ('Escondidinho de carne', 'Especiais', 1, 0, 'serving'),
    ('Frango à parmegiana com arroz', 'Especiais', 1, 0, 'serving'),
    ('Feijoada completa', 'Especiais', 1, 0, 'serving'),
    ('Coxa assada com batata', 'Tradicional', 1, 0, 'serving')
  on conflict do nothing
  returning id, name
)
insert into public.template_recipe_items (template_recipe_id, template_ingredient_id, net_qty, scope)
select r.id, ti.id, v.qty, v.scope
from (values
  ('Frango grelhado, arroz e feijão', 'Peito de frango', 120, 'batch'),
  ('Frango grelhado, arroz e feijão', 'Arroz branco', 150, 'batch'),
  ('Frango grelhado, arroz e feijão', 'Feijão carioca', 80, 'batch'),
  ('Frango grelhado, arroz e feijão', 'Brócolis', 50, 'batch'),
  ('Strogonoff de carne com arroz', 'Acém em cubos', 110, 'batch'),
  ('Strogonoff de carne com arroz', 'Creme de leite', 30, 'batch'),
  ('Strogonoff de carne com arroz', 'Molho de tomate', 30, 'batch'),
  ('Strogonoff de carne com arroz', 'Cebola', 15, 'batch'),
  ('Strogonoff de carne com arroz', 'Arroz branco', 150, 'batch'),
  ('Carne moída com legumes e arroz', 'Carne moída', 100, 'batch'),
  ('Carne moída com legumes e arroz', 'Arroz branco', 150, 'batch'),
  ('Carne moída com legumes e arroz', 'Feijão carioca', 70, 'batch'),
  ('Carne moída com legumes e arroz', 'Cenoura', 40, 'batch'),
  ('Carne moída com legumes e arroz', 'Vagem', 40, 'batch'),
  ('Tilápia com purê de batata', 'Filé de tilápia', 130, 'batch'),
  ('Tilápia com purê de batata', 'Batata inglesa', 150, 'batch'),
  ('Tilápia com purê de batata', 'Brócolis', 60, 'batch'),
  ('Macarrão à bolonhesa', 'Macarrão penne', 200, 'batch'),
  ('Macarrão à bolonhesa', 'Carne moída', 80, 'batch'),
  ('Macarrão à bolonhesa', 'Molho de tomate', 60, 'batch'),
  ('Macarrão à bolonhesa', 'Queijo mussarela', 20, 'batch'),
  ('Macarrão à bolonhesa', 'Cebola', 10, 'batch'),
  ('Escondidinho de carne', 'Mandioca', 160, 'batch'),
  ('Escondidinho de carne', 'Carne moída', 100, 'batch'),
  ('Escondidinho de carne', 'Queijo mussarela', 25, 'batch'),
  ('Escondidinho de carne', 'Cebola', 15, 'batch'),
  ('Escondidinho de carne', 'Molho de tomate', 20, 'batch'),
  ('Frango à parmegiana com arroz', 'Peito de frango', 120, 'batch'),
  ('Frango à parmegiana com arroz', 'Molho de tomate', 40, 'batch'),
  ('Frango à parmegiana com arroz', 'Queijo mussarela', 30, 'batch'),
  ('Frango à parmegiana com arroz', 'Arroz branco', 120, 'batch'),
  ('Feijoada completa', 'Feijão carioca', 120, 'batch'),
  ('Feijoada completa', 'Linguiça toscana', 50, 'batch'),
  ('Feijoada completa', 'Copa lombo suíno', 50, 'batch'),
  ('Feijoada completa', 'Bacon', 10, 'batch'),
  ('Feijoada completa', 'Arroz branco', 100, 'batch'),
  ('Feijoada completa', 'Farofa pronta', 20, 'batch'),
  ('Coxa assada com batata', 'Coxa e sobrecoxa de frango', 170, 'batch'),
  ('Coxa assada com batata', 'Batata inglesa', 120, 'batch'),
  ('Coxa assada com batata', 'Cenoura', 40, 'batch')
) as v(recipe, ing, qty, scope)
join r on r.name = v.recipe
join public.template_ingredients ti on lower(ti.name) = lower(v.ing);

-- Embalagem de cada marmita modelo (1 de cada, por porção).
insert into public.template_recipe_items (template_recipe_id, template_ingredient_id, net_qty, scope)
select tr.id, ti.id, 1, 'portion'
from public.template_recipes tr
cross join public.template_ingredients ti
where ti.kind = 'embalagem'
  and ti.name in ('Bandeja 750 ml', 'Filme/tampa da bandeja', 'Etiqueta', 'Lacre')
  and not exists (select 1 from public.template_recipe_items x where x.template_recipe_id = tr.id and x.template_ingredient_id = ti.id and x.scope = 'portion')
  and tr.name in (
    'Frango grelhado, arroz e feijão', 'Strogonoff de carne com arroz', 'Carne moída com legumes e arroz', 'Tilápia com purê de batata',
    'Macarrão à bolonhesa', 'Escondidinho de carne', 'Frango à parmegiana com arroz', 'Feijoada completa', 'Coxa assada com batata'
  );
