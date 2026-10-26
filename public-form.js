/* Public form page: opens a shared client form from ?id=<form id> without signing in.
   Reads only the public columns (RLS), uploads files to private storage and inserts a Pending submission.
   Optional: &embed=1 for iframes, &p_<field_label_with_underscores>=value to prefill. */
(function(){
  const q=new URLSearchParams(location.search),id=q.get('id');
  const root=document.getElementById('root');
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  const cfg=window.VIRTUOSO||{};
  if(q.get('embed')==='1')document.body.classList.add('embed');
  const say=(h,cls)=>{root.innerHTML=cls?`<div class="${cls}">${h}</div>`:h;ping()};
  const ping=()=>{try{parent!==window&&parent.postMessage({type:'virtuoso-form-height',height:document.documentElement.scrollHeight},'*')}catch(_){}};
  if(!id||!/^[0-9a-f-]{36}$/i.test(id))return say('<h1>Form not found</h1><p>This link is not valid.</p>','center');
  if(!(cfg.supabaseUrl&&cfg.anonKey&&window.supabase))return say('<h1>Unavailable</h1><p>This form cannot load right now. Please try again later.</p>','center');
  const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const OKT=/^(application\/pdf|image\/jpeg|image\/png)$/,MAX=10*1024*1024;
  let form=null,ans={},errs={},sending=false,files={},sigs={};

  const DES={font:{sans:'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',serif:'Georgia,"Times New Roman",serif',mono:'ui-monospace,Menlo,Consolas,monospace',rounded:'"Trebuchet MS","Segoe UI",sans-serif'},size:{small:'14px',medium:'16px',large:'18px'},radius:{square:'2px',soft:'8px',round:'16px'},width:{narrow:'480px',standard:'640px',wide:'820px'},spacing:{compact:'10px',comfortable:'18px',roomy:'28px'}};
  const color=v=>/^#[0-9a-f]{3,8}$/i.test(v||'')?v:null;
  function design(d){
    d=d||{};const s=document.documentElement.style,set=(k,v)=>{if(v)s.setProperty(k,v)};
    set('--page',color(d.pageColor));set('--form',color(d.formColor));set('--fg',color(d.fontColor));set('--inbg',color(d.inputBg));set('--accent',color(d.accent));
    set('--ff',DES.font[d.font]);set('--fs',DES.size[d.size]);set('--radius',DES.radius[d.radius]);set('--w',DES.width[d.width]);set('--gap',DES.spacing[d.spacing]);
    if(d.labelPos==='left')document.body.classList.add('left');
  }
  const visible=(f)=>{if(!f.showIf)return true;const c=form.fields.find(x=>x.id===f.showIf.fid);if(!c||!visible(c))return false;const v=ans[f.showIf.fid];return Array.isArray(v)?v.includes(f.showIf.val):String(v==null?'':v)===String(f.showIf.val)};
  const empty=v=>v==null||v===''||(Array.isArray(v)&&!v.length);

  function field(x){
    const k=x.id,e=errs[k],v=ans[k],req=x.req?'<span class="req" aria-hidden="true">*</span>':'';
    const lab=`<label for="f_${esc(k)}">${esc(x.label)}${req}</label>`,help=x.help?`<div class="help">${esc(x.help)}</div>`:'',er=e?`<div class="err" role="alert">${esc(e)}</div>`:'';
    const common=`id="f_${esc(k)}" data-id="${esc(k)}" ${x.req?'aria-required="true"':''} ${e?'aria-invalid="true"':''}`;
    let inp='';
    switch(x.type){
      case 'head':return `<h2 class="sec">${esc(x.label)}</h2>`;
      case 'para':return `<p class="para">${esc(x.label)}</p>`;
      case 'long':inp=`<textarea ${common} maxlength="4000">${esc(v||'')}</textarea>`;break;
      case 'email':inp=`<input type="email" ${common} maxlength="200" value="${esc(v||'')}" autocomplete="email">`;break;
      case 'phone':inp=`<input type="tel" ${common} maxlength="40" value="${esc(v||'')}" autocomplete="tel">`;break;
      case 'number':inp=`<input type="number" step="any" ${common} value="${esc(v||'')}">`;break;
      case 'date':inp=`<input type="date" ${common} value="${esc(v||'')}">`;break;
      case 'select':inp=`<select ${common}><option value="">Choose…</option>${(x.opts||[]).map(o=>`<option ${v===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;break;
      case 'radio':case 'yesno':{const opts=x.type==='yesno'?['Yes','No']:(x.opts||[]);
        return `<div class="f ${e?'bad':''}" role="radiogroup" aria-labelledby="l_${esc(k)}"><div class="lbl" id="l_${esc(k)}">${esc(x.label)}${req}</div>${opts.map((o,i)=>`<label class="opt" style="font-weight:400;margin:0"><input type="radio" name="g_${esc(k)}" data-id="${esc(k)}" value="${esc(o)}" ${v===o?'checked':''}><span>${esc(o)}</span></label>`).join('')}${help}${er}</div>`}
      case 'check':return `<div class="f ${e?'bad':''}" role="group" aria-labelledby="l_${esc(k)}"><div class="lbl" id="l_${esc(k)}">${esc(x.label)}${req}</div>${(x.opts||[]).map(o=>`<label class="opt" style="font-weight:400;margin:0"><input type="checkbox" data-id="${esc(k)}" value="${esc(o)}" ${Array.isArray(v)&&v.includes(o)?'checked':''}><span>${esc(o)}</span></label>`).join('')}${help}${er}</div>`;
      case 'file':inp=`<input type="file" ${common} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png">${files[k]?`<div class="help">Selected: ${esc(files[k].name)}</div>`:''}<div class="help">PDF, JPG or PNG, up to 10 MB.</div>`;break;
      case 'sign':return `<div class="f ${e?'bad':''}"><div class="lbl">${esc(x.label)}${req}</div><canvas class="sig" data-sig="${esc(k)}" width="480" height="150" aria-label="Signature pad: draw your signature"></canvas><div><button type="button" data-clear="${esc(k)}">Clear signature</button></div>${help}${er}</div>`;
      default:inp=`<input type="text" ${common} maxlength="300" value="${esc(v||'')}">`;
    }
    return `<div class="f row ${e?'bad':''}">${lab}<div>${inp}${help}${er}</div></div>`;
  }
  function paint(){
    const keep=window.scrollY;
    root.innerHTML=`<h1>${esc(form.title)}</h1>${form.description?`<p class="desc">${esc(form.description)}</p>`:''}
      ${Object.keys(errs).length?`<div class="banner" role="alert">Please fix the ${Object.keys(errs).length} field${Object.keys(errs).length>1?'s':''} marked below.</div>`:''}
      <form id="vf" novalidate>${form.fields.filter(visible).map(field).join('')}
      <div class="hp" aria-hidden="true"><label>Leave this empty<input type="text" id="hp" tabindex="-1" autocomplete="off"></label></div>
      <button class="primary" type="submit" ${sending?'disabled':''}>${sending?'Sending…':'Submit'}</button></form>`;
    document.title=form.title;wireSigs();window.scrollTo(0,keep);ping();
  }
  function wireSigs(){
    root.querySelectorAll('canvas[data-sig]').forEach(c=>{
      const k=c.dataset.sig,g=c.getContext('2d');g.lineWidth=2.5;g.lineCap='round';g.strokeStyle='#111';
      if(sigs[k]){const im=new Image();im.onload=()=>g.drawImage(im,0,0);im.src=sigs[k]}
      let down=false;const pos=e=>{const r=c.getBoundingClientRect();return [(e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height]};
      c.addEventListener('pointerdown',e=>{down=true;c.setPointerCapture(e.pointerId);g.beginPath();const [x,y]=pos(e);g.moveTo(x,y);e.preventDefault()});
      c.addEventListener('pointermove',e=>{if(!down)return;const [x,y]=pos(e);g.lineTo(x,y);g.stroke()});
      const end=()=>{if(!down)return;down=false;sigs[k]=c.toDataURL('image/png');ans[k]=sigs[k];delete errs[k]};
      c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);
    });
  }
  root.addEventListener('input',e=>{const t=e.target,k=t.dataset&&t.dataset.id;if(!k||t.type==='file'||t.type==='radio'||t.type==='checkbox')return;ans[k]=t.value;delete errs[k]});
  root.addEventListener('change',e=>{
    const t=e.target,k=t.dataset&&t.dataset.id;if(!k)return;
    if(t.type==='file'){const f=t.files[0];delete errs[k];if(!f){delete files[k];delete ans[k];return paint()}
      if(!OKT.test(f.type||''))errs[k]='Use a PDF, JPG or PNG file.';else if(f.size>MAX)errs[k]='That file is larger than 10 MB.';else if(!f.size)errs[k]='That file is empty.';
      if(errs[k]){t.value='';return paint()}files[k]=f;ans[k]={name:f.name,size:f.size,type:f.type};return paint()}
    if(t.type==='radio'){ans[k]=t.value;delete errs[k];return paint()}
    if(t.type==='checkbox'){const a=Array.isArray(ans[k])?ans[k].slice():[];const i=a.indexOf(t.value);if(t.checked&&i<0)a.push(t.value);if(!t.checked&&i>=0)a.splice(i,1);ans[k]=a;delete errs[k];return}
    ans[k]=t.value;delete errs[k];if(t.tagName==='SELECT')paint();
  });
  root.addEventListener('click',e=>{const b=e.target.closest('[data-clear]');if(!b)return;const k=b.dataset.clear;delete sigs[k];delete ans[k];paint()});

  function validate(){
    const out={};
    form.fields.filter(visible).forEach(x=>{
      if(['head','para'].includes(x.type))return;const v=ans[x.id];
      if(x.req&&empty(v)){out[x.id]=x.type==='sign'?'Please sign above.':'This is required.';return}
      if(empty(v))return;
      if(x.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))out[x.id]='Enter a valid email address.';
      if(x.type==='number'&&isNaN(Number(v)))out[x.id]='Enter a number.';
      if(x.type==='phone'&&!/^[\d\s+()\-]{6,}$/.test(v))out[x.id]='Enter a valid phone number.';
    });
    return out;
  }
  async function submit(){
    if(sending)return;
    if(document.getElementById('hp').value){return say(`<h1>${esc(form.title)}</h1><p>${esc(form.thanks||'Thank you.')}</p>`,'center')}
    errs=validate();if(Object.keys(errs).length){paint();const el=root.querySelector('.bad,[aria-invalid=true]');el&&el.scrollIntoView({block:'center'});return}
    sending=true;paint();
    try{
      const out={};
      for(const x of form.fields){
        if(['head','para'].includes(x.type)||!visible(x)||empty(ans[x.id]))continue;
        if(x.type==='file'&&files[x.id]){
          const f=files[x.id],path=`${form.id}/${crypto.randomUUID()}-${f.name.replace(/[^A-Za-z0-9._-]+/g,'_').slice(-80)}`;
          const up=await sb.storage.from('kyc-uploads').upload(path,f,{contentType:f.type,upsert:false});
          if(up.error)throw new Error('upload');
          out[x.id]={name:f.name,size:f.size,type:f.type,path};
        }else out[x.id]=ans[x.id];
      }
      const r=await sb.from('form_submissions').insert({form_id:form.id,answers:out});
      if(r.error)throw new Error(/too many/i.test(r.error.message)?'busy':'save');
      sending=false;say(`<h1>${esc(form.title)}</h1><p>${esc(form.thanks||'Thank you. Your response has been recorded.')}</p><p><button type="button" id="again">Submit another response</button></p>`,'center');
      document.getElementById('again').onclick=()=>{ans={};errs={};files={};sigs={};prefill();paint()};
    }catch(x){
      sending=false;paint();
      const m=x.message==='busy'?'This form is receiving too many responses right now. Please try again later.':x.message==='upload'?'A file could not be uploaded. Check it and try again.':'Your response could not be sent. Please try again.';
      root.insertAdjacentHTML('afterbegin',`<div class="banner" role="alert">${esc(m)}</div>`);window.scrollTo(0,0);
    }
  }
  root.addEventListener('submit',e=>{e.preventDefault();submit()});
  function prefill(){form.fields.forEach(x=>{if(['head','para','file','sign'].includes(x.type))return;const v=q.get('p_'+slug(x.label));if(v==null)return;
    if(x.type==='check')ans[x.id]=v.split(',').map(s=>s.trim()).filter(Boolean);else if(x.type==='yesno')ans[x.id]=/^(y|yes|true)/i.test(v)?'Yes':'No';else ans[x.id]=v.slice(0,4000)})}

  (async()=>{
    const r=await sb.from('forms').select('id,title,description,thanks,category,audience,status,fields,design,public_link').eq('id',id).maybeSingle();
    if(r.error||!r.data)return say('<h1>Form not available</h1><p>This form is closed or is not shared. Please contact the person who sent you the link.</p>','center');
    form=r.data;form.fields=Array.isArray(form.fields)?form.fields:[];
    design(form.design);prefill();paint();
    document.getElementById('foot').textContent='Virtuous Accounting Solutions CC';
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(ping).observe(document.body);
  })().catch(()=>say('<h1>Unavailable</h1><p>This form cannot load right now. Please try again later.</p>','center'));
})();
