/* LINKED APPS (Settings > Linked apps): the firm's own tools in one place: Zoho Books, Draftworx, Jotform, Google Drive,
   Zoho WorkDrive and others. An administrator saves each tool's web address (and a short note); everyone who is allowed
   sees an Open button. This stores SHORTCUTS ONLY: no data is synced, and no passwords, API keys or tokens are ever stored here.
   A real two-way connection (OAuth sign-in, pulling invoices, a Drive file picker) needs the tool's developer app and a
   server function, which is a separate piece of work.
   Stored as one JSON setting 'linked_apps' in app_settings (live: admin-write by RLS, audited, no migration; staff can read it)
   or in state.linkedApps (?demo). Web addresses must start with https://. */
(function(){
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const KEY='linked_apps';
  const isAdm=()=>state.user&&state.user.type==='admin';
  const CATS=[
    ['Accounting',[
      ['zoho_books','Zoho Books','Invoices, bills, banking and reports.','https://books.zoho.com'],
      ['draftworx','Draftworx','Annual financial statements and working papers.','https://www.draftworx.com'],
      ['xero','Xero','Cloud accounting.','https://go.xero.com'],
      ['quickbooks','QuickBooks Online','Cloud accounting.','https://qbo.intuit.com'],
      ['sage','Sage Business Cloud','Accounting and payroll.','https://www.sage.com']]],
    ['Forms',[
      ['jotform','Jotform','Online forms and submissions.','https://www.jotform.com/myforms/']]],
    ['Files and documents',[
      ['gdrive','Google Drive','Shared client and firm folders.','https://drive.google.com'],
      ['zoho_workdrive','Zoho WorkDrive','Team folders and documents.','https://workdrive.zoho.com'],
      ['onedrive','OneDrive / SharePoint','Microsoft 365 files.','https://onedrive.live.com'],
      ['dropbox','Dropbox','File sharing.','https://www.dropbox.com/home']]]
  ];
  const ALL=CATS.flatMap(c=>c[1]);
  const MAXC=12,L=80;
  const clean=(s,n)=>String(s==null?'':s).replace(/[\u0000-\u001f]/g,' ').slice(0,n||L);
  const okUrl=u=>{u=String(u||'').trim();if(!u)return '';if(u.length>400)return null;try{const x=new URL(u);return x.protocol==='https:'&&x.hostname.includes('.')?x.href:null}catch(e){return null}};
  const blank=()=>({apps:{},custom:[]});
  function sanitize(d){
    d=d&&typeof d==='object'?d:{};const out=blank();
    ALL.forEach(([id])=>{const a=d.apps&&d.apps[id];if(!a)return;const u=okUrl(a.url);out.apps[id]={url:u||'',note:clean(a.note,160),staff:!!a.staff}});
    (Array.isArray(d.custom)?d.custom:[]).slice(0,MAXC).forEach(c=>{const u=okUrl(c&&c.url);out.custom.push({name:clean(c&&c.name),url:u||'',note:clean(c&&c.note,160),staff:!!(c&&c.staff)})});
    return out;
  }
  const O={doc:null,loading:false,status:'',uid:null,t:null,bad:{}};
  async function load(){
    if(O.doc||O.loading)return;
    if(!LIVE){state.linkedApps=state.linkedApps||blank();O.doc=state.linkedApps;return}
    if(!sb())return;
    O.loading=true;
    const r=await sb().from('app_settings').select('value').eq('key',KEY);
    O.loading=false;
    if(r.error){O.status='Could not load the linked apps.';O.doc=blank()}else O.doc=r.data&&r.data[0]?sanitize(r.data[0].value):blank();
    if(state.tab&&state.tab[state.role]==='settings')render();
  }
  const paint=()=>{const e=$('#igStatus');if(e)e.textContent=O.status};
  function save(){
    if(!isAdm())return;
    if(!LIVE){state.linkedApps=O.doc;O.status='Saved (sample mode, kept until you reload).';paint();return}
    O.status='Saving…';paint();clearTimeout(O.t);
    O.t=setTimeout(async()=>{
      const r=await sb().from('app_settings').upsert({key:KEY,value:O.doc});
      O.status=r.error?'Could not save. Check your connection and try again.':'All changes saved.';paint();
    },700);
  }
  setInterval(()=>{const u=state.user?state.user.id:null;if(u!==O.uid){O.uid=u;if(LIVE){O.doc=null;O.status=''}}},700);

  const css=document.createElement('style');
  css.textContent=`
  .igw{display:grid;gap:14px}
  .igcat h4{margin:6px 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
  .igg{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
  .igc{border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:12px 14px;display:grid;gap:8px;align-content:start;min-width:0}
  .igc .top{display:flex;gap:10px;align-items:center;justify-content:space-between}
  .igc b{font-size:15px}.igc .d{font-size:12.5px;color:var(--muted)}
  .igc input[type=text],.igc input[type=url]{width:100%}
  .igc .row2{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .igc .bad{color:#c62828;font-size:12.5px}
  .igpill{font-size:11.5px;border-radius:999px;padding:2px 9px;border:1px solid var(--line);color:var(--muted);white-space:nowrap}
  .igpill.on{background:#e3f5e8;color:#1b6b3a;border-color:#b9e2c6}
  @media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .igpill.on{background:#12341f;color:#8fe0ac;border-color:#1f5a35}}
  :root[data-theme="dark"] .igpill.on{background:#12341f;color:#8fe0ac;border-color:#1f5a35}
  `;
  document.head.appendChild(css);

  function card(id,name,desc,def,a,adm,custom,i){
    const url=a&&a.url||'',has=!!url;
    const key=custom?'c'+i:id,err=O.bad[key];
    const open=has?`<a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open</a>`:(!adm&&'')||`<a class="btn sm ghost" href="${esc(def||'#')}" target="_blank" rel="noopener noreferrer" ${def?'':'hidden'} title="The tool's own website, not your account">Website</a>`;
    if(!adm){return has&&a.staff?`<div class="igc"><div class="top"><b>${esc(name)}</b><span class="igpill on">Linked</span></div><div class="d">${esc(a.note||desc||'')}</div><div class="row2">${open}</div></div>`:''}
    return `<div class="igc"><div class="top">${custom?`<input type="text" data-ig="cname" data-i="${i}" value="${esc(name)}" maxlength="${L}" placeholder="Name of the tool" aria-label="Name">`:`<b>${esc(name)}</b>`}<span class="igpill ${has?'on':''}">${has?'Link saved':'Not linked'}</span></div>
      ${custom?'':`<div class="d">${esc(desc)}</div>`}
      <input type="url" data-ig="url" data-k="${key}" value="${esc(url)}" placeholder="Paste your own address, starting with https://" maxlength="400" aria-label="${esc(name)} web address" inputmode="url" autocomplete="off">
      ${err?`<div class="bad" role="alert">${esc(err)}</div>`:''}
      <input type="text" data-ig="note" data-k="${key}" value="${esc(a&&a.note||'')}" placeholder="Note (optional), for example: use the shared firm login" maxlength="160" aria-label="Note">
      <div class="row2"><label class="chk"><input type="checkbox" data-ig="staff" data-k="${key}" ${a&&a.staff?'checked':''}> Show to staff</label><span class="grow" style="flex:1"></span>${open}${custom?`<button type="button" class="btn sm ghost" data-act="igDel" data-i="${i}">Remove</button>`:''}</div></div>`;
  }
  function html(){
    const adm=isAdm();
    if(!O.doc)load();
    if(!O.doc)return '<div class="panel"><p class="note">'+esc(O.status||'Loading…')+'</p></div>';
    const d=O.doc;
    const body=CATS.map(([cat,items])=>{const cs=items.map(([id,n,ds,df])=>card(id,n,ds,df,d.apps[id],adm,false)).join('');return cs?`<div class="igcat"><h4>${cat}</h4><div class="igg">${cs}</div></div>`:''}).join('');
    const cust=d.custom.map((c,i)=>card('',c.name||'Other tool','','',c,adm,true,i)).filter(Boolean).join('');
    const any=ALL.some(([id])=>d.apps[id]&&d.apps[id].url&&(adm||d.apps[id].staff))||d.custom.some(c=>c.url&&(adm||c.staff));
    return `<div class="panel igw"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><h3 style="margin:0">Linked apps</h3><span style="flex:1"></span><span id="igStatus" class="stlock" role="status">${esc(O.status)}</span></div>
      <p class="note" style="margin:0">${adm?'Save the address of each tool the firm uses and everyone who needs it gets an Open button. These are shortcuts only: no data is copied between the tools and this app. <b>Do not paste passwords, API keys or tokens here.</b> Sign in to each tool in its own window as usual.':'Shortcuts to the firm\'s own tools, set up by an administrator. They open in a new tab.'}</p>
      ${!adm&&!any?'<p class="note">No apps have been shared with staff yet.</p>':''}
      ${body}
      ${(cust||adm)?`<div class="igcat"><h4>Other tools</h4><div class="igg">${cust}</div>${adm&&d.custom.length<MAXC?'<div style="margin-top:8px"><button type="button" class="btn sm ghost" data-act="igAdd">+ Add another tool</button></div>':''}</div>`:''}
      ${adm?'<p class="note" style="margin:0">Live two-way connections (for example pulling invoices from Zoho Books, or picking files from Google Drive inside the app) are not built yet. They need each tool\'s developer sign-in (OAuth) and a server function, and are a separate piece of work.</p>':''}</div>`;
  }
  window.VIRTUOSO_APPS={html,load:()=>load(),links:()=>{const d=O.doc;if(!d)return [];return ALL.map(([id,n])=>({name:n,url:d.apps[id]&&d.apps[id].url})).concat(d.custom.map(c=>({name:c.name,url:c.url}))).filter(x=>x.url)}};

  const target=(k)=>{const d=O.doc;if(!d)return null;if(k[0]==='c'&&/^c\d+$/.test(k))return d.custom[+k.slice(1)]||null;return ALL.some(a=>a[0]===k)?(d.apps[k]=d.apps[k]||{url:'',note:'',staff:false}):null};
  const onEdit=e=>{
    const t=e.target;if(!t||!t.dataset||!t.dataset.ig||!isAdm()||!O.doc)return;
    e.stopImmediatePropagation();const f=t.dataset.ig;
    if(f==='cname'){const c=O.doc.custom[+t.dataset.i];if(c){c.name=clean(t.value);save()}return}
    const a=target(t.dataset.k);if(!a)return;
    if(f==='url'){
      if(e.type!=='change'&&!/^\s*$/.test(t.value)&&okUrl(t.value)===null){return}   /* wait until it is complete */
      const u=okUrl(t.value);
      if(u===null){O.bad[t.dataset.k]='This needs to be a full address starting with https://';render();return}
      delete O.bad[t.dataset.k];a.url=u||'';save();if(e.type==='change')render();return}
    if(f==='note'){a.note=clean(t.value,160);save();return}
    if(f==='staff'){a.staff=t.checked;save();return}
  };
  document.addEventListener('input',onEdit,true);
  document.addEventListener('change',onEdit,true);
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-act="igAdd"],[data-act="igDel"]');if(!b||!isAdm()||!O.doc)return;
    e.stopImmediatePropagation();
    if(b.dataset.act==='igAdd'){if(O.doc.custom.length>=MAXC)return;O.doc.custom.push({name:'',url:'',note:'',staff:false});save();render();return}
    if(b.dataset.act==='igDel'){const c=O.doc.custom[+b.dataset.i];if(!c)return;if((c.name||c.url)&&!confirm('Remove "'+(c.name||'this tool')+'"?'))return;O.doc.custom.splice(+b.dataset.i,1);save();render()}
  },true);
})();
