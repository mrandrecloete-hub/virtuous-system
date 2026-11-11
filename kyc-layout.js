/* CLIENT KYC PAGE LAYOUT (owner's request, Nov 2026): a hero banner, four summary tiles (total, verified, pending review, needs attention),
   a Search & Filter Clients panel (name, status, document type, date range), a toolbar (Add client, Upload documents, Export report)
   and a client table (checkbox, client with initials, ID / passport, status, documents, last updated, View and a more menu), 10 per page.
   It is a new look over the same data: each KYC submission is a client file. Statuses map as Approved = Verified, Pending = Pending review,
   Needs info and Rejected = Needs attention. There is no expiry date in the data, so there is no "Expired" tile. Buttons reuse the existing
   KYC actions (review, print preview, delete). Nothing is stored by this file. Action prefix `kl`. */
(function(){
  const L={q:'',st:'All',doc:'All',from:'',to:'',page:1,sel:{},init:false};
  const PER=10;
  const CSS=`.kl-hero{display:flex;gap:18px;align-items:center;background:linear-gradient(120deg,#07123f 0%,#102a86 70%,#1c3bb0 100%);color:#fff;border-radius:14px;padding:20px 24px;margin:0 0 14px;border-bottom:3px solid #e8b84a;position:relative;overflow:hidden}
.kl-hero svg{flex:none;width:58px;height:58px}.kl-hero h2{margin:0;color:#fff;font-size:30px;line-height:1.1}.kl-hero h2 b{color:#f0c14b}.kl-hero p{margin:6px 0 0;color:#d4dcff}
.kl-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:0 0 14px}
.kl-t{display:flex;gap:12px;align-items:center;border-radius:14px;padding:14px 16px;color:#fff;box-shadow:0 4px 14px rgba(8,20,80,.25)}
.kl-t i{font-style:normal;flex:none;width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.18);display:grid;place-items:center;font-size:22px}
.kl-t small{display:block;font-size:13px;opacity:.9}.kl-t b{font-size:30px;line-height:1.1}.kl-t em{margin-left:auto;font-style:normal;font-size:12px;font-weight:600;background:rgba(255,255,255,.22);border-radius:999px;padding:2px 9px}
.kl-t.a{background:linear-gradient(135deg,#102a86,#1f48c8)}.kl-t.b{background:linear-gradient(135deg,#0e3f8a,#176fc0)}.kl-t.c{background:linear-gradient(135deg,#c78612,#f0b83a);color:#2a1a00}.kl-t.c i{background:rgba(255,255,255,.35)}.kl-t.d{background:linear-gradient(135deg,#3a1f8f,#6a35c8)}
.kl-fh{background:linear-gradient(90deg,#07123f,#102a86);color:#fff;border-radius:12px 12px 0 0;padding:10px 16px;font-weight:600}
.kl-f{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;align-items:end;padding:14px 16px;background:var(--surface);border:1px solid var(--line);border-top:0;border-radius:0 0 12px 12px}
.kl-f label{display:block;font-size:13px;color:var(--muted)}.kl-f input,.kl-f select{width:100%;margin-top:4px;box-sizing:border-box}
.kl-tb{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}
.btn.kl-gold{background:linear-gradient(180deg,#f6c850,#e0a81e)!important;border-color:#c8901a;color:#2a1a00;font-weight:600}
.btn.kl-navy{background:#0a1a55;border-color:#0a1a55;color:#fff}
.kl-card{background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.kl-card table{min-width:760px}.kl-card thead th{background:#0a1a55;color:#fff;padding:12px 10px}
.kl-card td{vertical-align:middle}.kl-card tbody tr:hover{background:var(--accent-soft)}
.kl-av{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#0a1a55;color:#fff;font-size:12px;font-weight:600;margin-right:10px;vertical-align:middle}
.kl-doc{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:5px;background:var(--accent-soft);font-size:12px;margin-right:3px}
.kl-more{position:relative;display:inline-block}.kl-more summary{list-style:none;cursor:pointer;border:1px solid var(--line);border-radius:6px;padding:2px 10px;background:var(--surface)}.kl-more summary::-webkit-details-marker{display:none}
.kl-more div{position:absolute;right:0;top:110%;z-index:5;background:var(--surface);border:1px solid var(--line);border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.2);padding:4px;min-width:150px}
.kl-more div button{display:block;width:100%;text-align:left;border:0;background:none;color:inherit;font:inherit;padding:6px 10px;border-radius:6px;cursor:pointer}.kl-more div button:hover{background:var(--accent-soft)}
.kl-pg{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px}.kl-pg .pn{display:flex;gap:6px}.kl-pg button{min-width:34px}
@media(max-width:600px){.kl-hero h2{font-size:22px}.kl-hero svg{width:42px;height:42px}}`;
  {const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s)}

  const SHIELD='<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4 8 13v17c0 15 10 26 24 30 14-4 24-15 24-30V13z" fill="#102a86" stroke="#f0c14b" stroke-width="3"/><path d="M20 32l8 8 16-17" fill="none" stroke="#f0c14b" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const STAT={Approved:['Verified','ok'],Pending:['Pending review','warn'],'Needs info':['Needs info','warn'],Rejected:['Rejected','bad']};
  const ini=n=>(String(n||'?').replace(/[()]/g,'').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('')||'?').toUpperCase();
  const isId=f=>['short','num','number'].includes(f.type)&&/(^|\W)(id|passport|identity|id number|registration|reg)(\W|$)/i.test(f.label||'');
  function idOf(s){const f=kForm(s.formId);if(!f)return '';const x=f.fields.find(fl=>isId(fl)&&!kEmpty(s.ans[fl.id]));return x?String(s.ans[x.id]):''}
  function filesOf(s){const f=kForm(s.formId);if(!f)return [];return f.fields.filter(x=>x.type==='file'&&s.ans[x.id]).map(x=>({label:x.label,name:(s.ans[x.id]||{}).name||''}))}
  const dateOf=s=>s.date||'';
  function docTypes(){const set=new Set();state.forms.forEach(f=>f.fields.forEach(x=>{if(x.type==='file'&&x.label)set.add(x.label)}));return [...set].sort()}
  function filtered(){
    const q=L.q.toLowerCase();
    return state.subs.filter(s=>{
      if(L.st!=='All'){const m=L.st==='Attention'?['Needs info','Rejected'].includes(s.status):s.status===L.st;if(!m)return false}
      if(q&&!(s.ref+' '+kNameOf(s)+' '+idOf(s)+' '+kForm(s.formId).title).toLowerCase().includes(q))return false;
      if(L.doc!=='All'&&!filesOf(s).some(f=>f.label===L.doc))return false;
      const d=dateOf(s);if(L.from&&d&&d<L.from)return false;if(L.to&&d&&d>L.to)return false;
      return true;
    }).sort((a,b)=>String(b.time||b.date).localeCompare(String(a.time||a.date)));
  }
  function tiles(){
    const n=state.subs.length,c=st=>state.subs.filter(s=>s.status===st).length,att=c('Needs info')+c('Rejected'),pc=v=>n?(Math.round(v/n*1000)/10)+'%':'0%';
    return `<div class="kl-tiles"><div class="kl-t a"><i>👥</i><div><small>Total clients</small><b>${n}</b></div></div>
      <div class="kl-t b"><i>✔</i><div><small>KYC verified</small><b>${c('Approved')}</b></div><em>${pc(c('Approved'))}</em></div>
      <div class="kl-t c"><i>⏱</i><div><small>Pending review</small><b>${c('Pending')}</b></div><em>${pc(c('Pending'))}</em></div>
      <div class="kl-t d"><i>⚠</i><div><small>Needs attention</small><b>${att}</b></div><em>${pc(att)}</em></div></div>`;
  }
  function kSubsNew(){
    const adm=state.user&&state.user.type==='admin',list=filtered(),pages=Math.max(1,Math.ceil(list.length/PER));
    if(L.page>pages)L.page=pages;const from=(L.page-1)*PER,rows=list.slice(from,from+PER);
    const allSel=rows.length&&rows.every(s=>L.sel[s.id]);
    const body=rows.map(s=>{
      const st=STAT[s.status]||[s.status,''],fs=filesOf(s);
      return `<tr><td><input type="checkbox" data-kl="sel" data-id="${esc(s.id)}" ${L.sel[s.id]?'checked':''} aria-label="Select ${esc(kNameOf(s))}" style="width:auto"></td>
      <td><span class="kl-av">${esc(ini(kNameOf(s)))}</span><b>${esc(kNameOf(s))}</b><div class="note" style="margin-left:44px">${esc(kForm(s.formId).title)} · <span class="mono">${esc(s.ref)}</span></div></td>
      <td>${esc(idOf(s)||'—')}</td><td>${pill(st[0],st[1])}</td>
      <td>${fs.length?fs.slice(0,4).map(f=>`<span class="kl-doc" title="${esc(f.label)}: ${esc(f.name)}">📄</span>`).join('')+` <span class="note">${fs.length} file${fs.length===1?'':'s'}</span>`:'<span class="note">No files</span>'}</td>
      <td>${esc(s.time||s.date||'')}</td>
      <td><div class="row" style="flex-wrap:nowrap;gap:6px"><button class="btn sm" data-k="review" data-id="${esc(s.id)}">View</button>
        <details class="kl-more"><summary aria-label="More actions">⋯</summary><div><button data-kl="print" data-id="${esc(s.id)}">Print preview</button>${adm?`<button data-k="delSub" data-id="${esc(s.id)}" style="color:var(--bad)">Delete</button>`:''}</div></details></div></td></tr>`}).join('')
      ||`<tr><td colspan="7" class="note" style="padding:18px">No clients match. ${state.subs.length?'Change the filters or press Reset.':'Share a client form and the submissions appear here.'}</td></tr>`;
    const pn=[];for(let p=1;p<=pages;p++){if(p===1||p===pages||Math.abs(p-L.page)<=1)pn.push(p);else if(pn[pn.length-1]!=='…')pn.push('…')}
    const selN=Object.keys(L.sel).filter(k=>L.sel[k]).length;
    return `${tiles()}
    <div class="kl-fh">🔎 Search &amp; filter clients</div>
    <div class="kl-f" id="klF"><label>Client name or reference<input id="klQ" placeholder="Enter client name..." value="${esc(L.q)}"></label>
      <label>Status<select id="klSt">${[['All','All statuses'],['Approved','Verified'],['Pending','Pending review'],['Attention','Needs attention'],['Needs info','Needs info'],['Rejected','Rejected']].map(([v,l])=>`<option value="${v}" ${L.st===v?'selected':''}>${l}</option>`).join('')}</select></label>
      <label>KYC document type<select id="klDoc"><option value="All">All documents</option>${docTypes().map(d=>`<option ${L.doc===d?'selected':''}>${esc(d)}</option>`).join('')}</select></label>
      <label>From<input id="klFrom" type="date" value="${esc(L.from)}"></label><label>To<input id="klTo" type="date" value="${esc(L.to)}"></label>
      <div class="row" style="flex-wrap:nowrap"><button class="btn kl-gold" data-kl="search">Search</button><button class="btn kl-navy" data-kl="reset">Reset</button></div></div>
    <div class="kl-tb"><button class="btn kl-navy" data-kl="add">＋ Add client</button><button class="btn ghost" data-kl="add">Upload documents</button><button class="btn ghost" data-kl="export">Export report${selN?' ('+selN+' selected)':''}</button></div>
    <div class="kl-card"><div class="tbl"><table><thead><tr><th style="width:34px"><input type="checkbox" data-kl="all" ${allSel?'checked':''} aria-label="Select all on this page" style="width:auto"></th><th>Client</th><th>ID / passport</th><th>KYC status</th><th>Documents</th><th>Last updated</th><th>Actions</th></tr></thead><tbody>${body}</tbody></table></div>
      <div class="kl-pg"><span class="note">Showing ${list.length?from+1:0}–${Math.min(from+PER,list.length)} of ${list.length} client${list.length===1?'':'s'}</span>
      <div class="pn"><button class="btn ghost sm" data-kl="pg" data-p="${L.page-1}" ${L.page>1?'':'disabled'} aria-label="Previous page">‹</button>${pn.map(p=>p==='…'?'<span class="note">…</span>':`<button class="btn sm ${p===L.page?'':'ghost'}" data-kl="pg" data-p="${p}">${p}</button>`).join('')}<button class="btn ghost sm" data-kl="pg" data-p="${L.page+1}" ${L.page<pages?'':'disabled'} aria-label="Next page">›</button></div></div></div>`;
  }
  window.kSubs=kSubsNew;

  const base=VIEWS.kyc;
  VIEWS.kyc=function(){
    kInit();const K=state.kyc;
    if(!L.init){L.init=true;if(K.view==='forms')K.view='subs'}
    let h=base();
    if(!['forms','subs'].includes(K.view))return h;
    const hero=`<div class="kl-hero">${SHIELD}<div><h2>Client <b>KYC</b></h2><p>Verify and manage your clients' Know Your Customer (KYC) information securely.</p></div></div>`;
    h=h.replace(/<h2>Client onboarding \(KYC\)<\/h2><p class="sub">[^<]*<\/p>/,hero);
    h=h.replace(/(>)Submissions( \(\d+\))?(<\/button>)/,'$1Clients$2$3');
    return h;
  };

  function readFilters(){const g=id=>{const e=document.getElementById(id);return e?e.value:''};
    L.q=g('klQ').trim();L.st=g('klSt')||'All';L.doc=g('klDoc')||'All';L.from=g('klFrom');L.to=g('klTo');L.page=1}
  function csvRows(list){
    const head=['Reference','Client','Form','ID / passport','Status','Documents','Last updated'];
    return [head].concat(list.map(s=>[s.ref,kNameOf(s),kForm(s.formId).title,idOf(s),(STAT[s.status]||[s.status])[0],filesOf(s).map(f=>f.label).join('; '),s.time||s.date||'']));
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-kl]');if(!b||b.tagName==='INPUT')return;
    e.stopImmediatePropagation();const a=b.dataset.kl,K=state.kyc;
    if(a==='search'){readFilters();return kRender()}
    if(a==='reset'){L.q='';L.st='All';L.doc='All';L.from='';L.to='';L.page=1;return kRender()}
    if(a==='pg'){readFilters_keep();L.page=Math.max(1,+b.dataset.p||1);return kRender()}
    if(a==='add'){const f=state.forms.find(x=>x.audience!=='staff'&&x.status==='open')||state.forms.find(x=>x.audience!=='staff');
      if(f){K.formId=f.id;K.view='fill';K.ans={};K.errs={}}else{K.view='forms'}return kRender()}
    if(a==='export'){const sel=Object.keys(L.sel).filter(k=>L.sel[k]),list=sel.length?filtered().filter(s=>L.sel[s.id]):filtered();
      return kDownload('kyc_clients.csv','text/csv',csvOf(csvRows(list)))}
    if(a==='print'){const s=kSub(b.dataset.id);b.closest('details')&&b.closest('details').removeAttribute('open');if(s&&window.VIRTUOSO_KYCPRINT)window.VIRTUOSO_KYCPRINT.submission(s);else toast('The print preview is not available.')}
  },true);
  function readFilters_keep(){const g=id=>{const e=document.getElementById(id);return e?e.value:null};
    const q=g('klQ');if(q!==null){L.q=q.trim();L.st=g('klSt')||'All';L.doc=g('klDoc')||'All';L.from=g('klFrom')||'';L.to=g('klTo')||''}}
  document.addEventListener('change',e=>{
    const t=e.target;if(!t.dataset||!t.dataset.kl)return;e.stopImmediatePropagation();
    if(t.dataset.kl==='sel'){if(t.checked)L.sel[t.dataset.id]=true;else delete L.sel[t.dataset.id];return kRender()}
    if(t.dataset.kl==='all'){const list=filtered().slice((L.page-1)*PER,L.page*PER);list.forEach(s=>{if(t.checked)L.sel[s.id]=true;else delete L.sel[s.id]});return kRender()}
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='klQ'){e.preventDefault();readFilters();kRender()}},true);
})();
