/* MONTHLY TO DO LIST: a fillable month calendar per person (like the office "Sep 2026 Calendar" sheets), one tab per employee.
   Mon-Sun grid, week rows with a weekly hours total, weekends shaded, days outside the month greyed, today ringed.
   Each day: click the day number to highlight it yellow (a due date / processing day), and type notes in the box.
   AUTOMATIC: the person's own timesheet entries for that day (task, customer, hours) and, on their own tab,
   the tasks due that day in Zoho (if they connected Zoho) are pulled in and refresh by themselves. These are read-only chips.
   Starts on the current month; the arrows move between months.
   Saved per person and month in `monthly_tracker` (migration 0034: a person reads/writes only their own sheet, admins everyone's).
   ?demo keeps it in state.monthly. Menu: Overview > Monthly to do list (admins and employees). Action prefix `mp`. */
(function(){
  'use strict';
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const me=()=>state.user;
  const isAdm=()=>me()&&me().type==='admin';
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const ymOf=d=>d.getFullYear()+'-'+pad(d.getMonth()+1);
  const today=()=>iso(new Date());
  const MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const clip=(s,n)=>String(s==null?'':s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ').slice(0,n);
  const hfmt=h=>{h=Math.round(h*100)/100;return String(h)};
  const M={month:ymOf(new Date()),who:null,people:null,cells:{},rows:[],names:{},loaded:'',loading:false,err:'',status:'',t:null,uid:null,zoho:false};
  const key=()=>M.who+'|'+M.month;
  const mine=()=>me()&&me().id;

  /* ---------- people (tabs) ---------- */
  async function loadPeople(){
    if(M.people)return;
    if(!isAdm()){M.people=[{id:me().id,name:me().name}];M.who=M.who||me().id;return}
    if(!LIVE){M.people=state.users.filter(u=>u.access!==false).map(u=>({id:u.id,name:u.name}))}
    else{
      if(!sb())return;
      const r=await sb().from('profiles').select('id,name,access_enabled').order('name');
      if(r.error){M.err='Could not load the team: '+r.error.message;M.people=[{id:me().id,name:me().name}]}
      else M.people=r.data.filter(u=>u.access_enabled!==false).map(u=>({id:u.id,name:u.name}));
    }
    if(!M.people.some(p=>p.id===M.who))M.who=(M.people.find(p=>p.id===me().id)||M.people[0]||{}).id||me().id;
  }

  /* ---------- data for one person and month ---------- */
  const range=()=>{const [y,m]=M.month.split('-').map(Number);return [M.month+'-01',iso(new Date(y,m,0))]};
  async function load(){
    if(M.loading||!me())return;
    await loadPeople();
    if(!M.who)return;
    if(M.loaded===key())return;
    M.loading=true;M.err='';
    const k=key(),[a,b]=range(),who=M.who;
    let cells={},rows=[];
    if(!LIVE){
      state.monthly=state.monthly||{};cells=state.monthly[k]||{};
      const d=(state.data&&state.data[who])||{entries:[]};
      rows=(d.entries||[]).filter(e=>e.wd&&e.wd>=a&&e.wd<=b).map(e=>({date:e.wd,task:e.task||'',customer:e.client||'',hours:+e.hrs||0}));
    }else if(sb()){
      const [c,t,cl]=await Promise.all([
        sb().from('monthly_tracker').select('cells').eq('user_id',who).eq('month',M.month),
        sb().from('time_entries').select('work_date,task,hours,client_id,status').eq('user_id',who).gte('work_date',a).lte('work_date',b).order('work_date'),
        sb().from('clients').select('id,name')]);
      if(c.error)M.err=/monthly_tracker|schema cache|relation/i.test(c.error.message||'')?'Monthly to do list needs database migration 0034. Run it in the Supabase SQL editor, then reload.':'Could not load: '+c.error.message;
      else cells=(c.data&&c.data[0]&&c.data[0].cells)||{};
      (cl.data||[]).forEach(x=>{M.names[x.id]=x.name});
      rows=(t.data||[]).map(e=>({date:e.work_date,task:e.task||'',customer:M.names[e.client_id]||'',hours:+e.hours||0}));
    }
    if(who!==M.who||M.month!==k.split('|')[1]){M.loading=false;return load()}   /* the tab or month changed while loading */
    M.cells=clean(cells);M.rows=rows;M.loaded=k;M.loading=false;repaint();
  }
  function clean(c){
    const o={};if(!c||typeof c!=='object')return o;
    Object.keys(c).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0,40).forEach(d=>{const v=c[d]||{};const n=clip(v.note,600),m=v.mark==='y'?'y':'';if(n||m)o[d]={note:n,mark:m}});
    return o;
  }
  const repaint=()=>{if(state.tab&&state.tab[state.role]==='monthly')render()};
  function save(){
    const who=M.who,month=M.month,cells=clean(M.cells);
    M.status='Saving…';paintStatus();clearTimeout(M.t);
    if(!LIVE){state.monthly=state.monthly||{};state.monthly[who+'|'+month]=cells;M.status='Saved (sample mode, kept until you reload).';paintStatus();return}
    M.t=setTimeout(async()=>{
      const r=await sb().from('monthly_tracker').upsert({user_id:who,month,cells});
      M.status=r.error?'Could not save: '+(/monthly_tracker|schema cache|relation/i.test(r.error.message||'')?'run migration 0034 first.':r.error.message):'All changes saved.';paintStatus();
    },600);
  }
  const paintStatus=()=>{const e=document.getElementById('mpStatus');if(e)e.textContent=M.status};
  setInterval(()=>{const u=me()?me().id:null;if(u!==M.uid){M.uid=u;M.people=null;M.who=null;M.loaded='';M.cells={};M.rows=[];M.err='';M.status='';M.month=ymOf(new Date());M.zoho=false}},700);
  /* tasks entered in the timesheet or Zoho can change while the page is open: look again every 2 minutes */
  setInterval(()=>{if(state.tab&&state.tab[state.role]==='monthly'&&!document.hidden&&!M.loading){const a=document.activeElement;if(a&&a.classList&&a.classList.contains('mpnote'))return;M.loaded='';repaint()}},120000);

  /* ---------- Zoho tasks due in this month (own tab only) ---------- */
  function zohoTasks(){
    const Z=window.VIRTUOSO_ZOHO;if(!Z||M.who!==mine())return [];
    try{if(!M.zoho){M.zoho=true;const p=Z.load();if(p&&p.then)p.then(()=>setTimeout(repaint,2500));}}catch(e){}
    const s=Z._state?Z._state():null;return (s&&Array.isArray(s.tasks)?s.tasks:[]).filter(t=>t&&t.due&&/^\d{4}-\d{2}-\d{2}$/.test(t.due));
  }

  /* ---------- the page ---------- */
  const css=document.createElement('style');
  css.textContent=`.mpw{display:grid;gap:10px;min-width:0}.mpw>*{min-width:0}
  .mptabs{display:flex;gap:6px;flex-wrap:wrap}.mptab{border:1px solid var(--line);background:var(--panel,#fff);color:inherit;border-radius:999px;padding:7px 14px;font:inherit;font-size:13.5px;cursor:pointer;min-height:36px}
  .mptab[aria-selected=true]{background:#2f5597;color:#fff;border-color:#2f5597;font-weight:700}
  .mpbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.mpbar .grow{flex:1}#mpStatus{font-size:12.5px;color:var(--muted)}
  .mpcard{background:#fff;color:#16254a;border:2px solid #111;border-radius:4px;overflow:hidden}
  .mpmon{background:#2f5597;color:#fff;text-align:center;font-weight:800;font-size:19px;padding:7px 0;letter-spacing:.4px;text-transform:uppercase}
  .mpscroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
  .mpgrid{display:grid;grid-template-columns:repeat(7,minmax(118px,1fr)) 78px;min-width:900px}
  .mpgrid .hd{background:#2f5597;color:#fff;font-size:11px;font-weight:700;text-align:center;padding:4px 0;border-left:1px solid #fff}
  .mpday{border-top:1px solid #111;border-left:1px solid #111;display:flex;flex-direction:column;min-height:108px;background:#fff;position:relative}
  .mpday.we{background:#e8edfb}.mpday.out{background:#f1f1f1}.mpday.mk{background:#ffff00}
  .mpdn{display:flex;justify-content:flex-end;padding:1px 4px;font-size:11px;font-weight:700;border-bottom:1px solid #111;background:inherit;min-height:16px}
  .mpdn button{all:unset;cursor:pointer;padding:0 3px;border-radius:3px;font-weight:700}.mpdn button:hover{outline:1px solid #2f5597}
  .mpday.today .mpdn button,.mpday.today .mpdn span{background:#2f5597;color:#fff;border-radius:9px;padding:0 6px}
  .mpbody{flex:1;display:flex;flex-direction:column;gap:2px;padding:2px}
  .mpchip{font-size:10.5px;line-height:1.25;border-radius:3px;padding:1px 4px;background:#dbe7ff;border-left:3px solid #2f5597;color:#16254a;overflow-wrap:anywhere}
  .mpchip.z{background:#d9f3e4;border-left-color:#1f7a4d}.mpchip.zd{text-decoration:line-through;opacity:.7}.mpchip.zo{background:#ffe1e1;border-left-color:#c62828}
  .mpnote{width:100%;flex:1;min-height:44px;border:0;background:transparent;font:inherit;font-size:12px;color:#16254a;resize:none;padding:2px;box-shadow:none;border-radius:0}
  .mpnote:focus{outline:2px solid #1f7a4d;background:rgba(255,255,255,.7)}.mpnote[readonly]{cursor:default}
  .mpwk{border-top:1px solid #111;border-left:1px solid #111;background:#f5f7fc;font-size:11px;font-style:italic;color:#555;padding:4px;display:flex;flex-direction:column;gap:2px}
  .mpwk b{font-style:normal;color:#16254a;font-size:13px}
  .mplegend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--muted)}.mplegend i{display:inline-block;width:12px;height:12px;border-radius:2px;margin-right:4px;vertical-align:-2px;border:1px solid #888}
  body.mpprinting,body.mpprinting main{background:#fff!important}
  body.mpprinting .mpx{display:none!important}
  html body.mpprinting{margin:0!important;padding:0!important;min-height:0!important;height:auto!important;background:#fff!important}
  body.mpprinting .mpk{display:block!important;min-height:0!important;height:auto!important;max-height:none!important;padding:0!important;margin:0!important;overflow:visible!important;position:static!important;width:auto!important;background:none!important;border:0!important;box-shadow:none!important}
  body.mpprinting .mpw{display:block;gap:0}
  body.mpprinting .mpcard{width:100%;height:188mm;display:flex;flex-direction:column;border-width:1px;-webkit-print-color-adjust:exact;print-color-adjust:exact;break-inside:avoid}
  body.mpprinting .mpmon{padding:4px 0;font-size:16px;flex:none}
  body.mpprinting .mpscroll{overflow:hidden;flex:1;min-height:0}
  body.mpprinting .mpgrid{min-width:0;height:100%;grid-template-columns:repeat(7,1fr) 16mm;grid-template-rows:auto;grid-auto-rows:minmax(0,1fr)}
  body.mpprinting .mpday{min-height:0;overflow:hidden}
  body.mpprinting .mpbody{min-height:0;overflow:hidden}
  body.mpprinting .mpnote{flex:1;min-height:0;height:100%;overflow:hidden;resize:none;font-size:9px}
  body.mpprinting .mpchip{font-size:8.5px}`;
  document.head.appendChild(css);

  function vMonthly(){
    load();
    const [y,m]=M.month.split('-').map(Number),first=new Date(y,m-1,1),last=new Date(y,m,0).getDate();
    const lead=(first.getDay()+6)%7,weeks=Math.ceil((lead+last)/7),t=today(),editable=isAdm()||M.who===mine();
    const zt=zohoTasks(),byDay={},zByDay={};
    M.rows.forEach(r=>{(byDay[r.date]=byDay[r.date]||[]).push(r)});
    zt.forEach(z=>{(zByDay[z.due]=zByDay[z.due]||[]).push(z)});
    const person=(M.people||[]).find(p=>p.id===M.who);
    let grid='';
    ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d=>{grid+=`<div class="hd">${d}</div>`});grid+='<div class="hd">Week</div>';
    for(let w=0;w<weeks;w++){
      let hrs=0;
      for(let c=0;c<7;c++){
        const n=w*7+c-lead+1,inM=n>=1&&n<=last,d=new Date(y,m-1,n),ds=iso(d),cell=inM&&M.cells[ds]||{},mk=inM&&cell.mark==='y';
        if(inM)(byDay[ds]||[]).forEach(r=>{hrs+=r.hours});
        const chips=inM?(byDay[ds]||[]).map(r=>`<div class="mpchip" title="From the timesheet">${esc(r.task||'Time')}${r.customer?' · '+esc(r.customer):''} · ${hfmt(r.hours)}h</div>`).join('')
          +(zByDay[ds]||[]).map(z=>`<div class="mpchip z${z.closed?' zd':(ds<t?' zo':'')}" title="Task from Zoho">${esc(z.name||'Task')}</div>`).join(''):'';
        grid+=`<div class="mpday${c>4?' we':''}${!inM?' out':''}${mk?' mk':''}${ds===t?' today':''}"><div class="mpdn">${inM&&editable?`<button type="button" data-act="mpMark" data-d="${ds}" title="Highlight this day" aria-label="Highlight day ${d.getDate()}">${d.getDate()}</button>`:`<span>${d.getDate()}</span>`}</div>
          <div class="mpbody">${chips}${inM?`<textarea class="mpnote" data-mpn="${ds}" maxlength="600" aria-label="Notes for ${ds}" ${editable?'':'readonly'}>${esc(cell.note||'')}</textarea>`:''}</div></div>`;
      }
      grid+=`<div class="mpwk">Week ${w+1}<b>${hrs?hfmt(hrs)+' h':''}</b></div>`;
    }
    const total=M.rows.reduce((s,r)=>s+r.hours,0),open=zt.filter(z=>!z.closed&&z.due.startsWith(M.month)).length;
    const tabs=(M.people||[]).map(p=>`<button type="button" class="mptab" role="tab" aria-selected="${p.id===M.who}" data-act="mpWho" data-id="${esc(p.id)}">${esc(p.name)}${p.id===mine()?' (me)':''}</button>`).join('');
    return `<div class="mpw"><div><h2 style="margin:0">Monthly to do list</h2><p class="sub" style="margin:2px 0 0">One calendar per person. Type notes in any day and click a day number to highlight it. Timesheet entries${M.who===mine()?' and your Zoho tasks':''} appear by themselves.</p></div>
    ${(M.people||[]).length>1?`<div class="mptabs" role="tablist">${tabs}</div>`:''}
    <div class="mpbar"><button class="btn ghost sm" type="button" data-act="mpPrev" aria-label="Previous month">‹</button><b>${MN[m-1]} ${y}</b><button class="btn ghost sm" type="button" data-act="mpNext" aria-label="Next month">›</button><button class="btn ghost sm" type="button" data-act="mpNow">This month</button><button class="btn ghost sm" type="button" data-act="mpRefresh">Refresh</button><button class="btn ghost sm" type="button" data-act="mpPrint">Print</button><span class="grow"></span><span id="mpStatus" role="status">${esc(M.status)}</span></div>
    ${M.err?`<div class="banner" role="alert" style="border-left-color:var(--bad);background:var(--bad-soft)">${esc(M.err)}</div>`:''}
    ${!editable?'<div class="note">You can read this calendar but not change it.</div>':''}
    <div class="mpcard"><div class="mpmon">${esc((person?person.name+' – ':'')+MN[m-1]+' '+y)}</div><div class="mpscroll"><div class="mpgrid">${grid}</div></div></div>
    <div class="mplegend"><span><i style="background:#ffff00"></i>Highlighted day</span><span><i style="background:#dbe7ff"></i>From the timesheet</span>${M.who===mine()?'<span><i style="background:#d9f3e4"></i>Zoho task</span><span><i style="background:#ffe1e1"></i>Zoho task overdue</span>':''}<span>Month total: <b>${hfmt(total)} h</b>${M.who===mine()&&open?` · ${open} open Zoho task${open===1?'':'s'} due`:''}</span>${M.loading?'<span>Loading…</span>':''}</div></div>`;
  }

  /* Print only the calendar, fitted onto ONE landscape A4 page. */
  function printMonth(){
    const card=document.querySelector('.mpcard');if(!card)return window.print();
    const st=document.createElement('style');st.textContent='@page{size:A4 landscape;margin:8mm}';document.head.appendChild(st);
    document.body.classList.add('mpprinting');
    const hidden=[],kept=[];
    for(let n=card;n&&n!==document.documentElement;n=n.parentNode){if(!n.parentNode)break;if(n!==card&&n!==document.body){n.classList.add('mpk');kept.push(n)}[...n.parentNode.children].forEach(c=>{if(c!==n&&!/^(STYLE|SCRIPT|LINK|META)$/.test(c.tagName)){c.classList.add('mpx');hidden.push(c)}})}
    const done=()=>{hidden.forEach(c=>c.classList.remove('mpx'));kept.forEach(c=>c.classList.remove('mpk'));document.body.classList.remove('mpprinting');st.remove()};
    window.addEventListener('afterprint',done,{once:true});
    setTimeout(()=>window.print(),50);
  }

  /* ---------- actions ---------- */
  const shift=n=>{const [y,m]=M.month.split('-').map(Number);M.month=ymOf(new Date(y,m-1+n,1));M.loaded='';M.status='';render()};
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="mp"]');if(!b)return;
    const a=b.dataset.act;e.stopImmediatePropagation();
    if(a==='mpPrev')return shift(-1);if(a==='mpNext')return shift(1);
    if(a==='mpNow'){M.month=ymOf(new Date());M.loaded='';return render()}
    if(a==='mpRefresh'){M.loaded='';return render()}
    if(a==='mpPrint')return printMonth();
    if(a==='mpWho'){M.who=b.dataset.id;M.loaded='';M.cells={};M.rows=[];M.zoho=false;M.status='';return render()}
    if(a==='mpMark'){
      const d=b.dataset.d;if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!(isAdm()||M.who===mine()))return;
      const c=M.cells[d]||{note:'',mark:''};c.mark=c.mark==='y'?'':'y';
      if(!c.note&&!c.mark)delete M.cells[d];else M.cells[d]=c;
      save();render();
    }
  },true);
  document.addEventListener('change',e=>{
    const t=e.target;if(!t||!t.dataset||!t.dataset.mpn||t.readOnly)return;
    const d=t.dataset.mpn;if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!(isAdm()||M.who===mine()))return;
    const c=M.cells[d]||{note:'',mark:''};c.note=clip(t.value,600);
    if(!c.note&&!c.mark)delete M.cells[d];else M.cells[d]=c;
    save();
  },true);

  VIEWS.monthly=vMonthly;
  ICON.monthly='<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8 13h2M12 13h2M16 13h2M8 17h2M12 17h2"/>';
  [NAV.adm,NAV.emp].forEach(nav=>{const g=nav.find(x=>x[0]==='Overview');if(g&&!g[1].some(x=>x[0]==='monthly'))g[1].splice(1,0,['monthly','Monthly to do list'])});
  window.VIRTUOSO_MONTHLY={state:()=>M};
})();
