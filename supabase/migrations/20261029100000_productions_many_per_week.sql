-- Uma marmitaria pode montar várias produções na mesma semana (cada uma com nome e data).
-- Só relaxa regras e acrescenta colunas: o que já existe continua valendo.
alter table public.production_plans drop constraint production_plans_unit_id_week_start_key;
alter table public.production_plans add column name text check (name is null or length(name) between 1 and 80);
alter table public.production_plans add column planned_for date not null default current_date;
update public.production_plans set planned_for = week_start;
create index production_plans_unit_week_idx on public.production_plans (unit_id, week_start, created_at);
