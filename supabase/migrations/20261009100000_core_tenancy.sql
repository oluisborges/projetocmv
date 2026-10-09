-- Núcleo multi-tenant: perfis, organizações, membros, unidades, convites e helpers de RLS.
-- Regra do projeto: toda tabela de negócio tem org_id, RLS ligada e índice em org_id.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Nenhum acesso anônimo às tabelas do app (o app exige login em tudo).
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  city text,
  created_at timestamptz not null default now(),
  unique (id, org_id) -- permite FK composta (unit_id, org_id) nas tabelas de operação
);
create index units_org_id_idx on public.units (org_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('owner', 'manager', 'viewer')),
  token_hash text not null unique, -- sha256 hex do token; o token em si nunca é guardado
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index invitations_org_id_idx on public.invitations (org_id);

-- ---------------------------------------------------------------------------
-- Helpers de RLS (schema private: não é exposto pela API)
-- (select auth.uid()) dentro de funções STABLE permite ao Postgres cachear o valor.
-- ---------------------------------------------------------------------------
create function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select p.is_platform_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create function private.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_platform_admin()
    or exists (
      select 1 from public.memberships m
      where m.org_id = p_org and m.user_id = (select auth.uid())
    );
$$;

-- owner e manager escrevem; viewer só lê.
create function private.can_write_org(p_org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_platform_admin()
    or exists (
      select 1 from public.memberships m
      where m.org_id = p_org and m.user_id = (select auth.uid())
        and m.role in ('owner', 'manager')
    );
$$;

create function private.is_org_owner(p_org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_platform_admin()
    or exists (
      select 1 from public.memberships m
      where m.org_id = p_org and m.user_id = (select auth.uid()) and m.role = 'owner'
    );
$$;

revoke all on function private.is_platform_admin(), private.is_org_member(uuid),
  private.can_write_org(uuid), private.is_org_owner(uuid) from public;
grant execute on function private.is_platform_admin(), private.is_org_member(uuid),
  private.can_write_org(uuid), private.is_org_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Perfil criado automaticamente para cada novo usuário do Auth
-- ---------------------------------------------------------------------------
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.units enable row level security;
alter table public.invitations enable row level security;

-- profiles: cada um vê/edita o próprio; admin vê todos. is_platform_admin NÃO é editável pelo cliente.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_platform_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- organizations: membros leem; só dono/admin editam; só admin Shogun cria/apaga (modelo por convite).
create policy organizations_select on public.organizations for select to authenticated
  using (private.is_org_member(id));
create policy organizations_insert on public.organizations for insert to authenticated
  with check (private.is_platform_admin());
create policy organizations_update on public.organizations for update to authenticated
  using (private.is_org_owner(id)) with check (private.is_org_owner(id));
create policy organizations_delete on public.organizations for delete to authenticated
  using (private.is_platform_admin());

-- memberships: membros veem a equipe; só dono/admin gerenciam.
create policy memberships_select on public.memberships for select to authenticated
  using (private.is_org_member(org_id));
create policy memberships_insert on public.memberships for insert to authenticated
  with check (private.is_org_owner(org_id));
create policy memberships_update on public.memberships for update to authenticated
  using (private.is_org_owner(org_id)) with check (private.is_org_owner(org_id));
create policy memberships_delete on public.memberships for delete to authenticated
  using (private.is_org_owner(org_id));

-- units
create policy units_select on public.units for select to authenticated
  using (private.is_org_member(org_id));
create policy units_insert on public.units for insert to authenticated
  with check (private.can_write_org(org_id));
create policy units_update on public.units for update to authenticated
  using (private.can_write_org(org_id)) with check (private.can_write_org(org_id));
create policy units_delete on public.units for delete to authenticated
  using (private.is_org_owner(org_id));

-- invitations: só dono/admin enxergam e criam. Aceite é feito por função (abaixo).
create policy invitations_select on public.invitations for select to authenticated
  using (private.is_org_owner(org_id));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (private.is_org_owner(org_id));
create policy invitations_delete on public.invitations for delete to authenticated
  using (private.is_org_owner(org_id));

-- ---------------------------------------------------------------------------
-- Aceite de convite: valida token + e-mail do usuário logado e cria o vínculo.
-- ---------------------------------------------------------------------------
create function public.accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
begin
  if (select auth.uid()) is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;

  select * into v_inv
  from public.invitations
  where token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
  for update;

  if not found or v_inv.accepted_at is not null or v_inv.expires_at < now()
     or v_inv.email <> v_email then
    raise exception 'convite inválido ou expirado' using errcode = '22023';
  end if;

  insert into public.memberships (org_id, user_id, role)
  values (v_inv.org_id, (select auth.uid()), v_inv.role)
  on conflict (org_id, user_id) do update set role = excluded.role;

  update public.invitations set accepted_at = now() where id = v_inv.id;
  return v_inv.org_id;
end;
$$;

revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;
