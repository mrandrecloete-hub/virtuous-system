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
- `supabase/migrations/` 0001-0007: schema, RLS, audit, payroll lock, storage, assistant usage cap. Tested locally on Postgres with stubbed auth only.
- `supabase/functions/assistant/`: read-only AI assistant (Edge Function). Panel in `assistant.js`, config in `config.js`. Needs `ANTHROPIC_API_KEY` as a Supabase secret, never in front-end files.
- Front end still runs on demo `state`; wiring modules to Supabase is not done.

## Next step
Replace the demo state with a real backend and database (see the build prompts the owner has: the master build prompt and the synchronization prompt). Keep server-side permissions, payroll locking, audit log.
