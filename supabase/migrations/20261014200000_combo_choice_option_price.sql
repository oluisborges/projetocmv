-- Grupo de ESCOLHA: cada marmita pode ter o seu próprio preço dentro do combo (combo de 5: sabor A a R$ 20, sabor B a R$ 19).
-- Preço vazio na opção = vale o preço do grupo. A quantidade continua só existindo em grupo fixo.
create or replace function private.check_combo_option() returns trigger
language plpgsql set search_path = ''
as $$
declare v_kind text;
begin
  select kind into v_kind from public.combo_groups where id = new.group_id;
  if v_kind = 'fixed' and (new.qty is null or new.unit_price is null) then
    raise exception 'grupo fixo: informe a quantidade e o preço de cada marmita' using errcode = '23514';
  end if;
  if v_kind = 'choice' and new.qty is not null then
    raise exception 'grupo de escolha: a quantidade fica no grupo, não em cada opção' using errcode = '23514';
  end if;
  return new;
end;
$$;
