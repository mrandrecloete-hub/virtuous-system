/* CLIENT KYC page in the premium layout: banner, four status tiles (Total, Verified, Pending, Expired), Search and Filter,
   action buttons, clients table with documents, last updated and actions, and pagination.
   Every client here is a real KYC submission from a client form. Existing review, form fill, forms list and letters keep working;
   they are reached through the Clients / Forms / Letters pill tabs. Expiry uses the firm setting 'KYC valid for (months)'
   counted from the submission date (a placeholder of 12 months until the firm sets its own rule). */
(function(){
  const UI=()=>window.VIRTUOSO_UI;
  const isAdm=()=>state.user&&state.user.type==='admin';
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const todayISO=()=>(state.today&&/[?&]demo\b/.test(location.search))?state.today:iso(new Date());
  const KX={name:'',status:'All',doc:'All',range:'all',page:1,size:10,sel:{},menu:null,applied:true};
  const validMonths=()=>{const S=window.VIRTUOSO_SETTINGS;if(S&&S.load)S.load();const v=S&&S.get('kyc_valid_months');return v>0?+v:12};
  const ID_RE=/passport|id number|identity|id no|registration number|reg(\.|istration)? no|\bid\b/i;

  function clients(){
    const months=validMonths(),t=new Date(todayISO()+'T00:00:00');
    return (state.subs||[]).filter(s=>{const f=kForm(s.formId);return f&&f.audience!=='staff'}).map(s=>{
      const f=kForm(s.formId);let idNo='';
      (f.fields||[]).some(x=>{const v=s.ans&&s.ans[x.id];if(typeof v==='string'&&v.trim()&&ID_RE.test(x.label||'')&&x.type!=='file'){idNo=v.trim();return true}return false});
      const files=Object.values(s.ans||{}).filter(v=>v&&typeof v==='object'&&!Array.isArray(v)&&v.name).length;
      let status=s.status,tone={Approved:'ok',Rejected:'bad',Pending:'warn','Needs info':'warn'}[s.status]||'';
      let label={Approved:'Verified',Pending:'Pending Review'}[s.status]||s.status;
      const base=new Date((s.date||todayISO())+'T00:00:00'),lim=new Date(base.getFullYear(),base.getMonth()+months,base.getDate());
      const expired=s.status==='Approved'&&lim<t;
      if(expired){status='Expired';label='Expired';tone='exp'}
      return {s,id:s.id,ref:s.ref,name:kNameOf(s),idNo,form:f.title,formId:f.id,status,label,tone,files,when:s.time||s.date||'',date:s.date||''};
    });
  }
  const initials=n=>String(n||'?').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?';
  const inRange=(d,r)=>{
    if(r==='all'||!d)return true;const t=new Date(todayISO()+'T00:00:00'),x=new Date(d+'T00:00:00'),days=(t-x)/864e5;
    if(r==='7')return days<=7;if(r==='30')return days<=30;
    if(r==='month')return x.getFullYear()===t.getFullYear()&&x.getMonth()===t.getMonth();
    if(r==='fy'){const sy=t.getMonth()>=2?t.getFullYear():t.getFullYear()-1;return d>=sy+'-03-01'&&d<=(sy+1)+'-02-28'||d>=sy+'-03-01'&&d<=(sy+1)+'-02-29'}
    return true;
  };
  function filtered(all){
    const q=KX.name.trim().toLowerCase();
    return all.filter(c=>(!q||(c.name+' '+c.ref+' '+c.idNo).toLowerCase().includes(q))&&(KX.status==='All'||c.status===KX.status||c.label===KX.status)&&(KX.doc==='All'||c.formId===KX.doc)&&inRange(c.date,KX.range));
  }

  const css=document.createElement('style');
  css.textContent=`
  .kxstats{display:grid;gap:14px;grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:16px}
  @media(max-width:1100px){.kxstats{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:520px){.kxstats{grid-template-columns:1fr}}
  .kxs{display:flex;align-items:center;gap:14px;border-radius:18px;padding:16px 18px;color:#fff;min-width:0;border:1px solid rgba(255,255,255,.25);box-shadow:0 12px 26px rgba(10,30,110,.28)}
  .kxs .ci{flex:none;width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.18);box-shadow:inset 0 0 0 2px rgba(255,255,255,.28)}
  .kxs .tx{min-width:0;flex:1}.kxs .tx span{display:block;font-size:15px;opacity:.95}.kxs .tx b{display:block;font-size:34px;line-height:1.1}
  .kxs .pc{flex:none;align-self:flex-end;border-radius:999px;padding:3px 12px;font-weight:800;font-size:14px;color:#fff}
  .kxs.a{background:linear-gradient(135deg,#0a2a7a,#1348c8)}.kxs.a .ci{background:linear-gradient(180deg,#2f6fe4,#1646c0)}
  .kxs.b{background:linear-gradient(135deg,#0b3fb5,#1d6fe6)}.kxs.b .ci{background:linear-gradient(180deg,#34c47c,#16905a)}.kxs.b .pc{background:#1fb86a}
  .kxs.c{background:linear-gradient(135deg,#e09a05,#f7c948);color:#fff}.kxs.c .ci{background:rgba(255,255,255,.3)}.kxs.c .pc{background:#f28c00}
  .kxs.d{background:linear-gradient(135deg,#3d1a99,#7c45d6)}.kxs.d .ci{background:rgba(255,255,255,.18)}.kxs.d .pc{background:#e5484d}
  .kxbar{display:flex;align-items:center;gap:10px;color:#fff;background:linear-gradient(180deg,#0a2a7a,#051a56);padding:14px 20px;border-radius:14px 14px 0 0;font-weight:800;font-size:18px;border-bottom:3px solid #e8a600}
  .kxbox{background:var(--surface);border:1px solid var(--line);border-radius:14px;margin-bottom:16px;box-shadow:0 10px 26px rgba(15,40,110,.12)}
  .kxbox>.in{padding:16px 20px 18px}
  .kxf{display:grid;gap:14px;grid-template-columns:1.2fr 1fr 1fr 1fr auto;align-items:end}
  @media(max-width:1100px){.kxf{grid-template-columns:1fr 1fr}.kxf .go{grid-column:1/-1}}
  @media(max-width:520px){.kxf{grid-template-columns:1fr}}
  .kxf label{font-weight:700;font-size:13.5px;color:var(--fg);gap:6px}
  .kxf .fld{position:relative;display:flex;align-items:center}
  .kxf .fld svg{position:absolute;left:12px;color:var(--accent);pointer-events:none}
  .kxf .fld input,.kxf .fld select{width:100%;padding-left:40px;min-height:46px;border-radius:10px;font-weight:600}
  .kxf .go{display:flex;gap:10px}
  .kxgold,.kxnavy{display:inline-flex;align-items:center;gap:8px;border-radius:12px;min-height:48px;padding:0 24px;font:inherit;font-weight:800;font-size:16px;cursor:pointer;border:0}
  .kxgold{background:linear-gradient(180deg,#ffd75e,#e8a600);color:#0a1b3f;box-shadow:0 6px 16px rgba(232,166,0,.4)}
  .kxnavy{background:linear-gradient(180deg,#0f2f8c,#06184d);color:#fff;box-shadow:0 6px 16px rgba(6,24,77,.4)}
  .kxacts{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:14px;position:relative}
  .kxacts .kxnavy,.kxacts .kxlite{min-height:50px}
  .kxlite{display:inline-flex;align-items:center;gap:8px;border-radius:12px;padding:0 22px;font:inherit;font-weight:800;font-size:15.5px;cursor:pointer;background:#fff;color:#0a2a7a;border:1.5px solid #9db8f0;box-shadow:0 4px 12px rgba(15,40,110,.12)}
  .kxlite:hover{background:#eef4ff}
  .kxmenu{position:absolute;z-index:20;top:56px;left:0;min-width:240px;background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,.2);padding:4px}
  .kxmenu button{display:block;width:100%;text-align:left;border:0;background:transparent;color:var(--fg);font:inherit;padding:9px 12px;border-radius:6px;cursor:pointer;min-height:38px}
  .kxmenu button:hover{background:var(--accent-soft)}
  table.kxt{width:100%;border-collapse:collapse;font-size:15px}
  table.kxt thead th{background:linear-gradient(180deg,#0a2a7a,#051a56);color:#fff;text-align:left;font-weight:800;padding:13px 12px;white-space:nowrap;border:0}
  table.kxt thead th:first-child{border-radius:12px 0 0 0;width:48px}table.kxt thead th:last-child{border-radius:0 12px 0 0}
  table.kxt thead th .hi{display:inline-flex;align-items:center;gap:8px}
  table.kxt td{padding:12px;border-bottom:1px solid var(--line);vertical-align:middle;color:var(--fg)}
  table.kxt tbody tr:hover td{background:color-mix(in srgb,var(--accent) 5%,transparent)}
  .kxav{display:inline-grid;place-items:center;width:38px;height:38px;border-radius:50%;background:linear-gradient(180deg,#143a9c,#06184d);color:#fff;font-weight:800;font-size:13px;margin-right:10px;vertical-align:middle;box-shadow:0 0 0 2px #c9d8fb}
  .kxnm{font-weight:800}
  .kxp{display:inline-flex;align-items:center;gap:7px;border-radius:999px;padding:6px 16px 6px 10px;font-weight:700;font-size:14px;white-space:nowrap;border:1px solid transparent}
  .kxp.ok{background:#dff5e8;color:#1a7a43;border-color:#9fdcb8}.kxp.warn{background:#fff0c9;color:#9a6200;border-color:#f3cf7a}.kxp.bad{background:#fde3e1;color:#b3261e;border-color:#f3aaa5}.kxp.exp{background:#ffe3df;color:#c2331f;border-color:#f5b1a8}.kxp.def{background:#e8eefb;color:#25407f;border-color:#bccdf0}
  .kxd{display:inline-flex;align-items:center;gap:6px;color:#25407f}.kxd .ic{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:6px;background:#e4ecfb;color:#25407f}
  .kxd .ic.r{background:#fde3e1;color:#b3261e}.kxd .ic.b{background:#dfe8ff;color:#1646c0}
  .kxd small{color:var(--muted);font-size:13px;margin-left:4px}
  .kxw{display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
  .kxa{display:flex;gap:8px;align-items:center;position:relative}
  .kxv,.kxe,.kxm{display:inline-flex;align-items:center;gap:6px;border-radius:999px;font:inherit;font-weight:800;font-size:14px;cursor:pointer;min-height:38px;border:1.5px solid}
  .kxv{background:#dfe9ff;color:#0a3aa8;border-color:#a9c3f7;padding:0 16px}
  .kxe{background:linear-gradient(180deg,#ffe28a,#f0b400);color:#4a3200;border-color:#e3a800;padding:0 16px}
  .kxm{background:#fff;color:#0a2a7a;border-color:#c6d4f1;width:40px;justify-content:center;padding:0}
  .kxfoot{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;padding:14px 16px;color:var(--fg)}
  .kxpg{display:flex;gap:8px;flex-wrap:wrap}
  .kxpg button{min-width:40px;min-height:40px;border-radius:8px;border:1px solid #c6d4f1;background:#fff;color:#0a2a7a;font:inherit;font-weight:700;cursor:pointer}
  .kxpg button[aria-current=true]{background:linear-gradient(180deg,#143a9c,#06184d);color:#fff;border-color:#06184d}
  .kxpg button:disabled{opacity:.45;cursor:default}
  .kxcbx{width:20px;height:20px;accent-color:#0b3fb5}
  @media(max-width:820px){table.kxt{font-size:14px}.kxs .tx b{font-size:28px}}
  `;
  document.head.appendChild(css);

  const esc2=s=>esc(s);
  const docIcons=n=>{const I=UI().icon;return n?`<span class="kxd"><span class="ic">${I('idcard',16)}</span>${n>1?`<span class="ic r">${I('doc',16)}</span>`:''}${n>2?`<span class="ic b">${I('doc',16)}</span>`:''}<small>${n} file${n===1?'':'s'}</small></span>`:'<span class="note">No files</span>'};
  const pillIcon=c=>({ok:'check',warn:'clock',bad:'warn',exp:'warn'}[c.tone]||'doc');
  const pct=(n,t)=>t?(Math.round(n/t*1000)/10)+'%':'0%';

  function clientsPage(){
    const I=UI().icon,all=clients(),list=filtered(all),total=all.length;
    const ver=all.filter(c=>c.status==='Approved').length,pen=all.filter(c=>c.status==='Pending').length,exp=all.filter(c=>c.status==='Expired').length;
    const pages=Math.max(1,Math.ceil(list.length/KX.size));KX.page=Math.min(KX.page,pages);
    const from=(KX.page-1)*KX.size,rows=list.slice(from,from+KX.size);
    const cf=(state.forms||[]).filter(f=>f.audience!=='staff');
    const allSel=rows.length&&rows.every(r=>KX.sel[r.id]);
    const ranges=[['all','Select date range'],['7','Last 7 days'],['30','Last 30 days'],['month','This month'],['fy','This financial year']];
    const statuses=['All','Verified','Pending Review','Needs info','Rejected','Expired'];
    return `${stats(total,ver,pen,exp)}
    <div class="kxbox"><div class="kxbar">${I('search',22)} Search &amp; Filter Clients</div><div class="in">
      <form id="kxFilter" class="kxf" novalidate>
        <label>Client Name<span class="fld">${I('user',18)}<input id="kxName" value="${esc(KX.name)}" placeholder="Enter client name..." autocomplete="off"></span></label>
        <label>Status<span class="fld">${I('check',18)}<select id="kxStatus">${statuses.map(s=>`<option value="${s}" ${KX.status===s?'selected':''}>${s==='All'?'All Statuses':s}</option>`).join('')}</select></span></label>
        <label>KYC Document Type<span class="fld">${I('doc',18)}<select id="kxDoc"><option value="All">All Documents</option>${cf.map(f=>`<option value="${esc(f.id)}" ${KX.doc===f.id?'selected':''}>${esc(f.title)}</option>`).join('')}</select></span></label>
        <label>Date Range<span class="fld">${I('cal',18)}<select id="kxRange">${ranges.map(([v,l])=>`<option value="${v}" ${KX.range===v?'selected':''}>${l}</option>`).join('')}</select></span></label>
        <div class="go"><button class="kxgold" type="submit">${I('search',20)} Search</button><button class="kxnavy" type="button" data-act="kxReset">${I('reset',20)} Reset</button></div>
      </form></div></div>
    <div class="kxacts"><button class="kxnavy" type="button" data-act="kxMenu" data-m="add">${I('plus',20)} Add Client</button>
      <button class="kxlite" type="button" data-act="kxUpload">${I('upload',20)} Upload Documents</button>
      <button class="kxlite" type="button" data-act="kxExport">${I('download',20)} Export Report</button>
      ${KX.menu==='add'?`<div class="kxmenu" role="menu"><div class="note" style="padding:6px 12px">Choose the client form to fill in</div>${cf.length?cf.map(f=>`<button role="menuitem" data-k="fill" data-id="${esc(f.id)}">${esc(f.title)}</button>`).join(''):'<div class="note" style="padding:8px 12px">No client forms yet. Create one under Forms.</div>'}</div>`:''}</div>
    <div class="kxbox" style="padding:0"><div class="tbl"><table class="kxt"><thead><tr><th><input class="kxcbx" type="checkbox" id="kxAll" ${allSel?'checked':''} aria-label="Select all shown"></th>
      <th><span class="hi">${I('user',18)} Client Name</span></th><th><span class="hi">${I('idcard',18)} ID / Passport</span></th><th><span class="hi">${I('shield',18)} KYC Status</span></th><th><span class="hi">${I('doc',18)} Documents</span></th><th><span class="hi">${I('cal',18)} Last Updated</span></th><th>Actions</th></tr></thead><tbody>
      ${rows.length?rows.map(c=>`<tr><td><input class="kxcbx" type="checkbox" data-kxsel="${esc(c.id)}" ${KX.sel[c.id]?'checked':''} aria-label="Select ${esc(c.name)}"></td>
        <td><span class="kxav" aria-hidden="true">${esc(initials(c.name))}</span><span class="kxnm">${esc(c.name)}</span><div class="note" style="margin-left:48px">${esc(c.ref)} &middot; ${esc(c.form)}</div></td>
        <td>${c.idNo?esc(c.idNo):'<span class="note">Not given</span>'}</td>
        <td><span class="kxp ${c.tone||'def'}">${I(pillIcon(c),16)} ${esc(c.label)}</span></td>
        <td>${docIcons(c.files)}</td>
        <td><span class="kxw">${I('cal',17)} ${esc(c.when)}</span></td>
        <td><div class="kxa"><button class="kxv" data-act="kxView" data-id="${esc(c.id)}">${I('eye',17)} View</button><button class="kxe" data-k="review" data-id="${esc(c.id)}">${I('edit',17)} Review</button><button class="kxm" data-act="kxMenu" data-m="row:${esc(c.id)}" aria-label="More actions for ${esc(c.name)}">${I('dots',20)}</button>
          ${KX.menu==='row:'+c.id?`<div class="kxmenu" style="top:44px;right:0;left:auto" role="menu"><button role="menuitem" data-act="kxJson" data-id="${esc(c.id)}">Download answers (JSON)</button><button role="menuitem" data-k="delSub" data-id="${esc(c.id)}">Delete this submission</button></div>`:''}</div></td></tr>`).join(''):`<tr><td colspan="7" class="note" style="padding:24px">${total?'No clients match these filters.':'No client KYC submissions yet. Use Add Client, or share a client form link.'}</td></tr>`}
      </tbody></table></div>
      <div class="kxfoot"><span>Showing ${list.length?from+1:0} &ndash; ${Math.min(from+KX.size,list.length)} of ${list.length} client${list.length===1?'':'s'}${list.length!==total?` (filtered from ${total})`:''}</span>
        <div class="kxpg" role="navigation" aria-label="Pages"><button data-act="kxPage" data-p="${KX.page-1}" ${KX.page<=1?'disabled':''} aria-label="Previous page">&lsaquo;</button>${Array.from({length:pages},(_,i)=>i+1).slice(Math.max(0,KX.page-3),Math.max(0,KX.page-3)+5).map(p=>`<button data-act="kxPage" data-p="${p}" ${p===KX.page?'aria-current="true"':''}>${p}</button>`).join('')}<button data-act="kxPage" data-p="${KX.page+1}" ${KX.page>=pages?'disabled':''} aria-label="Next page">&rsaquo;</button></div></div></div>`;
  }
  function stats(total,ver,pen,exp){
    const I=UI().icon;
    return `<div class="kxstats">
      <div class="kxs a"><span class="ci">${I('users',30)}</span><div class="tx"><span>Total Clients</span><b>${total}</b></div></div>
      <div class="kxs b"><span class="ci">${I('check',32)}</span><div class="tx"><span>KYC Verified</span><b>${ver}</b></div><span class="pc">${pct(ver,total)}</span></div>
      <div class="kxs c"><span class="ci">${I('clock',30)}</span><div class="tx"><span>Pending Review</span><b>${pen}</b></div><span class="pc">${pct(pen,total)}</span></div>
      <div class="kxs d"><span class="ci">${I('warn',30)}</span><div class="tx"><span>Expired KYC</span><b>${exp}</b></div><span class="pc">${pct(exp,total)}</span></div></div>`;
  }
  const TABS=[['clients','Clients','users'],['forms','Forms','doc'],['letters','Letters','edit']];
  const tabBar=active=>UI().tabs(TABS,active,k=>`data-k="go" data-v="${k}"`);

  /* the original KYC view stays in charge of forms, form building, filling, review and letters */
  const prev=VIEWS.kyc;
  VIEWS.kyc=function(){
    if(!UI())return prev();
    kInit();const K=state.kyc;
    if(!isAdm())return prev();
    if(!K.xInit){K.xInit=true;if(K.view==='forms'||K.view==='subs')K.view='clients'}
    if(K.view==='subs')K.view='clients';
    const hero=(t,sub)=>UI().hero({title:t,sub,icon:'shield',art:'kyc',gold:3});
    if(K.view==='clients')return hero('Client KYC','Verify and manage your clients\' Know Your Customer (KYC) information securely.')+tabBar('clients')+clientsPage();
    if(K.view==='forms'){
      let h=prev();
      h=h.replace(/<h2>Client onboarding \(KYC\)<\/h2><p class="sub">[^<]*<\/p>/,'').replace(/<div class="seg" role="tablist"[\s\S]*?<\/div>/,'');
      return hero('Client KYC','Build and manage the forms your clients fill in.')+tabBar('forms')+h;
    }
    return prev();
  };

  /* ---------- events ---------- */
  function csv(rows){
    const q=v=>{v=String(v==null?'':v);if(/^[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'};
    return [['Reference','Client','ID / Passport','Form','Status','Files','Last updated']].concat(rows.map(c=>[c.ref,c.name,c.idNo,c.form,c.label,c.files,c.when])).map(r=>r.map(q).join(',')).join('\r\n');
  }
  function download(name,type,text){const u=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)}
  const onPage=()=>state.tab&&state.tab[state.role]==='kyc';
  document.addEventListener('submit',e=>{
    if(e.target.id!=='kxFilter')return;
    e.preventDefault();e.stopImmediatePropagation();
    KX.name=$('#kxName').value;KX.status=$('#kxStatus').value;KX.doc=$('#kxDoc').value;KX.range=$('#kxRange').value;KX.page=1;KX.sel={};render();
  },true);
  document.addEventListener('change',e=>{
    const t=e.target;if(!t||!isAdm())return;
    if(t.id==='kxAll'){e.stopImmediatePropagation();const list=filtered(clients()),from=(KX.page-1)*KX.size;list.slice(from,from+KX.size).forEach(r=>{KX.sel[r.id]=t.checked});return render()}
    if(t.dataset&&t.dataset.kxsel){e.stopImmediatePropagation();KX.sel[t.dataset.kxsel]=t.checked;return render()}
  },true);
  /* choosing Client KYC in the menu always lands on the clients page */
  document.addEventListener('click',e=>{const n=e.target.closest&&e.target.closest('.nv[data-tab="kyc"]');if(n&&isAdm()&&state.kyc){state.kyc.view='clients';state.kyc.done=null}},true);
  document.addEventListener('click',e=>{
    if(!isAdm()||!onPage())return;
    const b=e.target.closest&&e.target.closest('[data-act^="kx"]');
    if(!b){
      if(KX.menu&&!e.target.closest('.kxmenu')){KX.menu=null;render()}
      return;
    }
    const a=b.dataset.act;if(!['kxReset','kxMenu','kxUpload','kxExport','kxView','kxPage','kxJson'].includes(a))return;
    e.stopImmediatePropagation();
    if(a!=='kxMenu')KX.menu=null;
    if(a==='kxReset'){Object.assign(KX,{name:'',status:'All',doc:'All',range:'all',page:1,sel:{}});return render()}
    if(a==='kxMenu'){KX.menu=KX.menu===b.dataset.m?null:b.dataset.m;return render()}
    if(a==='kxPage'){KX.page=Math.max(1,+b.dataset.p||1);return render()}
    if(a==='kxUpload'){
      const f=(state.forms||[]).find(x=>/document/i.test(x.title)&&x.status==='open')||(state.forms||[]).find(x=>/document/i.test(x.title));
      if(!f){toast('Create a document form under Forms first');return}
      const K=state.kyc;K.formId=f.id;K.ans={};K.errs={};K.done=null;K.view='fill';return render();
    }
    if(a==='kxExport'){
      const all=filtered(clients()),picked=all.filter(c=>KX.sel[c.id]),rows=picked.length?picked:all;
      if(!rows.length){toast('Nothing to export');return}
      download('client-kyc-report.csv','text/csv',csv(rows));toast(rows.length+' client'+(rows.length===1?'':'s')+' exported');return;
    }
    if(a==='kxView'){const s=(state.subs||[]).find(x=>x.id===b.dataset.id);if(s&&window.VIRTUOSO_KYCPRINT)window.VIRTUOSO_KYCPRINT.submission(s);else toast('Preview is not available');return}
    if(a==='kxJson'){
      const s=(state.subs||[]).find(x=>x.id===b.dataset.id),f=s&&kForm(s.formId);if(!s||!f)return;
      const o={reference:s.ref,form:f.title,received:s.date,status:s.status,answers:Object.fromEntries(f.fields.filter(x=>!['head','para'].includes(x.type)&&kVis(x,f,s.ans)).map(x=>[x.label,x.type==='file'?(s.ans[x.id]?s.ans[x.id].name:null):x.type==='sign'?(s.ans[x.id]?'(signed)':null):s.ans[x.id]]))};
      download((s.ref||'kyc')+'.json','application/json',JSON.stringify(o,null,2));
    }
  },true);
  window.VIRTUOSO_KYCUI={clients,state:KX};
})();
