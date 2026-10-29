-- Equipe Shogun: além do admin (profiles.is_platform_admin), o "gestor" só visualiza os clientes que o admin liberar.
-- Cliente de teste: marca em organizations que tira a conta de toda estatística global.
-- Só acrescenta (coluna com padrão, tabela nova, regra de leitura ampliada para quem foi liberado). Nenhum dado muda.

alter table public.profiles add column if not exists staff_role text check (staff_role in ('manager'));
alter table public.organizations add column if not exists is_test boolean not null default false;

create table public.staff_org_access (
  user_id uuid not null references public.profiles (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);
create index staff_org_access_org_idx on public.staff_org_access (org_id);

alter table public.staff_org_access enable row level security;
-- Cada gestor vê as próprias liberações; o admin vê todas. Quem grava é o servidor (chave de serviço), nunca o navegador.
create policy staff_org_access_select on public.staff_org_access for select to authenticated
  using (user_id = (select auth.uid()) or private.is_platform_admin());

-- Quem foi liberado enxerga a marmitaria (leitura). Escrever continua exigindo ser membro ou admin (can_write_org não muda).
create or replace function private.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_platform_admin()
    or exists (
      select 1 from public.memberships m
      where m.org_id = p_org and m.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.staff_org_access s
      where s.org_id = p_org and s.user_id = (select auth.uid())
    );
$$;
