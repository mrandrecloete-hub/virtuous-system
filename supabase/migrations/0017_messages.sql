-- In-app Messages (two-way chat between the admin(s) and each employee). Safe to run more than once.
-- One conversation ("thread") per employee; every admin sees all threads, an employee sees only their own.
-- "Send to several/all" writes the same message into each employee's own thread (replies stay private).
create table if not exists msg_threads (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references profiles(id) on delete cascade,
  admin_read_at timestamptz not null default now(),
  emp_read_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  last_text text not null default ''
);
create table if not exists msg_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references msg_threads(id) on delete cascade,
  sender_id uuid not null references profiles(id) default auth.uid(),
  sender_name text not null default '',
  from_admin boolean not null default false,
  body text not null default '' check (char_length(body) <= 4000),
  attachments jsonb not null default '[]',
  reply_to uuid references msg_messages(id) on delete set null,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists msg_messages_thread on msg_messages (thread_id, created_at);
create table if not exists msg_reactions (
  message_id uuid not null references msg_messages(id) on delete cascade,
  user_id uuid not null references profiles(id) default auth.uid(),
  emoji text not null check (char_length(emoji) between 1 and 16),
  primary key (message_id, user_id, emoji)
);
alter table msg_threads enable row level security;
alter table msg_messages enable row level security;
alter table msg_reactions enable row level security;

create or replace function msg_can(t uuid) returns boolean language sql stable security definer set search_path = public as $$
  select is_active() and (is_admin() or exists (select 1 from msg_threads x where x.id = t and x.employee_id = auth.uid()))
$$;

drop policy if exists msg_threads_read on msg_threads;
create policy msg_threads_read on msg_threads for select using (msg_can(id));
drop policy if exists msg_messages_read on msg_messages;
create policy msg_messages_read on msg_messages for select using (msg_can(thread_id));
drop policy if exists msg_reactions_read on msg_reactions;
create policy msg_reactions_read on msg_reactions for select
  using (exists (select 1 from msg_messages m where m.id = message_id and msg_can(m.thread_id)));
drop policy if exists msg_reactions_add on msg_reactions;
create policy msg_reactions_add on msg_reactions for insert
  with check (user_id = auth.uid() and exists (select 1 from msg_messages m where m.id = message_id and msg_can(m.thread_id)));
drop policy if exists msg_reactions_del on msg_reactions;
create policy msg_reactions_del on msg_reactions for delete using (user_id = auth.uid());
-- no direct insert/update/delete on threads or messages: everything goes through the functions below

create or replace function send_message(p_employee uuid, p_body text, p_attachments jsonb default '[]', p_reply uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare tid uuid; mid uuid; adm boolean := is_admin(); nm text; body text := coalesce(trim(p_body), '');
begin
  if auth.uid() is null or not is_active() then raise exception 'not permitted'; end if;
  if not adm and p_employee is distinct from auth.uid() then raise exception 'not permitted'; end if;
  if adm and not exists (select 1 from profiles where id = p_employee and access_enabled and role = 'emp') then raise exception 'unknown employee'; end if;
  if body = '' and jsonb_array_length(coalesce(p_attachments,'[]')) = 0 then raise exception 'empty message'; end if;
  if jsonb_array_length(coalesce(p_attachments,'[]')) > 10 then raise exception 'too many attachments'; end if;
  insert into msg_threads (employee_id) values (p_employee) on conflict (employee_id) do nothing;
  select id into tid from msg_threads where employee_id = p_employee;
  if p_reply is not null and not exists (select 1 from msg_messages where id = p_reply and thread_id = tid) then p_reply := null; end if;
  select name into nm from profiles where id = auth.uid();
  insert into msg_messages (thread_id, sender_id, sender_name, from_admin, body, attachments, reply_to)
    values (tid, auth.uid(), coalesce(nm,''), adm, body, coalesce(p_attachments,'[]'), p_reply) returning id into mid;
  update msg_threads set last_at = now(),
    last_text = left(case when body <> '' then body else 'Attachment' end, 120),
    admin_read_at = case when adm then now() else admin_read_at end,
    emp_read_at = case when adm then emp_read_at else now() end
  where id = tid;
  return mid;
end $$;

create or replace function mark_thread_read(p_thread uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not msg_can(p_thread) then raise exception 'not permitted'; end if;
  if is_admin() then update msg_threads set admin_read_at = now() where id = p_thread;
  else update msg_threads set emp_read_at = now() where id = p_thread; end if;
end $$;

create or replace function delete_message(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update msg_messages set deleted = true, body = '', attachments = '[]'
   where id = p_id and (sender_id = auth.uid() or is_admin()) and msg_can(thread_id);
end $$;
create or replace function ensure_thread(p_employee uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if auth.uid() is null or not is_active() then raise exception 'not permitted'; end if;
  if not is_admin() and p_employee is distinct from auth.uid() then raise exception 'not permitted'; end if;
  if not exists (select 1 from profiles where id = p_employee and access_enabled and role = 'emp') then raise exception 'unknown employee'; end if;
  insert into msg_threads (employee_id) values (p_employee) on conflict (employee_id) do nothing;
  select id into tid from msg_threads where employee_id = p_employee;
  return tid;
end $$;
grant execute on function ensure_thread(uuid) to authenticated;
grant execute on function send_message(uuid,text,jsonb,uuid), mark_thread_read(uuid), delete_message(uuid) to authenticated;

-- private storage for chat attachments: <thread id>/<file>
insert into storage.buckets (id, name, public, file_size_limit)
  values ('chat','chat', false, 15728640) on conflict (id) do update set public = false, file_size_limit = 15728640;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='chat_admin') then
    execute $p$create policy chat_admin on storage.objects for all
      using (bucket_id = 'chat' and is_admin()) with check (bucket_id = 'chat' and is_admin())$p$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='chat_emp_read') then
    execute $p$create policy chat_emp_read on storage.objects for select to authenticated
      using (bucket_id = 'chat' and msg_can(((storage.foldername(name))[1])::uuid))$p$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='chat_emp_write') then
    execute $p$create policy chat_emp_write on storage.objects for insert to authenticated
      with check (bucket_id = 'chat' and msg_can(((storage.foldername(name))[1])::uuid))$p$;
  end if;
end $$;

-- live updates
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table msg_messages; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table msg_threads; exception when duplicate_object then null; end;
  end if;
end $$;
