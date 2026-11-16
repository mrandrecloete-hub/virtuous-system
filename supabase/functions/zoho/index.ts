// Zoho Projects connector: lets each signed-in person connect THEIR OWN Zoho account (OAuth 2.0, authorization code) and
// reads the tasks assigned to them ("My tasks") so the app can show them on the dashboard. READ-ONLY: it never creates or
// changes anything in Zoho. Refresh tokens stay in the zoho_connections table (service role only) and are never sent to the
// browser. Secrets (set with `supabase secrets set`, never in the repo or the browser):
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET            from the Zoho API Console (Server-based Application)
//   ZOHO_DC            optional, default "com"    (com, eu, in, com.au, jp, ca, sa)
//   ZOHO_SCOPES        optional                   default below
// The redirect URI to register in the Zoho API Console is   <SUPABASE_URL>/functions/v1/zoho
// Deploy: supabase functions deploy zoho --no-verify-jwt     (the browser calls send the user's JWT, checked inside)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const html = (title: string, body: string, s = 200) =>
  new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{font-family:system-ui,sans-serif;background:#0a1d5c;color:#0b1a44;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px}.c{background:#d6e6ff;border-radius:16px;padding:24px;max-width:440px;box-shadow:0 20px 50px rgba(0,0,0,.4)}h1{font-size:20px;margin:0 0 8px}a{display:inline-block;margin-top:14px;background:#0b3fae;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none}</style></head><body><div class="c"><h1>${esc(title)}</h1>${body}</div></body></html>`,
    { status: s, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const DCS: Record<string, { accounts: string; api: string; web: string }> = {
  "com": { accounts: "https://accounts.zoho.com", api: "https://projectsapi.zoho.com", web: "https://projects.zoho.com" },
  "eu": { accounts: "https://accounts.zoho.eu", api: "https://projectsapi.zoho.eu", web: "https://projects.zoho.eu" },
  "in": { accounts: "https://accounts.zoho.in", api: "https://projectsapi.zoho.in", web: "https://projects.zoho.in" },
  "com.au": { accounts: "https://accounts.zoho.com.au", api: "https://projectsapi.zoho.com.au", web: "https://projects.zoho.com.au" },
  "jp": { accounts: "https://accounts.zoho.jp", api: "https://projectsapi.zoho.jp", web: "https://projects.zoho.jp" },
  "ca": { accounts: "https://accounts.zohocloud.ca", api: "https://projectsapi.zohocloud.ca", web: "https://projects.zohocloud.ca" },
  "sa": { accounts: "https://accounts.zoho.sa", api: "https://projectsapi.zoho.sa", web: "https://projects.zoho.sa" },
};
const DEFAULT_SCOPES = "ZohoProjects.portals.READ,ZohoProjects.projects.READ,ZohoProjects.tasks.READ";
const CACHE_SECONDS = 60, MAX_TASKS = 300;

const env = (k: string) => Deno.env.get(k) ?? "";
const cfg = () => {
  const dc = DCS[env("ZOHO_DC") || "com"] ? (env("ZOHO_DC") || "com") : "com";
  return { id: env("ZOHO_CLIENT_ID"), secret: env("ZOHO_CLIENT_SECRET"), dc: DCS[dc], dcName: dc, scopes: env("ZOHO_SCOPES") || DEFAULT_SCOPES, redirect: env("SUPABASE_URL").replace(/\/+$/, "") + "/functions/v1/zoho" };
};
const configured = () => { const c = cfg(); return !!(c.id && c.secret); };

type DB = ReturnType<typeof createClient>;
const service = (): DB => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });

// ---------- helpers that talk to Zoho ----------
async function zform(url: string, params: Record<string, string>) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString() });
  let b: any = {}; try { b = await r.json(); } catch { /* not json */ }
  return { ok: r.ok && !b.error, status: r.status, body: b };
}
async function zget(url: string, token: string) {
  const r = await fetch(url, { headers: { Authorization: "Zoho-oauthtoken " + token, Accept: "application/json" } });
  let b: any = null; try { b = await r.json(); } catch { /* empty */ }
  return { ok: r.ok, status: r.status, body: b };
}
async function accessToken(db: DB, row: any, force = false): Promise<{ token?: string; reauth?: boolean; error?: string }> {
  const c = cfg();
  if (!force && row.access_token && row.access_expires_at && new Date(row.access_expires_at).getTime() - Date.now() > 120_000) return { token: row.access_token };
  const r = await zform(c.dc.accounts + "/oauth/v2/token", { refresh_token: row.refresh_token, client_id: c.id, client_secret: c.secret, grant_type: "refresh_token" });
  if (!r.ok || !r.body.access_token) {
    const code = String(r.body?.error ?? "");
    if (/invalid_code|invalid_token|invalid_client_secret|access_denied/i.test(code)) return { reauth: true };
    return { error: "Zoho did not give an access token (" + (code || r.status) + ")." };
  }
  const expires = new Date(Date.now() + (Number(r.body.expires_in) || 3600) * 1000).toISOString();
  await db.from("zoho_connections").update({ access_token: r.body.access_token, access_expires_at: expires }).eq("user_id", row.user_id);
  row.access_token = r.body.access_token; row.access_expires_at = expires;
  return { token: r.body.access_token };
}
const arr = (b: any, ...keys: string[]) => { for (const k of keys) if (Array.isArray(b?.[k])) return b[k]; return Array.isArray(b) ? b : []; };

async function listPortals(token: string) {
  const c = cfg();
  for (const path of ["/api/v3/portals", "/restapi/portals/"]) {   // newer API first, older as a fallback
    const r = await zget(c.dc.api + path, token);
    if (r.status === 401) return { unauthorized: true, portals: [] as any[] };
    if (r.ok) {
      const ps = arr(r.body, "portals").map((p: any) => ({ id: String(p.id_string ?? p.id ?? ""), name: String(p.name ?? p.portal_name ?? ""), url: String(p.link?.self?.url ?? "") ,  slug: String(p.portal_name ?? p.name ?? "") })).filter((p) => p.id);
      if (ps.length) return { portals: ps };
    }
  }
  return { portals: [] as any[] };
}
async function myTasks(token: string, portal: { id: string; name: string; slug: string }) {
  const c = cfg(); const out: any[] = []; let unauthorized = false, failed = false;
  for (const base of [`/api/v3/portal/${portal.id}/mytasks`, `/restapi/portal/${portal.id}/mytasks/`]) {
    let got = false;
    for (let index = 1; index <= 3; index++) {                       // up to 3 pages of 100
      const r = await zget(`${c.dc.api}${base}?index=${index === 1 ? 1 : (index - 1) * 100 + 1}&range=100`, token);
      if (r.status === 401) { unauthorized = true; break; }
      if (!r.ok) break;
      got = true;
      const page = arr(r.body, "tasks");
      for (const t of page) out.push(t);
      if (page.length < 100) break;
    }
    if (unauthorized) break;
    if (got) { failed = false; break; } else failed = true;
  }
  return { tasks: out.slice(0, MAX_TASKS), unauthorized, failed };
}

// ---------- turning Zoho's answer into a plain task ----------
const isoDate = (v: unknown): string | null => {
  const s = String(v ?? "").trim(); if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})-(\d{2})-(\d{4})/.exec(s); if (m) return `${m[3]}-${m[1]}-${m[2]}`;           // older API: MM-DD-YYYY
  const d = new Date(s); return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
export function normalise(t: any, portal: { id: string; name: string; slug: string }) {
  const id = String(t.id_string ?? t.id ?? "");
  const st = typeof t.status === "object" && t.status ? t.status : { name: t.status };
  const statusName = String(st.name ?? st.status ?? "").slice(0, 60);
  const closed = /complete|closed|done|resolved/i.test(String(st.type ?? statusName)) || t.completed === true || Number(t.percent_complete ?? 0) >= 100;
  const proj = typeof t.project === "object" && t.project ? t.project : { name: t.project_name ?? t.project };
  const projId = String(proj.id_string ?? proj.id ?? t.project_id ?? "");
  const link = t.link?.self?.url ?? t.link?.web?.url ?? t.web_url ?? t.url ?? "";
  const c = cfg();
  const url = /^https:\/\//.test(String(link)) && !/\/restapi\/|\/api\/v3\//.test(String(link)) ? String(link)
    : (projId && id ? `${c.dc.web}/portal/${encodeURIComponent(portal.slug || portal.name)}#taskdetail/${projId}/${id}` : `${c.dc.web}/portal/${encodeURIComponent(portal.slug || portal.name)}`);
  return {
    id, name: String(t.name ?? t.title ?? "(no title)").slice(0, 300), project: String(proj.name ?? "").slice(0, 200), projectId: projId,
    portal: portal.name, portalId: portal.id, status: statusName, closed: !!closed,
    priority: String(t.priority ?? "").slice(0, 30), due: isoDate(t.end_date ?? t.due_date ?? t.end_date_long ?? t.end_date_format), start: isoDate(t.start_date ?? t.start_date_format),
    percent: Math.max(0, Math.min(100, Number(t.percent_complete ?? 0) || 0)), url,
  };
}
const sortTasks = (a: any, b: any) => (a.closed === b.closed ? 0 : a.closed ? 1 : -1) || (a.due && b.due ? a.due.localeCompare(b.due) : a.due ? -1 : b.due ? 1 : 0) || a.name.localeCompare(b.name);

// ---------- the browser's calls ----------
async function who(req: Request): Promise<{ id?: string; error?: Response }> {
  const auth = req.headers.get("Authorization");
  if (!auth) return { error: json({ error: "Sign in first." }, 401) };
  const me = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: auth } } });
  const { data } = await me.auth.getUser();
  if (!data?.user) return { error: json({ error: "Sign in first." }, 401) };
  const { data: prof } = await me.from("profiles").select("access_enabled").eq("id", data.user.id).single();
  if (!prof || !prof.access_enabled) return { error: json({ error: "Your access is switched off." }, 403) };
  return { id: data.user.id };
}
const audit = (db: DB, uid: string, action: string, detail: Record<string, unknown>) =>
  db.from("audit_log").insert({ actor_id: uid, action, table_name: "zoho_connections", row_id: uid, detail }).then(() => {}, () => {});

async function handlePost(req: Request) {
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad request" }, 400); }
  const u = await who(req); if (u.error) return u.error; const uid = u.id!;
  const db = service(); const c = cfg();

  if (b.action === "status") {
    const { data: row } = await db.from("zoho_connections").select("connected_at,last_sync_at,portals").eq("user_id", uid).maybeSingle();
    return json({ configured: configured(), dc: c.dcName, redirect: c.redirect, connected: !!row, connectedAt: row?.connected_at ?? null, lastSync: row?.last_sync_at ?? null, portals: (row?.portals ?? []).map((p: any) => ({ id: p.id, name: p.name })) });
  }
  if (b.action === "start") {
    if (!configured()) return json({ error: "Zoho is not set up yet. An administrator needs to add the Zoho client details first.", setup: true }, 409);
    const state = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    let ret = String(b.return ?? ""); try { const x = new URL(ret); ret = x.protocol === "https:" || x.hostname === "localhost" ? x.origin + x.pathname : ""; } catch { ret = ""; }
    await db.from("zoho_oauth_states").delete().lt("created_at", new Date(Date.now() - 3600_000).toISOString());
    const ins = await db.from("zoho_oauth_states").insert({ state, user_id: uid, return_url: ret || null });
    if (ins.error) return json({ error: "Could not start the connection." }, 500);
    const url = `${c.dc.accounts}/oauth/v2/auth?` + new URLSearchParams({ scope: c.scopes, client_id: c.id, response_type: "code", access_type: "offline", prompt: "consent", redirect_uri: c.redirect, state }).toString();
    return json({ url });
  }
  if (b.action === "disconnect") {
    const { data: row } = await db.from("zoho_connections").select("refresh_token").eq("user_id", uid).maybeSingle();
    if (row) {
      try { await zform(`${c.dc.accounts}/oauth/v2/token/revoke?token=${encodeURIComponent(row.refresh_token)}`, {}); } catch { /* the token is deleted here either way */ }
      await db.from("zoho_connections").delete().eq("user_id", uid); await audit(db, uid, "DELETE", { disconnected: "zoho" });
    }
    return json({ ok: true });
  }
  if (b.action === "tasks") {
    if (!configured()) return json({ error: "Zoho is not set up yet.", setup: true }, 409);
    const { data: row } = await db.from("zoho_connections").select("*").eq("user_id", uid).maybeSingle();
    if (!row) return json({ connected: false, tasks: [] });
    if (!b.force && row.cache && row.cache_at && Date.now() - new Date(row.cache_at).getTime() < CACHE_SECONDS * 1000) return json({ connected: true, ...row.cache, cached: true });
    let at = await accessToken(db, row);
    if (at.reauth) { await db.from("zoho_connections").delete().eq("user_id", uid); return json({ connected: false, reauthorize: true, tasks: [], error: "Your Zoho connection expired. Please connect again." }); }
    if (!at.token) return json({ connected: true, tasks: [], error: at.error }, 502);
    let token = at.token;
    let portals: any[] = Array.isArray(row.portals) ? row.portals : [];
    if (!portals.length || !row.portals_at || Date.now() - new Date(row.portals_at).getTime() > 86400_000) {
      let pr = await listPortals(token);
      if (pr.unauthorized) { at = await accessToken(db, row, true); if (at.token) { token = at.token; pr = await listPortals(token); } }
      if (pr.portals.length) { portals = pr.portals; await db.from("zoho_connections").update({ portals, portals_at: new Date().toISOString() }).eq("user_id", uid); }
    }
    if (!portals.length) return json({ connected: true, tasks: [], portals: [], error: "No Zoho Projects portal was found for your account." });
    const all: any[] = []; const problems: string[] = [];
    for (const p of portals) {
      let r = await myTasks(token, p);
      if (r.unauthorized) { at = await accessToken(db, row, true); if (at.token) { token = at.token; r = await myTasks(token, p); } }
      if (r.failed || r.unauthorized) { problems.push(p.name || p.id); continue; }
      for (const t of r.tasks) all.push(normalise(t, p));
    }
    all.sort(sortTasks);
    const result = { tasks: all.slice(0, MAX_TASKS), portals: portals.map((p: any) => ({ id: p.id, name: p.name })), fetchedAt: new Date().toISOString(), problems };
    await db.from("zoho_connections").update({ cache: result, cache_at: new Date().toISOString(), last_sync_at: new Date().toISOString() }).eq("user_id", uid);
    return json({ connected: true, ...result });
  }
  return json({ error: "unknown action" }, 400);
}

// ---------- Zoho sends the person back here after they approve ----------
async function handleCallback(url: URL) {
  const c = cfg();
  const code = url.searchParams.get("code") ?? "", state = url.searchParams.get("state") ?? "", err = url.searchParams.get("error");
  if (!/^[a-f0-9]{64}$/.test(state)) return html("Link not valid", "<p>This connection link is not valid. Go back to the app and press Connect again.</p>", 400);
  const db = service();
  const { data: st } = await db.from("zoho_oauth_states").select("*").eq("state", state).maybeSingle();
  await db.from("zoho_oauth_states").delete().eq("state", state);                       // single use
  if (!st || Date.now() - new Date(st.created_at).getTime() > 600_000) return html("Link expired", "<p>This connection link expired. Go back to the app and press Connect again.</p>", 400);
  const back = st.return_url ? `<a href="${esc(st.return_url)}">Back to the app</a>` : "";
  if (err || !code) return html("Not connected", `<p>Zoho did not connect (${esc(err || "no code")}). Nothing was changed.</p>${back}`, 400);
  if (!configured()) return html("Not set up", "<p>Zoho is not set up on the server yet.</p>", 500);
  const tok = await zform(c.dc.accounts + "/oauth/v2/token", { code, client_id: c.id, client_secret: c.secret, redirect_uri: c.redirect, grant_type: "authorization_code" });
  if (!tok.ok || !tok.body.refresh_token || !tok.body.access_token) {
    return html("Not connected", `<p>Zoho did not accept the connection (${esc(tok.body?.error || tok.status)}). If this keeps happening, ask your administrator to check the Zoho client details and that this Zoho account is on the ${esc(c.dcName)} data centre.</p>${back}`, 400);
  }
  const expires = new Date(Date.now() + (Number(tok.body.expires_in) || 3600) * 1000).toISOString();
  let portals: any[] = []; try { portals = (await listPortals(tok.body.access_token)).portals; } catch { /* filled in on the first read */ }
  const up = await db.from("zoho_connections").upsert({ user_id: st.user_id, refresh_token: tok.body.refresh_token, access_token: tok.body.access_token, access_expires_at: expires, scope: String(tok.body.scope ?? c.scopes), portals, portals_at: portals.length ? new Date().toISOString() : null, cache: null, cache_at: null, connected_at: new Date().toISOString() });
  if (up.error) return html("Not connected", `<p>The connection could not be saved. Please try again.</p>${back}`, 500);
  await audit(db, st.user_id, "INSERT", { connected: "zoho", portals: portals.length });
  return html("Zoho connected", `<p>Your Zoho Projects account is connected. Your assigned tasks will now appear on your dashboard.</p>${back}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.method === "GET") return await handleCallback(new URL(req.url));
    if (req.method === "POST") return await handlePost(req);
    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    console.error("zoho function", (e as Error)?.message);
    return json({ error: "Something went wrong talking to Zoho. Try again in a moment." }, 500);
  }
});
