-- Travas no PRÓPRIO banco (antes só o app impedia; chamada direta à API passava):

-- 1) Insumo usado em ficha não muda de tipo (insumo/embalagem) nem de medida-base (g, ml, un):
--    as fichas guardam a quantidade na medida-base, então a troca mudaria o custo em silêncio.
--    Trocar entre kg e g (ou l e ml) continua permitido: a base é a mesma.
create function private.guard_ingredient_meaning() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  old_base text := case old.purchase_unit when 'kg' then 'g' when 'g' then 'g' when 'l' then 'ml' when 'ml' then 'ml' else 'un' end;
  new_base text := case new.purchase_unit when 'kg' then 'g' when 'g' then 'g' when 'l' then 'ml' when 'ml' then 'ml' else 'un' end;
begin
  if (new.kind is distinct from old.kind or new_base is distinct from old_base)
     and exists (select 1 from public.recipe_items i where i.ingredient_id = old.id) then
    raise exception 'ingrediente em uso em fichas: não dá para mudar o tipo ou a medida' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger ingredients_guard_meaning
  before update of kind, purchase_unit on public.ingredients
  for each row execute function private.guard_ingredient_meaning();

-- 2) Ficha "por marmita" é sempre 1 porção, sem perda de cocção.
alter table public.recipes
  add constraint recipes_serving_shape check (mode <> 'serving' or (portions = 1 and cooking_loss_pct = 0));
