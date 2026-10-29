-- Avisos de novidade (modal): quem marcou "entendi, não mostrar mais". Uma linha por pessoa e por aviso.
-- O aviso vale para a PESSOA logada: o admin Shogun que entra "vendo como" um cliente conta como o admin, nunca como o cliente.
-- Só acrescenta (tabela nova). Não é dado de marmitaria, por isso não tem org_id.

create table public.notice_dismissals (
  user_id uuid not null references public.profiles (id) on delete cascade,
  notice_id text not null check (char_length(notice_id) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (user_id, notice_id)
);

alter table public.notice_dismissals enable row level security;
create policy notice_dismissals_select on public.notice_dismissals for select to authenticated
  using (user_id = (select auth.uid()));
create policy notice_dismissals_insert on public.notice_dismissals for insert to authenticated
  with check (user_id = (select auth.uid()));
revoke update, delete on public.notice_dismissals from authenticated;
