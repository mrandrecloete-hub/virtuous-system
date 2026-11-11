/* Admin TIMESHEET page (live mode, and sample data in ?demo through a small in-memory adapter). Replaces the old "Clients & billing" screen.
   Laid out like a time-tracking list: All Timesheets title, Summary, list/calendar toggle, Start timer, New Log Entry,
   View by (period, customer, project, user), columns Date, Project, Customer, Task, User, Time, Approvals, Billing Status.
   Project needs migration 0015; without it the page still works and shows '--' for project.
   List: every time entry with filters (period, customer, user, approvals), checkboxes for bulk actions,
   and a log-entry panel (details, edit, approve/reject, billed/unbilled).
   Summary: billing figures and time spent on tasks. Customers: add customers, rates and billable settings.
   Billing counts APPROVED entries; only admins can mark entries billed (enforced in the database). */
(function(){
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>LIVE?window.VIRTUOSO.client:DEMO;
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const parse=s=>new Date(s+'T00:00:00');
  const fd=s=>parse(s).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  const hm=h=>{const m=Math.round(h*60);return pad(Math.floor(m/60))+':'+pad(m%60)};
  const money=n=>typeof NAD==='function'?NAD(n):'N$ '+(+n||0).toFixed(2);
  const isAdm=()=>state.user&&state.user.type==='admin';
  const fresh=()=>({uid:null,view:'list',preset:'all',period:'all',cust:'',user:'',stat:'',sel:{},open:null,edit:false,dTab:'details',limit:100,rows:null,clients:null,names:null,
    loading:false,busy:false,truncated:false,sumPeriod:'month',sumInc:'approved',mode:'list',proj:'',menu:null,newOpen:false,prefill:null,calM:null,noProject:false});
  let T=fresh();
  setInterval(()=>{const u=state.user?state.user.id:null;if(u!==T.uid){T=fresh();T.uid=u}},700);
  const err=m=>{const e=document.getElementById('tsErr');if(e)e.textContent=m||''};
  const rpcMsg=m=>/not permitted|row-level|policy|permission/i.test(m||'')?'You are not allowed to do that.':/foreign key|violates/i.test(m||'')?'That is in use. Mark it not billable instead.':/duplicate|unique/i.test(m||'')?'That already exists.':'Something went wrong. Try again.';

  /* ---------- sample-data adapter (?demo): the page talks to this instead of Supabase ---------- */
  const MON={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const dayISO=day=>{const m=/(\d{1,2})\s+([A-Za-z]{3})/.exec(day||'');if(!m||!(m[2] in MON))return '2026-10-01';const mo=MON[m[2]];return (mo<2?2027:2026)+'-'+pad(mo+1)+'-'+pad(+m[1])};
  const dayLabel=k=>parse(k).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).replace(',','');
  const SMAP={Submitted:'Pending'};
  function demoSeed(){
    if(LIVE||state.tsSeeded||!state.data)return;state.tsSeeded=true;
    const add=(u,wd,client,project,task,notes,hrs,status,billed)=>{const d=state.data[u];if(d)d.entries.push({id:uid(),day:dayLabel(wd),wd,client,project,task,notes,hrs,status,billed:!!billed})};
    add('u2','2026-10-01','Kalahari Mining Ltd','Year-end Audit 2026','Re-allocating - shifting of transactions','The shifting for this day was approximately 40 lines',5,'Approved');
    add('u2','2026-10-15','Benguela Fisheries','Monthly Bookkeeping','Payment shifting and reallocation','Payments shifted and checked against the bank statement',0.25,'Approved');
    add('u2','2026-10-28','Benguela Fisheries','Monthly Bookkeeping','Payment shifting and reallocation','Payments have been shifted - audit trail updated',1,'Approved',true);
    add('u3','2026-10-21','Swakop Retail Group','VAT Returns 2026','Annual income tax and provisional returns','Provisional payment and GST schedule',0.25,'Approved');
    add('u3','2026-10-26','Swakop Retail Group','VAT Returns 2026','Annual income tax and provisional returns','',2.35,'Approved');
    add('u4','2026-11-02','Kalahari Mining Ltd','Year-end Audit 2026','Monthly, quarterly and annual processing','Recon and process: account balances reconciled',5,'Submitted');
    add('u4','2026-11-09','Benguela Fisheries','Monthly Bookkeeping','Monthly, quarterly and annual processing','Call account and current account',3,'Submitted');
    add('u2','2026-11-09','Benguela Fisheries','Monthly Bookkeeping','Monthly, quarterly and annual processing','Trust call account',3,'Submitted');
    add('u3','2026-11-10','Kalahari Mining Ltd','Year-end Audit 2026','Monthly, quarterly and annual processing','Credit card: duplicates removed',1,'Submitted');
    add('u3','2026-09-02','Swakop Retail Group','Compliance 2027','Annual duties and 2026 statutory filings','Annual duties and filing fees',3,'Approved');
    add('u2','2026-10-15','Internal','Staff Development','Team training','',1,'Approved');
  }
  function demoFrom(table){
    const o={op:'select',f:[],ord:null,lim:1e9,row:null};
    const api={select(){return api},update(r){o.op='update';o.row=r;return api},insert(r){o.op='insert';o.row=r;return api},delete(){o.op='delete';return api},
      eq(c,v){o.f.push(r=>String(r[c])===String(v));return api},in(c,vs){o.f.push(r=>vs.includes(r[c]));return api},
      order(c,x){o.ord=[c,!(x&&x.ascending===false)];return api},limit(n){o.lim=n;return api},then(res,rej){return Promise.resolve().then(run).then(res,rej)}};
    const ok=d=>({data:d,error:null}),bad=m=>({data:null,error:{message:m}});
    const cl=c=>({id:c.id,name:c.name,hourly_rate:c.rate,billable:c.bill});
    function entryRows(){
      const out=[];state.users.forEach(u=>(state.data[u.id]?.entries||[]).forEach(e=>{
        if(!e.id)e.id=uid();const c=state.clients.find(x=>x.name===e.client);
        out.push({id:e.id,user_id:u.id,client_id:c?c.id:null,work_date:e.wd||dayISO(e.day),task:e.task,hours:e.hrs,status:SMAP[e.status]||e.status,billed:!!e.billed,notes:e.notes||null,project:e.project||null,decided_at:null,_e:e,_u:u})}));
      return out;
    }
    function run(){
      demoSeed();
      if(table==='clients'){
        let rows=state.clients.map(cl);
        if(o.op==='insert'){const r=o.row;if(state.clients.some(c=>c.name.toLowerCase()===String(r.name).toLowerCase()))return bad('duplicate key');state.clients.push({id:uid(),name:r.name,rate:+r.hourly_rate||0,bill:r.billable!==false});return ok([])}
        rows=rows.filter(r=>o.f.every(f=>f(r)));
        if(o.op==='update'){rows.forEach(r=>{const c=state.clients.find(x=>x.id===r.id);if('hourly_rate' in o.row)c.rate=+o.row.hourly_rate;if('billable' in o.row)c.bill=!!o.row.billable});return ok(rows)}
        if(o.op==='delete'){for(const r of rows){const c=state.clients.find(x=>x.id===r.id);if(state.users.some(u=>(state.data[u.id]?.entries||[]).some(e=>e.client===c.name)))return bad('violates foreign key');state.clients.splice(state.clients.indexOf(c),1)}return ok([])}
        return ok(rows.sort((a,b)=>a.name.localeCompare(b.name)));
      }
      if(table==='profiles')return ok(state.users.map(u=>({id:u.id,name:u.name})));
      if(table==='notifications')return ok([]);
      if(table!=='time_entries')return ok([]);
      if(o.op==='insert'){
        const r=o.row,u=state.users.find(x=>x.id===r.user_id)||state.user,c=state.clients.find(x=>x.id===r.client_id);if(!c)return bad('foreign key');
        state.data[u.id].entries.push({id:uid(),day:dayLabel(r.work_date),wd:r.work_date,client:c.name,project:r.project||'',task:r.task,notes:r.notes||'',hrs:+r.hours,status:r.status==='Pending'?'Submitted':r.status,billed:!!r.billed});return ok([]);
      }
      let m=entryRows().filter(r=>o.f.every(f=>f(r)));
      if(o.op==='update'){
        m.forEach(x=>{const e=x._e,r=o.row;
          if('status' in r)e.status=r.status==='Pending'?'Submitted':r.status;
          if('billed' in r)e.billed=!!r.billed;
          if('work_date' in r){e.wd=r.work_date;e.day=dayLabel(r.work_date)}
          if('client_id' in r){const c=state.clients.find(c=>c.id===r.client_id);if(c)e.client=c.name}
          if('task' in r)e.task=r.task;if('hours' in r)e.hrs=+r.hours;if('notes' in r)e.notes=r.notes||'';if('project' in r)e.project=r.project||''});
        state.approvals.forEach(a=>{if(a.kind==='time'&&a.status==='Pending'&&a.list&&a.list.length&&a.list.every(e=>e.status!=='Submitted'))a.status=a.list.every(e=>e.status==='Approved')?'Approved':'Rejected'});
        return ok(m);
      }
      if(o.op==='delete'){m.forEach(x=>{const a=state.data[x._u.id].entries;a.splice(a.indexOf(x._e),1)});return ok([])}
      if(o.ord)m.sort((a,b)=>(a[o.ord[0]]<b[o.ord[0]]?-1:a[o.ord[0]]>b[o.ord[0]]?1:0)*(o.ord[1]?1:-1));
      return ok(m.slice(0,o.lim));
    }
    return api;
  }
  const DEMO={from:demoFrom};

  const css=document.createElement('style');
  css.textContent=`
  .tsw{display:grid;grid-template-columns:minmax(0,1fr);gap:0;align-items:start}
  .tsw.withpanel{grid-template-columns:minmax(0,1fr) 340px}
  @media(max-width:1100px){.tsw.withpanel{grid-template-columns:1fr}.tsw.withpanel .tsmain{display:none}}
  :root{--tsblue:#1f66d1;--tsbtn:#2f6fe4;--tsunb:#e5532d}
  @media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--tsblue:#7aa8ff;--tsunb:#ff8a65}}
  :root[data-theme="dark"]{--tsblue:#7aa8ff;--tsunb:#ff8a65}
  .tsmain{background:var(--surface);border:1px solid var(--line);border-radius:6px;min-width:0}
  .tshead{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 16px}
  select.tstitle{font-weight:600;font-size:20px;line-height:1.2;font-family:inherit;border:0;background:transparent;color:var(--fg);padding:4px 26px 4px 0;width:auto;cursor:pointer;max-width:100%;min-height:36px}
  .tsacts{display:flex;align-items:center;gap:10px;flex-wrap:wrap;position:relative}
  .tsacts .lk{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;color:var(--tsblue);font:inherit;font-size:13px;cursor:pointer;min-height:36px;padding:0 4px}
  .tsacts svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  .tsseg{display:inline-flex;border:1px solid var(--line);border-radius:999px;overflow:hidden;background:var(--bg)}
  .tsseg button{border:0;background:transparent;color:var(--muted);width:40px;min-height:34px;cursor:pointer;display:grid;place-items:center;padding:0}
  .tsseg button[aria-pressed=true]{background:var(--surface);color:var(--tsblue);box-shadow:0 0 0 1px var(--line) inset}
  .tsb{display:inline-flex;align-items:center;gap:6px;border:0;background:var(--tsbtn);color:#fff;font:inherit;font-size:13px;font-weight:600;padding:0 14px;min-height:36px;border-radius:4px;cursor:pointer}
  .tsb:hover{filter:brightness(1.08)}.tsb.run{background:#d6432f}
  .tssplit{display:inline-flex;gap:1px}.tssplit .tsb:first-child{border-radius:4px 0 0 4px}.tssplit .tsb.caret{border-radius:0 4px 4px 0;padding:0 10px}
  .tsmore{border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:4px;min-height:36px;width:40px;cursor:pointer;font-size:18px;line-height:1}
  .tsmenu{position:absolute;right:0;top:42px;z-index:20;min-width:200px;background:var(--surface);border:1px solid var(--line);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:4px}
  .tsmenu button{display:block;width:100%;text-align:left;border:0;background:transparent;color:var(--fg);font:inherit;font-size:13px;padding:9px 12px;border-radius:4px;cursor:pointer;min-height:36px}
  .tsmenu button:hover{background:var(--accent-soft)}
  .tsfilters{display:flex;gap:0;align-items:center;flex-wrap:wrap;padding:6px 16px;background:var(--bg);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
  .tsfilters b{font-size:11px;letter-spacing:.05em;color:var(--fg);margin-right:12px}
  .tsfilters label{display:flex;flex-direction:row;align-items:center;gap:6px;margin:0;font-weight:400;font-size:13px;color:var(--muted);padding:0 14px;border-left:1px solid var(--line)}
  .tsfilters label:first-of-type{border-left:0;padding-left:0}
  .tsfilters label svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.7;flex:0 0 auto}
  .tsfilters select{width:auto;min-width:0;max-width:200px;min-height:32px;border:0;background:transparent;color:var(--muted);font:inherit;font-size:13px;padding:0 4px;cursor:pointer}
  .tsfilters select.on{color:var(--fg);font-weight:600}
  .tsbulk{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 16px;background:#0a1b3f;color:#fff}
  .tsbulk .btn{min-height:34px}
  table.tst{width:100%;border-collapse:collapse;font-size:13px}
  table.tst th{font-size:11px;letter-spacing:.04em;color:var(--muted);text-transform:uppercase;white-space:nowrap;text-align:left;font-weight:600;padding:10px 10px;border-bottom:1px solid var(--line);background:var(--surface)}
  table.tst th.n,table.tst td.n{text-align:right}
  table.tst td{vertical-align:top;padding:12px 10px;border-bottom:1px solid var(--line);color:var(--fg)}
  table.tst td.nw{white-space:nowrap}
  table.tst tr[data-row]{cursor:pointer}table.tst tr[data-row]:hover td{background:color-mix(in srgb,var(--accent) 5%,transparent)}
  table.tst tr.sel td{background:color-mix(in srgb,var(--accent) 12%,transparent)}
  .tslink{background:none;border:0;padding:0;color:var(--tsblue);font:inherit;font-size:13px;cursor:pointer;text-align:left;min-height:0}
  .tslink:hover{text-decoration:underline}
  .tsnote{font-size:12px;color:var(--fg);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}
  .tsunb{color:var(--tsunb)}.tsbil{color:#1f8a4c}.tsdim{color:var(--muted)}
  .tsfoot{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;padding:12px 16px;color:var(--muted);font-size:13px}
  .tscal{padding:12px 16px}
  .tscalh{display:flex;align-items:center;gap:10px;margin-bottom:8px}.tscalh b{font-size:16px;min-width:140px;text-align:center}
  .tscalg{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-top:1px solid var(--line);border-left:1px solid var(--line)}
  .tscalg>div{border-right:1px solid var(--line);border-bottom:1px solid var(--line);min-height:92px;padding:4px 6px;font-size:12px;min-width:0}
  .tscalg .dow{min-height:0;font-weight:600;color:var(--muted);text-transform:uppercase;font-size:11px;padding:6px}
  .tscalg .off{background:var(--bg);opacity:.6}
  .tscalg .dn{display:flex;justify-content:space-between;color:var(--muted)}.tscalg .dn em{font-style:normal;color:var(--fg);font-weight:600}
  .tscalg .ev{display:block;width:100%;text-align:left;border:0;background:color-mix(in srgb,var(--tsbtn) 14%,transparent);color:var(--fg);border-radius:3px;margin-top:3px;padding:2px 4px;font:inherit;font-size:11.5px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-height:0}
  @media(max-width:700px){.tscalg>div{min-height:60px;padding:2px 3px}.tscalg .ev{font-size:10.5px}.tshead{padding:10px 12px}.tsfilters{padding:6px 12px}}
  .tsdrawer{background:var(--surface);border:1px solid var(--line);border-radius:6px;margin-left:12px;position:sticky;top:8px;max-height:calc(100vh - 24px);overflow:auto}
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
    const cols='id,user_id,client_id,work_date,task,hours,status,billed,notes,decided_at';
    const q=c=>sb().from('time_entries').select(c).order('work_date',{ascending:false}).limit(5000);
    const [c,p]=await Promise.all([sb().from('clients').select('*').order('name'),sb().from('profiles').select('id,name')]);
    let e=await q(cols+',project');
    if(e.error){T.noProject=true;e=await q(cols)}
    T.clients=c.data||[];T.names=Object.fromEntries((p.data||[]).map(x=>[x.id,x.name]));
    T.truncated=(e.data||[]).length>=5000;
    T.rows=(e.data||[]).map(r=>({...r,project:r.project||'',hours:+r.hours,who:T.names[r.user_id]||'Unknown',cust:(T.clients.find(x=>x.id===r.client_id)||{name:'(removed customer)'}).name}));
    T.loading=false;render();
  }
  const reload=()=>{T.sel={};load(true)};

  function periodRange(k){
    const t=new Date(),y=t.getFullYear(),m=t.getMonth();
    if(k==='week'){const d=(t.getDay()+6)%7;return [iso(new Date(y,m,t.getDate()-d)),iso(new Date(y,m,t.getDate()-d+6))]}
    if(k==='month')return [iso(new Date(y,m,1)),iso(new Date(y,m+1,0))];
    if(k==='last')return [iso(new Date(y,m-1,1)),iso(new Date(y,m,0))];
    const D=(yy,mm,dd)=>iso(new Date(yy,mm,dd)),q=Math.floor(m/3)*3,d0=t.getDate(),wd=(t.getDay()+6)%7;
    if(k==='today')return [D(y,m,d0),D(y,m,d0)];
    if(k==='yesterday')return [D(y,m,d0-1),D(y,m,d0-1)];
    if(k==='prevweek')return [D(y,m,d0-wd-7),D(y,m,d0-wd-1)];
    if(k==='quarter')return [D(y,q,1),D(y,q+3,0)];
    if(k==='prevquarter')return [D(y,q-3,1),D(y,q,0)];
    if(k==='year')return [D(y,0,1),D(y,11,31)];
    if(k==='prevyear')return [D(y-1,0,1),D(y-1,11,31)];
    if(k==='fy'){const sy=m>=2?y:y-1;return [sy+'-03-01',iso(new Date(sy+1,2,0))]}
    return ['0000-01-01','9999-12-31'];
  }
  function filtered(){
    const [a,b]=periodRange(T.period);
    return T.rows.filter(r=>r.work_date>=a&&r.work_date<=b&&(!T.cust||r.client_id===T.cust)&&(!T.user||r.user_id===T.user)&&(!T.proj||r.project===T.proj)&&(!T.stat||r.status===T.stat)
      &&(T.preset==='all'||(T.preset==='pending'&&r.status==='Pending')||(T.preset==='unbilled'&&r.status==='Approved'&&!r.billed)||(T.preset==='billed'&&r.billed)));
  }
  const opts=(list,cur,first)=>(first?`<option value="">${first}</option>`:'')+list.map(([v,l])=>`<option value="${esc(v)}" ${cur===v?'selected':''}>${esc(l)}</option>`).join('');

  /* ---------- list ---------- */
  const IC={
    sum:'<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    list:'<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    cal:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    proj:'<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3"/></svg>',
    users:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M19 20a6 6 0 0 0-3-5.2"/></svg>'
  };
  const stdProj=()=>Array.isArray(window.VIRTUOSO_PROJECTS)?window.VIRTUOSO_PROJECTS:[];
  const projects=()=>[...new Set(stdProj().concat(T.rows.map(r=>r.project).filter(Boolean)))].sort((a,b)=>a.localeCompare(b));
  const billText=r=>{const c=T.clients.find(x=>x.id===r.client_id);if(r.billed)return '<span class="tsbil">Billed</span>';if(c&&!c.billable)return '<span class="tsdim">Non-billable</span>';return '<span class="tsunb">Unbilled</span>'};
  const apprText=r=>r.status==='Draft'?'--':r.status==='Approved'?'<span class="tsbil">Approved</span>':r.status==='Rejected'?'<span class="tsunb">Rejected</span>':'<span class="tsdim">Pending</span>';
  const todayISO=()=>(!LIVE&&state.today)||iso(new Date());
  function newForm(){
    const pf=T.prefill||{},users=Object.entries(T.names).sort((a,b)=>a[1].localeCompare(b[1]));
    return `<aside class="tsdrawer" aria-label="New log entry"><div class="tsdh"><b>New Log Entry</b><button class="btn ghost sm" data-act="tsClose" aria-label="Close" title="Close">✕</button></div>
      <form id="tsNewForm" class="form" style="grid-template-columns:1fr;padding:14px" novalidate>
      <label>Date<input type="date" id="tsNDate" value="${esc(pf.date||todayISO())}"></label>
      <label>User<select id="tsNUser">${opts(users,pf.user||state.user.id)}</select></label>
      <label>Customer<select id="tsNCust">${opts(T.clients.map(c=>[c.id,c.name]),pf.cust||'')}</select></label>
      ${T.noProject?'':`<label>Project (optional)<input type="text" id="tsNProj" list="tsProjList" maxlength="120" value="${esc(pf.proj||'')}"><datalist id="tsProjList">${projects().map(x=>`<option value="${esc(x)}">`).join('')}</datalist></label>`}
      <label>Task<input type="text" id="tsNTask" maxlength="200" value="${esc(pf.task||'')}"></label>
      <label>Hours<input type="number" id="tsNHrs" min="0.25" max="24" step="0.25" value="${esc(pf.hours||'')}" placeholder="e.g. 1.5"></label>
      <label>Notes<textarea id="tsNNotes" rows="3" maxlength="1000"></textarea></label>
      <div class="note" style="margin:0">Entries added here are approved straight away.</div>
      <div class="err" id="tsErr" role="alert"></div>
      <div class="row"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" data-act="tsClose">Cancel</button></div></form></aside>`;
  }
  function drawer(o){
    const done=o.status==='Approved',mins=Math.round(o.hours*60),cl=T.clients.find(x=>x.id===o.client_id);
    const head=`<div class="tsdh"><b>${esc(o.who)}'s Log Entry</b><div class="row" style="gap:6px"><button class="btn ghost sm" data-act="tsEditToggle" aria-label="Edit entry" title="Edit">✎</button><button class="btn ghost sm" data-act="tsClose" aria-label="Close" title="Close">✕</button></div></div>`;
    if(T.edit)return `<aside class="tsdrawer" aria-label="Edit log entry">${head}<form id="tsEditForm" class="form" style="grid-template-columns:1fr;padding:14px" novalidate>
      <label>Date<input type="date" id="tsEDate" value="${esc(o.work_date)}"></label>
      <label>Customer<select id="tsECust">${opts(T.clients.map(c=>[c.id,c.name]),o.client_id)}</select></label>
      ${T.noProject?'':`<label>Project (optional)<input type="text" id="tsEProj" list="tsProjList" maxlength="120" value="${esc(o.project||'')}"><datalist id="tsProjList">${projects().map(x=>`<option value="${esc(x)}">`).join('')}</datalist></label>`}
      <label>Task<input type="text" id="tsETask" value="${esc(o.task)}" maxlength="200"></label>
      <label>Hours<input type="number" id="tsEHrs" min="0.25" max="24" step="0.25" value="${o.hours}"></label>
      <label>Notes<textarea id="tsENotes" rows="3" maxlength="1000">${esc(o.notes||'')}</textarea></label>
      <div class="err" id="tsErr" role="alert"></div>
      <div class="row"><button class="btn" type="submit">Save changes</button><button class="btn ghost" type="button" data-act="tsEditToggle">Cancel</button></div></form></aside>`;
    return `<aside class="tsdrawer" aria-label="Log entry details">${head}
      <div class="tstime"><span class="badge2 ${o.billed?'ok':''}">${done?(o.billed?'Billed':'Unbilled'):esc(o.status)}</span><div>${esc(fd(o.work_date))}</div><div class="big">${pad(Math.floor(mins/60))} <small>hrs</small> : ${pad(mins%60)} <small>mins</small></div></div>
      <div class="tstabs" role="tablist"><button role="tab" aria-selected="${T.dTab==='details'}" data-act="tsDTab" data-t="details">Other Details</button><button role="tab" aria-selected="${T.dTab==='comments'}" data-act="tsDTab" data-t="comments">Comments</button></div>
      ${T.dTab==='details'?`<dl class="tsdl"><dt>Customer Name :</dt><dd>${esc(o.cust)}</dd><dt>Project :</dt><dd>${o.project?esc(o.project):'<span class="note">None</span>'}</dd><dt>Task Name :</dt><dd>${esc(o.task)}</dd><dt>User Name :</dt><dd>${esc(o.who)}</dd><dt>Approval :</dt><dd>${pill(o.status,stc(o.status))}</dd>
        <dt>Billing :</dt><dd>${done?(o.billed?'Billed':'Unbilled')+(cl&&cl.billable?` (${money(o.hours*cl.hourly_rate)} at ${money(cl.hourly_rate)}/h)`:' (not billable)'):'Not billable until approved'}</dd><dt>Notes :</dt><dd>${o.notes?esc(o.notes):'<span class="note">None</span>'}</dd></dl>
        <div class="row" style="padding:0 14px 14px;flex-wrap:wrap">${o.status==='Pending'?`<button class="btn sm" data-act="tsDecide" data-ok="1" data-ids="${esc(o.id)}">Approve</button><button class="btn sm bad" data-act="tsDecide" data-ok="0" data-ids="${esc(o.id)}">Reject</button>`:''}
        ${done?`<button class="btn sm ghost" data-act="tsBill" data-flag="${o.billed?0:1}" data-ids="${esc(o.id)}">${o.billed?'Mark as unbilled':'Mark as billed'}</button>`:''}</div>`
        :`<p class="note" style="padding:14px;margin:0">Comments are not available yet.</p>`}
    </aside>`;
  }
  const timerStart=()=>{try{return +localStorage.getItem('vx_ts_timer')||0}catch(e){return 0}};
  const clock=ms=>{const s=Math.floor(ms/1000);return pad(Math.floor(s/3600))+':'+pad(Math.floor(s/60)%60)+':'+pad(s%60)};
  setInterval(()=>{const e=document.getElementById('tsTimerLbl'),t=timerStart();if(e&&t)e.textContent='Stop '+clock(Date.now()-t)},1000);
  function calHTML(rows){
    const base=T.calM||todayISO().slice(0,7),y=+base.slice(0,4),m=+base.slice(5,7)-1,first=new Date(y,m,1),lead=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate();
    const by={};rows.forEach(r=>{(by[r.work_date]=by[r.work_date]||[]).push(r)});
    let cells=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<div class="dow">${d}</div>`).join('');
    for(let i=0;i<lead;i++)cells+='<div class="off"></div>';
    for(let d=1;d<=days;d++){const k=y+'-'+pad(m+1)+'-'+pad(d),ev=by[k]||[],tot=ev.reduce((s,r)=>s+r.hours,0);
      cells+=`<div><div class="dn"><span>${d}</span>${tot?`<em>${hm(tot)}</em>`:''}</div>${ev.slice(0,3).map(r=>`<button class="ev" data-act="tsOpen" data-id="${esc(r.id)}" title="${esc(r.who+' · '+r.cust+' · '+r.task)}">${esc(r.who.split(' ')[0])} ${hm(r.hours)} ${esc(r.cust)}</button>`).join('')}${ev.length>3?`<span class="note">+${ev.length-3} more</span>`:''}</div>`}
    const label=first.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
    return `<div class="tscal"><div class="tscalh"><button class="btn ghost sm" data-act="tsCal" data-d="-1" aria-label="Previous month">‹</button><b>${esc(label)}</b><button class="btn ghost sm" data-act="tsCal" data-d="1" aria-label="Next month">›</button><button class="btn ghost sm" data-act="tsCal" data-d="0">Today</button></div><div class="tscalg">${cells}</div></div>`;
  }
  function listHTML(){
    const rows=filtered(),shown=rows.slice(0,T.limit),total=rows.reduce((s,r)=>s+r.hours,0),selIds=Object.keys(T.sel).filter(k=>T.sel[k]);
    const o=T.open?T.rows.find(r=>r.id===T.open):null,side=T.newOpen?newForm():o?drawer(o):'';
    const users=Object.entries(T.names).sort((a,b)=>a[1].localeCompare(b[1])),running=timerStart();
    const menu=T.menu==='new'?`<div class="tsmenu" role="menu"><button role="menuitem" data-act="tsNew">New Log Entry</button><button role="menuitem" data-act="tsView" data-v="customers">Add customer</button></div>`
      :T.menu==='more'?`<div class="tsmenu" role="menu"><button role="menuitem" data-act="tsCsv">Export as CSV</button><button role="menuitem" data-act="tsView" data-v="customers">Customers</button><button role="menuitem" data-act="tsRefresh">Refresh</button></div>`:'';
    return `<div class="tsw ${side?'withpanel':''}"><div class="tsmain">
      <div class="tshead"><select class="tstitle" id="tsPreset" aria-label="Timesheet view">${opts([['all','All Timesheets'],['pending','Waiting for approval'],['unbilled','Approved, unbilled'],['billed','Billed']],T.preset)}</select>
        <div class="tsacts"><button class="lk" data-act="tsView" data-v="summary">${IC.sum} Summary</button>
          <span class="tsseg" role="group" aria-label="View"><button data-act="tsMode" data-m="list" aria-pressed="${T.mode==='list'}" aria-label="List view" title="List">${IC.list}</button><button data-act="tsMode" data-m="cal" aria-pressed="${T.mode==='cal'}" aria-label="Calendar view" title="Calendar">${IC.cal}</button></span>
          <button class="tsb ${running?'run':''}" data-act="tsTimer">${IC.clock} <span id="tsTimerLbl">${running?'Stop '+clock(Date.now()-running):'Start'}</span></button>
          <span class="tssplit"><button class="tsb" data-act="tsNew">${IC.plus} New Log Entry</button><button class="tsb caret" data-act="tsMenu" data-m="new" aria-haspopup="menu" aria-label="More ways to add">▾</button></span>
          <button class="tsmore" data-act="tsMenu" data-m="more" aria-haspopup="menu" aria-label="More">⋯</button>${menu}</div></div>
      <div class="tsfilters" role="group" aria-label="View by"><b>VIEW BY:</b>
        <label>Period: <select id="tsPeriod" class="${T.period!=='all'?'on':''}"><option value="all" ${T.period==='all'?'selected':''}>All</option><optgroup label="Current">${opts([['today','Today'],['week','This Week'],['month','This Month'],['quarter','This Quarter'],['year','This Year'],['fy','This Financial Year (Mar to Feb)']],T.period)}</optgroup><optgroup label="Previous">${opts([['yesterday','Yesterday'],['prevweek','Previous Week'],['last','Previous Month'],['prevquarter','Previous Quarter'],['prevyear','Previous Year']],T.period)}</optgroup></select></label>
        <label>${IC.user}<select id="tsCust" class="${T.cust?'on':''}" aria-label="Customer">${opts(T.clients.map(c=>[c.id,c.name]),T.cust,'Select customer')}</select></label>
        <label>${IC.proj}<select id="tsProj" class="${T.proj?'on':''}" aria-label="Project">${opts(projects().map(x=>[x,x]),T.proj,'Select a project')}</select></label>
        <label>${IC.users}<select id="tsUser" class="${T.user?'on':''}" aria-label="User">${opts(users,T.user,'Select user')}</select></label></div>
      <div class="err" id="tsErr" role="alert" style="padding:0 16px"></div>
      ${selIds.length?`<div class="tsbulk" role="toolbar" aria-label="Bulk actions"><b>${selIds.length} selected</b><button class="btn sm" data-act="tsDecide" data-ok="1" data-ids="${esc(selIds.join(','))}">Approve</button><button class="btn sm ghost" data-act="tsDecide" data-ok="0" data-ids="${esc(selIds.join(','))}">Reject</button><button class="btn sm ghost" data-act="tsBill" data-flag="1" data-ids="${esc(selIds.join(','))}">Mark billed</button><button class="btn sm ghost" data-act="tsBill" data-flag="0" data-ids="${esc(selIds.join(','))}">Mark unbilled</button><button class="btn sm ghost" data-act="tsClear">Clear</button></div>`:''}
      ${T.mode==='cal'?calHTML(rows):`<div class="tbl"><table class="tst" style="min-width:980px"><thead><tr><th style="width:44px"><input type="checkbox" id="tsAll" aria-label="Select all shown" ${shown.length&&shown.every(r=>T.sel[r.id])?'checked':''}></th><th>Date</th><th>Project</th><th>Customer</th><th>Task</th><th>User</th><th class="n">Time</th><th>Approvals</th><th>Billing Status</th></tr></thead><tbody>
      ${shown.map(r=>`<tr data-row="${esc(r.id)}" class="${T.open===r.id?'sel':''}"><td><input type="checkbox" data-tssel="${esc(r.id)}" ${T.sel[r.id]?'checked':''} aria-label="Select entry"></td>
        <td class="nw">${esc(fd(r.work_date))}</td><td>${r.project?`<button class="tslink" data-act="tsProjSet" data-p="${esc(r.project)}">${esc(r.project)}</button>`:'<span class="tsdim">--</span>'}</td><td>${esc(r.cust)}</td>
        <td><div>${esc(r.task)}</div>${r.notes?`<div class="tsnote">${esc(r.notes)}</div>`:''}</td><td>${esc(r.who)}</td>
        <td class="n nw">${hm(r.hours)}</td><td>${apprText(r)}</td><td class="nw">${billText(r)}</td></tr>`).join('')
        ||`<tr><td colspan="9" class="note">${T.rows.length?'No timesheet entries match these filters.':'No time has been logged yet.'}</td></tr>`}
      </tbody></table></div>`}
      <div class="tsfoot"><span>Total Count: <b>${rows.length}</b> &nbsp; Total time: <b>${hm(total)}</b>${T.truncated?' (latest 5,000 entries)':''}</span>${T.mode!=='cal'&&rows.length>shown.length?`<button class="btn ghost sm" data-act="tsMore">Show more (${rows.length-shown.length} left)</button>`:''}</div>
      </div>${side}</div>`;
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
      <label>Hourly rate (N$)<input id="tsCRate" type="number" min="0" step="0.01" value="0"></label><label>Billing<select id="tsCBill"><option value="1">Billable</option><option value="0">Not billable</option></select></label><button class="btn" type="submit">Add customer</button></form><div class="tsstd" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line,#d9deea)"><button class="btn ghost" type="button" data-act="tsStdCust">Add the standard customer list (${(window.VIRTUOSO_CUSTOMERS||[]).filter(n=>!T.clients.some(c=>c.name.toLowerCase()===n.toLowerCase())).length} missing)</button><div class="note">Adds every customer from your list that is not here yet, billable at N$ 0 per hour. Virtuoso internal is added as not billable. Set the rates afterwards.</div></div><div class="err" id="tsErr" role="alert"></div></div>
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
    if(t.id==='tsPeriod')return set('period',t.value);if(t.id==='tsCust')return set('cust',t.value);if(t.id==='tsUser')return set('user',t.value);if(t.id==='tsProj')return set('proj',t.value);if(t.id==='tsStat')return set('stat',t.value);
    if(t.id==='tsAll'){e.stopImmediatePropagation();filtered().slice(0,T.limit).forEach(r=>{T.sel[r.id]=t.checked});return render()}
    if(t.dataset.tssel){e.stopImmediatePropagation();T.sel[t.dataset.tssel]=t.checked;return render()}
    if(t.dataset.tsum){e.stopImmediatePropagation();T[t.dataset.tsum]=t.value;return render()}
    if(t.dataset.tsrate){e.stopImmediatePropagation();const v=parseFloat(t.value);if(!(v>=0)){toast('Enter a valid rate');return render()}
      return act(async()=>{const r=await sb().from('clients').update({hourly_rate:v}).eq('id',t.dataset.tsrate);if(r.error)throw new Error(rpcMsg(r.error.message))},()=>toast('Rate updated'))}
  },true);
  document.addEventListener('submit',e=>{
    const f=e.target.id;if(f!=='tsClientForm'&&f!=='tsEditForm'&&f!=='tsNewForm')return;
    e.preventDefault();e.stopImmediatePropagation();
    if(f==='tsClientForm'){
      const name=$('#tsCName').value.trim(),rate=parseFloat($('#tsCRate').value)||0;
      if(!name)return err('Enter the customer name.');if(rate<0)return err('Rate cannot be negative.');
      if(T.clients.some(c=>c.name.toLowerCase()===name.toLowerCase()))return err('That customer already exists.');
      return act(async()=>{const r=await sb().from('clients').insert({name,hourly_rate:rate,billable:$('#tsCBill').value==='1'});if(r.error)throw new Error(rpcMsg(r.error.message))},()=>toast(name+' added'));
    }
    if(f==='tsNewForm'){
      const hrs=parseFloat($('#tsNHrs').value),date=$('#tsNDate').value,task=$('#tsNTask').value.trim(),cust=$('#tsNCust').value,usr=$('#tsNUser').value,pr=$('#tsNProj')?$('#tsNProj').value.trim():'';
      if(!date)return err('Choose a date.');if(!usr)return err('Choose a user.');if(!cust)return err('Choose a customer. Add one under Customers first if the list is empty.');if(!task)return err('Enter the task.');
      if(!(hrs>=0.25&&hrs<=24))return err('Hours must be between 0.25 and 24.');
      const row={user_id:usr,client_id:cust,work_date:date,task,hours:hrs,notes:$('#tsNNotes').value.trim()||null,status:'Approved',decided_by:state.user.id,decided_at:new Date().toISOString()};
      if(pr&&!T.noProject)row.project=pr;
      return act(async()=>{const r=await sb().from('time_entries').insert(row);if(r.error)throw new Error(rpcMsg(r.error.message))},()=>{T.newOpen=false;T.prefill=null;toast('Log entry added')});
    }
    const hrs=parseFloat($('#tsEHrs').value),date=$('#tsEDate').value,task=$('#tsETask').value.trim();
    if(!(hrs>=0.25&&hrs<=24))return toast('Hours must be between 0.25 and 24');if(!date)return toast('Choose a date');if(!task)return toast('Enter the task');
    act(async()=>{const upd={work_date:date,client_id:$('#tsECust').value,task,hours:hrs,notes:$('#tsENotes').value.trim()||null};if(!T.noProject)upd.project=($('#tsEProj').value||'').trim()||null;const r=await sb().from('time_entries').update(upd).eq('id',T.open);if(r.error)throw new Error(rpcMsg(r.error.message))},()=>{T.edit=false;toast('Entry updated')});
  },true);
  document.addEventListener('click',e=>{
    if(e.target.closest&&e.target.closest('[data-act^="ts"]')==null){
      const tr=e.target.closest&&e.target.closest('tr[data-row]');
      if(tr&&!e.target.closest('input,button,a,select,label')&&T.rows&&document.getElementById('view').contains(tr)){e.stopImmediatePropagation();T.open=tr.dataset.row;T.newOpen=false;T.menu=null;T.edit=false;T.dTab='details';render();return}
      if(T.menu&&!e.target.closest('.tsmenu')&&document.getElementById('view')&&document.getElementById('view').contains(e.target)){T.menu=null;render()}
      return;
    }
    const b=e.target.closest('[data-act^="ts"]');e.stopImmediatePropagation();
    const d=b.dataset;
    if(d.act!=='tsMenu')T.menu=null;
    switch(d.act){
      case 'tsOpen':T.open=d.id;T.newOpen=false;T.edit=false;T.dTab='details';return render();
      case 'tsClose':T.open=null;T.edit=false;T.newOpen=false;T.prefill=null;return render();
      case 'tsMode':T.mode=d.m;T.open=null;T.newOpen=false;return render();
      case 'tsMenu':T.menu=T.menu===d.m?null:d.m;return render();
      case 'tsProjSet':T.proj=d.p;T.limit=100;return render();
      case 'tsRefresh':return reload();
      case 'tsStdCust':{
        const miss=(window.VIRTUOSO_CUSTOMERS||[]).filter(n=>!T.clients.some(c=>c.name.toLowerCase()===n.toLowerCase()));
        if(!miss.length)return toast('All the standard customers are already here.');
        if(!confirm('Add '+miss.length+' customers? Existing ones are skipped.'))return;
        return act(async()=>{for(let i=0;i<miss.length;i+=20){const rs=await Promise.all(miss.slice(i,i+20).map(n=>sb().from('clients').insert({name:n,hourly_rate:0,billable:!/- Internal$/.test(n)})));
          const bad=rs.find(r=>r.error);if(bad)throw new Error(rpcMsg(bad.error.message))}},()=>toast(miss.length+' customers added'))}
      case 'tsCal':{const base=T.calM||todayISO().slice(0,7);let y=+base.slice(0,4),m=+base.slice(5,7)-1;const dd=+d.d;
        if(dd===0){T.calM=null}else{m+=dd;while(m<0){m+=12;y--}while(m>11){m-=12;y++}T.calM=y+'-'+pad(m+1)}return render()}
      case 'tsNew':T.newOpen=true;T.open=null;T.edit=false;if(!T.prefill)T.prefill={};return render();
      case 'tsTimer':{const t=timerStart();
        if(!t){try{localStorage.setItem('vx_ts_timer',String(Date.now()))}catch(x){toast('Could not start the timer')}return render()}
        try{localStorage.removeItem('vx_ts_timer')}catch(x){}
        const hrs=Math.max(0.25,Math.round((Date.now()-t)/3600000*4)/4);
        T.prefill={hours:String(hrs),date:todayISO()};T.newOpen=true;T.open=null;T.mode='list';return render()}
      case 'tsEditToggle':T.edit=!T.edit;return render();
      case 'tsDTab':T.dTab=d.t;return render();
      case 'tsView':T.view=d.v;T.open=null;T.newOpen=false;T.edit=false;window.scrollTo(0,0);return render();
      case 'tsMore':T.limit+=100;return render();
      case 'tsClear':T.sel={};return render();
      case 'tsCsv':{const rows=filtered();if(!rows.length)return toast('Nothing to export');
        const csv=[['Date','Project','Customer','Task','User','Hours','Time','Approval','Billing','Notes'].map(csvCell).join(',')].concat(rows.map(r=>[r.work_date,r.project,r.cust,r.task,r.who,r.hours,hm(r.hours),r.status,r.status==='Approved'?(r.billed?'Billed':'Unbilled'):'',r.notes||''].map(csvCell).join(','))).join('\r\n');
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
