-- Áreas da equipe: Cozinha, Marketing, Limpeza, Comercial e Outros.
-- Quem estava em "embalagem" passa para Cozinha (é trabalho de produção); "entrega" passa para Outros.
alter table public.staff drop constraint staff_area_check;

update public.staff set area = 'cozinha' where area = 'embalagem';
update public.staff set area = 'outros' where area = 'entrega';

alter table public.staff
  add constraint staff_area_check check (area in ('cozinha', 'marketing', 'limpeza', 'comercial', 'outros'));
