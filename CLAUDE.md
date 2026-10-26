# Virtuoso System (Virtuous Accounting Solutions CC)

Single-file demo app: `index.html` (vanilla JS, no build step). PWA files: `manifest.webmanifest`, `sw.js`, icons. Hosted with GitHub Pages from `main` (push to deploy): https://mrandrecloete-hub.github.io/virtuous-system/

## Facts
- Namibia, NAD, financial year March to February (FY2027 = Mar 2026 to Feb 2027).
- Demo data only, held in one `state` object; resets on reload. No backend yet.
- Demo logins: admin@firm.example / Admin#2026, selma@firm.example / Welcome#1, tobias@firm.example / Welcome#4 (must change password).
- Payroll is non-tax. Do not invent Namibian PAYE/SSC rates; they need verified, effective-dated rules.
- Brand: navy and gold theme, logo files `logo.png` (white background), `logo-dark.png` (transparent, for dark backgrounds). App name "Virtuoso System"; company name stays "Virtuous Accounting Solutions CC".

## Code layout (inside index.html)
- State and data near the top of the script; `VIEWS` map picks the page; `render()` rewrites `#view`; delegated click/submit/change/input handlers.
- Modules: dashboard, employees, timesheets, clients and billing, leave, loans, payroll and payslips, wet signature, petty cash (receipts, sheets, reconcile), stationery, cash taken, KYC forms builder, staff requests, reports, audit log, alerts.
- Excel upload uses SheetJS from cdnjs.

## Backend (in progress)
- `supabase/migrations/` 0001-0008: schema, RLS, audit, payroll lock, storage, assistant usage cap. Tested locally on Postgres with stubbed auth only.
- Assistant: `assistant.js` (panel) + `assistant-engine.js` (built-in keyword brain, no AI service or key; reads live data through RLS, or sample data in `?demo`). `supabase/functions/assistant/` is an optional AI version (needs `ANTHROPIC_API_KEY` as a Supabase secret) and is currently not used by the panel.
- `auth.js`: live Supabase sign-in (replaces demo login when `config.js` is filled; `?demo` forces the sample-data demo). Tested only against a fake Supabase in a browser. `live-employees.js` + `supabase/functions/admin-users/`: live Employees screen (invite, reset password, disable) via an admin-only Edge Function; the service-role key is used only there, as an auto-injected secret. `live-time.js`: live Clients & billing, Timesheet and Approvals (timesheets only; billing counts approved hours; no timer or wet-signature in live mode yet). Tested against an in-memory fake DB only. Other modules still run on demo `state` behind a yellow banner; wiring modules to Supabase is not done.

## Next step
Replace the demo state with a real backend and database (see the build prompts the owner has: the master build prompt and the synchronization prompt). Keep server-side permissions, payroll locking, audit log.
