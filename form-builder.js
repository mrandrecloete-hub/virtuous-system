/* FORM BUILDER page (admins): a visual builder with three modes, laid out like the usual form builders.
   BUILD    : element palette (drag and drop or click), live form canvas, Form Designer (colours, styles, themes, layout)
   SETTINGS : form settings, emails, conditions, thank-you page, integrations, approval flows
   PUBLISH  : quick share link, embed code, assign, email invitation, prefilled links, printable PDF, platforms
   Creation helpers (describe it in words, templates, quiz from text) and plain-language changes use the engine in
   assistant-forms.js (no AI service). Forms are saved to the database in live mode by live-forms.js. */
(function(){
  const F=()=>window.VIRTUOSO_FORMS;
  if(!F())return;
  const live=!!window.VIRTUOSO_SYNC;
  const md=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^[-*] (.+)$/gm,'&bull; $1').replace(/\n/g,'<br>');
  const isUuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
  const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  const forms=()=>F().forms();
  const real=f=>f.fields.filter(x=>!['head','para'].includes(x.type));
  const subsOf=f=>(state.subs||[]).filter(s=>s.formId===f.id);
  const baseUrl=()=>location.origin+location.pathname.replace(/[^/]*$/,'');
  const shareUrl=f=>baseUrl()+'form.html?id='+encodeURIComponent(f.id);
  const copy=(t,msg)=>{if(navigator.clipboard)navigator.clipboard.writeText(t).then(()=>toast(msg||'Copied'),()=>toast('Copy failed'));else toast('Copy is not available here')};

  const FB={view:'list',formId:null,mode:'build',dTab:'colors',sTab:'form',pTab:'share',sel:null,preview:false,create:null,v:{},out:{},ana:{id:'',report:false,text:''},
    cmd:'',cmdOut:'',cond:null,pv:{ans:{},done:false},people:null,assign:{sel:{},msg:'',out:''},pref:{},embedH:'800',inv:null,importMsg:'',fromFill:false};

  /* ---------- elements, designs ---------- */
  const OPT3=()=>['Option 1','Option 2','Option 3'];
  const ELEMENTS=[
    ['short','Textbox','T',{type:'short',label:'Text'}],['long','Long text','¶',{type:'long',label:'Comments'}],['email','Email','@',{type:'email',label:'Email address'}],
    ['phone','Phone','☎',{type:'phone',label:'Mobile number'}],['address','Address','⌂',{type:'long',label:'Address'}],['number','Number','#',{type:'number',label:'Number'}],
    ['date','Date','▦',{type:'date',label:'Date'}],['idno','ID number','ID',{type:'idno',label:'ID or passport number'}],['select','Dropdown','▾',{type:'select',label:'Choose one',opts:OPT3}],
    ['radio','Single choice','◉',{type:'radio',label:'Choose one',opts:OPT3}],['check','Multiple choice','☑',{type:'check',label:'Choose all that apply',opts:OPT3}],['yesno','Yes or no','✓',{type:'yesno',label:'Yes or no question'}],
    ['stars','Star rating','★',{type:'radio',label:'Rating',opts:()=>['1 - Poor','2','3','4','5 - Excellent']}],['file','File upload','⇪',{type:'file',label:'Upload a document'}],
    ['sign','Signature','✍',{type:'sign',label:'Signature'}],['head','Heading','H',{type:'head',label:'Section heading'}],['para','Text block','≡',{type:'para',label:'Add your text here'}]];
  const TYPES=[['short','Short text'],['long','Long text'],['email','Email'],['phone','Phone'],['number','Number'],['date','Date'],['idno','ID or passport number'],['select','Dropdown'],['radio','Single choice'],['check','Multiple choice'],['yesno','Yes or no'],['file','File upload'],['sign','Signature']];
  const SCHEMES=[
    ['Classic',{pageColor:'#eef2fa',formColor:'#ffffff',fontColor:'#14202a',inputBg:'#ffffff',accent:'#0b3fb5'}],
    ['Navy and gold',{pageColor:'#0a1b3f',formColor:'#ffffff',fontColor:'#0a1b3f',inputBg:'#f4f7fd',accent:'#c9a227'}],
    ['Paper',{pageColor:'#f3efe6',formColor:'#fffdf7',fontColor:'#3a2f1f',inputBg:'#ffffff',accent:'#8a5a2b'}],
    ['Forest',{pageColor:'#e6f2ea',formColor:'#ffffff',fontColor:'#12361f',inputBg:'#f6fbf8',accent:'#1f8a4c'}],
    ['Plum',{pageColor:'#efe9f7',formColor:'#ffffff',fontColor:'#2b1646',inputBg:'#faf7fd',accent:'#7a3fb5'}],
    ['Night',{pageColor:'#121820',formColor:'#1c2531',fontColor:'#e8eef5',inputBg:'#26323f',accent:'#4aa3ff'}],
    ['Rose',{pageColor:'#fbeaf0',formColor:'#ffffff',fontColor:'#4a1230',inputBg:'#fff7fa',accent:'#d6336c'}],
    ['Mono',{pageColor:'#f2f2f2',formColor:'#ffffff',fontColor:'#111111',inputBg:'#ffffff',accent:'#111111'}]];
  const S=n=>SCHEMES.find(x=>x[0]===n)[1];
  const THEMES=[
    ['Classic',{...S('Classic'),font:'sans',size:'medium',radius:'soft',width:'standard',labelPos:'top',spacing:'comfortable'}],
    ['Executive',{...S('Navy and gold'),font:'serif',size:'medium',radius:'square',width:'wide',labelPos:'top',spacing:'comfortable'}],
    ['Friendly',{...S('Rose'),font:'rounded',size:'large',radius:'round',width:'standard',labelPos:'top',spacing:'roomy'}],
    ['Compact',{...S('Mono'),font:'mono',size:'small',radius:'square',width:'standard',labelPos:'left',spacing:'compact'}],
    ['Garden',{...S('Forest'),font:'sans',size:'medium',radius:'soft',width:'narrow',labelPos:'top',spacing:'comfortable'}],
    ['After dark',{...S('Night'),font:'sans',size:'medium',radius:'soft',width:'standard',labelPos:'top',spacing:'comfortable'}]];
  const MAPS={font:{sans:'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',serif:'Georgia,"Times New Roman",serif',mono:'ui-monospace,Menlo,Consolas,monospace',rounded:'"Trebuchet MS","Segoe UI",sans-serif'},
    size:{small:'14px',medium:'16px',large:'18px'},radius:{square:'2px',soft:'8px',round:'16px'},width:{narrow:'480px',standard:'640px',wide:'820px'},spacing:{compact:'10px',comfortable:'18px',roomy:'28px'}};
  const okColor=v=>/^#[0-9a-f]{3,8}$/i.test(v||'')?v:null;
  function dvars(d){
    d=d||{};const o=[];const add=(k,v)=>{if(v)o.push(k+':'+v)};
    add('--page',okColor(d.pageColor));add('--form',okColor(d.formColor));add('--fg2',okColor(d.fontColor));add('--inbg',okColor(d.inputBg));add('--acc',okColor(d.accent));
    add('--ff',MAPS.font[d.font]);add('--fs',MAPS.size[d.size]);add('--rad',MAPS.radius[d.radius]);add('--w',MAPS.width[d.width]);add('--gap',MAPS.spacing[d.spacing]);
    return o.join(';');
  }

  /* ---------- styles ---------- */
  const css=document.createElement('style');
  css.textContent=`
  .fbbar{background:linear-gradient(90deg,#b8860b,#e6b422);color:#0a1b3f;border-radius:12px;padding:8px 12px;margin-bottom:14px}
  .fbbarin{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:space-between}
  .fbback{background:rgba(255,255,255,.35);border:0;color:#0a1b3f;border-radius:8px;padding:8px 12px;font-weight:600;cursor:pointer;min-height:40px}
  .fbmid{text-align:center;min-width:140px;flex:1 1 160px}.fbname{font-weight:700;font-size:1.05em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fbsave{font-size:.8em;opacity:.85}
  .fbtabs{display:flex;gap:4px}.fbtabs button{background:transparent;border:0;color:#0a1b3f;letter-spacing:.08em;font-weight:700;padding:10px 14px;border-radius:8px;cursor:pointer;min-height:40px}
  .fbtabs button[aria-selected=true]{background:rgba(255,255,255,.55);box-shadow:inset 0 -3px 0 #0a1b3f}
  .fbact{display:flex;gap:6px;flex-wrap:wrap}.fbback[aria-pressed=true]{background:#0a1b3f;color:#e6b422}
  .fbgrid{display:grid;grid-template-columns:210px minmax(0,1fr) 300px;gap:14px;align-items:start}
  @media(max-width:1060px){.fbgrid{grid-template-columns:1fr}.fbgrid>aside{order:2}.fbgrid>main{order:1}}
  .fbcol{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px}
  .fbcol h3{margin:0 0 8px;font-size:1em}
  .fbpal{display:grid;grid-template-columns:1fr;gap:6px}
  @media(max-width:1060px){.fbpal{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}}
  .fbpalitem{display:flex;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);cursor:grab;font:inherit;color:var(--fg);text-align:left;min-height:42px}
  .fbpalitem:hover{border-color:var(--accent)}.fbpalitem i{font-style:normal;width:26px;height:26px;border-radius:6px;background:#0a1b3f;color:#e6b422;display:grid;place-items:center;font-size:12px;flex:none}
  .fbpage{background:var(--page,#eef2fa);color:var(--fg2,#14202a);font-family:var(--ff,inherit);font-size:var(--fs,16px);border-radius:12px;padding:22px 12px}
  .fbform{background:var(--form,#fff);max-width:var(--w,640px);margin:0 auto;border-radius:calc(var(--rad,8px) + 4px);padding:22px 20px;box-shadow:0 2px 14px rgba(0,0,0,.1)}
  .fbtitle{width:100%;border:1px dashed transparent;background:transparent;color:inherit;font:700 1.5em/1.25 inherit;font-family:inherit;padding:2px 4px;border-radius:6px}
  .fbdesc{width:100%;border:1px dashed transparent;background:transparent;color:inherit;font:inherit;opacity:.85;resize:vertical;padding:2px 4px;border-radius:6px;margin-bottom:10px}
  .fbtitle:hover,.fbdesc:hover,.fbtitle:focus,.fbdesc:focus{border-color:var(--acc,#0b3fb5)}
  .fbblock{position:relative;border:2px solid transparent;border-radius:var(--rad,8px);padding:10px 10px 6px 26px;margin:0;cursor:pointer}
  .fbblock:hover{border-color:color-mix(in srgb,var(--acc,#0b3fb5) 35%,transparent)}
  .fbblock.sel{border-color:var(--acc,#0b3fb5);background:color-mix(in srgb,var(--acc,#0b3fb5) 6%,transparent)}
  .fbhandle{position:absolute;left:4px;top:12px;cursor:grab;opacity:.5;user-select:none;font-size:14px;padding:2px}
  .fbtool{position:absolute;right:6px;top:4px;display:flex;gap:4px;background:#0a1b3f;border-radius:8px;padding:3px;z-index:2}
  .fbtool button{background:transparent;border:0;color:#fff;cursor:pointer;min-width:34px;min-height:32px;border-radius:6px;font-size:14px}.fbtool button:hover{background:rgba(255,255,255,.18)}
  .fbblock .fbf :is(input,select,textarea){pointer-events:none}
  .fbf label.l,.fbf .l{display:block;font-weight:600;margin-bottom:5px}
  .left .fbf.row{display:grid;grid-template-columns:200px 1fr;gap:12px;align-items:start}
  .fbf{margin-bottom:var(--gap,18px)}.fbf .help{font-size:.85em;opacity:.7;margin-top:4px}
  .fbf input[type=text],.fbf input[type=email],.fbf input[type=tel],.fbf input[type=number],.fbf input[type=date],.fbf select,.fbf textarea{width:100%;font:inherit;color:inherit;background:var(--inbg,#fff);border:1px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:var(--rad,8px);padding:9px 11px;min-height:42px}
  .fbf .opt{display:flex;gap:9px;align-items:center;padding:4px 0}.fbf .opt input{width:18px;height:18px}
  .fbf h2.sec{font-size:1.15em;margin:8px 0;padding-bottom:5px;border-bottom:2px solid var(--acc,#0b3fb5)}
  .fbf p.para{margin:0;white-space:pre-wrap}
  .fbsigbox{border:1px dashed color-mix(in srgb,currentColor 35%,transparent);border-radius:var(--rad,8px);height:90px;max-width:420px;display:grid;place-items:center;opacity:.6;background:var(--inbg,#fff)}
  .fbchip{display:inline-block;font-size:.72em;background:#0a1b3f;color:#e6b422;border-radius:999px;padding:1px 8px;margin-left:8px;font-weight:600;vertical-align:middle}
  .fbsubmit{background:var(--acc,#0b3fb5);color:#fff;border:0;border-radius:var(--rad,8px);padding:12px 22px;font:inherit;font-weight:700;margin-top:6px}
  .dz{height:12px;margin:0;border-radius:6px;transition:height .12s,background .12s}
  .dz.on{height:40px;background:color-mix(in srgb,var(--acc,#0b3fb5) 25%,transparent);outline:2px dashed var(--acc,#0b3fb5)}
  .dz.empty{height:auto;padding:36px 12px;text-align:center;border:2px dashed color-mix(in srgb,currentColor 30%,transparent);opacity:.8}
  .dz.empty.on{background:color-mix(in srgb,var(--acc,#0b3fb5) 15%,transparent)}
  .fbsw{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .fbsw button{height:40px;border-radius:8px;border:2px solid var(--line);cursor:pointer;display:grid;grid-template-columns:1fr 1fr;overflow:hidden;padding:0}
  .fbsw button[aria-pressed=true]{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent)}
  .fbsw span{display:block}
  .fbtabs2{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;margin-bottom:12px;border:2px solid #0a1b3f;border-radius:10px;overflow:hidden}
  .fbtabs2 button{background:var(--bg);border:0;padding:9px 2px;font-size:.78em;font-weight:700;letter-spacing:.05em;cursor:pointer;color:var(--fg)}
  .fbtabs2 button[aria-selected=true]{background:#0a1b3f;color:#e6b422}
  .fbrow{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
  .fbside label{display:block;font-weight:600;font-size:.85em;margin-bottom:4px}
  .fbside input[type=color]{width:100%;height:38px;padding:2px;border-radius:8px;border:1px solid var(--line);background:var(--bg);cursor:pointer}
  .fbside select,.fbside input[type=text],.fbside textarea{width:100%}
  .fbthemes{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .fbthemes button{border:2px solid var(--line);border-radius:10px;background:var(--bg);padding:8px;cursor:pointer;text-align:left;color:var(--fg);font:inherit}
  .fbthemes button:hover{border-color:var(--accent)}
  .fbmini{display:flex;height:22px;border-radius:6px;overflow:hidden;margin-top:6px}.fbmini i{flex:1}
  .fbsettings{display:grid;grid-template-columns:230px minmax(0,1fr);gap:14px;align-items:start}
  @media(max-width:820px){.fbsettings{grid-template-columns:1fr}}
  .fbsnav{background:#2b3544;border-radius:12px;padding:6px;display:flex;flex-direction:column;gap:2px}
  @media(max-width:820px){.fbsnav{flex-direction:row;overflow-x:auto}}
  .fbsnav button{background:transparent;border:0;color:#d9e1ec;text-align:left;padding:12px;border-radius:8px;cursor:pointer;font:inherit;min-height:48px;white-space:nowrap}
  .fbsnav button b{display:block;font-size:.95em}.fbsnav button small{opacity:.7;font-size:.78em;white-space:normal}
  .fbsnav button[aria-selected=true]{background:#e6b422;color:#0a1b3f}
  .fbcond{display:flex;gap:12px;align-items:center;justify-content:space-between;width:100%;text-align:left;background:var(--surface);border:1px solid var(--line);border-left-width:6px;border-radius:8px;padding:12px 14px;margin-bottom:8px;cursor:pointer;color:var(--fg);font:inherit}
  .fbcond small{display:block;opacity:.7}.fbcond[disabled]{opacity:.55;cursor:not-allowed}
  .fbcond.c1{border-left-color:#1d7de0}.fbcond.c2{border-left-color:#8a96a8}.fbcond.c3{border-left-color:#1f8a4c}.fbcond.c4{border-left-color:#7a3fb5}.fbcond.c5{border-left-color:#e6a100}.fbcond.c6{border-left-color:#b8860b}
  .fbnote{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:.9em}
  .fbcode{background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.8em;white-space:pre-wrap;word-break:break-all}
  .fbplat{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
  .fbplat>div{border:1px solid var(--line);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:6px}
  `;
  document.head.appendChild(css);

  /* ---------- helpers on the open form ---------- */
  const cur=()=>forms().find(f=>f.id===FB.formId)||null;
  const selField=f=>f&&f.fields.find(x=>x.id===FB.sel)||null;
  function saveText(){
    if(!live)return 'Changes are kept in this session only';
    const s=window.VIRTUOSO_SYNC;
    if(s.status==='saving'||s.status==='loading')return 'Saving…';
    if(s.status==='error')return 'Could not save: '+(s.error||'try again');
    return s.last?'All changes saved at '+s.last.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'All changes saved';
  }
  setInterval(()=>{const e=document.getElementById('fbSave');if(e)e.textContent=saveText()},1000);
  if(live)window.VIRTUOSO_SYNC.renamed.push((o,n)=>{if(FB.formId===o)FB.formId=n});
  const openEditor=(id,mode)=>{FB.formId=id;FB.view='edit';FB.mode=mode||'build';FB.sel=null;FB.preview=false;FB.cmdOut='';FB.out={};FB.pv={ans:{},done:false};FB.inv=null;FB.cond=null;F().ctx.formId=id;window.scrollTo(0,0);render()};
  const back=()=>{FB.view='list';FB.formId=null;FB.sel=null;window.scrollTo(0,0);render()};

  /* ---------- rendering the form (canvas and preview) ---------- */
  function ctl(x,mode){
    const d=mode==='edit'?'disabled':'',v=FB.pv.ans[x.id],id=`pv_${x.id}`;
    const att=mode==='edit'?'':`data-pv="${esc(x.id)}"`;
    switch(x.type){
      case 'long':return `<textarea ${d} ${att} rows="3">${esc(v||'')}</textarea>`;
      case 'email':return `<input type="email" ${d} ${att} value="${esc(v||'')}">`;
      case 'phone':return `<input type="tel" ${d} ${att} value="${esc(v||'')}">`;
      case 'number':return `<input type="number" ${d} ${att} value="${esc(v||'')}">`;
      case 'date':return `<input type="date" ${d} ${att} value="${esc(v||'')}">`;
      case 'select':return `<select ${d} ${att}><option value="">Choose…</option>${(x.opts||[]).map(o=>`<option ${v===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
      case 'radio':case 'yesno':return (x.type==='yesno'?['Yes','No']:(x.opts||[])).map(o=>`<label class="opt"><input type="radio" name="r_${esc(x.id)}" ${d} ${att} value="${esc(o)}" ${v===o?'checked':''}><span>${esc(o)}</span></label>`).join('');
      case 'check':return (x.opts||[]).map(o=>`<label class="opt"><input type="checkbox" ${d} ${att} value="${esc(o)}" ${Array.isArray(v)&&v.includes(o)?'checked':''}><span>${esc(o)}</span></label>`).join('');
      case 'file':return `<input type="file" ${d}>`;
      case 'sign':return `<div class="fbsigbox">Signature pad</div>`;
      default:return `<input type="text" ${d} ${att} value="${esc(v||'')}">`;
    }
  }
  function inner(f,x,mode){
    if(x.type==='head')return `<div class="fbf"><h2 class="sec">${esc(x.label)}</h2></div>`;
    if(x.type==='para')return `<div class="fbf"><p class="para">${esc(x.label)}</p></div>`;
    const dep=x.showIf?f.fields.find(q=>q.id===x.showIf.fid):null;
    const chip=mode==='edit'&&dep?`<span class="fbchip">shown if ${esc(dep.label)} = ${esc(x.showIf.val)}</span>`:'';
    const lab=`<span class="l">${esc(x.label)}${x.req?'<span style="color:#b3261e"> *</span>':''}${chip}</span>`;
    return `<div class="fbf row"><div>${lab}</div><div>${ctl(x,mode)}${x.help?`<div class="help">${esc(x.help)}</div>`:''}</div></div>`;
  }
  const dz=i=>`<div class="dz" data-idx="${i}" aria-hidden="true"></div>`;
  function toolbar(x,f){
    const i=f.fields.indexOf(x);
    return `<div class="fbtool" role="toolbar" aria-label="Field actions"><button type="button" data-act="fbUp" data-id="${esc(x.id)}" aria-label="Move up" title="Move up" ${i===0?'disabled':''}>↑</button><button type="button" data-act="fbDown" data-id="${esc(x.id)}" aria-label="Move down" title="Move down" ${i===f.fields.length-1?'disabled':''}>↓</button><button type="button" data-act="fbDup" data-id="${esc(x.id)}" aria-label="Duplicate" title="Duplicate">⧉</button><button type="button" data-act="fbDel" data-id="${esc(x.id)}" aria-label="Delete" title="Delete">✕</button></div>`;
  }
  const visiblePv=(f,x)=>{if(!x.showIf)return true;const c=f.fields.find(q=>q.id===x.showIf.fid);if(!c||!visiblePv(f,c))return false;const v=FB.pv.ans[x.showIf.fid];return Array.isArray(v)?v.includes(x.showIf.val):String(v==null?'':v)===String(x.showIf.val)};
  function canvasHTML(f){
    const d=f.design||{};
    if(FB.preview){
      if(FB.pv.done)return `<div class="fbpage ${d.labelPos==='left'?'left':''}" style="${esc(dvars(d))}"><div class="fbform"><h1 style="margin:0 0 8px">${esc(f.title)}</h1><p>${esc(f.thanks||'Thank you. Your response has been recorded.')}</p><button class="fbsubmit" type="button" data-act="fbPvAgain">Try again</button><p class="help" style="opacity:.6">Preview only: nothing was sent.</p></div></div>`;
      return `<div class="fbpage ${d.labelPos==='left'?'left':''}" style="${esc(dvars(d))}"><div class="fbform"><h1 style="margin:0 0 6px;font-size:1.5em">${esc(f.title)}</h1>${f.desc?`<p style="opacity:.85;white-space:pre-wrap">${esc(f.desc)}</p>`:''}
        ${f.fields.filter(x=>visiblePv(f,x)).map(x=>inner(f,x,'pv')).join('')}<button class="fbsubmit" type="button" data-act="fbPvSubmit">Submit</button><p class="help" style="opacity:.6">Preview: you can fill it in, but nothing is saved or sent.</p></div></div>`;
    }
    return `<div class="fbpage ${d.labelPos==='left'?'left':''}" style="${esc(dvars(d))}"><div class="fbform">
      <input class="fbtitle" id="fbTitle" value="${esc(f.title)}" aria-label="Form title" maxlength="120">
      <textarea class="fbdesc" id="fbDesc" rows="2" placeholder="Add a description" aria-label="Form description" maxlength="600">${esc(f.desc||'')}</textarea>
      ${f.fields.length?f.fields.map((x,i)=>dz(i)+`<div class="fbblock ${FB.sel===x.id?'sel':''}" data-fid="${esc(x.id)}"><div class="fbhandle" draggable="true" data-move="${esc(x.id)}" title="Drag to reorder" aria-hidden="true">⋮⋮</div>${FB.sel===x.id?toolbar(x,f):''}${inner(f,x,'edit')}</div>`).join('')+dz(f.fields.length)
        :`<div class="dz empty" data-idx="0">Add your first question with drag &amp; drop, or click an element on the left</div>`}
      <button class="fbsubmit" type="button" tabindex="-1">Submit</button></div></div>`;
  }

  /* ---------- designer and properties (right column) ---------- */
  function designerHTML(f){
    const d=f.design||{},t=FB.dTab;
    const tabs=[['colors','COLORS'],['styles','STYLES'],['themes','THEMES'],['layout','LAYOUT']];
    const sel=(k,opts)=>`<select data-ds="${k}" aria-label="${k}">${opts.map(([v,l])=>`<option value="${v}" ${(d[k]||opts[0][0])===v?'selected':''}>${l}</option>`).join('')}</select>`;
    let body='';
    if(t==='colors')body=`<label>Color scheme</label><div class="fbsw" style="margin-bottom:12px">${SCHEMES.map(([n,c])=>`<button type="button" data-act="fbScheme" data-n="${esc(n)}" title="${esc(n)}" aria-label="${esc(n)} colour scheme" aria-pressed="${['pageColor','formColor','accent'].every(k=>(d[k]||'').toLowerCase()===c[k])}"><span style="background:${c.pageColor}"></span><span style="background:${c.accent}"></span></button>`).join('')}</div>
      <div class="fbrow"><div><label for="dkp">Page color</label><input type="color" id="dkp" data-dk="pageColor" value="${okColor(d.pageColor)||'#eef2fa'}"></div><div><label for="dkf">Form color</label><input type="color" id="dkf" data-dk="formColor" value="${okColor(d.formColor)||'#ffffff'}"></div></div>
      <div class="fbrow"><div><label for="dkt">Font color</label><input type="color" id="dkt" data-dk="fontColor" value="${okColor(d.fontColor)||'#14202a'}"></div><div><label for="dki">Input background</label><input type="color" id="dki" data-dk="inputBg" value="${okColor(d.inputBg)||'#ffffff'}"></div></div>
      <div class="fbrow"><div><label for="dka">Button color</label><input type="color" id="dka" data-dk="accent" value="${okColor(d.accent)||'#0b3fb5'}"></div><div></div></div>`;
    else if(t==='styles')body=`<label>Font</label>${sel('font',[['sans','Clean sans-serif'],['serif','Classic serif'],['mono','Typewriter'],['rounded','Friendly rounded']])}<div style="height:10px"></div>
      <label>Text size</label>${sel('size',[['medium','Medium'],['small','Small'],['large','Large']])}<div style="height:10px"></div><label>Corners</label>${sel('radius',[['soft','Soft'],['square','Square'],['round','Round']])}`;
    else if(t==='themes')body=`<div class="fbthemes">${THEMES.map(([n,c])=>`<button type="button" data-act="fbTheme" data-n="${esc(n)}"><b>${esc(n)}</b><div class="fbmini"><i style="background:${c.pageColor}"></i><i style="background:${c.formColor}"></i><i style="background:${c.accent}"></i></div></button>`).join('')}</div>`;
    else body=`<label>Form width</label>${sel('width',[['standard','Standard'],['narrow','Narrow'],['wide','Wide']])}<div style="height:10px"></div>
      <label>Label position</label>${sel('labelPos',[['top','Above the field'],['left','Beside the field']])}<div style="height:10px"></div><label>Spacing between fields</label>${sel('spacing',[['comfortable','Comfortable'],['compact','Compact'],['roomy','Roomy']])}`;
    return `<h3>Form Designer</h3><div class="fbtabs2" role="tablist">${tabs.map(([k,l])=>`<button type="button" role="tab" aria-selected="${t===k}" data-act="fbDTab" data-t="${k}">${l}</button>`).join('')}</div>${body}
      <div style="margin-top:14px"><button type="button" class="btn ghost sm" data-act="fbResetDesign">Reset design</button></div>`;
  }
  function propsHTML(f,x){
    const i=f.fields.indexOf(x),isText=['head','para'].includes(x.type),hasOpts=['select','radio','check'].includes(x.type);
    const triggers=f.fields.slice(0,i).filter(q=>['select','radio','yesno','check','short'].includes(q.type));
    const trig=x.showIf?f.fields.find(q=>q.id===x.showIf.fid):null;
    let valCtl='';
    if(trig){if(trig.type==='yesno')valCtl=`<select id="fbpVal"><option ${x.showIf.val==='Yes'?'selected':''}>Yes</option><option ${x.showIf.val==='No'?'selected':''}>No</option></select>`;
      else if(trig.opts&&trig.opts.length)valCtl=`<select id="fbpVal">${trig.opts.map(o=>`<option ${x.showIf.val===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
      else valCtl=`<input type="text" id="fbpVal" value="${esc(x.showIf.val)}" maxlength="100">`}
    return `<h3>${isText?(x.type==='head'?'Heading':'Text block'):'Field properties'}</h3>
      <label for="fbpLabel">${x.type==='para'?'Text':'Label'}</label>${x.type==='para'?`<textarea id="fbpLabel" rows="4" maxlength="2000">${esc(x.label)}</textarea>`:`<input type="text" id="fbpLabel" value="${esc(x.label)}" maxlength="300">`}
      ${isText?'':`<div style="height:10px"></div><label for="fbpHelp">Help text</label><input type="text" id="fbpHelp" value="${esc(x.help||'')}" maxlength="300">
      <label class="chk" style="display:flex;gap:8px;align-items:center;margin:12px 0"><input type="checkbox" id="fbpReq" ${x.req?'checked':''}> Required</label>
      ${hasOpts?`<label for="fbpOpts">Options (one per line)</label><textarea id="fbpOpts" rows="5">${esc((x.opts||[]).join('\n'))}</textarea><div style="height:10px"></div>`:''}
      ${['short','long','email','phone','number','date','idno','select','radio','check','yesno','file','sign'].includes(x.type)?`<label for="fbpType">Field type</label><select id="fbpType">${TYPES.map(([v,l])=>`<option value="${v}" ${x.type===v?'selected':''}>${l}</option>`).join('')}</select><div style="height:10px"></div>`:''}
      <label for="fbpTrig">Show only if…</label>${triggers.length?`<select id="fbpTrig"><option value="">Always show</option>${triggers.map(q=>`<option value="${esc(q.id)}" ${x.showIf&&x.showIf.fid===q.id?'selected':''}>${esc(q.label)}</option>`).join('')}</select>`:'<div class="note">Add a question above this one to use as the trigger.</div>'}
      ${trig?`<div style="height:8px"></div><label for="fbpVal">…is</label>${valCtl}`:''}`}
      <div class="row" style="margin-top:16px"><button type="button" class="btn sm" data-act="fbDone">Done</button><button type="button" class="btn sm bad" data-act="fbDel" data-id="${esc(x.id)}">Delete</button></div>`;
  }
  const cmdBar=()=>`<div class="fbcol" style="margin-bottom:12px"><label for="fbCmd" style="font-weight:600;display:block;margin-bottom:6px">Change this form with words</label>
    <div class="row" style="flex-wrap:nowrap"><input type="text" id="fbCmd" value="${esc(FB.cmd)}" placeholder="e.g. add a dropdown called Source of funds with options Salary, Business, Savings" maxlength="300" style="flex:1;min-width:0">
    <button class="btn" type="button" data-act="fbApply">Apply</button></div>
    <div class="row" style="flex-wrap:wrap;margin-top:6px">${['make phone required','add a phone number','remove the nationality field','move Signature to the bottom','make all questions friendlier'].map(t=>`<button type="button" class="btn ghost sm" data-act="fbEx" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    ${FB.cmdOut?`<div class="fbnote" style="margin-top:8px" role="status">${md(FB.cmdOut)}</div>`:''}</div>`;

  /* ---------- BUILD ---------- */
  function buildView(f){
    const x=selField(f);
    return `${cmdBar()}<div class="fbgrid">
      <aside class="fbcol" aria-label="Form elements"><h3>Form elements</h3><div class="fbpal">${ELEMENTS.map(([k,l,ic])=>`<button type="button" class="fbpalitem" draggable="true" data-pal="${k}" data-act="fbAdd" data-k="${k}"><i aria-hidden="true">${ic}</i><span>${l}</span></button>`).join('')}</div>
        <p class="note" style="margin:10px 0 0">Drag an element onto the form, or click it to add it${FB.sel?' after the selected field':' at the end'}.</p></aside>
      <main id="fbCanvas">${canvasHTML(f)}</main>
      <aside class="fbcol fbside" id="fbSide" aria-label="${x?'Field properties':'Form designer'}">${x?propsHTML(f,x):designerHTML(f)}</aside></div>`;
  }

  /* ---------- SETTINGS ---------- */
  const SNAV=[['form','Form settings','Customize form status and properties'],['emails','Emails','Set up autoresponders and notifications'],['conditions','Conditions','Set up conditional logic'],['thanks','Thank you page','Show page after submission'],['integrations','Integrations','Connect your form to other apps'],['approval','Approval flows','Review and decide on responses']];
  function condBuilder(f){
    const fs=f.fields,qs=fs.filter(x=>!['head','para'].includes(x.type)),c=FB.cond;
    const sel=(id,list)=>`<select id="${id}">${list.map(x=>`<option value="${esc(x.id)}">${esc(x.label)}</option>`).join('')}</select>`;
    const active=fs.filter(x=>x.showIf);
    let panel='';
    if(c==='show')panel=`<div class="fbcol" style="margin:8px 0 14px"><h3>Show or hide a field</h3>
      <div class="fbrow"><div><label for="cShow">Show this field</label>${qs.length>1?sel('cShow',qs.slice(1)):'<div class="note">Add at least two questions first.</div>'}</div><div><label for="cTrig">only when this field</label>${qs.length>1?sel('cTrig',qs):''}</div></div>
      ${qs.length>1?`<label for="cVal">is equal to</label><input type="text" id="cVal" placeholder="e.g. Yes, or one of the options" maxlength="100" style="max-width:340px"><div style="margin-top:10px"><button class="btn" type="button" data-act="fbCondShow">Add condition</button></div>`:''}</div>`;
    if(c==='require')panel=`<div class="fbcol" style="margin:8px 0 14px"><h3>Require or make optional</h3>
      <div class="fbrow"><div><label for="cReqF">Field</label>${qs.length?sel('cReqF',qs):'<div class="note">No questions yet.</div>'}</div><div><label for="cReqV">Make it</label><select id="cReqV"><option value="1">Required</option><option value="0">Optional</option></select></div></div>
      ${qs.length?`<button class="btn" type="button" data-act="fbCondReq">Apply</button>`:''}</div>`;
    const card=(cls,key,t,d,on)=>`<button type="button" class="fbcond ${cls}" ${on?`data-act="${key}"`:'disabled aria-disabled="true"'}><span><b>${t}</b><small>${d}</small></span><span aria-hidden="true">${on?'›':'Not available yet'}</span></button>`;
    return `<h3 style="margin-top:0">New condition</h3><p class="note" style="margin-top:0">Automatically change the form if a condition is met.</p>${panel}
      ${card('c1','fbCondOpen:show','Show/Hide field','Change visibility of specific form fields',true)}
      ${card('c2','','Update/Calculate field','Copy a field\'s value or perform complex calculations',false)}
      ${card('c3','fbCondOpen:require','Require/Optional field','Require or relax a field (masking is not available)',true)}
      ${card('c4','','Skip to/Hide a page','Forms here have a single page',false)}
      ${card('c5','fbToThanks','Change thank you page','Customize your thank you message',true)}
      ${card('c6','','Change email recipient','Send emails to specific people',false)}
      <h3>Active conditions</h3>${active.length?`<div class="tbl"><table><tbody>${active.map(x=>{const d=fs.find(q=>q.id===x.showIf.fid);return `<tr><td><b>${esc(x.label)}</b> is shown only if <b>${esc(d?d.label:'(removed)')}</b> is <b>${esc(x.showIf.val)}</b></td><td><button class="btn ghost sm" data-act="fbCondRemove" data-id="${esc(x.id)}">Remove</button></td></tr>`}).join('')}</tbody></table></div>`:'<p class="note">No conditions yet.</p>'}`;
  }
  function parseDraft(t){const s=(t.match(/\*\*Subject:\*\* (.+)/)||[])[1]||'';let b=t.split(/\*\*Subject:\*\* .+\n\n/)[1]||'';b=b.split(/\n\nI cannot send/)[0];return {subject:s,body:b}}
  function settingsView(f){
    const st=FB.sTab,em=(f.settings&&f.settings.email)||{};let body='';
    if(st==='form')body=`<h3 style="margin-top:0">Form settings</h3><div class="form" style="grid-template-columns:1fr"><label>Form title<input type="text" data-sf="title" value="${esc(f.title)}" maxlength="120"></label>
      <label>Description<textarea data-sf="desc" rows="3" maxlength="600">${esc(f.desc||'')}</textarea></label>
      <label>Status<select data-sf="status"><option value="open" ${f.status!=='closed'?'selected':''}>Accepting responses</option><option value="closed" ${f.status==='closed'?'selected':''}>Closed</option></select></label>
      <label>Who fills it in<select data-sf="audience"><option value="client" ${f.audience!=='staff'?'selected':''}>Clients (anyone with the link)</option><option value="staff" ${f.audience==='staff'?'selected':''}>Staff (signed-in employees)</option></select></label>
      <label>Category<input type="text" data-sf="category" value="${esc(f.category||'General')}" maxlength="40"></label></div>
      <div class="row" style="margin-top:14px;flex-wrap:wrap"><button class="btn ghost" data-act="fbExport" data-id="${esc(f.id)}">Export form file</button><button class="btn ghost" data-act="fbClassic" data-id="${esc(f.id)}">Open in the classic editor</button><button class="btn bad" data-act="fbDeleteForm" data-id="${esc(f.id)}">Delete form</button></div>`;
    else if(st==='emails')body=`<h3 style="margin-top:0">Emails</h3><div class="fbnote" style="margin-bottom:12px">Sending email from this system is not available yet. Write the confirmation message here; it is saved with the form and ready for when email sending is connected, and you can copy it into your own email program now. New responses already alert admins inside the app.</div>
      <div class="form" style="grid-template-columns:1fr"><label>Autoresponder subject<input type="text" data-em="subject" value="${esc(em.subject||'')}" maxlength="200" placeholder="We received your ${esc(f.title)}"></label>
      <label>Autoresponder message<textarea data-em="body" rows="9" maxlength="4000" placeholder="Dear [Name], ...">${esc(em.body||'')}</textarea></label></div>
      <div class="row" style="margin-top:10px"><button class="btn" data-act="fbDraftEmail">Draft with words</button><button class="btn ghost" data-act="fbCopyEmail">Copy message</button></div>`;
    else if(st==='conditions')body=condBuilder(f);
    else if(st==='thanks')body=`<h3 style="margin-top:0">Thank you page</h3><label>Message shown after someone submits<textarea data-sf="thanks" rows="4" maxlength="1000">${esc(f.thanks||'Thank you. Your response has been recorded.')}</textarea></label>
      <h3>Preview</h3><div class="fbpage" style="${esc(dvars(f.design))}"><div class="fbform"><h2 style="margin:0 0 8px">${esc(f.title)}</h2><p id="fbThanksPv" style="margin:0">${esc(f.thanks||'Thank you. Your response has been recorded.')}</p></div></div><p class="note">Redirecting to another web page is not available.</p>`;
    else if(st==='integrations')body=`<h3 style="margin-top:0">Integrations</h3><div class="fbnote">Connecting this form to other apps (spreadsheets, chat, WhatsApp, payments, automation tools) is not available yet. It needs outside accounts and a server. You can export responses as a CSV file from the Client KYC page, and share the form with a link or embed code on the Publish tab.</div>`;
    else body=`<h3 style="margin-top:0">Approval flows</h3><div class="fbnote">Every response lands in <b>Client KYC</b> as <b>Pending</b>. An administrator can approve it, reject it, ask for more information, add notes and print the record. ${f.audience==='staff'?'Staff forms appear on each employee\'s Requests page.':''}</div>
      <div style="margin-top:12px"><button class="btn" data-act="fbToKyc">Open Client KYC</button></div>`;
    return `<div class="fbsettings"><nav class="fbsnav" aria-label="Settings sections">${SNAV.map(([k,t,d])=>`<button type="button" data-act="fbSTab" data-t="${k}" aria-selected="${st===k}"><b>${t}</b><small>${d}</small></button>`).join('')}</nav><div class="fbcol">${body}</div></div>`;
  }

  /* ---------- PUBLISH ---------- */
  const PNAV=[['share','Quick share','Direct form link and social share'],['embed','Embed','Various webpage embed options'],['assign','Assign form','Tell people to fill it in'],['email','Email','Invitation to send'],['prefill','Prefill','Pre-populate your forms'],['pdf','PDF','Print or save a blank copy'],['platforms','Platforms','Website and social options']];
  const linkOk=f=>live&&isUuid(f.id);
  function warn(f){
    if(!live)return `<div class="fbnote" style="margin-bottom:12px">You are in sample mode. Links only work in the live system.</div>`;
    if(!isUuid(f.id))return `<div class="fbnote" style="margin-bottom:12px">Saving this form… the link will appear in a moment.</div>`;
    if(f.audience==='staff')return `<div class="fbnote" style="margin-bottom:12px">This is a staff form. Staff open it from their <b>Requests</b> page after signing in. Public links are only for client forms (change this in Settings).</div>`;
    return '';
  }
  const embedCode=f=>`<iframe src="${shareUrl(f)}&embed=1" title="${esc(f.title)}" width="100%" height="${esc(FB.embedH)}" style="border:0;max-width:100%" loading="lazy"></iframe>`;
  function inviteDraft(f){return FB.inv||(FB.inv={subject:`Please complete: ${f.title}`,body:`Dear [Name],\n\nPlease complete our ${f.title} using the secure link below. It only takes a few minutes.\n\n${linkOk(f)?shareUrl(f):'[form link]'}\n\nThank you.\nVirtuous Accounting Solutions CC`})}
  function prefillUrl(f){
    const p=new URLSearchParams();let any=false;
    f.fields.forEach(x=>{const v=FB.pref[x.id];if(v!=null&&v!==''&&!['head','para','file','sign'].includes(x.type)){p.set('p_'+slug(x.label),v);any=true}});
    return shareUrl(f)+(any?'&'+p.toString():'');
  }
  function publishView(f){
    const pt=FB.pTab,ok=linkOk(f),url=ok?shareUrl(f):'';let body='';
    if(pt==='share')body=`<h3 style="margin-top:0">Quick share</h3>${warn(f)}
      <label class="chk" style="display:flex;gap:10px;align-items:center;margin-bottom:12px"><input type="checkbox" id="fbPublic" ${f.publicLink?'checked':''} ${f.audience==='staff'?'disabled':''}> Anyone with the link can fill in this form (no sign-in)</label>
      ${f.status==='closed'?'<div class="fbnote" style="margin-bottom:12px">This form is closed, so the link shows "not available". Reopen it in Settings.</div>':''}
      <div class="row" style="margin-bottom:12px"><button class="btn ghost" data-act="fbFill" data-id="${esc(f.id)}">Fill in this form now</button></div>
      ${ok?`<label>Form link</label><div class="row" style="flex-wrap:nowrap"><input type="text" readonly value="${esc(url)}" style="flex:1;min-width:0" aria-label="Form link"><button class="btn" data-act="fbCopy" data-v="${esc(url)}">Copy link</button></div>
      ${f.publicLink?'':'<p class="note">Turn on the option above to let people open this link.</p>'}
      <div class="row" style="margin-top:14px;flex-wrap:wrap"><a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(f.title+' '+url)}">Share on WhatsApp</a><a class="btn ghost sm" target="_blank" rel="noopener" href="mailto:?subject=${encodeURIComponent(f.title)}&body=${encodeURIComponent(url)}">Share by email</a><a class="btn ghost sm" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}">Share on Facebook</a><a class="btn ghost sm" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}">Share on LinkedIn</a></div>`:''}`;
    else if(pt==='embed')body=`<h3 style="margin-top:0">Embed</h3>${warn(f)}<label style="max-width:240px">Height<select id="fbEmbedH">${['600','800','1000','1200','1600'].map(h=>`<option ${FB.embedH===h?'selected':''}>${h}</option>`).join('')}</select></label>
      ${ok?`<p class="note">Paste this into the HTML of your web page. The form must be shared (Quick share) for visitors to see it.</p><div class="fbcode" id="fbEmbedCode">${esc(embedCode(f))}</div><div style="margin-top:10px"><button class="btn" data-act="fbCopy" data-v="${esc(embedCode(f))}">Copy embed code</button></div>`:''}`;
    else if(pt==='assign')body=`<h3 style="margin-top:0">Assign form</h3>${f.audience==='staff'?'':'<div class="fbnote" style="margin-bottom:12px">Client forms are filled in by people outside the firm using the link. You can still notify employees about this form.</div>'}
      <p class="note" style="margin-top:0">Choose people to notify. They get an alert in the app asking them to complete <b>${esc(f.title)}</b>${f.audience==='staff'?' (it is on their Requests page)':''}.</p>
      ${FB.people===null?'<p class="note">Loading people…</p>':FB.people.length?`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:4px;margin-bottom:12px">${FB.people.map(p=>`<label class="chk" style="display:flex;gap:8px;align-items:center;margin:0"><input type="checkbox" data-asg="${esc(p.id)}" ${FB.assign.sel[p.id]?'checked':''}> ${esc(p.name)}</label>`).join('')}</div>`:'<p class="note">There are no employees yet.</p>'}
      <label>Message<textarea id="fbAssignMsg" rows="3" maxlength="300">${esc(FB.assign.msg||`Please complete the form: ${f.title}.`)}</textarea></label>
      <div class="row" style="margin-top:10px"><button class="btn" data-act="fbAssignSend">Send notification</button></div>${FB.assign.out?`<div class="fbnote" style="margin-top:10px" role="status">${esc(FB.assign.out)}</div>`:''}`;
    else if(pt==='email'){const iv=inviteDraft(f);body=`<h3 style="margin-top:0">Email invitation</h3>${warn(f)}<p class="note" style="margin-top:0">Edit the invitation, then open it in your email program. Sending email from this system is not available yet.</p>
      <div class="form" style="grid-template-columns:1fr"><label>Subject<input type="text" data-inv="subject" value="${esc(iv.subject)}" maxlength="200"></label><label>Message<textarea data-inv="body" rows="9" maxlength="4000">${esc(iv.body)}</textarea></label></div>
      <div class="row" style="margin-top:10px"><a class="btn" id="fbMailto" href="mailto:?subject=${encodeURIComponent(iv.subject)}&body=${encodeURIComponent(iv.body)}">Open in my email app</a><button class="btn ghost" data-act="fbCopyInvite">Copy message</button></div>`}
    else if(pt==='prefill')body=`<h3 style="margin-top:0">Prefill</h3>${warn(f)}<p class="note" style="margin-top:0">Fill in the answers you already know. The link you copy opens the form with those answers filled in. Do not put sensitive information in links.</p>
      <div class="form" style="grid-template-columns:1fr 1fr">${f.fields.filter(x=>!['head','para','file','sign'].includes(x.type)).map(x=>`<label>${esc(x.label)}<input type="text" data-pref="${esc(x.id)}" value="${esc(FB.pref[x.id]||'')}" maxlength="300"></label>`).join('')||'<p class="note">This form has no fields that can be prefilled.</p>'}</div>
      ${ok?`<label style="margin-top:12px;display:block">Prefilled link</label><div class="fbcode" id="fbPrefUrl">${esc(prefillUrl(f))}</div><div style="margin-top:10px"><button class="btn" data-act="fbCopyPref">Copy prefilled link</button></div>`:''}`;
    else if(pt==='pdf')body=`<h3 style="margin-top:0">PDF</h3><p class="note" style="margin-top:0">Open a print-ready blank copy of this form. Choose <b>Save as PDF</b> in the print window to keep a file. Fillable PDFs are not available.</p><button class="btn" data-act="fbPrint">Print or save as PDF</button>`;
    else body=`<h3 style="margin-top:0">Platforms</h3>${warn(f)}<p class="note" style="margin-top:0">These sites do not connect directly. Use the link or the embed code.</p><div class="fbplat">
      ${[['WordPress','Add a "Custom HTML" block to your page, paste the embed code, then update the page.',1],['Wix','Add an "Embed code" element, choose "Embed HTML", paste the embed code and apply.',1],['Squarespace','Add a "Code" block, untick "Display source", paste the embed code and save.',1],['Weebly','Drag an "Embed code" element onto the page, choose "Edit custom HTML" and paste the embed code.',1],['Google Sites','Choose Insert, then "Embed", pick "Embed code" and paste it.',1],['Facebook, WhatsApp and Instagram','Share the form link in a post, message or bio. Use the Quick share tab.',0]].map(([n,s,e])=>`<div><b>${n}</b><span class="note">${s}</span>${ok?`<div><button class="btn ghost sm" data-act="fbCopy" data-v="${esc(e?embedCode(f):url)}">${e?'Copy embed code':'Copy link'}</button></div>`:''}</div>`).join('')}</div>`;
    return `<div class="fbsettings"><nav class="fbsnav" aria-label="Publish options">${PNAV.map(([k,t,d])=>`<button type="button" data-act="fbPTab" data-t="${k}" aria-selected="${pt===k}"><b>${t}</b><small>${d}</small></button>`).join('')}</nav><div class="fbcol">${body}</div></div>`;
  }
  function printHTML(f){
    const row=x=>{
      if(x.type==='head')return `<h2>${esc(x.label)}</h2>`;if(x.type==='para')return `<p>${esc(x.label)}</p>`;
      let c='<div class="line"></div>';
      if(['long'].includes(x.type))c='<div class="box"></div>';
      if(['radio','select','check','yesno'].includes(x.type))c=(x.type==='yesno'?['Yes','No']:x.opts||[]).map(o=>`<div class="o">&#9744; ${esc(o)}</div>`).join('');
      if(x.type==='file')c='<div class="note">Attach a copy: '+esc(x.label)+'</div>';
      if(x.type==='sign')c='<div class="sig"></div>';
      if(x.type==='date')c='<div class="line"><span class="note">DD / MM / YYYY</span></div>';
      return `<div class="q"><div class="l">${esc(x.label)}${x.req?' *':''}</div>${x.help?`<div class="note">${esc(x.help)}</div>`:''}${c}</div>`;
    };
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(f.title)}</title><style>body{font:14px/1.5 system-ui,Arial,sans-serif;color:#111;margin:28px;max-width:760px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;border-bottom:2px solid #111;padding-bottom:3px;margin:20px 0 8px}.q{margin:0 0 14px;page-break-inside:avoid}.l{font-weight:700}.line{border-bottom:1px solid #111;height:26px}.box{border:1px solid #111;height:90px}.sig{border-bottom:1px solid #111;height:60px;width:300px}.o{margin:2px 0}.note{color:#555;font-size:12px}.foot{margin-top:26px;font-size:11px;color:#555}</style></head><body><h1>${esc(f.title)}</h1><p>${esc(f.desc||'')}</p>${f.fields.map(row).join('')}<p class="foot">Virtuous Accounting Solutions CC, Windhoek, Namibia</p></body></html>`;
  }

  /* ---------- LIST view and creation ---------- */
  function createPanel(){
    const t=FB.create;if(!t)return '';
    const tabs=[['describe','Describe it'],['templates','Templates'],['quiz','Quiz from text'],['blank','Blank form']];
    let body='';
    if(t==='describe')body=`<label class="wide">Describe your form<textarea id="fbPrompt" data-v="fbPrompt" rows="3" maxlength="1000" placeholder="e.g. Create a client onboarding form with name, email, phone, source of funds (Salary, Business, Savings) and a copy of ID">${esc(FB.v.fbPrompt||'')}</textarea></label>
      <div class="row" style="flex-wrap:wrap;margin:6px 0">${['Create a client onboarding form with name, email, phone and a copy of ID','Create a staff survey called Office feedback with rating, what do you like, comments','Create a contact form with name, email and message'].map(x=>`<button type="button" class="btn ghost sm" data-act="fbEx2" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <button class="btn" data-act="fbCreateGo">Build form</button>`;
    else if(t==='templates')body=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">${F().TEMPLATES.map(([k,n,d])=>`<div style="border:1px solid var(--line);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:6px"><b>${esc(n)}</b><span class="note">${esc(d)}</span><div><button class="btn sm" data-act="fbTpl" data-k="${k}">Use template</button></div></div>`).join('')}</div><p class="note">Wording for waivers and agreements is a starting point, not legal advice.</p>`;
    else if(t==='quiz')body=`<p class="note" style="margin-top:0">Paste notes or text. Facts (numbers, names, key terms) become multiple-choice questions, with a private answer key. PDF and Word files cannot be read yet. Automatic marking is not built yet.</p>
      <label class="wide">Text to build the quiz from<textarea id="fbQuizText" data-v="fbQuizText" rows="7" maxlength="8000" placeholder="Paste at least a few sentences with specific facts…">${esc(FB.v.fbQuizText||'')}</textarea></label>
      <label style="max-width:200px">Number of questions<select data-v="fbQuizN">${[3,5,8,10,15].map(n=>`<option ${+(FB.v.fbQuizN||5)===n?'selected':''}>${n}</option>`).join('')}</select></label><div style="margin-top:10px"><button class="btn" data-act="fbQuizGo">Build quiz</button></div>`;
    else body=`<p class="note" style="margin-top:0">Start with an empty form and add elements yourself.</p><button class="btn" data-act="fbBlank">Create blank form</button>`;
    return `<div class="panel"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Create a form</h3><button class="btn ghost sm" data-act="fbCreateClose">Close</button></div>
      <div class="row" role="tablist" style="margin:10px 0;flex-wrap:wrap">${tabs.map(([k,l])=>`<button class="btn ${t===k?'':'ghost'} sm" role="tab" aria-selected="${t===k}" data-act="fbCreateTab" data-t="${k}">${l}</button>`).join('')}</div>${body}${FB.out.create?`<div class="fbnote" style="margin-top:12px" role="status">${md(FB.out.create)}</div>`:''}</div>`;
  }
  function listView(){
    const fs=forms();
    return `<h2>Form builder</h2><p class="sub">Build forms visually, change them in plain words, share them with a link, and review responses. No AI service or key is used.</p>
    <div class="stack"><div class="row" style="flex-wrap:wrap"><button class="btn" data-act="fbCreateOpen">Create form</button><button class="btn ghost" data-act="fbImportPick">Import form</button><input type="file" id="fbImportFile" data-fbimport="1" accept=".json,application/json" hidden aria-label="Import a form file"></div>
    ${FB.importMsg?`<div class="fbnote" role="status">${esc(FB.importMsg)}</div>`:''}${createPanel()}
    <div class="panel"><h3>Your forms</h3><div class="tbl"><table style="min-width:900px"><thead><tr><th>Form</th><th>For</th><th class="n">Questions</th><th class="n">Responses</th><th>Status</th><th></th></tr></thead><tbody>
    ${fs.map(f=>`<tr><td>${esc(f.title)}<div class="note">${esc(f.category||'General')}${f.publicLink?' · shared link on':''}</div></td><td>${f.audience==='staff'?'Staff':'Clients'}</td><td class="n">${real(f).length}</td><td class="n">${subsOf(f).length}</td><td>${pill(f.status==='closed'?'Closed':'Accepting',f.status==='closed'?'warn':'ok')}</td>
      <td><div class="row"><button class="btn sm" data-act="fbEdit" data-id="${esc(f.id)}">Edit</button><button class="btn sm ghost" data-act="fbPreviewRow" data-id="${esc(f.id)}">Preview</button><button class="btn sm ghost" data-act="fbFill" data-id="${esc(f.id)}">Fill now</button><button class="btn sm ghost" data-act="fbShare" data-id="${esc(f.id)}">Share</button><button class="btn sm ghost" data-act="fbResp" data-id="${esc(f.id)}">Responses</button><button class="btn sm ghost" data-act="fbExport" data-id="${esc(f.id)}">Export</button><button class="btn sm ghost" data-act="fbCopyForm" data-id="${esc(f.id)}">Duplicate</button></div></td></tr>`).join('')||'<tr><td colspan="6" class="note">No forms yet. Click Create form.</td></tr>'}
    </tbody></table></div></div>
    ${FB.ana.show?`<div class="panel"><h3>Responses: summary and report</h3><div class="form"><label>Form<select data-v="anaId">${'<option value="">All forms with responses</option>'+fs.map(f=>`<option value="${esc(f.id)}" ${FB.ana.id===f.id?'selected':''}>${esc(f.title)}</option>`).join('')}</select></label>
      <label class="chk" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-v="anaReport" ${FB.ana.report?'checked':''}> Draft as a report</label></div><div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn" data-act="fbAnalyse">Analyse responses</button>${FB.ana.id?`<button class="btn ghost" data-act="fbRespCsv">Export responses (CSV)</button>`:''}</div>
      ${FB.ana.text?`<div class="fbnote" style="margin-top:10px" role="status">${md(FB.ana.text)}</div>`:''}</div>`:''}
    <div class="panel"><p class="note" style="margin:0"><b>Not available:</b> chat and phone agents, WhatsApp, Messenger, Instagram and website bots, live-chat handoff, an app builder, reading PDF or Word files, payment fields, calculations, multi-page forms, and sending email from here. These need an AI model, outside accounts and a server.</p></div></div>`;
  }

  /* ---------- the page ---------- */
  function editView(f){
    const tabs=[['build','BUILD'],['settings','SETTINGS'],['publish','PUBLISH']];
    return `<div class="fbbar"><div class="fbbarin"><button class="fbback" data-act="fbBack">← Forms</button>
      <div class="fbmid"><div class="fbname" id="fbName">${esc(f.title)}</div><div class="fbsave" id="fbSave" role="status">${esc(saveText())}</div></div>
      <div class="fbtabs" role="tablist" aria-label="Form builder modes">${tabs.map(([k,l])=>`<button role="tab" aria-selected="${FB.mode===k}" data-act="fbMode" data-m="${k}">${l}</button>`).join('')}</div>
      <div class="fbact"><button class="fbback" data-act="fbPreviewBtn" aria-pressed="${FB.preview&&FB.mode==='build'}">${FB.preview&&FB.mode==='build'?'Exit preview':'Preview'}</button><button class="fbback" data-act="fbFill" data-id="${esc(f.id)}">Fill now</button><button class="fbback" data-act="fbExport" data-id="${esc(f.id)}">Export</button></div></div></div>
      ${FB.mode==='build'?buildView(f):FB.mode==='settings'?settingsView(f):publishView(f)}`;
  }
  function vFormBuilder(){
    if(FB.view==='edit'){const f=cur();if(f)return editView(f);FB.view='list'}
    return listView();
  }
  ICON.formbuilder='<path d="M5 19l9-9"/><path d="M13 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/><path d="M18 12l.7 1.3L20 14l-1.3.7L18 16l-.7-1.3L16 14l1.3-.7z"/>';
  const people=NAV.adm.find(g=>g[0]==='People');
  if(people&&!people[1].some(x=>x[0]==='formbuilder')){const i=people[1].findIndex(x=>x[0]==='kyc');people[1].splice(i+1,0,['formbuilder','Form builder'])}
  VIEWS.formbuilder=vFormBuilder;
  window.VIRTUOSO_FB={open:(id,mode)=>openEditor(id,mode)};

  /* ---------- model changes ---------- */
  const redrawCanvas=()=>{const f=cur(),c=document.getElementById('fbCanvas');if(f&&c)c.innerHTML=canvasHTML(f)};
  const redrawSide=()=>{const f=cur(),s=document.getElementById('fbSide');if(f&&s){const x=selField(f);s.innerHTML=x?propsHTML(f,x):designerHTML(f)}};
  function mkField(spec){const o={opts:spec.opts?(typeof spec.opts==='function'?spec.opts():spec.opts.slice()):[],req:false};return kF(spec.type,spec.label,o)}
  function addField(key,idx){
    const f=cur();if(!f)return;const el=ELEMENTS.find(e=>e[0]===key);if(!el)return;
    const x=mkField(el[3]);
    let at=idx;if(at==null){const s=selField(f);at=s?f.fields.indexOf(s)+1:f.fields.length}
    f.fields.splice(Math.max(0,Math.min(at,f.fields.length)),0,x);FB.sel=x.id;render();
    const b=document.querySelector(`.fbblock[data-fid="${x.id}"]`);b&&b.scrollIntoView&&b.scrollIntoView({block:'nearest'});
  }
  function moveField(id,idx){
    const f=cur();if(!f)return;const from=f.fields.findIndex(x=>x.id===id);if(from<0)return;
    const [x]=f.fields.splice(from,1);if(from<idx)idx--;f.fields.splice(Math.max(0,Math.min(idx,f.fields.length)),0,x);FB.sel=x.id;render();
  }
  function delField(id){
    const f=cur();if(!f)return;f.fields=f.fields.filter(x=>x.id!==id);f.fields.forEach(q=>{if(q.showIf&&q.showIf.fid===id)q.showIf=null});if(FB.sel===id)FB.sel=null;render();
  }
  function setShowIf(f,dep,trg,val){
    dep.showIf={fid:trg.id,val};const di=f.fields.indexOf(dep),ti=f.fields.indexOf(trg);
    if(di<ti){f.fields.splice(di,1);f.fields.splice(f.fields.indexOf(trg)+1,0,dep)}
  }
  function runCreate(key,fn){
    let text;try{text=fn()}catch(e){console.error(e);text='Something went wrong building that. Try rephrasing.'}
    if(/^Created/.test(text)){FB.out.create='';FB.create=null;openEditor(F().ctx.formId,'build');return}
    FB.out[key]=text;render();
  }


  /* ---------- export, import, fill now ---------- */
  const KINDS=['short','long','email','phone','number','date','idno','select','radio','check','yesno','file','sign','head','para'];
  const str=(v,max)=>typeof v==='string'?v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').slice(0,max):'';
  function exportForm(f){
    const doc={format:'virtuoso-form',version:1,exportedAt:new Date().toISOString(),form:{title:f.title,description:f.desc||'',thanks:f.thanks||'',category:f.category||'General',audience:f.audience==='staff'?'staff':'client',design:f.design||{},
      settings:{email:(f.settings&&f.settings.email)||undefined},fields:f.fields.map(x=>({id:x.id,type:x.type,label:x.label,help:x.help||'',required:!!x.req,options:x.opts||[],showIf:x.showIf||null,answer:x.answer!=null?x.answer:undefined}))}};
    kDownloadAnchor((slug(f.title)||'form')+'.form.json','application/json',JSON.stringify(doc,null,2));
  }
  /* Accepts only what we understand, remaps ids, and never trusts the file. Returns {form} or {error}. */
  function cleanImport(text){
    if(typeof text!=='string'||text.length>1000000)return {error:'That file is too large (limit 1 MB).'};
    let doc;try{doc=JSON.parse(text)}catch(_){return {error:'That file is not a valid form file (it could not be read as JSON).'}}
    const src=doc&&typeof doc==='object'?(doc.form&&typeof doc.form==='object'?doc.form:doc):null;
    if(!src||!Array.isArray(src.fields))return {error:'That file does not look like a form exported from here (no fields found).'};
    const rawFields=src.fields.slice(0,200),map={},fields=[];
    rawFields.forEach(r=>{
      if(!r||typeof r!=='object'||!KINDS.includes(r.type))return;
      const label=str(r.label,r.type==='para'?2000:300).trim();if(!label)return;
      const nid=uid();if(typeof r.id==='string')map[r.id]=nid;
      const opts=Array.isArray(r.options||r.opts)?(r.options||r.opts).filter(o=>typeof o==='string').map(o=>str(o,200).trim()).filter(Boolean).slice(0,100):[];
      const x={id:nid,type:r.type,label,req:!!(r.required||r.req),help:str(r.help,300),opts:['select','radio','check'].includes(r.type)?(opts.length>=2?opts:['Option 1','Option 2']):[],showIf:null};
      if(typeof r.answer==='string'&&r.answer)x.answer=str(r.answer,200);
      x._si=r.showIf&&typeof r.showIf==='object'?{fid:r.showIf.fid,val:str(String(r.showIf.val==null?'':r.showIf.val),100)}:null;
      fields.push(x);
    });
    if(!fields.length)return {error:'That file has no usable fields.'};
    fields.forEach(x=>{const si=x._si;delete x._si;if(si&&map[si.fid]&&map[si.fid]!==x.id)x.showIf={fid:map[si.fid],val:si.val}});
    const d={},sd=src.design&&typeof src.design==='object'?src.design:{};
    ['pageColor','formColor','fontColor','inputBg','accent'].forEach(k=>{if(okColor(sd[k]))d[k]=sd[k]});
    ['font','size','radius','width','spacing'].forEach(k=>{if(typeof sd[k]==='string'&&MAPS[k]&&MAPS[k][sd[k]])d[k]=sd[k]});
    if(sd.labelPos==='left'||sd.labelPos==='top')d.labelPos=sd.labelPos;
    const em=src.settings&&src.settings.email&&typeof src.settings.email==='object'?{subject:str(src.settings.email.subject,200),body:str(src.settings.email.body,4000)}:null;
    return {form:{title:str(src.title||src.name,120).trim()||'Imported form',desc:str(src.description||src.desc,600),thanks:str(src.thanks,1000)||'Thank you. Your response has been recorded.',
      category:str(src.category,40).trim()||'General',audience:src.audience==='staff'?'staff':'client',fields,design:d,settings:em&&(em.subject||em.body)?{email:em}:{}}};
  }
  function importForm(text){
    const r=cleanImport(text);if(r.error){FB.importMsg=r.error;return render()}
    kInit();const f=r.form;
    let title=f.title;if(forms().some(x=>x.title.toLowerCase()===title.toLowerCase()))title+=' (imported)';
    const nf={id:'f'+(++state.kseq+10),title,desc:f.desc,thanks:f.thanks,fields:f.fields,status:'open',created:state.today,audience:f.audience,category:f.category,design:f.design,settings:f.settings,publicLink:false};
    forms().push(nf);FB.importMsg='';toast('Imported "'+title+'" with '+f.fields.filter(x=>!['head','para'].includes(x.type)).length+' questions');
    openEditor(nf.id,'build');
  }
  function openFill(id){
    kInit();const K=state.kyc;K.formId=id;K.view='fill';K.ans={};K.errs={};K.done=null;FB.fromFill=true;state.tab.adm='kyc';document.body.classList.remove('open');window.scrollTo(0,0);render();
  }
  /* The fill screen shows the form's saved design and a way back to the builder. */
  const origFill=kFill;
  kFill=function(){
    const K=state.kyc,f=kForm(K.formId),h=origFill();
    if(!f)return h;
    const back=FB.fromFill&&state.user&&state.user.type==='admin'?`<div class="row" style="margin-bottom:10px"><button class="btn ghost sm" data-act="fbFromFill">← Back to Form builder</button></div>`:'';
    const d=f.design||{};
    return back+`<div class="fbfill" style="${esc(dvars(d))}">${h}</div>`;
  };
  const css2=document.createElement('style');
  css2.textContent=`.fbfill{background:var(--page,transparent);border-radius:12px;padding:var(--pad,0)}.fbfill:not([style=""]){padding:16px}
  .fbfill .panel{background:var(--form,var(--surface));color:var(--fg2,var(--fg));font-family:var(--ff,inherit);border-radius:calc(var(--rad,8px) + 4px)}
  .fbfill input:not([type=checkbox]):not([type=radio]),.fbfill select,.fbfill textarea{background:var(--inbg,var(--bg));color:inherit;border-radius:var(--rad,8px)}
  .fbfill .btn:not(.ghost):not(.bad){background:var(--acc,var(--accent));border-color:var(--acc,var(--accent))}`;
  document.head.appendChild(css2);

  /* ---------- events ---------- */
  document.addEventListener('input',e=>{
    const t=e.target;if(!t||!document.getElementById('view')||!document.getElementById('view').contains(t))return;
    const f=cur();
    if(t.dataset&&t.dataset.v){FB.v[t.dataset.v]=t.value;return}
    if(!f)return;
    if(t.id==='fbCmd'){FB.cmd=t.value;return}
    if(t.id==='fbTitle'){f.title=t.value;const n=document.getElementById('fbName');if(n)n.textContent=t.value;return}
    if(t.id==='fbDesc'){f.desc=t.value;return}
    if(t.dataset&&t.dataset.dk){f.design=f.design||{};f.design[t.dataset.dk]=t.value;redrawCanvas();return}
    const x=selField(f);
    if(x&&t.id==='fbpLabel'){x.label=t.value;redrawCanvas();return}
    if(x&&t.id==='fbpHelp'){x.help=t.value;redrawCanvas();return}
    if(x&&t.id==='fbpOpts'){x.opts=t.value.split('\n').map(s=>s.trim()).filter(Boolean);redrawCanvas();return}
    if(x&&t.id==='fbpVal'&&t.tagName==='INPUT'&&x.showIf){x.showIf.val=t.value;redrawCanvas();return}
    if(t.dataset&&t.dataset.sf){const k=t.dataset.sf;if(k==='title'||k==='desc'||k==='category'||k==='thanks'){f[k]=t.value;if(k==='title'){const n=document.getElementById('fbName');if(n)n.textContent=t.value}if(k==='thanks'){const p=document.getElementById('fbThanksPv');if(p)p.textContent=t.value}}return}
    if(t.dataset&&t.dataset.em){f.settings=f.settings||{};f.settings.email=f.settings.email||{};f.settings.email[t.dataset.em]=t.value;return}
    if(t.dataset&&t.dataset.inv){FB.inv=FB.inv||{};FB.inv[t.dataset.inv]=t.value;const a=document.getElementById('fbMailto');if(a){const iv=inviteDraft(f);a.href='mailto:?subject='+encodeURIComponent(iv.subject)+'&body='+encodeURIComponent(iv.body)}return}
    if(t.dataset&&t.dataset.pref){FB.pref[t.dataset.pref]=t.value;const u=document.getElementById('fbPrefUrl');if(u)u.textContent=prefillUrl(f);return}
    if(t.id==='fbAssignMsg'){FB.assign.msg=t.value;return}
    if(FB.preview&&t.dataset&&t.dataset.pv&&!['radio','checkbox'].includes(t.type)&&t.tagName!=='SELECT'){FB.pv.ans[t.dataset.pv]=t.value}
  },true);

  document.addEventListener('change',e=>{
    const t=e.target;if(!t||!document.getElementById('view')||!document.getElementById('view').contains(t))return;
    const f=cur();
    if(t.dataset&&t.dataset.fbimport){e.stopImmediatePropagation();const fl=t.files[0];t.value='';if(!fl)return;if(fl.size>1000000){FB.importMsg='That file is too large (limit 1 MB).';return render()}const rd=new FileReader();rd.onload=()=>importForm(String(rd.result));rd.onerror=()=>{FB.importMsg='That file could not be read.';render()};rd.readAsText(fl);return}
    if(t.dataset&&t.dataset.v){FB.v[t.dataset.v]=t.type==='checkbox'?t.checked:t.value;if(t.dataset.v==='anaId')FB.ana.id=t.value;if(t.dataset.v==='anaReport')FB.ana.report=t.checked;return}
    if(!f)return;
    if(t.id==='fbPreview'){e.stopImmediatePropagation();FB.preview=t.checked;FB.sel=null;FB.pv={ans:{},done:false};return render()}
    if(t.dataset&&t.dataset.ds){e.stopImmediatePropagation();f.design=f.design||{};f.design[t.dataset.ds]=t.value;redrawCanvas();return}
    if(t.dataset&&t.dataset.dk){f.design=f.design||{};f.design[t.dataset.dk]=t.value;redrawCanvas();return}
    const x=selField(f);
    if(x&&t.id==='fbpReq'){e.stopImmediatePropagation();x.req=t.checked;redrawCanvas();return}
    if(x&&t.id==='fbpType'){e.stopImmediatePropagation();x.type=t.value;if(['select','radio','check'].includes(x.type)&&(!x.opts||x.opts.length<2))x.opts=OPT3();return render()}
    if(x&&t.id==='fbpTrig'){e.stopImmediatePropagation();if(!t.value)x.showIf=null;else{const trg=f.fields.find(q=>q.id===t.value);if(trg){const first=trg.type==='yesno'?'Yes':(trg.opts&&trg.opts[0])||'';setShowIf(f,x,trg,first)}}return render()}
    if(x&&t.id==='fbpVal'&&t.tagName==='SELECT'&&x.showIf){e.stopImmediatePropagation();x.showIf.val=t.value;redrawCanvas();return}
    if(t.dataset&&t.dataset.sf){e.stopImmediatePropagation();const k=t.dataset.sf;
      if(k==='status')f.status=t.value==='closed'?'closed':'open';
      if(k==='audience'){f.audience=t.value==='staff'?'staff':'client';if(f.audience==='staff')f.publicLink=false}
      return}
    if(t.id==='fbPublic'){e.stopImmediatePropagation();f.publicLink=t.checked;return render()}
    if(t.id==='fbEmbedH'){e.stopImmediatePropagation();FB.embedH=t.value;return render()}
    if(t.dataset&&t.dataset.asg){FB.assign.sel[t.dataset.asg]=t.checked;return}
    if(FB.preview&&t.dataset&&t.dataset.pv){const k=t.dataset.pv;
      if(t.type==='checkbox'){const a=Array.isArray(FB.pv.ans[k])?FB.pv.ans[k].slice():[],i=a.indexOf(t.value);if(t.checked&&i<0)a.push(t.value);if(!t.checked&&i>=0)a.splice(i,1);FB.pv.ans[k]=a}
      else FB.pv.ans[k]=t.value;
      if(t.type!=='checkbox')render();return}
  },true);

  /* drag and drop (palette -> canvas, and reorder) */
  let dragging=null;
  document.addEventListener('dragstart',e=>{
    const p=e.target.closest&&e.target.closest('[data-pal]'),h=e.target.closest&&e.target.closest('[data-move]');
    if(p){dragging='new:'+p.dataset.pal;e.dataTransfer.setData('text/plain',dragging);e.dataTransfer.effectAllowed='copy'}
    else if(h){dragging='move:'+h.dataset.move;e.dataTransfer.setData('text/plain',dragging);e.dataTransfer.effectAllowed='move';const b=h.closest('.fbblock');if(b&&e.dataTransfer.setDragImage)e.dataTransfer.setDragImage(b,10,10)}
  },true);
  document.addEventListener('dragover',e=>{const z=e.target.closest&&e.target.closest('.dz');if(!z||!dragging)return;e.preventDefault();document.querySelectorAll('.dz.on').forEach(d=>{if(d!==z)d.classList.remove('on')});z.classList.add('on')},true);
  document.addEventListener('dragleave',e=>{const z=e.target.closest&&e.target.closest('.dz');if(z&&!z.contains(e.relatedTarget))z.classList.remove('on')},true);
  document.addEventListener('drop',e=>{
    const z=e.target.closest&&e.target.closest('.dz');if(!z||!dragging)return;
    e.preventDefault();e.stopImmediatePropagation();const idx=+z.dataset.idx,d=dragging;dragging=null;
    if(d.startsWith('new:'))addField(d.slice(4),idx);else if(d.startsWith('move:'))moveField(d.slice(5),idx);
  },true);
  document.addEventListener('dragend',()=>{dragging=null;document.querySelectorAll('.dz.on').forEach(d=>d.classList.remove('on'))},true);

  /* selecting a field by clicking it on the canvas */
  document.addEventListener('click',e=>{
    if(FB.view!=='edit'||FB.mode!=='build'||FB.preview)return;
    const b=e.target.closest&&e.target.closest('.fbblock');if(!b)return;
    if(e.target.closest('.fbtool')||e.target.closest('[data-act]'))return;
    if(FB.sel===b.dataset.fid)return;
    FB.sel=b.dataset.fid;render();
  },true);

  document.addEventListener('click',async e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="fb"]');if(!b)return;
    e.stopImmediatePropagation();
    const d=b.dataset,f=cur();
    switch(d.act){
      case 'fbCreateOpen':FB.create=FB.create||'describe';FB.out.create='';return render();
      case 'fbCreateClose':FB.create=null;return render();
      case 'fbCreateTab':FB.create=d.t;FB.out.create='';return render();
      case 'fbEx2':FB.v.fbPrompt=d.v;return render();
      case 'fbCreateGo':{const p=(FB.v.fbPrompt||'').trim();if(p.length<8){FB.out.create='Describe the form first, for example: Create a client onboarding form with name, email and phone.';return render()}
        const q=/\b(create|make|build|generate|draft|set up|new|design)\b/i.test(p)?p:'Create '+p;return runCreate('create',()=>F().createFromPrompt(q))}
      case 'fbTpl':return runCreate('create',()=>F().useTemplate(d.k));
      case 'fbQuizGo':{const t=(FB.v.fbQuizText||'').trim(),n=+(FB.v.fbQuizN||5);return runCreate('create',()=>F().makeQuiz('Make a '+n+' question quiz from this text: '+t))}
      case 'fbBlank':{kInit();const nf={id:'f'+(++state.kseq+10),title:'Untitled form',desc:'',thanks:'Thank you. Your response has been recorded.',fields:[],status:'open',created:state.today,audience:'client',category:'General',design:{}};forms().push(nf);FB.create=null;return openEditor(nf.id,'build')}
      case 'fbEdit':return openEditor(d.id,'build');
      case 'fbPreviewRow':openEditor(d.id,'build');FB.preview=true;return render();
      case 'fbPreviewBtn':{if(!f)return;if(FB.mode==='build')FB.preview=!FB.preview;else{FB.mode='build';FB.preview=true}FB.sel=null;FB.pv={ans:{},done:false};return render()}
      case 'fbFill':return openFill(d.id);
      case 'fbFromFill':{FB.fromFill=false;state.tab.adm='formbuilder';return render()}
      case 'fbExport':{const sf=forms().find(x=>x.id===d.id);if(sf){exportForm(sf);toast('Form file saved')}return}
      case 'fbImportPick':{const i=document.getElementById('fbImportFile');if(i)i.click();return}
      case 'fbRespCsv':{const sf=forms().find(x=>x.id===FB.ana.id);if(!sf)return toast('Choose a form first');if(!subsOf(sf).length)return toast('There are no responses to export yet');kDownload((slug(sf.title)||'form')+'-responses.csv','text/csv',kCsv(sf));return}
      case 'fbShare':return openEditor(d.id,'publish');
      case 'fbResp':FB.ana.show=true;FB.ana.id=d.id;FB.ana.text='';return render();
      case 'fbAnalyse':{const sf=forms().find(x=>x.id===FB.ana.id),rep=FB.ana.report,q=(rep?'draft a report on the ':'summarise the ')+(sf?sf.title+' ':'')+'responses';try{FB.ana.text=F().analyse(q,q.toLowerCase())}catch(_){FB.ana.text='Something went wrong. Try again.'}return render()}
      case 'fbCopyForm':{const sf=forms().find(x=>x.id===d.id);if(!sf)return;const nf=JSON.parse(JSON.stringify(sf));nf.id='f'+(++state.kseq+10);nf.title=sf.title+' (copy)';nf.status='open';nf.publicLink=false;nf.fields.forEach(x=>{x.id=uid()});const idMap={};sf.fields.forEach((x,i)=>idMap[x.id]=nf.fields[i].id);nf.fields.forEach(x=>{if(x.showIf)x.showIf={fid:idMap[x.showIf.fid],val:x.showIf.val}});forms().push(nf);toast('Form duplicated');return render()}
      case 'fbBack':return back();
      case 'fbMode':FB.mode=d.m;FB.sel=null;if(d.m!=='build')FB.preview=false;if(d.m==='publish'&&FB.people===null)loadPeople();return render();
      case 'fbDTab':FB.dTab=d.t;return redrawSide();
      case 'fbScheme':{if(!f)return;f.design=f.design||{};Object.assign(f.design,S(d.n));return render()}
      case 'fbTheme':{if(!f)return;const t=THEMES.find(x=>x[0]===d.n);if(t)f.design={...t[1]};return render()}
      case 'fbResetDesign':if(f)f.design={};return render();
      case 'fbAdd':return addField(d.k);
      case 'fbUp':case 'fbDown':{if(!f)return;const i=f.fields.findIndex(x=>x.id===d.id),j=d.act==='fbUp'?i-1:i+1;if(i<0||j<0||j>=f.fields.length)return;[f.fields[i],f.fields[j]]=[f.fields[j],f.fields[i]];return render()}
      case 'fbDup':{if(!f)return;const i=f.fields.findIndex(x=>x.id===d.id);if(i<0)return;const c=JSON.parse(JSON.stringify(f.fields[i]));c.id=uid();c.label=c.label+' (copy)';c.showIf=null;f.fields.splice(i+1,0,c);FB.sel=c.id;return render()}
      case 'fbDel':return delField(d.id);
      case 'fbDone':FB.sel=null;return render();
      case 'fbPvSubmit':{if(!f)return;const miss=f.fields.filter(x=>x.req&&!['head','para'].includes(x.type)&&visiblePv(f,x)&&!(FB.pv.ans[x.id]&&FB.pv.ans[x.id].length));if(miss.length){toast('Please fill in: '+miss.map(x=>x.label).slice(0,3).join(', '));return}FB.pv.done=true;return render()}
      case 'fbPvAgain':FB.pv={ans:{},done:false};return render();
      case 'fbEx':FB.cmd=d.v;{const c=document.getElementById('fbCmd');if(c)c.value=d.v}return;
      case 'fbApply':{if(!f)return;const ins=(FB.cmd||'').trim();if(!ins){FB.cmdOut='Type what should change, or pick an example.';return render()}
        F().ctx.formId=f.id;let r;try{r=F().editForm(ins,ins.toLowerCase())}catch(_){r=null}FB.cmdOut=r||'I did not understand that change. Try one of the examples.';if(r&&!/^(I could not|I did not|Which form|There is no)/.test(r))FB.cmd='';return render()}
      case 'fbSTab':FB.sTab=d.t;FB.cond=null;return render();
      case 'fbCondOpen:show':FB.cond='show';return render();
      case 'fbCondOpen:require':FB.cond='require';return render();
      case 'fbToThanks':FB.sTab='thanks';return render();
      case 'fbCondShow':{if(!f)return;const dep=f.fields.find(x=>x.id===$('#cShow').value),trg=f.fields.find(x=>x.id===$('#cTrig').value),val=$('#cVal').value.trim();
        if(!dep||!trg||dep===trg||!val){toast('Choose two different fields and a value');return}
        setShowIf(f,dep,trg,trg.type==='yesno'?(/^(y|yes|true)/i.test(val)?'Yes':'No'):((trg.opts||[]).find(o=>o.toLowerCase()===val.toLowerCase())||val));FB.cond=null;toast('Condition added');return render()}
      case 'fbCondReq':{if(!f)return;const x=f.fields.find(q=>q.id===$('#cReqF').value);if(!x)return;x.req=$('#cReqV').value==='1';FB.cond=null;toast(x.label+' is now '+(x.req?'required':'optional'));return render()}
      case 'fbCondRemove':{const x=f&&f.fields.find(q=>q.id===d.id);if(x){x.showIf=null;toast('Condition removed')}return render()}
      case 'fbDraftEmail':{if(!f)return;const r=F().draftEmail('draft a confirmation email for the '+f.title+' form','draft a confirmation email for the '+f.title.toLowerCase()+' form'),p=parseDraft(r);f.settings=f.settings||{};f.settings.email={subject:p.subject,body:p.body};return render()}
      case 'fbCopyEmail':{const em=f&&f.settings&&f.settings.email;if(em&&(em.subject||em.body))copy((em.subject?'Subject: '+em.subject+'\n\n':'')+(em.body||''));else toast('Write or draft a message first');return}
      case 'fbToKyc':kInit();state.kyc.view='forms';state.tab.adm='kyc';return render();
      case 'fbClassic':kInit();state.kyc.formId=d.id;state.kyc.view='build';state.tab.adm='kyc';window.scrollTo(0,0);return render();
      case 'fbDeleteForm':{if(!f)return;const n=subsOf(f).length;if(n)return toast('This form has '+n+' response(s). Delete them first.');if(!confirm('Delete "'+f.title+'"? This cannot be undone.'))return;state.forms=forms().filter(x=>x.id!==f.id);toast('Form deleted');return back()}
      case 'fbPTab':FB.pTab=d.t;if(d.t==='assign'&&FB.people===null)loadPeople();return render();
      case 'fbCopy':return copy(d.v);
      case 'fbCopyInvite':{if(!f)return;const iv=inviteDraft(f);return copy('Subject: '+iv.subject+'\n\n'+iv.body)}
      case 'fbCopyPref':return f&&copy(prefillUrl(f));
      case 'fbPrint':{if(!f)return;const w=window.open('','_blank');if(!w)return toast('Allow pop-ups to print.');w.document.write(printHTML(f));w.document.close();w.focus();setTimeout(()=>{try{w.print()}catch(_){}},400);return}
      case 'fbAssignSend':{if(!f)return;const ids=Object.keys(FB.assign.sel).filter(k=>FB.assign.sel[k]);if(!ids.length){FB.assign.out='Choose at least one person.';return render()}
        const msg=(FB.assign.msg||`Please complete the form: ${f.title}.`).trim();
        try{if(live){const r=await window.VIRTUOSO.client.from('notifications').insert(ids.map(id=>({kind:'Form',message:msg,to_user_id:id})));if(r.error)throw r.error}
          else ids.forEach(id=>{try{notifyTo(id,'Form',msg)}catch(_){}});
          FB.assign.out='Notification sent to '+ids.length+' '+(ids.length===1?'person':'people')+'.';FB.assign.sel={}}catch(_){FB.assign.out='Could not send the notification. Try again.'}
        return render()}
    }
  },true);

  async function loadPeople(){
    if(live){const r=await window.VIRTUOSO.client.from('profiles').select('id,name,role,access_enabled').order('name');FB.people=(r.data||[]).filter(p=>p.access_enabled&&p.id!==(state.user&&state.user.id))}
    else FB.people=(typeof staff==='function'?staff():[]).filter(u=>u.access).map(u=>({id:u.id,name:u.name}));
    if(FB.view==='edit'&&FB.mode==='publish')render();
  }
})();
