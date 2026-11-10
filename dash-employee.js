/* EMPLOYEE DASHBOARD. Every employee gets their own dashboard built from their own records only:
   hours this week, timesheet status, leave applications, items on the office To Buy list, alerts and quick links.
   Live: reads through row-level security (a person can only read their own rows). ?demo: reads the sample state.
   Also trims the employee menu to pages that make sense for staff (Payslips is hidden because payroll is not in the app)
   and adds a My profile link for everyone. Server-side rules still decide what data anyone can read or change. */
(function(){
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const parse=s=>new Date(s+'T00:00:00');
  const MON={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const dayISO=day=>{const m=/(\d{1,2})\s+([A-Za-z]{3})/.exec(day||'');if(!m||!(m[2] in MON))return '';const mo=MON[m[2]];return (mo<2?2027:2026)+'-'+pad(mo+1)+'-'+pad(+m[1])};
  const today=()=>(!LIVE&&state.today)||iso(new Date());
  const hm=h=>{const m=Math.round(h*60);return pad(Math.floor(m/60))+':'+pad(m%60)};
  const ST={Submitted:'Pending'};
  const D={uid:null,week:null,loaded:false,loading:false,rows:[],leaves:[]};
  setInterval(()=>{const u=state.user?state.user.id:null;if(u!==D.uid){D.uid=u;D.loaded=false;D.loading=false;D.rows=[];D.leaves=[]}},700);

  function weekRange(){
    const t=parse(today()),back=(t.getDay()+6)%7,a=new Date(t.getFullYear(),t.getMonth(),t.getDate()-back),b=new Date(a.getFullYear(),a.getMonth(),a.getDate()+6);
    return [iso(a),iso(b)];
  }
  async function load(){
    if(D.loading||D.loaded)return;
    const [a,b]=weekRange();
    if(!LIVE){
      const d=state.data[state.user.id]||{entries:[],leaves:[]};
      D.rows=(d.entries||[]).map(e=>({work_date:e.wd||dayISO(e.day),hours:+e.hrs,status:ST[e.status]||e.status})).filter(r=>r.work_date>=a&&r.work_date<=b);
      D.leaves=(d.leaves||[]).map(l=>({leave_type:l.type,from_date:l.from,to_date:l.to,days:l.days,status:l.status}));
      D.loaded=true;return;
    }
    if(!sb())return;
    D.loading=true;
    const me=state.user.id;
    const [t,l]=await Promise.all([
      sb().from('time_entries').select('work_date,hours,status').eq('user_id',me).gte('work_date',a).lte('work_date',b),
      sb().from('leave_requests').select('leave_type,from_date,to_date,days,status').eq('user_id',me).order('from_date',{ascending:false}).limit(5)]);
    D.rows=t.error?[]:t.data.map(r=>({...r,hours:+r.hours}));D.leaves=l.error?[]:l.data;
    D.loading=false;D.loaded=true;
    if(state.tab&&state.tab[state.role]==='dash')render();
  }

  const css=document.createElement('style');
  css.textContent=`.edq{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
  .edq a,.edq button{display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--fg);text-decoration:none;font:inherit;cursor:pointer;min-height:48px;text-align:left}
  .edq a:hover,.edq button:hover{background:var(--accent-soft)}.edq b{display:block}.edq span{font-size:12.5px;color:var(--muted)}`;
  document.head.appendChild(css);

  const fmtLong=k=>parse(k).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  function vEmpDash(){
    const e=state.user;
    if(!D.loaded)load();
    const [a]=weekRange(),total=D.rows.reduce((s,r)=>s+r.hours,0);
    const days=['Mon','Tue','Wed','Thu','Fri','Sat'],per=days.map((_,i)=>{const d=new Date(parse(a).getFullYear(),parse(a).getMonth(),parse(a).getDate()+i);const k=iso(d);return D.rows.filter(r=>r.work_date===k).reduce((s,r)=>s+r.hours,0)});
    const n=s=>D.rows.filter(r=>r.status===s).length;
    const waiting=D.leaves.filter(l=>l.status==='Pending').length;
    const O=window.VIRTUOSO_OFFICE,buy=O?O.buyCount():null;
    const hr=new Date().getHours(),greet=hr<12?'Good morning':hr<18?'Good afternoon':'Good evening';
    const alerts=typeof unreadCount==='function'?unreadCount():0;
    return `<div class="hello"><div><h2>${greet}, ${esc(e.name.split(' ')[0])}</h2><p class="sub" style="margin:0">${esc(fmtLong(today()))}${e.title?' &middot; '+esc(e.title):''}</p></div>
      <div class="row"><button class="btn" data-tab="time">Log time</button><button class="btn ghost" data-tab="leave">Apply for leave</button><button class="btn ghost" data-tab="profile">My profile</button></div></div>
    <div class="tiles">
      <button class="tile link" data-tab="time"><b>${D.loaded?hm(total):'-'}</b><span>Hours this week</span><small>Target 40:00</small></button>
      <button class="tile link" data-tab="time"><b>${D.loaded?n('Draft')+n('Rejected'):'-'}</b><span>Entries to submit</span><small>${D.loaded?n('Pending')+' waiting for approval, '+n('Approved')+' approved':'Loading…'}</small></button>
      <button class="tile link" data-tab="leave"><b>${D.loaded?waiting:'-'}</b><span>Leave applications waiting</span><small>${D.loaded?D.leaves.length+' recent':'Loading…'}</small></button>
      <button class="tile link" data-tab="stationery"><b>${buy===null?'-':buy}</b><span>Office items to buy</span><small>See the Stationery list</small></button>
      <button class="tile link" data-tab="alerts"><b>${alerts}</b><span>Unread alerts</span><small>${alerts?'Open to read them':'You are up to date'}</small></button>
    </div>
    <div class="dgrid">
      <div class="panel"><div class="ph"><h3>Hours by day</h3></div>
        <div class="cols">${per.map(h=>`<div class="c"><i class="${h?'':'empty'}" style="height:${Math.min(100,h/10*100)}%"></i></div>`).join('')}<div class="goal" style="bottom:calc((100% - 8px) * 0.8)"></div></div>
        <div class="clab">${days.map((k,i)=>`<span>${k}<b>${per[i]?per[i].toFixed(1):'-'}</b></span>`).join('')}</div>
        <p class="note" style="margin:10px 0 0">Dashed line marks an 8 hour day.</p></div>
      <div class="panel"><div class="ph"><h3>My leave</h3><button class="btn sm ghost" data-tab="leave">Open</button></div>
        ${D.leaves.length?`<div class="tbl"><table><thead><tr><th>Type</th><th>Dates</th><th>Status</th></tr></thead><tbody>${D.leaves.slice(0,4).map(l=>`<tr><td>${esc(l.leave_type)}</td><td>${esc(fmtShort(l.from_date))} to ${esc(fmtShort(l.to_date))}</td><td>${pill(l.status,stc(l.status))}</td></tr>`).join('')}</tbody></table></div>`:`<p class="note" style="margin:0">${D.loaded?'No leave applications yet.':'Loading…'}</p>`}</div>
    </div>
    <div class="panel"><div class="ph"><h3>Your pages</h3></div><div class="edq">
      <button data-tab="time"><div><b>Timesheet</b><span>Log and submit your hours</span></div></button>
      <button data-tab="leave"><div><b>Leave</b><span>Apply: annual, sick, study, compassionate, unpaid</span></div></button>
      <button data-tab="requests"><div><b>Requests</b><span>Forms and requests to the office</span></div></button>
      <button data-tab="stationery"><div><b>Stationery list</b><span>What is in stock and what to buy</span></div></button>
      <button data-tab="profile"><div><b>My profile</b><span>Your details and change password</span></div></button>
    </div></div>`;
  }
  const fmtShort=k=>parse(k).toLocaleDateString('en-GB',{day:'numeric',month:'short'});

  const adminDash=VIEWS.dash;
  VIEWS.dash=()=>state.role==='emp'?vEmpDash():adminDash();

  /* Employee menu: only pages that suit staff. Payslips stays out while payroll is not in the app. */
  NAV.emp.forEach(g=>{g[1]=g[1].filter(x=>x[0]!=='slip')});
})();
