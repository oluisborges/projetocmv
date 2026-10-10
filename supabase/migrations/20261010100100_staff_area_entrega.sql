-- Entrega volta como área da equipe (ao lado de Cozinha, Marketing, Limpeza, Comercial e Outros).
alter table public.staff drop constraint staff_area_check;
alter table public.staff
  add constraint staff_area_check check (area in ('cozinha', 'entrega', 'marketing', 'limpeza', 'comercial', 'outros'));
