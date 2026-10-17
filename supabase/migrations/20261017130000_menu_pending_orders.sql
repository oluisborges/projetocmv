alter table public.menu_connections add column pending_orders integer not null default 0 check (pending_orders >= 0);
-- progresso visível ao dono: pedidos que ainda esperam o detalhe (a fila em si é interna). Atualizado a cada ciclo.
update public.menu_connections c set pending_orders = (select count(*) from public.menu_order_queue q where q.connection_id = c.id and q.state = 'pending');
