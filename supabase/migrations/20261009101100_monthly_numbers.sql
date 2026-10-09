-- Números do mês que o dono conhece de cabeça. Com eles o app calcula sozinho a despesa fixa por marmita,
-- o percentual sobre o faturamento (que alimenta o preço) e o ponto de equilíbrio.
alter table public.unit_settings
  add column monthly_revenue numeric(14, 2) check (monthly_revenue > 0),
  add column monthly_units numeric(10, 0) check (monthly_units > 0);
