-- Monitoramento de erros do próprio sistema (sem serviço externo): cada TIPO de erro vira uma linha com contagem, para a equipe
-- Shogun ver o que está quebrando e quantas vezes. Erros iguais (mesmo "fingerprint") só somam; um erro dado como resolvido
-- reabre sozinho se acontecer de novo. Ninguém logado lê nem escreve nesta tabela: só o servidor (chave de serviço).
create table public.error_events (
  id bigint generated always as identity primary key,
  fingerprint text not null unique,
  source text not null check (source in ('server', 'client', 'sync')),
  message text not null check (length(message) <= 600),
  stack text check (stack is null or length(stack) <= 4000),
  path text check (path is null or length(path) <= 300),
  route_type text check (route_type is null or length(route_type) <= 40),
  -- marmitaria envolvida, quando se sabe (erros de sincronização do cardápio)
  org_id uuid references public.organizations (id) on delete set null,
  count integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  resolved_at timestamptz
);
create index error_events_org_id_idx on public.error_events (org_id) where org_id is not null;
create index error_events_open_idx on public.error_events (last_seen desc) where resolved_at is null;

alter table public.error_events enable row level security;
-- nenhuma policy: só o service role (servidor) lê e escreve
revoke all on public.error_events from anon, authenticated;

create function public.log_error(p_fingerprint text, p_source text, p_message text, p_stack text, p_path text, p_route_type text, p_org_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.error_events (fingerprint, source, message, stack, path, route_type, org_id)
  values (p_fingerprint, p_source, left(p_message, 600), left(p_stack, 4000), left(p_path, 300), left(p_route_type, 40), p_org_id)
  on conflict (fingerprint) do update
    set count = public.error_events.count + 1,
        last_seen = now(),
        resolved_at = null,
        stack = coalesce(excluded.stack, public.error_events.stack),
        org_id = coalesce(excluded.org_id, public.error_events.org_id);
$$;
revoke all on function public.log_error(text, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.log_error(text, text, text, text, text, text, uuid) to service_role;
