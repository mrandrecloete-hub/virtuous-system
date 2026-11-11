/* STATIONERY LIST, laid out like the office spreadsheet "VIRTUOSO STATIONERY LIST":
   Items | Open Qty | Added Qty | one QTY TAKEN column per staff member | Qty Left | Stock Alert | Count | Difference,
   a STOCK TO ADD / ORDER table underneath, and a tab per month along the bottom.
   Qty Left = Open + Added - everything taken. LOW STOCK shows when Qty Left is at or below the firm's low-stock level.
   Count is a physical stock-take; Difference = Count - Qty Left. A new month opens with last month's Qty Left.
   Staff columns come from a staff list kept in Setup (add names by hand or from the team); data is keyed by staff id,
   so renaming a person never loses their figures.
   Stored as ONE JSON setting ('stationery_sheet') in app_settings (live: admin-write by RLS, audited, no migration);
   ?demo keeps it in state.stationerySheet. Admins edit; everyone else reads. Replaces the earlier three-column Office
   Essentials page on the Stationery list menu item (office-list.js stays loaded for its background and shared hooks). */
(function(){
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const KEY='stationery_sheet';
  const isAdm=()=>state.user&&state.user.type==='admin';
  const MAXI=200,MAXS=20,MAXO=100,L=60,NL=12;
  const clean=(s,n)=>String(s==null?'':s).replace(/[\u0000-\u001f]/g,' ').slice(0,n||L);
  const cnum=s=>{const t=clean(s,NL).trim().replace(',','.');return t===''||isFinite(+t)?t:''};
  const num=v=>{const x=parseFloat(String(v).replace(',','.'));return isFinite(x)?x:0};
  const has=v=>String(v==null?'':v).trim()!=='';
  const fmt=x=>String(Math.round(x*100)/100);
  const uid=()=>'s'+Math.random().toString(36).slice(2,8);
  const clone=o=>JSON.parse(JSON.stringify(o));
  const ym=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  const mdate=k=>new Date(k+'-01T00:00:00');
  const tab=k=>mdate(k).toLocaleDateString('en-GB',{month:'short',year:'numeric'});
  const long=k=>mdate(k).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  const todayISO=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};

  /* ---------- starting data: the firm's own list (staff names and item names as on the spreadsheet) ---------- */
  const SEED=[['Red Pens',76],['Pencils',5],['Rulers',6],['Highlighters',4],['Board Markers',3],['Staples (box)',2],['Tippex',2],['Rubber Bands (pack)',1],['Pritt',1],['White Label Sheets (pack)',1],['Sticky Notes (pack)',1],['Calculator',1],['File Dividers (pack)',1],['Labels on Roll (pack)',1],['Super Glue (pack)',1],['Sharpeners',4],['Staple Remover',1],['File Binder, Small',2],['File Binder, Long',2],['Printer Ink (box)',1],['Loose Ink: Pink',1],['Loose Ink: Blue',1],['Loose Ink: Yellow',1],['USB Sticks',4]];
  const NAMES=['Bjorn','Barry','Mara','Alex','Ronell','Michaela','Beau'];
  const row=(item,open)=>({item:item||'',open:open==null?'':String(open),added:'',taken:{},count:''});
  const seed=()=>{const o={};o[ym(new Date())]={items:SEED.map(([n,q])=>row(n,q)),orders:[]};
    return {title:'VIRTUOSO STATIONERY LIST '+new Date().getFullYear(),low:2,staff:NAMES.map(n=>({id:uid(),name:n})),months:o}};

  const O={doc:null,month:null,loading:false,status:'',uid:null,t:null,undo:null,setup:false,team:null};
  const keys=()=>Object.keys((O.doc&&O.doc.months)||{}).sort();
  const cur=()=>{const ks=keys();if(!O.month||!ks.includes(O.month))O.month=ks[ks.length-1]||null;return O.month};
  const sheet=()=>{const k=cur();return k?O.doc.months[k]:null};
  const ready=()=>!!O.doc;

  function sanitize(d){
    d=d&&typeof d==='object'?d:{};
    const out={title:clean(d.title,80)||'VIRTUOSO STATIONERY LIST',low:Math.max(0,Math.min(9999,num(d.low==null?2:d.low))),staff:[],months:{}};
    (Array.isArray(d.staff)?d.staff:[]).slice(0,MAXS).forEach(s=>{const n=clean(s&&s.name).trim(),id=clean(s&&s.id,12).replace(/[^a-z0-9]/gi,'');if(n&&id&&!out.staff.some(x=>x.id===id))out.staff.push({id,name:n})});
    const ms=d.months&&typeof d.months==='object'?d.months:{};
    Object.keys(ms).filter(k=>/^\d{4}-(0[1-9]|1[0-2])$/.test(k)).slice(0,60).forEach(k=>{
      const m=ms[k]||{};
      out.months[k]={
        items:(Array.isArray(m.items)?m.items:[]).slice(0,MAXI).map(r=>{r=r||{};const t={};out.staff.forEach(s=>{const v=cnum(r.taken&&r.taken[s.id]);if(v!=='')t[s.id]=v});
          return {item:clean(r.item),open:cnum(r.open),added:cnum(r.added),taken:t,count:cnum(r.count)}}),
        orders:(Array.isArray(m.orders)?m.orders:[]).slice(0,MAXO).map(o=>{o=o||{};return {item:clean(o.item),qty:clean(o.qty,20),by:clean(o.by),date:/^\d{4}-\d{2}-\d{2}$/.test(o.date||'')?o.date:'',done:!!o.done}})
      };
    });
    return out;
  }
  async function load(){
    if(O.doc||O.loading)return;
    if(!LIVE){state.stationerySheet=state.stationerySheet||seed();O.doc=state.stationerySheet;return}
    if(!sb())return;
    O.loading=true;
    const r=await sb().from('app_settings').select('value').eq('key',KEY);
    O.loading=false;
    if(r.error){O.status='Could not load the list.';return repaint()}
    O.doc=r.data&&r.data[0]?sanitize(r.data[0].value):seed();
    if(!keys().length)O.doc.months=seed().months;
    repaint();
  }
  const repaint=()=>{const t=state.tab&&state.tab[state.role];if(t==='stationery'||t==='dash')render()};
  const paintStatus=()=>{const e=$('#ssStatus');if(e)e.textContent=O.status};
  function save(){
    if(!isAdm())return;
    if(!LIVE){state.stationerySheet=O.doc;O.status='Saved (sample mode, kept until you reload).';paintStatus();return}
    O.status='Saving…';paintStatus();clearTimeout(O.t);
    O.t=setTimeout(async()=>{
      const r=await sb().from('app_settings').upsert({key:KEY,value:O.doc});
      O.status=r.error?'Could not save. Check your connection and try again.':'All changes saved.';paintStatus();
    },700);
  }
  setInterval(()=>{const u=state.user?state.user.id:null;if(u!==O.uid){O.uid=u;if(LIVE){O.doc=null;O.month=null;O.status='';O.team=null}}},700);

  /* ---------- sums ---------- */
  const staffIds=()=>O.doc.staff.map(s=>s.id);
  function calc(r){
    const any=has(r.open)||has(r.added)||Object.keys(r.taken).some(k=>has(r.taken[k]));
    const taken=Object.keys(r.taken).filter(k=>staffIds().includes(k)).reduce((s,k)=>s+num(r.taken[k]),0);
    const left=any?num(r.open)+num(r.added)-taken:null;
    const low=left!==null&&has(r.item)&&left<=O.doc.low;
    const diff=has(r.count)&&left!==null?num(r.count)-left:null;
    return {left,low,neg:left!==null&&left<0,diff};
  }
  const alertText=c=>c.neg?'CHECK: below zero':c.low?'LOW STOCK':'';

  /* ---------- page ---------- */
  const css=document.createElement('style');
  css.textContent=`
  .ssw{display:grid;gap:10px}
  .sstool{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  .sstool .grow{flex:1}.sstool #ssStatus{font-size:12.5px;color:var(--muted)}
  .sscard{background:#fff;color:#16254a;border:1px solid #cfd6e4;border-radius:6px;overflow:hidden}
  .sshead{padding:8px 12px 6px}
  .sshead h3{margin:0;font-size:24px;font-weight:800;color:#1c3d72;letter-spacing:.2px}
  .sshead input.sst{font:inherit;font-size:24px;font-weight:800;color:#1c3d72;border:1px solid transparent;background:transparent;width:100%;padding:0 4px;min-height:0;border-radius:3px;box-shadow:none}
  .sshead input.sst:focus{outline:2px solid #1f7a4d;background:#f4fbf7}
  .sshead .mo{font-size:13px;margin-top:2px;color:#16254a}.sshead .mo b{margin-right:6px}
  .ssscroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
  table.sst2{border-collapse:collapse;width:100%;min-width:920px;font-size:13px;color:#16254a}
  .sst2 th{background:#1f3a68;color:#fff;font-weight:700;padding:7px 6px;border:1px solid #fff;text-align:center;white-space:nowrap}
  .sst2 tr.band th{background:transparent;border:0;padding:0}
  .sst2 tr.band th.qt{background:#dbe4f2;color:#1f3a68;font-size:12px;letter-spacing:.4px;padding:3px}
  .sst2 td{border:1px solid #a9b6cd;padding:0;height:24px;text-align:center;background:#fff}
  .sst2 td.it{text-align:left;font-weight:700;padding:3px 6px;white-space:nowrap;position:sticky;left:0;z-index:1;min-width:190px;background:inherit}
  .sst2 tbody tr:nth-child(even) td{background:#eef1f7}
  .sst2 tbody tr.low td{background:#fde0e0}
  .sst2 td.left{font-weight:800;color:#1f3a68;font-size:14px;min-width:70px}
  .sst2 td.al{text-align:left;padding:3px 6px;white-space:nowrap;font-size:12.5px;color:#222;min-width:110px}
  .sst2 td.al .f{color:#d32f2f;margin-right:4px}
  .sst2 td.cnt{background:#fff6d6!important}
  .sst2 td.df{min-width:80px;font-weight:700}.sst2 td.df.neg{color:#c62828}
  .sst2 input{width:100%;min-width:56px;border:0;background:transparent;color:inherit;font:inherit;text-align:center;padding:3px 4px;min-height:24px;border-radius:0;box-shadow:none}
  .sst2 td.it input{text-align:left;font-weight:700;min-width:170px}
  .sst2 input:focus{outline:2px solid #1f7a4d;outline-offset:-2px;background:#f4fbf7}
  .sst2 .x{border:0;background:transparent;color:#b33;cursor:pointer;padding:0 6px;min-height:24px;font-size:15px}
  .sst2 th.xh,.sst2 td.xc{width:26px;min-width:26px;padding:0}
  .ssadd{display:block;width:100%;border:0;border-top:1px dashed #b9c3d6;background:#f7f9fd;color:#1f5fbf;padding:8px;font:inherit;font-size:13px;cursor:pointer;min-height:38px}
  .ssadd:hover{background:#eaf1ff}
  .ssord{padding:10px 12px 0}
  .ssord h4{margin:0 0 6px;font-size:13px;color:#1f3a68;letter-spacing:.3px}
  table.sso{border-collapse:collapse;width:100%;max-width:720px;font-size:13px;color:#16254a;margin-bottom:8px}
  .sso th{background:#1f3a68;color:#fff;padding:6px;border:1px solid #fff}
  .sso td{border:1px solid #a9b6cd;padding:0;background:#fffbea;height:26px;text-align:center}
  .sso input[type=checkbox]{width:18px;min-width:0;height:18px;min-height:0}
  .sso tr.done td{background:#e5f4e8;color:#556;text-decoration:line-through}
  .sso td input[type=text],.sso td input[type=date]{width:100%;border:0;background:transparent;color:inherit;font:inherit;padding:3px 6px;min-height:26px;border-radius:0;box-shadow:none;text-align:left}
  .sso td input:focus{outline:2px solid #1f7a4d;outline-offset:-2px}
  .sso td.xc{width:28px;background:#fff}
  .sso .x{border:0;background:transparent;color:#b33;cursor:pointer;min-height:26px}
  .sstabs{display:flex;gap:2px;align-items:flex-end;background:#e9ecf1;border:1px solid #cfd4de;padding:4px 8px 0;border-radius:0 0 8px 8px;overflow-x:auto;-webkit-overflow-scrolling:touch}
  .sstabs button{border:0;background:transparent;color:#333;padding:8px 16px;font:inherit;font-size:14px;cursor:pointer;min-height:38px;white-space:nowrap;border-radius:6px 6px 0 0}
  .sstabs button:hover{background:#f6f7fa}
  .sstabs button[aria-selected=true]{background:#fff;color:#1f7a4d;font-weight:700;box-shadow:0 -2px 0 #1f7a4d inset}
  .sstabs .plus{font-size:20px;line-height:1;padding:6px 14px}
  .sset{padding:12px;display:grid;gap:10px}
  .sset .chips{display:flex;flex-wrap:wrap;gap:6px}
  .sset .chip{display:inline-flex;align-items:center;gap:2px;border:1px solid var(--line);border-radius:999px;background:var(--surface);padding:0 4px 0 10px}
  .sset .chip input{border:0;background:transparent;width:9ch;min-height:30px;padding:0;font:inherit;color:var(--fg)}
  .sset .chip button{border:0;background:transparent;color:#b33;cursor:pointer;min-height:30px;padding:0 6px}
  .sset .line{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  @media print{.sstool,.sstabs,.sset,.ssadd,.sst2 .x,.sst2 .xh,.sst2 .xc{display:none!important}}
  `;
  document.head.appendChild(css);

  const num_in=(r,i,f,adm)=>adm?`<input inputmode="decimal" data-ss="${f}" data-i="${i}" value="${esc(r[f])}" maxlength="${NL}" aria-label="${esc(f)}: ${esc(r.item)}">`:esc(r[f]);
  function rowHTML(r,i,adm){
    const c=calc(r);
    return `<tr class="${c.low||c.neg?'low':''}" data-r="${i}">
      <td class="it">${adm?`<input data-ss="item" data-i="${i}" value="${esc(r.item)}" maxlength="${L}" aria-label="Item ${i+1}">`:esc(r.item)}</td>
      <td>${num_in(r,i,'open',adm)}</td><td>${num_in(r,i,'added',adm)}</td>
      ${O.doc.staff.map(s=>`<td>${adm?`<input inputmode="decimal" data-ss="taken" data-id="${s.id}" data-i="${i}" value="${esc(r.taken[s.id]||'')}" maxlength="${NL}" aria-label="${esc(s.name)} took: ${esc(r.item)}">`:esc(r.taken[s.id]||'')}</td>`).join('')}
      <td class="left" data-c="left">${c.left===null?'':fmt(c.left)}</td>
      <td class="al" data-c="al">${c.low||c.neg?`<span class="f">&#9873;</span>${alertText(c)}`:''}</td>
      <td class="cnt">${num_in(r,i,'count',adm)}</td>
      <td class="df ${c.diff!==null&&c.diff<0?'neg':''}" data-c="df">${c.diff===null?'':fmt(c.diff)}</td>
      ${adm?`<td class="xc"><button type="button" class="x" data-act="ssDel" data-i="${i}" aria-label="Remove ${esc(r.item||'row')}" title="Remove">×</button></td>`:''}</tr>`;
  }
  function ordersHTML(m,adm){
    const hasAny=m.orders.length||adm;if(!hasAny)return '';
    return `<div class="ssord"><h4>STOCK TO ADD / ORDER</h4>
      <table class="sso"><thead><tr><th>Item</th><th style="width:90px">Qty to add</th><th style="width:150px">Requested by</th><th style="width:150px">Date</th><th style="width:60px">Done?</th>${adm?'<th class="xc"></th>':''}</tr></thead><tbody>
      ${m.orders.map((o,i)=>`<tr class="${o.done?'done':''}"><td>${adm?`<input type="text" data-so="item" data-i="${i}" value="${esc(o.item)}" maxlength="${L}" aria-label="Order item ${i+1}">`:esc(o.item)}</td>
        <td>${adm?`<input type="text" data-so="qty" data-i="${i}" value="${esc(o.qty)}" maxlength="20" aria-label="Qty to add">`:esc(o.qty)}</td>
        <td>${adm?`<input type="text" list="ssStaffList" data-so="by" data-i="${i}" value="${esc(o.by)}" maxlength="${L}" aria-label="Requested by">`:esc(o.by)}</td>
        <td>${adm?`<input type="date" data-so="date" data-i="${i}" value="${esc(o.date)}" aria-label="Date">`:esc(o.date)}</td>
        <td><input type="checkbox" data-so="done" data-i="${i}" ${o.done?'checked':''} ${adm?'':'disabled'} aria-label="Done"></td>
        ${adm?`<td class="xc"><button type="button" class="x" data-act="ssDelOrder" data-i="${i}" aria-label="Remove order line" title="Remove">×</button></td>`:''}</tr>`).join('')||`<tr><td colspan="5" style="text-align:left;padding:6px;background:#fff;color:#667">Nothing to order.</td></tr>`}
      </tbody></table>
      <datalist id="ssStaffList">${O.doc.staff.map(s=>`<option value="${esc(s.name)}">`).join('')}</datalist>
      ${adm?`<div class="sstool" style="margin:0 0 10px"><button class="btn sm ghost" type="button" data-act="ssAddOrder">+ Add an order line</button><button class="btn sm ghost" type="button" data-act="ssOrderLow">Add all LOW STOCK items</button></div>`:''}</div>`;
  }
  function setupHTML(){
    const names=O.team&&O.team.filter(n=>!O.doc.staff.some(s=>s.name.toLowerCase()===n.toLowerCase()));
    return `<div class="panel sset"><h3 style="margin:0">Setup</h3>
      <div><b>Staff columns</b> <span class="note">These are the QTY TAKEN columns. Rename a person by editing the name, remove with ×. Removing a person deletes their figures for every month.</span>
        <div class="chips" style="margin-top:6px">${O.doc.staff.map(s=>`<span class="chip"><input data-ss="staffname" data-id="${s.id}" value="${esc(s.name)}" maxlength="${L}" aria-label="Staff name"><button type="button" data-act="ssDelStaff" data-id="${s.id}" aria-label="Remove ${esc(s.name)}">×</button></span>`).join('')||'<span class="note">No staff yet.</span>'}</div></div>
      <div class="line"><input id="ssNewStaff" placeholder="Add a name" maxlength="${L}" style="max-width:200px" aria-label="New staff name"><button class="btn sm" type="button" data-act="ssAddStaff">Add</button>
        ${names&&names.length?`<select id="ssTeamPick" aria-label="Add from the team"><option value="">Add from the team…</option>${names.map(n=>`<option>${esc(n)}</option>`).join('')}</select><button class="btn sm ghost" type="button" data-act="ssAddTeam">Add</button>`:`<button class="btn sm ghost" type="button" data-act="ssLoadTeam">${O.team?'Everyone in the team is already a column':'Choose from the team'}</button>`}</div>
      <div class="line"><label for="ssLow"><b>LOW STOCK when Qty Left is</b></label><input id="ssLow" data-ss="low" inputmode="numeric" value="${esc(O.doc.low)}" maxlength="4" style="max-width:80px"><span class="note">or fewer</span></div></div>`;
  }
  function vSheet(){
    const adm=isAdm();
    if(!ready())load();
    if(!ready())return `<h2>Stationery list</h2><div class="panel"><p class="note">${esc(O.status||'Loading the list…')}</p></div>`;
    const m=sheet(),ks=keys(),sc=O.doc.staff.length;
    return `<div class="ssw"><div class="sstool"><h2 style="margin:0">Stationery list</h2><span class="grow"></span><span id="ssStatus" role="status">${esc(O.status)}</span>
      ${O.undo?'<button class="btn sm" type="button" data-act="ssUndo">Undo</button>':''}${adm?`<button class="btn sm ghost" type="button" data-act="ssSetup">${O.setup?'Close setup':'Setup'}</button><button class="btn sm ghost" type="button" data-act="ssDelMonth">Delete this month</button>`:''}<button class="btn sm ghost" type="button" data-act="ssCsv">Download CSV</button><button class="btn sm ghost" type="button" data-act="ssPrint">Print</button></div>
      <p class="sub" style="margin:0">${adm?'Type the quantities each person took in their column. Qty Left, LOW STOCK and Difference work themselves. Changes save by themselves. Use Setup for the staff names.':'This is the office stationery stock for the month. An administrator keeps it up to date.'}</p>
      ${adm&&O.setup?setupHTML():''}
      <div><div class="sscard"><div class="sshead">${adm?`<input class="sst" data-ss="title" value="${esc(O.doc.title)}" maxlength="80" aria-label="List title">`:`<h3>${esc(O.doc.title)}</h3>`}<div class="mo"><b>Month showing</b> ${esc(long(cur()))}</div></div>
        <div class="ssscroll"><table class="sst2"><thead><tr class="band"><th colspan="3"></th>${sc?`<th class="qt" colspan="${sc}">QTY TAKEN</th>`:''}<th colspan="${adm?5:4}"></th></tr>
          <tr><th style="text-align:left;min-width:190px;position:sticky;left:0;z-index:2">Items</th><th>Open Qty</th><th>Added Qty</th>${O.doc.staff.map(s=>`<th>${esc(s.name)}</th>`).join('')}<th>Qty Left</th><th>Stock Alert</th><th>Count</th><th>Difference</th>${adm?'<th class="xh"></th>':''}</tr></thead>
          <tbody>${m.items.map((r,i)=>rowHTML(r,i,adm)).join('')}</tbody></table></div>
        ${adm?(m.items.length<MAXI?'<button type="button" class="ssadd" data-act="ssAdd">+ Add an item</button>':''):''}
        ${ordersHTML(m,adm)}</div>
        <div class="sstabs" role="tablist" aria-label="Months">${ks.map(k=>`<button type="button" role="tab" data-act="ssTab" data-k="${k}" aria-selected="${k===cur()}">${esc(tab(k))}</button>`).join('')}${adm?'<button type="button" class="plus" data-act="ssMonth" aria-label="Add next month" title="Add next month (opens with this month\'s Qty Left)">+</button>':''}</div></div></div>`;
  }
  VIEWS.stationery=vSheet;

  /* ---------- outputs ---------- */
  function table(){
    const m=sheet(),h=['Items','Open Qty','Added Qty'].concat(O.doc.staff.map(s=>s.name),['Qty Left','Stock Alert','Count','Difference']);
    const rows=m.items.filter(r=>has(r.item)||has(r.open)).map(r=>{const c=calc(r);return [r.item,r.open,r.added].concat(O.doc.staff.map(s=>r.taken[s.id]||''),[c.left===null?'':fmt(c.left),alertText(c),r.count,c.diff===null?'':fmt(c.diff)])});
    return {h,rows};
  }
  function csv(){const q=v=>'"'+String(v).replace(/"/g,'""')+'"';const t=table(),m=sheet();
    const lines=[[O.doc.title],['Month',long(cur())],[],t.h].concat(t.rows);
    if(m.orders.length){lines.push([],['STOCK TO ADD / ORDER'],['Item','Qty to add','Requested by','Date','Done?']);m.orders.forEach(o=>lines.push([o.item,o.qty,o.by,o.date,o.done?'Yes':'No']))}
    return lines.map(r=>r.map(q).join(',')).join('\r\n')}
  function printHTML(){
    const t=table(),m=sheet();
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(O.doc.title)} ${esc(tab(cur()))}</title><style>body{font-family:Arial,sans-serif;margin:16px;color:#16254a}h1{font-size:20px;margin:0;color:#1c3d72}p{margin:2px 0 10px;font-size:12px}table{border-collapse:collapse;width:100%;font-size:10.5px;margin-bottom:12px}th{background:#1f3a68;color:#fff;padding:4px;border:1px solid #fff}td{border:1px solid #888;padding:2px 5px;text-align:center}td:first-child{text-align:left;font-weight:bold}tr.low td{background:#fde0e0}h4{margin:8px 0 4px;font-size:12px}@media print{@page{size:landscape;margin:10mm}th,tr.low td{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h1>${esc(O.doc.title)}</h1><p><b>Month showing</b> ${esc(long(cur()))}</p>
      <table><thead><tr>${t.h.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r=>`<tr class="${r[t.h.length-3]?'low':''}">${r.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      ${m.orders.length?`<h4>STOCK TO ADD / ORDER</h4><table style="max-width:600px"><thead><tr><th>Item</th><th>Qty to add</th><th>Requested by</th><th>Date</th><th>Done?</th></tr></thead><tbody>${m.orders.map(o=>`<tr><td>${esc(o.item)}</td><td>${esc(o.qty)}</td><td>${esc(o.by)}</td><td>${esc(o.date)}</td><td>${o.done?'Yes':''}</td></tr>`).join('')}</tbody></table>`:''}</body></html>`;
  }
  /* shared with the dashboard and the assistant (replaces the hooks of the earlier Office Essentials page) */
  function toBuy(){
    const m=ready()&&sheet();if(!m)return [];
    const out=m.orders.filter(o=>!o.done&&has(o.item)).map(o=>`${o.item}: ${o.qty||'order'}`);
    const named=new Set(m.orders.filter(o=>!o.done).map(o=>o.item.trim().toLowerCase()));
    m.items.forEach(r=>{const c=calc(r);if(c.low&&!named.has(r.item.trim().toLowerCase()))out.push(`${r.item}: low stock (${fmt(c.left)} left)`)});
    return out;
  }
  const API={load:async()=>{await load();return ready()},toBuy,buyCount:()=>{if(!ready()){load();return null}return toBuy().length},monthLabel:()=>ready()&&cur()?tab(cur()):''};
  window.VIRTUOSO_OFFICE=Object.assign(window.VIRTUOSO_OFFICE||{},API);

  /* ---------- team names (admins only: profiles are readable by admins) ---------- */
  async function loadTeam(){
    let names=[];
    if(!LIVE)names=state.users.filter(u=>u.access!==false).map(u=>u.name);
    else if(sb()){const r=await sb().from('profiles').select('name,access_enabled').order('name');names=(r.data||[]).filter(p=>p.access_enabled!==false).map(p=>p.name)}
    O.team=names.map(n=>clean(String(n||'').trim().split(/\s+/)[0])).filter(Boolean).filter((n,i,a)=>a.indexOf(n)===i);
    render();
  }

  /* ---------- events ---------- */
  function paintRow(i){
    const m=sheet(),r=m.items[i],tr=document.querySelector('tr[data-r="'+i+'"]');if(!r||!tr)return;const c=calc(r);
    tr.classList.toggle('low',c.low||c.neg);
    tr.querySelector('[data-c=left]').textContent=c.left===null?'':fmt(c.left);
    tr.querySelector('[data-c=al]').innerHTML=c.low||c.neg?`<span class="f">&#9873;</span>${alertText(c)}`:'';
    const d=tr.querySelector('[data-c=df]');d.textContent=c.diff===null?'':fmt(c.diff);d.classList.toggle('neg',c.diff!==null&&c.diff<0);
  }
  const onEdit=e=>{
    const t=e.target;if(!t||!t.dataset||!isAdm()||!ready())return;
    const ss=t.dataset.ss,so=t.dataset.so;if(!ss&&!so)return;
    e.stopImmediatePropagation();O.undo=null;
    if(ss==='title'){O.doc.title=clean(t.value,80);save();return}
    if(ss==='low'){O.doc.low=Math.max(0,Math.min(9999,num(t.value)));save();O.doc.months&&sheet()&&sheet().items.forEach((_,i)=>paintRow(i));return}
    if(ss==='staffname'){const s=O.doc.staff.find(x=>x.id===t.dataset.id);if(s){s.name=clean(t.value);save();
      const idx=O.doc.staff.indexOf(s);const th=document.querySelectorAll('table.sst2 thead tr:nth-child(2) th')[3+idx];if(th)th.textContent=s.name||'(name)'}return}
    const m=sheet();
    if(so){const o=m.orders[+t.dataset.i];if(!o)return;
      if(so==='done'){if(e.type==='change'){o.done=t.checked;save();render()}return}
      o[so]=so==='date'?(/^\d{4}-\d{2}-\d{2}$/.test(t.value)?t.value:''):clean(t.value,so==='qty'?20:L);save();return}
    const r=m.items[+t.dataset.i];if(!r)return;
    if(ss==='item')r.item=clean(t.value);
    else if(ss==='taken'){const v=cnum(t.value);if(v==='')delete r.taken[t.dataset.id];else r.taken[t.dataset.id]=v}
    else if(['open','added','count'].includes(ss))r[ss]=cnum(t.value);
    paintRow(+t.dataset.i);save();
  };
  document.addEventListener('input',onEdit,true);
  document.addEventListener('change',onEdit,true);
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="ss"]');if(!b)return;
    const a=b.dataset.act;if(!['ssTab','ssAdd','ssDel','ssMonth','ssCsv','ssPrint','ssDelMonth','ssUndo','ssSetup','ssAddStaff','ssAddTeam','ssLoadTeam','ssDelStaff','ssAddOrder','ssDelOrder','ssOrderLow'].includes(a))return;
    e.stopImmediatePropagation();
    if(a==='ssTab'){O.month=b.dataset.k;return render()}
    if(!ready())return;
    if(a==='ssCsv'){const url=URL.createObjectURL(new Blob([csv()],{type:'text/csv'}));const x=document.createElement('a');x.href=url;x.download='stationery-list-'+cur()+'.csv';document.body.appendChild(x);x.click();x.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return}
    if(a==='ssPrint'){const w=window.open('','_blank');if(!w){toast('Allow pop-ups to print');return}w.document.write(printHTML());w.document.close();w.focus();setTimeout(()=>w.print(),300);return}
    if(!isAdm())return;
    const snap=()=>{O.undo=JSON.stringify({doc:O.doc,month:O.month})};
    if(a==='ssUndo'){if(!O.undo)return;const u=JSON.parse(O.undo);O.doc=sanitize(u.doc);O.month=u.month;O.undo=null;save();return render()}
    if(a==='ssSetup'){O.setup=!O.setup;return render()}
    if(a==='ssLoadTeam'){loadTeam();return}
    const m=sheet();
    if(a==='ssAdd'){if(m.items.length>=MAXI)return;m.items.push(row(''));save();render();
      setTimeout(()=>{const l=document.querySelectorAll('[data-ss=item]');if(l.length)l[l.length-1].focus()},30);return}
    if(a==='ssDel'){const i=+b.dataset.i,r=m.items[i];if(!r)return;
      if((r.item||r.open)&&!confirm('Remove "'+(r.item||'this row')+'" from this month?'))return;snap();m.items.splice(i,1);save();return render()}
    if(a==='ssAddOrder'){if(m.orders.length>=MAXO)return;m.orders.push({item:'',qty:'',by:'',date:todayISO(),done:false});save();render();
      setTimeout(()=>{const l=document.querySelectorAll('[data-so=item]');if(l.length)l[l.length-1].focus()},30);return}
    if(a==='ssDelOrder'){snap();m.orders.splice(+b.dataset.i,1);save();return render()}
    if(a==='ssOrderLow'){const named=new Set(m.orders.filter(o=>!o.done).map(o=>o.item.trim().toLowerCase()));let n=0;
      m.items.forEach(r=>{const c=calc(r);if(c.low&&!named.has(r.item.trim().toLowerCase())&&m.orders.length<MAXO){m.orders.push({item:r.item,qty:'',by:'',date:todayISO(),done:false});n++}});
      if(!n)toast('No new LOW STOCK items to add.');else save();return render()}
    if(a==='ssAddStaff'||a==='ssAddTeam'){
      const el=a==='ssAddStaff'?$('#ssNewStaff'):$('#ssTeamPick'),n=clean(el&&el.value).trim();if(!n)return;
      if(O.doc.staff.length>=MAXS){toast('At most '+MAXS+' staff columns.');return}
      if(O.doc.staff.some(s=>s.name.toLowerCase()===n.toLowerCase())){toast(n+' is already a column.');return}
      snap();O.doc.staff.push({id:uid(),name:n});save();return render()}
    if(a==='ssDelStaff'){const s=O.doc.staff.find(x=>x.id===b.dataset.id);if(!s)return;
      if(!confirm('Remove '+s.name+' and all their quantities taken, in every month? You can press Undo straight afterwards.'))return;
      snap();O.doc.staff=O.doc.staff.filter(x=>x!==s);Object.values(O.doc.months).forEach(mm=>mm.items.forEach(r=>{delete r.taken[s.id]}));save();return render()}
    if(a==='ssDelMonth'){if(keys().length<2){toast('Keep at least one month.');return}
      if(!confirm('Delete the whole '+long(cur())+' sheet? You can press Undo straight afterwards.'))return;snap();delete O.doc.months[cur()];O.month=null;save();return render()}
    if(a==='ssMonth'){
      const last=keys().slice(-1)[0],d=mdate(last);d.setMonth(d.getMonth()+1);const nk=ym(d);
      if(O.doc.months[nk]){O.month=nk;return render()}
      if(!confirm('Add '+long(nk)+'? Each item opens with '+tab(last)+"'s Qty Left; quantities taken start empty."))return;
      const prev=O.doc.months[last];
      O.doc.months[nk]={items:prev.items.map(r=>{const c=calc(r);return row(r.item,c.left===null?'':fmt(c.left))}),orders:prev.orders.filter(o=>!o.done).map(o=>({...o}))};
      O.month=nk;save();return render();
    }
  },true);
})();
