-- 1) Margem honesta: só se considera "configurado" depois que o dono salva os ajustes de preço uma vez.
--    Enquanto for nulo, a tela mostra a margem como ESTIMATIVA (impostos e despesas ainda zerados).
alter table public.unit_settings add column configured_at timestamptz;

-- 2) Modo da ficha. 'serving' = quantidades de UMA marmita (padrão novo, mais natural para o dono);
--    'batch' = receita em lote que rende N porções (as fichas já existentes continuam assim).
alter table public.recipes
  add column mode text not null default 'batch' check (mode in ('serving', 'batch'));
