/* Admin view of the Leave page: only the leave applications of staff (no application form).
   Staff keep the form. Read only; approving is on the Approvals page. Works live and in ?demo. */
(function(){
  const cfg=window.VIRTUOSO||{},live=cfg.supabaseUrl&&cfg.anonKey&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const e=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let S={rows:null,loading:false,f:'All'};
  const fd=s=>{const d=new Date(String(s).slice(0,10)+'T00:00:00');return isNaN(d)?String(s||''):d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})};
  async function load(){
    if(S.loading)return;S.loading=true;
    if(live&&sb()){
      const [r,p]=await Promise.all([sb().from('leave_requests').select('*').order('from_date',{ascending:false}).limit(300),sb().from('profiles').select('id,name')]);
      const nm=Object.fromEntries((p.data||[]).map(x=>[x.id,x.name]));
      S.rows=(r.data||[]).map(l=>({who:nm[l.user_id]||'Unknown',type:l.leave_type,from:l.from_date,to:l.to_date,days:l.days,reason:l.reason,status:l.status,doc:!!l.doc_path}));
    }else{
      S.rows=[];(state.users||[]).forEach(u=>{((state.data[u.id]||{}).leaves||[]).forEach(l=>S.rows.push({who:u.name,type:l.type,from:l.from,to:l.to,days:l.days,reason:l.reason,status:l.status,doc:!!l.doc}))});
    }
    S.loading=false;render();
  }
  function view(){
    if(S.rows===null)load();
    const all=S.rows||[],rows=S.f==='All'?all:all.filter(r=>r.status===S.f);
    const cnt=s=>all.filter(r=>r.status===s).length;
    const pill=s=>`<span class="pill ${s==='Approved'?'ok':s==='Pending'?'warn':'bad'}">${e(s)}</span>`;
    return `<h2>Leave applications</h2><p class="sub">Leave applications from your staff. Approve or decline them on the Approvals page.</p>
    <div class="panel"><div class="row" style="gap:8px;margin-bottom:10px;flex-wrap:wrap">${['All','Pending','Approved','Declined'].map(f=>`<button class="btn sm ${S.f===f?'':'ghost'}" data-act="alvF" data-f="${f}">${f}${f==='All'?'':' ('+cnt(f)+')'}</button>`).join('')}<button class="btn sm ghost" data-act="alvR">Refresh</button></div>
    <div class="tbl"><table style="min-width:640px"><thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th class="n">Days</th><th>Reason</th><th>Status</th></tr></thead><tbody>
    ${rows.length?rows.map(r=>`<tr><td>${e(r.who)}</td><td>${e(r.type)}</td><td>${e(fd(r.from))} to ${e(fd(r.to))}</td><td class="n">${+r.days||0}</td><td>${e(r.reason||'')}${r.doc?'<div class="note">Document attached</div>':''}</td><td>${pill(r.status)}</td></tr>`).join(''):`<tr><td colspan="6" class="note">${S.rows===null?'Loading…':'No leave applications.'}</td></tr>`}
    </tbody></table></div></div>`;
  }
  function wrap(){
    if(typeof VIEWS==='undefined'||!VIEWS.leave)return setTimeout(wrap,100);
    const ls=window.leaveSummary;if(typeof ls==='function')try{leaveSummary=function(){if(document.getElementById('leaveForm'))return ls.apply(this,arguments)}}catch(x){}
    const base=VIEWS.leave;
    VIEWS.leave=function(){return state.role==='adm'?view():base.apply(this,arguments)};
  }
  setTimeout(wrap,0);
  document.addEventListener('click',ev=>{const b=ev.target.closest&&ev.target.closest('[data-act^=alv]');if(!b)return;ev.stopImmediatePropagation();
    if(b.dataset.act==='alvF'){S.f=b.dataset.f;render()}else{S.rows=null;render()}},true);
})();
