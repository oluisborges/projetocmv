-- Página em que a listagem do histórico parou (cada página leva ~12 s; um ciclo não lista a janela inteira).
alter table public.menu_connections add column if not exists history_page integer not null default 1;
