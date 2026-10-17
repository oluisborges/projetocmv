-- Última interação de cada marmitaria, para o painel Shogun mostrar sem abrir o histórico de uso.
-- Só conta o que a própria marmitaria fez (by_admin = false): quando a Shogun usa "ver como", isso não é uso do cliente.
-- Roda com a sessão do admin (private.is_platform_admin() usa auth.uid()); para qualquer outra pessoa devolve vazio.
create function public.admin_org_activity()
returns table (org_id uuid, last_activity timestamptz, last_login timestamptz, last_kind text, last_summary text, last_user_id uuid, events_7d bigint)
language sql stable security definer set search_path = ''
as $$
  with e as (
    select a.org_id, a.created_at, a.kind, a.summary, a.user_id
    from public.activity_log a
    where private.is_platform_admin() and a.org_id is not null and not a.by_admin
  ), last_ev as (
    select distinct on (e.org_id) e.org_id, e.created_at, e.kind, e.summary, e.user_id
    from e order by e.org_id, e.created_at desc
  )
  select l.org_id,
         l.created_at,
         (select max(x.created_at) from e x where x.org_id = l.org_id and x.kind = 'login'),
         l.kind,
         l.summary,
         l.user_id,
         (select count(*) from e x where x.org_id = l.org_id and x.created_at > now() - interval '7 days')
  from last_ev l;
$$;

revoke all on function public.admin_org_activity() from public, anon;
grant execute on function public.admin_org_activity() to authenticated;
