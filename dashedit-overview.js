/* EMPLOYEE DASHBOARD OVERVIEW inside People > Employee dashboards. After the admin picks an employee, this shows that person's
   dashboard overview as they see it (greeting, hours this week by day, timesheet status, leave waiting, last sign-in, the menu
   they have) directly above the editor, so the admin sees the whole dashboard and edits it below. Read-only numbers: live
   mode reads time_entries, leave_requests and profiles through the admin's RLS; ?demo reads the sample state. */
(function(){
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const MON={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const dayISO=day=>{const m=/(\d{1,2})\s+([A-Za-z]{3})/.exec(day||'');if(!m||!(m[2] in MON))return '';const mo=MON[m[2]];return (mo<2?2027:2026)+'-'+pad(mo+1)+'-'+pad(+m[1])};
  const hm=h=>{const m=Math.round(h*60);return pad(Math.floor(m/60))+':'+pad(m%60)};
  const today=()=>(!LIVE&&state.today)||iso(new Date());
  const O={id:null,loading:false,d:null,err:''};
  function week(){const t=new Date(today()+'T00:00:00'),back=(t.getDay()+6)%7,a=new Date(t.getFullYear(),t.getMonth(),t.getDate()-back);return [a,new Date(a.getFullYear(),a.getMonth(),a.getDate()+6)]}
  async function load(id){
    O.id=id;O.loading=true;O.d=null;O.err='';
    const [a,b]=week(),A=iso(a),B=iso(b);
    try{
      if(!LIVE){
        const u=state.users.find(x=>x.id===id)||{},d=state.data[id]||{entries:[],leaves:[]};
        O.d={name:u.name,title:u.title,last:u.lastLogin||null,
          rows:(d.entries||[]).map(e=>({work_date:e.wd||dayISO(e.day),hours:+e.hrs,status:e.status==='Submitted'?'Pending':e.status})).filter(r=>r.work_date>=A&&r.work_date<=B),
          leaves:(d.leaves||[]).map(l=>({status:l.status}))};
      }else{
        const [p,t,l]=await Promise.all([
          sb().from('profiles').select('name,title,last_login_at').eq('id',id).maybeSingle(),
          sb().from('time_entries').select('work_date,hours,status').eq('user_id',id).gte('work_date',A).lte('work_date',B),
          sb().from('leave_requests').select('status').eq('user_id',id).limit(50)]);
        O.d={name:(p.data||{}).name,title:(p.data||{}).title,last:(p.data||{}).last_login_at?new Date(p.data.last_login_at):null,
          rows:t.error?[]:t.data.map(r=>({...r,hours:+r.hours})),leaves:l.error?[]:l.data};
      }
    }catch(e){O.err='Could not load this employee\'s numbers.'}
    O.loading=false;if(state.tab&&state.tab[state.role]==='dashedit'&&typeof render==='function')render();
  }
  function overview(id){
    if(O.id!==id&&!O.loading)load(id);
    if(O.loading||!O.d)return `<div class="panel" style="margin-top:12px"><p class="note" style="margin:0">${O.err?esc(O.err):'Loading the dashboard overview...'}</p></div>`;
    const d=O.d,[a]=week(),rows=d.rows||[],total=rows.reduce((s,r)=>s+r.hours,0);
    const days=['Mon','Tue','Wed','Thu','Fri','Sat'],per=days.map((_,i)=>{const k=iso(new Date(a.getFullYear(),a.getMonth(),a.getDate()+i));return rows.filter(r=>r.work_date===k).reduce((s,r)=>s+r.hours,0)});
    const max=Math.max(8,...per),n=s=>rows.filter(r=>r.status===s).length;
    const waiting=(d.leaves||[]).filter(l=>l.status==='Pending').length;
    const hr=new Date().getHours(),greet=hr<12?'Good morning':hr<18?'Good afternoon':'Good evening';
    const menu=NAV.emp.filter(g=>g[0]!=='Added for you').flatMap(g=>g[1].map(x=>x[1]));
    const tile=(v,l)=>`<div class="tile"><b>${v}</b><span>${l}</span></div>`;
    return `<div class="panel" style="margin-top:12px;border-color:var(--accent)"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:baseline"><h3 style="margin:0">Dashboard overview: ${esc(d.name||'Employee')}</h3><span class="note">This is what ${esc(String(d.name||'the employee').split(' ')[0])} sees first. Edit the extra content below.</span></div>
      <div style="margin:10px 0 2px"><b style="font-size:18px">${greet}, ${esc(String(d.name||'').split(' ')[0])}</b><div class="note">${esc(d.title||'')}${d.last?' · Last signed in '+esc(new Date(d.last).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})):' · Has not signed in yet'}</div></div>
      <div class="tiles" style="margin:10px 0">${tile(hm(total),'Hours this week')}${tile(n('Draft'),'Draft entries')}${tile(n('Pending'),'Submitted, waiting')}${tile(n('Approved'),'Approved')}${tile(waiting,'Leave waiting')}</div>
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;align-items:end;height:92px">${per.map((h,i)=>`<div style="text-align:center"><div title="${hm(h)}" style="height:${Math.round(h/max*64)}px;min-height:2px;background:var(--accent);border-radius:4px 4px 0 0"></div><div class="note" style="font-size:12px">${days[i]}</div></div>`).join('')}</div>
      <div class="note" style="margin-top:8px"><b>Menu this employee has:</b> ${menu.map(esc).join(', ')}.</div></div>`;
  }
  const base=VIEWS.dashedit;if(!base)return;
  VIEWS.dashedit=()=>{
    const h=base(),m=/<option value="([^"]+)"[^>]*\bselected\b/.exec(h);
    if(!m)return h;
    const i=h.indexOf('<div class="dxtabs">');
    return i<0?h:h.slice(0,i)+overview(m[1])+h.slice(i);
  };
})();
