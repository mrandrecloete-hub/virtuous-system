/* Live sign-in via Supabase auth. Active only when config.js has a project URL and anon key
   (add ?demo to the address to force the sample-data demo). Replaces the demo login; the rest of
   the app still runs on sample data until each module is connected. */
(function(){
  const cfg=window.VIRTUOSO||{};
  const live=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  if(!live)return;

  const DEMO_USERS=state.users.slice();
  let sb=null,starting=true,msg='';
  const sbReady=()=>!!sb;
  const friendly=m=>/invalid login/i.test(m||'')?'Email or password is incorrect.':/rate|too many/i.test(m||'')?'Too many attempts. Wait a few minutes and try again.':(m||'Could not sign in. Try again.');

  /* Replace the login and password screens (no demo accounts, no demo passwords). */
  authHTML=function(){
    const u=state.user;
    if(u&&u.mustChange)return `<div class="brand">Set a new password<small>${esc(u.name)}, choose your own password to continue.</small></div>
    <form id="pwForm"><label>New password<input id="cpNew" type="password" autocomplete="new-password" required></label>
    <label>Confirm new password<input id="cpConf" type="password" autocomplete="new-password" required></label>
    <div class="note">At least 8 characters, with a number.</div><div class="err" id="cpErr" role="alert"></div>
    <button class="btn" type="submit">Save and continue</button><button class="btn ghost" type="button" data-act="signout">Cancel</button></form>`;
    return `<img class="logo" src="logo.png" alt="Virtuous Accounting Solutions CC System"><div class="brand" style="text-align:center"><small>Sign in with the details your administrator gave you</small></div>
    <form id="loginForm"><label>Email<input id="liEmail" type="email" autocomplete="username" required></label>
    <label>Password<input id="liPass" type="password" autocomplete="current-password" required></label>
    <div class="err" id="liErr" role="alert">${esc(msg)}</div><button class="btn" type="submit">${starting?'Connecting…':'Sign in'}</button></form>
    <p class="note" style="text-align:center">Forgot your password? Ask your administrator to reset it.</p>`;
  };

  /* Honest labelling while modules are still on sample data. */
  const bar=document.createElement('div');
  bar.id='liveBar';bar.setAttribute('role','note');
  bar.style.cssText='display:none;position:sticky;top:0;z-index:12;background:#fff4d6;color:#4a3800;border-bottom:1px solid #e3c870;padding:6px 12px;font-size:13px;text-align:center';
  bar.textContent='Signed in to the live system. Pages other than sign-in still show sample data until they are connected.';
  document.body.prepend(bar);
  const showBar=()=>{bar.style.display=state.user&&!state.user.mustChange?'block':'none'};
  setInterval(showBar,800);

  function userFromProfile(p){
    const u=Object.assign({},{id:p.id,type:p.role==='admin'?'admin':'emp',name:p.name,title:p.title||'',email:p.email,password:null,
      access:p.access_enabled,mustChange:!!p.must_change_password,base:0,allow:0,ot:0,loan:0,ded:0,
      lastSeen:new Date(),lastLogin:new Date(),beat:Date.now()});
    return u;
  }
  async function enter(session){
    const {data:p,error}=await sb.from('profiles').select('*').eq('id',session.user.id).single();
    if(error||!p)throw new Error('Your account is not set up yet. Contact your administrator.');
    if(!p.access_enabled){await sb.auth.signOut();throw new Error('Your access is switched off. Contact your administrator.')}
    const u=userFromProfile(p);
    /* Keep the sample users so pages not yet connected still render their sample data. */
    state.users=[u,...DEMO_USERS];state.data[u.id]={entries:[],leaveBal:DEF_BAL(),leaves:[],loans:[]};
    signIn(u);
    sb.rpc('record_login').then(()=>{},()=>{});
    return u;
  }

  /* Capture-phase handlers run before the demo handlers and stop them. */
  document.addEventListener('submit',async e=>{
    const f=e.target.id;
    if(f!=='loginForm'&&f!=='pwForm')return;
    e.preventDefault();e.stopImmediatePropagation();
    if(f==='loginForm'){
      const err=$('#liErr'),em=$('#liEmail').value.trim().toLowerCase(),pw=$('#liPass').value;
      if(!sbReady()){err.textContent='Still connecting. Try again in a moment.';return}
      err.textContent='';
      const {data,error}=await sb.auth.signInWithPassword({email:em,password:pw});
      if(error){err.textContent=friendly(error.message);return}
      try{const u=await enter(data.session);msg='';render();if(!u.mustChange)toast('Signed in as '+u.name)}
      catch(x){msg=x.message;await sb.auth.signOut().catch(()=>{});state.user=null;paintAuth()}
      return;
    }
    const n=$('#cpNew').value,c=$('#cpConf').value,err=$('#cpErr'),u=state.user;
    if(n.length<8||!/\d/.test(n)){err.textContent='Use at least 8 characters, including a number.';return}
    if(n!==c){err.textContent='The two passwords do not match.';return}
    const {error}=await sb.auth.updateUser({password:n});
    if(error){err.textContent=friendly(error.message);return}
    await sb.rpc('password_changed');
    u.mustChange=false;render();toast('Password saved. Welcome, '+u.name.split(' ')[0]);
  },true);

  /* Sign-out also ends the Supabase session. */
  const demoSignOut=signOut;
  signOut=function(){demoSignOut();if(sb)sb.auth.signOut().catch(()=>{})};

  /* Token for the assistant, and a presence heartbeat. */
  window.VIRTUOSO.getAccessToken=async()=>{if(!sb)return null;const {data}=await sb.auth.getSession();return data.session?data.session.access_token:null};
  setInterval(()=>{if(sb&&state.user)sb.rpc('touch_seen').then(()=>{},()=>{})},60000);

  function start(){
    sb=window.supabase.createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true}});
    window.VIRTUOSO.client=sb;
    sb.auth.getSession().then(async({data})=>{
      starting=false;
      if(data.session){try{await enter(data.session);render();return}catch(x){msg=x.message;await sb.auth.signOut().catch(()=>{})}}
      paintAuth();
    }).catch(()=>{starting=false;msg='Could not reach the server. Check your connection.';paintAuth()});
  }
  paintAuth();
  const s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
  s.onload=start;
  s.onerror=()=>{starting=false;msg='Could not load the sign-in service. Check your connection.';paintAuth()};
  document.head.appendChild(s);
})();
