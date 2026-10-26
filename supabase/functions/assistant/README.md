# Assistant Edge Function

Claude with two read-only tools (`query_table`, `aggregate`) that run as the signed-in user, so
row-level security decides what it can see. It cannot write, and it is told never to state tax rates.

Deploy:

    supabase functions deploy assistant
    supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
    # optional
    supabase secrets set ASSISTANT_MODEL=claude-sonnet-5-5   # default claude-opus-5-5 (smarter, costs more)
    supabase secrets set ASSISTANT_DAILY_LIMIT=100           # calls per user per day

Then fill `config.js` (project URL, anon key) and set `getAccessToken` when auth is wired in.
Bank details (`bank_account_encrypted`) are blocked from the tools. Not yet tested against a live project.
