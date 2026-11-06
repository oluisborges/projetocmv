-- Fichas: modo de preparo (receita) e passo a passo de montagem (produto), ordem dos itens e foto de referência do produto.
-- Só acrescenta, compatível com o código que já está no ar: duas colunas novas e anuláveis, uma tabela nova.
--  1) recipes.instructions: texto livre. Na receita é o modo de preparo; no produto é o passo a passo da montagem.
--  2) recipe_items.sort_order: posição do item na montagem (1, 2, 3…). Nulo = sem ordem escolhida (vai para o fim).
--  3) recipe_photos: uma foto por produto, já reduzida pelo navegador (JPEG em base64, até ~300 KB). Fica em tabela
--     separada para não pesar nas listas de produtos. RLS padrão: quem é da marmitaria lê; quem pode escrever altera.

alter table public.recipes add column instructions text check (instructions is null or char_length(instructions) <= 4000);
alter table public.recipe_items add column sort_order integer check (sort_order is null or sort_order >= 0);

create table public.recipe_photos (
  recipe_id uuid primary key references public.recipes (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  data_url text not null check (data_url like 'data:image/jpeg;base64,%' and char_length(data_url) <= 400000),
  updated_at timestamptz not null default now()
);
create index recipe_photos_org_idx on public.recipe_photos (org_id);

alter table public.recipe_photos enable row level security;
create policy recipe_photos_select on public.recipe_photos for select to authenticated using (private.is_org_member(org_id));
create policy recipe_photos_insert on public.recipe_photos for insert to authenticated with check (private.can_write_org(org_id));
create policy recipe_photos_update on public.recipe_photos for update to authenticated using (private.can_write_org(org_id)) with check (private.can_write_org(org_id));
create policy recipe_photos_delete on public.recipe_photos for delete to authenticated using (private.can_write_org(org_id));
