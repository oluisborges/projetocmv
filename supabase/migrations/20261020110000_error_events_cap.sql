-- Teto de segurança do monitoramento: depois de 1.000 tipos de erro guardados, não cria tipos novos (os que já existem continuam
-- somando). Impede que texto livre vindo do navegador encha a tabela. Quem dá baixa nos erros (e a limpeza de 30 dias) libera espaço.
create or replace function public.log_error(p_fingerprint text, p_source text, p_message text, p_stack text, p_path text, p_route_type text, p_org_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.error_events where fingerprint = p_fingerprint)
     and (select count(*) from public.error_events) >= 1000 then
    return;
  end if;
  insert into public.error_events (fingerprint, source, message, stack, path, route_type, org_id)
  values (p_fingerprint, p_source, left(p_message, 600), left(p_stack, 4000), left(p_path, 300), left(p_route_type, 40), p_org_id)
  on conflict (fingerprint) do update
    set count = public.error_events.count + 1,
        last_seen = now(),
        resolved_at = null,
        stack = coalesce(excluded.stack, public.error_events.stack),
        org_id = coalesce(excluded.org_id, public.error_events.org_id);
end;
$$;
revoke all on function public.log_error(text, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.log_error(text, text, text, text, text, text, uuid) to service_role;
