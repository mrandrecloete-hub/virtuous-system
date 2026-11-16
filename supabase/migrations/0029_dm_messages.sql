-- Peer-to-peer Messages: any signed-in person (admin or employee) can chat 1:1 with any other
-- active person, not just with "the admin". Safe to run more than once.
-- A conversation is identified by an unordered pair of people, stored with the smaller uuid in
-- user_lo so there is exactly one thread per pair.
create table if not exists dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_lo uuid not null references profiles(id) on delete cascade,
  user_hi uuid not null references profiles(id) on delete cascade,
  read_lo timestamptz not null default now(),
  read_hi timestamptz not null default now(),
  last_at timestamptz not null default now(),
  last_text text not null default '',
  check (user_lo < user_hi),
  unique (user_lo, user_hi)
);
create table if not exists dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references dm_threads(id) on delete cascade,
  sender_id uuid not null references profiles(id) default auth.uid(),
  sender_name text not null default '',
  body text not null default '' check (char_length(body) <= 4000),
  attachments jsonb not null default '[]',
  reply_to uuid references dm_messages(id) on delete set null,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists dm_messages_thread on dm_messages (thread_id, created_at);
create table if not exists dm_reactions (
  message_id uuid not null references dm_messages(id) on delete cascade,
  user_id uuid not null references profiles(id) default auth.uid(),
  emoji text not null check (char_length(emoji) between 1 and 16),
  primary key (message_id, user_id, emoji)
);
alter table dm_threads enable row level security;
alter table dm_messages enable row level security;
alter table dm_reactions enable row level security;

create or replace function dm_can(t uuid) returns boolean language sql stable security definer set search_path = public as $$
  select is_active() and exists (select 1 from dm_threads x where x.id = t and auth.uid() in (x.user_lo, x.user_hi))
$$;

drop policy if exists dm_threads_read on dm_threads;
create policy dm_threads_read on dm_threads for select using (is_active() and auth.uid() in (user_lo, user_hi));
drop policy if exists dm_messages_read on dm_messages;
create policy dm_messages_read on dm_messages for select using (dm_can(thread_id));
drop policy if exists dm_reactions_read on dm_reactions;
create policy dm_reactions_read on dm_reactions for select
  using (exists (select 1 from dm_messages m where m.id = message_id and dm_can(m.thread_id)));
drop policy if exists dm_reactions_add on dm_reactions;
create policy dm_reactions_add on dm_reactions for insert
  with check (user_id = auth.uid() and exists (select 1 from dm_messages m where m.id = message_id and dm_can(m.thread_id)));
drop policy if exists dm_reactions_del on dm_reactions;
create policy dm_reactions_del on dm_reactions for delete using (user_id = auth.uid());
-- no direct insert/update/delete on threads or messages: everything goes through the functions below

create or replace function dm_ensure_thread(p_other uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); lo uuid; hi uuid; tid uuid;
begin
  if me is null or not is_active() then raise exception 'not permitted'; end if;
  if p_other is null or p_other = me then raise exception 'not permitted'; end if;
  if not exists (select 1 from profiles where id = p_other and access_enabled) then raise exception 'unknown person'; end if;
  if me < p_other then lo := me; hi := p_other; else lo := p_other; hi := me; end if;
  insert into dm_threads (user_lo, user_hi) values (lo, hi) on conflict (user_lo, user_hi) do nothing;
  select id into tid from dm_threads where user_lo = lo and user_hi = hi;
  return tid;
end $$;

create or replace function dm_send(p_other uuid, p_body text, p_attachments jsonb default '[]', p_reply uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); tid uuid; mid uuid; nm text; body text := coalesce(trim(p_body), ''); amLo boolean;
begin
  if me is null or not is_active() then raise exception 'not permitted'; end if;
  if body = '' and jsonb_array_length(coalesce(p_attachments,'[]')) = 0 then raise exception 'empty message'; end if;
  if jsonb_array_length(coalesce(p_attachments,'[]')) > 10 then raise exception 'too many attachments'; end if;
  tid := dm_ensure_thread(p_other);
  if p_reply is not null and not exists (select 1 from dm_messages where id = p_reply and thread_id = tid) then p_reply := null; end if;
  select name into nm from profiles where id = me;
  insert into dm_messages (thread_id, sender_id, sender_name, body, attachments, reply_to)
    values (tid, me, coalesce(nm,''), body, coalesce(p_attachments,'[]'), p_reply) returning id into mid;
  select (user_lo = me) into amLo from dm_threads where id = tid;
  update dm_threads set last_at = now(),
    last_text = left(case when body <> '' then body else 'Attachment' end, 120),
    read_lo = case when amLo then now() else read_lo end,
    read_hi = case when amLo then read_hi else now() end
  where id = tid;
  return mid;
end $$;

create or replace function dm_mark_read(p_thread uuid) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); amLo boolean;
begin
  if not dm_can(p_thread) then raise exception 'not permitted'; end if;
  select (user_lo = me) into amLo from dm_threads where id = p_thread;
  if amLo then update dm_threads set read_lo = now() where id = p_thread;
  else update dm_threads set read_hi = now() where id = p_thread; end if;
end $$;

create or replace function dm_delete_message(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update dm_messages set deleted = true, body = '', attachments = '[]'
   where id = p_id and sender_id = auth.uid() and dm_can(thread_id);
end $$;

grant execute on function dm_ensure_thread(uuid), dm_send(uuid,text,jsonb,uuid), dm_mark_read(uuid), dm_delete_message(uuid) to authenticated;

-- private storage for DM attachments, reusing the existing 'chat' bucket under dm/<thread id>/<file>
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='dm_chat_rw') then
    execute $p$create policy dm_chat_rw on storage.objects for all to authenticated
      using (bucket_id = 'chat' and (storage.foldername(name))[1] = 'dm' and dm_can(((storage.foldername(name))[2])::uuid))
      with check (bucket_id = 'chat' and (storage.foldername(name))[1] = 'dm' and dm_can(((storage.foldername(name))[2])::uuid))$p$;
  end if;
end $$;

-- live updates
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table dm_messages; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table dm_threads; exception when duplicate_object then null; end;
  end if;
end $$;

grant select on dm_threads, dm_messages to authenticated;
grant select, insert, delete on dm_reactions to authenticated;

-- Note: this does not migrate history from the old admin-only msg_threads/msg_messages tables
-- (those assumed a single collective "admin" side, which doesn't map cleanly to 1:1 DMs). That
-- old data stays in the database untouched but is no longer shown by the Messages page once
-- live-messages.js switches to the dm_* tables above; new conversations start fresh here.
