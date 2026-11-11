/* In-app preview of petty cash receipts and the petty cash sheet (no new tab, no download).
   Live: files are also saved to the private `documents` bucket (petty/<month>/receipts|sheets/) and receipt records are saved with the sheet data (petty-save.js). ?demo: in memory only. */
(function(){
  'use strict';
  const BL={};            /* month -> sheet File */
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isPdf=f=>f.type==='application/pdf'||/\.pdf$/i.test(f.name);
  const isImg=f=>/^image\//.test(f.type)||/\.(png|jpe?g)$/i.test(f.name);

  const oAdd=window.addReceipts;
  if(typeof oAdd==='function')window.addReceipts=function(files){
    const list=[...files],r=oAdd.apply(this,arguments);
    try{const m=state.pcm[state.month];if(m)list.forEach(f=>{const rc=m.receipts.find(x=>x.file===f.name&&!x.blob);if(rc){Object.defineProperty(rc,'blob',{value:f,enumerable:false,writable:true});const mo=state.month;store(f,mo,'receipts').then(p=>{if(p)rc.path=p})}})}catch(e){}
    return r;
  };
  const oLoad=window.loadSheet;
  if(typeof oLoad==='function')window.loadSheet=async function(f){const mo=state.month;BL[mo]=f;const r=await oLoad.apply(this,arguments);
    try{const m=state.pcm[mo];if(m&&m.sheetFile&&m.sheetFile.name===f.name&&!m.sheetFile.path){const p=await store(f,mo,'sheets');if(p&&m.sheetFile)m.sheetFile.path=p}}catch(e){}
    return r};

  const cfg=window.VIRTUOSO||{},LIVE=cfg.supabaseUrl&&cfg.anonKey&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const MIME=f=>f.type||(/\.pdf$/i.test(f.name)?'application/pdf':/\.png$/i.test(f.name)?'image/png':/\.jpe?g$/i.test(f.name)?'image/jpeg':/\.xlsx$/i.test(f.name)?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'');
  const OKM=/^(application\/pdf|image\/(png|jpeg)|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)$/;
  const safe=n=>n.replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^\.+/,'').slice(-90)||'file';
  async function store(f,month,kind){
    if(!LIVE||!sb()||!OKM.test(MIME(f))||f.size>10*1024*1024)return null;
    const path='petty/'+month+'/'+kind+'/'+crypto.randomUUID()+'-'+safe(f.name);
    const r=await sb().storage.from('documents').upload(path,f,{contentType:MIME(f),upsert:false});
    return r.error?null:path;
  }
  async function fetchBlob(path,name){
    const r=await sb().storage.from('documents').createSignedUrl(path,120);
    if(r.error||!r.data)throw new Error('sign');
    const res=await fetch(r.data.signedUrl);if(!res.ok)throw new Error('get');
    const b=await res.blob();return new File([b],name,{type:b.type});
  }
  let urls=[];
  function close(){const o=document.getElementById('pvOv');if(o)o.remove();urls.forEach(u=>URL.revokeObjectURL(u));urls=[];document.removeEventListener('keydown',esc_)}
  function esc_(e){if(e.key==='Escape')close()}
  async function show(file,title){
    close();
    const o=document.createElement('div');o.id='pvOv';o.setAttribute('role','dialog');o.setAttribute('aria-label','Preview '+title);
    o.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(10,20,40,.72);display:flex;flex-direction:column;padding:12px';
    o.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;color:#fff;padding:4px 4px 10px"><b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(title)}</b><button class="btn sm" type="button" id="pvX">Close</button></div><div id="pvB" style="flex:1;min-height:0;background:#fff;border-radius:10px;overflow:auto;display:flex;align-items:flex-start;justify-content:center"></div>`;
    document.body.appendChild(o);
    o.addEventListener('click',e=>{if(e.target===o||e.target.id==='pvX')close()});
    document.addEventListener('keydown',esc_);
    const B=o.querySelector('#pvB');
    try{
      if(isImg(file)){const u=URL.createObjectURL(file);urls.push(u);B.innerHTML=`<img src="${u}" alt="${esc(title)}" style="max-width:100%;height:auto;display:block;margin:auto">`}
      else if(isPdf(file)){const u=URL.createObjectURL(file);urls.push(u);B.style.display='block';B.innerHTML=`<iframe src="${u}" title="${esc(title)}" style="border:0;width:100%;height:100%"></iframe>`}
      else if(/\.(xlsx|xls|csv)$/i.test(file.name)&&window.XLSX){
        B.style.display='block';B.innerHTML='<p class="note" style="padding:14px">Opening…</p>';
        const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
        B.innerHTML='<div style="padding:12px;width:100%;box-sizing:border-box">'+wb.SheetNames.map(n=>`<h3 style="margin:10px 0 6px">${esc(n)}</h3><div style="overflow:auto">${XLSX.utils.sheet_to_html(wb.Sheets[n],{editable:false}).replace(/<\/?(html|head|body)[^>]*>/g,'').replace(/<table/,'<table style="border-collapse:collapse;font-size:12px" border="1" cellpadding="4"')}</div>`).join('')+'</div>';
      }else B.innerHTML='<p class="note" style="padding:14px">This file type cannot be previewed.</p>';
    }catch(e){B.innerHTML='<p class="note" style="padding:14px">The file could not be previewed.</p>'}
  }

  function enhance(){
    const v=document.getElementById('view');if(!v)return;
    v.querySelectorAll('tr').forEach(tr=>{
      const inp=tr.querySelector('input[data-rid]');if(!inp||tr.querySelector('[data-pvr]'))return;
      const td=tr.children[1];if(!td)return;
      const b=document.createElement('button');b.type='button';b.className='btn ghost sm';b.textContent='Preview';b.dataset.pvr=inp.dataset.rid;b.style.marginTop='4px';td.appendChild(b);
      const first=tr.children[0];if(first){first.style.cursor='pointer';first.title='Preview';first.dataset.pvr=inp.dataset.rid}
    });
    const rm=v.querySelector('[data-act="clearSheet"]');
    if(rm&&!v.querySelector('[data-pvs]')){const b=document.createElement('button');b.type='button';b.className='btn sm ghost';b.textContent='Preview sheet';b.dataset.pvs='1';rm.parentNode.insertBefore(b,rm)}
  }
  const prev=render;
  render=function(){const r=prev.apply(this,arguments);try{enhance()}catch(e){}return r};

  document.addEventListener('click',e=>{
    const a=e.target.closest&&e.target.closest('[data-act="removeR"],[data-act="clearSheet"]');
    if(a&&LIVE&&sb()){const m=state.pcm[state.month];let p=null;
      if(m){if(a.dataset.act==='clearSheet')p=m.sheetFile&&m.sheetFile.path;else{const r=m.receipts.find(x=>x.id===a.dataset.id);p=r&&r.path}}
      if(p)setTimeout(()=>sb().storage.from('documents').remove([p]).catch(()=>{}),300)}
    const t=e.target.closest&&e.target.closest('[data-pvr],[data-pvs]');if(!t)return;
    e.stopImmediatePropagation();e.preventDefault();
    if(t.dataset.pvs){const f=BL[state.month],m=state.pcm[state.month];
      if(f)return show(f,f.name);
      if(m&&m.sheetFile&&m.sheetFile.path&&LIVE){toast('Opening the sheet…');return fetchBlob(m.sheetFile.path,m.sheetFile.name).then(b=>{BL[state.month]=b;show(b,b.name)}).catch(()=>toast('The saved sheet could not be opened.'))}
      return toast('Preview is available for sheets uploaded in this session. Upload the sheet again to preview it.')}
    const m=state.pcm[state.month],rc=m&&m.receipts.find(x=>x.id===t.dataset.pvr);if(!rc)return;
    if(rc.blob)return show(rc.blob,rc.file);
    if(rc.path&&LIVE)return fetchBlob(rc.path,rc.file).then(b=>{Object.defineProperty(rc,'blob',{value:b,enumerable:false,writable:true});show(b,rc.file)}).catch(()=>toast('The saved receipt could not be opened.'));
    toast('This file was not saved. Upload it again to preview it.');
  },true);
})();
