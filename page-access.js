/* WORK FUNCTIONS: an administrator gives a named employee FULL access to specific admin pages as part of their job, without
   making them an administrator. Pages: Form builder, Receipts, Petty cash sheet, Reconcile. The employee then gets the REAL page
   (a clone of the administrator's, same code, same data) in their menu under "Work functions"; empty pages with the same names
   (added earlier through Employee dashboards) are tucked away. Server side (migration 0033): profiles.perms lists the page keys;
   extra row-level-security policies open only the tables, the saved petty sheets setting and the storage buckets those pages use;
   only an administrator can change perms (RPC set_user_perms, guarded trigger). Nothing else becomes reachable.
   The administrator grants access in People > Employee dashboards > choose the employee > "Work functions with full access".
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
    {key:'formbuilder',label:'Form builder',note:'Build and edit forms, share them and review the responses.'},
    {key:'receipts',label:'Receipts',note:'Upload, read and manage receipts.'},
    {key:'sheets',label:'Petty cash sheet',note:'Upload and manage the monthly petty cash sheets.'},
    {key:'petty',label:'Reconcile',note:'Match receipts to the petty cash sheet and lock the month.'}];
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
  const X={uid:null,perms:[],orig:[],ready:false,busy:false,msg:'',err:''};
  async function loadFor(id){
    X.uid=id;X.ready=false;X.msg='';X.err='';
    if(!LIVE){const u=state.users.find(x=>x.id===id);X.perms=(u&&Array.isArray(u.perms)?u.perms:[]).filter(k=>KEYS.includes(k));X.orig=X.perms.slice();X.ready=true;return}
    const r=await sb().from('profiles').select('perms').eq('id',id).single();
    if(X.uid!==id)return;
    if(r.error){X.err=/perms|column|schema cache/i.test(r.error.message||'')?'Work functions need database migration 0033. Run it in the Supabase SQL editor, then reload.':'Could not load: '+r.error.message;X.perms=[];X.orig=[]}
    else{X.perms=(Array.isArray(r.data.perms)?r.data.perms:[]).filter(k=>KEYS.includes(k));X.orig=X.perms.slice()}
    X.ready=true;render();
  }
  const css=document.createElement('style');
  css.textContent=`.pxrow{display:flex;gap:10px;align-items:flex-start;padding:8px 2px;border-top:1px solid var(--line)}.pxrow:first-of-type{border-top:0}
  .pxrow input{width:20px;height:20px;margin-top:2px;flex:0 0 20px}.pxrow b{display:block}.pxrow span{font-size:12.5px;color:var(--muted)}`;
  document.head.appendChild(css);
  function panel(A){
    if(X.uid!==A.sel)loadFor(A.sel);
    const name=((A.emps||[]).find(u=>u.id===A.sel)||{}).name||'this employee';
    const dirty=X.perms.slice().sort().join(',')!==X.orig.slice().sort().join(',');
    return `<div class="panel" style="margin-top:12px"><h3 style="margin:0 0 4px">Work functions with full access</h3>
      <div class="note" style="margin-bottom:8px">Tick the admin pages that ${esc(name)} uses as part of their job. They get the <b>real page</b>, a clone of yours with full access to it, in their menu under <b>${GROUP}</b>. They do not become an administrator and cannot open any other admin page. Untick to remove it.</div>
      ${!X.ready?'<p class="note" style="margin:0">Loading…</p>':PAGES.map(p=>`<label class="pxrow"><input type="checkbox" data-px="${p.key}" ${X.perms.includes(p.key)?'checked':''}><div><b>${esc(p.label)}</b><span>${esc(p.note)}</span></div></label>`).join('')}
      ${X.err?`<div class="err" role="alert">${esc(X.err)}</div>`:''}${X.msg?`<div class="banner ok" role="status" style="margin-top:8px">${esc(X.msg)}</div>`:''}
      <div class="row" style="margin-top:10px;display:flex;gap:8px;align-items:center"><button class="btn" type="button" data-act="pxSave" ${!X.ready||!dirty||X.busy?'disabled':''}>${X.busy?'Saving…':'Save access'}</button>${dirty?'<span class="note">Not saved yet</span>':''}</div>
      <p class="note" style="margin:8px 0 0">${LIVE?'The employee gets it within a minute, even while signed in. Changes are recorded in the audit log.':'Sample mode: kept until you reload.'}</p></div>`;
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
    const t=e.target;if(!t||!t.dataset||!t.dataset.px)return;
    e.stopImmediatePropagation();const k=t.dataset.px;
    X.perms=X.perms.filter(x=>x!==k);if(t.checked)X.perms.push(k);X.msg='';render();
  },true);
  document.addEventListener('click',async e=>{
    const b=e.target.closest&&e.target.closest('[data-act="pxSave"]');if(!b)return;
    e.stopImmediatePropagation();if(!isAdm()||X.busy||!X.uid)return;
    X.busy=true;X.err='';X.msg='';render();
    const list=KEYS.filter(k=>X.perms.includes(k));
    if(!LIVE){const u=state.users.find(x=>x.id===X.uid);if(u)u.perms=list;X.orig=list.slice();X.busy=false;X.msg='Saved. They now see these pages in their menu.';render();return}
    const r=await sb().rpc('set_user_perms',{p_user:X.uid,p_perms:list});
    X.busy=false;
    if(r.error)X.err=/set_user_perms|function|schema cache/i.test(r.error.message||'')?'Work functions need database migration 0033. Run it in the Supabase SQL editor, then reload.':'Could not save: '+r.error.message;
    else{X.orig=list.slice();X.msg=list.length?'Saved. They will see '+PAGES.filter(p=>list.includes(p.key)).map(p=>p.label).join(', ')+' in their menu within a minute.':'Saved. Their extra pages were removed.'}
    render();
  },true);

  /* pages reached from inside a granted page without being in the menu (the Form builder's Fill now / classic editor open the form screen) */
  const allowTab=t=>t==='kyc'&&canForms();
  window.VIRTUOSO_PERMS={has,canPetty,canForms,inject,allowTab,pages:()=>PAGES.slice()};
})();
