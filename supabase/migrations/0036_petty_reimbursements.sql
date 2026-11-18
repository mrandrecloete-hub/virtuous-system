-- Own-funds expenses: an employee paid something with their own money and petty cash pays them back.
-- Any active employee records a claim (and may attach a receipt); admins and people with the 'petty' work function
-- see every claim and mark it Paid out. Safe to run more than once.
create table if not exists petty_reimbursements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  spent_on date not null default current_date,
  description text not null check (char_length(description) between 1 and 200),
  amount numeric(12,2) not null check (amount > 0 and amount < 10000000),
  receipt_path text check (receipt_path is null or receipt_path like 'reimb/%'),
  status text not null default 'Owed' check (status in ('Owed','Paid')),
  paid_at timestamptz,
  paid_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table petty_reimbursements enable row level security;

drop policy if exists reimb_own_read on petty_reimbursements;
create policy reimb_own_read on petty_reimbursements for select using (is_active() and user_id = auth.uid());
drop policy if exists reimb_own_insert on petty_reimbursements;
create policy reimb_own_insert on petty_reimbursements for insert
  with check (is_active() and user_id = auth.uid() and status = 'Owed' and paid_at is null and paid_by is null);
drop policy if exists reimb_own_delete on petty_reimbursements;
create policy reimb_own_delete on petty_reimbursements for delete using (is_active() and user_id = auth.uid() and status = 'Owed');
drop policy if exists reimb_mgr_all on petty_reimbursements;
create policy reimb_mgr_all on petty_reimbursements for all using (has_perm('petty')) with check (has_perm('petty'));

-- Marking paid goes through a function so staff can never change a claim's status directly.
create or replace function petty_reimburse_pay(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_perm('petty') then raise exception 'not allowed'; end if;
  update petty_reimbursements set status = 'Paid', paid_at = now(), paid_by = auth.uid()
   where id = p_id and status = 'Owed';
  if not found then raise exception 'already paid or not found'; end if;
end $$;
revoke all on function petty_reimburse_pay(uuid) from public, anon;
grant execute on function petty_reimburse_pay(uuid) to authenticated;

grant select, insert, delete on public.petty_reimbursements to authenticated;

-- Receipts live in the private 'documents' bucket under reimb/<employee id>/<file>.
drop policy if exists reimb_docs_own on storage.objects;
create policy reimb_docs_own on storage.objects for all to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'reimb' and (storage.foldername(name))[2] = auth.uid()::text and is_active())
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = 'reimb' and (storage.foldername(name))[2] = auth.uid()::text and is_active());
drop policy if exists reimb_docs_mgr on storage.objects;
create policy reimb_docs_mgr on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'reimb' and has_perm('petty'));
