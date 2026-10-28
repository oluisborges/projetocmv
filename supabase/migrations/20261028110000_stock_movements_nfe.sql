-- Compras vindas de nota fiscal entram no estoque do dia a dia; desfazer a nota (apagar o nfe_import) leva as entradas junto.
alter table public.stock_movements add column nfe_import_id uuid references public.nfe_imports (id) on delete cascade;
create index stock_movements_nfe_idx on public.stock_movements (nfe_import_id) where nfe_import_id is not null;
