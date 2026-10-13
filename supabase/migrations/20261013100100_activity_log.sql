-- Histórico de uso por marmitaria, para a Shogun dar suporte e acompanhar quem usa o sistema:
-- quando entrou, que telas abriu e o que alterou (preço de insumo, ficha, preço de venda, custos...).
-- Só o admin Shogun lê. As alterações de dados são registradas pelo BANCO (gatilhos), então nenhuma tela ou ação
-- nova deixa de aparecer; entradas e telas abertas vêm do app.
create table public.activity_log (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizations (id) on delete cascade,
  user_id uuid,
  -- a ação foi de um admin Shogun (ex.: usando "ver como marmitaria")?
  by_admin boolean not null default false,
  kind text not null check (kind in ('login', 'view', 'change')),
  summary text not null check (length(summary) between 1 and 300),
  path text check (path is null or length(path) <= 200),
  created_at timestamptz not null default now()
);
create index activity_log_org_created_idx on public.activity_log (org_id, created_at desc);

alter table public.activity_log enable row level security;
create policy activity_log_admin_select on public.activity_log for select to authenticated
  using (private.is_platform_admin());
-- Entradas, telas e (pelo app) importações: quem usa pode registrar o próprio uso, nunca ler nem apagar.
create policy activity_log_insert on public.activity_log for insert to authenticated
  with check (user_id = (select auth.uid()) and (org_id is null or private.is_org_member(org_id)));
revoke update, delete on public.activity_log from authenticated;

-- Dinheiro em texto, do jeito brasileiro: 1234.5 -> "1234,50"
create function private.money_text(n numeric) returns text
language sql immutable parallel safe set search_path = ''
as $$ select replace(to_char(coalesce(n, 0), 'FM9999999990.00'), '.', ',') $$;

-- Gatilho genérico: escreve uma frase em português para cada alteração relevante.
create function private.log_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_org uuid := (coalesce(v_new, v_old) ->> 'org_id')::uuid;
  v_summary text;
  v_recipe text;
  v_ingredient text;
  v_month text;
begin
  -- Ações feitas pelo servidor com chave de serviço (criar cliente, trocar senha) não têm usuário logado.
  if v_uid is null or v_org is null then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'ingredients' then
    if tg_op = 'INSERT' then
      -- importação do catálogo vira uma frase só, escrita pelo app
      if v_new ->> 'template_id' is null then v_summary := 'Cadastrou o insumo "' || (v_new ->> 'name') || '"'; end if;
    elsif tg_op = 'UPDATE' then
      if v_old ->> 'archived_at' is null and v_new ->> 'archived_at' is not null then
        v_summary := 'Arquivou o insumo "' || (v_new ->> 'name') || '"';
      elsif (v_old ->> 'purchase_price') is distinct from (v_new ->> 'purchase_price') then
        v_summary := 'Preço de "' || (v_new ->> 'name') || '": R$ ' || private.money_text((v_old ->> 'purchase_price')::numeric)
                     || ' → R$ ' || private.money_text((v_new ->> 'purchase_price')::numeric);
      elsif (v_old - 'updated_at' - 'price_updated_at') is distinct from (v_new - 'updated_at' - 'price_updated_at') then
        v_summary := 'Editou o insumo "' || (v_new ->> 'name') || '"';
      end if;
    end if;

  elsif tg_table_name = 'recipes' then
    if tg_op = 'INSERT' then
      if v_new ->> 'template_id' is null then v_summary := 'Criou a ficha "' || (v_new ->> 'name') || '"'; end if;
    elsif tg_op = 'UPDATE' then
      if (v_old ->> 'active') = 'true' and (v_new ->> 'active') = 'false' then
        v_summary := 'Arquivou a ficha "' || (v_new ->> 'name') || '"';
      elsif (v_old ->> 'active') = 'false' and (v_new ->> 'active') = 'true' then
        v_summary := 'Restaurou a ficha "' || (v_new ->> 'name') || '"';
      elsif (v_old - 'updated_at') is distinct from (v_new - 'updated_at') then
        v_summary := 'Editou a ficha "' || (v_new ->> 'name') || '"';
      end if;
    end if;

  elsif tg_table_name = 'recipe_items' then
    select name into v_recipe from public.recipes where id = (v_row ->> 'recipe_id')::uuid;
    select name into v_ingredient from public.ingredients where id = (v_row ->> 'ingredient_id')::uuid;
    -- itens de uma ficha criada na mesma operação (importação do catálogo) não viram uma linha cada
    if v_recipe is not null and v_ingredient is not null
       and not (tg_op = 'INSERT' and exists (select 1 from public.recipes r where r.id = (v_row ->> 'recipe_id')::uuid and r.created_at = now())) then
      if tg_op = 'INSERT' then
        v_summary := 'Adicionou "' || v_ingredient || '" à ficha "' || v_recipe || '"';
      elsif tg_op = 'DELETE' then
        v_summary := 'Removeu "' || v_ingredient || '" da ficha "' || v_recipe || '"';
      elsif (v_old ->> 'net_qty') is distinct from (v_new ->> 'net_qty') then
        v_summary := 'Mudou a quantidade de "' || v_ingredient || '" na ficha "' || v_recipe || '"';
      end if;
    end if;

  elsif tg_table_name = 'recipe_prices' then
    select name into v_recipe from public.recipes where id = (v_row ->> 'recipe_id')::uuid;
    if tg_op = 'INSERT' then
      v_summary := 'Definiu o preço de venda de "' || coalesce(v_recipe, 'um produto') || '": R$ ' || private.money_text((v_new ->> 'current_price')::numeric);
    elsif tg_op = 'UPDATE' and (v_old ->> 'current_price') is distinct from (v_new ->> 'current_price') then
      v_summary := 'Preço de venda de "' || coalesce(v_recipe, 'um produto') || '": R$ ' || private.money_text((v_old ->> 'current_price')::numeric)
                   || ' → R$ ' || private.money_text((v_new ->> 'current_price')::numeric);
    end if;

  elsif tg_table_name = 'fixed_costs' then
    if tg_op = 'INSERT' then
      v_summary := 'Adicionou a conta fixa "' || (v_new ->> 'name') || '" (R$ ' || private.money_text((v_new ->> 'monthly_amount')::numeric) || ' por mês)';
    elsif tg_op = 'DELETE' then
      v_summary := 'Removeu a conta fixa "' || (v_old ->> 'name') || '"';
    elsif (v_old - 'updated_at') is distinct from (v_new - 'updated_at') then
      v_summary := 'Conta fixa "' || (v_new ->> 'name') || '": R$ ' || private.money_text((v_old ->> 'monthly_amount')::numeric)
                   || ' → R$ ' || private.money_text((v_new ->> 'monthly_amount')::numeric);
    end if;

  elsif tg_table_name = 'staff' then
    if tg_op = 'INSERT' then
      v_summary := 'Adicionou à equipe: "' || (v_new ->> 'name') || '"';
    elsif tg_op = 'DELETE' then
      v_summary := 'Removeu da equipe: "' || (v_old ->> 'name') || '"';
    elsif (v_old - 'updated_at') is distinct from (v_new - 'updated_at') then
      v_summary := 'Alterou o pagamento ou a área de "' || (v_new ->> 'name') || '" na equipe';
    end if;

  elsif tg_table_name = 'periods' then
    v_month := to_char((v_row ->> 'month')::date, 'MM/YYYY');
    if tg_op = 'DELETE' then
      v_summary := 'Apagou o fechamento de ' || v_month;
    elsif tg_op = 'INSERT' or (v_old - 'updated_at') is distinct from (v_new - 'updated_at') then
      v_summary := 'Fechamento de ' || v_month || ': faturamento R$ ' || private.money_text((v_new ->> 'revenue')::numeric)
                   || ', compras R$ ' || private.money_text((v_new ->> 'purchases')::numeric);
    end if;

  elsif tg_table_name = 'period_sales' then
    select r.name into v_recipe from public.recipes r where r.id = (v_row ->> 'recipe_id')::uuid;
    select to_char(p.month, 'MM/YYYY') into v_month from public.periods p where p.id = (v_row ->> 'period_id')::uuid;
    if tg_op <> 'DELETE' and (tg_op = 'INSERT' or (v_old ->> 'qty_sold') is distinct from (v_new ->> 'qty_sold')) then
      v_summary := 'Vendas de "' || coalesce(v_recipe, 'um produto') || '" em ' || coalesce(v_month, 'um mês') || ': ' || (v_new ->> 'qty_sold');
    end if;

  elsif tg_table_name = 'unit_settings' then
    if tg_op = 'UPDATE' and (v_old - 'updated_at') is distinct from (v_new - 'updated_at') then
      v_summary := 'Alterou os ajustes de preço (impostos, margens ou despesas)';
    end if;

  elsif tg_table_name = 'sales_channels' then
    if tg_op = 'INSERT' then v_summary := 'Criou o canal de venda "' || (v_new ->> 'name') || '"';
    elsif tg_op = 'DELETE' then v_summary := 'Removeu o canal de venda "' || (v_old ->> 'name') || '"';
    elsif (v_old ->> 'fee_pct') is distinct from (v_new ->> 'fee_pct') or (v_old ->> 'name') is distinct from (v_new ->> 'name') then
      v_summary := 'Alterou o canal de venda "' || (v_new ->> 'name') || '"';
    end if;
  end if;

  if v_summary is not null then
    begin
      insert into public.activity_log (org_id, user_id, by_admin, kind, summary)
      values (v_org, v_uid, private.is_platform_admin(), 'change', left(v_summary, 300));
    exception when foreign_key_violation then
      null; -- a organização está sendo apagada: não há mais onde registrar
    end;
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['ingredients', 'recipes', 'recipe_items', 'recipe_prices', 'fixed_costs', 'staff', 'periods', 'period_sales', 'unit_settings', 'sales_channels']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.log_change()', t || '_activity', t);
  end loop;
end $$;
