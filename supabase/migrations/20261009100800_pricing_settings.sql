-- Despesas fixas rateadas (% do faturamento). Na Fase 5 passa a ser calculada a partir dos custos fixos;
-- até lá o dono informa o percentual à mão.
alter table public.unit_settings
  add column fixed_expense_pct numeric(5, 4) not null default 0
  check (fixed_expense_pct >= 0 and fixed_expense_pct < 1);

-- Um canal de venda por nome em cada unidade.
create unique index sales_channels_unit_name_uq on public.sales_channels (unit_id, lower(name));
