-- Petty cash scanned documents: tables created in the SQL editor may lack grants,
-- which shows as "permission denied" on upload. RLS (is_admin) still decides who can write.
grant select, insert, update, delete on public.petty_documents to authenticated;
