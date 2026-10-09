-- Decisão de produto: contas são criadas pelo admin Shogun (e-mail + senha), sem fluxo de convite.
drop function if exists public.accept_invitation(text);
drop table if exists public.invitations;
