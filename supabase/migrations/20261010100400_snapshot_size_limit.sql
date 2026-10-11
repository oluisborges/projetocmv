-- O histórico do mês é um jsonb escrito pelo app, mas qualquer dono/gerente consegue gravar nessa tabela pela API.
-- Limite de tamanho e de formato para ninguém encher o banco nem quebrar a própria tela de histórico.
alter table public.month_snapshots
  add constraint month_snapshots_data_shape check (pg_column_size(data) < 65536 and (data ->> 'v') in ('1', '2'));
