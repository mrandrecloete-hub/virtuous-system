# Schema draft (state → database)

Derived from the `state` object in `index.html`. Postgres-flavoured, but stack-neutral.
Conventions: `id uuid pk`, `created_at`, `updated_at` on every table. Money is `numeric(14,2)` in NAD. Dates that are months are stored as `date` (first of month).

## Identity and access
| Table | Source in state | Columns / notes |
|---|---|---|
| `users` | `state.users` | name, title, email (unique), role (`admin`/`emp`), access_enabled, must_change_password, last_login_at, last_seen_at. **No password column**: use the auth provider. Demo passwords and `failed`/`logins` are replaced by auth + `login_events`. |
| `login_events` | `state.logins`, `state.failed` | user_id, at, success, ip |
| `pay_profiles` | base, allow, ot, loan, ded on user | user_id, base_salary, allowance, overtime_hours, loan_deduction, other_deduction, effective_from, effective_to. **Effective-dated**, never overwritten. Bank account details live here too (encrypted). |
| `audit_log` | `state.audit` / `logA()` | at, actor_id, action, detail. Append-only: no update or delete grants. |
| `notifications` | `state.notes` | kind, message, to_user_id (null = role broadcast), staff_visible; `notification_reads(notification_id, user_id, read_at)` replaces `readBy`. |

## Time, leave, loans
| Table | Source | Notes |
|---|---|---|
| `clients` | `state.clients` | name, hourly_rate, billable |
| `time_entries` | `data[uid].entries` | user_id, client_id, work_date, task, hours, status (Draft/Submitted/Approved), week_start |
| `leave_balances` | `data[uid].leaveBal` | user_id, leave_type, days, as_of |
| `leave_requests` | `data[uid].leaves` | user_id, type, from, to, days, reason, cover_user_id, status |
| `loans` | `data[uid].loans` | user_id, label, amount, instalment, instalments_paid, status |
| `approvals` | `state.approvals` | Make this a **view or status on the source row**, not a separate copy: timesheet/leave/loan rows carry `status`, `decided_by`, `decided_at`. Avoids the two getting out of sync. |

## Payroll
| Table | Notes |
|---|---|
| `payroll_runs` | period (month), status (Draft/Finalised), finalised_by, finalised_at, signature_file_id. Finalised = **immutable** (enforce with trigger/RLS). |
| `payslips` | run_id, user_id, snapshot of gross, allowances, overtime, deductions, loan, net. Stored, not recomputed, once finalised. |
| `payroll_corrections` | for approvals arriving after finalise (the `flag` logic around line 1130): source ref, amount, target_run_id. |

Non-tax only. No PAYE/SSC columns until verified, effective-dated rules are supplied.

## Petty cash
| Table | Source | Notes |
|---|---|---|
| `petty_months` | `state.pcm[month]` | month (unique), opening_float, locked, locked_by, sheet_file_id |
| `petty_sheet_lines` | `.sheet` | month_id, date, amount, description, vendor |
| `petty_receipts` | `.receipts` | month_id, date, amount, vendor, ref, category, status, file_id |
| `petty_links` / `petty_overrides` | `.links`, `.overrides` | sheet_line_id ↔ receipt_id matches; override reason + actor. Settings `tol` (tolerance) and `thr` (match threshold) go in `app_settings`. |
| `cash_advances` | `state.advances` | user_id, date, amount, purpose, status, spent, returned, expected, diff, settled_at, alerted |

## Stationery
| Table | Source | Notes |
|---|---|---|
| `stationery_items` | `state.stat.items` | name, unit, opening_qty, start_month, low_flag |
| `stationery_moves` | `.moves` | item_id, user_id, type (add/take), qty, note, at |
| `stationery_counts` | `.counts` | month, item_id, counted_qty |
| `app_settings` | `stat.thr`, `tol`, `thr` | key/value |

Stock balance stays derived (as in `stock()`), not stored.

## KYC and staff forms
| Table | Source | Notes |
|---|---|---|
| `forms` | `state.forms` | title, description, category, audience (client/staff), status (open/closed), fields (jsonb) |
| `form_submissions` | `state.subs` | ref (from sequence `kseq`), form_id, submitted_at, answers (jsonb), status, signed, reviewed_by |
| `submission_notes` | `.notes` | submission_id, author, text, at |
| `files` | uploads | storage key, name, size, kind, uploaded_by. Client KYC documents need private storage and signed URLs. |

## Not persisted
UI-only state stays client-side: `user`, `role`, `tab`, `online`, `queue`, `timer*`, `today` (demo clock), `*Msg`, `kyc.view/q/st`, `auditQ`.

## Permission rules to enforce server-side
- Staff read/write only their own time entries, leave, loans, payslips (finalised only), and cash advances.
- Staff may take stationery and create advances for themselves; only admin edits items, counts, settings.
- Admin-only: approvals, payroll, petty cash, clients, KYC review, audit log, user management.
- Public (unauthenticated) write-only access to open client KYC forms, rate-limited. Submissions are never publicly readable.
- Finalised payroll runs and locked petty months reject writes.
- Every write to the above emits an `audit_log` row (do it in the database, not the client).

## Open questions
1. Which stack (Supabase, Base44, other)? Row-level security maps cleanly onto the rules above.
2. Should the two build prompts override anything here? This draft comes only from the existing demo code.
3. Retention and POPIA-style handling for KYC documents (ID copies): where they are stored and for how long.
