-- Cadastro público desligado NO BANCO (vale mesmo que alguém religue "Allow new users to sign up" no painel).
-- Toda conta nova passa pelo GoTrue (papel supabase_auth_admin), tanto no cadastro público quanto na criação pelo painel
-- Shogun. A diferença: o painel grava app_metadata.admin_created = true, e app_metadata só o servidor define.
-- Inserções feitas direto no SQL (papel postgres) continuam permitidas.
create function private.block_public_signup() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user = 'supabase_auth_admin' and coalesce(new.raw_app_meta_data ->> 'admin_created', '') <> 'true' then
    raise exception 'cadastro público desativado: peça a criação da conta à Shogun' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger block_public_signup
  before insert on auth.users
  for each row execute function private.block_public_signup();
