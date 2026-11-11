/* CLAUDE ACCESS (Settings > Tools > Claude access, administrators only).
   Lets an administrator give Claude (or another MCP client) READ-ONLY access to chosen parts of the app, at the
   administrator's discretion: a master switch, per-access scopes, an expiry (1 to 90 days) and one-click revoke.
   The secret token is made in this browser, shown ONCE, and only its SHA-256 hash is stored (migration 0027,
   ai_access_grants). The Edge Function supabase/functions/claude-access checks the token, scope, expiry and master switch
   on every call. Nothing here ever stores or shows a service key. Live database only: sample mode shows an explanation. */
(function(){
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const isAdm=()=>state.user&&state.user.type==='admin';
  const SC=[
    ['overview','Headline counts','Number of active staff, timesheets and leave waiting for approval, KYC waiting for review, forms.'],
    ['stationery','Stationery and To Buy','The stationery list (quantities, low stock, order list) and the Office Essentials To Buy items.'],
    ['timesheets','Timesheet totals','Hours between two dates, totalled by person, client and approval status. No task notes.'],
    ['leave','Leave','Who is on leave: person, type, dates, days, status. No reasons or medical notes.'],
    ['kyc','KYC status','Reference, form, status and date of KYC submissions. No answers, ID numbers or files.'],
    ['petty','Petty cash totals','Monthly opening float, sheet and receipt totals and counts. No vendor names or files.']];
  const C={grants:[],log:[],loaded:false,loading:false,enabled:false,msg:'',err:'',busy:false,token:null,uid:null};
  const fmtDT=s=>s?new Date(s).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Never';
  const endpoint=()=>String(cfg.supabaseUrl||'').replace(/\/+$/,'')+'/functions/v1/claude-access';
  setInterval(()=>{const u=state.user?state.user.id:null;if(u!==C.uid){C.uid=u;C.loaded=false;C.loading=false;C.token=null;C.grants=[];C.log=[];C.msg='';C.err=''}},700);

  async function load(){
    if(!LIVE||C.loading||C.loaded||!sb())return;
    C.loading=true;
    const [g,l,s]=await Promise.all([
      sb().from('ai_access_grants').select('id,label,token_hint,scopes,expires_at,revoked_at,last_used_at,use_count,created_at').order('created_at',{ascending:false}).limit(50),
      sb().from('ai_access_log').select('grant_id,at,tool,ok').order('at',{ascending:false}).limit(25),
      sb().from('app_settings').select('value').eq('key','claude_access')]);
    C.loading=false;C.loaded=true;
    if(g.error){C.err=/does not exist|schema cache|permission/i.test(g.error.message||'')?'Claude access needs database migration 0027. Run it in the Supabase SQL editor, then reload.':'Could not load: '+g.error.message}
    else{C.err='';C.grants=g.data||[];C.log=l.error?[]:(l.data||[]);C.enabled=!!(s.data&&s.data[0]&&s.data[0].value&&s.data[0].value.enabled===true)}
    if(state.tab&&state.tab[state.role]==='settings')render();
  }
  function newToken(){
    const A='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';let s='vxa_';
    const r=crypto.getRandomValues(new Uint8Array(48));let i=0;while(s.length<44){if(r[i]<248)s+=A[r[i]%62];i++;if(i>=r.length)return newToken()}
    return s;
  }
  const sha=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const status=g=>g.revoked_at?['Removed','']:new Date(g.expires_at)<=new Date()?['Expired','']:['Active','on'];

  const css=document.createElement('style');
  css.textContent=`.clw{display:grid;gap:14px}.clw h4{margin:0 0 6px}
  .clsc{display:grid;gap:6px}.clsc label{display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface);cursor:pointer}
  .clsc input[type=checkbox]{width:18px;min-width:18px;height:18px;min-height:0;margin:2px 0 0;flex:0 0 18px}.clsc label b{display:block}.clsc label span{font-size:12.5px;color:var(--muted)}
  .cltok{background:#0f1b3a;color:#e9f0ff;border-radius:10px;padding:12px;font-family:ui-monospace,Consolas,monospace;font-size:13px;word-break:break-all;user-select:all}
  .clcode{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-family:ui-monospace,Consolas,monospace;font-size:12px;word-break:break-all;margin:4px 0 10px}
  .clpill{font-size:11.5px;border-radius:999px;padding:2px 9px;border:1px solid var(--line);color:var(--muted)}.clpill.on{background:#e3f5e8;color:#1b6b3a;border-color:#b9e2c6}
  .clsw{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:12px;border:1px solid var(--line);border-radius:12px}
  .clsw.on{border-color:#e0a800;background:#fff8e1;color:#4a3900}`;
  document.head.appendChild(css);

  function html(){
    if(!isAdm())return '<div class="panel"><p class="note">Only an administrator can manage Claude access.</p></div>';
    if(!LIVE)return `<div class="panel clw"><h3 style="margin:0">Claude access</h3><p class="note" style="margin:0">This needs the live database (it is not available in sample mode). Once the app is connected: run migration <b>0027_claude_access.sql</b>, deploy the <b>claude-access</b> function, then come back here to switch it on and create an access token.</p></div>`;
    if(!C.loaded){load();return '<div class="panel"><p class="note">Loading…</p></div>'}
    const act=C.grants.filter(g=>status(g)[0]==='Active').length;
    return `<div class="panel clw"><h3 style="margin:0">Claude access</h3>
      <p class="note" style="margin:0">Lets Claude (or another assistant that speaks MCP) <b>read</b> the parts of the app you choose, for example to answer questions about stock, leave or approvals. You decide what, for how long, and can remove it at any time. It can never change anything and never sees passwords, bank details, payroll, ID documents, KYC answers or notes.</p>
      ${C.err?`<div class="err" role="alert">${esc(C.err)}</div>`:''}${C.msg?`<div class="banner ok" role="status">${esc(C.msg)}</div>`:''}
      <div class="clsw ${C.enabled?'on':''}"><div><b>${C.enabled?'Claude access is ON':'Claude access is OFF'}</b><div class="note" style="margin:0">${C.enabled?'Active tokens below can read what you allowed.':'Nothing can be read, whatever tokens exist.'}</div></div><button class="btn ${C.enabled?'ghost':''}" type="button" data-act="clToggle" ${C.busy?'disabled':''}>${C.enabled?'Switch off':'Switch on'}</button></div>
      ${C.token?`<div class="panel" style="border:2px solid #e0a800"><h4>Copy your access token now</h4><p class="note" style="margin:0 0 8px">This is the only time it is shown. If you lose it, remove this access and create a new one. Anyone who has it can read the allowed data until it expires or is removed, so share it only with the assistant you are setting up.</p>
        <div class="cltok" id="clTok">${esc(C.token.v)}</div>
        <div class="stbar"><button class="btn" type="button" data-act="clCopy" data-v="tok">Copy token</button><button class="btn ghost" type="button" data-act="clDone">I have saved it</button></div>
        <h4 style="margin-top:14px">Connect it</h4>
        <p class="note" style="margin:0">Server address:</p><div class="clcode">${esc(endpoint())}</div>
        <p class="note" style="margin:0">Claude Code (or any MCP client that can send a header):</p><div class="clcode">claude mcp add --transport http virtuoso ${esc(endpoint())} --header "Authorization: Bearer ${esc(C.token.v)}"</div>
        <p class="note" style="margin:0">Where only a web address can be entered (less safe, because addresses can end up in logs; use a short expiry):</p><div class="clcode">${esc(endpoint())}?key=${esc(C.token.v)}</div></div>`:''}
      <form id="clForm" class="panel clw" novalidate><h4>Give access</h4>
        <div class="strow"><label class="l" for="clLabel"><b>Name</b><span>So you can recognise it later, for example "Claude on my laptop".</span></label><input id="clLabel" type="text" maxlength="60" autocomplete="off"></div>
        <div><b>What may it read?</b><div class="clsc" style="margin-top:6px">${SC.map(([k,t,d])=>`<label><input type="checkbox" data-cl="sc" value="${k}"><div><b>${t}</b><span>${d}</span></div></label>`).join('')}</div></div>
        <div class="strow"><label class="l" for="clDays"><b>For how long?</b><span>It stops working by itself after this.</span></label><select id="clDays"><option value="1">1 day</option><option value="7" selected>7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></div>
        <div class="err" id="clErr" role="alert"></div>
        <div class="stbar"><button class="btn" type="submit" ${C.busy?'disabled':''}>Create access token</button></div></form>
      <div><h4>Access given (${act} active)</h4>${C.grants.length?`<div class="tbl"><table><thead><tr><th>Name</th><th>Can read</th><th>Token</th><th>Expires</th><th>Last used</th><th>Status</th><th></th></tr></thead><tbody>${C.grants.map(g=>{const [t,on]=status(g);return `<tr><td>${esc(g.label)}</td><td>${(g.scopes||[]).map(s=>esc((SC.find(x=>x[0]===s)||[s,s])[1])).join(', ')}</td><td class="mono">vxa_…${esc(g.token_hint)}</td><td>${esc(fmtDT(g.expires_at))}</td><td>${esc(fmtDT(g.last_used_at))}${g.use_count?' ('+g.use_count+')':''}</td><td><span class="clpill ${on}">${t}</span></td><td>${t==='Active'?`<button class="btn sm ghost" type="button" data-act="clRevoke" data-id="${esc(g.id)}">Remove</button>`:''}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="note" style="margin:0">No access has been given yet.</p>'}</div>
      <div><h4>Recent activity</h4>${C.log.length?`<div class="tbl"><table><thead><tr><th>When</th><th>Access</th><th>Read</th><th>Result</th></tr></thead><tbody>${C.log.map(x=>{const g=C.grants.find(y=>y.id===x.grant_id);return `<tr><td>${esc(fmtDT(x.at))}</td><td>${esc(g?g.label:'')}</td><td>${esc(x.tool)}</td><td>${x.ok?'Allowed':'Refused or failed'}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="note" style="margin:0">Nothing has been read yet.</p>'}
        <div class="stbar"><button class="btn sm ghost" type="button" data-act="clRefresh">Refresh</button></div></div>
      <p class="note" style="margin:0">Set up once: run migration <b>0027_claude_access.sql</b> and deploy the function with <b>supabase functions deploy claude-access --no-verify-jwt</b>. Creating and removing access is recorded in the audit log. Text in your app (such as item names) is passed to Claude as data, so only connect assistants you trust.</p></div>`;
  }
  window.VIRTUOSO_CLAUDE={html};

  document.addEventListener('submit',async e=>{
    const f=e.target;if(!f||f.id!=='clForm')return;e.preventDefault();e.stopImmediatePropagation();
    const err=$('#clErr'),say=m=>{if(err)err.textContent=m};
    if(!isAdm()||!LIVE||C.busy)return;
    const label=($('#clLabel').value||'').trim(),scopes=[...document.querySelectorAll('input[data-cl=sc]:checked')].map(x=>x.value),days=+$('#clDays').value;
    if(label.length<1)return say('Give it a name.');
    if(!scopes.length)return say('Choose at least one thing it may read.');
    C.busy=true;say('');
    const tok=newToken(),hash=await sha(tok);
    const r=await sb().rpc('ai_grant_create',{p_label:label,p_scopes:scopes,p_days:days,p_hash:hash,p_hint:tok.slice(-4)});
    C.busy=false;
    if(r.error){C.err='Could not create it: '+r.error.message;C.msg='';render();return}
    C.err='';C.msg='Access created. Copy the token below.';C.token={v:tok};C.loaded=false;C.loading=false;render();
  },true);
  document.addEventListener('click',async e=>{
    const t=e.target.closest&&e.target.closest('[data-act^="cl"],[data-act=stTab]');if(!t)return;
    if(t.dataset.act==='stTab'){C.token=null;C.msg='';return}   /* leaving the tab forgets the token */
    const a=t.dataset.act;if(!['clToggle','clCopy','clDone','clRevoke','clRefresh'].includes(a))return;
    e.stopImmediatePropagation();if(!isAdm()||!LIVE)return;
    if(a==='clRefresh'){C.loaded=false;C.loading=false;return render()}
    if(a==='clDone'){C.token=null;C.msg='';return render()}
    if(a==='clCopy'){try{await navigator.clipboard.writeText(C.token.v);toast('Copied')}catch(x){toast('Select the token and copy it by hand')}return}
    if(a==='clToggle'){
      const on=!C.enabled;
      if(on&&!confirm('Switch Claude access on? Any active token will be able to read the data you allowed for it.'))return;
      C.busy=true;render();
      const r=await sb().from('app_settings').upsert({key:'claude_access',value:{enabled:on}});
      C.busy=false;
      if(r.error)C.err='Could not change it: '+r.error.message;else{C.err='';C.enabled=on;C.msg=on?'Claude access is on.':'Claude access is off.'}
      return render();
    }
    if(a==='clRevoke'){
      if(!confirm('Remove this access now? It stops working immediately.'))return;
      const r=await sb().rpc('ai_grant_revoke',{p_id:t.dataset.id});
      if(r.error)C.err='Could not remove it: '+r.error.message;else{C.err='';C.msg='Access removed.';C.loaded=false;C.loading=false}
      return render();
    }
  },true);
})();
