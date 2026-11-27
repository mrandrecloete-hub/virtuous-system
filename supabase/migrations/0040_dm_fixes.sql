-- Deleting a message must also remove its text from the conversation list preview.
-- Safe to run more than once. Needs migration 0029.
create or replace function dm_delete_message(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  update dm_messages set deleted = true, body = '', attachments = '[]'
   where id = p_id and sender_id = auth.uid() and dm_can(thread_id)
   returning thread_id into tid;
  if tid is null then return; end if;
  update dm_threads t set last_text = coalesce((
      select case when m.deleted then 'This message was deleted' when m.body <> '' then left(m.body, 120) else 'Attachment' end
        from dm_messages m where m.thread_id = tid order by m.created_at desc, m.deleted asc limit 1), '')
   where t.id = tid;
end $$;

-- clean up previews left behind by earlier deletions
update dm_threads t set last_text = 'This message was deleted'
 where (select m.deleted from dm_messages m where m.thread_id = t.id order by m.created_at desc limit 1);

grant execute on function dm_delete_message(uuid) to authenticated;

-- Contact list for Messages. Staff may only read their OWN profile row (0001), so the page could not
-- list colleagues for them. This returns just name, title and account type of other active people.
create or replace function dm_contacts() returns table (id uuid, name text, title text, role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name::text, p.title::text, p.role::text from profiles p
   where is_active() and p.access_enabled and p.id <> auth.uid() order by p.name
$$;
revoke execute on function dm_contacts() from public, anon;
grant execute on function dm_contacts() to authenticated;
