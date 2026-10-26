/* Live Payroll (admin) and Payslips (staff). NON-TAX: no PAYE, SSC or other statutory deductions.
   All calculations and the finalise lock run in the database; this page only displays and asks.
   Bank account details are not stored yet, so the payment list has names and amounts only. */
(function(){
  const cfg=window.VIRTUOSO||{};
  if(!(cfg.supabaseUrl&&cfg.anonKey)||/[?&]demo\b/.test(location.search))return;
  const sb=()=>window.VIRTUOSO.client;
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const nowKey=()=>iso(new Date()).slice(0,7);
  const monthsList=()=>{const out=[],end=nowKey();let y=2026,m=3;while((y+'-'+pad(m))<=end){out.push(y+'-'+pad(m));if(++m>12){m=1;y++}}return out.reverse()};
  const mLabel=k=>typeof monthLabel==='function'?monthLabel(k):k;
  const f2=n=>(Math.round((+n||0)*100)/100).toFixed(2);
  const money=n=>typeof NAD==='function'?NAD(n):'N$ '+f2(n);
  const isAdm=()=>state.user&&state.user.type==='admin';
  const fresh=()=>({uid:null,month:null,run:undefined,slips:null,names:null,missing:[],blockers:0,settings:null,loading:false,busy:false,msg:'',mine:null,loadM:false,sel:null});
  let P=fresh();
  const month=()=>P.month||(P.month=nowKey());
  setInterval(()=>{const u=state.user?state.user.id:null;if(u!==P.uid){const m=P.month;P=fresh();P.uid=u;P.month=m}},700);
  const rpcMsg=m=>/not permitted|row-level|policy|permission/i.test(m||'')?'You are not allowed to do that.':(m||'Something went wrong. Try again.');
  const lock=on=>document.querySelectorAll('#view button,#view input,#view select').forEach(b=>{b.disabled=on});
  const err=m=>{P.msg=m||'';const e=$('#plErr');if(e)e.textContent=P.msg};

  /* ---------- Admin: load ---------- */
  async function load(){
    if(P.loading||!sb())return;P.loading=true;
    const k=month(),first=k+'-01',last=iso(new Date(+k.slice(0,4),+k.slice(5,7),0));
    const run=await sb().from('payroll_runs').select('*').eq('period',first);
    P.run=run.data&&run.data[0]||null;
    const pr=await sb().from('profiles').select('id,name,title,role,access_enabled');
    P.names=Object.fromEntries((pr.data||[]).map(p=>[p.id,p]));
    P.slips=[];
    if(P.run){const s=await sb().from('payslips').select('*').eq('run_id',P.run.id);P.slips=(s.data||[]).sort((a,b)=>((P.names[a.user_id]||{}).name||'').localeCompare((P.names[b.user_id]||{}).name||''))}
    const inRun=new Set(P.slips.map(s=>s.user_id));
    P.missing=(pr.data||[]).filter(p=>p.access_enabled&&p.role==='emp'&&!inRun.has(p.id)).map(p=>p.name);
    const t=await sb().from('time_entries').select('id').eq('status','Pending').gte('work_date',first).lte('work_date',last).limit(1000);
    P.blockers=(t.data||[]).length;
    const st=await sb().from('app_settings').select('key,value').in('key',['payroll_monthly_hours','payroll_overtime_multiplier']);
    P.settings=Object.fromEntries((st.data||[]).map(r=>[r.key,+r.value]));
    P.loading=false;render();
  }
  const reload=()=>{P.run=undefined;P.slips=null};

  /* ---------- Admin: view ---------- */
  function csvOf(){
    const ref='SAL '+mLabel(month()).slice(0,3).toUpperCase()+month().slice(2,4);
    return 'beneficiary,amount,reference\n'+P.slips.map(s=>`"${((P.names[s.user_id]||{}).name||'Unknown').replace(/"/g,'""')}",${f2(s.net)},${ref}`).join('\n');
  }
  function vPayroll(){
    if(P.run===undefined||P.slips===null)load();
    const k=month(),run=P.run,slips=P.slips||[],fin=run&&run.status==='Finalised',set=P.settings||{};
    const T=slips.reduce((t,s)=>({base:t.base+ +s.base,allow:t.allow+ +s.allowance,ot:t.ot+ +s.overtime,gross:t.gross+ +s.base+ +s.allowance+ +s.overtime,loan:t.loan+ +s.loan_deduction,other:t.other+ +s.other_deduction,net:t.net+ +s.net}),{base:0,allow:0,ot:0,gross:0,loan:0,other:0,net:0});
    const sel=`<label style="max-width:260px">Month<select id="plMonth" aria-label="Payroll month">${monthsList().map(m=>`<option value="${m}" ${m===k?'selected':''}>${esc(mLabel(m))}</option>`).join('')}</select></label>`;
    let body;
    if(P.run===undefined)body=`<div class="panel"><p class="note" style="margin:0">Loading…</p></div>`;
    else if(!slips.length)body=`<div class="panel"><h3>No payroll yet for ${esc(mLabel(k))}</h3><p class="note" style="margin-top:0">Creating a draft takes each active employee's pay details, adds any overtime and deductions you enter, and deducts the next instalment of an active loan. Nothing is final until you finalise.</p>
      <button class="btn" data-act="plGenerate">Create draft payroll</button></div>`;
    else body=`${!fin&&P.blockers?`<div class="banner">${P.blockers} timesheet entr${P.blockers>1?'ies are':'y is'} still waiting for approval in ${esc(mLabel(k))}. Approve them before finalising.</div>`:''}
      ${!fin&&P.missing.length?`<div class="banner">Not in this run (no pay details yet): ${esc(P.missing.join(', '))}. Add their pay on the Employees page, then recalculate.</div>`:''}
      <div class="panel"><div class="tbl"><table style="min-width:900px"><thead><tr><th>Employee</th><th class="n">Basic</th><th class="n">Allow.</th><th class="n">OT hours</th><th class="n">Overtime</th><th class="n">Gross</th><th class="n">Loan</th><th class="n">Other</th><th class="n">Net</th></tr></thead><tbody>
      ${slips.map(s=>{const p=P.names[s.user_id]||{name:'Unknown',title:''};const g=+s.base+ +s.allowance+ +s.overtime;
        return `<tr data-slip="${esc(s.id)}"><td>${esc(p.name)}<div class="note">${esc(p.title||'')}</div></td><td class="n">${f2(s.base)}</td><td class="n">${f2(s.allowance)}</td>
        <td class="n">${fin?f2(s.overtime_hours):`<input type="number" min="0" max="300" step="0.5" value="${+s.overtime_hours}" data-plin="ot" style="width:80px" aria-label="Overtime hours for ${esc(p.name)}">`}</td>
        <td class="n">${f2(s.overtime)}</td><td class="n">${f2(g)}</td><td class="n">${f2(s.loan_deduction)}</td>
        <td class="n">${fin?f2(s.other_deduction):`<input type="number" min="0" step="0.01" value="${+s.other_deduction}" data-plin="other" style="width:100px" aria-label="Other deductions for ${esc(p.name)}">`}</td><td class="n"><b>${f2(s.net)}</b></td></tr>`}).join('')}
      <tr class="total"><td>Total</td><td class="n">${f2(T.base)}</td><td class="n">${f2(T.allow)}</td><td class="n"></td><td class="n">${f2(T.ot)}</td><td class="n">${f2(T.gross)}</td><td class="n">${f2(T.loan)}</td><td class="n">${f2(T.other)}</td><td class="n">${f2(T.net)}</td></tr>
      </tbody></table></div>
      ${fin?`<p class="note" style="margin:10px 0 0">Finalised ${run.finalised_at?esc(new Date(run.finalised_at).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})):''}. This run is locked.</p>`
        :`<div class="row" style="margin-top:12px"><button class="btn ghost" data-act="plRegen">Recalculate from pay details</button><button class="btn" data-act="plFinalise" ${P.blockers?'disabled':''}>Finalise run</button></div>`}</div>
      ${fin?`<div class="panel"><h3>Payment list</h3><p class="note" style="margin-top:0">Bank account details are not stored yet, so this list has names, amounts and a reference only. Total ${money(T.net)}.</p><pre>${esc(csvOf())}</pre>
        <div class="row" style="margin-top:12px"><button class="btn ghost" data-act="plCopy">Copy</button><button class="btn ghost" data-act="plCsv">Download CSV</button></div></div>`:''}`;
    const settings=!fin?`<div class="panel"><h3>Overtime settings</h3><p class="note" style="margin-top:0">Overtime pay = hours × (basic ÷ monthly hours) × multiplier. These are your firm's settings, not statutory figures. Changing them affects the next calculation.</p>
      <form class="form" id="plSetForm" novalidate><label>Monthly hours<input id="plHours" type="number" min="1" max="400" step="0.01" value="${set.payroll_monthly_hours??173.33}"></label>
      <label>Overtime multiplier<input id="plMult" type="number" min="1" max="5" step="0.05" value="${set.payroll_overtime_multiplier??1.5}"></label><button class="btn ghost" type="submit">Save settings</button></form></div>`:'';
    return `<h2>Payroll run, ${esc(mLabel(k))}</h2><p class="sub">Non-tax run: no PAYE, SSC or other statutory deductions are calculated. ${run?pill(fin?'Finalised':'Draft',fin?'ok':'warn'):''}</p>
      <div class="stack">${sel}<div class="err" id="plErr" role="alert">${esc(P.msg)}</div>${body}${settings}</div>`;
  }

  /* ---------- Staff: payslips ---------- */
  async function loadMine(){
    if(P.loadM||!sb())return;P.loadM=true;
    const r=await sb().from('payslips').select('*').eq('user_id',state.user.id).order('period',{ascending:false}).limit(36);
    P.loadM=false;P.mine=r.error?[]:r.data;if(P.mine.length&&!P.sel)P.sel=P.mine[0].id;render();
  }
  function vSlip(){
    if(P.mine===null)loadMine();
    const list=P.mine||[],s=list.find(x=>x.id===P.sel)||list[0],e=state.user;
    if(!s)return `<h2>Payslips</h2><p class="sub">${P.mine===null?'Loading…':'You have no finalised payslips yet. A payslip appears here once payroll for that month is finalised.'}</p>`;
    const g=+s.base+ +s.allowance+ +s.overtime,ded=+s.loan_deduction+ +s.other_deduction,k=String(s.period).slice(0,7);
    return `<h2>Payslips</h2><p class="sub">Your finalised payslips.</p>
    <div class="stack"><label style="max-width:260px">Month<select id="plSlipSel" aria-label="Payslip month">${list.map(x=>`<option value="${esc(x.id)}" ${x.id===s.id?'selected':''}>${esc(mLabel(String(x.period).slice(0,7)))}</option>`).join('')}</select></label>
    <div class="panel slip"><div class="hd"><div><b>Virtuous Accounting Solutions CC</b><div class="note">Windhoek, Namibia</div></div><div style="text-align:right"><b>Payslip, ${esc(mLabel(k))}</b><div>${pill('Final','ok')}</div></div></div>
    <div class="note" style="margin-bottom:10px">${esc(e.name)} · ${esc(e.title||'')}</div>
    <h3>Earnings</h3><dl><dt>Basic salary</dt><dd>${money(s.base)}</dd><dt>Allowances</dt><dd>${money(s.allowance)}</dd><dt>Overtime (${+s.overtime_hours} h)</dt><dd>${money(s.overtime)}</dd><dt><b>Gross pay</b></dt><dd><b>${money(g)}</b></dd></dl>
    <h3>Deductions</h3><dl><dt>Loan instalment</dt><dd>${money(s.loan_deduction)}</dd><dt>Other deductions</dt><dd>${money(s.other_deduction)}</dd><dt><b>Total deductions</b></dt><dd><b>${money(ded)}</b></dd></dl>
    <div class="net-pay"><span>Net pay</span><span class="mono">${money(s.net)}</span></div>
    <p class="note" style="margin:10px 0 0">Non-tax payslip: no PAYE, SSC or other statutory deductions are included.</p></div></div>`;
  }
  VIEWS.payroll=vPayroll;VIEWS.slip=vSlip;

  /* ---------- Actions ---------- */
  async function act(fn,done){
    if(P.busy)return;P.busy=true;err('');lock(true);
    let ok=false;try{await fn();ok=true}catch(x){err(x.message);toast(x.message)}
    P.busy=false;lock(false);if(ok){done&&done();reload();render()}
  }
  document.addEventListener('change',e=>{
    const t=e.target;
    if(t.id==='plMonth'){e.stopImmediatePropagation();P.month=t.value;P.msg='';reload();return render()}
    if(t.id==='plSlipSel'){e.stopImmediatePropagation();P.sel=t.value;return render()}
    if(t.dataset&&t.dataset.plin){
      e.stopImmediatePropagation();
      const tr=t.closest('tr'),ot=parseFloat(tr.querySelector('[data-plin=ot]').value),oth=parseFloat(tr.querySelector('[data-plin=other]').value);
      if(!(ot>=0&&ot<=300)||!(oth>=0)){err('Enter overtime hours from 0 to 300 and deductions of 0 or more.');return}
      act(async()=>{const r=await sb().rpc('set_payslip_inputs',{p_slip:tr.dataset.slip,p_ot_hours:ot,p_other:oth});if(r.error)throw new Error(rpcMsg(r.error.message))},()=>toast('Updated'));
    }
  },true);
  document.addEventListener('submit',e=>{
    if(e.target.id!=='plSetForm')return;
    e.preventDefault();e.stopImmediatePropagation();
    const h=parseFloat($('#plHours').value),m=parseFloat($('#plMult').value);
    if(!(h>=1&&h<=400))return err('Monthly hours must be between 1 and 400.');if(!(m>=1&&m<=5))return err('The multiplier must be between 1 and 5.');
    act(async()=>{const r=await sb().from('app_settings').upsert([{key:'payroll_monthly_hours',value:h},{key:'payroll_overtime_multiplier',value:m}]);if(r.error)throw new Error(rpcMsg(r.error.message))},()=>toast('Settings saved. Recalculate the draft to apply them.'));
  },true);
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="pl"]');if(!b)return;
    e.stopImmediatePropagation();
    const a=b.dataset.act,per=month()+'-01';
    if(a==='plGenerate')return act(async()=>{const r=await sb().rpc('generate_payroll',{p_period:per,p_regenerate:false});if(r.error)throw new Error(rpcMsg(r.error.message));
      const sk=(r.data&&r.data.skipped)||[];if(sk.length)P.msg='No pay details yet for: '+sk.join(', ')+'. They are not in this run.'},()=>toast('Draft payroll created'));
    if(a==='plRegen'){if(!confirm('Recalculate this draft from current pay details? Overtime hours and deductions you typed in will be reset.'))return;
      return act(async()=>{const r=await sb().rpc('generate_payroll',{p_period:per,p_regenerate:true});if(r.error)throw new Error(rpcMsg(r.error.message))},()=>toast('Draft recalculated'))}
    if(a==='plFinalise'){if(!P.run||!confirm('Finalise payroll for '+mLabel(month())+'? It will be locked and each active loan advances by one instalment. This cannot be undone.'))return;
      return act(async()=>{const r=await sb().rpc('finalise_run',{p_run:P.run.id});if(r.error)throw new Error(/timesheets still/i.test(r.error.message)?'Timesheets are still waiting for approval.':rpcMsg(r.error.message))},()=>toast('Payroll finalised'))}
    if(a==='plCopy'){if(navigator.clipboard)navigator.clipboard.writeText(csvOf()).then(()=>toast('Copied'),()=>toast('Copy failed'));return}
    if(a==='plCsv'){const u=URL.createObjectURL(new Blob([csvOf()],{type:'text/csv'})),l=document.createElement('a');l.href=u;l.download='payment-list-'+month()+'.csv';document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);return}
  },true);
})();
