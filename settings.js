/* SETTINGS page. Two kinds of settings:
   - My settings (everyone): profile, appearance, password, Bruno and voice. Saved on this device only (localStorage).
   - Firm settings (admin only): company details, payroll inputs, petty cash and stationery limits. Saved in app_settings
     (live) or in memory (?demo). Row-level security lets only admins write; every change lands in the audit log.
   Payroll stays NON-TAX: nothing here is a PAYE or SSC rate. Defaults shown are the demo's values, not statutory. */
(function(){
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const isAdm=()=>state.user&&state.user.type==='admin';
  const VERSION='v30';
  const PK='vx_prefs';
  const DEF={theme:'auto',size:'normal',compact:false,motion:false,bruno:true,voice:true};

  /* ---------- device preferences ---------- */
  let prefs=Object.assign({},DEF);
  try{const s=JSON.parse(localStorage.getItem(PK)||'null');if(s&&typeof s==='object')for(const k in DEF)if(typeof s[k]===typeof DEF[k])prefs[k]=s[k]}catch(e){}
  if(!['auto','light','dark'].includes(prefs.theme))prefs.theme='auto';
  if(!['normal','large','xlarge'].includes(prefs.size))prefs.size='normal';
  const savePrefs=()=>{try{localStorage.setItem(PK,JSON.stringify(prefs))}catch(e){}};
  const css=document.createElement('style');
  css.textContent=`
  html.st-large{font-size:112.5%}html.st-xlarge{font-size:125%}
  body.st-compact .panel{padding:10px}body.st-compact td,body.st-compact th{padding-top:5px;padding-bottom:5px}
  body.st-nomotion *,body.st-nomotion *::before,body.st-nomotion *::after{animation:none!important;transition:none!important}
  body.st-nobruno #aiBtn{display:none!important}body.st-novoice #aiVoice{display:none!important}
  .stwrap{display:grid;grid-template-columns:220px minmax(0,1fr);gap:16px;align-items:start}
  .stnav{display:flex;flex-direction:column;gap:2px;position:sticky;top:8px}
  .stnav .g{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:10px 8px 4px}
  .stnav button{text-align:left;border:0;background:transparent;color:var(--fg);padding:9px 10px;border-radius:8px;font:inherit;cursor:pointer;min-height:40px}
  .stnav button:hover{background:var(--accent-soft)}
  .stnav button[aria-selected=true]{background:var(--accent-soft);font-weight:600;box-shadow:inset 3px 0 0 var(--accent)}
  .stnav button:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
  .stsec{display:grid;gap:14px}
  .stsec h3{margin:0 0 2px}
  .strow{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:10px 18px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}
  .strow:first-of-type{border-top:0}
  .strow .l b{display:block}.strow .l span{font-size:12.5px;color:var(--muted)}
  .strow input[type=text],.strow input[type=number],.strow input[type=email],.strow input[type=password],.strow select,.strow textarea{width:100%}
  .strow .fix{font-weight:600}
  .stbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:6px}
  .stlock{font-size:12.5px;color:var(--muted)}
  .stkv{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;margin:0}
  .stkv dt{color:var(--muted)}.stkv dd{margin:0;word-break:break-word}
  @media (max-width:760px){
    .stwrap{grid-template-columns:1fr}
    .stnav{flex-direction:row;overflow-x:auto;position:static;padding-bottom:4px;gap:6px;-webkit-overflow-scrolling:touch}
    .stnav .g{display:none}
    .stnav button{white-space:nowrap;border:1px solid var(--line);flex:0 0 auto}
    .strow{grid-template-columns:1fr}
  }`;
  document.head.appendChild(css);
  function applyPrefs(){
    const h=document.documentElement,b=document.body;
    if(prefs.theme==='auto')h.removeAttribute('data-theme');else h.setAttribute('data-theme',prefs.theme);
    h.classList.toggle('st-large',prefs.size==='large');h.classList.toggle('st-xlarge',prefs.size==='xlarge');
    if(b){b.classList.toggle('st-compact',prefs.compact);b.classList.toggle('st-nomotion',prefs.motion);
      b.classList.toggle('st-nobruno',!prefs.bruno);b.classList.toggle('st-novoice',!prefs.voice)}
  }
  applyPrefs();
  document.addEventListener('DOMContentLoaded',applyPrefs);

  /* ---------- firm settings ---------- */
  const FIELDS={
    company:[
      {k:'firm_name',l:'Firm name',h:'The name shown on documents.',t:'text',max:120,def:'Virtuous Accounting Solutions CC'},
      {k:'firm_reg',l:'Registration number',h:'Your CC registration number. Leave blank until you have it to hand.',t:'text',max:60,def:''},
      {k:'firm_vat',l:'VAT number',h:'Only if the firm is VAT registered.',t:'text',max:60,def:''},
      {k:'firm_address',l:'Address',h:'Street, town, country.',t:'textarea',max:300,def:'Windhoek, Namibia'},
      {k:'firm_phone',l:'Phone',h:'',t:'text',max:40,def:''},
      {k:'firm_email',l:'Office email',h:'',t:'email',max:120,def:''}],
    payroll:[
      {k:'payroll_monthly_hours',l:'Monthly working hours',h:'Divides basic pay to get the hourly rate used for overtime. 173.33 is the demo value, not a legal figure. Check your own employment terms.',t:'num',min:1,max:400,step:'0.01',def:173.33},
      {k:'payroll_overtime_multiplier',l:'Overtime multiplier',h:'Overtime pay = hours x hourly rate x this number. 1.5 is the demo value. Confirm what your contracts and the law require.',t:'num',min:1,max:5,step:'0.01',def:1.5}],
    office:[
      {k:'petty_tolerance',l:'Receipt date tolerance (days)',h:'How many days apart a receipt and a bank/sheet line may be and still match.',t:'num',min:0,max:5,step:'1',def:2},
      {k:'petty_match_threshold',l:'Vendor name match (0.3 to 1)',h:'How alike two vendor names must be to match. Higher is stricter.',t:'num',min:0.3,max:1,step:'0.05',def:0.6},
      {k:'stationery_low_threshold',l:'Low stock warning at',h:'Alerts show an item as low when its stock is at or below this number.',t:'num',min:0,max:100,step:'1',def:2}]
  };
  const ALLKEYS=Object.values(FIELDS).flat().map(f=>f.k);
  const S={tab:'profile',vals:{},loaded:false,loading:false,busy:false,msg:'',err:'',uid:null,pwMsg:'',pwErr:''};
  state.settings=state.settings||{};
  const val=f=>{const v=LIVE?S.vals[f.k]:state.settings[f.k];return v===undefined||v===null?f.def:v};
  function pushToState(){
    const t=+val(FIELDS.office[0]),h=+val(FIELDS.office[1]);
    if(t>=0&&t<=5)state.tol=t;if(h>=0.3&&h<=1)state.thr=h;
  }
  async function load(){
    if(!LIVE||S.loading||S.loaded||!sb())return;
    S.loading=true;
    const r=await sb().from('app_settings').select('key,value').in('key',ALLKEYS);
    S.loading=false;S.loaded=true;
    if(r.error){S.err='Could not load the firm settings.';}
    else{S.vals={};(r.data||[]).forEach(x=>{S.vals[x.key]=x.value});pushToState()}
    if(state.tab&&state.tab[state.role]==='settings')render();
  }
  setInterval(()=>{const u=state.user?state.user.id:null;if(u!==S.uid){S.uid=u;S.loaded=false;S.loading=false;S.vals={};S.msg='';S.err='';S.pwMsg='';S.pwErr='';
    if(!isAdm()&&['company','payroll','office','system'].includes(S.tab))S.tab='profile'}},700);

  /* ---------- view ---------- */
  const TABS=()=>{
    const t=[['My settings',[['profile','My profile'],['appearance','Appearance'],['security','Password and sign-in'],['bruno','Bruno and voice']]]];
    if(isAdm())t.push(['Firm settings (admin)',[['company','Company details'],['payroll','Payroll inputs'],['office','Petty cash and stationery'],['system','Data and system']]]);
    return t;
  };
  const chk=(id,on,l,h)=>`<div class="strow"><div class="l"><b>${l}</b><span>${h}</span></div><label class="chk"><input type="checkbox" id="${id}" data-st="pref" ${on?'checked':''}> On</label></div>`;
  const selRow=(id,l,h,opts,cur)=>`<div class="strow"><div class="l"><b>${l}</b><span>${h}</span></div><select id="${id}" data-st="pref">${opts.map(([v,t])=>`<option value="${v}" ${v===cur?'selected':''}>${t}</option>`).join('')}</select></div>`;
  function firmForm(tab,intro){
    if(!isAdm())return '<div class="panel"><p class="note">Only an administrator can change firm settings.</p></div>';
    if(LIVE&&!S.loaded){load();return '<div class="panel"><p class="note">Loading firm settings…</p></div>'}
    const fs=FIELDS[tab];
    return `<form id="stForm" data-tab="${tab}" class="panel stsec" novalidate>${intro}
      <div>${fs.map(f=>{
        const v=val(f),id='stf_'+f.k;
        const inp=f.t==='textarea'?`<textarea id="${id}" data-k="${f.k}" rows="3" maxlength="${f.max}">${esc(v)}</textarea>`
          :f.t==='num'?`<input id="${id}" data-k="${f.k}" type="number" inputmode="decimal" min="${f.min}" max="${f.max}" step="${f.step}" value="${esc(v)}">`
          :`<input id="${id}" data-k="${f.k}" type="${f.t}" maxlength="${f.max}" value="${esc(v)}">`;
        return `<div class="strow"><label class="l" for="${id}"><b>${f.l}</b>${f.h?`<span>${f.h}</span>`:''}</label>${inp}</div>`}).join('')}</div>
      <div class="err" id="stErr" role="alert">${esc(S.err)}</div>
      <div class="stbar"><button class="btn" type="submit" ${S.busy?'disabled':''}>Save changes</button><button class="btn ghost" type="button" data-act="stReset" data-tab="${tab}">Restore defaults</button><span class="stlock">${LIVE?'Saved to the database and recorded in the audit log.':'Sample mode: kept in memory until you reload.'}</span></div>
      ${S.msg?`<div class="banner ok" role="status">${esc(S.msg)}</div>`:''}</form>`;
  }
  function section(){
    const u=state.user||{};
    switch(S.tab){
      case 'profile':return `<div class="panel stsec"><h3>My profile</h3>
        <dl class="stkv"><dt>Name</dt><dd>${esc(u.name)}</dd><dt>Job title</dt><dd>${esc(u.title)}</dd><dt>Email</dt><dd>${esc(u.email)}</dd><dt>Access</dt><dd>${isAdm()?'Administrator':'Employee'}</dd></dl>
        <p class="note" style="margin:0">Your name, title and access are managed by an administrator on the Employees page.</p></div>
        <div class="panel stsec"><h3>Fixed facts</h3><dl class="stkv"><dt>Country</dt><dd>Namibia</dd><dt>Currency</dt><dd>Namibian dollar (NAD, shown as N$)</dd><dt>Financial year</dt><dd>March to February (FY2027 = March 2026 to February 2027)</dd></dl>
        <p class="note" style="margin:0">These are built into reports and payroll, so they are not editable.</p></div>`;
      case 'appearance':return `<div class="panel stsec"><h3>Appearance</h3><p class="note" style="margin:0">Saved on this device only.</p><div>
        ${selRow('stTheme','Colour theme','Auto follows your device.',[['auto','Auto (follow device)'],['light','Light'],['dark','Dark']],prefs.theme)}
        ${selRow('stSize','Text size','Makes everything larger. Helpful on small screens.',[['normal','Normal'],['large','Large'],['xlarge','Extra large']],prefs.size)}
        ${chk('stCompact',prefs.compact,'Compact tables and panels','Less spacing, more rows on screen.')}
        ${chk('stMotion',prefs.motion,'Reduce animation','Turns off movement such as Bruno blinking and slide effects.')}</div>
        <div class="stbar"><button class="btn ghost" type="button" data-act="stDefaults">Reset my appearance</button></div></div>`;
      case 'security':return `<form id="stPw" class="panel stsec" novalidate><h3>Change password</h3>
        <div>${LIVE?'':`<div class="strow"><label class="l" for="stPwOld"><b>Current password</b></label><input id="stPwOld" type="password" autocomplete="current-password"></div>`}
        <div class="strow"><label class="l" for="stPwNew"><b>New password</b><span>At least 8 characters, with a number.</span></label><input id="stPwNew" type="password" autocomplete="new-password"></div>
        <div class="strow"><label class="l" for="stPwCon"><b>Confirm new password</b></label><input id="stPwCon" type="password" autocomplete="new-password"></div></div>
        <div class="err" id="stPwErr" role="alert">${esc(S.pwErr)}</div>${S.pwMsg?`<div class="banner ok" role="status">${esc(S.pwMsg)}</div>`:''}
        <div class="stbar"><button class="btn" type="submit" ${S.busy?'disabled':''}>Save password</button></div>
        <p class="note" style="margin:0">Forgot it? Ask an administrator to reset it; you will choose your own at the next sign-in.</p></form>
        <div class="panel stsec"><h3>Sign out</h3><p class="note" style="margin:0">Sign out on shared computers when you are done.</p><div class="stbar"><button class="btn ghost" type="button" data-act="signout">Sign out</button></div></div>`;
      case 'bruno':return `<div class="panel stsec"><h3>Bruno and voice</h3><p class="note" style="margin:0">Saved on this device only.</p><div>
        ${chk('stBruno',prefs.bruno,'Show the Bruno button','The bear in the corner. You can still open AI Tools from the menu.')}
        ${chk('stVoice',prefs.voice,'Show the Voice button','Dictate to Bruno. It uses your browser\'s speech service, so audio may go to your browser vendor. Off if you prefer typing.')}</div></div>`;
      case 'company':return firmForm('company','<h3>Company details</h3><p class="note" style="margin:0">Master details for the firm. Leave blank anything you do not have.</p>');
      case 'payroll':return firmForm('payroll','<h3>Payroll inputs</h3><div class="banner" style="margin:0">Payroll here is <b>non-tax</b>: there are no PAYE or social security rates in this system. They need verified, effective-dated rules before they can be added. After changing these, recalculate the draft on the Payroll page.</div>')
        +`<div class="panel stsec"><h3>Leave and loan limits</h3><p class="note" style="margin:0">Leave balances (placeholders 15 / 10 / 3 days) are set per employee on the Employees page. One active loan per person is enforced by the database.</p></div>`;
      case 'office':return firmForm('office','<h3>Petty cash and stationery</h3><p class="note" style="margin:0">Controls how receipts are matched on Reconcile and when stationery shows as low.</p>');
      case 'system':return `<div class="panel stsec"><h3>Data and system</h3>
        <dl class="stkv"><dt>Mode</dt><dd>${LIVE?'Live (connected to the database)':'Sample data (resets when you reload)'}</dd><dt>App version</dt><dd>${VERSION}</dd><dt>Signed in as</dt><dd>${esc(u.name)} (${esc(u.email)})</dd><dt>Online</dt><dd>${navigator.onLine?'Yes':'No'}</dd></dl>
        <div class="stbar">${LIVE?'<button class="btn ghost" type="button" data-act="stTest">Test connection</button>':''}<button class="btn ghost" type="button" data-act="stExport">Download my settings</button></div>
        ${S.msg?`<div class="banner ok" role="status">${esc(S.msg)}</div>`:''}${S.err?`<div class="err" role="alert">${esc(S.err)}</div>`:''}</div>
        <div class="panel stsec"><h3>App not updating?</h3><p class="note" style="margin:0">This clears the files saved on this device for offline use and reloads the latest version. Your data is not touched.</p><div class="stbar"><button class="btn ghost" type="button" data-act="stClear">Clear cached app files and reload</button></div></div>`;
    }
    return '';
  }
  function vSettings(){
    if(!TABS().some(g=>g[1].some(t=>t[0]===S.tab)))S.tab='profile';
    return `<h2>Settings</h2><p class="sub">Your preferences${isAdm()?' and the firm\'s settings':''}.</p>
    <div class="stwrap"><nav class="stnav" aria-label="Settings sections">${TABS().map(([g,items])=>`<div class="g">${g}</div>`+items.map(([k,l])=>`<button type="button" data-act="stTab" data-t="${k}" aria-selected="${k===S.tab}">${l}</button>`).join('')).join('')}</nav>
    <div class="stsec">${section()}</div></div>`;
  }
  window.ICON=window.ICON||{};
  ICON.settings='<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>';
  [NAV.adm,NAV.emp].forEach(nav=>{if(!nav.some(g=>g[1].some(x=>x[0]==='settings')))nav.push(['Account',[['settings','Settings']]])});
  VIEWS.settings=vSettings;

  /* ---------- actions ---------- */
  const setMsg=(m,e)=>{S.msg=m||'';S.err=e||''};
  async function saveFirm(form){
    const tab=form.dataset.tab,rows=[],next={};
    for(const f of FIELDS[tab]){
      const el=form.querySelector('[data-k="'+f.k+'"]');let v=el.value.trim();
      if(f.t==='num'){
        const n=parseFloat(v);
        if(!(n>=f.min&&n<=f.max)){S.err=f.l+' must be a number from '+f.min+' to '+f.max+'.';S.msg='';return render()}
        v=n;
      }else if(f.t==='email'&&v&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){S.err='Enter a valid email address, or leave it blank.';S.msg='';return render()}
      else if(f.k==='firm_name'&&!v){S.err='The firm name cannot be blank.';S.msg='';return render()}
      next[f.k]=v;rows.push({key:f.k,value:v});
    }
    if(LIVE){
      S.busy=true;
      const r=await sb().from('app_settings').upsert(rows);
      S.busy=false;
      if(r.error){S.err=/row-level|policy|permission|not permitted/i.test(r.error.message)?'You are not allowed to change firm settings.':'Could not save. Check your connection and try again.';S.msg='';return render()}
      Object.assign(S.vals,next);
    }else Object.assign(state.settings,next);
    pushToState();S.err='';S.msg='Saved.'+(tab==='payroll'?' Recalculate the draft on the Payroll page to apply it.':'');
    toast('Settings saved');render();
  }
  async function savePassword(){
    const n=$('#stPwNew').value,c=$('#stPwCon').value,u=state.user;
    S.pwMsg='';
    if(!LIVE&&$('#stPwOld').value!==u.password)S.pwErr='The current password is not correct.';
    else if(n.length<8||!/\d/.test(n))S.pwErr='Use at least 8 characters, including a number.';
    else if(n!==c)S.pwErr='The two passwords do not match.';
    else if(!LIVE&&n===u.password)S.pwErr='Choose a password different from the current one.';
    else{
      S.pwErr='';
      if(LIVE){
        S.busy=true;const r=await sb().auth.updateUser({password:n});S.busy=false;
        if(r.error){S.pwErr=/same|different/i.test(r.error.message)?'Choose a password different from the current one.':'Could not change the password. Sign in again and retry.';return render()}
      }else u.password=n;
      S.pwMsg='Password changed.';toast('Password changed');
    }
    render();
  }
  function setPref(el){
    switch(el.id){
      case 'stTheme':prefs.theme=el.value;break;
      case 'stSize':prefs.size=el.value;break;
      case 'stCompact':prefs.compact=el.checked;break;
      case 'stMotion':prefs.motion=el.checked;break;
      case 'stBruno':prefs.bruno=el.checked;break;
      case 'stVoice':prefs.voice=el.checked;break;
      default:return;
    }
    savePrefs();applyPrefs();toast('Saved on this device');
  }
  document.addEventListener('submit',e=>{
    const id=e.target.id;if(id!=='stForm'&&id!=='stPw')return;
    e.preventDefault();e.stopImmediatePropagation();
    if(S.busy)return;
    if(id==='stForm')saveFirm(e.target);else savePassword();
  },true);
  document.addEventListener('change',e=>{
    const t=e.target;if(!t||t.dataset.st!=='pref')return;
    e.stopImmediatePropagation();setPref(t);
  },true);
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="st"]');if(!b)return;
    const a=b.dataset.act;if(!['stTab','stReset','stDefaults','stTest','stExport','stClear'].includes(a))return;
    e.stopImmediatePropagation();
    if(a==='stTab'){S.tab=b.dataset.t;S.msg='';S.err='';S.pwMsg='';S.pwErr='';return render()}
    if(a==='stDefaults'){prefs=Object.assign({},DEF);savePrefs();applyPrefs();toast('Appearance reset');return render()}
    if(a==='stReset'){
      if(!isAdm()||!confirm('Restore the default values on this page? Nothing is saved until you press Save changes.'))return;
      FIELDS[b.dataset.tab].forEach(f=>{const el=document.querySelector('[data-k="'+f.k+'"]');if(el)el.value=f.def});return;
    }
    if(a==='stTest'){
      S.msg='';S.err='';
      sb().from('app_settings').select('key').limit(1).then(r=>{if(r.error)S.err='Connection failed: '+r.error.message;else S.msg='Connected. The database answered.';render()});
      return;
    }
    if(a==='stExport'){
      const data={app:'Virtuoso System',exported:new Date().toISOString(),device:prefs,firm:isAdm()?(LIVE?S.vals:state.settings):undefined};
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
      const x=document.createElement('a');x.href=url;x.download='virtuoso-settings.json';document.body.appendChild(x);x.click();x.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      return;
    }
    if(a==='stClear'){
      if(!confirm('Clear saved app files on this device and reload?'))return;
      const done=()=>location.reload();
      Promise.all([
        'serviceWorker' in navigator?navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister()))):0,
        window.caches?caches.keys().then(ks=>Promise.all(ks.map(k=>caches.delete(k)))):0
      ]).then(done,done);
    }
  },true);
})();
