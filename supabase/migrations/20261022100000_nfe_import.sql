-- Importação de NF-e (XML): quais notas já entraram (para nunca contar duas vezes) e a memória de "este item deste fornecedor é este insumo".
create table public.nfe_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  unit_id uuid not null,
  -- chave de acesso da nota (44 dígitos): a mesma nota não entra duas vezes na mesma marmitaria
  access_key text not null check (access_key ~ '^[0-9]{44}$'),
  nfe_number text,
  supplier_name text not null,
  supplier_cnpj text,
  issued_at timestamptz not null,
  total numeric(14, 2) not null check (total >= 0),
  items_count integer not null check (items_count >= 0),
  -- quanto desta nota foi somado ao total de compras do mês (0 se o dono preferiu não somar)
  added_to_purchases numeric(14, 2) not null default 0 check (added_to_purchases >= 0),
  imported_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, access_key),
  foreign key (unit_id, org_id) references public.units (id, org_id) on delete cascade
);
create index nfe_imports_org_id_idx on public.nfe_imports (org_id);
create index nfe_imports_unit_idx on public.nfe_imports (unit_id, issued_at desc);

create table public.nfe_item_map (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  supplier_cnpj text not null,
  supplier_code text not null check (length(supplier_code) between 1 and 80),
  ingredient_id uuid,
  -- o dono marcou este item como "não é insumo" (limpeza, descartável que não entra em ficha…)
  ignored boolean not null default false,
  -- conteúdo de uma embalagem (CX, PCT, SC…), informado uma vez e lembrado
  pack_qty numeric(14, 4) check (pack_qty is null or pack_qty > 0),
  pack_unit text check (pack_unit is null or pack_unit in ('kg', 'g', 'l', 'ml', 'un')),
  name_hint text check (name_hint is null or length(name_hint) <= 200),
  updated_at timestamptz not null default now(),
  unique (org_id, supplier_cnpj, supplier_code),
  foreign key (ingredient_id, org_id) references public.ingredients (id, org_id) on delete cascade,
  check (not ignored or ingredient_id is null),
  check ((pack_qty is null) = (pack_unit is null))
);
create index nfe_item_map_org_id_idx on public.nfe_item_map (org_id);
create index nfe_item_map_ingredient_idx on public.nfe_item_map (ingredient_id) where ingredient_id is not null;
create trigger nfe_item_map_touch before update on public.nfe_item_map for each row execute function private.touch_updated_at();

alter table public.nfe_imports enable row level security;
alter table public.nfe_item_map enable row level security;
create policy nfe_imports_select on public.nfe_imports for select to authenticated using (private.is_org_member(org_id));
create policy nfe_imports_insert on public.nfe_imports for insert to authenticated with check (private.can_write_org(org_id) and imported_by = (select auth.uid()));
create policy nfe_imports_update on public.nfe_imports for update to authenticated using (private.can_write_org(org_id)) with check (private.can_write_org(org_id));
create policy nfe_imports_delete on public.nfe_imports for delete to authenticated using (private.can_write_org(org_id));
create policy nfe_item_map_select on public.nfe_item_map for select to authenticated using (private.is_org_member(org_id));
create policy nfe_item_map_insert on public.nfe_item_map for insert to authenticated with check (private.can_write_org(org_id));
create policy nfe_item_map_update on public.nfe_item_map for update to authenticated using (private.can_write_org(org_id)) with check (private.can_write_org(org_id));
create policy nfe_item_map_delete on public.nfe_item_map for delete to authenticated using (private.can_write_org(org_id));

-- Soma ao total de compras do mês (cria o mês se não existir). Roda com a sessão de quem importa, então o RLS vale.
create function public.nfe_add_purchases(p_org uuid, p_unit uuid, p_month date, p_amount numeric)
returns void
language sql security invoker set search_path = ''
as $$
  insert into public.periods (org_id, unit_id, month, purchases)
  values (p_org, p_unit, date_trunc('month', p_month)::date, p_amount)
  on conflict (unit_id, month) do update set purchases = public.periods.purchases + excluded.purchases;
$$;
revoke all on function public.nfe_add_purchases(uuid, uuid, date, numeric) from public, anon;
grant execute on function public.nfe_add_purchases(uuid, uuid, date, numeric) to authenticated;
