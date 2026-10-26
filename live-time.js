/* Live Clients & billing, Timesheet and Approvals (timesheets). Data comes from the database through
   row-level security: staff see and edit only their own entries; admins see everything. Billing counts
   APPROVED hours only. Leave and loan approvals are not connected yet. */
(function(){
  const cfg=window.VIRTUOSO||{};
  if(!(cfg.supabaseUrl&&cfg.anonKey)||/[?&]demo\b/.test(location.search))return;
  const sb=()=>window.VIRTUOSO.client;
  const fresh=()=>({clients:null,loadC:false,mine:null,loadM:false,weekOff:0,billing:null,recent:null,all:null,tsPeriod:'month',tsInc:'approved',truncated:false,loadB:false,pend:null,pendLeave:null,pendLoans:null,loadP:false,busy:false,uid:null});
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
    const q=await sb().from('time_entries').select('user_id,client_id,task,hours,status,work_date').order('work_date',{ascending:false}).limit(5000);
    const nm=await names(),rows=q.data||[];
    S.loadB=false;S.truncated=rows.length>=5000;
    S.all=rows.map(r=>({...r,who:nm[r.user_id]||'Unknown'}));
    S.billing=rows.filter(r=>r.status==='Approved');S.recent=S.all.slice(0,50);render()}
  async function loadPend(silent){if(S.loadP||!sb())return;S.loadP=true;
    const {data}=await sb().from('time_entries').select('user_id,work_date,hours').eq('status','Pending').limit(5000);
    const lv=await sb().from('leave_requests').select('*').eq('status','Pending').order('from_date').limit(200);
    const ln=await sb().from('loans').select('*').eq('status','Pending').order('created_at').limit(200);
    const nm=await names(),g={};
    (data||[]).forEach(r=>{const w=iso(mondayOf(parse(r.work_date))),k=r.user_id+'|'+w;(g[k]=g[k]||{uid:r.user_id,week:w,hours:0,n:0,who:nm[r.user_id]||'Unknown'});g[k].hours+= +r.hours;g[k].n++});
    const prev=JSON.stringify([S.pend,S.pendLeave,S.pendLoans]);S.loadP=false;S.pend=Object.values(g).sort((a,b)=>a.week<b.week?-1:1);
    S.pendLeave=(lv.data||[]).map(r=>({...r,who:nm[r.user_id]||'Unknown'}));S.pendLoans=(ln.data||[]).map(r=>({...r,who:nm[r.user_id]||'Unknown'}));
    if(!silent||prev!==JSON.stringify([S.pend,S.pendLeave,S.pendLoans]))render()}

  /* Nav badge counts real pending timesheets, leave and loans. */
  pending=()=>(S.pend?S.pend.length:0)+(S.pendLeave?S.pendLeave.length:0)+(S.pendLoans?S.pendLoans.length:0);
  setInterval(()=>{
    const u=state.user?state.user.id:null;
    if(u!==S.uid){S=fresh();S.uid=u}
    if(u&&isAdm()&&S.pend===null)loadPend();
  },700);
  setInterval(()=>{if(state.user&&isAdm()&&S.pend!==null)loadPend(true)},30000);

  /* Time spent on tasks: client -> task, for a period and status filter. */
  function periodRange(){
    const t=new Date(),y=t.getFullYear(),m=t.getMonth();
    if(S.tsPeriod==='month')return [iso(new Date(y,m,1)),iso(new Date(y,m+1,0))];
    if(S.tsPeriod==='last')return [iso(new Date(y,m-1,1)),iso(new Date(y,m,0))];
    return ['0000-01-01','9999-12-31'];
  }
  function taskBreakdown(){
    const [from,to]=periodRange(),by={};
    (S.all||[]).forEach(r=>{
      if(r.work_date<from||r.work_date>to)return;
      if(S.tsInc==='approved'&&r.status!=='Approved')return;
      const c=by[r.client_id]=by[r.client_id]||{id:r.client_id,hours:0,tasks:{}};
      const key=String(r.task||'').trim().toLowerCase(),t=c.tasks[key]=c.tasks[key]||{task:String(r.task||'').trim()||'(no description)',hours:0,n:0,who:new Set()};
      c.hours+= +r.hours;t.hours+= +r.hours;t.n++;t.who.add(r.user_id);
    });
    return Object.values(by).map(c=>{const cl=(S.clients||[]).find(x=>x.id===c.id);
      return {name:cname(c.id),hours:c.hours,amt:cl&&cl.billable?c.hours*cl.hourly_rate:0,billable:!!(cl&&cl.billable),tasks:Object.values(c.tasks).sort((a,b)=>b.hours-a.hours)}})
      .sort((a,b)=>b.hours-a.hours);
  }
  function taskPanel(){
    const groups=taskBreakdown(),total=groups.reduce((s,g)=>s+g.hours,0);
    const sel=(k,opts)=>`<select data-tsf="${k}" aria-label="${k==='tsPeriod'?'Period':'Include'}">${opts.map(([v,l])=>`<option value="${v}" ${S[k]===v?'selected':''}>${l}</option>`).join('')}</select>`;
    return `<div class="panel"><h3>Time spent on tasks</h3>
      <div class="form" style="margin-bottom:10px"><label>Period${sel('tsPeriod',[['month','This month'],['last','Last month'],['all','All time']])}</label>
        <label>Include${sel('tsInc',[['approved','Approved time only'],['all','All logged time']])}</label></div>
      <p class="note" style="margin-top:0">${S.all===null?'Loading…':`<b>${total.toFixed(2)} h</b> across ${groups.length} client${groups.length===1?'':'s'}.`}${S.truncated?' Showing the latest 5,000 entries only.':''}</p>
      <div class="tbl"><table style="min-width:620px"><thead><tr><th>Client / task</th><th class="n">People</th><th class="n">Entries</th><th class="n">Hours</th><th class="n">Share</th><th class="n">Amount</th></tr></thead><tbody>
      ${groups.length?groups.map(g=>`<tr class="total"><td><b>${esc(g.name)}</b></td><td></td><td class="n">${g.tasks.reduce((s,t)=>s+t.n,0)}</td><td class="n"><b>${g.hours.toFixed(2)}</b></td><td class="n">${total?Math.round(g.hours/total*100):0}%</td><td class="n">${g.billable?money(g.amt):'Not billable'}</td></tr>
        ${g.tasks.map(t=>`<tr><td style="padding-left:22px">${esc(t.task)}</td><td class="n">${t.who.size}</td><td class="n">${t.n}</td><td class="n">${t.hours.toFixed(2)}</td><td class="n">${g.hours?Math.round(t.hours/g.hours*100):0}%</td><td class="n"></td></tr>`).join('')}`).join('')
      :`<tr><td colspan="6" class="note">${S.all===null?'Loading…':'No time recorded for this selection.'}</td></tr>`}
      </tbody></table></div></div>`;
  }
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
    ${taskPanel()}
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
    const ts=S.pend||[],lv=S.pendLeave||[],ln=S.pendLoans||[],n=ts.length+lv.length+ln.length;
    const row=(type,who,detail,btns)=>`<tr><td>${pill(type)}</td><td>${esc(who)}</td><td>${detail}</td><td>${pill('Pending','warn')}</td><td><div class="row">${btns}</div></td></tr>`;
    const rows=[
      ...ts.map(p=>row('Timesheet',p.who,`Week of ${esc(lbl(p.week))}, ${p.hours.toFixed(1)} h (${p.n} entr${p.n>1?'ies':'y'})`,
        `<button class="btn sm" data-act="ltApprove" data-u="${esc(p.uid)}" data-w="${esc(p.week)}">Approve</button><button class="btn sm bad" data-act="ltReject" data-u="${esc(p.uid)}" data-w="${esc(p.week)}">Reject</button>`)),
      ...lv.map(l=>row('Leave',l.who,`${esc(l.leave_type)} leave, ${esc(lbl(l.from_date))} to ${esc(lbl(l.to_date))}, ${+l.days} day${+l.days===1?'':'s'}. Reason: ${esc(l.reason||'')}${l.cover_name?'. Cover: '+esc(l.cover_name):''}${l.phone?'. Phone: '+esc(l.phone):''}`,
        `${l.doc_path?`<button class="btn sm ghost" data-act="ltDoc" data-path="${esc(l.doc_path)}">View document</button>`:''}<button class="btn sm" data-act="ltLeaveYes" data-id="${esc(l.id)}">Approve</button><button class="btn sm bad" data-act="ltLeaveNo" data-id="${esc(l.id)}">Reject</button>`)),
      ...ln.map(l=>row('Loan',l.who,`Salary advance ${money(l.amount)}, ${money(l.instalment)} a month`,
        `<button class="btn sm" data-act="ltLoanYes" data-id="${esc(l.id)}">Approve</button><button class="btn sm bad" data-act="ltLoanNo" data-id="${esc(l.id)}">Reject</button>`))];
    return `<h2>Approvals</h2><p class="sub">${n} request${n===1?'':'s'} waiting for review: timesheets, leave and salary advances.</p>
    <div class="stack"><div class="panel"><div class="tbl"><table><thead><tr><th>Type</th><th>Employee</th><th>Details</th><th>Status</th><th></th></tr></thead><tbody>
    ${rows.length?rows.join(''):`<tr><td colspan="5" class="note">${S.pend===null?'Loading…':'Nothing is waiting for approval.'}</td></tr>`}
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
    const t=e.target;
    if(t.dataset&&t.dataset.tsf){e.stopImmediatePropagation();S[t.dataset.tsf]=t.value;return render()}
    if(!t.dataset||!t.dataset.ltrate)return;
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
      case 'ltDoc':{const w=window.open('','_blank');
        sb().storage.from('documents').createSignedUrl(d.path,60).then(({data,error})=>{if(error||!data){if(w)w.close();return toast('Could not open the document.')}if(w){w.opener=null;w.location=data.signedUrl}else toast('Allow pop-ups to open files.')});return}
      case 'ltLeaveYes':case 'ltLeaveNo':case 'ltLoanYes':case 'ltLoanNo':{
        const loan=d.act.startsWith('ltLoan'),ok=d.act.endsWith('Yes');
        return act(async()=>{const r=await sb().rpc(loan?'decide_loan':'decide_leave',{p_id:id,p_approve:ok});
          if(r.error)throw new Error(/not permitted|row-level|policy|permission/i.test(r.error.message)?'You are not allowed to do that.':r.error.message)},
          ()=>{if(loan)S.pendLoans=(S.pendLoans||[]).filter(x=>x.id!==id);else S.pendLeave=(S.pendLeave||[]).filter(x=>x.id!==id);S.pend=null;toast((loan?'Advance ':'Leave ')+(ok?'approved':'rejected'))})}
      case 'ltApprove':case 'ltReject':{
        const ok=d.act==='ltApprove',w=d.w,end=iso(addD(parse(w),6)),p=(S.pend||[]).find(x=>x.uid===d.u&&x.week===w);
        return act(async()=>{
          must(await sb().from('time_entries').update({status:ok?'Approved':'Rejected',decided_by:state.user.id,decided_at:new Date().toISOString()}).eq('user_id',d.u).eq('status','Pending').gte('work_date',w).lte('work_date',end));
          await sb().from('notifications').insert({kind:'Timesheet',message:`Your timesheet for the week of ${lbl(w)} was ${ok?'approved':'rejected. Please check it and resubmit'}.`,to_user_id:d.u});
        },()=>{S.pend=null;S.billing=null;toast((p?p.who+"'s timesheet":'Timesheet')+(ok?' approved':' rejected'))})}
    }
  },true);
})();
