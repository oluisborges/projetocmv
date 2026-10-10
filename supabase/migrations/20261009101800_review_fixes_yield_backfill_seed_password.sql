-- 1) Trocar a senha no primeiro acesso: a senha definida pelo admin passou por mensagem, então a pessoa cria a sua.
--    Só o servidor escreve esta coluna (o cliente só pode alterar full_name em profiles).
alter table public.profiles add column must_change_password boolean not null default false;

-- 2) Insumos importados do catálogo ANTES do rendimento existir ficaram em 1 (padrão da coluna): copia o rendimento do modelo.
--    Só mexe nos que ainda estão no padrão; quem já ajustou o próprio valor não é tocado.
update public.ingredients i
set cooking_yield = ti.cooking_yield
from public.template_ingredients ti
where i.template_id = ti.id and i.cooking_yield = 1 and ti.cooking_yield <> 1;

-- 3) Catálogo: feijão preto (para a feijoada) e farinha de rosca (para o empanado).
insert into public.template_ingredients (name, category, kind, purchase_unit, purchase_qty, reference_price, correction_factor, cooking_yield) values
  ('Feijão preto', 'Grãos e massas', 'insumo', 'kg', 1, 0, 1.00, 2.2),
  ('Farinha de rosca', 'Temperos e outros', 'insumo', 'kg', 1, 0, 1.00, 1.0)
on conflict do nothing;

-- 4) Fichas-modelo: a feijoada leva feijão preto; a parmegiana leva empanado; todas levam óleo, sal e alho
--    (sem eles o custo ficava subestimado em alguns centavos por marmita).
update public.template_recipe_items tri
set template_ingredient_id = (select id from public.template_ingredients where name = 'Feijão preto')
where tri.template_recipe_id = (select id from public.template_recipes where name = 'Feijoada completa')
  and tri.template_ingredient_id = (select id from public.template_ingredients where name = 'Feijão carioca');

insert into public.template_recipe_items (template_recipe_id, template_ingredient_id, net_qty, scope)
select tr.id, ti.id, v.qty, 'batch'
from (values
  ('Frango à parmegiana com arroz', 'Farinha de rosca', 20),
  ('Frango à parmegiana com arroz', 'Ovo', 0.3)
) as v(recipe, ing, qty)
join public.template_recipes tr on tr.name = v.recipe
join public.template_ingredients ti on lower(ti.name) = lower(v.ing)
on conflict do nothing;

insert into public.template_recipe_items (template_recipe_id, template_ingredient_id, net_qty, scope)
select tr.id, ti.id, v.qty, 'batch'
from public.template_recipes tr
cross join (values ('Óleo de soja', 5), ('Sal', 2), ('Alho', 2)) as v(ing, qty)
join public.template_ingredients ti on lower(ti.name) = lower(v.ing)
where tr.name in (
  'Frango grelhado, arroz e feijão', 'Strogonoff de carne com arroz', 'Carne moída com legumes e arroz', 'Tilápia com purê de batata',
  'Macarrão à bolonhesa', 'Escondidinho de carne', 'Frango à parmegiana com arroz', 'Feijoada completa', 'Coxa assada com batata'
)
on conflict do nothing;
