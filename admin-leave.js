/* Admin view of the Leave page: only the leave applications of staff (no application form).
   View form, approve or decline, and change a decision later (migration 0021 reconsider_leave). Works live and in ?demo. */
(function(){
  const cfg=window.VIRTUOSO||{},live=cfg.supabaseUrl&&cfg.anonKey&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const e=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let S={rows:null,loading:false,f:'All'};
  const fd=s=>{const d=new Date(String(s).slice(0,10)+'T00:00:00');return isNaN(d)?String(s||''):d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})};
  async function load(){
    if(S.loading)return;S.loading=true;
    if(live&&sb()){
      const [r,p]=await Promise.all([sb().from('leave_requests').select('*').order('from_date',{ascending:false}).limit(300),sb().from('profiles').select('*')]);
      const nm=Object.fromEntries((p.data||[]).map(x=>[x.id,x]));
      S.rows=(r.data||[]).map(l=>({raw:l,id:l.id,who:(nm[l.user_id]||{}).name||'Unknown',title:(nm[l.user_id]||{}).title||'',email:(nm[l.user_id]||{}).email||'',type:l.leave_type,from:l.from_date,to:l.to_date,days:l.days,reason:l.reason,status:l.status,doc:!!l.doc_path}));
    }else{
      S.rows=[];(state.users||[]).forEach(u=>{((state.data[u.id]||{}).leaves||[]).forEach(l=>S.rows.push({id:l.id,demo:l,who:u.name,title:u.title||'',email:u.email||'',type:l.type,from:l.from,to:l.to,days:l.days,reason:l.reason,status:l.status,doc:!!l.doc}))});
    }
    S.loading=false;render();
  }
  function view(){
    if(S.rows===null)load();
    const all=S.rows||[],rows=S.f==='All'?all:all.filter(r=>S.f==='Declined'?(r.status==='Rejected'||r.status==='Declined'):r.status===S.f);
    const cnt=s=>all.filter(r=>s==='Declined'?(r.status==='Rejected'||r.status==='Declined'):r.status===s).length;
    const pill=s=>`<span class="pill ${s==='Approved'?'ok':s==='Pending'?'warn':'bad'}">${e(s)}</span>`;
    return `<h2>Leave applications</h2><p class="sub">Leave applications from your staff. View the form, approve or decline. You can still change a decision later; the employee is notified.</p>
    <div class="panel"><div class="row" style="gap:8px;margin-bottom:10px;flex-wrap:wrap">${['All','Pending','Approved','Declined'].map(f=>`<button class="btn sm ${S.f===f?'':'ghost'}" data-act="alvF" data-f="${f}">${f}${f==='All'?'':' ('+cnt(f)+')'}</button>`).join('')}<button class="btn sm ghost" data-act="alvR">Refresh</button></div>
    <div class="tbl"><table style="min-width:640px"><thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th class="n">Days</th><th>Reason</th><th>Status</th><th></th></tr></thead><tbody>
    ${rows.length?rows.map(r=>`<tr><td>${e(r.who)}</td><td>${e(r.type)}</td><td>${e(fd(r.from))} to ${e(fd(r.to))}</td><td class="n">${+r.days||0}</td><td>${e(r.reason||'')}${r.doc?'<div class="note">Document attached</div>':''}</td><td>${pill(r.status)}</td><td style="white-space:nowrap"><button class="btn sm ghost" data-act="alvV" data-id="${e(r.id)}">View</button>${r.status!=='Approved'?` <button class="btn sm" data-act="alvY" data-id="${e(r.id)}">Approve</button>`:''}${r.status!=='Rejected'&&r.status!=='Declined'?` <button class="btn sm ghost" data-act="alvN" data-id="${e(r.id)}">Decline</button>`:''}</td></tr>`).join(''):`<tr><td colspan="7" class="note">${S.rows===null?'Loading…':'No leave applications.'}</td></tr>`}
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
    const a=b.dataset.act,r=(S.rows||[]).find(x=>String(x.id)===b.dataset.id);
    if(a==='alvF'){S.f=b.dataset.f;render()}
    else if(a==='alvR'){S.rows=null;render()}
    else if(a==='alvV'&&r&&window.VIRTUOSO_LEAVEPRINT){const l=r.raw||{};
      window.VIRTUOSO_LEAVEPRINT.open({ref:'LV-'+String(r.id).slice(0,8).toUpperCase(),status:r.status,name:r.who,title:r.title,email:r.email,type:r.type,from:String(r.from).slice(0,10),to:String(r.to).slice(0,10),days:+r.days,half:!!l.half_day,reason:r.reason||'',phone:l.phone||'',cover:l.cover_name||(r.demo&&r.demo.cover)||'',doc:r.doc})}
    else if((a==='alvY'||a==='alvN')&&r){const ok=a==='alvY';
      if(!confirm((ok?'Approve':'Decline')+' '+r.who+"'s "+String(r.type).toLowerCase()+' leave ('+fd(r.from)+' to '+fd(r.to)+')'+(r.status==='Pending'?'?':' instead of '+r.status.toLowerCase()+'? The employee is notified.')))return;
      if(live&&sb()){const pend=r.status==='Pending';
        sb().rpc(pend?'decide_leave':'reconsider_leave',{p_id:r.id,p_approve:ok}).then(x=>{
          if(x.error)return toast(/function .*does not exist|schema cache/i.test(x.error.message)?'Changing a decision needs migration 0021 to be run.':/not permitted|policy/i.test(x.error.message)?'You are not allowed to do that.':x.error.message);
          toast('Leave '+(ok?'approved':'declined'));S.rows=null;render();try{if(window.VIRTUOSO_TIME&&VIRTUOSO_TIME.refresh)VIRTUOSO_TIME.refresh()}catch(z){}})}
      else{r.demo.status=ok?'Approved':'Rejected';S.rows=null;render();toast('Leave '+(ok?'approved':'declined'))}}
  },true);
})();
