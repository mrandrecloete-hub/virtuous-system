/* Live Leave and Loans for staff. Rules (balance, overlaps, one active loan, withdrawals) are enforced
   by the database; the checks here only give quick feedback. Approvals are in live-time.js.
   Starting leave balances are placeholders until an admin sets real entitlements. */
(function(){
  const cfg=window.VIRTUOSO||{};
  if(!(cfg.supabaseUrl&&cfg.anonKey)||/[?&]demo\b/.test(location.search))return;
  const sb=()=>window.VIRTUOSO.client;
  const fresh=()=>({uid:null,bal:null,reqs:null,loans:null,loadL:false,loadN:false,busy:false});
  let S=fresh();
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const parse=s=>new Date(s+'T00:00:00');
  const fd=s=>parse(String(s).slice(0,10)).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  const money=n=>typeof NAD==='function'?NAD(n):'N$ '+(+n||0).toFixed(2);
  const OKF=/^(application\/pdf|image\/jpeg|image\/png)$/;
  const nextWorkday=()=>{const d=new Date();do{d.setDate(d.getDate()+1)}while(d.getDay()===0||d.getDay()===6);return iso(d)};
  const safeMsg=m=>/violates|row-level|policy|permission|duplicate key|schema cache|does not exist/i.test(m||'')?'Something went wrong. Try again.':(m||'Something went wrong. Try again.');
  setInterval(()=>{const u=state.user?state.user.id:null;if(u!==S.uid){S=fresh();S.uid=u}},700);

  async function loadLeave(){if(S.loadL||!sb())return;S.loadL=true;
    const b=await sb().from('leave_balances').select('leave_type,days').eq('user_id',state.user.id).order('leave_type');
    const r=await sb().from('leave_requests').select('*').eq('user_id',state.user.id).order('from_date',{ascending:false}).limit(50);
    S.loadL=false;S.bal=b.error?[]:b.data;S.reqs=r.error?[]:r.data;render()}
  async function loadLoans(){if(S.loadN||!sb())return;S.loadN=true;
    const r=await sb().from('loans').select('*').eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(50);
    S.loadN=false;S.loans=r.error?[]:r.data;render()}

  /* ---------- Leave ---------- */
  function vLeave(){
    if(S.bal===null||S.reqs===null)loadLeave();
    const bal=S.bal||[],reqs=S.reqs||[],d=nextWorkday();
    return `<h2>Leave</h2><p class="sub">Fill in the form below. Your administrator reviews it and your balance updates once it is approved.</p>
    <div class="stack"><div class="tiles">${bal.length?bal.map(b=>`<div class="tile"><b>${+b.days}</b><span>${esc(b.leave_type)} days left</span></div>`).join(''):`<div class="tile"><b>-</b><span>${S.bal===null?'Loading balances…':'No leave balances set yet'}</span></div>`}</div>
    <div class="panel"><h3>Leave application</h3><form class="form" id="leaveForm" novalidate>
      <label>Leave type<select id="lType">${[...new Set(['Annual','Sick','Family responsibility',...bal.map(b=>b.leave_type),'Unpaid'])].map(t=>`<option>${esc(t)}</option>`).join('')}</select></label>
      <label>First day<input id="lFrom" type="date" value="${d}" required></label>
      <label>Last day<input id="lTo" type="date" value="${d}" required></label>
      <label>Length<select id="lPortion"><option value="full">Full days</option><option value="half">Half day (one day only)</option></select></label>
      <label class="wide">Reason<textarea id="lReason" maxlength="300" placeholder="Briefly say why you need leave"></textarea></label>
      <label>Phone number while away<input id="lPhone" type="tel" maxlength="30" placeholder="081 000 0000"></label>
      <label>Who covers your work<input id="lCover" maxlength="80" placeholder="Colleague name"></label>
      <label class="wide">Supporting document <span id="lDocNote" class="note"></span><input id="lFile" type="file" accept=".pdf,.jpg,.jpeg,.png"></label>
      <div class="wide note" id="lSum"></div>
      <label class="chk wide"><input id="lDecl" type="checkbox"> I confirm the details above are correct.</label>
      <div class="wide err" id="lErr" role="alert"></div>
      <div class="wide"><button class="btn" type="submit">Send application</button></div></form></div>
    <div class="panel"><h3>My applications</h3><div class="tbl"><table style="min-width:640px"><thead><tr><th>Type</th><th>Dates</th><th class="n">Days</th><th>Reason</th><th>Status</th><th></th></tr></thead><tbody>
      ${reqs.length?reqs.map(l=>`<tr><td>${esc(l.leave_type)}</td><td>${esc(fd(l.from_date))} to ${esc(fd(l.to_date))}</td><td class="n">${+l.days}</td><td>${esc(l.reason||'')}${l.doc_path?'<div class="note">Document attached</div>':''}</td><td>${pill(l.status,stc(l.status))}</td>
        <td>${l.status==='Pending'?`<button class="btn sm ghost" data-act="llWithdraw" data-id="${esc(l.id)}">Withdraw</button>`:''}</td></tr>`).join(''):`<tr><td colspan="6" class="note">${S.reqs===null?'Loading…':'No applications yet.'}</td></tr>`}
    </tbody></table></div></div></div>`;
  }
  /* The app calls this after every render of the Leave page and on input; use live balances. */
  leaveSummary=function(){
    const form=$('#leaveForm');if(!form)return;
    const c=leaveCalc(),b=(S.bal||[]).find(x=>x.leave_type===c.type);
    $('#lPortion').disabled=!c.single;if(!c.single)$('#lPortion').value='full';
    $('#lDocNote').textContent=c.type==='Sick'&&c.days>2?'(required for sick leave over 2 days)':'(optional)';
    $('#lSum').textContent=c.days?`${c.days} working day${c.days===1?'':'s'}`+(b?`. Balance after approval: ${(+b.days-c.days).toFixed(1)} days.`:'. Unpaid leave does not use a balance.'):'Pick working days to see the length.';
  };

  /* ---------- Loans ---------- */
  function vLoans(){
    if(S.loans===null)loadLoans();
    const loans=S.loans||[],L=loans.find(l=>l.status==='Active'),n=L?Math.max(1,Math.round(L.amount/L.instalment)):0,bal=L?L.amount-L.instalments_paid*L.instalment:0;
    const rows=L?Array.from({length:n},(_,i)=>`<tr><td>Instalment ${i+1}</td><td class="n">${money(L.instalment)}</td><td>${pill(i<L.instalments_paid?'Paid':'Scheduled',i<L.instalments_paid?'ok':'')}</td></tr>`).join(''):'';
    return `<h2>Loans</h2><p class="sub">Request a salary advance. Once payroll is connected, instalments are deducted in each payroll run.</p>
    <div class="stack"><div class="tiles"><div class="tile"><b>${money(bal)}</b><span>Outstanding</span></div><div class="tile"><b>${L?L.instalments_paid+' / '+n:'None'}</b><span>Instalments paid</span></div></div>
    ${L?`<div class="panel"><h3>${esc(L.label)}</h3><div class="tbl"><table><tbody>${rows}</tbody></table></div></div>`:''}
    <div class="panel"><h3>Request an advance</h3><form class="form" id="loanForm" novalidate>
      <label>Amount (N$)<input id="aAmt" type="number" min="100" step="100" value="2000"></label>
      <label>Repay over (months)<input id="aMon" type="number" min="1" max="12" value="4"></label>
      <button class="btn" type="submit">Send request</button></form><div class="err" id="aErr" role="alert"></div>
      ${loans.filter(l=>l!==L).map(l=>`<p class="note" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${esc(l.label)}: ${pill(l.status,stc(l.status))}${l.status==='Pending'?`<button class="btn sm ghost" data-act="llLoanWithdraw" data-id="${esc(l.id)}">Withdraw</button>`:''}</p>`).join('')}</div></div>`;
  }
  VIEWS.leave=vLeave;VIEWS.loans=vLoans;

  const lockAll=on=>document.querySelectorAll('#view button').forEach(b=>{b.disabled=on});
  document.addEventListener('submit',async e=>{
    const f=e.target.id;if(f!=='leaveForm'&&f!=='loanForm')return;
    e.preventDefault();e.stopImmediatePropagation();if(S.busy)return;
    if(f==='loanForm'){
      const amt=Math.round(parseFloat($('#aAmt').value)*100)/100,m=parseInt($('#aMon').value),er=$('#aErr');
      if(!(amt>=100))return er.textContent='Enter an amount of N$ 100 or more.';if(!(m>=1&&m<=12))return er.textContent='Choose 1 to 12 months.';
      if((S.loans||[]).some(l=>l.status==='Pending'))return er.textContent='You already have a request waiting for approval.';
      er.textContent='';S.busy=true;lockAll(true);
      const r=await sb().from('loans').insert({label:'Advance '+money(amt)+' over '+m+' month'+(m>1?'s':''),amount:amt,instalment:Math.round(amt/m*100)/100});
      S.busy=false;lockAll(false);
      if(r.error)return er.textContent=safeMsg(r.error.message);
      S.loans=null;toast('Advance request sent');return render();
    }
    const c=leaveCalc(),err=$('#lErr'),reason=$('#lReason').value.trim(),file=$('#lFile').files[0],b=(S.bal||[]).find(x=>x.leave_type===c.type),reqs=S.reqs||[];
    let m='';
    if(!c.from||!c.to)m='Choose the first and last day.';
    else if(c.to<c.from)m='The last day cannot be before the first day.';
    else if(!c.days)m='Those dates have no working days.';
    else if(b&&c.days>+b.days)m='You only have '+(+b.days)+' '+c.type.toLowerCase()+' days left.';
    else if(reqs.some(l=>(l.status==='Pending'||l.status==='Approved')&&!(c.to<l.from_date||c.from>l.to_date)))m='These dates overlap another application.';
    else if(c.type==='Sick'&&c.days>2&&!file)m='Attach a doctor\'s note for sick leave over 2 days.';
    else if(file&&!OKF.test(file.type||''))m='The document must be a PDF, JPG or PNG.';
    else if(file&&file.size>10*1024*1024)m='The document is larger than 10 MB.';
    else if(reason.length<3)m='Give a short reason.';
    else if(!$('#lDecl').checked)m='Tick the confirmation to send.';
    if(m)return err.textContent=m;
    err.textContent='';S.busy=true;lockAll(true);
    let path=null;
    try{
      if(file){path=state.user.id+'/leave/'+crypto.randomUUID()+'-'+file.name.replace(/[^A-Za-z0-9._-]+/g,'_').slice(-80);
        const up=await sb().storage.from('documents').upload(path,file,{contentType:file.type,upsert:false});if(up.error){path=null;throw new Error('The document could not be uploaded. Try again.')}}
      const r=await sb().from('leave_requests').insert({leave_type:c.type,from_date:c.from,to_date:c.to,days:c.days,half_day:!!c.half,reason,cover_name:$('#lCover').value.trim()||null,phone:$('#lPhone').value.trim()||null,doc_path:path});
      if(r.error){if(path)await sb().storage.from('documents').remove([path]);throw new Error(safeMsg(r.error.message))}
    }catch(x){S.busy=false;lockAll(false);return err.textContent=x.message}
    S.busy=false;lockAll(false);S.reqs=null;S.bal=null;toast('Leave application sent');render();
  },true);

  document.addEventListener('click',async e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="ll"]');if(!b)return;
    e.stopImmediatePropagation();if(S.busy)return;
    const kind=b.dataset.act==='llWithdraw'?'leave':'loan';
    if(!confirm('Withdraw this request?'))return;
    S.busy=true;lockAll(true);
    const r=await sb().rpc('withdraw_request',{p_kind:kind,p_id:b.dataset.id});
    S.busy=false;lockAll(false);
    if(r.error)return toast(safeMsg(r.error.message));
    if(kind==='leave')S.reqs=null;else S.loans=null;toast('Request withdrawn');render();
  },true);
})();
