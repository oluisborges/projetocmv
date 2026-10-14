-- Combos: o que a marmitaria vende em kit ("5 marmitas", "Semanal"), no estilo Cardápio Web.
--   combo            = o produto vendido
--   grupo do combo   = um "complemento": FIXO (5× Frango grelhado) ou de ESCOLHA ("escolha 10 entre estas marmitas")
--   opção do grupo   = uma ficha de marmita
-- Preço: cada marmita tem seu preço DENTRO do combo (kit de 20 sai mais barato por unidade que o de 5).
create table public.combos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id)
);
create index combos_org_id_idx on public.combos (org_id);
-- mesmo nome de combo ativo não repete na marmitaria (mesma regra dos insumos)
create unique index combos_org_name_uq on public.combos (org_id, private.norm_name(name)) where active;
create trigger combos_touch before update on public.combos for each row execute function private.touch_updated_at();

create table public.combo_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  combo_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 80),
  kind text not null check (kind in ('fixed', 'choice')),
  -- só grupo de ESCOLHA: quantas marmitas o cliente escolhe e quanto cada uma sai no combo
  pick_qty integer check (pick_qty between 1 and 1000),
  unit_price numeric(14, 2) check (unit_price >= 0),
  position integer not null default 0,
  unique (id, org_id),
  foreign key (combo_id, org_id) references public.combos (id, org_id) on delete cascade,
  check ((kind = 'choice' and pick_qty is not null and unit_price is not null) or (kind = 'fixed' and pick_qty is null and unit_price is null))
);
create index combo_groups_org_id_idx on public.combo_groups (org_id);
create index combo_groups_combo_idx on public.combo_groups (combo_id);

create table public.combo_group_options (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  group_id uuid not null,
  recipe_id uuid not null,
  -- só grupo FIXO: quantas unidades dessa marmita e quanto cada uma sai dentro do combo
  qty integer check (qty between 1 and 1000),
  unit_price numeric(14, 2) check (unit_price >= 0),
  position integer not null default 0,
  unique (group_id, recipe_id),
  foreign key (group_id, org_id) references public.combo_groups (id, org_id) on delete cascade,
  foreign key (recipe_id, org_id) references public.recipes (id, org_id) on delete cascade
);
create index combo_group_options_org_id_idx on public.combo_group_options (org_id);
create index combo_group_options_recipe_idx on public.combo_group_options (recipe_id);

-- Quantidade e preço por marmita só existem em grupo fixo; grupo de escolha leva o preço no próprio grupo.
create function private.check_combo_option() returns trigger
language plpgsql set search_path = ''
as $$
declare v_kind text;
begin
  select kind into v_kind from public.combo_groups where id = new.group_id;
  if v_kind = 'fixed' and (new.qty is null or new.unit_price is null) then
    raise exception 'grupo fixo: informe a quantidade e o preço de cada marmita' using errcode = '23514';
  end if;
  if v_kind = 'choice' and (new.qty is not null or new.unit_price is not null) then
    raise exception 'grupo de escolha: o preço fica no grupo, não em cada opção' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger combo_options_check before insert or update on public.combo_group_options
  for each row execute function private.check_combo_option();

-- Vendas do mês por combo (as de marmita avulsa continuam em period_sales).
create table public.period_combo_sales (
  period_id uuid not null,
  combo_id uuid not null,
  org_id uuid not null,
  qty_sold numeric(14, 2) not null check (qty_sold >= 0),
  primary key (period_id, combo_id),
  foreign key (period_id, org_id) references public.periods (id, org_id) on delete cascade,
  foreign key (combo_id, org_id) references public.combos (id, org_id) on delete cascade
);
create index period_combo_sales_org_id_idx on public.period_combo_sales (org_id);
create index period_combo_sales_combo_idx on public.period_combo_sales (combo_id);

do $$
declare t text;
begin
  foreach t in array array['combos', 'combo_groups', 'combo_group_options', 'period_combo_sales']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_org_member(org_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_write_org(org_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_write_org(org_id)) with check (private.can_write_org(org_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.can_write_org(org_id))', t || '_delete', t);
  end loop;
end $$;

-- Histórico de uso (visível só ao admin Shogun): frases para o que acontece nos combos.
create function private.log_combo_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_org uuid := (coalesce(v_new, v_old) ->> 'org_id')::uuid;
  v_summary text;
  v_combo text;
  v_month text;
begin
  if v_uid is null or v_org is null then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'combos' then
    if tg_op = 'INSERT' then v_summary := 'Criou o combo "' || (v_new ->> 'name') || '"';
    elsif tg_op = 'UPDATE' and (v_old ->> 'active') = 'true' and (v_new ->> 'active') = 'false' then v_summary := 'Arquivou o combo "' || (v_new ->> 'name') || '"';
    elsif tg_op = 'UPDATE' and (v_old ->> 'active') = 'false' and (v_new ->> 'active') = 'true' then v_summary := 'Restaurou o combo "' || (v_new ->> 'name') || '"';
    elsif tg_op = 'UPDATE' and (v_old - 'updated_at') is distinct from (v_new - 'updated_at') then v_summary := 'Renomeou o combo para "' || (v_new ->> 'name') || '"';
    end if;

  elsif tg_table_name = 'combo_groups' then
    select name into v_combo from public.combos where id = (v_row ->> 'combo_id')::uuid;
    if v_combo is not null then
      if tg_op = 'INSERT' then v_summary := 'Combo "' || v_combo || '": adicionou o grupo "' || (v_new ->> 'name') || '"';
      elsif tg_op = 'DELETE' then v_summary := 'Combo "' || v_combo || '": removeu o grupo "' || (v_old ->> 'name') || '"';
      elsif (v_old ->> 'unit_price') is distinct from (v_new ->> 'unit_price') or (v_old ->> 'pick_qty') is distinct from (v_new ->> 'pick_qty') then
        v_summary := 'Combo "' || v_combo || '": alterou o preço ou a quantidade do grupo "' || (v_new ->> 'name') || '"';
      end if;
    end if;

  elsif tg_table_name = 'combo_group_options' then
    select c.name into v_combo from public.combos c join public.combo_groups g on g.combo_id = c.id where g.id = (v_row ->> 'group_id')::uuid;
    if v_combo is not null then
      if tg_op = 'INSERT' then v_summary := 'Combo "' || v_combo || '": adicionou uma marmita';
      elsif tg_op = 'DELETE' then v_summary := 'Combo "' || v_combo || '": removeu uma marmita';
      elsif (v_old ->> 'qty') is distinct from (v_new ->> 'qty') or (v_old ->> 'unit_price') is distinct from (v_new ->> 'unit_price') then
        v_summary := 'Combo "' || v_combo || '": alterou quantidade ou preço de uma marmita';
      end if;
    end if;

  elsif tg_table_name = 'period_combo_sales' then
    select name into v_combo from public.combos where id = (v_row ->> 'combo_id')::uuid;
    select to_char(p.month, 'MM/YYYY') into v_month from public.periods p where p.id = (v_row ->> 'period_id')::uuid;
    if tg_op <> 'DELETE' and (tg_op = 'INSERT' or (v_old ->> 'qty_sold') is distinct from (v_new ->> 'qty_sold')) then
      v_summary := 'Vendas do combo "' || coalesce(v_combo, 'um combo') || '" em ' || coalesce(v_month, 'um mês') || ': ' || (v_new ->> 'qty_sold');
    end if;
  end if;

  if v_summary is not null then
    begin
      insert into public.activity_log (org_id, user_id, by_admin, kind, summary)
      values (v_org, v_uid, private.is_platform_admin(), 'change', left(v_summary, 300));
    exception when foreign_key_violation then
      null;
    end;
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['combos', 'combo_groups', 'combo_group_options', 'period_combo_sales']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.log_combo_change()', t || '_activity', t);
  end loop;
end $$;
