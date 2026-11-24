/* PETTY CASH FLOAT AND BALANCE SHEET (admin, top of the Petty cash page).
   Barry's fill-ups (and an opening balance) are recorded here. They are the starting and running balance:
     balance = fill-ups  -  cash taken  +  change returned
   Every movement is listed in date order with a running balance. Above it, a balance sheet shows the cash that should be in the box now,
   where the cash taken went (spent, change returned, short/over, still out) and a check that the figures agree.
   Choose All time or one month (a month starts from the balance brought forward). CSV and Print.
   Stored in `petty_fills` (migration 0036, admin only, audited) or `state.pettyFills` (?demo).
   Cash taken / returned come from the existing Petty cash records (nothing is entered twice). Action prefix `pl`. */
(function(){
  'use strict';
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const isAdm=()=>state.user&&state.user.type==='admin';
  const pad=n=>String(n).padStart(2,'0');
  const isoD=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const todayISO=()=>(!LIVE&&state.today)||isoD(new Date());
  const r2=n=>Math.round((+n||0)*100)/100;
  const money=n=>{n=r2(n);return (n<0?'-':'')+'N$ '+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})};
  const num=n=>r2(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monLabel=k=>{const [y,m]=k.split('-');return MN[+m-1]+' '+y};
  const dLabel=s=>{const d=new Date(String(s).slice(0,10)+'T00:00:00');return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})};
  const clip=(s,n)=>String(s==null?'':s).replace(/[\u0000-\u001f]/g,' ').slice(0,n);
  const F={fills:null,counts:[],cErr:'',adv:null,err:'',loading:false,at:0,month:'all',msg:'',busy:false,uid:null,people:{}};

  setInterval(()=>{const u=state.user?state.user.id:null;if(u!==F.uid){F.uid=u;F.fills=null;F.adv=null;F.err='';F.at=0;F.msg=''}},700);

  /* ---------- data ---------- */
  const normAdv=a=>({id:a.id,uid:a.user_id||a.uid,date:String(a.taken_on||a.date).slice(0,10),
    at:new Date(a.taken_at||a.at||((a.taken_on||a.date)+'T00:00:00')),amount:r2(a.amount),purpose:a.purpose||'',status:a.status,
    spent:a.spent==null?null:r2(a.spent),returned:a.returned==null?null:r2(a.returned),expected:a.expected==null?null:r2(a.expected),diff:a.diff==null?null:r2(a.diff),
    settledAt:a.settled_at||a.settledAt?new Date(a.settled_at||a.settledAt):null});
  async function load(){
    if(F.loading)return;
    if(!LIVE){
      state.pettyFills=state.pettyFills||[];
      state.pettyCounts=state.pettyCounts||[];F.counts=state.pettyCounts.map(x=>Object.assign({},x));F.fills=state.pettyFills.map(x=>Object.assign({},x));F.adv=(state.advances||[]).map(normAdv);
      (state.users||[]).forEach(u=>{F.people[u.id]=u.name});F.at=Date.now();return;
    }
    if(!sb())return;
    F.loading=true;
    const [f,a,p,c]=await Promise.all([sb().from('petty_fills').select('*').order('filled_on').order('created_at'),
      sb().from('cash_advances').select('*').order('taken_at').limit(2000),sb().from('profiles').select('id,name'),sb().from('petty_counts').select('*').order('counted_on').order('created_at')]);
    F.cErr=c.error?(/petty_counts|schema cache|relation/i.test(c.error.message||'')?'Recording the cash in the drawer needs database migration 0037. Run it in the Supabase SQL editor, then reload.':'Could not load the drawer counts: '+c.error.message):'';
    F.counts=c.error?[]:c.data.map(x=>({id:x.id,date:String(x.counted_on).slice(0,10),amount:r2(x.amount),by:x.counted_by||'',note:x.note||''}));
    F.loading=false;F.at=Date.now();
    if(f.error)F.err=/petty_fills|schema cache|relation/i.test(f.error.message||'')?'The float needs database migration 0036. Run it in the Supabase SQL editor, then reload.':'Could not load the float: '+f.error.message;
    else F.err='';
    F.fills=f.error?[]:f.data.map(x=>({id:x.id,date:String(x.filled_on).slice(0,10),amount:r2(x.amount),by:x.filled_by||'',kind:x.kind,note:x.note||''}));
    F.adv=(a.data||[]).map(normAdv);(p.data||[]).forEach(u=>{F.people[u.id]=u.name});
    if(state.tab&&state.tab[state.role]==='cash')render();
  }

  /* ---------- the calculation ---------- */
  function ledger(){
    const ev=[];
    (F.fills||[]).forEach(x=>ev.push({t:new Date(x.date+'T00:00:00'),k:'fill',id:x.id,fk:x.kind,who:x.by||'Barry',text:x.note||'',date:x.date,desc:(x.kind==='open'?'Opening balance':'Fill-up')+(x.by?' by '+x.by:'')+(x.note?' – '+x.note:''),inn:x.amount,out:0}));
    (F.adv||[]).forEach(a=>{
      const who=F.people[a.uid]||'Employee';
      ev.push({t:a.at,k:'take',who:who,text:a.purpose||'',date:isoD(a.at),desc:'Cash taken – '+who+(a.purpose?' – '+a.purpose:''),inn:0,out:a.amount});
      if(a.status!=='Open'&&a.returned>0)ev.push({t:a.settledAt||new Date(a.at.getTime()+1),k:'ret',who:who,text:a.purpose||'',date:isoD(a.settledAt||a.at),desc:'Change returned – '+who+(a.purpose?' – '+a.purpose:''),inn:a.returned,out:0});
    });
    ev.sort((x,y)=>x.t-y.t||(x.k==='fill'?-1:1));
    let bal=0;ev.forEach(e=>{bal=r2(bal+e.inn-e.out);e.bal=bal});
    return ev;
  }
  function sheet(ev,month){
    const inP=e=>month==='all'||e.date.slice(0,7)===month;
    const before=month==='all'?0:(ev.filter(e=>e.date.slice(0,7)<month).slice(-1)[0]||{bal:0}).bal;
    const rows=ev.filter(inP);
    const sum=(k,f)=>r2(rows.filter(e=>e.k===k).reduce((s,e)=>s+e[f],0));
    const fills=sum('fill','inn'),taken=sum('take','out'),ret=sum('ret','inn');
    const closing=r2(before+fills-taken+ret);
    const last=rows.length?rows[rows.length-1].bal:before;
    const adv=(F.adv||[]).filter(a=>month==='all'||isoD(a.at).slice(0,7)===month);
    const set=adv.filter(a=>a.status!=='Open'),open=adv.filter(a=>a.status==='Open');
    const spent=r2(set.reduce((s,a)=>s+(a.spent||0),0)),returned=r2(set.reduce((s,a)=>s+(a.returned||0),0)),diff=r2(set.reduce((s,a)=>s+(a.diff||0),0));
    const out=r2(open.reduce((s,a)=>s+a.amount,0)),takenSet=r2(set.reduce((s,a)=>s+a.amount,0));
    return {rows,before,fills,taken,ret,closing,last,spent,returned,diff,out,takenSet,takenAll:r2(adv.reduce((s,a)=>s+a.amount,0)),nOpen:open.length,
      ok:Math.abs(closing-last)<0.005&&Math.abs(takenSet-(spent+returned-diff))<0.005};
  }

  /* cash counted in the drawer, compared with what the ledger says should be there on that date */
  function countCalc(c){
    const ev=ledger(),d=c.date,at=ev.filter(e=>e.date<=d).slice(-1)[0],exp=at?at.bal:0,counted=r2(c.amount),over=r2(counted-exp);
    const fillsTo=r2((F.fills||[]).filter(x=>x.date<=d).reduce((t,x)=>t+x.amount,0));
    const tk=(F.adv||[]).filter(a=>isoD(a.at)<=d),by=a=>a.status!=='Open'&&isoD(a.settledAt||a.at)<=d;
    const set=tk.filter(by),open=tk.filter(a=>!by(a));
    const spent=r2(set.reduce((t,a)=>t+(a.spent||0),0)),diff=r2(set.reduce((t,a)=>t+(a.diff||0),0)),out=r2(open.reduce((t,a)=>t+a.amount,0));
    const total=r2(out-diff-over),direct=r2(fillsTo-counted-spent);
    return {exp,counted,over,out,shortSet:r2(-diff),shortDrawer:r2(-over),total,direct,nOpen:open.length,ok:Math.abs(total-direct)<0.005};
  }

  /* ---------- page ---------- */
  const css=document.createElement('style');
  css.textContent=`.plw{display:grid;gap:12px;margin-bottom:16px}
  .plw .plgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
  .plw .plk{background:#f4f8ff;border:1px solid #dfe8fb;border-radius:14px;padding:10px 12px}.plw .plk b{display:block;font-size:19px;color:#1646c0}.plw .plk span{font-size:12.5px;color:#33406b}
  .plw .plk.big b{font-size:24px}.plw .plk.neg b{color:#b3261e}
  .plw form.plf{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;align-items:end}
  .plw table.plt{width:100%;border-collapse:collapse;font-size:13.5px}.plw .plt td,.plw .plt th{padding:7px 10px;border-bottom:1px solid #e3e9f6;text-align:left}
  .plw .plt th{background:#0a2a7a;color:#fff;white-space:nowrap}.plw .plt .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .plw .plt tr.sub td{font-weight:700;background:#eef3ff}.plw .plt tr.tot td{font-weight:800;background:#dfe9ff;border-top:2px solid #0a2a7a}
  .plw .plt tr.bf td{font-style:italic;background:#f7f9ff}.plw .plt .neg{color:#b3261e}.plw .okp{color:#16905a;font-weight:700}.plw .badp{color:#b3261e;font-weight:700}
  .plw .plscroll{overflow-x:auto}
  .plw .plcard{background:#fff;border:1px solid #dfe8fb;border-radius:14px;padding:12px 14px;box-shadow:0 4px 14px rgba(15,40,110,.06)}
  .plw .plseg{display:inline-flex;gap:4px;background:#eef3ff;border-radius:999px;padding:3px;flex-wrap:wrap}
  .plw .plseg button{border:0;background:transparent;color:#0a2a7a;font:inherit;font-weight:700;font-size:13.5px;padding:7px 14px;border-radius:999px;cursor:pointer;min-height:34px}
  .plw .plseg button[aria-selected=true]{background:#0a2a7a;color:#fff}
  .plw .plbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}.plw .plbar .grow{flex:1}
  .plw .plcard .banner{margin:0 0 8px}
  .plw .plbar label{display:flex!important;flex-direction:row!important;align-items:center;gap:6px;margin:0}
  @media print{.plw .plf,.plw .plbar,[data-act^=pl]{display:none!important}}`;
  document.head.appendChild(css);


  /* Preview of the statement as shown (balance sheet, ledger or drawer counts) before anything is printed */
  function previewView(){
    const cards=document.querySelectorAll('#plPanel .plcard'),card=cards[cards.length-1];if(!card)return toast('Nothing to print yet.');
    const c=card.cloneNode(true);c.querySelectorAll('.plbar,button,form').forEach(x=>x.remove());
    const v=F.view==='ledger'?'Ledger':F.view==='counts'?'Drawer counts':'Balance sheet',per=F.view==='counts'?'':(F.month==='all'?'all time':monLabel(F.month));
    const title='Petty cash – '+v+(per?' – '+per:'');
    const html='<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>'+css.textContent+'@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;font:12px Arial,Helvetica,sans-serif;color:#16254a;background:#fff;padding:0}h1{font-size:17px;margin:0 0 2px}p.s{margin:0 0 10px;color:#5a6685;font-size:11px}.plt{width:100%;border-collapse:collapse}.plt th{background:#0a2a7a!important;color:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}tr{break-inside:avoid}.plcard{border:0;box-shadow:none;padding:0}</style></head><body><h1>'+esc(title)+'</h1><p class="s">Printed '+esc(new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}))+'</p>'+c.outerHTML+'</body></html>';
    if(window.VIRTUOSO_DOCS&&VIRTUOSO_DOCS.overlay)return VIRTUOSO_DOCS.overlay(html,{title:title,name:title.replace(/[^A-Za-z0-9]+/g,'-')});
    toast('The print preview is not available.');
  }
  /* ---------- the printable Petty Cash Register (same layout as the firm's paper sheet) ---------- */
  const SHEET_KEY='vx_pcsheet';
  const sheetPrefs=()=>{try{return JSON.parse(localStorage.getItem(SHEET_KEY)||'{}')||{}}catch(e){return {}}};
  const saveSheetPrefs=o=>{try{localStorage.setItem(SHEET_KEY,JSON.stringify(o))}catch(e){}};
  const fm2=n=>r2(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const dDot=d=>d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(0,4);
  function registerRows(month){
    const ev=ledger(),start=month+'-01';
    const before=(ev.filter(e=>e.date<start).slice(-1)[0]||{bal:0}).bal;
    const inM=ev.filter(e=>e.date.slice(0,7)===month);
    let opening=before;const rows=[];
    inM.forEach(e=>{if(e.k==='fill'&&e.fk==='open'&&rows.length===0)opening=r2(opening+e.inn);else rows.push(e)});
    let bal=opening;const out=rows.map(e=>{
      if(e.k==='take'){bal=r2(bal-e.out);return {date:e.date,payee:e.who,desc:e.text,disb:e.out,dep:0,bal,docs:''}}
      bal=r2(bal+e.inn);
      return {date:e.date,payee:e.who,desc:e.k==='fill'?(e.text||'Funds deposit'):('Change returned'+(e.text?' – '+e.text:'')),disb:0,dep:e.inn,bal,docs:'N/A'};
    });
    return {opening,rows:out,closing:bal,disbursed:r2(opening-bal)};
  }
  function registerHTML(month,o){
    const R=registerRows(month),[y,m]=month.split('-').map(Number),fy=m>=3?y+1:y,mm=String(m).padStart(2,'0');
    const total=Math.max(34,R.rows.length);let tr='';
    for(let i=0;i<total;i++){
      const r=R.rows[i];
      if(r)tr+=`<tr><td class="no">${i+2}</td><td class="c">${dDot(r.date)}</td><td class="c">PC/${fy}/${mm}/${String(i+1).padStart(3,'0')}</td><td>${esc(r.payee)}</td><td>${esc(r.desc)}</td><td class="n ${r.dep?'red':'blue'}">${r.dep?'('+fm2(r.dep)+')':fm2(r.disb)}</td><td class="n bold">${fm2(r.bal)}</td><td class="c blue">${esc(r.docs)}</td><td class="nt"></td></tr>`;
      else tr+=`<tr class="empty"><td class="no">${i+2}</td><td></td><td></td><td></td><td></td><td></td><td class="n bold">${fm2(R.closing)}</td><td></td><td></td></tr>`;
    }
    const first=R.rows.length?month+'-01':month+'-01';
    return `<!doctype html><html><head><meta charset="utf-8"><title>Petty Cash Register ${esc(MN[m-1])} ${y}</title><style>
      @page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{margin:0;font:11px Arial,Helvetica,sans-serif;color:#000;background:#fff}
      .sheet{width:100%;max-width:190mm;margin:0 auto}
      .top{background:#161d33;color:#fff;padding:8px 10px 3px;font-size:17px;font-weight:700;letter-spacing:.3px}
      .sub{background:#161d33;color:#cfd6e6;padding:2px 10px 7px;font-size:9px;font-style:italic}
      .info{display:grid;grid-template-columns:1fr 1fr 1.3fr 1.1fr;gap:0;border:1px solid #d6dbe8;border-top:0;font-size:10.5px}
      .info div{padding:6px 8px}.info b{font-weight:700}.info .v{color:#1f4fa3;font-weight:700}
      .info .fl{text-align:center;border-left:1px solid #d6dbe8}.info .fl .big{display:block;color:#1f4fa3;font-weight:700;font-size:12px;margin-top:2px}
      .open{display:grid;grid-template-columns:2fr 1.1fr;font-size:9px;font-style:italic;border:1px solid #d6dbe8;border-top:0}
      .open div{padding:4px 8px}.open .ob{text-align:center;font-style:normal;font-weight:700;color:#1f4fa3;font-size:12px;border-left:1px solid #d6dbe8;background:#eef2fb}
      table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:4px}
      th{background:#161d33;color:#fff;font-size:9.5px;font-weight:600;padding:5px 3px;text-align:center;line-height:1.2}
      td{border-bottom:1px solid #e1e5ef;padding:3px 4px;height:17px;vertical-align:middle;font-size:10px;overflow:hidden}
      td.no{color:#c9cedb;text-align:center;font-size:9px}td.c{text-align:center}td.n{text-align:right;padding-right:8px;font-variant-numeric:tabular-nums}
      td.blue,.blue{color:#1f4fa3}td.red,.red{color:#c0262d}td.bold,.bold{font-weight:700}td.nt{font-style:italic;font-size:8.5px}
      tr.empty td{color:#000;background:#fafbfd}tr.empty td.n{font-weight:700}
      tfoot td{background:#161d33;color:#fff;font-weight:700;height:19px;border:0;font-size:10.5px}
      .gl{width:24px}
    </style></head><body><div class="sheet">
      <div class="top">${esc(o.title)}</div><div class="sub">${esc(o.subtitle)}</div>
      <div class="info"><div><b>Month:</b> <span class="v">${esc(MN[m-1])}</span></div><div><b>Year:</b> <span class="v">${fy}</span></div><div style="text-align:right"><b>Custodian:</b> <span class="v">${esc(o.custodian)}</span></div>
        <div class="fl"><b>Float Amount (N$):</b><span class="big">${fm2(o.float)}</span></div></div>
      <div class="open"><div>Opening Balance (N$) — enter the physical cash count at the start of this month:</div><div class="ob">${fm2(R.opening)}</div></div>
      <table><colgroup><col style="width:5%"><col style="width:11%"><col style="width:15%"><col style="width:15%"><col style="width:22%"><col style="width:10%"><col style="width:10%"><col style="width:6%"><col style="width:12%"></colgroup>
      <thead><tr><th>#</th><th>Date</th><th>Slip #</th><th>Payee / Vendor</th><th>Description</th><th>Disbursed (N$)</th><th>Running Balance (N$)</th><th>Docs?</th><th>Notes</th></tr></thead>
      <tbody><tr><td class="no">1</td><td class="c">${dDot(first)}</td><td></td><td class="bold">opening balance</td><td></td><td></td><td class="n bold">${fm2(R.opening)}</td><td></td><td></td></tr>${tr}</tbody>
      <tfoot><tr><td colspan="5"></td><td class="n">${fm2(R.disbursed)}</td><td class="n">${fm2(R.closing)}</td><td colspan="2"></td></tr></tfoot></table></div></body></html>`;
  }
  function openSheetDialog(){
    const months=[...new Set(ledger().map(e=>e.date.slice(0,7)))].sort().reverse();
    if(!months.length)return toast('Add a fill-up first. There is nothing to print yet.');
    const pr=sheetPrefs(),sel=F.month!=='all'&&months.includes(F.month)?F.month:months[0];
    const fl=r2(+pr.float||(F.fills||[]).filter(x=>x.kind==='open').reduce((t,x)=>t+x.amount,0)||(F.fills||[]).reduce((t,x)=>Math.max(t,x.amount),0));
    const old=document.getElementById('plSheetDlg');if(old)old.remove();
    const w=document.createElement('div');w.id='plSheetDlg';w.setAttribute('role','dialog');w.setAttribute('aria-modal','true');w.setAttribute('aria-labelledby','plSdT');
    w.style.cssText='position:fixed;inset:0;z-index:99997;background:rgba(10,20,50,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    w.innerHTML=`<div style="background:#fff;color:#16254a;border-radius:14px;max-width:520px;width:100%;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.4);font:14px system-ui,sans-serif">
      <h3 id="plSdT" style="margin:0 0 4px;font-size:18px">Print the Petty Cash Register</h3><p style="margin:0 0 10px;color:#5a6685">Builds the full monthly sheet (35 numbered lines, running balance, totals) from the ledger, laid out like the paper register.</p>
      <div style="display:grid;gap:8px"><label>Month<select id="plSdM" style="width:100%">${months.map(m=>`<option value="${m}"${m===sel?' selected':''}>${esc(monLabel(m))}</option>`).join('')}</select></label>
      <label>Heading<input id="plSdT1" maxlength="60" style="width:100%" value="${esc(pr.title||'VIRTUOSO AUTOMATION')}"></label>
      <label>Sub heading<input id="plSdT2" maxlength="100" style="width:100%" value="${esc(pr.subtitle||'Petty Cash Register — Appendix A | VA-FIN-SOP-PC-001 | Internal Use Only')}"></label>
      <label>Custodian<input id="plSdC" maxlength="60" style="width:100%" value="${esc(pr.custodian||'Barry Losper')}"></label>
      <label>Float amount (N$)<input id="plSdF" type="number" min="0" step="0.01" style="width:100%" value="${fl||''}"></label></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button type="button" class="btn ghost" id="plSdNo">Cancel</button><button type="button" class="btn" id="plSdGo">Preview the sheet</button></div></div>`;
    document.body.appendChild(w);
    const close=()=>{w.remove();document.removeEventListener('keydown',k)},k=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',k);
    w.querySelector('#plSdNo').onclick=close;w.addEventListener('mousedown',e=>{if(e.target===w)close()});
    w.querySelector('#plSdGo').onclick=async()=>{
      const o={title:clip(w.querySelector('#plSdT1').value,60).trim()||'PETTY CASH REGISTER',subtitle:clip(w.querySelector('#plSdT2').value,100).trim(),custodian:clip(w.querySelector('#plSdC').value,60).trim(),float:r2(parseFloat(w.querySelector('#plSdF').value)||0)},month=w.querySelector('#plSdM').value;
      saveSheetPrefs({title:o.title,subtitle:o.subtitle,custodian:o.custodian,float:o.float});close();
      if(!window.VIRTUOSO_DOCS||!VIRTUOSO_DOCS.overlay)return toast('The print preview is not available.');
      await VIRTUOSO_DOCS.overlay(registerHTML(month,o),{title:'Petty Cash Register '+monLabel(month),name:'Petty-Cash-Register-'+month});
    };
    w.querySelector('#plSdGo').focus();
  }

  /* one calm layout: tiles, one entry card (fill-up or drawer count), one statement card (balance sheet / ledger / counts) */
  function latestCount(){const cs=(F.counts||[]).slice().sort((x,y)=>x.date.localeCompare(y.date));return cs[cs.length-1]||null}
  function outstandingRows(last,K){
    return `<tr class="sub"><td colspan="2">Drawer count and what is outstanding – as at ${esc(dLabel(last.date))}</td><td class="n">N$</td></tr>
      <tr><td colspan="2">Cash counted in the drawer</td><td class="n">${num(K.counted)}</td></tr>
      <tr><td colspan="2">Cash that should be in the drawer on that date</td><td class="n">${num(K.exp)}</td></tr>
      <tr><td colspan="2">Drawer over (+) / short (−)</td><td class="n ${K.over<0?'neg':''}">${num(K.over)}</td></tr>
      <tr><td colspan="2">Still out with staff, not yet reported (${K.nOpen})</td><td class="n">${num(K.out)}</td></tr>
      <tr><td colspan="2">Short (+) / over (−) on settled entries: change returned less than due</td><td class="n">${num(K.shortSet)}</td></tr>
      <tr><td colspan="2">Short (+) / over (−) in the drawer count</td><td class="n">${num(K.shortDrawer)}</td></tr>
      <tr class="tot"><td colspan="2">Total outstanding to be accounted for</td><td class="n ${K.total>0?'neg':''}">${num(K.total)}</td></tr>
      <tr><td colspan="2">Check: money put in less cash counted less cash spent (${num(K.direct)}) equals the total outstanding</td><td class="n">${K.ok?'<span class="okp">Balanced ✓</span>':'<span class="badp">Does not agree ✗</span>'}</td></tr>`;
  }
  function countsTable(){
    const cs=(F.counts||[]).slice().sort((x,y)=>y.date.localeCompare(x.date)).slice(0,24);
    if(!cs.length)return '<p class="note">No drawer counts recorded yet. Use “Count the drawer” above.</p>';
    return `<div class="plscroll"><table class="plt" aria-label="Drawer counts"><thead><tr><th>Date</th><th>Counted by</th><th class="n">Counted</th><th class="n">Should be</th><th class="n">Over / short</th><th class="n">Outstanding</th><th></th></tr></thead><tbody>${cs.map(c=>{const k=countCalc(c);
      return `<tr><td>${esc(dLabel(c.date))}</td><td>${esc(c.by||'')}${c.note?' – '+esc(c.note):''}</td><td class="n">${num(c.amount)}</td><td class="n">${num(k.exp)}</td><td class="n ${k.over<0?'neg':''}">${num(k.over)}</td><td class="n ${k.total>0?'neg':''}">${num(k.total)}</td><td><button type="button" class="btn sm ghost" data-act="plCDel" data-id="${esc(c.id)}" aria-label="Delete this count" style="color:var(--bad)">Delete</button></td></tr>`}).join('')}</tbody></table></div>`;
  }
  function panel(){
    if(!LIVE||!F.fills||Date.now()-F.at>8000)load();
    const ev=F.fills?ledger():[],months=[...new Set(ev.map(e=>e.date.slice(0,7)))].sort().reverse();
    if(F.month!=='all'&&!months.includes(F.month))F.month='all';
    const S=F.fills?sheet(ev,F.month):null,last=latestCount(),K=last&&F.fills?countCalc(last):null;
    const per=F.month==='all'?'all time':monLabel(F.month);
    const bf=S&&F.month!=='all'?`<tr class="bf"><td></td><td>Balance brought forward</td><td class="n"></td><td class="n"></td><td class="n"></td><td class="n">${num(S.before)}</td></tr>`:'';
    const body=S?S.rows.map(e=>`<tr><td>${esc(dLabel(e.date))}</td><td>${esc(e.desc)}${e.k==='fill'?` <button type="button" class="btn sm ghost" data-act="plDel" data-id="${esc(e.id)}" aria-label="Delete this fill-up" style="color:var(--bad)">Delete</button>`:''}</td>
      <td class="n">${e.inn&&e.k==='fill'?num(e.inn):''}</td><td class="n">${e.out?num(e.out):''}</td><td class="n">${e.inn&&e.k==='ret'?num(e.inn):''}</td><td class="n ${e.bal<0?'neg':''}">${num(e.bal)}</td></tr>`).join(''):'';
    const tile=(v,l,cls)=>`<div class="plk ${cls||''}"><b>${v}</b><span>${l}</span></div>`;
    const tiles=S?`<div class="plgrid">${tile(money(S.closing),'Should be in the box'+(F.month==='all'?' now':' at month end'),'big'+(S.closing<0?' neg':''))}
      ${tile(money(S.fills+(F.month==='all'?0:S.before)),F.month==='all'?'Put in (incl. opening)':'Brought forward + put in')}${tile(money(S.taken),'Cash taken')}${K?'':tile(money(S.ret),'Change returned')}${tile(money(S.out),'Still out, not reported ('+S.nOpen+')')}
      ${K?tile(money(K.counted),'Counted in drawer ('+esc(dLabel(last.date))+')')+tile(money(K.total),'Total outstanding',K.total>0?'neg':''):''}</div>`:'<p class="note">Loading…</p>';
    const entry=F.entry==='count'?'count':'fill';
    const entryCard=`<div class="plcard"><div class="plseg" role="tablist" aria-label="What do you want to record?"><button type="button" role="tab" aria-selected="${entry==='fill'}" data-act="plEntry" data-v="fill">Add a fill-up</button><button type="button" role="tab" aria-selected="${entry==='count'}" data-act="plEntry" data-v="count">Count the drawer</button></div>
      <p class="note" style="margin:8px 0">${entry==='fill'?'Record what Barry puts into the petty cash box. The first one can be the opening balance.':'Count the cash in the drawer. The app compares it with what the balance says should be there and works out what is outstanding.'}</p>
      ${F.err?`<div class="banner" role="alert" style="border-left-color:var(--bad);background:var(--bad-soft)">${esc(F.err)}</div>`:''}${entry==='count'&&F.cErr?`<div class="banner" role="alert" style="border-left-color:var(--bad);background:var(--bad-soft)">${esc(F.cErr)}</div>`:''}${F.msg?`<div class="banner ok" role="status">${esc(F.msg)}</div>`:''}
      ${entry==='fill'?`<form class="plf" id="plForm" novalidate><label>Date<input type="date" id="plDate" value="${esc(todayISO())}"></label>
        <label>Amount (N$)<input type="number" id="plAmt" min="0.01" step="0.01" inputmode="decimal"></label>
        <label>Type<select id="plKind"><option value="fill">Fill-up</option><option value="open">Opening balance</option></select></label>
        <label>Filled up by<input type="text" id="plBy" value="Barry Losper" maxlength="60"></label>
        <label>Note (optional)<input type="text" id="plNote" maxlength="120" placeholder="e.g. Cash from bank"></label>
        <button class="btn" type="submit" ${F.busy?'disabled':''}>Add fill-up</button></form><div class="err" id="plErr" role="alert"></div>`
      :`<form class="plf" id="plCountForm" novalidate><label>Date counted<input type="date" id="pcDate" value="${esc(todayISO())}"></label>
        <label>Cash in drawer (N$)<input type="number" id="pcAmt" min="0" step="0.01" inputmode="decimal"></label>
        <label>Counted by<input type="text" id="pcBy" value="${esc(state.user?state.user.name:'')}" maxlength="60"></label>
        <label>Note (optional)<input type="text" id="pcNote" maxlength="120"></label>
        <button class="btn" type="submit" ${F.busy?'disabled':''}>Record cash in drawer</button></form><div class="err" id="pcErr" role="alert"></div>`}</div>`;
    const view=F.view==='ledger'||F.view==='counts'?F.view:'sheet';
    let content='';
    if(!S)content='<p class="note">Loading…</p>';
    else if(view==='sheet')content=`<div class="plscroll"><table class="plt" aria-label="Balance sheet for ${esc(per)}"><thead><tr><th colspan="2">Balance sheet – ${esc(per)}</th><th class="n">N$</th></tr></thead><tbody>
      ${F.month!=='all'?`<tr><td colspan="2">Balance brought forward</td><td class="n">${num(S.before)}</td></tr>`:''}
      <tr><td colspan="2">Add: ${F.month==='all'?'opening balance and fill-ups':'fill-ups'} (by Barry)</td><td class="n">${num(S.fills)}</td></tr>
      <tr><td colspan="2">Less: cash taken</td><td class="n">(${num(S.taken)})</td></tr>
      <tr><td colspan="2">Add: change returned</td><td class="n">${num(S.ret)}</td></tr>
      <tr class="tot"><td colspan="2">Cash that should be in the box${F.month==='all'?' now':''}</td><td class="n">${num(S.closing)}</td></tr>
      <tr class="sub"><td colspan="2">Where the cash taken went (${esc(per)})</td><td class="n">N$</td></tr>
      <tr><td colspan="2">Cash taken</td><td class="n">${num(S.takenAll)}</td></tr>
      <tr><td colspan="2">&nbsp;&nbsp;Spent, reported</td><td class="n">${num(S.spent)}</td></tr>
      <tr><td colspan="2">&nbsp;&nbsp;Change returned</td><td class="n">${num(S.returned)}</td></tr>
      <tr><td colspan="2">&nbsp;&nbsp;Short (−) or over (+) on settled entries</td><td class="n ${S.diff<0?'neg':''}">${num(S.diff)}</td></tr>
      <tr><td colspan="2">&nbsp;&nbsp;Still out: not yet reported (${S.nOpen})</td><td class="n">${num(S.out)}</td></tr>
      <tr><td colspan="2">If all cash still out came back in full, the box would hold</td><td class="n">${num(S.closing+S.out)}</td></tr>
      <tr><td colspan="2">Check: settled cash taken (${num(S.takenSet)}) = spent + returned − difference (${num(S.spent+S.returned-S.diff)}); ledger closing = balance sheet</td><td class="n">${S.ok?'<span class="okp">Balanced ✓</span>':'<span class="badp">Does not agree ✗</span>'}</td></tr>
      ${K?outstandingRows(last,K):''}</tbody></table></div>`;
    else if(view==='ledger')content=`<div class="plscroll"><table class="plt" aria-label="Petty cash ledger"><thead><tr><th>Date</th><th>Description</th><th class="n">Fill-up</th><th class="n">Cash taken</th><th class="n">Change returned</th><th class="n">Balance</th></tr></thead><tbody>
      ${bf}${body||`<tr><td colspan="6" class="note">No entries yet. Add the first fill-up above.</td></tr>`}
      ${S.rows.length?`<tr class="tot"><td></td><td>Totals${F.month==='all'?'':' for the month'}</td><td class="n">${num(S.fills)}</td><td class="n">${num(S.taken)}</td><td class="n">${num(S.ret)}</td><td class="n">${num(S.closing)}</td></tr>`:''}</tbody></table></div>`;
    else content=countsTable();
    const vt=(k,l)=>`<button type="button" role="tab" aria-selected="${view===k}" data-act="plView" data-v="${k}">${l}</button>`;
    const stmt=`<div class="plcard"><div class="plbar"><div class="plseg" role="tablist" aria-label="Statement">${vt('sheet','Balance sheet')}${vt('ledger','Ledger')}${vt('counts','Drawer counts')}</div><span class="grow"></span>
      ${view==='counts'?'':`<label style="display:flex;gap:6px;align-items:center">Period <select id="plMonth" aria-label="Period"><option value="all"${F.month==='all'?' selected':''}>All time</option>${months.map(m=>`<option value="${m}"${F.month===m?' selected':''}>${esc(monLabel(m))}</option>`).join('')}</select></label>
      <button class="btn ghost sm" type="button" data-act="plCsv">Download CSV</button>`}<button class="btn sm" type="button" data-act="plSheet">Print petty cash sheet</button><button class="btn ghost sm" type="button" data-act="plPrint">Preview and print this view</button></div>${content}</div>`;
    return `<div class="panel plw" id="plPanel"><div class="ph"><h3>Petty cash float and balance sheet</h3></div>${tiles}${entryCard}${stmt}</div>`;
  }

  const base=VIEWS.cash;
  VIEWS.cash=function(){
    const h=base.apply(this,arguments);
    if(!isAdm())return h;
    const i=h.indexOf('<div class="pcx">');
    return i<0?h+panel():h.slice(0,i+17)+panel()+h.slice(i+17);
  };

  /* ---------- actions ---------- */
  const csvCell=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  function csv(){
    const ev=ledger(),S=sheet(ev,F.month),L=[['Date','Description','Fill-up','Cash taken','Change returned','Balance']];
    if(F.month!=='all')L.push(['','Balance brought forward','','','',S.before.toFixed(2)]);
    S.rows.forEach(e=>L.push([e.date,e.desc,e.k==='fill'?e.inn.toFixed(2):'',e.out?e.out.toFixed(2):'',e.k==='ret'?e.inn.toFixed(2):'',e.bal.toFixed(2)]));
    L.push(['','Totals',S.fills.toFixed(2),S.taken.toFixed(2),S.ret.toFixed(2),S.closing.toFixed(2)]);
    const blob=new Blob(['﻿'+L.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv'}),a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download='petty-cash-balance-sheet-'+(F.month==='all'?'all':F.month)+'.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
  }
  document.addEventListener('click',async e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="pl"]');if(!b||!isAdm())return;
    const a=b.dataset.act;if(!['plCsv','plPrint','plDel','plCDel','plEntry','plView','plSheet'].includes(a))return;
    e.stopImmediatePropagation();
    if(a==='plEntry'){F.entry=b.dataset.v==='count'?'count':'fill';F.msg='';F.err='';F.cErr='';return render()}
    if(a==='plView'){F.view=b.dataset.v;return render()}
    if(a==='plSheet')return openSheetDialog();
    if(a==='plCsv')return csv();
    if(a==='plPrint')return previewView();
    if(a==='plCDel'){
      const cid=b.dataset.id,c=(F.counts||[]).find(v=>v.id===cid);if(!c||F.busy)return;
      if(!confirm('Delete the count of '+money(c.amount)+' on '+dLabel(c.date)+'? This cannot be undone.'))return;
      F.busy=true;
      if(!LIVE)state.pettyCounts=(state.pettyCounts||[]).filter(v=>v.id!==cid);
      else{const r=await sb().from('petty_counts').delete().eq('id',cid);if(r.error){F.busy=false;F.err='Could not delete: '+r.error.message;return render()}}
      F.busy=false;F.msg='Count deleted.';F.at=0;F.fills=null;return render();
    }
    const id=b.dataset.id,x=(F.fills||[]).find(v=>v.id===id);if(!x||F.busy)return;
    if(!confirm('Delete this '+(x.kind==='open'?'opening balance':'fill-up')+' of '+money(x.amount)+' ('+dLabel(x.date)+')? The balance will change. This cannot be undone.'))return;
    F.busy=true;
    if(!LIVE){state.pettyFills=(state.pettyFills||[]).filter(v=>v.id!==id)}
    else{const r=await sb().from('petty_fills').delete().eq('id',id);if(r.error){F.busy=false;F.err='Could not delete: '+r.error.message;return render()}}
    F.busy=false;F.msg='Fill-up deleted.';F.at=0;F.fills=null;render();
  },true);
  document.addEventListener('change',e=>{if(e.target&&e.target.id==='plMonth'){e.stopImmediatePropagation();F.month=e.target.value;F.msg='';render()}},true);
  document.addEventListener('submit',async e=>{
    if(!e.target||e.target.id!=='plCountForm')return;
    e.preventDefault();e.stopImmediatePropagation();
    if(!isAdm()||F.busy)return;
    const date=document.getElementById('pcDate').value,amt=r2(parseFloat(document.getElementById('pcAmt').value)),by=clip(document.getElementById('pcBy').value,60).trim(),note=clip(document.getElementById('pcNote').value,120).trim(),err=m=>{document.getElementById('pcErr').textContent=m};
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return err('Choose the date.');
    if(!(amt>=0)||document.getElementById('pcAmt').value==='')return err('Enter the cash counted (0 or more).');
    if(amt>10000000)return err('That amount is too large.');
    F.busy=true;err('');
    if(!LIVE){(state.pettyCounts=state.pettyCounts||[]).push({id:'pc'+Math.random().toString(36).slice(2,9),date,amount:amt,by,note});if(typeof logA==='function')logA('Petty cash drawer counted',money(amt))}
    else{
      const r=await sb().from('petty_counts').insert({counted_on:date,amount:amt,counted_by:by||null,note:note||null});
      if(r.error){F.busy=false;F.cErr=/petty_counts|schema cache|relation/i.test(r.error.message||'')?'Recording the cash in the drawer needs database migration 0037. Run it in the Supabase SQL editor, then reload.':'Could not save: '+r.error.message;return render()}
    }
    F.busy=false;F.cErr='';F.msg='Cash in drawer of '+money(amt)+' recorded.';F.at=0;F.fills=null;render();
  },true);
  document.addEventListener('submit',async e=>{
    if(!e.target||e.target.id!=='plForm')return;
    e.preventDefault();e.stopImmediatePropagation();
    if(!isAdm()||F.busy)return;
    const date=document.getElementById('plDate').value,amt=r2(parseFloat(document.getElementById('plAmt').value)),kind=document.getElementById('plKind').value==='open'?'open':'fill',
      by=clip(document.getElementById('plBy').value,60).trim(),note=clip(document.getElementById('plNote').value,120).trim(),err=m=>{document.getElementById('plErr').textContent=m};
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return err('Choose the date.');
    if(!(amt>0))return err('Enter an amount greater than 0.');
    if(amt>10000000)return err('That amount is too large.');
    F.busy=true;err('');
    if(!LIVE){(state.pettyFills=state.pettyFills||[]).push({id:'pf'+Math.random().toString(36).slice(2,9),date,amount:amt,by,kind,note});if(typeof logA==='function')logA('Petty cash fill-up',money(amt)+(by?' by '+by:''))}
    else{
      const r=await sb().from('petty_fills').insert({filled_on:date,amount:amt,filled_by:by||null,kind,note:note||null});
      if(r.error){F.busy=false;F.err=/petty_fills|schema cache|relation/i.test(r.error.message||'')?'The float needs database migration 0036. Run it in the Supabase SQL editor, then reload.':'Could not save: '+r.error.message;return render()}
    }
    F.busy=false;F.err='';F.msg=(kind==='open'?'Opening balance':'Fill-up')+' of '+money(amt)+' recorded.';F.at=0;F.fills=null;render();
  },true);

  window.VIRTUOSO_FLOAT={ledger,sheet,registerRows,registerHTML,state:()=>F};
})();
