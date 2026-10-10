-- Limite de tentativas de login feito pelo app (o limite do Supabase conta o IP da Vercel, não o de quem ataca).
-- A tabela só é lida/escrita pelo servidor (service_role); clientes nunca enxergam.
create table public.login_failures (
  id bigint generated always as identity primary key,
  key text not null,
  at timestamptz not null default now()
);
create index login_failures_key_at_idx on public.login_failures (key, at desc);

alter table public.login_failures enable row level security; -- sem policies: negado para todos, exceto service_role
revoke all on public.login_failures from anon, authenticated;

create function public.login_failure_count(p_key text, p_window interval) returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.login_failures where key = p_key and at > now() - p_window;
$$;

create function public.record_login_failure(p_key text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.login_failures (key) values (p_key);
  delete from public.login_failures where at < now() - interval '1 day'; -- mantém a tabela pequena
end;
$$;

create function public.clear_login_failures(p_key text) returns void
language sql security definer set search_path = ''
as $$
  delete from public.login_failures where key = p_key;
$$;

revoke all on function public.login_failure_count(text, interval), public.record_login_failure(text), public.clear_login_failures(text)
  from public, anon, authenticated;
grant execute on function public.login_failure_count(text, interval), public.record_login_failure(text), public.clear_login_failures(text)
  to service_role;

-- Função inofensiva e pública usada pelo cron diário que impede o Supabase gratuito de pausar o projeto por inatividade.
create function public.ping() returns text
language sql stable security invoker set search_path = ''
as $$ select 'ok'::text $$;
revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated, service_role;
