-- Dashboard editor: the admin builds extra cards, tasks, links and pages for each employee's dashboard.
-- Employees can only read their own config, tick their own tasks and mark the update as seen. Safe to run more than once.
create table if not exists dash_configs (
  employee_id uuid primary key references profiles(id) on delete cascade,
  config jsonb not null default '{"blocks":[],"pages":[]}',
  version int not null default 1,
  seen_version int not null default 0,
  change_note text not null default '' check (char_length(change_note) <= 300),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);
create table if not exists dash_task_done (
  employee_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  task_id text not null check (char_length(task_id) <= 60),
  done_at timestamptz not null default now(),
  primary key (employee_id, task_id)
);
alter table dash_configs enable row level security;
alter table dash_task_done enable row level security;
drop policy if exists dash_configs_read on dash_configs;
create policy dash_configs_read on dash_configs for select using (is_active() and (is_admin() or employee_id = auth.uid()));
-- writes only through the functions below
drop policy if exists dash_done_read on dash_task_done;
create policy dash_done_read on dash_task_done for select using (is_active() and (is_admin() or employee_id = auth.uid()));
drop policy if exists dash_done_add on dash_task_done;
create policy dash_done_add on dash_task_done for insert with check (is_active() and employee_id = auth.uid());
drop policy if exists dash_done_del on dash_task_done;
create policy dash_done_del on dash_task_done for delete using (is_active() and employee_id = auth.uid());

create or replace function publish_dashboard(p_employees uuid[], p_config jsonb, p_note text default '')
returns int language plpgsql security definer set search_path = public as $$
declare e uuid; n int := 0;
begin
  if not is_admin() then raise exception 'not permitted'; end if;
  if jsonb_typeof(p_config) <> 'object' or length(p_config::text) > 200000 then raise exception 'invalid config'; end if;
  foreach e in array p_employees loop
    if exists (select 1 from profiles where id = e and role = 'emp') then
      insert into dash_configs (employee_id, config, version, seen_version, change_note, updated_by)
        values (e, p_config, 1, 0, left(coalesce(p_note,''),300), auth.uid())
      on conflict (employee_id) do update set config = excluded.config, version = dash_configs.version + 1,
        change_note = excluded.change_note, updated_at = now(), updated_by = auth.uid();
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
create or replace function dash_mark_seen() returns void language sql security definer set search_path = public as $$
  update dash_configs set seen_version = version where employee_id = auth.uid() and is_active()
$$;
grant execute on function publish_dashboard(uuid[],jsonb,text), dash_mark_seen() to authenticated;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table dash_configs; exception when duplicate_object then null; end;
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_dash_configs' and tgrelid = 'dash_configs'::regclass) then
    perform audit_attach('dash_configs');
  end if;
end $$;

grant select on dash_configs to authenticated;
grant select, insert, delete on dash_task_done to authenticated;
