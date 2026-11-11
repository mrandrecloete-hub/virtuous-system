/* CUSTOMIZE STUDIO (admin): build and change the app without code.
   - Dashboard: add working widgets to the admin dashboard (live numbers, your own numbers, notes, checklists, tables, links).
   - Pages: create new pages from blocks; they appear in the menu for admins, or for staff too (read only for staff).
   - Menu: show, hide and rename the built-in pages for admins and for employees.
   Everything is data, never code: nothing typed here is ever executed, and the server (row-level security) still decides
   who can read or change real records. Pages live in the custom_pages table (migration 0019); the dashboard layout and menu
   settings live in app_settings (studio_dash, studio_menu). Without migration 0019 the studio says so and pages stay in memory. */
(function(){
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const isAdm=()=>state.user&&state.user.type==='admin';
  const roleKey=()=>state.role;
  const isUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v));
  const clip=(s,n)=>String(s==null?'':s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,n);
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());

  /* ---------- icons ---------- */
  const ICONS={
    star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    bag:'<path d="M6 8h12l1 12H5zM9 8a3 3 0 0 1 6 0"/>',
    users:'<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M19 20a6 6 0 0 0-3-5.2"/>',
    file:'<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    bell:'<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    wrench:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-.5-.5-2.1z"/>',
    home:'<path d="M3 11l9-8 9 8M5 10v10h14V10"/>'
  };
  const iconSvg=k=>ICONS[k]||ICONS.star;

  /* ---------- state and persistence ---------- */
  const ST={loaded:false,loading:false,uid:null,pages:[],menu:{hidden:{adm:[],emp:[]},names:{}},dash:{mode:'add',blocks:[]},
    tab:'dashboard',editId:null,msg:'',err:'',busy:false,saveT:{},status:''};
  const PROTECTED=['dash','settings','profile','studio'];
  let PRISTINE=null;
  const dbMsg=m=>/custom_pages|schema cache|does not exist|relation/i.test(m||'')?'Saving pages needs migration 0019 (custom_pages). Run it in the Supabase SQL editor, then try again.':/row-level|policy|permission|not permitted/i.test(m||'')?'You are not allowed to do that.':'Something went wrong. Try again.';

  const BLOCKS=[
    ['heading','Heading'],['text','Text or announcement'],['checklist','Checklist'],['table','Table (mini spreadsheet)'],
    ['kpi','My number (KPI)'],['stat','Live number from the app'],['countdown','Countdown to a deadline'],['chart','Chart from a table'],['links','Buttons and links']];
  const METRICS={
    approvals:'Waiting for approval (timesheets and leave)',kyc:'KYC forms awaiting review',toBuy:'Office items to buy',
    team:'People who can sign in',hoursWeek:'Hours logged this week',unbilled:'Approved hours not yet billed',
    letters:'Saved client letters',forms:'Forms in the form builder'};
  const rid=()=>Math.random().toString(36).slice(2,10);
  const KINDS=[['bar','Bars'],['hbar','Horizontal bars'],['line','Line'],['pie','Pie'],['donut','Donut']];
  const newBlock=(t)=>({
    heading:{t:'heading',text:'New heading'},
    text:{t:'text',text:'Write your note or announcement here.'},
    checklist:{t:'checklist',title:'Checklist',items:[{text:'First task',done:false}]},
    table:{t:'table',id:rid(),title:'Table',cols:['Item','Amount'],rows:[['Example A','10'],['Example B','25']]},
    countdown:{t:'countdown',label:'Deadline',date:iso(new Date(Date.now()+14*864e5)),repeat:'none'},
    chart:{t:'chart',title:'Chart',kind:'bar',src:'',valCol:1},
    kpi:{t:'kpi',label:'My number',value:'0',unit:'',note:''},
    stat:{t:'stat',metric:'approvals',label:''},
    links:{t:'links',title:'Quick links',items:[{label:'Timesheet',target:'tab:clients'}]}})[t];

  function cleanBlocks(arr){
    if(!Array.isArray(arr))return [];
    const kinds=BLOCKS.map(b=>b[0]);
    return arr.slice(0,60).filter(b=>b&&kinds.includes(b.t)).map(b=>{
      switch(b.t){
        case 'heading':return {t:'heading',text:clip(b.text,120)};
        case 'text':return {t:'text',text:clip(b.text,4000)};
        case 'checklist':return {t:'checklist',title:clip(b.title,80),items:(Array.isArray(b.items)?b.items:[]).slice(0,100).map(i=>({text:clip(i&&i.text,200),done:!!(i&&i.done)}))};
        case 'table':{const cols=(Array.isArray(b.cols)?b.cols:[]).slice(0,8).map(c=>clip(c,40));const n=Math.max(cols.length,1);
          return {t:'table',id:/^[a-z0-9]{4,12}$/.test(b.id||'')?b.id:rid(),title:clip(b.title,80),cols:cols.length?cols:['Column'],rows:(Array.isArray(b.rows)?b.rows:[]).slice(0,200).map(r=>Array.from({length:n},(_,i)=>clip(Array.isArray(r)?r[i]:'',200)))}}
        case 'countdown':return {t:'countdown',label:clip(b.label,60),date:/^\d{4}-\d{2}-\d{2}$/.test(b.date||'')?b.date:iso(new Date()),repeat:['monthly','yearly'].includes(b.repeat)?b.repeat:'none'};
        case 'chart':return {t:'chart',title:clip(b.title,80),kind:KINDS.some(k=>k[0]===b.kind)?b.kind:'bar',src:/^[a-z0-9]{4,12}$/.test(b.src||'')?b.src:'',valCol:Math.min(7,Math.max(0,parseInt(b.valCol)||1))};
        case 'kpi':return {t:'kpi',label:clip(b.label,60),value:clip(b.value,30),unit:clip(b.unit,12),note:clip(b.note,120)};
        case 'stat':return {t:'stat',metric:METRICS[b.metric]?b.metric:'approvals',label:clip(b.label,60)};
        case 'links':return {t:'links',title:clip(b.title,80),items:(Array.isArray(b.items)?b.items:[]).slice(0,20).map(i=>({label:clip(i&&i.label,60),target:/^(tab:[A-Za-z0-9_-]{1,60}|url:https:\/\/[^\s]{3,300})$/.test(i&&i.target||'')?i.target:'tab:dash'}))};
      }}).filter(Boolean);
  }
  const cleanPage=p=>({id:String(p.id),title:clip(p.title,60)||'Untitled',icon:ICONS[p.icon]?p.icon:'star',audience:p.audience==='staff'?'staff':'admin',position:+p.position||0,blocks:cleanBlocks(p.blocks)});

  async function load(){
    if(ST.loading||ST.loaded||!state.user)return;
    ST.loading=true;
    if(!LIVE){
      const s=state.studio=state.studio||{pages:[],menu:null,dash:null};
      ST.pages=(s.pages||[]).map(cleanPage);if(s.menu)ST.menu=s.menu;if(s.dash)ST.dash={mode:s.dash.mode==='only'?'only':'add',blocks:cleanBlocks(s.dash.blocks)};
    }else{
      if(!sb()){ST.loading=false;return}
      const [pg,cf]=await Promise.all([sb().from('custom_pages').select('id,title,icon,audience,position,blocks').order('position').order('created_at'),
        sb().from('app_settings').select('key,value').in('key',['studio_menu','studio_dash'])]);
      if(pg.error){ST.err=isAdm()?dbMsg(pg.error.message):'';ST.pages=[]}else ST.pages=(pg.data||[]).map(cleanPage);
      (cf.data||[]).forEach(r=>{
        if(r.key==='studio_menu'&&r.value&&typeof r.value==='object'){const h=r.value.hidden||{},n=r.value.names||{};
          ST.menu={hidden:{adm:(Array.isArray(h.adm)?h.adm:[]).map(x=>clip(x,60)),emp:(Array.isArray(h.emp)?h.emp:[]).map(x=>clip(x,60))},names:Object.fromEntries(Object.entries(n).slice(0,80).map(([k,v])=>[clip(k,60),clip(v,40)]))}}
        if(r.key==='studio_dash'&&r.value&&typeof r.value==='object')ST.dash={mode:r.value.mode==='only'?'only':'add',blocks:cleanBlocks(r.value.blocks)};
      });
    }
    ST.loading=false;ST.loaded=true;rebuild();render();
  }
  setInterval(()=>{const u=state.user?state.user.id:null;if(u!==ST.uid){ST.uid=u;ST.loaded=false;ST.loading=false;ST.editId=null;ST.msg='';ST.err='';M.loaded=false;if(u)load();else rebuild(true)}},700);

  const setStatus=s=>{ST.status=s;const e=document.getElementById('sdStatus');if(e)e.textContent=s};
  function persistSettings(key,value){
    if(!LIVE){state.studio=state.studio||{};state.studio[key==='studio_menu'?'menu':'dash']=value;setStatus('Saved (sample mode, kept until you reload).');return}
    setStatus('Saving…');clearTimeout(ST.saveT[key]);
    ST.saveT[key]=setTimeout(async()=>{const r=await sb().from('app_settings').upsert({key,value});setStatus(r.error?'Could not save. Check your connection.':'All changes saved.')},600);
  }
  const saveMenu=()=>persistSettings('studio_menu',ST.menu);
  const saveDash=()=>persistSettings('studio_dash',{mode:ST.dash.mode,blocks:ST.dash.blocks});
  function savePage(p,immediate){
    if(!LIVE){state.studio=state.studio||{pages:[]};state.studio.pages=ST.pages.map(x=>JSON.parse(JSON.stringify(x)));setStatus('Saved (sample mode, kept until you reload).');return}
    if(!isUuid(p.id))return;
    setStatus('Saving…');clearTimeout(ST.saveT[p.id]);
    const go=async()=>{const r=await sb().from('custom_pages').update({title:p.title,icon:p.icon,audience:p.audience,position:p.position,blocks:p.blocks}).eq('id',p.id);
      if(r.error){ST.err=dbMsg(r.error.message);setStatus('Could not save.');render()}else{ST.err='';setStatus('All changes saved.')}};
    if(immediate)go();else ST.saveT[p.id]=setTimeout(go,700);
  }

  /* ---------- live numbers ---------- */
  const M={loaded:false,loading:false,v:{}};
  async function loadMetrics(){
    if(M.loading||M.loaded||!state.user)return;
    M.loading=true;const v={};
    const a=weekStart(),b=iso(new Date(new Date(a+'T00:00:00').getTime()+6*864e5));
    try{
      if(!LIVE){
        const ents=[];state.users.forEach(u=>((state.data[u.id]||{}).entries||[]).forEach(e=>ents.push(e)));
        v.approvals=(state.approvals||[]).filter(x=>x.status==='Pending').length;
        v.hoursWeek=ents.reduce((s,e)=>s+(+e.hrs||0),0);
        v.unbilled=ents.filter(e=>e.status==='Approved'&&!e.billed).reduce((s,e)=>s+(+e.hrs||0),0);
        v.team=state.users.filter(u=>u.access).length;v.letters=(state.letters||[]).length;
      }else if(isAdm()&&sb()){
        const [t,l,w,u,ub,lt]=await Promise.all([
          sb().from('time_entries').select('id').eq('status','Pending').limit(1000),
          sb().from('leave_requests').select('id').eq('status','Pending').limit(1000),
          sb().from('time_entries').select('hours').gte('work_date',a).lte('work_date',b).limit(5000),
          sb().from('profiles').select('id').eq('access_enabled',true).limit(1000),
          sb().from('time_entries').select('hours').eq('status','Approved').eq('billed',false).limit(5000),
          sb().from('client_letters').select('id').limit(1000)]);
        v.approvals=(t.data||[]).length+(l.data||[]).length;v.hoursWeek=(w.data||[]).reduce((s,r)=>s+(+r.hours||0),0);
        v.team=(u.data||[]).length;v.unbilled=(ub.data||[]).reduce((s,r)=>s+(+r.hours||0),0);v.letters=lt.error?null:(lt.data||[]).length;
      }
    }catch(e){}
    v.kyc=(state.subs||[]).filter(s=>s.status==='Pending').length;v.forms=(state.forms||[]).length;
    M.v=v;M.loaded=true;M.loading=false;
    const t=state.tab&&state.tab[state.role];if(t==='dash'||t==='studio'||/^sp_/.test(t||''))render();
  }
  function weekStart(){const t=new Date((!LIVE&&state.today?state.today:iso(new Date()))+'T00:00:00'),back=(t.getDay()+6)%7;return iso(new Date(t.getFullYear(),t.getMonth(),t.getDate()-back))}
  const hm=h=>{const m=Math.round(h*60);return pad(Math.floor(m/60))+':'+pad(m%60)};
  function metricValue(k){
    if(!M.loaded){loadMetrics();return '-'}
    if(k==='toBuy'){const O=window.VIRTUOSO_OFFICE;const n=O?O.buyCount():null;return n===null?'-':String(n)}
    const x=M.v[k];if(x==null)return '-';
    return (k==='hoursWeek'||k==='unbilled')?hm(x):String(x);
  }

  /* ---------- menu ---------- */
  function snapshot(){
    if(PRISTINE)return;
    const keep=g=>g[0]!=='Added for you'&&g[0]!=='My pages';
    PRISTINE={adm:NAV.adm.filter(keep).map(g=>[g[0],g[1].map(x=>x.slice())]),emp:NAV.emp.filter(keep).map(g=>[g[0],g[1].map(x=>x.slice())])};
  }
  const builtIn=r=>{snapshot();return PRISTINE[r].flatMap(g=>g[1])};
  function pageKey(p){return 'sp_'+p.id}
  function rebuild(reset){
    snapshot();
    ['adm','emp'].forEach(r=>{
      const hidden=reset?[]:(ST.menu.hidden[r]||[]),names=reset?{}:(ST.menu.names||{});
      const groups=PRISTINE[r].map(([g,items])=>[g,items.filter(x=>PROTECTED.includes(x[0])||!hidden.includes(x[0])).map(x=>[x[0],clip(names[x[0]],40)||x[1]])]).filter(g=>g[1].length);
      const pages=reset?[]:ST.pages.filter(p=>r==='adm'||p.audience==='staff');
      if(pages.length){
        const at=groups.findIndex(g=>g[0]==='Account');
        const grp=['My pages',pages.map(p=>[pageKey(p),p.title])];
        if(at>=0)groups.splice(at,0,grp);else groups.push(grp);
      }
      if(r==='adm'){const acc=groups.find(g=>g[0]==='Account');if(acc&&!acc[1].some(x=>x[0]==='studio'))acc[1].splice(Math.max(acc[1].findIndex(x=>x[0]==='profile'),0),0,['studio','Customize'])}
      /* keep groups that other modules add later (for example the 'Added for you' pages from the employee dashboard editor) */
      const known=PRISTINE[r].map(g=>g[0]).concat(['My pages']);
      (NAV[r]||[]).forEach(g=>{if(!known.includes(g[0])&&!groups.some(x=>x[0]===g[0]))groups.splice(Math.max(groups.findIndex(x=>x[0]==='Account'),0),0,g)});
      NAV[r]=groups;
    });
    ST.pages.forEach(p=>{VIEWS[pageKey(p)]=()=>pageView(p.id);ICON[pageKey(p)]=iconSvg(p.icon)});
    const cur=state.tab&&state.tab[state.role];
    if(cur&&!NAV[state.role].some(g=>g[1].some(x=>x[0]===cur)))state.tab[state.role]='dash';
  }
  ICON.studio='<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z"/><path d="M5 17l.8 2L8 20l-2.2.8L5 23l-.8-2.2L2 20l2.2-.8z" transform="translate(1 -3)"/>';
  VIEWS.studio=studioView;

  /* ---------- block rendering (view mode) ---------- */
  function renderBlock(b,bi,ctx){
    const canTick=ctx.canEdit;
    switch(b.t){
      case 'heading':return `<h3 style="margin:6px 0 0">${esc(b.text)}</h3>`;
      case 'text':return `<div class="panel"><p style="margin:0;white-space:pre-wrap">${esc(b.text)}</p></div>`;
      case 'kpi':return `<div class="tile"><b>${esc(b.value)}${b.unit?` <small style="display:inline;font-size:.55em">${esc(b.unit)}</small>`:''}</b><span>${esc(b.label)}</span>${b.note?`<small>${esc(b.note)}</small>`:''}</div>`;
      case 'stat':return `<div class="tile"><b>${esc(metricValue(b.metric))}</b><span>${esc(b.label||METRICS[b.metric])}</span></div>`;
      case 'checklist':{const done=b.items.filter(i=>i.done).length;
        return `<div class="panel"><div class="ph"><h3>${esc(b.title)}</h3><span class="note">${done} of ${b.items.length} done</span></div>${b.items.length?b.items.map((i,ii)=>`<label class="chk" style="margin:4px 0"><input type="checkbox" ${i.done?'checked':''} ${canTick?`data-sdtick="${ctx.pathBase}.${bi}.items.${ii}.done"`:'disabled'}> <span style="${i.done?'text-decoration:line-through;color:var(--muted)':''}">${esc(i.text)}</span></label>`).join(''):'<p class="note" style="margin:0">Nothing here yet.</p>'}</div>`}
      case 'table':return `<div class="panel"><h3>${esc(b.title)}</h3><div class="tbl"><table style="min-width:${Math.min(b.cols.length*140,900)}px"><thead><tr>${b.cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.length?b.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${b.cols.length}" class="note">No rows.</td></tr>`}</tbody></table></div></div>`;
      case 'countdown':{const c=countdown(b);return `<div class="tile"><b style="color:${c.color}">${esc(c.big)}</b><span>${esc(b.label)}</span><small>${esc(c.small)}</small></div>`}
      case 'chart':{const T=(ctx.blocks||[]).find(x=>x.t==='table'&&x.id===b.src),TOOLS=window.VIRTUOSO_TOOLS;
        if(!T)return `<div class="panel"><h3>${esc(b.title)}</h3><p class="note" style="margin:0">Choose a table for this chart.${ctx.canEdit?'':' (The table may have been removed.)'}</p></div>`;
        if(!TOOLS||!TOOLS.chartSVG)return `<div class="panel"><h3>${esc(b.title)}</h3><p class="note" style="margin:0">Charts are not available right now.</p></div>`;
        const col=Math.min(b.valCol,T.cols.length-1),rows=T.rows.map(r=>({label:String(r[0]||'').slice(0,24)||'-',value:parseFloat(String(r[col]||'').replace(/[^0-9.\-]/g,''))})).filter(r=>isFinite(r.value)).slice(0,24);
        if(!rows.length)return `<div class="panel"><h3>${esc(b.title)}</h3><p class="note" style="margin:0">Type some numbers into the table (first column names, then a column of numbers) to see the chart.</p></div>`;
        return `<div class="panel"><h3>${esc(b.title)}</h3><div style="max-width:640px">${TOOLS.chartSVG(b.kind,'',rows)}</div></div>`}
      case 'links':return `<div class="panel"><h3>${esc(b.title)}</h3><div class="row">${b.items.map(i=>{
        if(i.target.startsWith('url:'))return `<a class="btn ghost sm" href="${esc(i.target.slice(4))}" target="_blank" rel="noopener noreferrer">${esc(i.label)}</a>`;
        const tab=i.target.slice(4);return `<button class="btn ghost sm" data-tab="${esc(tab)}">${esc(i.label)}</button>`}).join('')||'<span class="note">No links yet.</span>'}</div></div>`;
    }return '';
  }
  function countdown(b){
    const t0=new Date((!LIVE&&state.today?state.today:iso(new Date()))+'T00:00:00'),d=new Date(b.date+'T00:00:00');let due=d;
    if(b.repeat==='yearly'){due=new Date(t0.getFullYear(),d.getMonth(),d.getDate());if(due<t0)due=new Date(t0.getFullYear()+1,d.getMonth(),d.getDate())}
    if(b.repeat==='monthly'){const dim=(y,m)=>new Date(y,m+1,0).getDate();due=new Date(t0.getFullYear(),t0.getMonth(),Math.min(d.getDate(),dim(t0.getFullYear(),t0.getMonth())));
      if(due<t0)due=new Date(t0.getFullYear(),t0.getMonth()+1,Math.min(d.getDate(),dim(t0.getFullYear(),t0.getMonth()+1)))}
    const n=Math.round((due-t0)/864e5),fmt=due.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
    if(n<0)return {big:Math.abs(n)+(Math.abs(n)===1?' day':' days')+' overdue',small:'Was due '+fmt,color:'var(--bad,#b3261e)'};
    if(n===0)return {big:'Today',small:'Due '+fmt,color:'var(--bad,#b3261e)'};
    return {big:n+(n===1?' day':' days'),small:'Due '+fmt+(b.repeat!=='none'?' (repeats '+b.repeat+')':''),color:n<=7?'var(--warn,#9a6700)':'inherit'};
  }
  function blocksHTML(blocks,ctx){
    ctx.blocks=blocks;
    const out=[],run=[];
    const flush=()=>{if(run.length){out.push(`<div class="tiles">${run.join('')}</div>`);run.length=0}};
    blocks.forEach((b,i)=>{if(b.t==='kpi'||b.t==='stat'||b.t==='countdown')run.push(renderBlock(b,i,ctx));else{flush();out.push(renderBlock(b,i,ctx))}});
    flush();return out.join('');
  }
  function pageView(id){
    const p=ST.pages.find(x=>x.id===id);if(!p)return '<h2>Page not found</h2><p class="sub">This page was removed.</p>';
    const ctx={canEdit:isAdm()&&p.audience==='admin'||false,pathBase:'blocks'};
    ctx.canEdit=isAdm();
    return `<div class="hello"><div><h2>${esc(p.title)}</h2><p class="sub" style="margin:0">${p.audience==='staff'?'Visible to everyone':'Only administrators see this page'}</p></div>${isAdm()?`<div class="row"><button class="btn ghost" data-act="sdEditPage" data-id="${esc(p.id)}">Edit this page</button></div>`:''}</div>
    <div class="stack">${p.blocks.length?blocksHTML(p.blocks,ctx):`<div class="panel"><p class="note" style="margin:0">This page is empty.${isAdm()?' Use Edit this page to add blocks.':''}</p></div>`}</div>`;
  }

  /* ---------- admin dashboard widgets ---------- */
  const adminDash=VIEWS.dash;
  VIEWS.dash=function(){
    if(state.role!=='adm'||!ST.dash.blocks.length)return adminDash();
    const widgets=`<div class="stack" style="margin-bottom:14px">${blocksHTML(ST.dash.blocks,{canEdit:true,pathBase:'dash.blocks'})}</div>`;
    if(ST.dash.mode==='only'){
      const hr=new Date().getHours(),greet=hr<12?'Good morning':hr<18?'Good afternoon':'Good evening';
      return `<div class="hello"><div><h2>${greet}, ${esc(state.user.name.split(' ')[0])}</h2><p class="sub" style="margin:0">Your dashboard</p></div><div class="row"><button class="btn ghost" data-tab="studio">Customize</button></div></div>${widgets}`;
    }
    return `<div class="panel" style="margin-bottom:14px;border-left:4px solid var(--accent)"><div class="ph"><h3>My dashboard</h3><button class="btn sm ghost" data-tab="studio">Customize</button></div>${widgets}</div>${adminDash()}`;
  };

  /* ---------- the studio page ---------- */
  const get=(root,path)=>path.split('.').reduce((o,k)=>o==null?o:o[k],root);
  function setPath(root,path,val){const k=path.split('.'),last=k.pop(),o=k.reduce((a,x)=>a==null?a:a[x],root);if(o!=null)o[last]=val}
  function ctxRoot(){return {dash:ST.dash,blocks:(ST.pages.find(p=>p.id===ST.editId)||{}).blocks}}
  const inp=(path,val,ph,extra)=>`<input data-sd="${path}" value="${esc(val)}" ${ph?`placeholder="${esc(ph)}"`:''} ${extra||''}>`;
  function targets(forStaff){
    const r=forStaff?'emp':'adm',opts=[];
    builtIn(r).forEach(x=>{if(x[0]!=='studio')opts.push(['tab:'+x[0],x[1]])});
    ST.pages.filter(p=>!forStaff||p.audience==='staff').forEach(p=>opts.push(['tab:'+pageKey(p),p.title+' (my page)']));
    return opts;
  }
  function blockEditor(b,bi,base,forStaff,all){
    const P=`${base}.${bi}`;
    const mv=`<div class="row" style="gap:4px"><button class="btn sm ghost" data-act="sdMove" data-p="${base}" data-i="${bi}" data-d="-1" aria-label="Move up">↑</button><button class="btn sm ghost" data-act="sdMove" data-p="${base}" data-i="${bi}" data-d="1" aria-label="Move down">↓</button><button class="btn sm ghost bad" data-act="sdDelBlock" data-p="${base}" data-i="${bi}" aria-label="Remove block">Remove</button></div>`;
    const head=(n)=>`<div class="ph"><h3 style="font-size:14px">${n}</h3>${mv}</div>`;
    let body='';
    switch(b.t){
      case 'heading':body=head('Heading')+`<label>Text${inp(P+'.text',b.text,'','maxlength="120"')}</label>`;break;
      case 'text':body=head('Text')+`<label>Text<textarea data-sd="${P}.text" rows="4" maxlength="4000">${esc(b.text)}</textarea></label>`;break;
      case 'kpi':body=head('My number')+`<div class="form"><label>Label${inp(P+'.label',b.label,'','maxlength="60"')}</label><label>Value${inp(P+'.value',b.value,'e.g. 12 or N$ 45 000','maxlength="30"')}</label><label>Unit${inp(P+'.unit',b.unit,'e.g. hours','maxlength="12"')}</label><label>Small note${inp(P+'.note',b.note,'','maxlength="120"')}</label></div>`;break;
      case 'stat':body=head('Live number')+`<div class="form"><label>What to show<select data-sd="${P}.metric">${Object.entries(METRICS).filter(([k])=>!forStaff||k==='toBuy').map(([k,l])=>`<option value="${k}" ${b.metric===k?'selected':''}>${esc(l)}</option>`).join('')}</select></label><label>Label (optional)${inp(P+'.label',b.label,'','maxlength="60"')}</label></div><p class="note" style="margin:0">Shows: <b>${esc(metricValue(b.metric))}</b></p>`;break;
      case 'checklist':body=head('Checklist')+`<label>Title${inp(P+'.title',b.title,'','maxlength="80"')}</label>`+b.items.map((i,ii)=>`<div class="row" style="flex-wrap:nowrap;margin-top:6px"><input type="checkbox" data-sdtick="${P}.items.${ii}.done" ${i.done?'checked':''} aria-label="Done"><input data-sd="${P}.items.${ii}.text" value="${esc(i.text)}" maxlength="200" style="flex:1"><button class="btn sm ghost bad" data-act="sdDelItem" data-p="${P}.items" data-i="${ii}" aria-label="Remove item">×</button></div>`).join('')+`<div style="margin-top:8px"><button class="btn sm ghost" data-act="sdAddItem" data-p="${P}.items">+ Add item</button></div>`;break;
      case 'table':body=head('Table')+`<label>Title${inp(P+'.title',b.title,'','maxlength="80"')}</label><div class="tbl" style="margin-top:8px"><table><thead><tr>${b.cols.map((c,ci)=>`<th><input data-sd="${P}.cols.${ci}" value="${esc(c)}" maxlength="40" aria-label="Column name"></th>`).join('')}<th>${b.cols.length<8?`<button class="btn sm ghost" data-act="sdAddCol" data-p="${P}">+ column</button>`:''}</th></tr></thead><tbody>${b.rows.map((r,ri)=>`<tr>${r.map((c,ci)=>`<td><input data-sd="${P}.rows.${ri}.${ci}" value="${esc(c)}" maxlength="200" aria-label="Row ${ri+1} column ${ci+1}"></td>`).join('')}<td><button class="btn sm ghost bad" data-act="sdDelItem" data-p="${P}.rows" data-i="${ri}" aria-label="Remove row">×</button></td></tr>`).join('')}</tbody></table></div><div class="row" style="margin-top:8px"><button class="btn sm ghost" data-act="sdAddRow" data-p="${P}">+ Add row</button>${b.cols.length>1?`<button class="btn sm ghost" data-act="sdDelCol" data-p="${P}">Remove last column</button>`:''}</div>`;break;
      case 'countdown':body=head('Countdown')+`<div class="form"><label>What is due${inp(P+'.label',b.label,'e.g. VAT return','maxlength="60"')}</label><label>Date<input type="date" data-sd="${P}.date" value="${esc(b.date)}"></label><label>Repeats<select data-sd="${P}.repeat"><option value="none" ${b.repeat==='none'?'selected':''}>Does not repeat</option><option value="monthly" ${b.repeat==='monthly'?'selected':''}>Every month</option><option value="yearly" ${b.repeat==='yearly'?'selected':''}>Every year</option></select></label></div><p class="note" style="margin:0">Shows: <b>${esc(countdown(b).big)}</b></p>`;break;
      case 'chart':{const tabs=(all||[]).filter(x=>x.t==='table'),T=tabs.find(x=>x.id===b.src);
        body=head('Chart from a table')+`<div class="form"><label>Title${inp(P+'.title',b.title,'','maxlength="80"')}</label><label>Chart type<select data-sd="${P}.kind">${KINDS.map(k=>`<option value="${k[0]}" ${b.kind===k[0]?'selected':''}>${k[1]}</option>`).join('')}</select></label>
        <label>Table to chart<select data-sd="${P}.src"><option value="">Choose a table</option>${tabs.map(x=>`<option value="${esc(x.id)}" ${b.src===x.id?'selected':''}>${esc(x.title||'Untitled table')}</option>`).join('')}</select></label>
        <label>Numbers from column<select data-sd="${P}.valCol">${(T?T.cols:[]).map((c,ci)=>ci===0?'':`<option value="${ci}" ${b.valCol===ci?'selected':''}>${esc(c||'Column '+(ci+1))}</option>`).join('')}</select></label></div>${tabs.length?'<p class="note" style="margin:0">The first column of the table gives the names; the chosen column gives the numbers.</p>':'<p class="note" style="margin:0">Add a table block first, then pick it here.</p>'}`;break}
      case 'links':body=head('Buttons and links')+`<label>Title${inp(P+'.title',b.title,'','maxlength="80"')}</label>`+b.items.map((i,ii)=>{const tg=targets(forStaff),isUrl=i.target.startsWith('url:');
        return `<div class="row" style="flex-wrap:wrap;margin-top:6px"><input data-sd="${P}.items.${ii}.label" value="${esc(i.label)}" maxlength="60" placeholder="Button text" style="flex:1;min-width:120px"><select data-sdt="${P}.items.${ii}.target" style="flex:1;min-width:150px">${tg.map(([v,l])=>`<option value="${esc(v)}" ${i.target===v?'selected':''}>${esc(l)}</option>`).join('')}<option value="url:" ${isUrl?'selected':''}>A web address (https)</option></select>${isUrl?`<input data-sd="${P}.items.${ii}.target" value="${esc(i.target.slice(4))}" data-prefix="url:" placeholder="https://" style="flex:2;min-width:160px">`:''}<button class="btn sm ghost bad" data-act="sdDelItem" data-p="${P}.items" data-i="${ii}" aria-label="Remove link">×</button></div>`}).join('')+`<div style="margin-top:8px"><button class="btn sm ghost" data-act="sdAddItem" data-p="${P}.items">+ Add button</button></div>`;break;
    }
    return `<div class="panel" style="margin-bottom:10px">${body}</div>`;
  }
  function addMenu(base,forStaff){
    return `<div class="panel" style="border-style:dashed"><h3 style="font-size:14px">Add a block</h3><div class="row">${BLOCKS.filter(b=>!(forStaff&&b[0]==='stat')).map(([k,l])=>`<button class="btn sm ghost" data-act="sdAddBlock" data-p="${base}" data-t="${k}">+ ${esc(l)}</button>`).join('')}</div></div>`;
  }
  function tabsBar(){
    return `<div class="seg" role="tablist" style="margin-bottom:14px">${[['dashboard','My dashboard'],['pages','Pages'],['menu','Menu']].map(([k,l])=>`<button class="btn ghost sm" data-act="sdTab" data-t="${k}" aria-pressed="${ST.tab===k&&!ST.editId}">${l}</button>`).join('')}</div>`;
  }
  function studioView(){
    if(!isAdm())return '<h2>Customize</h2><div class="panel"><p class="note">Only an administrator can customize the app.</p></div>';
    if(!ST.loaded)load();
    loadMetrics();
    const head=`<h2>Customize</h2><p class="sub">Build your own dashboard widgets and pages, and choose what shows in the menu. No code needed. <span id="sdStatus" role="status">${esc(ST.status)}</span></p>`;
    const err=ST.err?`<div class="banner" role="alert" style="border-left-color:var(--bad);background:var(--bad-soft)">${esc(ST.err)}</div>`:'';
    if(ST.editId){
      const p=ST.pages.find(x=>x.id===ST.editId);if(!p){ST.editId=null}
      else return head+err+`<div class="row" style="margin-bottom:12px"><button class="btn ghost sm" data-act="sdBack">&larr; Back to pages</button><button class="btn sm" data-act="sdOpenPage" data-id="${esc(p.id)}">View the page</button></div>
      <div class="panel stack" style="margin-bottom:12px"><h3>Page settings</h3><div class="form"><label>Page name${inp('page.title',p.title,'','maxlength="60"')}</label>
        <label>Icon<select data-sd="page.icon">${Object.keys(ICONS).map(k=>`<option value="${k}" ${p.icon===k?'selected':''}>${k}</option>`).join('')}</select></label>
        <label>Who can see it<select data-sd="page.audience"><option value="admin" ${p.audience==='admin'?'selected':''}>Only administrators</option><option value="staff" ${p.audience==='staff'?'selected':''}>Everyone (staff read only)</option></select></label></div>
        ${p.audience==='staff'?'<p class="note" style="margin:0">Staff can read this page but cannot change it. Do not put private figures here. Live numbers are limited to non-sensitive ones.</p>':''}</div>
      ${p.blocks.map((b,i)=>blockEditor(b,i,'blocks',p.audience==='staff',p.blocks)).join('')}${addMenu('blocks',p.audience==='staff')}`;
    }
    let body='';
    if(ST.tab==='dashboard'){
      body=`<div class="panel stack" style="margin-bottom:12px"><h3>Your admin dashboard</h3><p class="note" style="margin:0">Widgets appear at the top of your dashboard. Only you (administrators) see them.</p>
        <label>Layout<select data-sd="dash.mode"><option value="add" ${ST.dash.mode==='add'?'selected':''}>Show my widgets above the standard dashboard</option><option value="only" ${ST.dash.mode==='only'?'selected':''}>Show only my widgets</option></select></label>
        <div><button class="btn sm ghost" data-tab="dash">Look at the dashboard</button></div></div>
        ${ST.dash.blocks.map((b,i)=>blockEditor(b,i,'dash.blocks',false,ST.dash.blocks)).join('')}${addMenu('dash.blocks',false)}`;
    }else if(ST.tab==='pages'){
      body=`<div class="panel stack" style="margin-bottom:12px"><h3>New page</h3><form class="form" id="sdNewPage" novalidate><label>Page name<input id="sdNpTitle" maxlength="60" placeholder="e.g. Tax deadlines"></label>
        <label>Who can see it<select id="sdNpAud"><option value="admin">Only administrators</option><option value="staff">Everyone (staff read only)</option></select></label><div><button class="btn" type="submit" ${ST.busy?'disabled':''}>Create page</button></div></form></div>
        <div class="panel"><h3>Your pages</h3>${ST.pages.length?`<div class="tbl"><table style="min-width:520px"><thead><tr><th>Page</th><th>Visible to</th><th class="n">Blocks</th><th></th></tr></thead><tbody>${ST.pages.map((p,i)=>`<tr><td>${esc(p.title)}</td><td>${p.audience==='staff'?'Everyone':'Administrators'}</td><td class="n">${p.blocks.length}</td><td><div class="row"><button class="btn sm" data-act="sdEditPage" data-id="${esc(p.id)}">Edit</button><button class="btn sm ghost" data-act="sdOpenPage" data-id="${esc(p.id)}">Open</button><button class="btn sm ghost" data-act="sdMovePage" data-i="${i}" data-d="-1" aria-label="Move up">↑</button><button class="btn sm ghost" data-act="sdMovePage" data-i="${i}" data-d="1" aria-label="Move down">↓</button><button class="btn sm ghost bad" data-act="sdDelPage" data-id="${esc(p.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table></div>`:'<p class="note" style="margin:0">No pages yet. Create your first one above.</p>'}</div>`;
    }else{
      const sect=(r,title)=>`<div class="panel" style="margin-bottom:12px"><h3>${title}</h3><div class="tbl"><table style="min-width:480px"><thead><tr><th>Page</th><th>Shown</th><th>Menu name</th></tr></thead><tbody>${builtIn(r).filter(x=>x[0]!=='studio').map(x=>{const lock=PROTECTED.includes(x[0]),hid=(ST.menu.hidden[r]||[]).includes(x[0]);
        return `<tr><td>${esc(x[1])}</td><td>${lock?'<span class="note">Always shown</span>':`<label class="chk"><input type="checkbox" data-sdshow="${r}:${x[0]}" ${hid?'':'checked'}> Show</label>`}</td><td><input data-sdname="${x[0]}" value="${esc(ST.menu.names[x[0]]||'')}" placeholder="${esc(x[1])}" maxlength="40" aria-label="Menu name for ${esc(x[1])}"></td></tr>`}).join('')}</tbody></table></div></div>`;
      body=`<p class="note">Hiding a page only removes it from the menu. It does not change what the database lets people read or change. Renaming applies to administrators and employees alike.</p>${sect('adm','Administrator menu')}${sect('emp','Employee menu')}<div><button class="btn ghost" data-act="sdResetMenu">Reset the menu to the original</button></div>`;
    }
    return head+err+tabsBar()+body;
  }

  /* ---------- events ---------- */
  const afterEdit=()=>{if(ST.editId){const p=ST.pages.find(x=>x.id===ST.editId);if(p)savePage(p)}else if(ST.tab==='dashboard')saveDash()};
  document.addEventListener('input',e=>{
    const t=e.target;if(!t||!isAdm())return;
    if(t.dataset&&t.dataset.sd){
      e.stopImmediatePropagation();let v=t.value;const path=t.dataset.sd;
      if(path.startsWith('page.')){const p=ST.pages.find(x=>x.id===ST.editId);if(p){p[path.slice(5)]=path==='page.title'?clip(v,60):v;rebuild();savePage(p);paintTabs&&paintTabs()}return}
      if(t.dataset.prefix)v=t.dataset.prefix+v;
      setPath(ctxRoot(),path,clip(v,4000));afterEdit();return;
    }
    if(t.dataset&&t.dataset.sdname!==undefined){e.stopImmediatePropagation();const k=t.dataset.sdname,v=clip(t.value,40).trim();if(v)ST.menu.names[k]=v;else delete ST.menu.names[k];rebuild();saveMenu();paintTabs&&paintTabs()}
  },true);
  document.addEventListener('change',e=>{
    const t=e.target;if(!t)return;
    if(t.dataset&&t.dataset.sdtick){
      e.stopImmediatePropagation();if(!isAdm())return;const path=t.dataset.sdtick;
      if(path.startsWith('dash.blocks')){setPath({dash:ST.dash},path,t.checked);saveDash()}
      else{const p=ST.pages.find(x=>x.id===(ST.editId||ST.viewId));if(p){setPath({blocks:p.blocks},path,t.checked);savePage(p)}}
      return render();
    }
    if(!isAdm())return;
    if(t.dataset&&t.dataset.sd){
      e.stopImmediatePropagation();const path=t.dataset.sd;
      if(path==='dash.mode'){ST.dash.mode=t.value==='only'?'only':'add';saveDash();return render()}
      if(path.startsWith('page.')){const p=ST.pages.find(x=>x.id===ST.editId);if(p){p[path.slice(5)]=t.value;rebuild();savePage(p,true);paintTabs&&paintTabs();if(t.tagName==='SELECT')render()}return}
      /* text boxes are already saved by the input handler; re-drawing here would steal focus from the next box */
      if(t.tagName!=='SELECT'&&t.type!=='date'){return}
      setPath(ctxRoot(),path,/\.valCol$/.test(path)?(parseInt(t.value)||1):t.value);afterEdit();render();return;
    }
    if(t.dataset&&t.dataset.sdt){
      e.stopImmediatePropagation();const path=t.dataset.sdt;
      setPath(ctxRoot(),path,t.value==='url:'?'url:https://':t.value);afterEdit();return render();
    }
    if(t.dataset&&t.dataset.sdshow){
      e.stopImmediatePropagation();const [r,k]=t.dataset.sdshow.split(':');const h=ST.menu.hidden[r]=ST.menu.hidden[r]||[];
      const i=h.indexOf(k);if(t.checked&&i>=0)h.splice(i,1);if(!t.checked&&i<0)h.push(k);
      rebuild();saveMenu();render();
    }
  },true);
  document.addEventListener('submit',async e=>{
    if(e.target.id!=='sdNewPage')return;
    e.preventDefault();e.stopImmediatePropagation();if(!isAdm()||ST.busy)return;
    const title=clip($('#sdNpTitle').value,60).trim(),aud=$('#sdNpAud').value==='staff'?'staff':'admin';
    if(!title){ST.err='Give the page a name.';return render()}
    ST.err='';const page={id:uid(),title,icon:'star',audience:aud,position:ST.pages.length,blocks:[]};
    if(LIVE){
      ST.busy=true;const r=await sb().from('custom_pages').insert({title,icon:'star',audience:aud,position:page.position,blocks:[]}).select('id').single();ST.busy=false;
      if(r.error){ST.err=dbMsg(r.error.message);return render()}
      page.id=r.data.id;
    }else savePage(page);
    ST.pages.push(page);if(!LIVE)savePage(page);
    rebuild();ST.editId=page.id;toast('Page created');paintTabs&&paintTabs();render();
  },true);
  document.addEventListener('click',async e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="sd"]');if(!b)return;
    const a=b.dataset.act;
    if(!['sdTab','sdEditPage','sdOpenPage','sdBack','sdMove','sdDelBlock','sdAddBlock','sdAddItem','sdDelItem','sdAddRow','sdAddCol','sdDelCol','sdMovePage','sdDelPage','sdResetMenu'].includes(a))return;
    e.stopImmediatePropagation();if(!isAdm())return;
    const d=b.dataset,root=ctxRoot();
    switch(a){
      case 'sdTab':ST.tab=d.t;ST.editId=null;ST.err='';return render();
      case 'sdEditPage':ST.editId=d.id;state.tab[state.role]='studio';ST.err='';window.scrollTo(0,0);return render();
      case 'sdOpenPage':state.tab[state.role]=pageKey({id:d.id});ST.viewId=d.id;window.scrollTo(0,0);return render();
      case 'sdBack':ST.editId=null;return render();
      case 'sdMove':{const arr=get(root,d.p),i=+d.i,j=i+ +d.d;if(!arr||j<0||j>=arr.length)return;[arr[i],arr[j]]=[arr[j],arr[i]];afterEdit();return render()}
      case 'sdDelBlock':{const arr=get(root,d.p);if(!arr||!confirm('Remove this block?'))return;arr.splice(+d.i,1);afterEdit();return render()}
      case 'sdAddBlock':{const arr=get(root,d.p);if(!arr||arr.length>=60)return;const nb=newBlock(d.t);if(nb.t==='chart'){const T=arr.find(x=>x.t==='table');if(T)nb.src=T.id}arr.push(nb);afterEdit();return render()}
      case 'sdAddItem':{const arr=get(root,d.p);if(!arr||arr.length>=100)return;const isLinks=/\.items$/.test(d.p)&&arr.length&&('label' in arr[0]||false)||(/\.items$/.test(d.p)&&get(root,d.p.replace(/\.items$/,'')).t==='links');
        arr.push(isLinks?{label:'New button',target:'tab:dash'}:{text:'New task',done:false});afterEdit();return render()}
      case 'sdDelItem':{const arr=get(root,d.p);if(!arr)return;arr.splice(+d.i,1);afterEdit();return render()}
      case 'sdAddRow':{const t=get(root,d.p);if(!t||t.rows.length>=200)return;t.rows.push(t.cols.map(()=>''));afterEdit();return render()}
      case 'sdAddCol':{const t=get(root,d.p);if(!t||t.cols.length>=8)return;t.cols.push('Column');t.rows.forEach(r=>r.push(''));afterEdit();return render()}
      case 'sdDelCol':{const t=get(root,d.p);if(!t||t.cols.length<2)return;t.cols.pop();t.rows.forEach(r=>r.pop());afterEdit();return render()}
      case 'sdMovePage':{const i=+d.i,j=i+ +d.d;if(j<0||j>=ST.pages.length)return;[ST.pages[i],ST.pages[j]]=[ST.pages[j],ST.pages[i]];ST.pages.forEach((p,k)=>{if(p.position!==k){p.position=k;savePage(p,true)}});if(!LIVE)savePage(ST.pages[0]);rebuild();paintTabs&&paintTabs();return render()}
      case 'sdDelPage':{const p=ST.pages.find(x=>x.id===d.id);if(!p||!confirm('Delete the page "'+p.title+'"? This cannot be undone.'))return;
        if(LIVE){const r=await sb().from('custom_pages').delete().eq('id',p.id);if(r.error){ST.err=dbMsg(r.error.message);return render()}}
        ST.pages=ST.pages.filter(x=>x.id!==p.id);delete VIEWS[pageKey(p)];if(!LIVE){state.studio.pages=ST.pages.map(x=>JSON.parse(JSON.stringify(x)))}
        rebuild();toast('Page deleted');paintTabs&&paintTabs();return render()}
      case 'sdResetMenu':if(!confirm('Show every page again and remove custom menu names?'))return;ST.menu={hidden:{adm:[],emp:[]},names:{}};rebuild();saveMenu();paintTabs&&paintTabs();return render();
    }
  },true);
  /* remember which custom page is on screen so checklist ticks save to the right page */
  document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-tab]');if(!t)return;if(/^sp_/.test(t.dataset.tab||''))ST.viewId=t.dataset.tab.slice(3);if(t.dataset.tab==='studio'&&t.classList.contains('nv'))ST.editId=null},true);
  setInterval(()=>{const t=state.tab&&state.tab[state.role];if(t&&/^sp_/.test(t))ST.viewId=t.slice(3)},500);
  window.VIRTUOSO_STUDIO={reload:()=>{ST.loaded=false;load()}};
})();
