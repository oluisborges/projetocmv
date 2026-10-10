-- Correção do bloqueio de cadastro público. O GoTrue cria a conta num INSERT com app_metadata só de provedor e aplica
-- app_metadata.admin_created num UPDATE logo depois, na MESMA transação. Conferir no INSERT recusava também as contas do
-- painel Shogun. Agora a conferência é um gatilho ADIADO: roda no commit, quando a linha já está no estado final.

-- 1) O gatilho antigo (BEFORE INSERT) fica neutro, sem precisar ser apagado.
create or replace function private.block_public_signup() returns trigger
language plpgsql set search_path = ''
as $$
begin
  return new;
end;
$$;

-- 2) Conferência no fim da transação.
create function private.enforce_admin_created() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user = 'supabase_auth_admin' and not exists (
       select 1 from auth.users u
       where u.id = new.id and coalesce(u.raw_app_meta_data ->> 'admin_created', '') = 'true'
     ) then
    raise exception 'cadastro público desativado: peça a criação da conta à Shogun' using errcode = '42501';
  end if;
  return null;
end;
$$;

create constraint trigger enforce_admin_created
  after insert on auth.users
  deferrable initially deferred
  for each row execute function private.enforce_admin_created();
