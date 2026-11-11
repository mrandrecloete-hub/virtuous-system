/* PROFILE PHOTO and OPTIONAL PERSONAL DETAILS (everyone: admins and employees), added to the My profile page.
   Photo (resized in the browser to 256 px JPEG), phone, address, birthday, emergency contact and a short "about me".
   All optional. Everyone edits only their own details; admins can read them (RLS, migration 0020 profile_extra).
   The photo also shows in the sidebar next to "Signed in as". ?demo keeps it in memory (state.profx). */
(function(){
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const X={uid:null,row:null,loaded:false,loading:false,busy:false,msg:'',err:''};
  const FIELDS=[['phone','Phone number',40,'tel'],['address','Home address',300,'text'],['birthday','Birthday',10,'date'],['emergency_name','Emergency contact name',100,'text'],['emergency_phone','Emergency contact phone',40,'tel']];
  const clean=(s,n)=>String(s==null?'':s).replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n);
  const setNeeded=/does not exist|schema cache|permission denied/i;
  async function load(){
    if(!state.user||X.loading)return;X.loading=true;
    try{
      if(!LIVE){X.row=((state.profx||{})[state.user.id])||{}}
      else{const r=await sb().from('profile_extra').select('*').eq('user_id',state.user.id).maybeSingle();
        if(r.error)throw r.error;X.row=r.data||{}}
      X.err='';
    }catch(e){X.row={};X.err=setNeeded.test(e.message||'')?'Saving needs migration 0020 in Supabase.':'Could not load your details.'}
    X.loaded=true;X.loading=false;paintAvatar();
    if(state.tab[state.role]==='profile'&&typeof render==='function')render();
  }
  async function save(patch){
    X.busy=true;X.msg='';X.err='';
    const row={...(X.row||{}),...patch};
    try{
      if(!LIVE){(state.profx=state.profx||{})[state.user.id]=row}
      else{const body={user_id:state.user.id,phone:row.phone||null,address:row.address||null,birthday:row.birthday||null,emergency_name:row.emergency_name||null,emergency_phone:row.emergency_phone||null,about:row.about||null,avatar:row.avatar||null};
        const r=await sb().from('profile_extra').upsert(body);if(r.error)throw r.error}
      X.row=row;X.msg='Saved.';
    }catch(e){X.err=setNeeded.test(e.message||'')?'Saving needs migration 0020 in Supabase.':'Could not save: '+(e.message||'error')}
    X.busy=false;paintAvatar();render();
  }
  setInterval(()=>{
    const u=state.user?state.user.id:null;
    if(u!==X.uid){X.uid=u;X.row=null;X.loaded=false;X.msg='';X.err='';if(u&&!state.user.mustChange)load()}
    paintAvatar();
  },800);
  function avatarHTML(size){
    const u=state.user||{},a=X.row&&X.row.avatar,init=esc(String(u.name||'?').split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase());
    return a?`<img src="${esc(a)}" alt="Your photo" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block">`
      :`<div aria-hidden="true" style="width:${size}px;height:${size}px;border-radius:50%;background:var(--accent);color:var(--accent-fg);display:grid;place-items:center;font-weight:600;font-size:${Math.round(size/3)}px">${init}</div>`;
  }
  function paintAvatar(){
    const w=document.getElementById('who');if(!w||!state.user||!X.row||!X.row.avatar){if(w){const o=w.querySelector('.pxav');if(o)o.remove()}return}
    if(w.querySelector('.pxav'))return;
    const d=document.createElement('div');d.className='pxav';d.style.cssText='margin-bottom:8px';d.innerHTML=avatarHTML(44);w.prepend(d);
  }
  function panel(){
    const r=X.row||{};
    const f=FIELDS.map(([k,l,n,t])=>`<div class="strow"><label class="l" for="px_${k}"><b>${l}</b></label><input id="px_${k}" name="${k}" type="${t}" maxlength="${n}" value="${esc(r[k]||'')}" autocomplete="off"></div>`).join('');
    return `<div class="panel stsec" id="pxPanel"><h3>Photo and personal details <span class="note" style="font-weight:400">(all optional)</span></h3>
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">${avatarHTML(84)}
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" type="button" data-act="pxPick">${r.avatar?'Change photo':'Upload photo'}</button>${r.avatar?'<button class="btn bad sm" type="button" data-act="pxRemove">Remove photo</button>':''}</div></div>
      <div class="note">A square photo works best. JPG, PNG or WebP, up to 8 MB; it is resized on your device.</div>
      <form id="pxForm" novalidate>${f}
        <div class="strow"><label class="l" for="px_about"><b>About me</b><span>A short note, up to 500 characters.</span></label><textarea id="px_about" name="about" rows="3" maxlength="500">${esc(r.about||'')}</textarea></div>
        <div class="err" role="alert">${esc(X.err)}</div>${X.msg?`<div class="banner ok" role="status">${esc(X.msg)}</div>`:''}
        <div class="stbar"><button class="btn" type="submit" ${X.busy?'disabled':''}>Save details</button></div></form>
      <p class="note" style="margin:0">Only you and an administrator can see these details.</p></div>`;
  }
  const base=VIEWS.profile;
  VIEWS.profile=()=>{
    const h=base();if(!X.loaded&&!X.loading)load();
    const i=h.indexOf('<form id="pfPw"');return i<0?h+panel():h.slice(0,i)+panel()+h.slice(i);
  };
  function resize(file){
    return new Promise((ok,no)=>{
      if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type)){return no(new Error('Choose a JPG, PNG or WebP image.'))}
      if(file.size>8*1048576)return no(new Error('That image is larger than 8 MB.'));
      const url=URL.createObjectURL(file),img=new Image();
      img.onload=()=>{const s=Math.min(img.width,img.height),c=document.createElement('canvas');c.width=c.height=256;
        c.getContext('2d').drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,256,256);URL.revokeObjectURL(url);
        let q=.85,d=c.toDataURL('image/jpeg',q);while(d.length>140000&&q>.4){q-=.1;d=c.toDataURL('image/jpeg',q)}ok(d)};
      img.onerror=()=>{URL.revokeObjectURL(url);no(new Error('That file is not a readable image.'))};img.src=url;
    });
  }
  function formVals(f){const fd=new FormData(f),p={};FIELDS.forEach(([k,,n])=>{p[k]=clean(fd.get(k),n)});p.about=clean(fd.get('about'),500);return p}
  document.addEventListener('submit',e=>{
    if(e.target.id!=='pxForm')return;e.preventDefault();e.stopImmediatePropagation();
    const p=formVals(e.target);
    if(p.birthday&&!/^\d{4}-\d{2}-\d{2}$/.test(p.birthday)){X.err='Enter a valid birthday.';return render()}
    save(p);
  },true);
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="px"]');if(!b)return;e.stopImmediatePropagation();
    if(b.dataset.act==='pxPick'){const f=document.createElement('input');f.type='file';f.accept='image/jpeg,image/png,image/webp';
      f.onchange=async()=>{if(!f.files[0])return;try{const d=await resize(f.files[0]),fm=document.getElementById('pxForm');save({...(fm?formVals(fm):{}),avatar:d})}catch(x){X.err=x.message;X.msg='';render()}};f.click()}
    if(b.dataset.act==='pxRemove'){if(confirm('Remove your photo?')){const fm=document.getElementById('pxForm');save({...(fm?formVals(fm):{}),avatar:null})}}
  },true);
  window.VIRTUOSO_PROFX={avatar:()=>X.row&&X.row.avatar||''};
})();
