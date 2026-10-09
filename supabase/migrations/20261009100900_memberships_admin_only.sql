-- Achado da revisão de segurança: o dono da organização conseguia, chamando a API direto, vincular QUALQUER
-- usuário (ou mudar papéis) na própria organização. Contas e vínculos são criados só pelo admin Shogun.
-- O dono continua podendo REMOVER vínculos da própria organização (policy memberships_delete).
alter policy memberships_insert on public.memberships with check (private.is_platform_admin());
alter policy memberships_update on public.memberships using (private.is_platform_admin()) with check (private.is_platform_admin());
