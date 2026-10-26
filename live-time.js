/* Live Clients & billing, Timesheet and Approvals (timesheets). Data comes from the database through
   row-level security: staff see and edit only their own entries; admins see everything. Billing counts
   APPROVED hours only. Leave and loan approvals are not connected yet. */
(function(){
  const cfg=window.VIRTUOSO||{};
  if(!(cfg.supabaseUrl&&cfg.anonKey)||/[?&]demo\b/.test(location.search))return;
  const sb=()=>window.VIRTUOSO.client;
  const fresh=()=>({clients:null,loadC:false,mine:null,loadM:false,weekOff:0,billing:null,recent:null,loadB:false,pend:null,loadP:false,busy:false,uid:null});
  let S=fresh();
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const parse=s=>new Date(s+'T00:00:00');
  const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
  const mondayOf=d=>{const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
  const week=()=>{const m=addD(mondayOf(new Date()),S.weekOff*7);return [iso(m),iso(addD(m,6))]};
  const lbl=s=>parse(s).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  const dayLbl=s=>parse(s).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
  const cname=id=>{const c=(S.clients||[]).find(x=>x.id===id);return c?c.name:'(removed client)'};
  const money=n=>(typeof NAD==='function'?NAD(n):'N$ '+(+n||0).toFixed(2));
  const names=async()=>{const {data}=await sb().from('profiles').select('id,name');return Object.fromEntries((data||[]).map(p=>[p.id,p.name]))};
  const isAdm=()=>state.user&&state.user.type==='admin';
  const err=(id,m)=>{const el=$('#'+id);if(el)el.textContent=m||''};

  /* ---------- loaders (each re-renders when done) ---------- */
  async function loadClients(){if(S.loadC||!sb())return;S.loadC=true;
    const {data,error}=await sb().from('clients').select('*').order('name');S.loadC=false;S.clients=error?[]:data;render()}
  async function loadMine(){if(S.loadM||!sb())return;S.loadM=true;const [a,b]=week();
    const {data,error}=await sb().from('time_entries').select('*').eq('user_id',state.user.id).gte('work_date',a).lte('work_date',b).order('work_date');
    S.loadM=false;S.mine=error?[]:data;render()}
  async function loadBilling(){if(S.loadB||!sb())return;S.loadB=true;
    const ap=await sb().from('time_entries').select('client_id,hours').eq('status','Approved').limit(5000);
    const rc=await sb().from('time_entries').select('user_id,client_id,work_date,task,hours,status').order('work_date',{ascending:false}).limit(50);
    const nm=await names();
    S.loadB=false;S.billing=ap.data||[];S.recent=(rc.data||[]).map(r=>({...r,who:nm[r.user_id]||'Unknown'}));render()}
  async function loadPend(silent){if(S.loadP||!sb())return;S.loadP=true;
    const {data}=await sb().from('time_entries').select('user_id,work_date,hours').eq('status','Pending').limit(5000);
    const nm=await names(),g={};
    (data||[]).forEach(r=>{const w=iso(mondayOf(parse(r.work_date))),k=r.user_id+'|'+w;(g[k]=g[k]||{uid:r.user_id,week:w,hours:0,n:0,who:nm[r.user_id]||'Unknown'});g[k].hours+= +r.hours;g[k].n++});
    const prev=JSON.stringify(S.pend);S.loadP=false;S.pend=Object.values(g).sort((a,b)=>a.week<b.week?-1:1);
    if(!silent||prev!==JSON.stringify(S.pend))render()}

  /* Nav badge counts real pending timesheets. */
  pending=()=>S.pend?S.pend.length:0;
  setInterval(()=>{
    const u=state.user?state.user.id:null;
    if(u!==S.uid){S=fresh();S.uid=u}
    if(u&&isAdm()&&S.pend===null)loadPend();
  },700);
  setInterval(()=>{if(state.user&&isAdm()&&S.pend!==null)loadPend(true)},30000);

  /* ---------- Clients & billing (admin) ---------- */
  function vClients(){
    if(S.clients===null)loadClients();
    if(S.billing===null)loadBilling();
    const cl=S.clients||[],ap=S.billing||[];
    const stats=cl.map(c=>{const h=ap.filter(x=>x.client_id===c.id).reduce((s,x)=>s+ +x.hours,0);return {c,h,amt:c.billable?h*c.hourly_rate:0}});
    const th=stats.reduce((s,x)=>s+x.h,0),bh=stats.filter(x=>x.c.billable).reduce((s,x)=>s+x.h,0),ta=stats.reduce((s,x)=>s+x.amt,0);
    return `<h2>Clients & billing</h2><p class="sub">Add the clients staff can log time against and set the hourly rate you charge. Hours and amounts count <b>approved</b> time only.</p>
    <div class="stack"><div class="tiles"><div class="tile"><b>${th.toFixed(1)}</b><span>Approved hours</span></div><div class="tile"><b>${bh.toFixed(1)}</b><span>Billable hours</span></div><div class="tile"><b>${money(ta)}</b><span>Amount billable</span></div></div>
    <div class="panel"><h3>Add client</h3><form class="form" id="ltClientForm" novalidate>
      <label>Client name<input id="ltCName" required maxlength="120"></label>
      <label>Hourly rate (N$)<input id="ltCRate" type="number" min="0" step="0.01" value="0"></label>
      <label>Billing<select id="ltCBill"><option value="1">Billable</option><option value="0">Not billable</option></select></label>
      <button class="btn" type="submit">Add client</button></form><div class="err" id="ltErr" role="alert"></div></div>
    <div class="panel"><h3>Clients</h3><div class="tbl"><table><thead><tr><th>Client</th><th>Rate per hour</th><th>Billing</th><th class="n">Approved hours</th><th class="n">Amount billable</th><th></th></tr></thead><tbody>
    ${stats.length?stats.map(x=>`<tr><td>${esc(x.c.name)}</td><td><input type="number" min="0" step="0.01" value="${x.c.hourly_rate}" data-ltrate="${esc(x.c.id)}" style="width:100px" aria-label="Rate for ${esc(x.c.name)}"></td>
      <td><button class="btn ghost sm" data-act="ltBill" data-id="${esc(x.c.id)}">${x.c.billable?'Billable':'Not billable'}</button></td><td class="n">${x.h.toFixed(2)}</td><td class="n">${money(x.amt)}</td>
      <td><button class="btn ghost sm" data-act="ltRemoveClient" data-id="${esc(x.c.id)}">Remove</button></td></tr>`).join('')
      :`<tr><td colspan="6" class="note">${S.clients===null?'Loading…':'No clients yet. Add one above.'}</td></tr>`}
    </tbody></table></div></div>
    <div class="panel"><h3>Latest time entries</h3><div class="tbl"><table><thead><tr><th>Employee</th><th>Day</th><th>Client</th><th>Task</th><th class="n">Hours</th><th>Status</th></tr></thead><tbody>
    ${(S.recent||[]).length?S.recent.map(r=>`<tr><td>${esc(r.who)}</td><td>${esc(dayLbl(r.work_date))}</td><td>${esc(cname(r.client_id))}</td><td>${esc(r.task)}</td><td class="n">${(+r.hours).toFixed(2)}</td><td>${pill(r.status,stc(r.status))}</td></tr>`).join(''):'<tr><td colspan="6" class="note">No time logged yet.</td></tr>'}
    </tbody></table></div></div></div>`;
  }

  /* ---------- Timesheet (staff) ---------- */
  function vTime(){
    if(S.clients===null)loadClients();
    if(S.mine===null)loadMine();
    const [a,b]=week(),rows=S.mine||[],total=rows.reduce((s,e)=>s+ +e.hours,0);
    const editable=rows.filter(e=>e.status==='Draft'||e.status==='Rejected');
    const cl=S.clients||[],tod=iso(new Date());
    return `<h2>Timesheet</h2><p class="sub">${esc(state.user.name)}. Week of ${esc(lbl(a))} to ${esc(lbl(b))}.</p>
    <div class="stack">
    <div class="panel"><div class="row" style="justify-content:space-between"><div><span class="mono" style="font-size:22px">${total.toFixed(1)} h</span> <span class="note">of 40 h</span></div>
      <div class="row"><button class="btn ghost sm" data-act="ltWeek" data-d="-1">Previous week</button><button class="btn ghost sm" data-act="ltWeek" data-d="0">This week</button><button class="btn ghost sm" data-act="ltWeek" data-d="1">Next week</button></div></div>
      <div class="bar2"><i style="width:${Math.min(100,total/40*100)}%"></i></div>
      <div class="row" style="margin-top:12px"><button class="btn" data-act="ltSubmit" ${editable.length?'':'disabled'}>Submit week for approval</button>
        <span class="note">${editable.length?editable.length+' entr'+(editable.length>1?'ies':'y')+' ready to submit':'Nothing to submit'}</span></div></div>
    <div class="panel"><h3>Log time</h3>
      ${cl.length?`<form class="form" id="ltEntryForm" novalidate>
      <label>Client<select id="ltClient">${cl.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
      <label>Date<input id="ltDate" type="date" value="${tod}" max="${tod}" required></label>
      <label>Task<input id="ltTask" placeholder="e.g. Management accounts" maxlength="200" required></label>
      <label>Hours<input id="ltHrs" type="number" min="0.25" max="24" step="0.25" value="1"></label>
      <button class="btn" type="submit">Add entry</button></form><div class="err" id="ltErr" role="alert"></div>`
      :`<p class="note">${S.clients===null?'Loading…':'No clients have been set up yet. Ask your administrator to add one.'}</p>`}</div>
    <div class="panel"><div class="tbl"><table><thead><tr><th>Day</th><th>Client</th><th>Task</th><th class="n">Hours</th><th>Status</th><th></th></tr></thead><tbody>
    ${rows.length?rows.map(e=>`<tr><td>${esc(dayLbl(e.work_date))}</td><td>${esc(cname(e.client_id))}</td><td>${esc(e.task)}</td><td class="n">${(+e.hours).toFixed(2)}</td><td>${pill(e.status,stc(e.status))}</td>
      <td>${e.status==='Draft'?`<button class="btn ghost sm" data-act="ltDelEntry" data-id="${esc(e.id)}">Remove</button>`:''}</td></tr>`).join('')
      :`<tr><td colspan="6" class="note">${S.mine===null?'Loading…':'No time logged for this week. Add your first entry above.'}</td></tr>`}
    </tbody></table></div></div></div>`;
  }

  /* ---------- Approvals (admin, timesheets) ---------- */
  function vApprovals(){
    if(S.pend===null)loadPend();
    const list=S.pend||[];
    return `<h2>Approvals</h2><p class="sub">${list.length} timesheet${list.length===1?'':'s'} waiting for review. Leave and loan requests will appear here once they are connected.</p>
    <div class="stack"><div class="panel"><div class="tbl"><table><thead><tr><th>Type</th><th>Employee</th><th>Details</th><th>Status</th><th></th></tr></thead><tbody>
    ${list.length?list.map(p=>`<tr><td>${pill('Timesheet')}</td><td>${esc(p.who)}</td><td>Week of ${esc(lbl(p.week))}, ${p.hours.toFixed(1)} h (${p.n} entr${p.n>1?'ies':'y'})</td><td>${pill('Pending','warn')}</td>
      <td><div class="row"><button class="btn sm" data-act="ltApprove" data-u="${esc(p.uid)}" data-w="${esc(p.week)}">Approve</button><button class="btn sm bad" data-act="ltReject" data-u="${esc(p.uid)}" data-w="${esc(p.week)}">Reject</button></div></td></tr>`).join('')
      :`<tr><td colspan="5" class="note">${S.pend===null?'Loading…':'Nothing is waiting for approval.'}</td></tr>`}
    </tbody></table></div></div></div>`;
  }
  VIEWS.clients=vClients;VIEWS.time=vTime;VIEWS.approvals=vApprovals;

  /* ---------- Actions ---------- */
  const lock=on=>document.querySelectorAll('#view button').forEach(b=>{b.disabled=on});
  /* No re-render until it succeeds, so a failed call never wipes what was typed. */
  async function act(fn,after){
    if(S.busy)return;S.busy=true;err('ltErr','');lock(true);
    let ok=false;
    try{await fn();ok=true}catch(x){err('ltErr',x.message);toast(x.message)}
    S.busy=false;lock(false);
    if(ok){after&&after();render()}
  }
  const must=({error})=>{if(error)throw new Error(/row-level security|permission/i.test(error.message)?'You are not allowed to do that.':/duplicate|unique/i.test(error.message)?'That already exists.':/foreign key/i.test(error.message)?'It is in use. Set it to Not billable instead.':'Something went wrong. Try again.')};

  document.addEventListener('submit',e=>{
    const f=e.target.id;
    if(f!=='ltClientForm'&&f!=='ltEntryForm')return;
    e.preventDefault();e.stopImmediatePropagation();
    if(f==='ltClientForm'){
      const name=$('#ltCName').value.trim(),rate=parseFloat($('#ltCRate').value)||0;
      if(!name)return err('ltErr','Enter the client name.');if(rate<0)return err('ltErr','Rate cannot be negative.');
      if((S.clients||[]).some(c=>c.name.toLowerCase()===name.toLowerCase()))return err('ltErr','That client already exists.');
      const billable=$('#ltCBill').value==='1';
      return act(async()=>must(await sb().from('clients').insert({name,hourly_rate:rate,billable})),()=>{S.clients=null;toast(name+' added')});
    }
    const hrs=parseFloat($('#ltHrs').value),date=$('#ltDate').value,task=$('#ltTask').value.trim(),client=$('#ltClient').value;
    if(!(hrs>=0.25&&hrs<=24))return err('ltErr','Hours must be between 0.25 and 24.');
    if(!date||date>iso(new Date()))return err('ltErr','Choose a date that is not in the future.');
    if(!task)return err('ltErr','Say what you worked on.');
    act(async()=>must(await sb().from('time_entries').insert({client_id:client,work_date:date,task,hours:hrs})),()=>{S.mine=null;toast('Entry added')});
  },true);

  document.addEventListener('change',e=>{
    const t=e.target;if(!t.dataset||!t.dataset.ltrate)return;
    e.stopImmediatePropagation();
    const v=parseFloat(t.value);if(!(v>=0)){toast('Enter a valid rate');S.clients=null;return render()}
    act(async()=>must(await sb().from('clients').update({hourly_rate:v}).eq('id',t.dataset.ltrate)),()=>{S.clients=null;toast('Rate updated')});
  },true);

  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="lt"]');if(!b)return;
    e.stopImmediatePropagation();
    const d=b.dataset,id=d.id;
    switch(d.act){
      case 'ltWeek':S.weekOff=d.d==='0'?0:S.weekOff+ +d.d;S.mine=null;return render();
      case 'ltDelEntry':return act(async()=>must(await sb().from('time_entries').delete().eq('id',id)),()=>{S.mine=null;toast('Entry removed')});
      case 'ltSubmit':{const [a,z]=week();
        return act(async()=>must(await sb().from('time_entries').update({status:'Pending'}).eq('user_id',state.user.id).in('status',['Draft','Rejected']).gte('work_date',a).lte('work_date',z)),()=>{S.mine=null;toast('Timesheet submitted for approval')})}
      case 'ltBill':{const c=(S.clients||[]).find(x=>x.id===id);if(!c)return;
        return act(async()=>must(await sb().from('clients').update({billable:!c.billable}).eq('id',id)),()=>{S.clients=null;toast(c.name+(c.billable?' is not billable':' is billable'))})}
      case 'ltRemoveClient':{const c=(S.clients||[]).find(x=>x.id===id);if(!c||!confirm('Remove '+c.name+'?'))return;
        return act(async()=>must(await sb().from('clients').delete().eq('id',id)),()=>{S.clients=null;toast(c.name+' removed')})}
      case 'ltApprove':case 'ltReject':{
        const ok=d.act==='ltApprove',w=d.w,end=iso(addD(parse(w),6)),p=(S.pend||[]).find(x=>x.uid===d.u&&x.week===w);
        return act(async()=>{
          must(await sb().from('time_entries').update({status:ok?'Approved':'Rejected',decided_by:state.user.id,decided_at:new Date().toISOString()}).eq('user_id',d.u).eq('status','Pending').gte('work_date',w).lte('work_date',end));
          await sb().from('notifications').insert({kind:'Timesheet',message:`Your timesheet for the week of ${lbl(w)} was ${ok?'approved':'rejected. Please check it and resubmit'}.`,to_user_id:d.u});
        },()=>{S.pend=null;S.billing=null;toast((p?p.who+"'s timesheet":'Timesheet')+(ok?' approved':' rejected'))})}
    }
  },true);
})();
