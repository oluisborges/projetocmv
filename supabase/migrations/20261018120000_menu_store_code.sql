-- Código da loja no cardápio (o CardápioWeb pede junto da chave de API). É só um identificador, não um segredo:
-- fica na conexão para o painel Shogun mostrar de qual loja são os pedidos.
alter table public.menu_connections add column store_code text check (store_code is null or length(store_code) between 1 and 60);
