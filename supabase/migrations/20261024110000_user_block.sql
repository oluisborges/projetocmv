-- Bloqueio de acesso feito pelo admin Shogun. O Auth também recebe o "ban" (não deixa entrar nem renovar a sessão);
-- esta marca fecha o intervalo em que um token ainda válido continuaria lendo/gravando pela API (o RLS passa a recusar).
alter table public.profiles add column blocked_at timestamptz;

create or replace function private.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_platform_admin()
    or exists (
      select 1 from public.memberships m
      join public.profiles p on p.id = m.user_id
      where m.org_id = p_org and m.user_id = (select auth.uid()) and p.blocked_at is null
    );
$$;

create or replace function private.can_write_org(p_org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_platform_admin()
    or exists (
      select 1 from public.memberships m
      join public.profiles p on p.id = m.user_id
      where m.org_id = p_org and m.user_id = (select auth.uid())
        and m.role in ('owner', 'manager') and p.blocked_at is null
    );
$$;

create or replace function private.is_org_owner(p_org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_platform_admin()
    or exists (
      select 1 from public.memberships m
      join public.profiles p on p.id = m.user_id
      where m.org_id = p_org and m.user_id = (select auth.uid()) and m.role = 'owner' and p.blocked_at is null
    );
$$;
