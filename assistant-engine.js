/* Built-in assistant brain: no AI service, no API key. It recognises common questions by keywords,
   looks the answer up in the data (live database via row-level security, or the sample data in demo
   mode) and explains how to do things in the app. It is read-only. */
(function(){
  const V=()=>window.VIRTUOSO||{};
  const sb=()=>V().client||null;
  const live=()=>!!sb();
  const isAdmin=()=>state.user&&state.user.type==='admin';
  const money=n=>'N$ '+(+n||0).toLocaleString('en-NA',{minimumFractionDigits:2,maximumFractionDigits:2});
  const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const today=()=>live()?new Date():new Date((state.today||iso(new Date()))+'T00:00:00');
  const weekRange=()=>{const t=today(),d=(t.getDay()+6)%7,a=new Date(t);a.setDate(t.getDate()-d);const b=new Date(a);b.setDate(a.getDate()+6);return [iso(a),iso(b)]};
  const monthStart=()=>{const t=today();return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-01'};
  const list=(rows,max=8)=>rows.slice(0,max).map(r=>'- '+r).join('\n')+(rows.length>max?'\n- and '+(rows.length-max)+' more':'');
  const adminOnly='That one is for administrators. Ask your administrator, or I can help with your own leave, hours and requests.';
  const sel=async(t,cols,f)=>{let q=sb().from(t).select(cols);if(f)q=f(q);const {data,error}=await q;if(error)throw new Error('I could not read '+t+'.');return data||[]};
  const nameMap=async()=>Object.fromEntries((await sel('profiles','id,name')).map(p=>[p.id,p.name]));

  /* ---------- Data lookups (live and demo) ---------- */
  const Q={
    async leaveBalance(){
      if(!live())return {rows:D().leaveBal.map(([t,d])=>[t,d]),src:'leave'};
      return {rows:(await sel('leave_balances','leave_type,days',q=>q.eq('user_id',state.user.id))).map(r=>[r.leave_type,+r.days]),src:'leave_balances'};
    },
    async myRequests(){
      if(!live()){const d=D();return {leave:d.leaves.map(l=>`${l.type} leave ${l.from} to ${l.to}: ${l.status}`),loans:d.loans.map(l=>`${l.label}: ${l.status}`),ts:d.entries.filter(e=>e.status!=='Draft').length,src:'requests'}}
      const me=state.user.id;
      const lv=await sel('leave_requests','leave_type,from_date,to_date,status',q=>q.eq('user_id',me).order('from_date',{ascending:false}).limit(10));
      const ln=await sel('loans','label,status',q=>q.eq('user_id',me).limit(10));
      return {leave:lv.map(l=>`${l.leave_type} leave ${l.from_date} to ${l.to_date}: ${l.status}`),loans:ln.map(l=>`${l.label}: ${l.status}`),ts:0,src:'leave_requests, loans'};
    },
    async hoursThisWeek(){
      const [a,b]=weekRange();
      if(!live()){const t=D().entries.reduce((s,e)=>s+e.hrs,0);return {total:t,rows:D().entries.map(e=>`${e.day}: ${e.hrs} h, ${e.client} (${e.status})`),a,b,src:'timesheet'}}
      const r=await sel('time_entries','work_date,hours,status,task',q=>q.eq('user_id',state.user.id).gte('work_date',a).lte('work_date',b).order('work_date'));
      return {total:r.reduce((s,x)=>s+ +x.hours,0),rows:r.map(x=>`${x.work_date}: ${x.hours} h, ${x.task} (${x.status})`),a,b,src:'time_entries'};
    },
    async pendingTimesheets(){
      if(!live()){const p=state.approvals.filter(a=>a.status==='Pending'&&a.type==='Timesheet');return {rows:p.map(a=>`${a.who}: ${a.detail}`),src:'approvals'}}
      const r=await sel('time_entries','user_id,hours',q=>q.eq('status','Pending'));const nm=await nameMap(),g={};
      r.forEach(x=>{g[x.user_id]=(g[x.user_id]||0)+ +x.hours});
      return {rows:Object.entries(g).map(([u,h])=>`${nm[u]||'Unknown'}: ${h} h waiting`),src:'time_entries'};
    },
    async payrollState(){
      const pt=await Q.pendingTimesheets();
      if(!live())return {pending:pt.rows,finalised:state.finalised,src:'payroll'};
      const run=await sel('payroll_runs','period,status',q=>q.eq('period',monthStart()));
      return {pending:pt.rows,finalised:run[0]?run[0].status==='Finalised':false,hasRun:run.length>0,src:'payroll_runs, time_entries'};
    },
    async lowStock(){
      if(!live()){const l=lowItems();return {rows:l.map(it=>{const s=stock(it,curMonth());return `${it.name}: ${s.left} ${it.unit} left`}),thr:state.stat.thr,src:'stationery'}}
      const items=await sel('stationery_items','id,name,unit,opening_qty');const mv=await sel('stationery_moves','item_id,move_type,qty');
      const st=await sel('app_settings','value',q=>q.eq('key','stationery_low_threshold'));const thr=st[0]?+st[0].value:2;
      const rows=items.map(it=>({it,left:it.opening_qty+mv.filter(m=>m.item_id===it.id).reduce((s,m)=>s+(m.move_type==='add'?m.qty:-m.qty),0)}))
        .filter(x=>x.left<=thr).map(x=>`${x.it.name}: ${x.left} ${x.it.unit} left`);
      return {rows,thr,src:'stationery_items, stationery_moves'};
    },
    async overdueCash(){
      if(!live())return {rows:overdueAdv().map(a=>`${byId(a.uid).name}: ${NAD(a.amount)} taken ${a.date}`),src:'cash'};
      const cut=new Date(today());cut.setDate(cut.getDate()-1);
      const r=await sel('cash_advances','user_id,amount,taken_on,status',q=>q.eq('status','Open').lt('taken_on',iso(cut)));const nm=await nameMap();
      return {rows:r.map(a=>`${nm[a.user_id]||'Unknown'}: ${money(a.amount)} taken ${a.taken_on}`),src:'cash_advances'};
    },
    async petty(){
      if(!live()){const m=M(),s=m.sheet.reduce((t,l)=>t+l.amt,0),r=m.receipts.filter(x=>x.amt>0).reduce((t,x)=>t+x.amt,0);
        return {month:monthLabel(state.month),sheet:s,receipts:r,locked:m.locked,lines:m.sheet.length,count:m.receipts.length,src:'petty cash'}}
      const pm=await sel('petty_months','id,month,locked',q=>q.eq('month',monthStart()));
      if(!pm[0])return {none:true,src:'petty_months'};
      const sh=await sel('petty_sheet_lines','amount',q=>q.eq('month_id',pm[0].id)),rc=await sel('petty_receipts','amount',q=>q.eq('month_id',pm[0].id));
      return {month:pm[0].month,sheet:sh.reduce((t,x)=>t+ +x.amount,0),receipts:rc.reduce((t,x)=>t+ +x.amount,0),locked:pm[0].locked,lines:sh.length,count:rc.length,src:'petty_months, petty_sheet_lines, petty_receipts'};
    },
    async people(){
      if(!live())return {rows:staff().map(u=>`${u.name}, ${u.title}`),src:'employees'};
      const r=await sel('profiles','name,title,role,access_enabled',q=>q.order('name'));
      return {rows:r.filter(p=>p.access_enabled).map(p=>`${p.name}, ${p.title||(p.role==='admin'?'Administrator':'Employee')}`),disabled:r.filter(p=>!p.access_enabled).length,src:'profiles'};
    },
    async kyc(){
      if(!live())return {n:kPend(),src:'kyc'};
      return {n:(await sel('form_submissions','id',q=>q.eq('status','Pending'))).length,src:'form_submissions'};
    }
  };

  /* ---------- How-to answers (static) ---------- */
  const HOW=[
    [/add.*(employee|staff|user|person)|new (employee|user)|invite/,'**Add an employee** (admins): open **Employees**, fill in the form, and click **Add employee**. A temporary password is shown once. Share it privately; they must change it at first sign-in.'],
    [/(change|update|new).*password/,'**Change your password**: ask your administrator to reset it. They will give you a temporary password, and you choose your own at your next sign-in.'],
    [/reset.*password|forgot.*password|locked out/,'**Reset a password** (admins): open **Employees** and click **Reset password** next to the person. Send them the new temporary password privately.'],
    [/(disable|remove|block|deactivate).*(user|employee|access|account|staff)/,'**Switch off access** (admins): open **Employees** and click **Disable**. They are signed out and cannot sign in. Use **Enable** to restore.'],
    [/finali[sz]e.*payroll|run payroll|close payroll|payroll.*finali/,'**Finalise payroll** (admins): approve every pending timesheet first, then open **Payroll**, choose how to sign, and click **Finalise run**. A finalised run is locked.'],
    [/(request|apply|take|book).*leave|leave.*(request|apply)/,'**Request leave**: open **Leave**, choose the type and dates, add a reason and a person to cover, then submit. Your administrator approves it.'],
    [/(request|apply|ask).*(loan|advance)|salary advance/,'**Request a salary advance**: open **Loans**, enter the amount and the number of months, then submit for approval.'],
    [/(log|enter|submit|fill).*(time|hours|timesheet)|timesheet.*(submit|how)/,'**Timesheet**: open **Timesheet**, add your hours per day and client, then submit the week for approval.'],
    [/(lock|close).*(petty|month)|petty.*lock/,'**Lock petty cash** (admins): open **Reconcile**, check the results, then click **Lock** for the month. Unlocking is logged.'],
    [/(take|get|collect).*(stationery|pen|paper|stock)|stationery.*(take|how)/,'**Take stationery**: open **Stationery**, choose the item and quantity, and confirm. It is recorded under your name.'],
    [/sign.?out|log.?out/,'**Sign out**: use the **Sign out** button in the menu.'],
    [/install|app|download/,'**Install the app**: use your browser\'s **Install** or **Add to home screen** option on the Virtuoso System page.']
  ];

  /* ---------- Intents ---------- */
  const has=(t,...w)=>w.some(x=>t.includes(x));
  const INTENTS=[
    {id:'tax',test:t=>/\b(paye|ssc|social security|income tax|tax rate|nampower)\b/.test(t)||(has(t,'tax')&&has(t,'rate','bracket','threshold','how much')),
      run:async()=>'I do not have verified, effective-dated Namibian tax or statutory rates loaded, so I will not quote any. Payroll here is **non-tax**. Please confirm PAYE and SSC rules with the Namibian Revenue Agency or a qualified adviser.'},
    {id:'help',test:t=>/^(hi|hello|hey|help|good (morning|afternoon|evening)|what can you (do|help)|how can you help|menu|options)\b/.test(t),
      run:async()=>'I can look things up and explain how to do things. Try:\n'+hintsFor().map(h=>'- '+h).join('\n')+'\n\nI am a simple built-in assistant: I recognise common questions, so rephrase if I miss one. I never change records.'},
    {id:'who',test:t=>/who am i|my (role|account|name)|am i (an )?admin/.test(t),
      run:async()=>`You are signed in as **${state.user.name}** (${state.user.type==='admin'?'Administrator':'Employee'}).`},
    {id:'payroll',admin:true,test:t=>has(t,'payroll')&&has(t,'block','ready','finali','pending','stuck','waiting','status','this month','outstanding')&&!/how (do|can|to)/.test(t),
      run:async()=>{const p=await Q.payrollState(),o=[];
        if(p.finalised)return 'This month\'s payroll is **finalised and locked**. Late approvals will need a correction in the next run.';
        if(live()&&!p.hasRun)o.push('No payroll run exists yet for this month.');
        if(p.pending.length)o.push(`**${p.pending.length} timesheet${p.pending.length>1?'s still need':' still needs'}** approval before you can finalise:\n`+list(p.pending));
        else o.push('No timesheets are waiting, so nothing is blocking the run.');
        return o.join('\n\n')+'\n\nOpen **Approvals** to clear timesheets, then **Payroll** to finalise.'}},
    {id:'pending',admin:true,test:t=>has(t,'timesheet','hours')&&has(t,'unapproved','pending','waiting','approve','who has','outstanding','missing'),
      run:async()=>{const p=await Q.pendingTimesheets();return p.rows.length?`**${p.rows.length}** with timesheets waiting for approval:\n`+list(p.rows)+'\n\nApprove them in **Approvals**.':'No timesheets are waiting for approval.'}},
    {id:'leave',test:t=>has(t,'leave')&&has(t,'balance','left','remaining','how much','how many','days','entitle')&&!/request|apply|book/.test(t),
      run:async()=>{const b=await Q.leaveBalance();return b.rows.length?'Your leave balance:\n'+list(b.rows.map(([t,d])=>`${t}: **${d}** day${d===1?'':'s'}`)):'No leave balances are recorded for you yet. Ask your administrator to set them up.'}},
    {id:'requests',test:t=>/my (request|leave|loan|advance)|status of my|my approvals|were my/.test(t)||(has(t,'status')&&has(t,'request')),
      run:async()=>{const r=await Q.myRequests(),o=[];
        if(r.leave.length)o.push('**Leave**\n'+list(r.leave));if(r.loans.length)o.push('**Loans and advances**\n'+list(r.loans));
        return o.length?o.join('\n\n'):'You have no leave or loan requests on record.'}},
    {id:'hours',test:t=>has(t,'hours','timesheet','logged','worked')&&!has(t,'unapproved','pending','who has')&&!/how (do|can|to)/.test(t),
      run:async()=>{const h=await Q.hoursThisWeek();return h.rows.length?`This week (${h.a} to ${h.b}) you have logged **${h.total} hours**:\n`+list(h.rows):`You have not logged any hours for the week of ${h.a}.`}},
    {id:'stock',test:t=>has(t,'stock','stationery','running low','reorder','supplies','low on'),
      run:async()=>{const s=await Q.lowStock();return s.rows.length?`Items at or below ${s.thr} left:\n`+list(s.rows)+'\n\nTime to reorder.':`Nothing is at or below the low-stock level of ${s.thr}.`+(live()?' (Based on recorded additions and takes.)':'')}},
    {id:'cash',admin:true,test:t=>(has(t,'cash','advance')&&has(t,'overdue','outstanding','change','taken','returned','unsettled'))||/overdue/.test(t),
      run:async()=>{const c=await Q.overdueCash();return c.rows.length?`**${c.rows.length}** cash advance${c.rows.length>1?'s are':' is'} overdue (change not reported):\n`+list(c.rows):'No cash advances are overdue.'}},
    {id:'petty',admin:true,test:t=>has(t,'petty','reconcil','receipts','cash sheet'),
      run:async()=>{const p=await Q.petty();if(p.none)return 'No petty cash month has been set up for this month yet.';
        const d=Math.round((p.sheet-p.receipts)*100)/100;
        return `**${p.month}** petty cash:\n`+list([`Cash sheet: ${money(p.sheet)} (${p.lines} lines)`,`Receipts: ${money(p.receipts)} (${p.count})`,`Difference: **${money(d)}**${d===0?', matches':''}`,`Status: ${p.locked?'locked':'open'}`])+(d!==0?'\n\nOpen **Reconcile** to match lines to receipts.':'')}},
    {id:'people',admin:true,test:t=>/(how many|list|who|show).*(employee|staff|people|team|user)/.test(t)||/headcount/.test(t),
      run:async()=>{const p=await Q.people();return `**${p.rows.length}** active ${p.rows.length===1?'person':'people'}:\n`+list(p.rows,15)+(p.disabled?`\n\n${p.disabled} account${p.disabled>1?'s are':' is'} disabled.`:'')}},
    {id:'kyc',admin:true,test:t=>has(t,'kyc','onboarding','client form'),
      run:async()=>{const k=await Q.kyc();return k.n?`**${k.n}** KYC submission${k.n>1?'s are':' is'} waiting for review. Open **Client KYC** to review them.`:'No KYC submissions are waiting for review.'}},
    {id:'summary',admin:true,test:t=>/(what|anything).*(needs|attention|wrong|urgent|today)|summary|overview|any(thing)? (alerts|issues)/.test(t),
      run:async()=>{const [pt,ls,oc,k]=await Promise.all([Q.pendingTimesheets(),Q.lowStock(),Q.overdueCash(),Q.kyc()]),o=[];
        if(pt.rows.length)o.push(`${pt.rows.length} timesheet group(s) awaiting approval`);if(ls.rows.length)o.push(`${ls.rows.length} stationery item(s) low`);
        if(oc.rows.length)o.push(`${oc.rows.length} overdue cash advance(s)`);if(k.n)o.push(`${k.n} KYC submission(s) to review`);
        return o.length?'Needs attention:\n'+list(o):'All clear: no pending timesheets, low stock, overdue cash or KYC reviews.'}}
  ];

  function hintsFor(){return isAdmin()
    ?['What needs attention today?','What is blocking payroll this month?','Who has unapproved timesheets?','Any overdue cash advances?','What stationery is running low?','Summarise petty cash','How do I add an employee?']
    :['How much leave do I have left?','What is the status of my requests?','How many hours have I logged this week?','What stationery is running low?','How do I request leave?']}

  async function answer(raw){
    const t=raw.toLowerCase().replace(/[?!.,]+/g,' ').replace(/\s+/g,' ').trim();
    if(!t)return {reply:'Ask me something, for example: '+hintsFor()[0],looked_at:[]};
    if(/how (do|can|to|should)|where (do|can)|steps to|guide/.test(t)){
      for(const [re,txt] of HOW)if(re.test(t))return {reply:txt,looked_at:[]};
    }
    for(const i of INTENTS){
      if(!i.test(t,raw))continue;
      if(i.admin&&!isAdmin())return {reply:adminOnly,looked_at:[]};
      try{const reply=await i.run(raw,t);return {reply,looked_at:[]}}catch(e){return {reply:e.message||'I could not look that up.',looked_at:[]}}
    }
    if(/how (do|can|to|should)|where (do|can)|steps|guide/.test(t)||t.startsWith('how ')){
      for(const [re,txt] of HOW)if(re.test(t))return {reply:txt,looked_at:[]};
    }
    for(const [re,txt] of HOW)if(re.test(t))return {reply:txt,looked_at:[]};
    return {reply:'I did not catch that. I am a simple built-in assistant, so try one of these:\n'+hintsFor().map(h=>'- '+h).join('\n'),looked_at:[]};
  }
  const EXTRA_HINTS=[],EXTRA_ALL=[];
  window.VIRTUOSO_ENGINE={answer,hints:()=>hintsFor().concat(isAdmin()?EXTRA_HINTS:[]).concat(EXTRA_ALL),
    addIntent:i=>INTENTS.unshift(i),addHints:h=>EXTRA_HINTS.push(...h),addHintsAll:h=>EXTRA_ALL.push(...h),today:()=>today(),isAdmin};
})();
