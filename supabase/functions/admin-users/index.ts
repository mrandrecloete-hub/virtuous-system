// Admin user management. The service-role key (injected by Supabase as SUPABASE_SERVICE_ROLE_KEY)
// is used ONLY to create users, set passwords and ban/unban. Every call first proves the caller is
// an active admin using their own JWT. Profile changes run as the caller, so RLS and audit apply.
// Deploy: supabase functions deploy admin-users
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

function tempPassword(): string {
  const L = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
  const r = crypto.getRandomValues(new Uint32Array(10));
  let p = "";
  for (let i = 0; i < 8; i++) p += L[r[i] % L.length];
  return p + "#@!%"[r[8] % 4] + (r[9] % 90 + 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "sign in first" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const me = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: who } = await me.auth.getUser();
  if (!who?.user) return json({ error: "sign in first" }, 401);
  const { data: caller } = await me.from("profiles").select("role, access_enabled").eq("id", who.user.id).single();
  if (!caller || caller.role !== "admin" || !caller.access_enabled) return json({ error: "admins only" }, 403);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "bad request" }, 400); }

  if (b.action === "create") {
    const name = String(b.name ?? "").trim(), email = String(b.email ?? "").trim().toLowerCase();
    const title = String(b.title ?? "").trim().slice(0, 80), role = b.role === "admin" ? "admin" : "emp";
    if (name.length < 2 || name.length > 100) return json({ error: "Enter the full name." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
    const password = tempPassword();
    const { data: made, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { name },
    });
    if (error || !made.user) {
      return json({ error: /already|registered/i.test(error?.message ?? "") ? "That email already has an account." : "Could not create the user." }, 400);
    }
    const id = made.user.id;
    // The new-user trigger created a staff profile. Finish it as the calling admin.
    const up = await me.from("profiles").update({ title: title || (role === "admin" ? "Administrator" : "Employee"), must_change_password: true }).eq("id", id);
    const ro = await me.rpc("set_user_access", { p_user: id, p_role: role, p_enabled: b.access !== false });
    if (up.error || ro.error) return json({ error: "User created but the profile could not be completed. Check the Employees list." , id }, 500);
    const base = Number(b.base_salary ?? 0), allow = Number(b.allowance ?? 0);
    if (role === "emp" && (base > 0 || allow > 0) && base >= 0 && allow >= 0) {
      await me.from("pay_profiles").insert({ user_id: id, base_salary: base, allowance: allow, effective_from: new Date().toISOString().slice(0, 10) });
    }
    return json({ id, email, name, temp_password: password });
  }

  if (b.action === "reset_password") {
    const id = String(b.user_id ?? "");
    const password = tempPassword();
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) return json({ error: "Could not reset the password." }, 400);
    await me.from("profiles").update({ must_change_password: true }).eq("id", id);
    return json({ id, temp_password: password });
  }

  if (b.action === "set_access") {
    const id = String(b.user_id ?? ""), enabled = b.enabled === true;
    const { data: target } = await me.from("profiles").select("role").eq("id", id).single();
    if (!target) return json({ error: "User not found." }, 404);
    const ro = await me.rpc("set_user_access", { p_user: id, p_role: target.role, p_enabled: enabled });
    if (ro.error) return json({ error: ro.error.message }, 400);
    // Also ban/unban so existing sessions cannot refresh.
    await admin.auth.admin.updateUserById(id, { ban_duration: enabled ? "none" : "876000h" });
    return json({ id, enabled });
  }

  return json({ error: "unknown action" }, 400);
});
