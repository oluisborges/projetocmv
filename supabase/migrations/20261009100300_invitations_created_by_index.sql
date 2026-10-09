-- FK sem índice: invitations.created_by (apontado pelo advisor de performance do Supabase).
create index invitations_created_by_idx on public.invitations (created_by);
