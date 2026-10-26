/* Petty cash page: record cash taken, settle it, and keep scanned documents in month folders.
   Folders per month: LFT (Losper Family Trust) and Virtuoso, each with Bank and Cash.
   Live mode uses the database + private storage (admin only). Demo mode keeps files in memory. */
(function(){
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO.client;
  const ENTITIES=[['LFT','LFT (Losper Family Trust)'],['VIRTUOSO','Virtuoso']],KINDS=[['bank','Bank'],['cash','Cash']];
  const MAX=10*1024*1024,OK=/^(application\/pdf|image\/jpeg|image\/png)$/;
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const parse=s=>new Date(s+'T00:00:00');
  const addD=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return iso(d)};
  const fd=s=>parse(String(s).slice(0,10)).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  const money=n=>typeof NAD==='function'?NAD(n):'N$ '+(+n||0).toFixed(2);
  const f2=n=>(Math.round(n*100)/100).toFixed(2);
  const kb=n=>n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
  const isAdm=()=>state.user&&state.user.type==='admin';
  const err=(id,m)=>{const el=$('#'+id);if(el)el.textContent=m||''};
  const nowKey=()=>LIVE?iso(new Date()).slice(0,7):curMonth();
  const monthsList=()=>{const out=[],end=(()=>{const t=parse(nowKey()+'-01');t.setMonth(t.getMonth()+1);const k=iso(t).slice(0,7);return k>'2027-02'?k:'2027-02'})();
    let y=2026,m=3;while((y+'-'+pad(m))<=end){out.push(y+'-'+pad(m));if(++m>12){m=1;y++}}return out};
  const defMonth=()=>{const l=monthsList(),k=nowKey();return l.includes(k)?k:l[l.length-1]};
  const fresh=()=>({msg:'',uid:null,adv:null,loadA:false,people:null,month:null,docs:null,loadD:false,busy:false});
  let S=fresh();
  if(!state.pcDocs)state.pcDocs=[];
  const month=()=>S.month||(S.month=defMonth());

  /* ---------- Folders ---------- */
  async function loadDocs(){
    if(!LIVE||S.loadD)return;S.loadD=true;
    const {data,error}=await sb().from('petty_documents').select('*').eq('month',month()+'-01').order('created_at',{ascending:false});
    S.loadD=false;S.docs=error?[]:data;render();
  }
  const docsFor=(e,k)=>LIVE?(S.docs||[]).filter(d=>d.entity===e&&d.kind===k):state.pcDocs.filter(d=>d.month===month()&&d.entity===e&&d.kind===k);
  function foldersHTML(){
    if(LIVE&&S.docs===null)loadDocs();
    const m=month();
    return `<div class="panel" id="pfPanel"><h3>Scanned documents</h3>
    <p class="note" style="margin-top:0">Upload scanned bank and cash documents into the month's folders. PDF, JPG or PNG, up to 10 MB each.${LIVE?'':' (Sample mode: files stay in this browser tab only.)'}</p>
    <label style="max-width:260px">Month<select id="pfMonth" aria-label="Month">${monthsList().map(k=>`<option value="${k}" ${k===m?'selected':''}>${esc(monthLabel(k))}</option>`).join('')}</select></label>
    <div class="err" id="pfMsg" role="alert">${esc(S.msg||'')}</div>
    ${ENTITIES.map(([ek,el])=>`<div style="margin-top:14px"><b>${esc(el)}</b>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:8px">
      ${KINDS.map(([kk,kl])=>{const list=docsFor(ek,kk);return `<div style="border:1px solid var(--line);border-radius:10px;padding:12px">
        <div class="row" style="justify-content:space-between"><b>${esc(kl)} folder</b><span class="note">${list.length} file${list.length===1?'':'s'}</span></div>
        <div class="note" style="margin:2px 0 8px">${esc(monthLabel(m))} / ${esc(el)} / ${esc(kl)}</div>
        <button class="btn sm" type="button" data-act="pfPick" data-e="${ek}" data-k="${kk}">Upload scans</button>
        <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" data-pfup="${ek}|${kk}" hidden aria-label="Upload scans to ${esc(el)} ${esc(kl)}">
        ${list.length?`<ul style="list-style:none;margin:10px 0 0;padding:0">${list.map(d=>`<li style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--line)">
          <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(d.name)}">${esc(d.name)}<span class="note"> ${d.size?kb(d.size)+', ':''}${esc(fd(d.created_at||d.at))}</span></span>
          <span class="row" style="flex:none"><button class="btn ghost sm" type="button" data-act="pfOpen" data-id="${esc(d.id)}">Open</button><button class="btn ghost sm" type="button" data-act="pfDel" data-id="${esc(d.id)}">Delete</button></span></li>`).join('')}</ul>`
          :'<p class="note" style="margin:10px 0 0">Empty.</p>'}</div>`}).join('')}
      </div></div>`).join('')}</div>`;
  }
  const lockAll=on=>document.querySelectorAll('#view button').forEach(b=>{b.disabled=on});
  const safeName=n=>n.replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^\.+/,'').slice(-90)||'scan';
  const guess=f=>f.type||(/\.pdf$/i.test(f.name)?'application/pdf':/\.png$/i.test(f.name)?'image/png':/\.jpe?g$/i.test(f.name)?'image/jpeg':'');

  async function upload(ek,kk,files){
    if(S.busy)return;S.busy=true;lockAll(true);S.msg='';err('pfMsg','');
    const msgs=[];let done=0;const m=month();
    for(const f of files){
      const mime=guess(f);
      if(!OK.test(mime)){msgs.push(f.name+': only PDF, JPG or PNG files.');continue}
      if(f.size>MAX){msgs.push(f.name+': larger than 10 MB.');continue}
      if(f.size===0){msgs.push(f.name+': the file is empty.');continue}
      try{
        if(LIVE){
          const path=`petty/${m}/${ek}/${kk}/${crypto.randomUUID()}-${safeName(f.name)}`;
          const up=await sb().storage.from('documents').upload(path,f,{contentType:mime,upsert:false});
          if(up.error)throw new Error('upload');
          const ins=await sb().from('petty_documents').insert({month:m+'-01',entity:ek,kind:kk,storage_path:path,name:f.name,size:f.size,mime});
          if(ins.error){await sb().storage.from('documents').remove([path]);throw new Error('save')}
        }else state.pcDocs.unshift({id:uid(),month:m,entity:ek,kind:kk,name:f.name,size:f.size,mime,url:URL.createObjectURL(f),at:new Date().toISOString()});
        done++;
      }catch(x){msgs.push(f.name+': could not be uploaded. Try again.')}
    }
    S.busy=false;lockAll(false);
    if(done){S.docs=null;toast(done+' file'+(done>1?'s':'')+' uploaded')}
    S.msg=msgs.join(' ');render();
  }
  async function openDoc(id){
    if(!LIVE){const d=state.pcDocs.find(x=>x.id===id);if(d)window.open(d.url,'_blank');return}
    const d=(S.docs||[]).find(x=>x.id===id);if(!d)return;
    const w=window.open('','_blank');
    const {data,error}=await sb().storage.from('documents').createSignedUrl(d.storage_path,60);
    if(error||!data){if(w)w.close();return toast('Could not open the file.')}
    if(w){w.opener=null;w.location=data.signedUrl}else toast('Allow pop-ups to open files.');
  }
  async function delDoc(id){
    const d=LIVE?(S.docs||[]).find(x=>x.id===id):state.pcDocs.find(x=>x.id===id);if(!d||!confirm('Delete '+d.name+'? This cannot be undone.'))return;
    if(!LIVE){if(d.url)URL.revokeObjectURL(d.url);state.pcDocs=state.pcDocs.filter(x=>x.id!==id);toast('File deleted');return render()}
    const r=await sb().from('petty_documents').delete().eq('id',id);
    if(r.error)return toast('Could not delete the file.');
    await sb().storage.from('documents').remove([d.storage_path]);
    S.docs=null;toast('File deleted');render();
  }

  /* ---------- Live petty cash (cash taken) ---------- */
  async function loadAdv(){
    if(S.loadA||!LIVE)return;S.loadA=true;
    const a=await sb().from('cash_advances').select('*').order('taken_at',{ascending:false}).limit(500);
    const p=await sb().from('profiles').select('id,name,title,role,access_enabled');
    S.loadA=false;S.adv=a.error?[]:a.data;S.people=p.error?[]:p.data;render();
  }
  const today=()=>iso(new Date());
  const isOver=a=>a.status==='Open'&&today()>addD(a.taken_on,1);
  const stat=a=>a.status==='Open'?(isOver(a)?['Overdue, change not reported','bad']:['Open, change due by '+fd(addD(a.taken_on,1)),'warn']):a.status==='Settled'?['Settled','ok']:['Settled with difference','bad'];
  function vCashLive(){
    if(S.adv===null)loadAdv();
    const adm=isAdm(),me=state.user,adv=S.adv||[],ppl=S.people||[],nm=Object.fromEntries(ppl.map(p=>[p.id,p.name]));
    nm[me.id]=nm[me.id]||me.name;
    const cur=today().slice(0,7),month_=adv.filter(a=>a.taken_on.slice(0,7)===cur),settled=month_.filter(a=>a.status!=='Open');
    const open=adv.filter(a=>a.status==='Open'),od=adv.filter(isOver),diffs=adv.filter(a=>a.status==='Settled with difference');
    const rows=adv.map(a=>{const [st,c]=stat(a),done=a.status!=='Open';
      const settle=!done?`<form class="settle" id="pfSettle-${esc(a.id)}"><div class="row"><input name="spent" type="number" min="0" max="${a.amount}" step="0.01" placeholder="Spent" aria-label="Amount spent" style="width:92px"><input name="ret" type="number" min="0" step="0.01" placeholder="Change back" aria-label="Change returned" style="width:108px"><button class="btn sm" type="submit">Settle</button></div><div class="note" id="pfCalc-${esc(a.id)}">Enter what was spent to see the change due back.</div></form>`:'';
      return `<tr><td>${esc(fd(a.taken_on))}<div class="note">${a.taken_at?esc(new Date(a.taken_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})):''}</div></td>${adm?`<td>${esc(nm[a.user_id]||'Unknown')}</td>`:''}<td>${esc(a.purpose||'')}</td><td class="n">${f2(a.amount)}</td>
        <td class="n">${done?f2(a.spent):'-'}</td><td class="n">${done?f2(a.expected):'-'}</td><td class="n">${done?f2(a.returned):'-'}</td><td class="n">${done?(+a.diff===0?'0.00':(a.diff>0?'+':'')+f2(a.diff)):'-'}</td>
        <td>${pill(st,c)}</td><td>${settle}</td></tr>`}).join('');
    const byPerson=adm?`<div class="panel"><h3>Who has taken cash</h3><div class="tbl"><table style="min-width:560px"><thead><tr><th>Employee</th><th class="n">Taken this month</th><th class="n">Still to settle</th><th>Status</th><th>Last taken</th></tr></thead><tbody>
      ${ppl.filter(p=>p.access_enabled&&p.role==='emp').map(p=>{const mine=adv.filter(a=>a.user_id===p.id),op=mine.filter(a=>a.status==='Open'),o=mine.filter(isOver),last=mine[0];
        return `<tr><td>${esc(p.name)}<div class="note">${esc(p.title||'')}</div></td><td class="n">${f2(mine.filter(a=>a.taken_on.slice(0,7)===cur).reduce((s,a)=>s+ +a.amount,0))}</td><td class="n">${f2(op.reduce((s,a)=>s+ +a.amount,0))}</td>
        <td>${o.length?pill(o.length+' not reported','bad'):op.length?pill('Open','warn'):pill('Clear','ok')}</td><td class="note">${last?esc(fd(last.taken_on))+', '+money(last.amount):'Never'}</td></tr>`}).join('')||'<tr><td colspan="5" class="note">No employees yet.</td></tr>'}
      </tbody></table></div></div>`:'';
    return `<h2>Petty cash</h2><p class="sub">Record every time petty cash is taken. Afterwards, record what was spent and the change brought back. The app works out the change due. If change is not reported by the end of the next day, it shows as overdue.</p>
    <div class="stack"><div class="tiles">
      <div class="tile"><b>${money(month_.reduce((s,a)=>s+ +a.amount,0))}</b><span>Taken in ${esc(monthLabel(cur))}</span></div>
      <div class="tile"><b>${money(settled.reduce((s,a)=>s+ +a.spent,0))}</b><span>Spent, reported</span></div>
      <div class="tile"><b>${money(settled.reduce((s,a)=>s+ +a.returned,0))}</b><span>Change returned</span></div>
      <div class="tile"><b>${money(open.reduce((s,a)=>s+ +a.amount,0))}</b><span>Still to settle</span><small>${open.length} open</small></div>
      <div class="tile"><b style="color:${od.length?'var(--bad)':'inherit'}">${od.length}</b><span>Change not reported</span></div>
      <div class="tile"><b style="color:${diffs.length?'var(--bad)':'inherit'}">${diffs.length}</b><span>Settled with a difference</span></div></div>
    ${adm?foldersHTML():''}${byPerson}
    <div class="panel"><h3>Record cash taken</h3><form class="form" id="pfCashForm" novalidate>
      ${adm?`<label>Taken by<select id="pfWho">${ppl.filter(p=>p.access_enabled).map(p=>`<option value="${esc(p.id)}" ${p.id===me.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>`
        :`<label>Your name<input value="${esc(me.name)}" readonly aria-readonly="true"></label>`}
      <label>Amount (N$)<input id="pfAmt" type="number" min="1" step="0.01"></label>
      <label>What it is for<input id="pfWhy" placeholder="e.g. Courier and fuel" maxlength="200"></label>
      <button class="btn" type="submit">Record cash taken</button></form><div class="err" id="pfErr" role="alert"></div></div>
    <div class="panel"><h3>${adm?'All cash taken':'My cash taken'}</h3><div class="tbl"><table style="min-width:${adm?1120:1000}px"><thead><tr><th>When</th>${adm?'<th>Employee</th>':''}<th>For</th><th class="n">Taken</th><th class="n">Spent</th><th class="n">Change due</th><th class="n">Change back</th><th class="n">Difference</th><th>Status</th><th>Settle</th></tr></thead><tbody>
      ${rows||`<tr><td colspan="${adm?10:9}" class="note">${S.adv===null?'Loading…':'No cash taken yet.'}</td></tr>`}</tbody></table></div></div></div>`;
  }

  /* ---------- Wire the views ---------- */
  if(LIVE)VIEWS.cash=vCashLive;
  else{const base=VIEWS.cash;VIEWS.cash=()=>{let h=base();
    if(isAdm()){const k='<div class="panel"><h3>Record cash taken</h3>';h=h.replace(k,foldersHTML()+k)}return h}}

  setInterval(()=>{const u=state.user?state.user.id:null;if(u!==S.uid){const m=S.month;S=fresh();S.uid=u;S.month=m}},700);

  /* ---------- Events (capture phase so they win over the demo handlers) ---------- */
  document.addEventListener('change',e=>{
    const t=e.target;
    if(t.id==='pfMonth'){e.stopImmediatePropagation();S.msg='';S.month=t.value;S.docs=null;return render()}
    if(t.dataset&&t.dataset.pfup){e.stopImmediatePropagation();const [ek,kk]=t.dataset.pfup.split('|'),fs=[...t.files];t.value='';if(fs.length)upload(ek,kk,fs)}
  },true);
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="pf"]');if(!b)return;
    e.stopImmediatePropagation();
    const d=b.dataset;
    if(d.act==='pfPick'){const i=document.querySelector(`[data-pfup="${d.e}|${d.k}"]`);if(i)i.click();return}
    if(d.act==='pfOpen')return openDoc(d.id);
    if(d.act==='pfDel')return delDoc(d.id);
  },true);

  if(!LIVE)return;
  document.addEventListener('input',e=>{
    const sf=e.target.closest&&e.target.closest('form.settle');if(!sf||!sf.id.startsWith('pfSettle-'))return;
    e.stopImmediatePropagation();
    const a=(S.adv||[]).find(x=>x.id===sf.id.slice(9)),box=document.getElementById('pfCalc-'+a.id);if(!a||!box)return;
    const sp=sf.elements.spent.value===''?null:Math.round(+sf.elements.spent.value*100)/100;
    if(sp===null)box.textContent='Enter what was spent to see the change due back.';
    else if(sp>a.amount)box.textContent='Spent is more than the amount taken.';
    else{const exp=Math.round((a.amount-sp)*100)/100;box.textContent='Change due back: '+money(exp)+(sf.elements.ret.value===''?'':Math.round((+sf.elements.ret.value-exp)*100)/100===0?'. Matches.':'. Difference: '+money(Math.round((+sf.elements.ret.value-exp)*100)/100))}
  },true);
  document.addEventListener('submit',async e=>{
    const f=e.target.id||'';
    if(f!=='pfCashForm'&&!f.startsWith('pfSettle-'))return;
    e.preventDefault();e.stopImmediatePropagation();
    if(S.busy)return;
    if(f==='pfCashForm'){
      const amt=Math.round(parseFloat($('#pfAmt').value)*100)/100,why=$('#pfWhy').value.trim();
      if(!(amt>=1))return err('pfErr','Enter an amount of N$ 1 or more.');if(!why)return err('pfErr','Say what the cash is for.');
      const row={amount:amt,purpose:why,taken_on:today()};if(isAdm()&&$('#pfWho'))row.user_id=$('#pfWho').value;
      S.busy=true;err('pfErr','');lockAll(true);
      const r=await sb().from('cash_advances').insert(row);
      S.busy=false;lockAll(false);
      if(r.error)return err('pfErr','Could not record that. Try again.');
      S.adv=null;toast('Cash recorded');return render();
    }
    const id=f.slice(9),a=(S.adv||[]).find(x=>x.id===id),el=e.target.elements;
    const sp=Math.round(parseFloat(el.spent.value)*100)/100,rt=Math.round(parseFloat(el.ret.value)*100)/100,box=document.getElementById('pfCalc-'+id);
    if(!(sp>=0)||!(rt>=0))return box.textContent='Enter both the amount spent and the change brought back.';
    if(sp>a.amount)return box.textContent='Spent is more than the amount taken.';
    S.busy=true;lockAll(true);
    const r=await sb().rpc('settle_advance',{p_id:id,p_spent:sp,p_returned:rt});
    S.busy=false;lockAll(false);
    if(r.error)return box.textContent=/already/i.test(r.error.message)?'That was already settled.':'Could not settle that. Try again.';
    S.adv=null;toast('Settled');render();
  },true);
})();
