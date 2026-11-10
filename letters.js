/* LETTERS: a section inside Client KYC where an administrator generates client letters on the firm's letterhead:
   Management representation letter, Letter of transmittal and Accountant's letter (compilation-style).
   Rule-based templates only: the wording is a starting point that the firm must review before sending.
   Nothing is saved to the database; download the finished letter or save it as PDF. Works in demo and live. */
(function(){
  const isAdm=()=>state.user&&state.user.type==='admin';
  const S=()=>window.VIRTUOSO_SETTINGS;
  const firm=k=>{const v=S()&&S().get(k);return v==null?'':String(v)};
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const todayISO=()=>(state.today&&/[?&]demo\b/.test(location.search))?state.today:iso(new Date());
  const long=s=>{if(!s)return '';const d=new Date(String(s).slice(0,10)+'T00:00:00');return isNaN(d)?String(s):d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})};
  const lastFYE=()=>{const t=new Date(todayISO()+'T00:00:00');const y=t.getMonth()>=2?t.getFullYear():t.getFullYear()-1;return iso(new Date(y,2,0))};
  const TYPES=[
    ['mgmt','Management representation letter','Written by the client\'s management to the firm, confirming the information given for the engagement. Print on the client\'s letterhead and have management sign it.'],
    ['trans','Letter of transmittal','From the firm to the client, sending the completed financial statements and listing what is enclosed.'],
    ['acct','Accountant\'s letter','From the firm, stating that the financial statements were compiled from the client\'s records and setting out the firm\'s and management\'s responsibilities.']];
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const isUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v));
  const SV={list:null,loading:false,busy:false,err:'',uid:null};
  const L={id:null,type:'mgmt',sub:'',client:'',contact:'',addr:'',entity:'company',fye:lastFYE(),date:todayISO(),ref:'',signName:'',signTitle:'',encl:'Annual financial statements\nTrial balance\nTax computation',extra:'',body:null,bodyFor:null,msg:''};

  const entityWord=()=>({company:'the company',cc:'the close corporation',trust:'the trust',individual:'you',other:'the entity'})[L.entity]||'the entity';
  const Entity=()=>{const w=entityWord();return w==='you'?'You':w.charAt(0).toUpperCase()+w.slice(1)};
  const period=()=>'the financial year ended '+long(L.fye);
  const firmName=()=>firm('firm_name')||'Virtuous Accounting Solutions CC';
  const signer=()=>L.signName||(state.user&&state.user.name)||'';
  const signTitle=()=>L.signTitle||(state.user&&state.user.title)||'';

  setInterval(()=>{const u=state.user?state.user.id:null;if(u!==SV.uid){SV.uid=u;SV.list=null;SV.err='';L.id=null}},700);
  const dbMsg=m=>/client_letters|schema cache|does not exist|relation/i.test(m||'')?'Saving needs migration 0016 (client_letters). Run it in the Supabase SQL editor, then try again.':/row-level|policy|permission|not permitted/i.test(m||'')?'You are not allowed to do that.':'Something went wrong. Try again.';
  const FIELDKEYS=['sub','client','contact','addr','entity','fye','date','ref','encl','extra','signName','signTitle'];
  const kindName=k=>(TYPES.find(x=>x[0]===k)||[k,k])[1];
  async function loadSaved(){
    if(SV.loading||SV.list!==null)return;
    if(!LIVE){SV.list=(state.letters||[]).slice().sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));return}
    if(!sb())return;
    SV.loading=true;
    const r=await sb().from('client_letters').select('id,kind,title,client_name,fields,body,created_at,updated_at').order('updated_at',{ascending:false}).limit(200);
    SV.loading=false;
    if(r.error){SV.err=dbMsg(r.error.message);SV.list=[]}else{SV.err='';SV.list=r.data||[]}
    if(state.kyc&&state.kyc.view==='letters')render();
  }
  async function saveLetter(asNew){
    if(SV.busy)return;
    if(!L.client){L.msg='Enter the client name before saving.';return render()}
    if(!L.body)currentBody();
    const fields={};FIELDKEYS.forEach(k=>{fields[k]=L[k]});
    const row={kind:L.type,title:kindName(L.type)+': '+L.client,client_name:L.client.slice(0,200),fields,body:L.body};
    if(isUuid(L.sub))row.submission_id=L.sub;
    SV.busy=true;L.msg='';
    if(!LIVE){
      state.letters=state.letters||[];const now=new Date().toISOString();
      const ex=!asNew&&L.id&&state.letters.find(x=>x.id===L.id);
      if(ex)Object.assign(ex,row,{updated_at:now});else{const n={id:uid(),created_at:now,updated_at:now,...row};state.letters.unshift(n);L.id=n.id}
      if(typeof logA==='function')logA('Letter saved',row.title);
    }else{
      let r;
      if(!asNew&&L.id)r=await sb().from('client_letters').update(row).eq('id',L.id).select('id').single();
      else r=await sb().from('client_letters').insert(row).select('id').single();
      if(r.error){SV.busy=false;L.msg=dbMsg(r.error.message);return render()}
      L.id=(r.data&&r.data.id)||L.id;
    }
    SV.busy=false;SV.list=null;toast('Letter saved');render();
  }
  function openSaved(id){
    const r=(SV.list||[]).find(x=>x.id===id);if(!r)return;
    L.type=r.kind;const f=r.fields||{};FIELDKEYS.forEach(k=>{if(f[k]!=null)L[k]=String(f[k])});
    L.body=r.body;L.bodyFor=JSON.stringify([L.type,L.client,L.contact,L.addr,L.entity,L.fye,L.encl,L.extra,L.signName,L.signTitle]);
    L.id=r.id;L.msg='';
  }
  async function deleteSaved(id){
    const r=(SV.list||[]).find(x=>x.id===id);if(!r||!confirm('Delete the saved letter "'+r.title+'"? This cannot be undone.'))return;
    if(!LIVE){state.letters=(state.letters||[]).filter(x=>x.id!==id)}
    else{const d=await sb().from('client_letters').delete().eq('id',id);if(d.error){SV.err=dbMsg(d.error.message);return render()}}
    if(L.id===id)L.id=null;SV.list=null;SV.err='';toast('Letter deleted');render();
  }
  const when=s=>{const d=new Date(s);return isNaN(d)?'':d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})+', '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})};

  /* ---------- the three templates (plain text; blank line = new paragraph) ---------- */
  function bodyText(){
    const client=L.client||'[Client name]',contact=L.contact||'Sir / Madam';
    if(L.type==='mgmt')return [
`The Partners
${firmName()}
${firm('firm_address')||'Windhoek, Namibia'}`,
`Dear Sirs`,
`MANAGEMENT REPRESENTATION LETTER: ${client.toUpperCase()}, ${period().toUpperCase()}`,
`This letter is provided in connection with your compilation of the financial statements of ${client} for ${period()}. We confirm, to the best of our knowledge and belief, having made the enquiries we considered necessary, the following representations:`,
`1. We acknowledge our responsibility for the preparation and fair presentation of the financial statements, and for the accounting records and supporting information on which they are based.
2. We have made available to you all accounting records, supporting documents, minutes and other information relevant to the preparation of the financial statements.
3. All transactions for the period have been recorded in the accounting records and are reflected in the financial statements.
4. We have disclosed to you all known actual or possible instances of non-compliance with laws and regulations whose effects should be considered when preparing the financial statements.
5. We have disclosed to you the identity of related parties and all related-party relationships and transactions of which we are aware.
6. We have no plans or intentions that may materially affect the carrying value or classification of assets and liabilities.
7. We have disclosed to you all events after the reporting date that require adjustment of, or disclosure in, the financial statements.
8. Provision has been made, where appropriate, for all known liabilities, losses and commitments, including taxation, at the reporting date.
9. The information provided for income tax, value-added tax and other statutory returns is complete and accurate.`,
`We understand that your compilation engagement does not constitute an audit or a review and that you express no assurance on the financial statements.`,
L.extra?L.extra:'',
`Yours faithfully`,
`______________________________
${contact!=='Sir / Madam'?contact:'[Name of director / member / trustee]'}
For and on behalf of ${client}
Date: ______________________`].filter(Boolean).join('\n\n');

    if(L.type==='trans')return [
`${client}
${L.addr||'[Client address]'}`,
`Dear ${contact}`,
`LETTER OF TRANSMITTAL: FINANCIAL STATEMENTS FOR ${period().toUpperCase()}`,
`We are pleased to send you the completed financial statements of ${client} for ${period()}, together with the documents listed below.`,
`Enclosed:
${(L.encl||'').split('\n').map(x=>x.trim()).filter(Boolean).map((x,i)=>`${i+1}. ${x}`).join('\n')||'1. Annual financial statements'}`,
`Please review the enclosed documents carefully. If the information agrees with your records and you are satisfied with the financial statements, kindly sign the approval page where indicated and return a signed copy to us for our files. If anything needs clarification or correction, let us know before signing so that we can attend to it.`,
`Once the financial statements have been approved, we will proceed with the related statutory submissions where you have engaged us to do so.`,
L.extra?L.extra:'',
`Please do not hesitate to contact us should you have any questions.`,
`Yours sincerely`,
`______________________________
${signer()}
${signTitle()}
${firmName()}`].filter(Boolean).join('\n\n');

    return [
`${client}
${L.addr||'[Client address]'}`,
`Dear ${contact}`,
`ACCOUNTANT'S LETTER: ${client.toUpperCase()}, ${period().toUpperCase()}`,
`We have compiled the accompanying financial statements of ${client} for ${period()}, comprising the statement of financial position, the statement of comprehensive income, the statement of changes in equity, the statement of cash flows and the notes, based on the information you have provided.`,
`Management is responsible for the accounting records and for the accuracy and completeness of the information used to compile the financial statements, and for the financial statements themselves. ${Entity()==='You'?'You are':'Management is'} also responsible for the design and implementation of internal controls relevant to the preparation of the financial statements.`,
`We performed this compilation engagement as accountants. We have not audited or reviewed the financial statements and, accordingly, we express no audit opinion or review conclusion on whether the financial statements are prepared in accordance with the applicable financial reporting framework.`,
`Our engagement was limited to applying accounting and financial reporting expertise to assist management in the preparation and presentation of the financial statements. The financial statements are prepared for the use of ${entityWord()==='you'?'you':'management of '+client} and the parties ${entityWord()==='you'?'you choose':'management chooses'} to share them with.`,
L.extra?L.extra:'',
`Yours faithfully`,
`______________________________
${signer()}
${signTitle()}
${firmName()}
${firm('firm_address')||'Windhoek, Namibia'}`].filter(Boolean).join('\n\n');
  }
  const currentBody=()=>{const key=JSON.stringify([L.type,L.client,L.contact,L.addr,L.entity,L.fye,L.encl,L.extra,L.signName,L.signTitle]);if(L.body===null||L.bodyFor!==key){L.body=bodyText();L.bodyFor=key}return L.body};

  /* ---------- letterhead document ---------- */
  function letterHTML(img){
    const D=window.VIRTUOSO_DOCS,esc=D.esc,t=TYPES.find(x=>x[0]===L.type);
    const paras=(L.body||'').split(/\n{2,}/).map(p=>{const h=esc(p).replace(/\n/g,'<br>');return /^[A-Z0-9' :,.\-&()\/]{12,}$/.test(p.split('\n')[0])&&p.split('\n').length===1?`<p class="hd2">${h}</p>`:`<p>${h}</p>`}).join('');
    const contact=[firm('firm_address'),firm('firm_phone')&&'Tel '+firm('firm_phone'),firm('firm_email')].filter(Boolean).join(' &middot; ');
    const reg=[firm('firm_reg')&&'Reg. no. '+firm('firm_reg'),firm('firm_vat')&&'VAT no. '+firm('firm_vat')].filter(Boolean).join(' &middot; ');
    const onClient=L.type==='mgmt';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(t[1])} - ${esc(L.client||'client')}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
@page{size:A4;margin:14mm 18mm}*{box-sizing:border-box}
body{margin:0;background:#e9ecf3;font:13px/1.6 "Segoe UI",Arial,Helvetica,sans-serif;color:#14213d;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:16mm 20mm}
@media print{body{background:#fff}.page{width:auto;min-height:0;margin:0;padding:0}}
.hd{display:flex;align-items:center;gap:16px;border-bottom:3px solid #c9a227;padding-bottom:12px}
.hd img{height:64px;width:auto;display:block}.hd .co{flex:1}.hd .co b{display:block;font-size:17px;color:#0f1f4d}.hd .co span{display:block;color:#5b6684;font-size:11.5px}
.hd .meta{text-align:right;font-size:12px;color:#5b6684}.hd .meta b{color:#0f1f4d}
.cl{margin:14px 0 6px;border:1px dashed #c9a227;background:#fff9e6;color:#6b5600;padding:6px 10px;font-size:11.5px}
p{margin:0 0 11px;white-space:pre-wrap}p.hd2{font-weight:700;color:#0f1f4d;letter-spacing:.3px}
.ft{margin-top:24px;border-top:1px solid #c8cfe0;padding-top:8px;font-size:11px;color:#6a7592;display:flex;justify-content:space-between;gap:10px}
</style></head><body><div class="page">
${onClient?`<div class="cl">Print this letter on the letterhead of ${esc(L.client||'the client')}. It is signed by the client's management and addressed to ${esc(firmName())}.</div>`
:`<div class="hd"><img src="${esc(img)}" alt="${esc(firmName())} logo"><div class="co"><b>${esc(firmName())}</b><span>${contact||'Windhoek, Namibia'}</span>${reg?`<span>${reg}</span>`:''}</div><div class="meta">${L.ref?'Our ref: <b>'+esc(L.ref)+'</b><br>':''}Date: <b>${esc(long(L.date))}</b></div></div>`}
${onClient?`<p style="text-align:right">Date: ${esc(long(L.date))}</p>`:'<div style="height:14px"></div>'}
${paras}
<div class="ft"><span>${onClient?esc(L.client||'')+' &middot; Confidential':esc(firmName())+' &middot; Confidential'}</span><span>${esc(t[1])}</span></div>
</div></body></html>`;
  }

  /* ---------- page ---------- */
  const css=document.createElement('style');
  css.textContent=`.ltw{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:14px;align-items:start}
  @media(max-width:1000px){.ltw{grid-template-columns:1fr}}
  .lttypes{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:12px}
  .lttypes button{text-align:left;border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:10px;padding:10px 12px;font:inherit;cursor:pointer;min-height:48px}
  .lttypes button[aria-pressed=true]{border-color:var(--accent);background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--accent)}
  .lttypes b{display:block}.lttypes span{font-size:12px;color:var(--muted)}
  #ltBody{width:100%;min-height:420px;font-family:var(--f-code,monospace);font-size:13px;line-height:1.5}`;
  document.head.appendChild(css);
  const opt=(list,cur)=>list.map(([v,l])=>`<option value="${esc(v)}" ${v===cur?'selected':''}>${esc(l)}</option>`).join('');
  function subOptions(){
    const subs=(state.subs||[]).slice().reverse();
    return '<option value="">Type the details yourself</option>'+subs.map(s=>{let n='';try{n=kNameOf(s)}catch(e){}return `<option value="${esc(s.id)}" ${s.id===L.sub?'selected':''}>${esc(s.ref||'')} ${esc(n)}</option>`}).join('');
  }
  function view(){
    if(!isAdm())return '<div class="panel"><p class="note">Only an administrator can generate client letters.</p></div>';
    if(S())S().load();
    const t=TYPES.find(x=>x[0]===L.type);
    return `<div class="lttypes" role="group" aria-label="Letter type">${TYPES.map(([k,n,d])=>`<button type="button" data-act="wlType" data-t="${k}" aria-pressed="${k===L.type}"><b>${esc(n)}</b><span>${esc(d)}</span></button>`).join('')}</div>
    <div class="ltw"><form class="panel form" id="ltForm" style="grid-template-columns:1fr 1fr" novalidate>
      <h3 class="wide" style="margin:0">Letter details</h3>
      <label class="wide">Start from a KYC submission<select id="ltSub">${subOptions()}</select></label>
      <label>Client name<input id="ltClient" value="${esc(L.client)}" maxlength="120" placeholder="e.g. Kalahari Mining Ltd"></label>
      <label>Entity type<select id="ltEntity">${opt([['company','Company'],['cc','Close corporation'],['trust','Trust'],['individual','Individual / sole trader'],['other','Other']],L.entity)}</select></label>
      <label>Addressed to (contact person)<input id="ltContact" value="${esc(L.contact)}" maxlength="120" placeholder="e.g. Mr J. Amupolo"></label>
      <label>Client address<textarea id="ltAddr" rows="2" maxlength="300">${esc(L.addr)}</textarea></label>
      <label>Financial year end<input id="ltFye" type="date" value="${esc(L.fye)}"></label>
      <label>Letter date<input id="ltDate" type="date" value="${esc(L.date)}"></label>
      <label>Our reference (optional)<input id="ltRef" value="${esc(L.ref)}" maxlength="60"></label>
      ${L.type==='trans'?`<label class="wide">Enclosed documents (one per line)<textarea id="ltEncl" rows="3" maxlength="600">${esc(L.encl)}</textarea></label>`:''}
      ${L.type!=='mgmt'?`<label>Signed by<input id="ltSign" value="${esc(L.signName)}" maxlength="100" placeholder="${esc((state.user&&state.user.name)||'')}"></label><label>Signatory title<input id="ltSignT" value="${esc(L.signTitle)}" maxlength="80" placeholder="${esc((state.user&&state.user.title)||'')}"></label>`:''}
      <label class="wide">Extra paragraph (optional)<textarea id="ltExtra" rows="2" maxlength="800" placeholder="Anything specific to this client">${esc(L.extra)}</textarea></label>
      <div class="wide note" style="margin:0">${L.id?'Editing a saved letter. ':''}The text is a template. Review it, edit it on the right if needed, then save it, preview, print, save as PDF or download.</div>
      <div class="wide row"><button class="btn" type="button" data-act="wlPreview">Preview and print</button><button class="btn" type="button" data-act="wlSave" ${SV.busy?'disabled':''}>${L.id?'Save changes':'Save letter'}</button>${L.id?'<button class="btn ghost" type="button" data-act="wlSaveNew">Save as new</button><button class="btn ghost" type="button" data-act="wlNew">Start a new letter</button>':''}<button class="btn ghost" type="button" data-act="wlRegen">Reset text to template</button><button class="btn ghost" type="button" data-act="wlCopy">Copy text</button></div>
    </form>
    <div class="panel"><div class="ph"><h3>${esc(t[1])}</h3><span class="note">Editable</span></div>
      <textarea id="ltBody" aria-label="Letter text" spellcheck="true">${esc(currentBody())}</textarea>
      <div class="err" id="ltErr" role="alert">${esc(L.msg)}</div></div></div>
    <div class="panel" style="margin-top:14px"><div class="ph"><h3>Saved letters</h3><span class="note">${LIVE?'Stored in the database':'Sample mode: kept until you reload'}</span></div>${savedHTML()}</div>`;
  }
  function savedHTML(){
    loadSaved();
    if(SV.err&&(SV.list||[]).length===0)return `<div class="err" role="alert">${esc(SV.err)}</div>`;
    if(SV.list===null)return '<p class="note" style="margin:0">Loading…</p>';
    if(!SV.list.length)return '<p class="note" style="margin:0">No saved letters yet. Fill in the details above and press Save letter.</p>';
    return `${SV.err?`<div class="err" role="alert">${esc(SV.err)}</div>`:''}<div class="tbl"><table style="min-width:620px"><thead><tr><th>Client</th><th>Letter</th><th>Year end</th><th>Last saved</th><th></th></tr></thead><tbody>
      ${SV.list.map(r=>`<tr class="${r.id===L.id?'sel':''}"><td>${esc(r.client_name)}</td><td>${esc(kindName(r.kind))}</td><td>${esc((r.fields&&r.fields.fye)?long(r.fields.fye):'')}</td><td class="note">${esc(when(r.updated_at))}</td>
      <td><div class="row"><button class="btn sm" data-act="wlOpen" data-id="${esc(r.id)}">Open</button><button class="btn sm ghost" data-act="wlView" data-id="${esc(r.id)}">Preview</button><button class="btn sm ghost bad" data-act="wlDel" data-id="${esc(r.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table></div>`;
  }

  /* Add a Letters tab to the KYC page without touching its code. */
  const kycView=VIEWS.kyc;
  VIEWS.kyc=function(){
    const K=state.kyc;
    if(K&&K.view==='letters'&&isAdm()){
      const tabs=`<div class="seg" role="tablist" style="margin-bottom:14px"><button class="btn ghost sm" data-k="go" data-v="forms" aria-pressed="false">Forms</button><button class="btn ghost sm" data-k="go" data-v="subs" aria-pressed="false">Submissions (${(state.subs||[]).length})</button><button class="btn ghost sm" data-k="go" data-v="letters" aria-pressed="true">Letters</button></div>`;
      return `<h2>Client letters</h2><p class="sub">A page inside Client KYC: generate the management representation letter, letter of transmittal and accountant's letter on the firm's letterhead.</p>${tabs}
      <div class="row" style="margin:-6px 0 12px"><button class="btn ghost sm" data-k="go" data-v="forms">&larr; Back to KYC</button></div>${view()}`;
    }
    let html=kycView();
    const K2=state.kyc;/* kInit() inside the original view creates state.kyc on the first visit */
    if(isAdm()&&K2&&(K2.view==='forms'||K2.view==='subs')){
      html=html.replace(/(Submissions \(\d+\)<\/button>)(<\/div>)/,'$1<button class="btn ghost sm" data-k="go" data-v="letters" aria-pressed="false">Letters</button>$2');
      if(K2.view==='forms')html=html.replace('<div class="stack">','<div class="stack"><div class="panel" style="border-left:4px solid var(--accent)"><div class="ph"><h3>Client letters</h3><button class="btn sm" data-k="go" data-v="letters">Open letters page</button></div><p class="note" style="margin:0">Generate a management representation letter, a letter of transmittal or an accountant\'s letter for a client, on the firm\'s letterhead, ready to print or save as PDF.</p></div>');
    }
    return html;
  };

  /* ---------- events ---------- */
  function readForm(){
    const g=id=>{const e=document.getElementById(id);return e?e.value:null};
    const set=(k,id)=>{const v=g(id);if(v!==null)L[k]=v.trim()};
    set('client','ltClient');set('contact','ltContact');set('addr','ltAddr');set('ref','ltRef');set('extra','ltExtra');set('signName','ltSign');set('signTitle','ltSignT');
    const en=g('ltEntity');if(en)L.entity=en;const fy=g('ltFye');if(fy)L.fye=fy;const dt=g('ltDate');if(dt)L.date=dt;const ec=g('ltEncl');if(ec!==null)L.encl=ec;
    const b=g('ltBody');if(b!==null){L.body=b;L.bodyFor=JSON.stringify([L.type,L.client,L.contact,L.addr,L.entity,L.fye,L.encl,L.extra,L.signName,L.signTitle])}
  }
  function fromSub(id){
    const s=(state.subs||[]).find(x=>x.id===id);if(!s)return;
    const f=typeof kForm==='function'?kForm(s.formId):null;
    try{L.client=kNameOf(s)||L.client}catch(e){}
    if(f){const title=(f.title||'').toLowerCase();L.entity=/company|pty/.test(title)?'company':/close corp|\bcc\b/.test(title)?'cc':/trust/.test(title)?'trust':/individual|sole/.test(title)?'individual':L.entity;
      const find=re=>{const x=f.fields.find(q=>re.test(q.label||'')&&s.ans&&s.ans[q.id]&&typeof s.ans[q.id]==='string');return x?s.ans[x.id]:''};
      L.addr=find(/address/i)||L.addr;const c=find(/contact person|authorised|representative|director|member|trustee/i);if(c)L.contact=c;}
    L.ref=s.ref||L.ref;L.body=null;
  }
  document.addEventListener('change',e=>{
    const t=e.target;if(!t||!/^lt/.test(t.id||''))return;
    e.stopImmediatePropagation();
    if(t.id==='ltSub'){L.sub=t.value;readForm();if(t.value)fromSub(t.value);L.body=null;return render()}
    if(t.id==='ltBody')return readForm();
    /* details changed: rebuild the text unless the admin edited it by hand (compare with what the old details produced) */
    const prevKey=L.bodyFor,el=document.getElementById('ltBody'),typed=el?el.value:null;
    readForm();
    if(t.id!=='ltRef'&&t.id!=='ltDate'&&(typed===null||typed===bodyTextFor(prevKey)))L.body=null;
    render();
  },true);
  const bodyTextFor=key=>{const saved={...L};try{const [type,client,contact,addr,entity,fye,encl,extra,signName,signTitle]=JSON.parse(key||'[]');Object.assign(L,{type,client,contact,addr,entity,fye,encl,extra,signName,signTitle});return bodyText()}catch(e){return null}finally{Object.assign(L,saved)}};
  document.addEventListener('click',async e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="wl"]');if(!b)return;
    const a=b.dataset.act;if(!['wlType','wlPreview','wlRegen','wlCopy','wlSave','wlSaveNew','wlNew','wlOpen','wlView','wlDel'].includes(a))return;
    e.stopImmediatePropagation();if(!isAdm())return;
    readForm();
    if(a==='wlType'){L.type=b.dataset.t;L.body=null;L.msg='';return render()}
    if(a==='wlRegen'){L.body=null;L.msg='';return render()}
    if(a==='wlCopy'){if(navigator.clipboard)navigator.clipboard.writeText(L.body||currentBody()).then(()=>toast('Letter text copied'),()=>toast('Copy failed'));return}
    if(a==='wlSave')return saveLetter(false);
    if(a==='wlSaveNew')return saveLetter(true);
    if(a==='wlNew'){L.id=null;L.body=null;L.msg='';return render()}
    if(a==='wlOpen'){openSaved(b.dataset.id);window.scrollTo(0,0);return render()}
    if(a==='wlDel')return deleteSaved(b.dataset.id);
    if(a==='wlView'){openSaved(b.dataset.id);render()}
    if(a==='wlPreview'||a==='wlView'){
      if(!L.client){L.msg='Enter the client name first.';return render()}
      if(!L.fye){L.msg='Choose the financial year end.';return render()}
      L.msg='';const D=window.VIRTUOSO_DOCS;if(!D){toast('Preview is not available');return}
      const t=TYPES.find(x=>x[0]===L.type);
      if(!L.body)currentBody();
      D.overlay(letterHTML(await D.logoData()),{title:t[1],name:t[1].replace(/'/g,'')+'-'+L.client+'-'+L.fye});
    }
  },true);
  window.VIRTUOSO_LETTERS={types:TYPES,text:()=>currentBody(),state:L};
})();
