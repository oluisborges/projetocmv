-- 1) Dono não remove outro dono nem a si mesmo (deixaria a organização sem dono). Admin Shogun remove qualquer um.
alter policy memberships_delete on public.memberships
  using (
    private.is_platform_admin()
    or (private.is_org_owner(org_id) and role <> 'owner' and user_id <> (select auth.uid()))
  );

-- 2) Unidades: só dono (ou admin) cria e altera, e o cliente não escreve created_at
--    (a "unidade ativa" é a mais antiga: data forjada trocaria a unidade mostrada ao dono).
alter policy units_insert on public.units with check (private.is_org_owner(org_id));
alter policy units_update on public.units using (private.is_org_owner(org_id)) with check (private.is_org_owner(org_id));
revoke insert, update on public.units from authenticated;
grant insert (org_id, name, city), update (name, city) on public.units to authenticated;
