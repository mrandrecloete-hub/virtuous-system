/* WORK FUNCTIONS: an administrator gives a named employee FULL access to specific admin pages as part of their job, without
   making them an administrator. Pages: any admin-only page (migration 0039): Reports, Team, Employee dashboards, Client KYC, Form builder, Approvals, Activity, Audit log, Receipts, Petty cash sheet, Reconcile, Timesheet (admin view), Statement conversion, Secretarial, Customize. The employee then gets the REAL page
   (a clone of the administrator's, same code, same data) in their menu under "Work functions"; empty pages with the same names
   (added earlier through Employee dashboards) are tucked away. Server side (migration 0033): profiles.perms lists the page keys;
   extra row-level-security policies open only the tables, the saved petty sheets setting and the storage buckets those pages use;
   only an administrator can change perms (RPC set_user_perms, guarded trigger). Nothing else becomes reachable.
   The administrator grants access in People > Employee dashboards > choose the employee > "Pages with full access": pick a page from the drop-down, then confirm "Give full access".
   Sample mode (?demo) keeps the grants in memory. window.VIRTUOSO_PERMS = { has, canPetty, canForms, inject }. Action prefix `px`. */
(function(){
  'use strict';
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const me=()=>state.user;
  const isAdm=()=>me()&&me().type==='admin';
  const GROUP='Work functions';
  const PAGES=[
    {key:'reports',label:'Reports',group:'Overview',note:'Firm-wide reports.'},
    {key:'team',label:'Team',group:'People',note:'The team list, names and job titles. Account type, access, invites and resets stay with administrators.'},
    {key:'dashedit',label:'Employee dashboards',group:'People',note:'Edit and publish employees\' dashboards.'},
    {key:'kyc',label:'Client KYC',group:'People',note:'Client KYC submissions, review, letters and files.'},
    {key:'formbuilder',label:'Form builder',group:'People',note:'Build and edit forms, share them and review the responses.'},
    {key:'approvals',label:'Approvals',group:'People',note:'Approve or reject timesheets and leave requests.'},
    {key:'activity',label:'Activity',group:'People',note:'Who signed in and what is happening.'},
    {key:'audit',label:'Audit log',group:'People',note:'The record of changes made in the app.'},
    {key:'receipts',label:'Receipts',group:'Money',note:'Upload, read and manage receipts.'},
    {key:'sheets',label:'Petty cash sheet',group:'Money',note:'Upload and manage the monthly petty cash sheets.'},
    {key:'petty',label:'Reconcile',group:'Money',note:'Match receipts to the petty cash sheet and lock the month.'},
    {key:'clients',label:'Timesheet (admin view)',group:'Money',note:'All timesheets, customers, billing and the calendar. They keep their own Timesheet as well.'},
    {key:'stmt',label:'Statement conversion',group:'Money',note:'Convert bank statements to Excel.'},
    {key:'secretarial',label:'Secretarial',group:'Money',note:'BIPA forms and secretarial templates.'},
    {key:'studio',label:'Customize',group:'Account',note:'Dashboard widgets, new pages and menu changes.'}];
  const KEYS=PAGES.map(p=>p.key);
  const mine=()=>{const u=me();return u&&Array.isArray(u.perms)?u.perms.filter(k=>KEYS.includes(k)):[]};
  const has=k=>!!me()&&(isAdm()||mine().includes(k));
  const canPetty=()=>has('receipts')||has('sheets')||has('petty');
  const canForms=()=>has('formbuilder');

  /* ---------- the employee's menu ---------- */
  function inject(){
    if(!me()||me().type!=='emp'||typeof NAV==='undefined'||!NAV.emp)return;
    const granted=PAGES.filter(p=>mine().includes(p.key));
    NAV.emp=NAV.emp.filter(g=>g[0]!==GROUP);
    if(!granted.length)return;
    const labels=granted.map(p=>p.label.toLowerCase().replace(/[^a-z]/g,''));
    /* an empty added page with the same name as a real page is tucked away; the real one takes its place */
    NAV.emp=NAV.emp.map(g=>[g[0],g[1].filter(x=>!(String(x[0]).startsWith('cp_')&&labels.includes(String(x[1]).toLowerCase().replace(/[^a-z]/g,''))))]).filter(g=>g[1].length);
    NAV.emp.forEach(g=>{g[1]=g[1].filter(x=>!KEYS.includes(x[0]))});
    const at=Math.min(2,NAV.emp.length);
    NAV.emp.splice(at,0,[GROUP,granted.map(p=>[p.key,p.label])]);
  }
  let sig='';
  setInterval(()=>{                                   /* keeps the menu right after sign-in, a config change or a grant */
    const u=me();const s=u?u.id+'|'+mine().join(','):'';
    if(!u||u.type!=='emp'){sig=s;return}
    const has_=NAV.emp.some(g=>g[0]===GROUP);
    if(s!==sig||(mine().length&&!has_)||(!mine().length&&has_)){sig=s;inject();render()}
  },1000);
  /* people change while signed in: look again once a minute */
  setInterval(async()=>{
    if(!LIVE||!me()||me().type!=='emp'||!sb())return;
    const r=await sb().from('profiles').select('perms').eq('id',me().id).single();
    if(r.error||!r.data)return;
    const now=(Array.isArray(r.data.perms)?r.data.perms:[]).filter(k=>KEYS.includes(k)),was=mine();
    if(now.join(',')!==was.join(',')){me().perms=now;inject();toast(now.length?'Your access was updated: '+PAGES.filter(p=>now.includes(p.key)).map(p=>p.label).join(', '):'Your extra access was removed');render()}
  },60000);

  /* ---------- the administrator's panel ---------- */
  const X={uid:null,perms:[],orig:[],pending:null,ready:false,busy:false,msg:'',err:''};
  async function loadFor(id){
    X.uid=id;X.ready=false;X.msg='';X.err='';X.pending=null;
    if(!LIVE){const u=state.users.find(x=>x.id===id);X.perms=(u&&Array.isArray(u.perms)?u.perms:[]).filter(k=>KEYS.includes(k));X.orig=X.perms.slice();X.ready=true;return}
    const r=await sb().from('profiles').select('perms').eq('id',id).single();
    if(X.uid!==id)return;
    if(r.error){X.err=/perms|column|schema cache/i.test(r.error.message||'')?'Page access needs database migration 0033 (and 0039). Run them in the Supabase SQL editor, then reload.':'Could not load: '+r.error.message;X.perms=[];X.orig=[]}
    else{X.perms=(Array.isArray(r.data.perms)?r.data.perms:[]).filter(k=>KEYS.includes(k));X.orig=X.perms.slice()}
    X.ready=true;render();
  }
  const css=document.createElement('style');
  css.textContent=`.pxrow{display:flex;gap:10px;align-items:center;padding:8px 2px;border-top:1px solid var(--line)}.pxrow:first-of-type{border-top:0}
  .pxrow>div{flex:1}.pxrow b{display:block}.pxrow span{font-size:12.5px;color:var(--muted)}.pxsel{max-width:340px;width:100%}
  .pxconf{margin-top:10px;padding:12px;border:1px solid var(--accent);border-radius:10px;background:var(--accent-soft,rgba(0,0,0,.04))}`;
  document.head.appendChild(css);
  const pageOf=k=>PAGES.find(p=>p.key===k);
  function panel(A){
    if(X.uid!==A.sel)loadFor(A.sel);
    const name=((A.emps||[]).find(u=>u.id===A.sel)||{}).name||'this employee';
    const left=PAGES.filter(p=>!X.perms.includes(p.key)),groups=[...new Set(left.map(p=>p.group))];
    const pend=X.pending&&pageOf(X.pending.key);
    const conf=pend?(X.pending.mode==='add'
      ?`<div class="pxconf" role="alert"><b>Give ${esc(name)} full access to ${esc(pend.label)}?</b><div class="note" style="margin:4px 0 8px">${esc(pend.note)} They get the <b>real page</b>, the same one you use, with the same data and actions, in their menu under <b>${GROUP}</b>. They do not become an administrator and cannot open any other admin page.</div><div class="row" style="display:flex;gap:8px"><button class="btn" type="button" data-act="pxGo" ${X.busy?'disabled':''}>${X.busy?'Saving…':'Give full access'}</button><button class="btn ghost" type="button" data-act="pxCancel">Cancel</button></div></div>`
      :`<div class="pxconf" role="alert"><b>Remove ${esc(name)}'s access to ${esc(pend.label)}?</b><div class="note" style="margin:4px 0 8px">The page disappears from their menu and they can no longer use its data.</div><div class="row" style="display:flex;gap:8px"><button class="btn danger" type="button" data-act="pxGo" ${X.busy?'disabled':''}>${X.busy?'Saving…':'Remove access'}</button><button class="btn ghost" type="button" data-act="pxCancel">Cancel</button></div></div>`):'';
    const have=PAGES.filter(p=>X.perms.includes(p.key));
    return `<div class="panel" style="margin-top:12px"><h3 style="margin:0 0 4px">Pages with full access</h3>
      <div class="note" style="margin-bottom:8px">Choose any admin page from the list, then confirm. ${esc(name)} gets the real page in their menu under <b>${GROUP}</b>, without becoming an administrator.</div>
      ${!X.ready?'<p class="note" style="margin:0">Loading…</p>':`<label class="note" for="pxPick" style="display:block;margin-bottom:4px">Give access to a page</label>
        <select id="pxPick" class="pxsel" data-pxpick ${left.length?'':'disabled'}><option value="">${left.length?'Choose a page…':'All admin pages are already shared'}</option>${groups.map(g=>`<optgroup label="${esc(g)}">${left.filter(p=>p.group===g).map(p=>`<option value="${p.key}" ${pend&&pend.key===p.key&&X.pending.mode==='add'?'selected':''}>${esc(p.label)}</option>`).join('')}</optgroup>`).join('')}</select>
        ${conf}
        <div style="margin-top:12px">${have.length?have.map(p=>`<div class="pxrow"><div><b>${esc(p.label)}</b><span>${esc(p.note)}</span></div><button class="btn sm ghost" type="button" data-act="pxRemove" data-k="${p.key}">Remove</button></div>`).join(''):'<p class="note" style="margin:0">No extra pages yet.</p>'}</div>`}
      ${X.err?`<div class="err" role="alert">${esc(X.err)}</div>`:''}${X.msg?`<div class="banner ok" role="status" style="margin-top:8px">${esc(X.msg)}</div>`:''}
      <p class="note" style="margin:8px 0 0">${LIVE?'They get it within a minute, even while signed in. Changes are recorded in the audit log. Needs migration 0039 in Supabase.':'Sample mode: kept until you reload.'}</p></div>`;
  }
  function wrap(){
    const base=VIEWS.dashedit;if(!base||base.__px||!window.VIRTUOSO_DASHEDIT)return;
    const w=()=>{
      const h=base(),A=window.VIRTUOSO_DASHEDIT.admin(),i=h.indexOf('<div class="dxtabs">');
      if(!A.sel||A.loading||i<0)return h;
      return h.slice(0,i)+panel(A)+h.slice(i);
    };
    w.__px=true;VIEWS.dashedit=w;
  }
  if(document.readyState==='complete')setTimeout(wrap,0);else window.addEventListener('load',()=>setTimeout(wrap,0));
  setInterval(wrap,1500);

  document.addEventListener('change',e=>{
    const t=e.target;if(!t||!t.dataset||t.dataset.pxpick===undefined)return;
    e.stopImmediatePropagation();X.msg='';X.err='';X.pending=t.value&&pageOf(t.value)?{key:t.value,mode:'add'}:null;render();
  },true);
  async function save(list){
    X.busy=true;X.err='';X.msg='';render();
    list=KEYS.filter(k=>list.includes(k));
    if(!LIVE){const u=state.users.find(x=>x.id===X.uid);if(u)u.perms=list;X.perms=list.slice();X.orig=list.slice();X.busy=false;X.pending=null;X.msg='Saved. They now see these pages in their menu.';render();return}
    const r=await sb().rpc('set_user_perms',{p_user:X.uid,p_perms:list});
    X.busy=false;
    if(r.error)X.err=/set_user_perms|function|schema cache|perms_known|violates check/i.test(r.error.message||'')?'Giving access to every page needs database migration 0039. Run it in the Supabase SQL editor (after 0033), then reload.':'Could not save: '+r.error.message;
    else{X.perms=list.slice();X.orig=list.slice();X.pending=null;X.msg=list.length?'Saved. They will see '+PAGES.filter(p=>list.includes(p.key)).map(p=>p.label).join(', ')+' in their menu within a minute.':'Saved. Their extra pages were removed.'}
    render();
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="px"]');if(!b)return;
    const a=b.dataset.act;if(!['pxGo','pxCancel','pxRemove'].includes(a))return;
    e.stopImmediatePropagation();if(!isAdm()||X.busy||!X.uid)return;
    if(a==='pxCancel'){X.pending=null;render();return}
    if(a==='pxRemove'){X.msg='';X.err='';X.pending={key:b.dataset.k,mode:'remove'};render();return}
    const p=X.pending;if(!p||!pageOf(p.key))return;
    save(p.mode==='add'?X.perms.concat([p.key]):X.perms.filter(k=>k!==p.key));
  },true);

  /* pages reached from inside a granted page without being in the menu (the Form builder's Fill now / classic editor open the form screen) */
  const allowTab=t=>t==='kyc'&&canForms();
  window.VIRTUOSO_PERMS={has,canPetty,canForms,inject,allowTab,pages:()=>PAGES.slice()};
})();
