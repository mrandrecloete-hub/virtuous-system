/* Saves forms and submissions to the database (live mode only; `?demo` keeps everything in memory).
   Forms: admins write, staff read open staff forms. Submissions: admins see all and decide; staff see their own.
   It watches the in-memory lists (state.forms, state.subs) that every form editor already changes, and writes
   what changed after a short pause. Sample/demo records are never written. */
(function(){
  const cfg=window.VIRTUOSO||{};
  if(!(cfg.supabaseUrl&&cfg.anonKey)||/[?&]demo\b/.test(location.search))return;
  const SYNC=window.VIRTUOSO_SYNC={status:'idle',last:null,error:'',renamed:[]};
  const sb=()=>window.VIRTUOSO.client;
  const isUuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
  const isAdm=()=>state.user&&state.user.type==='admin';
  const known={forms:new Map(),subs:new Map()};
  let loadedFor=null,loading=false,busy=false,backoff=0;const changed={};
  const fail=e=>{SYNC.status='error';SYNC.error=(e&&e.message)||'Could not save';backoff=Date.now()+10000};

  /* quiz answer keys live in settings.answerKey (private), never on the fields the public page can read */
  const stripFields=fs=>(fs||[]).map(({answer,...rest})=>rest);
  const keyOf=f=>{const k={};(f.fields||[]).forEach(x=>{if(x.answer!=null)k[x.id]=x.answer});return k};
  const settingsOf=f=>{const s={...(f.settings||{})},k=keyOf(f);if(Object.keys(k).length)s.answerKey=k;else delete s.answerKey;return s};
  const toRow=f=>({title:f.title||'Untitled form',description:f.desc||'',thanks:f.thanks||null,category:f.category||'General',audience:f.audience==='staff'?'staff':'client',
    status:f.status==='closed'?'closed':'open',fields:stripFields(f.fields),design:f.design||{},settings:settingsOf(f),public_link:!!f.publicLink});
  const sigOf=f=>JSON.stringify(toRow(f));
  const toMem=r=>{const key=(r.settings&&r.settings.answerKey)||{};const settings={...(r.settings||{})};
    return {id:r.id,title:r.title,desc:r.description||'',thanks:r.thanks||'Thank you. Your response has been recorded.',status:r.status,created:String(r.created_at||'').slice(0,10),
      audience:r.audience,category:r.category||'General',design:r.design||{},settings,publicLink:!!r.public_link,
      fields:(r.fields||[]).map(x=>key[x.id]!=null?{...x,answer:key[x.id]}:x)}};
  const cleanAns=a=>{const o={};Object.entries(a||{}).forEach(([k,v])=>{o[k]=(v&&typeof v==='object'&&!Array.isArray(v)&&v.name)?{name:v.name,size:v.size||null,type:v.type||null,path:v.path||null}:v});return o};
  const subSig=s=>JSON.stringify([s.status,!!s.signed,(s.notes||[]).length]);

  async function loadAll(){
    if(loading||!sb())return;loading=true;SYNC.status='loading';
    try{
      kInit();
      const fr=await sb().from('forms').select('*').order('created_at');
      if(fr.error)throw fr.error;
      let rows=fr.data;
      if(!rows.length&&isAdm()&&state.forms.length){
        const ins=await sb().from('forms').insert(state.forms.map(toRow)).select();
        if(ins.error)throw ins.error;rows=ins.data;
      }
      const forms=rows.map(toMem);
      const sr=await sb().from('form_submissions').select('*').order('created_at').limit(1000);
      if(sr.error)throw sr.error;
      const pr=await sb().from('profiles').select('id,name');const names=Object.fromEntries((pr.data||[]).map(p=>[p.id,p.name]));
      const notes={};
      if(isAdm()){const nr=await sb().from('submission_notes').select('*').order('at');(nr.data||[]).forEach(n=>{(notes[n.submission_id]=notes[n.submission_id]||[]).push({by:names[n.author_id]||'Admin',at:fmtDT(new Date(n.at)),text:n.body})})}
      state.forms=forms;
      state.subs=sr.data.map(r=>({id:r.id,ref:r.ref,formId:r.form_id,date:String(r.created_at).slice(0,10),time:fmtDT(new Date(r.created_at)),ans:r.answers||{},status:r.status,
        notes:notes[r.id]||[],signed:!!r.signed,uid:r.submitted_by||undefined,by:r.submitted_by?names[r.submitted_by]:undefined}));
      known.forms.clear();known.subs.clear();
      state.forms.forEach(f=>known.forms.set(f.id,sigOf(f)));state.subs.forEach(s=>known.subs.set(s.id,subSig(s)));
      /* keep new field ids from colliding with saved ones */
      let mx=seq;state.forms.forEach(f=>f.fields.forEach(x=>{const n=parseInt(String(x.id).replace(/\D/g,''),10);if(n>mx)mx=n}));seq=mx+1;
      if(state.kyc){state.kyc.formId=null;state.kyc.subId=null;state.kyc.view='forms'}
      loadedFor=state.user.id;SYNC.status='saved';SYNC.last=new Date();SYNC.error='';render();
    }catch(e){fail(e);backoff=Date.now()+15000}
    loading=false;
  }

  async function pushForms(){
    if(!isAdm())return;
    const cur=new Map(state.forms.map(f=>[f.id,f]));
    for(const id of [...known.forms.keys()]){
      if(cur.has(id))continue;
      if(isUuid(id)){const r=await sb().from('forms').delete().eq('id',id);if(r.error){fail(r.error);return}}
      known.forms.delete(id);
    }
    for(const f of state.forms){
      const sig=sigOf(f);if(known.forms.get(f.id)===sig){delete changed[f.id];continue}
      const c=changed[f.id];if(!c||c.sig!==sig){changed[f.id]={sig,at:Date.now()};SYNC.status='saving';continue}
      if(Date.now()-c.at<1000)continue;
      SYNC.status='saving';
      if(!isUuid(f.id)){
        const r=await sb().from('forms').insert(toRow(f)).select().single();
        if(r.error){fail(r.error);return}
        const old=f.id;f.id=r.data.id;
        state.subs.forEach(s=>{if(s.formId===old)s.formId=f.id});
        if(state.kyc&&state.kyc.formId===old)state.kyc.formId=f.id;
        SYNC.renamed.forEach(fn=>{try{fn(old,f.id)}catch(_){}});
        known.forms.set(f.id,sig);delete changed[old];
      }else{
        const r=await sb().from('forms').update(toRow(f)).eq('id',f.id);
        if(r.error){fail(r.error);return}
        known.forms.set(f.id,sig);
      }
    }
  }
  async function pushSubs(){
    for(const s of state.subs){
      if(!isUuid(s.id)){
        if(!isUuid(s.formId))continue;
        const r=await sb().from('form_submissions').insert({form_id:s.formId,answers:cleanAns(s.ans),submitted_by:s.uid||null}).select('id,ref').single();
        if(r.error){fail(r.error);return}
        s.id=r.data.id;s.ref=r.data.ref;known.subs.set(s.id,subSig(s));
        if(state.kyc&&state.kyc.done&&!isUuid(state.kyc.done))state.kyc.done=s.id;
        continue;
      }
      if(!isAdm())continue;
      const sig=subSig(s),prev=known.subs.get(s.id);if(prev===sig)continue;
      const was=prev?JSON.parse(prev):[s.status,false,0];
      const up=await sb().from('form_submissions').update({status:s.status,signed:false,reviewed_by:s.status==='Pending'?null:state.user.id}).eq('id',s.id);
      if(up.error){fail(up.error);return}
      for(const n of (s.notes||[]).slice(was[2])){const r=await sb().from('submission_notes').insert({submission_id:s.id,body:n.text});if(r.error){fail(r.error);return}}
      known.subs.set(s.id,sig);
    }
  }
  async function tick(){
    if(!state.user||!sb()){if(!state.user)loadedFor=null;return}
    if(loadedFor!==state.user.id){if(!loading&&Date.now()>=backoff)await loadAll();return}
    if(busy||Date.now()<backoff||!state.forms)return;busy=true;
    try{await pushForms();await pushSubs();if(SYNC.status!=='error'){const dirty=state.forms.some(f=>known.forms.get(f.id)!==sigOf(f))||state.subs.some(s=>!isUuid(s.id));if(!dirty){SYNC.status='saved';SYNC.last=new Date();SYNC.error=''}}}
    catch(e){fail(e)}
    busy=false;
  }
  setInterval(tick,1200);

  /* Admins can open files uploaded through public forms (private storage, short-lived link). */
  const origDoc=kDocHtml;
  kDocHtml=function(s,forPrint){
    const h=origDoc(s,forPrint),f=kForm(s.formId);
    const files=f?f.fields.filter(x=>x.type==='file'&&s.ans[x.id]&&s.ans[x.id].path).map(x=>({label:x.label,v:s.ans[x.id]})):[];
    if(forPrint||!files.length||state.user.type!=='admin')return h;
    return h+`<div style="padding:12px 16px"><b>Uploaded files</b>${files.map(x=>`<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;padding:6px 0;border-top:1px solid #ddd"><span>${esc(x.label)}: ${esc(x.v.name)}</span><button type="button" class="btn sm ghost" data-act="lfOpen" data-path="${esc(x.v.path)}">Open file</button></div>`).join('')}</div>`;
  };
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-act="lfOpen"]');if(!b)return;
    e.stopImmediatePropagation();
    const w=window.open('','_blank');
    sb().storage.from('kyc-uploads').createSignedUrl(b.dataset.path,60).then(({data,error})=>{
      if(error||!data){if(w)w.close();return toast('Could not open the file.')}
      if(w){w.opener=null;w.location=data.signedUrl}else toast('Allow pop-ups to open files.')});
  },true);
})();
