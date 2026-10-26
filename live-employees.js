/* Live Employees screen (admin). Replaces the demo screen when signed in to the real backend.
   Reads profiles directly (row-level security applies) and does user changes through the
   admin-users Edge Function, which checks the caller is an admin. */
(function(){
  const cfg=window.VIRTUOSO||{};
  if(!(cfg.supabaseUrl&&cfg.anonKey)||/[?&]demo\b/.test(location.search))return;
  const LV={users:null,bal:null,pay:null,payMsg:'',loading:false,cred:null,msg:'',busy:false,balMsg:''};

  async function call(payload){
    const token=await cfg.getAccessToken();
    if(!token)throw new Error('Please sign in again.');
    let r;
    try{r=await fetch(cfg.supabaseUrl.replace(/\/$/,'')+'/functions/v1/admin-users',{method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,apikey:cfg.anonKey},body:JSON.stringify(payload)})}
    catch(x){throw new Error('Could not reach the user-management service. It may not be deployed yet (function admin-users), or you are offline.')}
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||'Something went wrong. Try again.');
    return j;
  }
  async function load(){
    const sb=window.VIRTUOSO.client;if(!sb||LV.loading)return;
    LV.loading=true;
    const {data,error}=await sb.from('profiles').select('*').order('name');
    const bl=await sb.from('leave_balances').select('user_id,leave_type,days');LV.bal=bl.error?[]:bl.data;
    const pp=await sb.from('pay_profiles').select('user_id,base_salary,allowance,other_deduction,effective_from').is('effective_to',null);LV.pay=pp.error?[]:pp.data;
    LV.loading=false;
    if(error){LV.msg='Could not load employees.';LV.users=[]}else LV.users=data;
    render();
  }
  function vLive(){
    if(LV.users===null)load();
    const me=state.user,rows=LV.users||[];
    const cr=LV.cred;
    return `<h2>Employees</h2><p class="sub">Add people and give them a sign-in. They use the email and temporary password on the sign-in screen, then choose their own password.</p>
    <div class="stack">
    ${cr?`<div class="cred"><h3 style="color:var(--ok)">Sign-in details for ${esc(cr.name)}</h3>
      <pre>Email: ${esc(cr.email)}\nTemporary password: ${esc(cr.password)}</pre>
      <p class="note" style="margin:8px 0">Shown once. Share it with ${esc(cr.name.split(' ')[0])} privately. They must set a new password at first sign-in.</p>
      <div class="row"><button class="btn sm" data-act="lvCopy">Copy details</button><button class="btn sm ghost" data-act="lvDone">Done</button></div></div>`:''}
    <div class="panel"><h3>Add employee</h3><form class="form" id="lvEmpForm" novalidate>
      <label>Full name<input id="lvName" required maxlength="100"></label>
      <label>Job title<input id="lvTitle" placeholder="e.g. Tax Consultant" maxlength="80"></label>
      <label>Work email<input id="lvEmail" type="email" required></label>
      <label>Account type<select id="lvRole"><option value="emp">Employee</option><option value="admin">Admin</option></select></label>
      <label>Basic salary (N$ / month)<input id="lvBase" type="number" min="0" step="100" value="15000"></label>
      <label>Allowances (N$ / month)<input id="lvAllow" type="number" min="0" step="50" value="0"></label>
      <label class="chk"><input id="lvAccess" type="checkbox" checked> Access enabled</label>
      <div class="note wide">A strong temporary password is generated for you and shown once.</div>
      <div class="wide err" id="lvErr" role="alert">${esc(LV.msg)}</div>
      <div class="wide"><button class="btn" type="submit" ${LV.busy?'disabled':''}>Add employee</button></div></form></div>
    <div class="panel"><h3>All accounts</h3><div class="tbl"><table style="min-width:760px"><thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Access</th><th>Last sign-in</th><th></th></tr></thead><tbody>
    ${rows.length?rows.map(u=>`<tr><td>${esc(u.name)}<div class="note">${esc(u.title||'')}</div></td><td class="mono">${esc(u.email)}</td><td>${pill(u.role==='admin'?'Admin':'Employee')}</td>
      <td>${pill(u.access_enabled?'Enabled':'Disabled',u.access_enabled?'ok':'bad')}${u.must_change_password?'<div class="note">Temporary password</div>':''}</td>
      <td class="note">${u.last_login_at?fmtDT(new Date(u.last_login_at)):'Never'}</td>
      <td><div class="row"><button class="btn sm ghost" data-act="lvReset" data-id="${esc(u.id)}" ${LV.busy?'disabled':''}>Reset password</button>${u.id===me.id?'':`<button class="btn sm ${u.access_enabled?'bad':''}" data-act="lvToggle" data-id="${esc(u.id)}" ${LV.busy?'disabled':''}>${u.access_enabled?'Disable':'Enable'}</button>`}</div></td></tr>`).join('')
      :`<tr><td colspan="6" class="note">${LV.loading||LV.users===null?'Loading…':'No accounts yet.'}</td></tr>`}
    </tbody></table></div></div>
    <div class="panel"><h3>Pay details</h3>
      <p class="note" style="margin-top:0">Monthly pay used to build each payroll run. Saving starts a new record from the date you choose; the previous record ends the day before, and finalised payroll is never changed. Payroll here is non-tax.</p>
      <form class="form" id="lvPayForm" novalidate>
        <label>Employee<select id="lvPayWho">${rows.filter(u=>u.access_enabled&&u.role==='emp').map(u=>`<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('')}</select></label>
        <label>Basic salary (N$ / month)<input id="lvPayBase" type="number" min="0" step="100" value="15000"></label>
        <label>Allowances (N$ / month)<input id="lvPayAllow" type="number" min="0" step="50" value="0"></label>
        <label>Other deductions (N$ / month)<input id="lvPayOther" type="number" min="0" step="10" value="0"></label>
        <label>Effective from<input id="lvPayFrom" type="date" value="${new Date().toISOString().slice(0,8)}01"></label>
        <button class="btn" type="submit">Save pay details</button></form><div class="err" id="lvPayErr" role="alert">${esc(LV.payMsg)}</div>
      <div class="tbl" style="margin-top:10px"><table style="min-width:620px"><thead><tr><th>Employee</th><th class="n">Basic</th><th class="n">Allowances</th><th class="n">Other deductions</th><th>Since</th></tr></thead><tbody>
      ${rows.filter(u=>u.access_enabled&&u.role==='emp').map(u=>{const p=(LV.pay||[]).find(x=>x.user_id===u.id);return `<tr><td>${esc(u.name)}</td>${p?`<td class="n">${(+p.base_salary).toFixed(2)}</td><td class="n">${(+p.allowance).toFixed(2)}</td><td class="n">${(+p.other_deduction).toFixed(2)}</td><td class="note">${esc(String(p.effective_from))}</td>`:'<td colspan="4" class="note">No pay details yet. They will be left out of payroll.</td>'}</tr>`}).join('')||'<tr><td colspan="5" class="note">No employees yet.</td></tr>'}
      </tbody></table></div></div>
    <div class="panel"><h3>Leave balances</h3>
      <p class="note" style="margin-top:0">Starting balances are placeholders (Annual 15, Sick 10, Family responsibility 3). Set each person's real entitlement here. Approved leave is deducted automatically.</p>
      <form class="form" id="lvBalForm" novalidate>
        <label>Employee<select id="lvBalWho">${rows.filter(u=>u.access_enabled).map(u=>`<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('')}</select></label>
        <label>Leave type<input id="lvBalType" list="lvBalTypes" value="Annual" maxlength="60"><datalist id="lvBalTypes">${[...new Set(['Annual','Sick','Family responsibility',...(LV.bal||[]).map(b=>b.leave_type)])].map(t=>`<option value="${esc(t)}">`).join('')}</datalist></label>
        <label>Days available<input id="lvBalDays" type="number" min="0" max="366" step="0.5" value="15"></label>
        <button class="btn" type="submit">Save balance</button></form><div class="err" id="lvBalErr" role="alert">${esc(LV.balMsg)}</div>
      <div class="tbl" style="margin-top:10px"><table style="min-width:520px"><thead><tr><th>Employee</th><th>Leave balances (days)</th></tr></thead><tbody>
      ${rows.filter(u=>u.access_enabled).map(u=>`<tr><td>${esc(u.name)}</td><td>${(LV.bal||[]).filter(b=>b.user_id===u.id).map(b=>`${esc(b.leave_type)}: <b>${+b.days}</b>`).join(' &middot; ')||'<span class="note">None</span>'}</td></tr>`).join('')}
      </tbody></table></div></div></div>`;
  }
  VIEWS.employees=vLive;

  const lock=on=>document.querySelectorAll('#view button').forEach(b=>{b.disabled=on});
  const showErr=m=>{LV.msg=m;const el=$('#lvErr');if(el)el.textContent=m};
  /* No re-render until it succeeds, so a failed call never wipes what the admin typed. */
  async function act(fn){
    if(LV.busy)return;LV.busy=true;showErr('');lock(true);
    try{await fn();LV.users=null;LV.msg=''}
    catch(x){showErr(x.message);toast(x.message)}
    LV.busy=false;lock(false);
    if(LV.users===null)render();
  }
  document.addEventListener('submit',e=>{
    if(e.target.id==='lvPayForm'){
      e.preventDefault();e.stopImmediatePropagation();
      const who=$('#lvPayWho').value,b=parseFloat($('#lvPayBase').value),a=parseFloat($('#lvPayAllow').value)||0,o=parseFloat($('#lvPayOther').value)||0,from=$('#lvPayFrom').value;
      const er=m=>{LV.payMsg=m;const x=$('#lvPayErr');if(x)x.textContent=m};
      if(!who)return er('Choose an employee.');if(!(b>=0))return er('Enter the basic salary.');if(a<0||o<0)return er('Amounts cannot be negative.');if(!from)return er('Choose the date this starts.');
      er('');if(LV.busy)return;LV.busy=true;lock(true);
      window.VIRTUOSO.client.rpc('set_pay_profile',{p_user:who,p_base:b,p_allow:a,p_other:o,p_from:from}).then(r=>{
        LV.busy=false;lock(false);
        if(r.error)return er(/not permitted|row-level|policy|permission/i.test(r.error.message)?'You are not allowed to do that.':r.error.message);
        LV.users=null;LV.payMsg='';toast('Pay details saved');render()});
      return;
    }
    if(e.target.id==='lvBalForm'){
      e.preventDefault();e.stopImmediatePropagation();
      const who=$('#lvBalWho').value,type=$('#lvBalType').value.trim(),days=parseFloat($('#lvBalDays').value);
      const er=m=>{LV.balMsg=m;const x=$('#lvBalErr');if(x)x.textContent=m};
      if(!who)return er('Choose an employee.');if(type.length<2)return er('Enter the leave type.');if(!(days>=0&&days<=366))return er('Days must be between 0 and 366.');
      er('');if(LV.busy)return;LV.busy=true;lock(true);
      window.VIRTUOSO.client.rpc('set_leave_balance',{p_user:who,p_type:type,p_days:days}).then(r=>{
        LV.busy=false;lock(false);
        if(r.error)return er(/not permitted|row-level|policy|permission/i.test(r.error.message)?'You are not allowed to do that.':r.error.message);
        LV.users=null;LV.balMsg='';toast('Balance saved');render()});
      return;
    }
    if(e.target.id!=='lvEmpForm')return;
    e.preventDefault();e.stopImmediatePropagation();
    const name=$('#lvName').value.trim(),email=$('#lvEmail').value.trim().toLowerCase();
    if(name.length<2)return showErr('Enter the full name.');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return showErr('Enter a valid email address.');
    const body={action:'create',name,email,title:$('#lvTitle').value.trim(),role:$('#lvRole').value,
      base_salary:+$('#lvBase').value||0,allowance:+$('#lvAllow').value||0,access:$('#lvAccess').checked};
    act(async()=>{const j=await call(body);LV.cred={name:j.name,email:j.email,password:j.temp_password};toast(j.name+' added');window.scrollTo(0,0)});
  },true);
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="lv"]');if(!b)return;
    e.stopImmediatePropagation();
    const id=b.dataset.id,u=(LV.users||[]).find(x=>x.id===id);
    switch(b.dataset.act){
      case 'lvDone':LV.cred=null;return render();
      case 'lvCopy':{const c=LV.cred;if(c&&navigator.clipboard)navigator.clipboard.writeText('Email: '+c.email+'\nTemporary password: '+c.password).then(()=>toast('Copied'),()=>toast('Copy failed'));return}
      case 'lvReset':if(!u)return;if(!confirm('Reset the password for '+u.name+'? Their current password stops working.'))return;
        return act(async()=>{const j=await call({action:'reset_password',user_id:id});LV.cred={name:u.name,email:u.email,password:j.temp_password}});
      case 'lvToggle':if(!u)return;
        if(u.access_enabled&&!confirm('Disable '+u.name+'? They will be signed out and cannot sign in.'))return;
        return act(async()=>{await call({action:'set_access',user_id:id,enabled:!u.access_enabled});toast(u.name+(u.access_enabled?' can no longer sign in':' can sign in again'))});
    }
  },true);
})();
