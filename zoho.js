/* ZOHO PROJECTS TASKS on the dashboard (every person, administrators and employees).
   Each person connects THEIR OWN Zoho account once (Settings > Zoho tasks > Connect); after that the tasks assigned to them
   in Zoho Projects appear on their dashboard ("My tasks from Zoho") and refresh by themselves. READ-ONLY: this app never
   creates or changes anything in Zoho. The connection is made by the Supabase Edge Function `zoho` (OAuth 2.0); the person's
   Zoho tokens stay on the server and are never sent to the browser; a person only ever sees their own tasks.
   Needs: migration 0032, the `zoho` function deployed, and the Zoho client id and secret set as Supabase secrets by the
   administrator (the Settings tab explains each step). Sample mode (?demo) shows example tasks so the layout can be seen.
   Action prefix `zh`. */
(function(){
  'use strict';
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const me=()=>state.user;
  const isAdm=()=>me()&&me().type==='admin';
  const Z={status:null,tasks:null,portals:[],err:'',busy:false,loadingS:false,loadingT:false,last:0,uid:null,poll:null,more:false,demo:false,msg:''};
  const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const today=()=>iso(new Date());
  const addDays=(s,n)=>{const d=new Date(s+'T00:00:00');d.setDate(d.getDate()+n);return iso(d)};
  const fmtD=s=>s?new Date(s+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'No due date';
  const redirectUri=()=>String(cfg.supabaseUrl||'').replace(/\/+$/,'')+'/functions/v1/zoho';
  const onDash=()=>state.tab&&state.tab[state.role]==='dash';
  const onSet=()=>state.tab&&state.tab[state.role]==='settings';
  const repaint=()=>{if(onDash()||onSet())render()};

  /* ---------- sample data (sample mode only) ---------- */
  const SAMPLE=()=>{const t=today();return [
    {id:'s1',name:'File VAT return for the Trust',project:'Compliance 2026',portal:'Sample portal',status:'Open',priority:'High',due:addDays(t,-2),closed:false,url:'#',percent:0},
    {id:'s2',name:'Prepare annual financial statements',project:'Client audits',portal:'Sample portal',status:'In Progress',priority:'Medium',due:t,closed:false,url:'#',percent:60},
    {id:'s3',name:'Send engagement letters',project:'Client onboarding',portal:'Sample portal',status:'Open',priority:'Low',due:addDays(t,3),closed:false,url:'#',percent:0},
    {id:'s4',name:'Reconcile petty cash for the month',project:'Month end',portal:'Sample portal',status:'Open',priority:'Medium',due:addDays(t,9),closed:false,url:'#',percent:10},
    {id:'s5',name:'Update KYC files',project:'Compliance 2026',portal:'Sample portal',status:'Closed',priority:'Low',due:addDays(t,-6),closed:true,url:'#',percent:100}]};

  /* ---------- talking to the server ---------- */
  async function call(body){
    if(!LIVE)return {};
    if(!sb()||!sb().functions)return {error:'The connection to the server is not ready.'};
    const r=await sb().functions.invoke('zoho',{body});
    if(r.error){let m=r.error.message||'Request failed',j=null;try{j=await r.error.context.json();m=j.error||m}catch(e){}
      return {error:m,setup:j&&j.setup,reauthorize:j&&j.reauthorize,http:true}}
    return r.data||{};
  }
  async function loadStatus(){
    if(!LIVE){Z.status={configured:true,connected:Z.demo,portals:Z.demo?[{id:'1',name:'Sample portal'}]:[]};return}
    if(Z.loadingS||Z.status)return;Z.loadingS=true;
    const r=await call({action:'status'});Z.loadingS=false;
    if(r.error){Z.status={configured:false,connected:false,error:/not found|404|Failed to send/i.test(r.error)?'The Zoho function is not deployed yet.':r.error};}
    else Z.status=r;
    if(Z.status.connected&&!Z.tasks)loadTasks();
    repaint();
  }
  async function loadTasks(force){
    if(!LIVE){Z.tasks=Z.demo?SAMPLE():[];Z.last=Date.now();return}
    if(Z.loadingT)return;Z.loadingT=true;Z.err='';repaint();
    const r=await call({action:'tasks',force:!!force});
    Z.loadingT=false;
    if(r.error&&!r.tasks){Z.err=r.error;if(r.reauthorize){Z.status={...(Z.status||{}),connected:false};Z.tasks=null}}
    else{Z.tasks=r.tasks||[];Z.portals=r.portals||Z.portals;Z.last=Date.now();if(r.problems&&r.problems.length)Z.err='Could not read tasks from: '+r.problems.join(', ');if(r.error)Z.err=r.error;
      if(Z.status){Z.status.connected=r.connected!==false;Z.status.lastSync=r.fetchedAt||Z.status.lastSync}}
    repaint();
  }
  async function connect(){
    if(!LIVE){Z.demo=true;Z.status={configured:true,connected:true,portals:[{id:'1',name:'Sample portal'}]};Z.tasks=SAMPLE();Z.last=Date.now();repaint();return}
    Z.busy=true;Z.msg='';repaint();
    const r=await call({action:'start',return:location.origin+location.pathname});
    Z.busy=false;
    if(r.error||!r.url){Z.err=r.error||'Could not start the connection.';if(r.setup&&Z.status)Z.status.configured=false;repaint();return}
    Z.err='';Z.msg='Zoho opened in a new tab. Approve the connection there, then come back here.';
    const w=window.open(r.url,'_blank');if(!w)location.href=r.url;
    startPoll();repaint();
  }
  function startPoll(){
    clearInterval(Z.poll);let n=0;
    Z.poll=setInterval(async()=>{
      n++;if(n>60||!me()){clearInterval(Z.poll);return}
      const r=await call({action:'status'});
      if(r&&r.connected){clearInterval(Z.poll);Z.status=r;Z.msg='Connected to Zoho.';Z.tasks=null;await loadTasks(true)}
    },3000);
  }
  async function disconnect(){
    if(!confirm('Disconnect your Zoho account? Your tasks will stop showing here. You can connect again at any time.'))return;
    if(!LIVE){Z.demo=false;Z.status={configured:true,connected:false,portals:[]};Z.tasks=null;repaint();return}
    Z.busy=true;repaint();const r=await call({action:'disconnect'});Z.busy=false;
    if(r.error)Z.err=r.error;else{Z.status={...(Z.status||{}),connected:false,portals:[]};Z.tasks=null;Z.err='';Z.msg='Disconnected.'}
    repaint();
  }
  setInterval(()=>{
    const u=me()?me().id:null;
    if(u!==Z.uid){const first=Z.uid===null&&u!==null;Z.uid=u;if(!first){Z.status=null;Z.tasks=null;Z.err='';Z.msg='';Z.last=0;Z.demo=false;clearInterval(Z.poll)}}   /* reset only when the person changes or signs out */
    if(u&&onDash()&&Z.status&&Z.status.connected&&LIVE&&Date.now()-Z.last>300000&&!Z.loadingT)loadTasks(false);   /* refreshes itself every 5 minutes while the dashboard is open */
  },5000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&me()&&Z.status&&!Z.status.connected&&Z.poll){Z.status=null;loadStatus()}});

  /* ---------- the dashboard panel ---------- */
  const css=document.createElement('style');
  css.textContent=`
  .zhp .zhs{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.zhp .zhs .grow{flex:1}
  .zhrow{display:flex;gap:12px;align-items:center;padding:10px 4px;border-top:1px solid var(--line);text-decoration:none;color:var(--fg);min-height:52px}
  .zhrow:first-child{border-top:0}.zhrow:hover{background:var(--accent-soft)}
  .zhrow .due{flex:0 0 78px;text-align:center;font-size:12px;border-radius:8px;padding:4px 6px;border:1px solid var(--line);color:var(--muted)}
  .zhrow .due.over{background:#fde8e8;color:#a11;border-color:#f3b3b3}.zhrow .due.now{background:#fff3cd;color:#7a5a00;border-color:#f0d98a}.zhrow .due.soon{background:#e9f1ff;color:#1c4fb8;border-color:#bcd0f5}
  .zhrow .t{flex:1;min-width:0}.zhrow .t b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.zhrow .t span{font-size:12.5px;color:var(--muted)}
  .zhrow .pill{font-size:11.5px;border:1px solid var(--line);border-radius:999px;padding:2px 9px;color:var(--muted);white-space:nowrap}
  .zhrow .pri{font-size:11.5px;font-weight:700;color:#a11}.zhrow .pri.m{color:#7a5a00}.zhrow .pri.l{color:#2a6b3a}
  .zhcount{display:flex;gap:8px;flex-wrap:wrap}.zhcount span{font-size:12.5px;border-radius:999px;padding:2px 10px;background:var(--accent-soft)}.zhcount .od{background:#fde8e8;color:#a11}
  .zhsteps{display:grid;gap:10px;margin:0;padding-left:20px}.zhcode{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:6px 10px;font-family:ui-monospace,Consolas,monospace;font-size:12.5px;word-break:break-all;margin:4px 0}
  @media (max-width:560px){.zhrow .pill,.zhrow .pri{display:none}.zhrow .due{flex-basis:64px}}`;
  document.head.appendChild(css);

  function rows(list){
    const t=today(),soon=addDays(t,3);
    return list.map(k=>{
      const cls=!k.due?'':k.due<t?'over':k.due===t?'now':k.due<=soon?'soon':'';
      const label=!k.due?'No date':k.due<t?'Overdue':k.due===t?'Today':fmtD(k.due);
      const pr=String(k.priority||'').toLowerCase(),pc=/high|urgent|critical/.test(pr)?'':/med/.test(pr)?'m':'l';
      const href=k.url&&/^https:\/\//.test(k.url)?k.url:'';
      return `<${href?`a href="${esc(href)}" target="_blank" rel="noopener noreferrer"`:'div'} class="zhrow"><span class="due ${cls}" title="${esc(fmtD(k.due))}">${esc(label)}</span><div class="t"><b>${esc(k.name)}</b><span>${esc(k.project||'No project')}${k.portal?' &middot; '+esc(k.portal):''}${k.percent?' &middot; '+k.percent+'%':''}</span></div>${k.priority?`<span class="pri ${pc}">${esc(k.priority)}</span>`:''}${k.status?`<span class="pill">${esc(k.status)}</span>`:''}</${href?'a':'div'}>`}).join('');
  }
  function panel(){
    if(!Z.status&&!Z.loadingS)loadStatus();
    const S=Z.status,head=(extra)=>`<div class="ph"><h3>My tasks from Zoho</h3><div class="zhs">${extra||''}</div></div>`;
    if(!S)return `<div class="panel zhp">${head()}<p class="note" style="margin:0">Loading…</p></div>`;
    if(!S.configured)return `<div class="panel zhp">${head()}<p class="note" style="margin:0">${isAdm()?'Zoho is not set up yet. Open <b>Settings, Zoho tasks</b> and follow the short setup guide. After that, everyone can connect their own Zoho account here.':'Zoho tasks are not set up yet. Ask your administrator to switch them on.'}</p>${S.error?`<p class="note" style="margin:6px 0 0">${esc(S.error)}</p>`:''}${isAdm()?`<div class="zhs" style="margin-top:10px"><button class="btn sm" type="button" data-act="zhGoSet">Open the setup guide</button></div>`:''}</div>`;
    if(!S.connected)return `<div class="panel zhp">${head()}<p class="note" style="margin:0 0 10px">Connect your Zoho Projects account once and the tasks assigned to you will appear here by themselves. This app only reads your tasks; it never changes anything in Zoho.</p>${Z.err?`<div class="err" role="alert">${esc(Z.err)}</div>`:''}${Z.msg?`<div class="banner ok" role="status">${esc(Z.msg)}</div>`:''}<div class="zhs"><button class="btn" type="button" data-act="zhConnect" ${Z.busy?'disabled':''}>${LIVE?'Connect Zoho':'Show sample tasks'}</button>${LIVE?'':'<span class="note">Sample mode: this only shows example tasks.</span>'}</div></div>`;
    const all=Z.tasks||[],open=all.filter(x=>!x.closed),t=today(),over=open.filter(x=>x.due&&x.due<t).length,dueToday=open.filter(x=>x.due===t).length;
    const shown=Z.more?open:open.slice(0,8);
    return `<div class="panel zhp">${head(`<button class="btn sm ghost" type="button" data-act="zhRefresh" ${Z.loadingT?'disabled':''}>${Z.loadingT?'Refreshing…':'Refresh'}</button><button class="btn sm ghost" type="button" data-act="zhGoSet">Zoho settings</button>`)}
      ${Z.tasks===null?'<p class="note" style="margin:0">Loading your tasks…</p>':`<div class="zhcount" style="margin-bottom:6px"><span>${open.length} open</span>${over?`<span class="od">${over} overdue</span>`:''}${dueToday?`<span>${dueToday} due today</span>`:''}${!LIVE?'<span>Sample data</span>':''}</div>
      ${shown.length?rows(shown):'<p class="note" style="margin:6px 0 0">Nothing is assigned to you in Zoho right now.</p>'}
      ${open.length>8?`<div class="zhs" style="margin-top:8px"><button class="btn sm ghost" type="button" data-act="zhMore">${Z.more?'Show fewer':'Show all '+open.length}</button></div>`:''}`}
      ${Z.err?`<div class="err" role="alert" style="margin-top:8px">${esc(Z.err)}</div>`:''}
      <p class="note" style="margin:8px 0 0">${LIVE&&Z.last?'Updated '+new Date(Z.last).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})+'. ':''}Tasks come straight from Zoho Projects and refresh every few minutes. Click one to open it in Zoho.</p></div>`;
  }
  /* put the panel at the top of whichever dashboard is showing */
  /* attach after EVERY other script has loaded, so later dashboard modules cannot replace it */
  function attach(){
    if(VIEWS.dash&&VIEWS.dash.__zoho)return;
    const prevDash=VIEWS.dash;
    const wrapped=function(){
      const h=prevDash.apply(this,arguments);
      if(!me()||typeof h!=='string')return h;
      const p=panel(),i=h.indexOf('<div class="dgrid">');
      return i>=0?h.slice(0,i)+p+h.slice(i):h+p;
    };
    wrapped.__zoho=true;VIEWS.dash=wrapped;
  }
  if(document.readyState==='complete')setTimeout(attach,0);else window.addEventListener('load',attach);

  /* ---------- Settings > Zoho tasks ---------- */
  function settingsHTML(){
    if(!Z.status&&!Z.loadingS)loadStatus();
    const S=Z.status||{},ok=S.configured,con=S.connected;
    const pill=(on,t)=>`<span class="pill" style="${on?'background:#e3f5e8;color:#1b6b3a;border-color:#b9e2c6':''}">${t}</span>`;
    return `<div class="panel stsec zhp"><h3 style="margin:0">Zoho tasks</h3>
      <p class="note" style="margin:0">Connect your Zoho Projects account so the tasks assigned to you appear on your dashboard. Only <b>your</b> tasks are read, nothing is changed in Zoho, and you can disconnect at any time.</p>
      ${Z.err?`<div class="err" role="alert">${esc(Z.err)}</div>`:''}${Z.msg?`<div class="banner ok" role="status">${esc(Z.msg)}</div>`:''}
      <dl class="stkv"><dt>Server setup</dt><dd>${!Z.status?'Checking…':ok?pill(true,'Ready'):pill(false,'Not set up')+(S.error?' '+esc(S.error):'')}</dd>
        <dt>Your Zoho account</dt><dd>${!Z.status?'…':con?pill(true,'Connected')+(S.portals&&S.portals.length?' '+esc(S.portals.map(p=>p.name).join(', ')):''):pill(false,'Not connected')}</dd>
        ${con&&S.lastSync?`<dt>Last update</dt><dd>${esc(new Date(S.lastSync).toLocaleString('en-GB'))}</dd>`:''}</dl>
      <div class="stbar">${con?`<button class="btn ghost" type="button" data-act="zhRefresh">Refresh tasks now</button><button class="btn ghost" type="button" data-act="zhDisconnect" ${Z.busy?'disabled':''}>Disconnect Zoho</button>`:`<button class="btn" type="button" data-act="zhConnect" ${Z.busy||(!ok&&LIVE)?'disabled':''}>${LIVE?'Connect Zoho':'Show sample tasks'}</button>`}</div>
      ${!ok&&LIVE&&!isAdm()?'<p class="note" style="margin:0">An administrator needs to finish the one-time setup below before you can connect.</p>':''}</div>
      ${isAdm()?`<div class="panel stsec zhp"><h3 style="margin:0">One-time setup (administrator)</h3>
        <p class="note" style="margin:0">This is done once for the whole firm. <b>Never paste the Zoho client secret into this app or into a chat.</b> It goes into Supabase only.</p>
        <ol class="zhsteps">
          <li>In the <b>Zoho API Console</b> (api-console.zoho.com) choose <b>Add Client, Server-based Applications</b>. Use any name, for example "Virtuoso System".<br>Authorised redirect URI (copy exactly):<div class="zhcode">${esc(redirectUri())}</div><button class="btn sm ghost" type="button" data-act="zhCopy" data-v="${esc(redirectUri())}">Copy the address</button></li>
          <li>Zoho shows a <b>Client ID</b> and a <b>Client Secret</b>. In Supabase open <b>Edge Functions, Secrets</b> and add <b>ZOHO_CLIENT_ID</b> and <b>ZOHO_CLIENT_SECRET</b>. Also add <b>ZOHO_DC</b> with <b>com</b> (your Zoho address ends in .zoho.com; use eu, in, com.au, jp, ca or sa for other regions).</li>
          <li>Run migration <b>0032_zoho.sql</b> in the Supabase SQL editor.</li>
          <li>Deploy the function: <div class="zhcode">supabase functions deploy zoho --no-verify-jwt</div></li>
          <li>Come back to this page. "Server setup" should show <b>Ready</b>. Then everyone, you included, presses <b>Connect Zoho</b> once and approves.</li></ol>
        <p class="note" style="margin:0">Each person's Zoho permissions still apply: they only see tasks Zoho shows them. If Zoho refuses a permission name when connecting, ask the developer to set the <b>ZOHO_SCOPES</b> secret to the scopes shown in the Zoho API documentation.</p></div>`:''}`;
  }
  window.VIRTUOSO_ZOHO={panel,settingsHTML,load:loadStatus,_state:()=>Z};

  document.addEventListener('click',async e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="zh"]');if(!b)return;
    const a=b.dataset.act;if(!['zhConnect','zhRefresh','zhDisconnect','zhMore','zhCopy','zhGoSet'].includes(a))return;
    if(a==='zhGoSet'){e.stopImmediatePropagation();state.tab[state.role]='settings';render();setTimeout(()=>{const t=document.querySelector('[data-act=stTab][data-t=zoho]');if(t)t.click()},60);return}
    e.stopImmediatePropagation();
    if(a==='zhConnect')return connect();
    if(a==='zhRefresh'){Z.last=0;return loadTasks(true)}
    if(a==='zhDisconnect')return disconnect();
    if(a==='zhMore'){Z.more=!Z.more;return render()}
    if(a==='zhCopy'){const v=b.dataset.v;(navigator.clipboard?navigator.clipboard.writeText(v):Promise.reject()).then(()=>toast('Copied'),()=>toast(v))}
  },true);
})();
