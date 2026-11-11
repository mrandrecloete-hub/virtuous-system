/* TEAM page (admin): add team members and generate their sign-in details.
   Live: accounts are created through the admin-users Edge Function (the only place the service key is used); the function
   makes a strong temporary password, shown ONCE here. The person must choose their own password at first sign-in.
   ?demo: works on the sample users in memory. Employees never see this page. */
(function(){
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const isAdm=()=>state.user&&state.user.type==='admin';
  const TM={users:null,loading:false,busy:false,cred:null,msg:'',uid:null,q:''};
  const signInUrl=()=>location.origin+location.pathname.replace(/index\.html$/,'');
  const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  setInterval(()=>{const u=state.user?state.user.id:null;if(u!==TM.uid){TM.uid=u;TM.users=null;TM.cred=null;TM.msg=''}},700);

  async function call(payload){
    const token=await cfg.getAccessToken();
    if(!token)throw new Error('Please sign in again.');
    let r;
    try{r=await fetch(cfg.supabaseUrl.replace(/\/$/,'')+'/functions/v1/admin-users',{method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,apikey:cfg.anonKey},body:JSON.stringify(payload)})}
    catch(x){throw new Error('Could not reach the user service. The Edge Function "admin-users" may not be deployed yet, or you are offline.')}
    const j=await r.json().catch(()=>({}));
    if(r.status===404)throw new Error('The user service is not deployed yet. Deploy the Edge Function "admin-users" in Supabase, then try again.');
    if(!r.ok)throw new Error(j.error||'Something went wrong. Try again.');
    return j;
  }
  async function load(){
    if(TM.loading)return;
    if(!LIVE){TM.users=state.users.map(u=>({id:u.id,name:u.name,title:u.title||'',email:u.email,admin:u.type==='admin',access:!!u.access,must:!!u.mustChange,last:u.lastLogin||null}));return}
    if(!sb())return;
    TM.loading=true;
    const r=await sb().from('profiles').select('id,name,title,email,role,access_enabled,must_change_password,last_login_at').order('name');
    TM.loading=false;
    if(r.error){TM.msg='Could not load the team.';TM.users=[]}
    else TM.users=r.data.map(u=>({id:u.id,name:u.name,title:u.title||'',email:u.email,admin:u.role==='admin',access:!!u.access_enabled,must:!!u.must_change_password,last:u.last_login_at?new Date(u.last_login_at):null}));
    render();
  }
  const reload=()=>{TM.users=null};

  const css=document.createElement('style');
  css.textContent=`
  .tmgrid{display:grid;grid-template-columns:1fr;gap:14px;align-items:start}
  .tmgrid #tmForm{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))!important}.tmgrid #tmForm>.note,.tmgrid #tmForm>.err,.tmgrid #tmForm>div,.tmgrid #tmForm>.chk{grid-column:1/-1}
  .tmcred pre{white-space:pre-wrap;word-break:break-all;user-select:all}
  .tmq{max-width:260px}
  `;
  document.head.appendChild(css);

  function credText(c){
    return 'Virtuoso System (Virtuous Accounting Solutions CC)\nSign in at: '+signInUrl()+'\nEmail: '+c.email+'\nTemporary password: '+c.password+'\n\nYou will be asked to choose your own password when you first sign in.';
  }
  function view(){
    if(!isAdm())return '<h2>Team</h2><div class="panel"><p class="note">Only an administrator can manage the team.</p></div>';
    if(TM.users===null){load();if(TM.users===null)return '<h2>Team</h2><p class="sub">Loading…</p>'}
    const q=TM.q.trim().toLowerCase(),all=TM.users,rows=all.filter(u=>!q||(u.name+' '+u.email+' '+u.title).toLowerCase().includes(q));
    const cr=TM.cred;
    return `<h2>Team</h2><p class="sub">Add people to the team and give them a sign-in. Each person gets their own dashboard with only the pages that suit their role.</p>
    <div class="stack">
    <div class="tiles"><div class="tile"><b>${all.length}</b><span>People in the team</span></div><div class="tile"><b>${all.filter(u=>u.access).length}</b><span>Can sign in</span></div><div class="tile"><b>${all.filter(u=>u.must).length}</b><span>Waiting for first sign-in</span></div></div>
    ${cr?`<div class="cred tmcred"><h3 style="color:var(--ok);margin-top:0">Sign-in details for ${esc(cr.name)}</h3>
      <pre>${esc(credText(cr))}</pre>
      <p class="note" style="margin:8px 0">Shown once. Send it privately. ${esc(cr.name.split(' ')[0])} must choose a new password at first sign-in. If you lose it, use Reset password to make a new one.</p>
      <div class="row"><button class="btn sm" data-act="tmCopy">Copy details</button><a class="btn sm ghost" href="mailto:${encodeURIComponent(cr.email)}?subject=${encodeURIComponent('Your Virtuoso System sign-in')}&body=${encodeURIComponent(credText(cr))}">Email it</a><a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(credText(cr))}">WhatsApp</a><button class="btn sm ghost" data-act="tmPrint">Print slip</button><button class="btn sm ghost" data-act="tmDone">Done</button></div></div>`:''}
    <div class="tmgrid">
    <div class="panel"><h3>Add team member</h3><form class="form" id="tmForm" style="grid-template-columns:1fr" novalidate>
      <label>Full name<input id="tmName" required maxlength="100" autocomplete="off"></label>
      <label>Job title<input id="tmTitle" placeholder="e.g. Tax Consultant" maxlength="80" autocomplete="off"></label>
      <label>Work email<input id="tmEmail" type="email" required maxlength="120" autocomplete="off"></label>
      <label>Account type<select id="tmRole"><option value="emp">Employee (own dashboard, time, leave, requests)</option><option value="admin">Administrator (full access)</option></select></label>
      <label class="chk"><input id="tmAccess" type="checkbox" checked> Can sign in</label>
      <div class="note">A strong temporary password is generated for you. It is shown once, and the person must replace it at first sign-in.</div>
      <div class="err" id="tmErr" role="alert">${esc(TM.msg)}</div>
      <div><button class="btn" type="submit" ${TM.busy?'disabled':''}>Add and generate sign-in</button></div></form></div>
    <div class="panel"><div class="ph"><h3>Everyone</h3><input class="tmq" id="tmQ" type="search" placeholder="Search name or email" value="${esc(TM.q)}" aria-label="Search the team"><button class="btn sm ghost" data-act="tmCopyAll">Copy all emails</button></div>
      <p class="note" style="margin:6px 0 10px">Delete removes the person and frees their email address so it can be used for a new login. If the person already has records (timesheets, receipts, approvals), the account is closed instead: they cannot sign in, the email is freed, and the history stays.</p>
      <div class="tbl"><table style="min-width:640px"><thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead><tbody>
      ${rows.length?rows.map(u=>`<tr><td>${esc(u.name)}<div class="note">${esc(u.title)}</div></td><td class="mono">${esc(u.email)}</td><td>${pill(u.admin?'Admin':'Employee')}</td>
        <td>${pill(u.access?'Can sign in':'Disabled',u.access?'ok':'bad')}${u.must?'<div class="note">Has not set own password yet</div>':''}</td>
        <td class="note">${u.last?fmtDT(u.last):'Never'}</td>
        <td><div class="row"><button class="btn sm ghost" data-act="tmReset" data-id="${esc(u.id)}" ${TM.busy?'disabled':''}>Reset password</button>${u.id===state.user.id?'':`<button class="btn sm ${u.access?'bad':''}" data-act="tmToggle" data-id="${esc(u.id)}" ${TM.busy?'disabled':''}>${u.access?'Disable':'Enable'}</button>`}<button class="btn sm bad" data-act="tmDel" data-id="${esc(u.id)}" ${TM.busy?'disabled':''}>Delete</button></div></td></tr>`).join(''):`<tr><td colspan="6" class="note">${all.length?'Nobody matches that search.':'No team members yet.'}</td></tr>`}
      </tbody></table></div></div></div></div>`;
  }
  VIEWS.team=view;
  window.ICON=window.ICON||{};
  ICON.team='<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M19 20a6 6 0 0 0-3-5.2"/>';
  {const g=NAV.adm.find(x=>x[0]==='People');if(g&&!g[1].some(x=>x[0]==='team'))g[1].unshift(['team','Team'])}

  const lock=on=>document.querySelectorAll('#view button').forEach(b=>{b.disabled=on});
  const showErr=m=>{TM.msg=m;const e=$('#tmErr');if(e)e.textContent=m};
  async function act(fn){
    if(TM.busy)return;TM.busy=true;showErr('');lock(true);
    let ok=false;try{await fn();ok=true}catch(x){showErr(x.message);toast(x.message)}
    TM.busy=false;lock(false);if(ok){TM.msg='';reload();render()}
  }
  function printSlip(c){
    const w=window.open('','_blank');if(!w){toast('Allow pop-ups to print');return}
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Sign-in details</title><style>body{font-family:Arial,sans-serif;margin:40px;max-width:520px}h1{font-size:20px}pre{background:#f3f4f8;padding:14px;border-radius:6px;font-size:15px;white-space:pre-wrap}p{color:#444;font-size:13px}</style></head><body><h1>Virtuoso System sign-in</h1><p>Virtuous Accounting Solutions CC</p><pre>${esc(credText(c))}</pre><p>Keep this private. Destroy this slip after you have signed in and chosen your own password.</p></body></html>`);
    w.document.close();w.focus();setTimeout(()=>w.print(),300);
  }
  document.addEventListener('submit',e=>{
    if(e.target.id!=='tmForm')return;
    e.preventDefault();e.stopImmediatePropagation();
    if(!isAdm()||TM.busy)return;
    const name=$('#tmName').value.trim(),email=$('#tmEmail').value.trim().toLowerCase(),title=$('#tmTitle').value.trim(),role=$('#tmRole').value,access=$('#tmAccess').checked;
    if(name.length<2)return showErr('Enter the full name.');
    if(!EMAIL.test(email))return showErr('Enter a valid email address.');
    if((TM.users||[]).some(u=>u.email.toLowerCase()===email))return showErr('That email already has an account.');
    if(!LIVE){
      const pw=genPw(),id=uid(),u=mk(id,role,name,title||(role==='admin'?'Administrator':'Employee'),email,pw,{access,mustChange:true});
      state.users.push(u);state.data[id]={entries:[],leaveBal:DEF_BAL(),leaves:[],loans:[]};logA('Team member added',name+' ('+role+')');
      TM.cred={name,email,password:pw};reload();toast(name+' added');return render();
    }
    act(async()=>{const j=await call({action:'create',name,email,title,role,access});TM.cred={name:j.name,email:j.email,password:j.temp_password};toast(j.name+' added');window.scrollTo(0,0)});
  },true);
  document.addEventListener('input',e=>{
    if(e.target.id!=='tmQ')return;e.stopImmediatePropagation();
    TM.q=e.target.value;const pos=e.target.selectionStart;render();const n=$('#tmQ');if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(x){}}
  },true);
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="tm"]');if(!b)return;
    e.stopImmediatePropagation();
    const id=b.dataset.id,u=(TM.users||[]).find(x=>x.id===id);
    switch(b.dataset.act){
      case 'tmDone':TM.cred=null;return render();
      case 'tmCopyAll':{const t=(TM.users||[]).map(x=>x.email).join('\n');if(navigator.clipboard)navigator.clipboard.writeText(t).then(()=>toast('Emails copied'),()=>toast('Copy failed'));return}
      case 'tmDel':{if(!u||!isAdm())return;
        const self=u.id===state.user.id,others=(TM.users||[]).filter(x=>x.admin&&x.access&&x.id!==id).length;
        if(u.admin&&u.access&&!others){toast('You cannot remove the only active admin. Make someone else an admin first.');return}
        if(!confirm('Delete '+u.name+' ('+u.email+')?\n\nThe email address will be freed for a new login. If they have records, the account is closed and the history is kept. This cannot be undone.'+(self?'\n\nThis is YOUR account: you will be signed out.':'')))return;
        if(!LIVE){const i=state.users.findIndex(x=>x.id===id);if(i>=0)state.users.splice(i,1);delete state.data[id];logA('Team member deleted',u.name);toast(u.name+' deleted');reload();if(self)return signOut();return render()}
        return act(async()=>{const r=await sb().rpc('admin_remove_user',{p_user:id});
          if(r.error){const m=r.error.message||'';throw new Error(/admin_remove_user/.test(m)&&/not.*found|does not exist|schema cache/i.test(m)?'Run migration 0028 in Supabase first.':m)}
          toast(u.name+(r.data==='closed'?' closed (history kept, email freed)':' deleted'));if(self)setTimeout(()=>signOut(),600)})}
      case 'tmCopy':{const c=TM.cred;if(c&&navigator.clipboard)navigator.clipboard.writeText(credText(c)).then(()=>toast('Copied'),()=>toast('Copy failed'));return}
      case 'tmPrint':if(TM.cred)printSlip(TM.cred);return;
      case 'tmReset':{if(!u||!isAdm())return;if(!confirm('Reset the password for '+u.name+'? Their current password stops working.'))return;
        if(!LIVE){const t=state.users.find(x=>x.id===id),pw=genPw();t.password=pw;t.mustChange=true;logA('Password reset',t.name);TM.cred={name:t.name,email:t.email,password:pw};reload();return render()}
        return act(async()=>{const j=await call({action:'reset_password',user_id:id});TM.cred={name:u.name,email:u.email,password:j.temp_password};window.scrollTo(0,0)})}
      case 'tmToggle':{if(!u||!isAdm())return;
        if(u.access&&!confirm('Disable '+u.name+'? They will be signed out and cannot sign in.'))return;
        if(!LIVE){const t=state.users.find(x=>x.id===id);t.access=!t.access;if(!t.access)t.beat=null;logA(t.access?'Access enabled':'Access disabled',t.name);toast(t.name+(t.access?' can sign in again':' can no longer sign in'));reload();return render()}
        return act(async()=>{await call({action:'set_access',user_id:id,enabled:!u.access});toast(u.name+(u.access?' can no longer sign in':' can sign in again'))})}
    }
  },true);
})();
