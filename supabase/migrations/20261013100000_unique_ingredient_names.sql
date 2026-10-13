-- Um insumo não pode aparecer duas vezes na mesma marmitaria.
-- "Arroz branco", "arroz BRANCO", "Arroz  branco " e "Árroz branco" são o MESMO nome. Marcas são nomes diferentes
-- ("Arroz branco Tio João" e "Arroz branco Prato Fino" podem coexistir com "Arroz branco").

-- Nome "normalizado": minúsculas, sem acento, sem espaços sobrando.
create or replace function private.norm_name(t text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select btrim(regexp_replace(translate(lower(t), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '\s+', ' ', 'g'))
$$;
revoke all on function private.norm_name(text) from public;
grant execute on function private.norm_name(text) to authenticated;

-- Só os itens ativos contam: um insumo arquivado não bloqueia o nome.
create unique index ingredients_org_name_uq on public.ingredients (org_id, private.norm_name(name)) where archived_at is null;
create unique index template_ingredients_norm_name_uq on public.template_ingredients (private.norm_name(name));

-- Importar do catálogo: se a marmitaria já tem um insumo com esse nome (cadastrado à mão), o item do catálogo é
-- VINCULADO a ele (as fichas-modelo passam a usá-lo, com o preço que o cliente já tinha) em vez de criar um segundo.
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

  update public.ingredients i
  set template_id = ti.id
  from public.template_ingredients ti
  where ti.id = any (v_ing_ids)
    and i.org_id = p_org
    and i.template_id is null
    and i.archived_at is null
    and private.norm_name(i.name) = private.norm_name(ti.name)
    and not exists (select 1 from public.ingredients j where j.org_id = p_org and j.template_id = ti.id);

  insert into public.ingredients
    (org_id, name, category, kind, purchase_unit, purchase_qty, purchase_price, correction_factor, cooking_yield, template_id)
  select p_org, ti.name, ti.category, ti.kind, ti.purchase_unit, ti.purchase_qty, ti.reference_price,
         ti.correction_factor, ti.cooking_yield, ti.id
  from public.template_ingredients ti
  where ti.id = any (v_ing_ids)
    and not exists (
      select 1 from public.ingredients x
      where x.org_id = p_org and x.archived_at is null and private.norm_name(x.name) = private.norm_name(ti.name)
    )
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
