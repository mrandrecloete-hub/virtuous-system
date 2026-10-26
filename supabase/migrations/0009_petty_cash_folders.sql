-- Petty cash: server-side settle, taken timestamp, and scanned-document folders.

alter table cash_advances add column taken_at timestamptz not null default now();

-- Staff cannot UPDATE cash_advances directly. Settling goes through this function so the change due
-- and the status are computed on the server and cannot be forged.
create function settle_advance(p_id uuid, p_spent numeric, p_returned numeric) returns void
language plpgsql security definer set search_path = public as $$
declare a cash_advances%rowtype; exp numeric; d numeric; nm text;
begin
  select * into a from cash_advances where id = p_id for update;
  if not found or not (a.user_id = auth.uid() or is_admin()) then raise exception 'not permitted'; end if;
  if a.status <> 'Open' then raise exception 'already settled'; end if;
  if p_spent is null or p_returned is null or p_spent < 0 or p_returned < 0 or p_spent > a.amount then
    raise exception 'invalid amounts';
  end if;
  exp := round(a.amount - p_spent, 2);
  d := round(p_returned - exp, 2);
  update cash_advances set spent = p_spent, returned = p_returned, expected = exp, diff = d,
    status = case when d = 0 then 'Settled' else 'Settled with difference' end, settled_at = now()
  where id = p_id;
  if d <> 0 then
    select name into nm from profiles where id = a.user_id;
    insert into notifications(kind, message, staff_visible)
    values ('Cash', coalesce(nm,'A staff member') || ' settled petty cash with a difference of N$ ' || to_char(d, 'FM999990.00') || '.', false);
  end if;
end $$;
revoke execute on function settle_advance from public, anon;
grant execute on function settle_advance to authenticated;

-- Scanned documents: month x entity x (bank | cash) folders. Files live in the private 'documents'
-- bucket under petty/<YYYY-MM>/<entity>/<kind>/. Admin only (the bucket policy docs_admin covers storage).
create table petty_documents (
  id uuid primary key default gen_random_uuid(),
  month date not null check (extract(day from month) = 1),
  entity text not null check (entity in ('LFT','VIRTUOSO')),
  kind text not null check (kind in ('bank','cash')),
  storage_path text not null unique,
  name text not null, size bigint, mime text,
  uploaded_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index petty_documents_folder on petty_documents (month, entity, kind);
alter table petty_documents enable row level security;
create policy petty_documents_admin on petty_documents for all using (is_admin()) with check (is_admin());
select audit_attach('petty_documents');
