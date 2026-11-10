/* STATIONERY LIST page, laid out like the office spreadsheet: title "Office Essentials", three columns
   (Stationery, Cleaning Materials, Snacks / Kitchen Supplies) each with Item, In Stock and To Buy, and a tab per month
   along the bottom (Jan 26, Feb 26 ...). Cells are free text ("2 boxes", "1 pack of 60"). Admins edit; everyone else reads.
   Stored as ONE JSON setting ('office_list') in app_settings (live: admin-write by RLS, audited; ?demo: in memory),
   so no migration is needed. The last save wins if two admins edit at the same moment. */
(function(){
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const KEY='office_list';
  const isAdm=()=>state.user&&state.user.type==='admin';
  const SECS=[['stationery','Stationery'],['cleaning','Cleaning Materials'],['kitchen','Snacks / Kitchen Supplies']];
  const MAXROWS=60,MAXLEN=60;
  const R=(item,stock,buy)=>({item,stock:stock||'',buy:buy||''});

  /* ---------- starting data (the firm's own list; spelling tidied) ---------- */
  const FEB={
    stationery:[R('Pencils','0'),R('Rulers','0'),R('Black Pen','0'),R('Red Pen','1 pack of 60'),R('Blue Pen','0'),R('Exam Pad','0'),R('Copy Paper','2 Box, 1 extra'),R('File Dividers','0'),R('Tipex','0'),R('File Ropes','5 boxes'),R('Stickers','0'),R('Cartridges Black','1 box'),R('Cartridges Color','2 boxes'),R('Black Files','6'),R('File Pockets','0'),R('Staplers','5'),R('Staples','2 boxes'),R('Rubber Bands','1 pack'),R('Keyboard & Mouse (wireless)','0','0')],
    cleaning:[R('Drain Cleaner'),R('Toilet Spray','5'),R('Toilet Paper','38 Rolls'),R('Kitchen Cloths'),R('Jik','2 LTR'),R('Pinegel','1 2 LTR'),R('Hand Wash','2'),R('Dish Wash Soap','1/2 5LTR'),R('Surf','500g','2 Kg'),R('Stay-soft','1 2LTR'),R('Paper rolls','2','2')],
    kitchen:[R('Milk','','2 Boxes'),R('Coffee','','1'),R('Coffee Beans','','1'),R('Tea','1 Box'),R('Water'),R('Oshikandela','','5'),R('Flavoured Water','','6'),R('Predator','','6'),R('First Aid Kit','','0'),R('Noodles','','4 Packs'),R('Chips','','5'),R('Biscuits','','5'),R('Sugar','Half a Pack','5 Kg'),R('Canderel With Sucralose / Ronnel','','2 boxes')]
  };
  const blankOf=m=>{const o={};SECS.forEach(([k])=>{o[k]=((m&&m[k])||[]).map(r=>R(r.item))});return o};
  const clone=o=>JSON.parse(JSON.stringify(o));
  const demoDoc=()=>({months:{'2026-01':blankOf(FEB),'2026-02':clone(FEB)}});
  const ym=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  const liveSeed=()=>{const o={};o[ym(new Date())]=blankOf(FEB);return {months:o}};

  const O={doc:null,month:null,loading:false,status:'',uid:null,t:null,undo:null};
  const label=k=>{const d=new Date(k+'-01T00:00:00');return d.toLocaleDateString('en-GB',{month:'short',year:'2-digit'})};
  const titleOf=k=>((O.doc&&O.doc.titles&&O.doc.titles[k])||SECS.find(x=>x[0]===k)[1]);
  const keys=()=>Object.keys((O.doc&&O.doc.months)||{}).sort();
  const cur=()=>{const ks=keys();if(!O.month||!ks.includes(O.month))O.month=ks[ks.length-1]||null;return O.month};
  const sheet=()=>{const k=cur();return k?O.doc.months[k]:null};
  const clean=s=>String(s==null?'':s).replace(/[\u0000-\u001f]/g,' ').slice(0,MAXLEN);

  function sanitize(d){
    const out={months:{},titles:{}};
    const tt=d&&d.titles&&typeof d.titles==='object'?d.titles:{};SECS.forEach(([k])=>{const v=clean(tt[k]).trim();if(v)out.titles[k]=v});
    const ms=d&&d.months&&typeof d.months==='object'?d.months:{};
    Object.keys(ms).filter(k=>/^\d{4}-(0[1-9]|1[0-2])$/.test(k)).slice(0,60).forEach(k=>{
      const m={};SECS.forEach(([s])=>{m[s]=(Array.isArray(ms[k][s])?ms[k][s]:[]).slice(0,MAXROWS).map(r=>R(clean(r&&r.item),clean(r&&r.stock),clean(r&&r.buy)))});out.months[k]=m});
    return out;
  }
  function ready(){return !!O.doc}
  async function load(){
    if(O.doc||O.loading)return;
    if(!LIVE){state.office=state.office||demoDoc();O.doc=state.office;return}
    if(!sb())return;
    O.loading=true;
    const r=await sb().from('app_settings').select('value').eq('key',KEY);
    O.loading=false;
    if(r.error){O.status='Could not load the list.';return repaint()}
    O.doc=r.data&&r.data[0]?sanitize(r.data[0].value):liveSeed();
    if(!keys().length)O.doc=liveSeed();
    repaint();
  }
  function repaint(){const t=state.tab&&state.tab[state.role];if(t==='stationery'||t==='dash')render()}
  function save(){
    if(!isAdm())return;
    if(!LIVE){state.office=O.doc;O.status='Saved (sample mode, kept until you reload).';paintStatus();return}
    O.status='Saving…';paintStatus();clearTimeout(O.t);
    O.t=setTimeout(async()=>{
      const r=await sb().from('app_settings').upsert({key:KEY,value:O.doc});
      O.status=r.error?'Could not save. Check your connection and try again.':'All changes saved.';paintStatus();
    },700);
  }
  const paintStatus=()=>{const e=$('#ofStatus');if(e)e.textContent=O.status};
  setInterval(()=>{const u=state.user?state.user.id:null;if(u!==O.uid){O.uid=u;if(LIVE){O.doc=null;O.month=null;O.status=''}}},700);

  /* ---------- page ---------- */
  const css=document.createElement('style');
  css.textContent=`
  .ofwrap{display:grid;gap:10px}
  .oftool{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  .oftool .grow{flex:1}.oftool #ofStatus{font-size:12.5px;color:var(--muted)}
  .ofsheet{background:#fff;color:#111;border:1px solid #111;border-radius:2px;overflow:hidden}
  .ofsheet h3.oft{margin:0;text-align:center;font-size:26px;font-weight:700;text-decoration:underline;padding:6px 8px;border-bottom:2px solid #111;color:#111}
  .ofgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
  .ofcol{border-right:2px solid #111;min-width:0}.ofcol:last-child{border-right:0}
  .ofh,.ofr{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,.9fr) minmax(0,.9fr)}
  .ofh.adm,.ofr.adm{grid-template-columns:minmax(0,2fr) minmax(0,.9fr) minmax(0,.9fr) 30px}
  .ofh{border-bottom:2px solid #111;align-items:end;padding-top:14px}
  .oftitle{border:0;background:transparent;color:#111;font:inherit;font-size:21px;font-weight:700;text-decoration:underline;padding:0 6px 4px;min-height:0;width:100%;border-radius:0;box-shadow:none}
  .oftitle:focus{outline:2px solid #1f7a4d;outline-offset:-2px;background:#f4fbf7}
  .ofh b{font-size:21px;text-decoration:underline;padding:0 6px 4px;line-height:1.15;color:#111}
  .ofh span{font-size:14px;font-weight:700;text-decoration:underline;padding:0 6px 4px;border-left:2px solid #111;color:#111}
  .ofh span+span{border-left:2px solid #111}
  .ofr{border-bottom:1px solid #e3e6ee;min-height:34px}
  .ofr>*{min-width:0}
  .ofr .it{text-align:center;padding:7px 6px;font-size:14.5px;overflow-wrap:anywhere}
  .ofr .c{padding:7px 6px;font-size:14.5px;border-left:2px solid #111;overflow-wrap:anywhere}
  .ofr .c+.c{border-left:2px solid #111}
  .ofr.buy .c.b{background:#fff4cc}
  .ofr input{width:100%;border:0;background:transparent;color:#111;font:inherit;font-size:14.5px;padding:7px 6px;min-height:34px;border-radius:0;box-shadow:none}
  .ofr input.it{text-align:center}
  .ofr input:focus{outline:2px solid #1f7a4d;outline-offset:-2px;background:#f4fbf7}
  .ofr .c.in{padding:0;border-left:2px solid #111}
  .ofr .x{border:0;background:transparent;color:#a33;font-size:16px;cursor:pointer;min-height:34px;padding:0}
  .ofr .x:hover{background:#fde8e6}
  .ofadd{display:block;width:100%;border:0;border-top:1px dashed #bbb;background:#fafafa;color:#1f5fbf;padding:8px;font:inherit;font-size:13px;cursor:pointer;min-height:40px}
  .ofadd:hover{background:#eef4ff}
  .ofpad{min-height:20px}
  .oftabs{display:flex;gap:2px;align-items:flex-end;background:#e9ecf1;border:1px solid #cfd4de;padding:4px 8px 0;border-radius:0 0 8px 8px;overflow-x:auto;-webkit-overflow-scrolling:touch}
  .oftabs button{border:0;background:transparent;color:#333;padding:8px 16px;font:inherit;font-size:14px;cursor:pointer;min-height:38px;white-space:nowrap;border-radius:6px 6px 0 0}
  .oftabs button:hover{background:#f6f7fa}
  .oftabs button[aria-selected=true]{background:#fff;color:#1f7a4d;font-weight:700;box-shadow:0 -2px 0 #1f7a4d inset}
  .oftabs .plus{font-size:20px;line-height:1;padding:6px 14px}
  @media (max-width:900px){
    .ofgrid{grid-template-columns:1fr}
    .ofcol{border-right:0;border-bottom:2px solid #111}.ofcol:last-child{border-bottom:0}
    .ofsheet h3.oft{font-size:22px}
  }
  @media print{.oftool,.oftabs{display:none!important}}
  `;
  document.head.appendChild(css);

  function colHTML([k],rows,adm){const title=titleOf(k);
    return `<div class="ofcol"><div class="ofh ${adm?'adm':''}">${adm?`<input class="oftitle" data-of="title" data-s="${k}" value="${esc(title)}" maxlength="${MAXLEN}" aria-label="Section name">`:`<b>${esc(title)}</b>`}<span>In Stock</span><span>To Buy</span>${adm?'<i></i>':''}</div>
      ${rows.map((r,i)=>adm?
        `<div class="ofr adm ${r.buy.trim()?'buy':''}"><input class="it" data-of="item" data-s="${k}" data-i="${i}" value="${esc(r.item)}" maxlength="${MAXLEN}" title="${esc(r.item)}" aria-label="${esc(title)} item ${i+1}"><span class="c in"><input data-of="stock" data-s="${k}" data-i="${i}" value="${esc(r.stock)}" maxlength="${MAXLEN}" aria-label="In stock: ${esc(r.item)}"></span><span class="c in b"><input data-of="buy" data-s="${k}" data-i="${i}" value="${esc(r.buy)}" maxlength="${MAXLEN}" aria-label="To buy: ${esc(r.item)}"></span><button type="button" class="x" data-act="ofDel" data-s="${k}" data-i="${i}" aria-label="Remove ${esc(r.item)}" title="Remove">×</button></div>`
        :`<div class="ofr ${r.buy.trim()?'buy':''}"><div class="it">${esc(r.item)}</div><div class="c">${esc(r.stock)}</div><div class="c b">${esc(r.buy)}</div></div>`).join('')}
      ${adm?(rows.length<MAXROWS?`<button type="button" class="ofadd" data-act="ofAdd" data-s="${k}">+ Add an item</button>`:''):'<div class="ofpad"></div>'}</div>`;
  }
  function vOffice(){
    const adm=isAdm();
    if(!ready())load();
    if(!ready()){return `<h2>Stationery list</h2><div class="panel"><p class="note">${esc(O.status||'Loading the list…')}</p></div>`}
    const m=sheet(),ks=keys();
    return `<div class="ofwrap"><div class="oftool"><h2 style="margin:0">Stationery list</h2><span class="grow"></span><span id="ofStatus" role="status">${esc(O.status)}</span>
      ${O.undo?'<button class="btn sm" type="button" data-act="ofUndo">Undo</button>':''}${adm?'<button class="btn sm ghost" type="button" data-act="ofClear">Clear stock and to buy</button><button class="btn sm ghost" type="button" data-act="ofDelMonth">Delete this month</button>':''}<button class="btn sm ghost" type="button" data-act="ofCsv">Download CSV</button><button class="btn sm ghost" type="button" data-act="ofPrint">Print</button></div>
      <p class="sub" style="margin:0">${adm?'Everything here is editable: click any cell or heading to type, clear a cell to erase it, use × to remove a row. Changes save by themselves, and Undo brings back the last removal. Items with something under To Buy are highlighted.':'This is the office list for the month. Items with something under To Buy are highlighted. An administrator keeps it up to date.'}</p>
      <div><div class="ofsheet"><h3 class="oft">Office Essentials</h3><div class="ofgrid">${SECS.map(s=>colHTML(s,m[s[0]],adm)).join('')}</div></div>
      <div class="oftabs" role="tablist" aria-label="Months">${ks.map(k=>`<button type="button" role="tab" data-act="ofTab" data-k="${k}" aria-selected="${k===cur()}">${esc(label(k))}</button>`).join('')}${adm?'<button type="button" class="plus" data-act="ofMonth" aria-label="Add next month" title="Add next month (copies the item names)">+</button>':''}</div></div></div>`;
  }
  VIEWS.stationery=vOffice;

  /* ---------- outputs ---------- */
  function rowsOut(){const m=sheet()||{};const out=[];SECS.forEach(([k])=>(m[k]||[]).forEach(r=>out.push([titleOf(k),r.item,r.stock,r.buy])));return out}
  function csv(){const q=v=>'"'+String(v).replace(/"/g,'""')+'"';return [['Section','Item','In stock','To buy']].concat(rowsOut()).map(r=>r.map(q).join(',')).join('\r\n')}
  function printHTML(){
    const m=sheet(),mx=Math.max(...SECS.map(([k])=>m[k].length));
    const th=SECS.map(([k])=>`<th class="t">${esc(titleOf(k))}</th><th>In Stock</th><th>To Buy</th>`).join('');
    let body='';for(let i=0;i<mx;i++)body+='<tr>'+SECS.map(([k])=>{const r=m[k][i];return r?`<td class="i">${esc(r.item)}</td><td>${esc(r.stock)}</td><td>${esc(r.buy)}</td>`:'<td></td><td></td><td></td>'}).join('')+'</tr>';
    return `<!doctype html><html><head><meta charset="utf-8"><title>Office Essentials ${esc(label(cur()))}</title><style>body{font-family:Arial,sans-serif;margin:18px}h1{text-align:center;text-decoration:underline;font-size:22px;margin:0 0 10px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #999;padding:3px 5px;text-align:left}th{border-bottom:2px solid #000}th.t{font-size:13px}td.i{text-align:center;border-left:2px solid #000}@media print{@page{size:landscape;margin:10mm}}</style></head><body><h1>Office Essentials, ${esc(label(cur()))}</h1><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  }
  /* shared with the assistant and the dashboard */
  window.VIRTUOSO_OFFICE={
    load:async()=>{await load();return ready()},
    toBuy:()=>{const m=ready()&&sheet();return m?SECS.flatMap(([k])=>m[k].filter(r=>r.buy.trim()).map(r=>`${r.item}: ${r.buy.trim()}`)):[]},
    buyCount:()=>{if(!ready()){load();return null}return window.VIRTUOSO_OFFICE.toBuy().length},
    monthLabel:()=>cur()?label(cur()):''
  };

  /* ---------- events ---------- */
  document.addEventListener('input',e=>{
    const t=e.target;if(!t||!t.dataset||!t.dataset.of||!isAdm()||!ready())return;
    e.stopImmediatePropagation();O.undo=null;
    if(t.dataset.of==='title'){O.doc.titles=O.doc.titles||{};O.doc.titles[t.dataset.s]=clean(t.value);save();return}
    const m=sheet(),row=m&&m[t.dataset.s]&&m[t.dataset.s][+t.dataset.i];if(!row)return;
    row[t.dataset.of]=clean(t.value);
    const el=t.closest('.ofr');if(el)el.classList.toggle('buy',!!row.buy.trim());
    save();
  },true);
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="of"]');if(!b)return;
    const a=b.dataset.act;if(!['ofTab','ofAdd','ofDel','ofMonth','ofCsv','ofPrint','ofClear','ofDelMonth','ofUndo'].includes(a))return;
    e.stopImmediatePropagation();
    if(a==='ofTab'){O.month=b.dataset.k;return render()}
    if(!ready())return;
    if(a==='ofCsv'){
      const url=URL.createObjectURL(new Blob([csv()],{type:'text/csv'}));const x=document.createElement('a');x.href=url;x.download='office-essentials-'+cur()+'.csv';document.body.appendChild(x);x.click();x.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
    }
    if(a==='ofPrint'){const w=window.open('','_blank');if(!w){toast('Allow pop-ups to print');return}w.document.write(printHTML());w.document.close();w.focus();setTimeout(()=>w.print(),300);return}
    if(!isAdm())return;
    const snap=()=>{O.undo=JSON.stringify({doc:O.doc,month:O.month})};
    if(a==='ofUndo'){if(!O.undo)return;const u=JSON.parse(O.undo);O.doc=sanitize(u.doc);O.month=u.month;O.undo=null;save();return render()}
    const m=sheet();
    if(a==='ofClear'){if(!confirm('Erase every In Stock and To Buy entry for '+label(cur())+'? Item names stay.'))return;snap();SECS.forEach(([k])=>m[k].forEach(r=>{r.stock='';r.buy=''}));save();return render()}
    if(a==='ofDelMonth'){const ks=keys();if(ks.length<2){toast('Keep at least one month. You can clear it instead.');return}
      if(!confirm('Delete the whole '+label(cur())+' sheet? You can press Undo straight afterwards.'))return;snap();delete O.doc.months[cur()];O.month=null;save();return render()}
    if(a==='ofAdd'){const rows=m[b.dataset.s];if(rows.length>=MAXROWS)return;rows.push(R(''));save();render();
      setTimeout(()=>{const l=document.querySelectorAll('[data-of=item][data-s="'+b.dataset.s+'"]');if(l.length)l[l.length-1].focus()},30);return}
    if(a==='ofDel'){const rows=m[b.dataset.s],i=+b.dataset.i,r=rows[i];if(!r)return;
      if((r.item||r.stock||r.buy)&&!confirm('Remove "'+(r.item||'this row')+'" from this month?'))return;
      snap();rows.splice(i,1);save();return render()}
    if(a==='ofMonth'){
      const ks=keys(),last=ks[ks.length-1],d=new Date(last+'-01T00:00:00');d.setMonth(d.getMonth()+1);const nk=ym(d);
      if(O.doc.months[nk]){O.month=nk;return render()}
      if(!confirm('Add '+label(nk)+'? It copies the item names from '+label(last)+' with empty In Stock and To Buy.'))return;
      O.doc.months[nk]=blankOf(O.doc.months[last]);O.month=nk;save();return render();
    }
  },true);
})();
