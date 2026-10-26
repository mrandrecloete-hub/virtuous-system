/* Admin TIMESHEET page (live mode). Replaces the old "Clients & billing" screen.
   List: every time entry with filters (period, customer, user, approvals), checkboxes for bulk actions,
   and a log-entry panel (details, edit, approve/reject, billed/unbilled).
   Summary: billing figures and time spent on tasks. Customers: add customers, rates and billable settings.
   Billing counts APPROVED entries; only admins can mark entries billed (enforced in the database). */
(function(){
  const cfg=window.VIRTUOSO||{};
  if(!(cfg.supabaseUrl&&cfg.anonKey)||/[?&]demo\b/.test(location.search))return;
  const sb=()=>window.VIRTUOSO.client;
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const parse=s=>new Date(s+'T00:00:00');
  const fd=s=>parse(s).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  const hm=h=>{const m=Math.round(h*60);return pad(Math.floor(m/60))+':'+pad(m%60)};
  const money=n=>typeof NAD==='function'?NAD(n):'N$ '+(+n||0).toFixed(2);
  const isAdm=()=>state.user&&state.user.type==='admin';
  const fresh=()=>({uid:null,view:'list',preset:'all',period:'all',cust:'',user:'',stat:'',sel:{},open:null,edit:false,dTab:'details',limit:100,rows:null,clients:null,names:null,
    loading:false,busy:false,truncated:false,sumPeriod:'month',sumInc:'approved'});
  let T=fresh();
  setInterval(()=>{const u=state.user?state.user.id:null;if(u!==T.uid){T=fresh();T.uid=u}},700);
  const err=m=>{const e=document.getElementById('tsErr');if(e)e.textContent=m||''};
  const rpcMsg=m=>/not permitted|row-level|policy|permission/i.test(m||'')?'You are not allowed to do that.':/foreign key|violates/i.test(m||'')?'That is in use. Mark it not billable instead.':/duplicate|unique/i.test(m||'')?'That already exists.':'Something went wrong. Try again.';

  const css=document.createElement('style');
  css.textContent=`
  .tsw{display:grid;grid-template-columns:minmax(0,1fr);gap:0;align-items:start}
  .tsw.withpanel{grid-template-columns:minmax(0,1fr) 340px}
  @media(max-width:1100px){.tsw.withpanel{grid-template-columns:1fr}.tsw.withpanel .tsmain{display:none}}
  .tshead{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px}
  select.tstitle{font:700 1.6em/1.2 inherit;font-family:inherit;border:0;background:transparent;color:var(--fg);padding:4px 24px 4px 0;width:auto;cursor:pointer;max-width:100%}
  .tsfilters{display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:10px 12px;background:var(--surface);border:1px solid var(--line);border-radius:10px;margin-bottom:10px}
  .tsfilters b{font-size:.78em;letter-spacing:.06em;color:var(--muted)}
  .tsfilters label{flex-direction:row;align-items:center;gap:8px;margin:0;font-weight:500;font-size:.9em;color:var(--fg)}
  .tsfilters select{width:auto;min-width:130px;min-height:38px}
  .tsbulk{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 12px;background:#0a1b3f;color:#fff;border-radius:10px;margin-bottom:10px}
  .tsbulk .btn{min-height:36px}
  table.tst th{font-size:.72em;letter-spacing:.06em;color:var(--muted);text-transform:uppercase;white-space:nowrap}
  table.tst td{vertical-align:top}table.tst td:nth-child(2),table.tst td:nth-child(6),table.tst td:nth-child(7),table.tst td:nth-child(8){white-space:nowrap}
  table.tst tr[data-row]{cursor:pointer}table.tst tr[data-row]:hover td{background:color-mix(in srgb,var(--accent) 6%,transparent)}
  table.tst tr.sel td{background:color-mix(in srgb,var(--accent) 12%,transparent)}
  .tslink{background:none;border:0;padding:0;color:var(--accent);font:inherit;cursor:pointer;text-align:left;min-height:0}
  .tsfoot{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;padding:12px;color:var(--muted)}
  .tsdrawer{background:var(--surface);border:1px solid var(--line);border-radius:12px;margin-left:12px;position:sticky;top:8px;max-height:calc(100vh - 24px);overflow:auto}
  @media(max-width:1100px){.tsdrawer{margin-left:0}}
  .tsdh{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 14px;border-bottom:1px solid var(--line)}
  .tsdh b{font-size:1.05em}
  .tstime{margin:14px;background:#fff7ea;color:#3a2a00;border:1px solid #f0d9a8;border-radius:12px;padding:16px;text-align:center;position:relative}
  .tstime .badge2{position:absolute;right:-1px;top:-1px;background:#e6760f;color:#fff;font-weight:700;font-size:.78em;padding:3px 10px;border-radius:0 12px 0 10px}
  .tstime .badge2.ok{background:#1f8a4c}
  .tstime .big{font-size:2em;font-weight:600;margin-top:6px}.tstime .big small{font-size:.45em;font-weight:500}
  .tstabs{display:flex;gap:18px;padding:0 14px;border-bottom:1px solid var(--line)}
  .tstabs button{background:none;border:0;padding:10px 2px;font:inherit;cursor:pointer;color:var(--muted);border-bottom:3px solid transparent;min-height:0}
  .tstabs button[aria-selected=true]{color:var(--fg);font-weight:700;border-bottom-color:var(--accent)}
  .tsdl{display:grid;grid-template-columns:130px 1fr;gap:12px 10px;padding:14px;margin:0}
  .tsdl dt{color:var(--muted)}.tsdl dd{margin:0;word-break:break-word}
  `;
  document.head.appendChild(css);

  async function load(silent){
    if(T.loading||!sb())return;T.loading=true;
    const [c,e,p]=await Promise.all([
      sb().from('clients').select('*').order('name'),
      sb().from('time_entries').select('id,user_id,client_id,work_date,task,hours,status,billed,notes,decided_at').order('work_date',{ascending:false}).limit(5000),
      sb().from('profiles').select('id,name')]);
    T.clients=c.data||[];T.names=Object.fromEntries((p.data||[]).map(x=>[x.id,x.name]));
    T.truncated=(e.data||[]).length>=5000;
    T.rows=(e.data||[]).map(r=>({...r,hours:+r.hours,who:T.names[r.user_id]||'Unknown',cust:(T.clients.find(x=>x.id===r.client_id)||{name:'(removed customer)'}).name}));
    T.loading=false;if(!silent||true)render();
  }
  const reload=()=>{T.sel={};load(true)};

  function periodRange(k){
    const t=new Date(),y=t.getFullYear(),m=t.getMonth();
    if(k==='week'){const d=(t.getDay()+6)%7;return [iso(new Date(y,m,t.getDate()-d)),iso(new Date(y,m,t.getDate()-d+6))]}
    if(k==='month')return [iso(new Date(y,m,1)),iso(new Date(y,m+1,0))];
    if(k==='last')return [iso(new Date(y,m-1,1)),iso(new Date(y,m,0))];
    if(k==='fy'){const sy=m>=2?y:y-1;return [sy+'-03-01',iso(new Date(sy+1,2,0))]}
    return ['0000-01-01','9999-12-31'];
  }
  function filtered(){
    const [a,b]=periodRange(T.period);
    return T.rows.filter(r=>r.work_date>=a&&r.work_date<=b&&(!T.cust||r.client_id===T.cust)&&(!T.user||r.user_id===T.user)&&(!T.stat||r.status===T.stat)
      &&(T.preset==='all'||(T.preset==='pending'&&r.status==='Pending')||(T.preset==='unbilled'&&r.status==='Approved'&&!r.billed)||(T.preset==='billed'&&r.billed)));
  }
  const opts=(list,cur,first)=>(first?`<option value="">${first}</option>`:'')+list.map(([v,l])=>`<option value="${esc(v)}" ${cur===v?'selected':''}>${esc(l)}</option>`).join('');

  /* ---------- list ---------- */
  function drawer(o){
    const done=o.status==='Approved',mins=Math.round(o.hours*60),cl=T.clients.find(x=>x.id===o.client_id);
    const head=`<div class="tsdh"><b>${esc(o.who)}'s Log Entry</b><div class="row" style="gap:6px"><button class="btn ghost sm" data-act="tsEditToggle" aria-label="Edit entry" title="Edit">✎</button><button class="btn ghost sm" data-act="tsClose" aria-label="Close" title="Close">✕</button></div></div>`;
    if(T.edit)return `<aside class="tsdrawer" aria-label="Edit log entry">${head}<form id="tsEditForm" class="form" style="grid-template-columns:1fr;padding:14px" novalidate>
      <label>Date<input type="date" id="tsEDate" value="${esc(o.work_date)}"></label>
      <label>Customer<select id="tsECust">${opts(T.clients.map(c=>[c.id,c.name]),o.client_id)}</select></label>
      <label>Task<input type="text" id="tsETask" value="${esc(o.task)}" maxlength="200"></label>
      <label>Hours<input type="number" id="tsEHrs" min="0.25" max="24" step="0.25" value="${o.hours}"></label>
      <label>Notes<textarea id="tsENotes" rows="3" maxlength="1000">${esc(o.notes||'')}</textarea></label>
      <div class="row"><button class="btn" type="submit">Save changes</button><button class="btn ghost" type="button" data-act="tsEditToggle">Cancel</button></div></form></aside>`;
    return `<aside class="tsdrawer" aria-label="Log entry details">${head}
      <div class="tstime"><span class="badge2 ${o.billed?'ok':''}">${done?(o.billed?'Billed':'Unbilled'):esc(o.status)}</span><div>${esc(fd(o.work_date))}</div><div class="big">${pad(Math.floor(mins/60))} <small>hrs</small> : ${pad(mins%60)} <small>mins</small></div></div>
      <div class="tstabs" role="tablist"><button role="tab" aria-selected="${T.dTab==='details'}" data-act="tsDTab" data-t="details">Other Details</button><button role="tab" aria-selected="${T.dTab==='comments'}" data-act="tsDTab" data-t="comments">Comments</button></div>
      ${T.dTab==='details'?`<dl class="tsdl"><dt>Customer Name :</dt><dd>${esc(o.cust)}</dd><dt>Task Name :</dt><dd>${esc(o.task)}</dd><dt>User Name :</dt><dd>${esc(o.who)}</dd><dt>Approval :</dt><dd>${pill(o.status,stc(o.status))}</dd>
        <dt>Billing :</dt><dd>${done?(o.billed?'Billed':'Unbilled')+(cl&&cl.billable?` (${money(o.hours*cl.hourly_rate)} at ${money(cl.hourly_rate)}/h)`:' (not billable)'):'Not billable until approved'}</dd><dt>Notes :</dt><dd>${o.notes?esc(o.notes):'<span class="note">None</span>'}</dd></dl>
        <div class="row" style="padding:0 14px 14px;flex-wrap:wrap">${o.status==='Pending'?`<button class="btn sm" data-act="tsDecide" data-ok="1" data-ids="${esc(o.id)}">Approve</button><button class="btn sm bad" data-act="tsDecide" data-ok="0" data-ids="${esc(o.id)}">Reject</button>`:''}
        ${done?`<button class="btn sm ghost" data-act="tsBill" data-flag="${o.billed?0:1}" data-ids="${esc(o.id)}">${o.billed?'Mark as unbilled':'Mark as billed'}</button>`:''}</div>`
        :`<p class="note" style="padding:14px;margin:0">Comments are not available yet.</p>`}
    </aside>`;
  }
  function listHTML(){
    const rows=filtered(),shown=rows.slice(0,T.limit),total=rows.reduce((s,r)=>s+r.hours,0),selIds=Object.keys(T.sel).filter(k=>T.sel[k]);
    const o=T.open?T.rows.find(r=>r.id===T.open):null;
    const users=Object.entries(T.names).map(([id,n])=>[id,n]).sort((a,b)=>a[1].localeCompare(b[1]));
    return `<div class="tsw ${o?'withpanel':''}"><div class="tsmain">
      <div class="tshead"><select class="tstitle" id="tsPreset" aria-label="Timesheet view">${opts([['all','All Timesheets'],['pending','Waiting for approval'],['unbilled','Approved, unbilled'],['billed','Billed']],T.preset)}</select>
        <div class="row" style="flex-wrap:wrap"><button class="btn ghost sm" data-act="tsCsv">Export CSV</button><button class="btn ghost sm" data-act="tsView" data-v="summary">Summary</button><button class="btn ghost sm" data-act="tsView" data-v="customers">Customers</button></div></div>
      <div class="tsfilters" role="group" aria-label="View by"><b>VIEW BY:</b>
        <label>Period <select id="tsPeriod">${opts([['all','All'],['week','This week'],['month','This month'],['last','Last month'],['fy','This financial year']],T.period)}</select></label>
        <label><select id="tsCust" aria-label="Customer">${opts(T.clients.map(c=>[c.id,c.name]),T.cust,'All customers')}</select></label>
        <label><select id="tsUser" aria-label="User">${opts(users,T.user,'All users')}</select></label>
        <label>Approvals <select id="tsStat">${opts([['Pending','Pending'],['Approved','Approved'],['Rejected','Rejected'],['Draft','Draft']],T.stat,'All')}</select></label></div>
      <div class="err" id="tsErr" role="alert"></div>
      ${selIds.length?`<div class="tsbulk" role="toolbar" aria-label="Bulk actions"><b>${selIds.length} selected</b><button class="btn sm" data-act="tsDecide" data-ok="1" data-ids="${esc(selIds.join(','))}">Approve</button><button class="btn sm ghost" data-act="tsDecide" data-ok="0" data-ids="${esc(selIds.join(','))}">Reject</button><button class="btn sm ghost" data-act="tsBill" data-flag="1" data-ids="${esc(selIds.join(','))}">Mark billed</button><button class="btn sm ghost" data-act="tsBill" data-flag="0" data-ids="${esc(selIds.join(','))}">Mark unbilled</button><button class="btn sm ghost" data-act="tsClear">Clear</button></div>`:''}
      <div class="panel" style="padding:0"><div class="tbl"><table class="tst" style="min-width:700px"><thead><tr><th style="width:34px"><input type="checkbox" id="tsAll" aria-label="Select all shown" ${shown.length&&shown.every(r=>T.sel[r.id])?'checked':''}></th><th>Date</th><th>Customer</th><th>Task</th><th>User</th><th class="n">Time</th><th>Approvals</th><th>Billing</th></tr></thead><tbody>
      ${shown.map(r=>`<tr data-row="${esc(r.id)}" class="${T.open===r.id?'sel':''}"><td><input type="checkbox" data-tssel="${esc(r.id)}" ${T.sel[r.id]?'checked':''} aria-label="Select entry"></td>
        <td><button class="tslink" data-act="tsOpen" data-id="${esc(r.id)}">${esc(fd(r.work_date))}</button></td><td>${esc(r.cust)}</td><td>${esc(r.task)}${r.notes?`<div class="note" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.notes)}</div>`:''}</td><td>${esc(r.who)}</td>
        <td class="n">${hm(r.hours)}</td><td>${pill(r.status,stc(r.status))}</td><td>${r.status==='Approved'?pill(r.billed?'Billed':'Unbilled',r.billed?'ok':'warn'):'<span class="note">--</span>'}</td></tr>`).join('')
        ||`<tr><td colspan="8" class="note">${T.rows.length?'No timesheet entries match these filters.':'No time has been logged yet.'}</td></tr>`}
      </tbody></table></div>
      <div class="tsfoot"><span>Total Count: <b>${rows.length}</b> &nbsp; Total time: <b>${hm(total)}</b>${T.truncated?' (latest 5,000 entries)':''}</span>${rows.length>shown.length?`<button class="btn ghost sm" data-act="tsMore">Show more (${rows.length-shown.length} left)</button>`:''}</div></div>
      </div>${o?drawer(o):''}</div>`;
  }

  /* ---------- summary and customers ---------- */
  function summaryHTML(){
    const cl=T.clients,ap=T.rows.filter(r=>r.status==='Approved');
    const val=(r)=>{const c=cl.find(x=>x.id===r.client_id);return c&&c.billable?r.hours*c.hourly_rate:0};
    const th=ap.reduce((s,r)=>s+r.hours,0),bh=ap.filter(r=>{const c=cl.find(x=>x.id===r.client_id);return c&&c.billable}).reduce((s,r)=>s+r.hours,0);
    const unb=ap.filter(r=>!r.billed).reduce((s,r)=>s+val(r),0),bil=ap.filter(r=>r.billed).reduce((s,r)=>s+val(r),0);
    const [a,b]=periodRange(T.sumPeriod),by={};
    T.rows.forEach(r=>{if(r.work_date<a||r.work_date>b)return;if(T.sumInc==='approved'&&r.status!=='Approved')return;
      const g=by[r.client_id]=by[r.client_id]||{name:r.cust,hours:0,tasks:{}},k=String(r.task||'').trim().toLowerCase(),t=g.tasks[k]=g.tasks[k]||{task:String(r.task||'').trim()||'(no description)',hours:0,n:0,who:new Set()};
      g.hours+=r.hours;t.hours+=r.hours;t.n++;t.who.add(r.user_id)});
    const groups=Object.entries(by).map(([id,g])=>{const c=cl.find(x=>x.id===id);return {...g,amt:c&&c.billable?g.hours*c.hourly_rate:0,billable:!!(c&&c.billable),tasks:Object.values(g.tasks).sort((x,y)=>y.hours-x.hours)}}).sort((x,y)=>y.hours-x.hours);
    const tot=groups.reduce((s,g)=>s+g.hours,0);
    return `<div class="tshead"><h2 style="margin:0">Summary</h2><button class="btn ghost sm" data-act="tsView" data-v="list">← All timesheets</button></div>
    <div class="stack"><div class="tiles"><div class="tile"><b>${hm(th)}</b><span>Approved time</span></div><div class="tile"><b>${hm(bh)}</b><span>Billable time</span></div><div class="tile"><b>${money(unb)}</b><span>Unbilled amount</span></div><div class="tile"><b>${money(bil)}</b><span>Billed amount</span></div></div>
    <div class="panel"><h3>Time spent on tasks</h3><div class="form" style="margin-bottom:10px"><label>Period<select data-tsum="sumPeriod">${opts([['month','This month'],['last','Last month'],['fy','This financial year'],['all','All time']],T.sumPeriod)}</select></label>
      <label>Include<select data-tsum="sumInc">${opts([['approved','Approved time only'],['all','All logged time']],T.sumInc)}</select></label></div>
      <p class="note" style="margin-top:0"><b>${hm(tot)}</b> across ${groups.length} customer${groups.length===1?'':'s'}.</p>
      <div class="tbl"><table style="min-width:620px"><thead><tr><th>Customer / task</th><th class="n">People</th><th class="n">Entries</th><th class="n">Time</th><th class="n">Share</th><th class="n">Amount</th></tr></thead><tbody>
      ${groups.length?groups.map(g=>`<tr class="total"><td><b>${esc(g.name)}</b></td><td></td><td class="n">${g.tasks.reduce((s,t)=>s+t.n,0)}</td><td class="n"><b>${hm(g.hours)}</b></td><td class="n">${tot?Math.round(g.hours/tot*100):0}%</td><td class="n">${g.billable?money(g.amt):'Not billable'}</td></tr>
        ${g.tasks.map(t=>`<tr><td style="padding-left:22px">${esc(t.task)}</td><td class="n">${t.who.size}</td><td class="n">${t.n}</td><td class="n">${hm(t.hours)}</td><td class="n">${g.hours?Math.round(t.hours/g.hours*100):0}%</td><td class="n"></td></tr>`).join('')}`).join(''):'<tr><td colspan="6" class="note">No time recorded for this selection.</td></tr>'}
      </tbody></table></div></div></div>`;
  }
  function customersHTML(){
    const cl=T.clients;
    return `<div class="tshead"><h2 style="margin:0">Customers</h2><button class="btn ghost sm" data-act="tsView" data-v="list">← All timesheets</button></div>
    <div class="stack"><div class="panel"><h3>Add customer</h3><form class="form" id="tsClientForm" novalidate><label>Customer name<input id="tsCName" required maxlength="120"></label>
      <label>Hourly rate (N$)<input id="tsCRate" type="number" min="0" step="0.01" value="0"></label><label>Billing<select id="tsCBill"><option value="1">Billable</option><option value="0">Not billable</option></select></label><button class="btn" type="submit">Add customer</button></form><div class="err" id="tsErr" role="alert"></div></div>
      <div class="panel"><h3>Customers</h3><div class="tbl"><table><thead><tr><th>Customer</th><th>Rate per hour</th><th>Billing</th><th class="n">Approved time</th><th></th></tr></thead><tbody>
      ${cl.length?cl.map(c=>{const h=T.rows.filter(r=>r.client_id===c.id&&r.status==='Approved').reduce((s,r)=>s+r.hours,0);return `<tr><td>${esc(c.name)}</td><td><input type="number" min="0" step="0.01" value="${c.hourly_rate}" data-tsrate="${esc(c.id)}" style="width:100px" aria-label="Rate for ${esc(c.name)}"></td>
        <td><button class="btn ghost sm" data-act="tsBillable" data-id="${esc(c.id)}">${c.billable?'Billable':'Not billable'}</button></td><td class="n">${hm(h)}</td><td><button class="btn ghost sm" data-act="tsRemoveClient" data-id="${esc(c.id)}">Remove</button></td></tr>`}).join(''):'<tr><td colspan="5" class="note">No customers yet. Add one above.</td></tr>'}
      </tbody></table></div></div></div>`;
  }
  function vTimesheet(){
    if(T.rows===null){load();return `<h2>Timesheet</h2><p class="sub">Loading…</p>`}
    return T.view==='summary'?summaryHTML():T.view==='customers'?customersHTML():`<h2 class="sr-only" style="position:absolute;left:-9999px">Timesheet</h2>${listHTML()}`;
  }
  VIEWS.clients=vTimesheet;

  /* ---------- actions ---------- */
  const lock=on=>document.querySelectorAll('#view button,#view select,#view input').forEach(b=>{b.disabled=on});
  async function act(fn,after){
    if(T.busy)return;T.busy=true;err('');lock(true);
    let ok=false;try{await fn();ok=true}catch(x){err(x.message);toast(x.message)}
    T.busy=false;lock(false);if(ok){after&&after();reload()}else render();
  }
  const csvCell=v=>{v=String(v==null?'':v);if(/^[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'};
  document.addEventListener('change',e=>{
    const t=e.target;if(!t||!t.id&&!(t.dataset&&(t.dataset.tssel||t.dataset.tsrate||t.dataset.tsum)))return;
    if(!document.getElementById('view')||!document.getElementById('view').contains(t))return;
    if(T.rows===null)return;
    const set=(k,v)=>{e.stopImmediatePropagation();T[k]=v;T.limit=100;render()};
    if(t.id==='tsPreset'){e.stopImmediatePropagation();T.preset=t.value;T.limit=100;T.sel={};return render()}
    if(t.id==='tsPeriod')return set('period',t.value);if(t.id==='tsCust')return set('cust',t.value);if(t.id==='tsUser')return set('user',t.value);if(t.id==='tsStat')return set('stat',t.value);
    if(t.id==='tsAll'){e.stopImmediatePropagation();filtered().slice(0,T.limit).forEach(r=>{T.sel[r.id]=t.checked});return render()}
    if(t.dataset.tssel){e.stopImmediatePropagation();T.sel[t.dataset.tssel]=t.checked;return render()}
    if(t.dataset.tsum){e.stopImmediatePropagation();T[t.dataset.tsum]=t.value;return render()}
    if(t.dataset.tsrate){e.stopImmediatePropagation();const v=parseFloat(t.value);if(!(v>=0)){toast('Enter a valid rate');return render()}
      return act(async()=>{const r=await sb().from('clients').update({hourly_rate:v}).eq('id',t.dataset.tsrate);if(r.error)throw new Error(rpcMsg(r.error.message))},()=>toast('Rate updated'))}
  },true);
  document.addEventListener('submit',e=>{
    const f=e.target.id;if(f!=='tsClientForm'&&f!=='tsEditForm')return;
    e.preventDefault();e.stopImmediatePropagation();
    if(f==='tsClientForm'){
      const name=$('#tsCName').value.trim(),rate=parseFloat($('#tsCRate').value)||0;
      if(!name)return err('Enter the customer name.');if(rate<0)return err('Rate cannot be negative.');
      if(T.clients.some(c=>c.name.toLowerCase()===name.toLowerCase()))return err('That customer already exists.');
      return act(async()=>{const r=await sb().from('clients').insert({name,hourly_rate:rate,billable:$('#tsCBill').value==='1'});if(r.error)throw new Error(rpcMsg(r.error.message))},()=>toast(name+' added'));
    }
    const hrs=parseFloat($('#tsEHrs').value),date=$('#tsEDate').value,task=$('#tsETask').value.trim();
    if(!(hrs>=0.25&&hrs<=24))return toast('Hours must be between 0.25 and 24');if(!date)return toast('Choose a date');if(!task)return toast('Enter the task');
    act(async()=>{const r=await sb().from('time_entries').update({work_date:date,client_id:$('#tsECust').value,task,hours:hrs,notes:$('#tsENotes').value.trim()||null}).eq('id',T.open);if(r.error)throw new Error(rpcMsg(r.error.message))},()=>{T.edit=false;toast('Entry updated')});
  },true);
  document.addEventListener('click',e=>{
    if(e.target.closest&&e.target.closest('[data-act^="ts"]')==null){
      const tr=e.target.closest&&e.target.closest('tr[data-row]');
      if(tr&&!e.target.closest('input,button,a,select,label')&&T.rows&&document.getElementById('view').contains(tr)){e.stopImmediatePropagation();T.open=tr.dataset.row;T.edit=false;T.dTab='details';render()}
      return;
    }
    const b=e.target.closest('[data-act^="ts"]');e.stopImmediatePropagation();
    const d=b.dataset;
    switch(d.act){
      case 'tsOpen':T.open=d.id;T.edit=false;T.dTab='details';return render();
      case 'tsClose':T.open=null;T.edit=false;return render();
      case 'tsEditToggle':T.edit=!T.edit;return render();
      case 'tsDTab':T.dTab=d.t;return render();
      case 'tsView':T.view=d.v;T.open=null;T.edit=false;window.scrollTo(0,0);return render();
      case 'tsMore':T.limit+=100;return render();
      case 'tsClear':T.sel={};return render();
      case 'tsCsv':{const rows=filtered();if(!rows.length)return toast('Nothing to export');
        const csv=[['Date','Customer','Task','User','Hours','Time','Approval','Billing','Notes'].map(csvCell).join(',')].concat(rows.map(r=>[r.work_date,r.cust,r.task,r.who,r.hours,hm(r.hours),r.status,r.status==='Approved'?(r.billed?'Billed':'Unbilled'):'',r.notes||''].map(csvCell).join(','))).join('\r\n');
        const u=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),l=document.createElement('a');l.href=u;l.download='timesheets.csv';document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);return}
      case 'tsDecide':{
        const ok=d.ok==='1',ids=d.ids.split(','),targets=T.rows.filter(r=>ids.includes(r.id)&&r.status==='Pending');
        if(!targets.length)return toast('Only entries waiting for approval can be approved or rejected.');
        if(!ok&&ids.length>1&&!confirm('Reject '+targets.length+' entries?'))return;
        return act(async()=>{
          const r=await sb().from('time_entries').update({status:ok?'Approved':'Rejected',decided_by:state.user.id,decided_at:new Date().toISOString()}).in('id',targets.map(x=>x.id)).eq('status','Pending');
          if(r.error)throw new Error(rpcMsg(r.error.message));
          const per={};targets.forEach(x=>{per[x.user_id]=(per[x.user_id]||0)+1});
          await sb().from('notifications').insert(Object.entries(per).map(([u,n])=>({kind:'Timesheet',message:`${n} of your timesheet ${n>1?'entries were':'entry was'} ${ok?'approved':'rejected. Please check and resubmit'}.`,to_user_id:u})));
        },()=>toast(targets.length+(ok?' approved':' rejected')))}
      case 'tsBill':{
        const flag=d.flag==='1',ids=d.ids.split(','),targets=T.rows.filter(r=>ids.includes(r.id)&&r.status==='Approved');
        if(!targets.length)return toast('Only approved entries can be marked billed or unbilled.');
        return act(async()=>{const r=await sb().from('time_entries').update({billed:flag}).in('id',targets.map(x=>x.id));if(r.error)throw new Error(rpcMsg(r.error.message))},()=>toast(targets.length+(flag?' marked billed':' marked unbilled')))}
      case 'tsBillable':{const c=T.clients.find(x=>x.id===d.id);if(!c)return;
        return act(async()=>{const r=await sb().from('clients').update({billable:!c.billable}).eq('id',d.id);if(r.error)throw new Error(rpcMsg(r.error.message))},()=>toast(c.name+(c.billable?' is not billable':' is billable')))}
      case 'tsRemoveClient':{const c=T.clients.find(x=>x.id===d.id);if(!c||!confirm('Remove '+c.name+'?'))return;
        return act(async()=>{const r=await sb().from('clients').delete().eq('id',d.id);if(r.error)throw new Error(rpcMsg(r.error.message))},()=>toast(c.name+' removed'))}
    }
  },true);
})();
