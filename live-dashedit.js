/* DASHBOARD EDITOR (admin: People > Employee dashboards) and the matching employee side.
   The admin picks an employee and builds extra content for that person's dashboard: notices, tasks (the employee ticks them off),
   links to existing pages, text cards, and whole extra pages that appear in the employee's menu under "Added for you".
   Publish saves it (migration 0018, publish_dashboard) and can copy the same layout to several employees.
   The employee's dashboard then shows an "updated, please view" banner with a "new" badge on the Dashboard menu item until they open it
   (dash_mark_seen). Employees poll every 20s, so changes arrive without a reload. ?demo keeps everything in state.dashcfg. */
(function(){
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const isAdm=()=>state.user&&state.user.type==='admin';
  const rid=()=>Math.random().toString(36).slice(2,10);
  const clone=o=>JSON.parse(JSON.stringify(o));
  const empty=()=>({blocks:[],pages:[]});
  const TYPES={notice:'Notice',task:'Task',link:'Link to a page',text:'Text card'};
  const GROUP='Added for you';
  const nl=s=>esc(s||'').replace(/\n/g,'<br>');
  const first=n=>String(n||'').split(' ')[0]||'';
  const day=d=>d?new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'';

  /* ---------------- data layer ---------------- */
  const store=()=>(state.dashcfg=state.dashcfg||{});
  const doneSet=()=>(state.dashDone=state.dashDone||{});
  async function listEmps(){
    if(!LIVE)return state.users.filter(u=>u.type==='emp').map(u=>({id:u.id,name:u.name,title:u.title||''}));
    const {data}=await sb().from('profiles').select('id,name,title,access_enabled').eq('role','emp').order('name');
    return (data||[]).filter(p=>p.access_enabled!==false);
  }
  async function getCfg(id){
    if(!LIVE){const r=store()[id];return r?{config:clone(r.config),version:r.version,seen:r.seen,note:r.note}:null}
    const {data,error}=await sb().from('dash_configs').select('config,version,seen_version,change_note').eq('employee_id',id).maybeSingle();
    if(error)throw error;return data?{config:data.config,version:data.version,seen:data.seen_version,note:data.change_note}:null;
  }
  async function getDone(id){
    if(!LIVE)return new Set(doneSet()[id]||[]);
    const {data}=await sb().from('dash_task_done').select('task_id').eq('employee_id',id);return new Set((data||[]).map(r=>r.task_id));
  }
  async function publish(ids,config,note){
    if(!LIVE){ids.forEach(id=>{const o=store()[id];store()[id]={config:clone(config),version:(o?o.version:0)+1,seen:0,note:note||''}});
      if(typeof logA==='function')logA('Dashboard published',ids.length+' employee(s)');return ids.length}
    const {data,error}=await sb().rpc('publish_dashboard',{p_employees:ids,p_config:config,p_note:note||''});
    if(error)throw error;return data;
  }

  /* ---------------- block rendering (shared by employee dashboard, pages and admin preview) ---------------- */
  function pageTargets(extra){
    const out=[];NAV.emp.forEach(g=>{if(g[0]!==GROUP)g[1].forEach(x=>out.push([x[0],x[1]]))});
    (extra||[]).forEach(p=>out.push(['cp_'+p.id,p.title+' (added page)']));return out;
  }
  function blockHTML(b,done,interactive){
    const t=esc(b.title||'');
    if(b.type==='notice')return `<div class="banner dxb" style="border-left-color:var(--warn);background:var(--warn-soft)"><b>${t}</b>${b.body?'<div>'+nl(b.body)+'</div>':''}</div>`;
    if(b.type==='task'){const d=done&&done.has(b.id);
      return `<label class="dxt${d?' on':''}"><input type="checkbox" ${d?'checked':''} ${interactive?`data-act="dxTick" data-id="${esc(b.id)}"`:'disabled'}> <span><b>${t}</b>${b.due?` <small class="note">due ${esc(day(b.due))}</small>`:''}${b.body?'<div class="note">'+nl(b.body)+'</div>':''}</span></label>`}
    if(b.type==='link'){const lab=(pageTargets(M.pages).find(x=>x[0]===b.tab)||[])[1]||b.tab||'';
      return `<button class="tile link dxl" ${interactive?`data-tab="${esc(b.tab||'dash')}"`:'type="button"'}><b style="font-size:16px">${t||esc(lab)}</b><span>${b.body?esc(b.body):'Open '+esc(lab)}</span></button>`}
    return `<div class="panel dxb"><h3 style="margin:0 0 6px">${t}</h3><div>${nl(b.body)}</div></div>`;
  }
  function blocksHTML(list,done,interactive){
    const tasks=list.filter(b=>b.type==='task'),other=list.filter(b=>b.type!=='task'&&b.type!=='link'),links=list.filter(b=>b.type==='link');
    return other.map(b=>blockHTML(b,done,interactive)).join('')
      +(tasks.length?`<div class="panel dxb"><h3 style="margin:0 0 8px">Tasks <small class="note">${tasks.filter(b=>done&&done.has(b.id)).length}/${tasks.length} done</small></h3>${tasks.map(b=>blockHTML(b,done,interactive)).join('')}</div>`:'')
      +(links.length?`<div class="tiles">${links.map(b=>blockHTML(b,done,interactive)).join('')}</div>`:'');
  }

  const CSS=`.dxb{margin:10px 0}.dxt{display:flex;gap:10px;align-items:flex-start;padding:6px 0;border-top:1px solid var(--line);cursor:pointer}.dxt:first-of-type{border-top:0}.dxt.on b{text-decoration:line-through;color:var(--muted)}
.dxl{margin:0}.dxupd{display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:space-between;border:1px solid var(--accent);background:var(--accent-soft);border-radius:8px;padding:12px 14px;margin:0 0 14px}
.dxe{border:1px solid var(--line);border-radius:8px;padding:12px;margin:10px 0;background:var(--surface)}.dxe .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.dxe input[type=text],.dxe textarea,.dxe select,.dxe input[type=date]{font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg);width:100%;box-sizing:border-box}
.dxtabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.dxtabs .btn[aria-pressed=true]{background:var(--accent);color:var(--accent-fg)}`;
  if(!document.getElementById('dxCss')){const s=document.createElement('style');s.id='dxCss';s.textContent=CSS;document.head.appendChild(s)}

  /* ---------------- employee side ---------------- */
  const M={uid:null,loaded:false,loading:false,config:empty(),pages:[],version:0,seen:0,note:'',done:new Set(),pulse:0};
  const isNew=()=>state.user&&state.user.type==='emp'&&M.loaded&&M.version>M.seen&&(M.config.blocks.length||M.config.pages.length);
  let BASE=null;
  function applyNav(){
    /* per-employee menu changes made by the admin (hide / rename built-in pages). Hidden pages are cosmetic: RLS still decides access. */
    if(!BASE)BASE=JSON.parse(JSON.stringify(NAV.emp.filter(g=>g[0]!==GROUP)));
    const mn=(M.config&&M.config.menu)||{},hid=Array.isArray(mn.hidden)?mn.hidden:[],ren=mn.rename&&typeof mn.rename==='object'?mn.rename:{};
    NAV.emp=BASE.map(g=>[g[0],g[1].filter(x=>x[0]==='dash'||!hid.includes(x[0])).map(x=>[x[0],String(ren[x[0]]||x[1]).slice(0,40)])]).filter(g=>g[1].length);
    Object.keys(VIEWS).filter(k=>k.startsWith('cp_')).forEach(k=>{delete VIEWS[k];delete ICON[k]});
    const pages=M.config.pages||[];M.pages=pages;
    if(!pages.length)return;
    NAV.emp.push([GROUP,pages.map(p=>['cp_'+p.id,p.title||'Page'])]);
    pages.forEach(p=>{
      ICON['cp_'+p.id]='<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>';
      VIEWS['cp_'+p.id]=()=>`<h2 style="margin:0 0 4px">${esc(p.title||'Page')}</h2><p class="sub">Added for you by your administrator.</p>${(p.blocks||[]).length?blocksHTML(p.blocks,M.done,true):'<p class="note">Nothing on this page yet.</p>'}`;
    });
  }
  async function loadMine(quiet){
    if(!state.user||state.user.type!=='emp'||M.loading)return;M.loading=true;
    try{
      const r=await getCfg(state.user.id),d=await getDone(state.user.id),old=M.version;
      M.done=d;if(r){M.config=r.config||empty();M.version=r.version;M.seen=r.seen;M.note=r.note||''}else{M.config=empty();M.version=0;M.seen=0}
      const changed=!M.loaded||old!==M.version;M.loaded=true;
      if(changed){applyNav();if(quiet&&isNew())toast('Your dashboard has been updated');if(typeof render==='function')render()}
    }catch(e){console.warn('dashboard config',e)}finally{M.loading=false}
  }
  async function markSeen(){
    M.seen=M.version;
    if(!LIVE){const o=store()[state.user.id];if(o)o.seen=o.version}else{try{await sb().rpc('dash_mark_seen')}catch(e){}}
    if(typeof paintTabs==='function')paintTabs();
  }
  function employeeSection(){
    const c=M.config;if(!M.loaded||(!c.blocks.length&&!c.pages.length))return '';
    const nw=isNew();
    const banner=nw?`<div class="dxupd" role="alert"><div><b>${esc(first(state.user.name))}, your dashboard has been updated.</b><div class="note">${M.note?esc(M.note):'Your administrator added new items for you.'}</div></div><button class="btn" data-act="dxSeen">View changes</button></div>`:'';
    const pages=(c.pages||[]).length?`<p class="note dxb">New pages in your menu under <b>${GROUP}</b>: ${c.pages.map(p=>`<button class="btn sm ghost" data-tab="cp_${esc(p.id)}">${esc(p.title||'Page')}</button>`).join(' ')}</p>`:'';
    return banner+`<div id="dxMine">${(c.blocks||[]).length||pages?`<h3 style="margin:14px 0 4px">From your administrator ${nw?'<span class="badge">new</span>':''}</h3>`:''}${blocksHTML(c.blocks||[],M.done,true)}${pages}</div>`;
  }
  /* ---------------- admin side ---------------- */
  const A={emps:null,sel:null,config:empty(),version:0,seen:0,note:'',done:new Set(),page:null,dirty:false,loading:false,msg:'',also:{},busy:false};
  async function pickEmp(id){
    A.sel=id;A.loading=true;A.msg='';A.page=null;A.also={};render();
    try{const r=await getCfg(id);A.config=r?r.config:empty();A.version=r?r.version:0;A.seen=r?r.seen:0;A.note='';A.done=await getDone(id)}
    catch(e){A.msg='Could not load that dashboard.';A.config=empty()}
    A.dirty=false;A.loading=false;render();
  }
  const list=()=>A.page?((A.config.pages.find(p=>p.id===A.page)||{}).blocks||[]):A.config.blocks;
  function editorBlock(b,i,n){
    const f=(k,ph)=>`<input type="text" data-dx="${k}" data-i="${i}" value="${esc(b[k]||'')}" placeholder="${ph}" maxlength="${k==='title'?120:1000}">`;
    const tg=pageTargets(A.config.pages);
    return `<div class="dxe"><div class="row" style="justify-content:space-between"><b>${TYPES[b.type]}${b.type==='task'&&A.sel&&A.done.has(b.id)?' <span class="badge" style="background:var(--ok)">done by employee</span>':''}</b>
      <span><button class="btn sm ghost" data-act="dxUp" data-i="${i}" ${i?'':'disabled'} aria-label="Move up">&uarr;</button> <button class="btn sm ghost" data-act="dxDown" data-i="${i}" ${i<n-1?'':'disabled'} aria-label="Move down">&darr;</button> <button class="btn sm bad" data-act="dxDel" data-i="${i}">Remove</button></span></div>
      <div style="margin-top:8px">${f('title',b.type==='link'?'Button label (optional)':'Title')}</div>
      ${b.type==='link'?`<div style="margin-top:6px"><select data-dx="tab" data-i="${i}">${tg.map(([k,l])=>`<option value="${esc(k)}" ${b.tab===k?'selected':''}>${esc(l)}</option>`).join('')}</select></div>`:''}
      <div style="margin-top:6px"><textarea data-dx="body" data-i="${i}" rows="2" maxlength="1000" placeholder="${b.type==='link'?'Short description (optional)':'Details'}">${esc(b.body||'')}</textarea></div>
      ${b.type==='task'?`<div style="margin-top:6px"><label class="note">Due date (optional) <input type="date" data-dx="due" data-i="${i}" value="${esc(b.due||'')}"></label></div>`:''}</div>`;
  }
  function vEdit(){
    if(!isAdm())return '<p>Only administrators can edit dashboards.</p>';
    if(!A.emps&&!A.loading){A.loading=true;listEmps().then(e=>{A.emps=e;A.loading=false;render()}).catch(()=>{A.emps=[];A.loading=false;A.msg='Could not load employees.';render()})}
    const emps=A.emps||[],L=list(),pg=A.config.pages;
    const status=!A.sel?'':A.version?`Published version ${A.version}. ${A.seen>=A.version?'The employee has viewed the latest update.':'The employee has not viewed the latest update yet.'}`:'Nothing published for this employee yet.';
    return `<h2 style="margin:0 0 4px">Employee dashboards</h2><p class="sub">Add notices, tasks, links, text cards and whole pages to one employee's dashboard. When you publish, it appears on their dashboard automatically and they are alerted that it was updated.</p>
    <div class="panel"><label class="note" for="dxEmp">Employee</label><select id="dxEmp" style="font:inherit;padding:6px 8px;width:100%;max-width:380px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)"><option value="">Choose an employee...</option>${emps.map(u=>`<option value="${esc(u.id)}" ${u.id===A.sel?'selected':''}>${esc(u.name)}${u.title?' - '+esc(u.title):''}</option>`).join('')}</select>
      <div class="note" style="margin-top:6px">${esc(status)}</div>${A.msg?`<div class="note" role="status" style="color:var(--bad)">${esc(A.msg)}</div>`:''}</div>
    ${!A.sel?'':A.loading?'<p class="note">Loading...</p>':`
    <div class="dxtabs"><button class="btn sm ghost" aria-pressed="${!A.page}" data-act="dxPage" data-id="">Dashboard</button>${pg.map(p=>`<button class="btn sm ghost" aria-pressed="${A.page===p.id}" data-act="dxPage" data-id="${esc(p.id)}">${esc(p.title||'Page')}</button>`).join('')}<button class="btn sm" data-act="dxNewPage">+ New page</button></div>
    ${A.page?`<div class="dxe"><div class="row"><input type="text" data-dxp="title" value="${esc((pg.find(p=>p.id===A.page)||{}).title||'')}" placeholder="Page name" maxlength="60" style="flex:1"><button class="btn sm bad" data-act="dxDelPage">Delete page</button></div><div class="note" style="margin-top:6px">This page appears in the employee's menu under "${GROUP}".</div></div>`:''}
    ${L.length?L.map((b,i)=>editorBlock(b,i,L.length)).join(''):'<p class="note">Nothing here yet. Add something below.</p>'}
    <div class="row" style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">${Object.keys(TYPES).filter(t=>true).map(t=>`<button class="btn sm ghost" data-act="dxAdd" data-t="${t}">+ ${TYPES[t]}</button>`).join('')}</div>
    <div class="panel"><label class="note" for="dxNote">Message the employee will see (optional)</label><input id="dxNote" type="text" maxlength="300" value="${esc(A.note)}" placeholder="e.g. New month-end checklist added" style="font:inherit;padding:6px 8px;width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)">
      <details style="margin-top:8px"><summary>Also publish this same layout to other employees</summary>${emps.filter(u=>u.id!==A.sel).map(u=>`<label style="display:block;padding:2px 0"><input type="checkbox" data-act="dxAlso" data-id="${esc(u.id)}" ${A.also[u.id]?'checked':''}> ${esc(u.name)}</label>`).join('')||'<span class="note">No other employees.</span>'}</details>
      <div style="margin-top:10px"><button class="btn" data-act="dxPublish" ${A.busy?'disabled':''}>Publish to dashboard${A.dirty?'':' (no changes)'}</button> ${A.dirty?'<span class="note">Unpublished changes</span>':''}</div></div>
    <h3 style="margin:16px 0 4px">Preview of what ${esc(((emps.find(u=>u.id===A.sel)||{}).name||'the employee'))} will see</h3>
    <div class="panel">${L.length?blocksHTML(L,A.done,false):'<span class="note">Empty</span>'}</div>`}`;
  }

  /* ---------------- wiring ---------------- */
  const baseDash=VIEWS.dash;
  VIEWS.dash=()=>{
    if(state.role==='emp'&&state.user){if(!M.loaded)loadMine();const s=employeeSection();const h=baseDash();return s?h.replace(/(<div class="tiles">)/,s+'$1'):h}
    return baseDash();
  };
  VIEWS.dashedit=vEdit;ICON.dashedit='<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4M7 8h6M7 12h10"/>';
  {const p=NAV.adm.find(x=>x[0]==='People');if(p&&!p[1].some(x=>x[0]==='dashedit'))p[1].splice(1,0,['dashedit','Employee dashboards'])}
  window.VIRTUOSO_DASHEDIT={isNew,admin:()=>A,dirty:()=>{A.dirty=true},rid,base:()=>BASE||NAV.emp.filter(g=>g[0]!==GROUP)};
  setInterval(()=>{const u=state.user?state.user.id:null;if(u!==M.uid){M.uid=u;M.loaded=false;M.loading=false;M.config=empty();M.version=0;M.seen=0;M.done=new Set();NAV.emp=NAV.emp.filter(g=>g[0]!==GROUP);A.emps=null;A.sel=null;A.config=empty()}},700);
  setInterval(()=>{if(state.user&&state.user.type==='emp'&&M.loaded)loadMine(true)},20000);

  document.addEventListener('change',e=>{
    const t=e.target;if(t.id==='dxEmp'){e.stopImmediatePropagation();if(t.value)pickEmp(t.value);else{A.sel=null;render()}return}
    if(t.dataset&&t.dataset.dx){e.stopImmediatePropagation();const b=list()[+t.dataset.i];if(b){b[t.dataset.dx]=t.value;A.dirty=true}}
  },true);
  document.addEventListener('input',e=>{
    const t=e.target;if(t.dataset&&t.dataset.dx){const b=list()[+t.dataset.i];if(b){b[t.dataset.dx]=t.value;A.dirty=true}return}
    if(t.dataset&&t.dataset.dxp){const p=A.config.pages.find(x=>x.id===A.page);if(p){p.title=t.value;A.dirty=true}return}
    if(t.id==='dxNote')A.note=t.value;
  },true);
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="dx"]');if(!b)return;
    const a=b.dataset.act;if(a==='dxTick')return;
    e.stopImmediatePropagation();const i=+b.dataset.i,L=A.sel?list():[];
    if(a==='dxSeen'){markSeen().then(()=>{render();const n=document.getElementById('dxMine');if(n)n.scrollIntoView({behavior:'smooth'})});return}
    if(a==='dxAdd'){L.push({id:rid(),type:b.dataset.t,title:'',body:'',tab:b.dataset.t==='link'?'dash':undefined});A.dirty=true;return render()}
    if(a==='dxDel'){L.splice(i,1);A.dirty=true;return render()}
    if(a==='dxUp'&&i>0){[L[i-1],L[i]]=[L[i],L[i-1]];A.dirty=true;return render()}
    if(a==='dxDown'&&i<L.length-1){[L[i+1],L[i]]=[L[i],L[i+1]];A.dirty=true;return render()}
    if(a==='dxPage'){A.page=b.dataset.id||null;return render()}
    if(a==='dxNewPage'){if(A.config.pages.length>=10)return toast('Up to 10 pages per employee');const p={id:rid(),title:'New page',blocks:[]};A.config.pages.push(p);A.page=p.id;A.dirty=true;return render()}
    if(a==='dxDelPage'){if(!confirm('Delete this page? Links to it stop working.'))return;A.config.pages=A.config.pages.filter(p=>p.id!==A.page);
      A.config.blocks=A.config.blocks.filter(x=>!(x.type==='link'&&x.tab==='cp_'+A.page));A.page=null;A.dirty=true;return render()}
    if(a==='dxAlso'){A.also[b.dataset.id]=!A.also[b.dataset.id];return}
    if(a==='dxPublish'&&!A.busy){
      const c=A.config,bad=[...c.blocks,...c.pages.flatMap(p=>p.blocks||[])].find(x=>x.type!=='link'&&!(x.title||'').trim());
      if(bad)return toast('Every item needs a title');
      if(c.pages.some(p=>!(p.title||'').trim()))return toast('Every page needs a name');
      const ids=[A.sel,...Object.keys(A.also).filter(k=>A.also[k])];
      if(ids.length>1&&!confirm('Publish this layout to '+ids.length+' employees? It replaces what they currently have.'))return;
      A.busy=true;render();
      publish(ids,c,A.note).then(()=>{A.busy=false;A.dirty=false;A.version++;A.seen=0;A.also={};toast('Published. Employees are alerted.');render()})
        .catch(x=>{A.busy=false;A.msg='Could not publish: '+((x&&x.message)||'error');render()});
    }
  },true);
  document.addEventListener('change',e=>{
    const t=e.target;if(!(t.dataset&&t.dataset.act==='dxTick'))return;e.stopImmediatePropagation();
    const id=t.dataset.id,on=t.checked,uid=state.user.id;
    if(on)M.done.add(id);else M.done.delete(id);
    if(!LIVE){const s=doneSet();s[uid]=[...M.done]}
    else{const q=on?sb().from('dash_task_done').insert({task_id:id}):sb().from('dash_task_done').delete().eq('task_id',id).eq('employee_id',uid);
      q.then(r=>{if(r&&r.error){toast('Could not save that');if(on)M.done.delete(id);else M.done.add(id)}render()});return}
    render();
  },true);
  if(LIVE){const t=setInterval(()=>{const c=sb();if(!c||!c.channel)return;clearInterval(t);
    try{c.channel('dash-cfg').on('postgres_changes',{event:'*',schema:'public',table:'dash_configs'},()=>{if(state.user&&state.user.type==='emp')loadMine(true)}).subscribe()}catch(x){}},1500)}
})();
