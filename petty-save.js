/* Keeps the Petty cash sheet data (lines, opening float, file name, matches, lock) of every month saved.
   Live: one JSON setting `petty_sheets` in app_settings (admin write by RLS), loaded after sign-in and saved
   a moment after any change. ?demo: stays in memory (state.pcm) until the page is reloaded. */
(function(){
  const cfg=window.VIRTUOSO||{},LIVE=cfg.supabaseUrl&&cfg.anonKey&&!/[?&]demo\b/.test(location.search);
  const KEY='petty_sheets',sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const S={uid:null,loaded:false,last:'',busy:false,status:''};
  const SEEDNAME='Petty cash Oct 2026.xlsx';
  const str=(v,n)=>String(v==null?'':v).slice(0,n||200);
  const MONTH=/^\d{4}-(0[1-9]|1[0-2])$/;
  function pack(){
    const out={};
    Object.keys(state.pcm||{}).filter(k=>MONTH.test(k)).slice(0,60).forEach(k=>{const m=state.pcm[k];
      if(!m||!Array.isArray(m.sheet))return;
      if(m.sheetFile&&m.sheetFile.name===SEEDNAME)return;                 /* the built-in sample month is never saved */
      if(!m.sheet.length&&!m.sheetFile&&!(m.receipts||[]).some(r=>r.path)&&!m.locked&&(m.opening||0)===3000)return;
      out[k]={sheet:m.sheet.slice(0,3000).map(l=>({id:str(l.id,40),date:str(l.date,10),amt:+l.amt||0,desc:str(l.desc),vendor:str(l.vendor)})),
        opening:+m.opening||0,locked:!!m.locked,
        sheetFile:m.sheetFile?{name:str(m.sheetFile.name),size:+m.sheetFile.size||0,at:new Date(m.sheetFile.at||Date.now()).toISOString(),path:str(m.sheetFile.path,300)}:null,
        receipts:(m.receipts||[]).filter(r=>r&&r.path).slice(0,500).map(r=>({id:str(r.id,40),file:str(r.file),size:+r.size||0,kind:r.kind==='img'?'img':'pdf',date:str(r.date,10),vendor:str(r.vendor),amt:+r.amt||0,cat:str(r.cat,40),status:str(r.status,20),ref:str(r.ref,40),path:str(r.path,300)})),
        overrides:m.overrides||{},links:m.links||{}}});
    return out;
  }
  function unpack(doc){
    if(!doc||typeof doc!=='object')return;
    Object.keys(doc).filter(k=>MONTH.test(k)).slice(0,60).forEach(k=>{const d=doc[k];if(!d||!Array.isArray(d.sheet))return;
      state.month=state.month||k;
      const cur=state.pcm[k]||(state.pcm[k]={sheet:[],receipts:[],sheetFile:null,overrides:{},links:{},locked:false,opening:3000});
      cur.sheet=d.sheet.slice(0,3000).map(l=>({id:str(l.id,40)||('L'+Math.random().toString(36).slice(2,9)),date:str(l.date,10),amt:+l.amt||0,desc:str(l.desc),vendor:str(l.vendor)})).filter(l=>/^\d{4}-\d{2}-\d{2}$/.test(l.date)&&l.amt>0);
      cur.opening=+d.opening>=0?+d.opening:cur.opening;cur.locked=!!d.locked;
      cur.sheetFile=d.sheetFile&&d.sheetFile.name?{name:str(d.sheetFile.name),size:+d.sheetFile.size||0,at:new Date(d.sheetFile.at||Date.now()),path:str(d.sheetFile.path,300)}:null;
      if(Array.isArray(d.receipts)){const keep=(cur.receipts||[]).filter(r=>!r.path);cur.receipts=d.receipts.slice(0,500).filter(r=>r&&r.path&&/^petty\//.test(r.path)).map(r=>({id:str(r.id,40),file:str(r.file),size:+r.size||0,kind:r.kind==='img'?'img':'pdf',url:'',date:str(r.date,10),vendor:str(r.vendor),amt:+r.amt||0,cat:str(r.cat,40)||'Other',status:str(r.status,20)||'Needs review',ref:str(r.ref,40),path:str(r.path,300)})).concat(keep)}
      cur.overrides=d.overrides&&typeof d.overrides==='object'?d.overrides:{};cur.links=d.links&&typeof d.links==='object'?d.links:{};});
  }
  async function load(){
    if(!LIVE||!sb())return;
    const r=await sb().from('app_settings').select('value').eq('key',KEY);
    if(r.error){S.status='Could not load saved sheets.';S.loaded=true;S.last=JSON.stringify(pack());return}
    if(r.data&&r.data[0])unpack(r.data[0].value);
    S.last=JSON.stringify(pack());S.loaded=true;
    const t=state.tab&&state.tab[state.role];if(t==='sheets'||t==='petty'||t==='dash')render();
  }
  async function save(json){
    S.busy=true;
    const r=await sb().from('app_settings').upsert({key:KEY,value:JSON.parse(json)});
    S.busy=false;
    if(r.error){S.status='Could not save the sheets.';if(typeof toast==='function')toast('Could not save the petty cash sheet. Check your connection.');return}
    S.last=json;S.status='Saved';
  }
  setInterval(()=>{
    const u=state.user&&state.user.type==='admin'?state.user.id:null;
    if(u!==S.uid){S.uid=u;S.loaded=false;S.last='';if(u)load();return}
    if(!LIVE||!u||!S.loaded||S.busy)return;
    const j=JSON.stringify(pack());if(j!==S.last)save(j);
  },1500);
  window.VIRTUOSO_PETTYSAVE={status:()=>S.status,live:LIVE};
})();
