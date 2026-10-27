-- Receitas: preparos feitos em lote (arroz, estrogonofe, purê) que várias marmitas usam por grama.
-- Uma Receita é uma linha de `recipes` com kind = 'receita' (lote que rende 1 "porção" = o peso total pronto).
-- A marmita aponta para ela em `recipe_items.receita_id`, no lugar de `ingredient_id`.
-- Tudo aditivo: o código antigo continua funcionando (só não conhece as receitas).

alter table public.recipes
  add column kind text not null default 'marmita' check (kind in ('marmita', 'receita'));

-- Receita é sempre um lote que rende 1 "porção" (o peso total pronto, em portion_weight), sem perda de cocção informada à parte.
alter table public.recipes
  add constraint recipes_receita_shape check (kind <> 'receita' or (mode = 'batch' and portions = 1 and cooking_loss_pct = 0));

create index recipes_kind_idx on public.recipes (org_id, kind);

alter table public.recipe_items alter column ingredient_id drop not null;
alter table public.recipe_items add column receita_id uuid;
alter table public.recipe_items
  add constraint recipe_items_receita_fk foreign key (receita_id, org_id) references public.recipes (id, org_id) on delete restrict;
alter table public.recipe_items
  add constraint recipe_items_one_source check (num_nonnulls(ingredient_id, receita_id) = 1);
create index recipe_items_receita_idx on public.recipe_items (receita_id) where receita_id is not null;

-- Só marmita usa receita; receita não contém receita (sem aninhamento nem ciclo).
create function private.guard_recipe_item_receita() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.receita_id is not null then
    if not exists (select 1 from public.recipes r where r.id = new.receita_id and r.org_id = new.org_id and r.kind = 'receita') then
      raise exception 'o item precisa apontar para uma receita' using errcode = '23514';
    end if;
    if not exists (select 1 from public.recipes r where r.id = new.recipe_id and r.org_id = new.org_id and r.kind = 'marmita') then
      raise exception 'uma receita não pode usar outra receita' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger recipe_items_guard_receita
  before insert or update on public.recipe_items
  for each row execute function private.guard_recipe_item_receita();

-- O tipo da ficha não muda depois de criada (marmita e receita têm regras diferentes).
create function private.guard_recipe_kind() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.kind is distinct from old.kind then
    raise exception 'não dá para mudar o tipo da ficha' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger recipes_guard_kind
  before update of kind on public.recipes
  for each row execute function private.guard_recipe_kind();
