-- Tabela nutricional dos produtos (calculada com a TACO). Só acrescenta: duas tabelas novas, nada existente é alterado.
--  1) ingredient_taco_links: qual alimento da TACO (id da 4ª edição, que mora no código) corresponde a cada ingrediente.
--  2) recipe_nutrition_overrides: valores que o cliente corrigiu na tabela de um produto (por porção) e o peso/medida caseira.
-- RLS padrão: quem é da marmitaria lê; quem pode escrever altera.

create table public.ingredient_taco_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  taco_id integer not null check (taco_id between 1 and 9999),
  updated_at timestamptz not null default now(),
  unique (ingredient_id)
);
create index ingredient_taco_links_org_idx on public.ingredient_taco_links (org_id);

create table public.recipe_nutrition_overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  -- Valores por porção que o cliente digitou, por nutriente (kcal, carbs, sugars, addedSugars, protein, fat, satFat, transFat, fiber, sodium).
  "values" jsonb not null default '{}'::jsonb check (jsonb_typeof("values") = 'object'),
  portion_grams numeric(10, 2) check (portion_grams > 0),
  household_measure text check (household_measure is null or char_length(household_measure) <= 60),
  updated_at timestamptz not null default now(),
  unique (recipe_id)
);
create index recipe_nutrition_overrides_org_idx on public.recipe_nutrition_overrides (org_id);

do $$
declare t text;
begin
  foreach t in array array['ingredient_taco_links', 'recipe_nutrition_overrides'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_org_member(org_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_write_org(org_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_write_org(org_id)) with check (private.can_write_org(org_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.can_write_org(org_id))', t || '_delete', t);
  end loop;
end $$;
