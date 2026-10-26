-- Safe to run at any time: makes sure the private 'documents' bucket and its admin policy exist.
-- Use it if file uploads fail with "bucket not found" or "permission denied".
do $$ begin
  if to_regclass('storage.buckets') is null then return; end if;

  insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values ('documents','documents', false, 10485760,
          array['application/pdf','image/jpeg','image/png',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists docs_admin on storage.objects';
  execute $p$create policy docs_admin on storage.objects for all
    using (bucket_id = 'documents' and is_admin()) with check (bucket_id = 'documents' and is_admin())$p$;
  execute 'drop policy if exists docs_own_read on storage.objects';
  execute $p$create policy docs_own_read on storage.objects for select to authenticated
    using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  execute 'drop policy if exists docs_own_write on storage.objects';
  execute $p$create policy docs_own_write on storage.objects for insert to authenticated
    with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
end $$;
