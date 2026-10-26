/* AI TOOLS page: handy writing, summarising and chart tools. They are rule-based (templates and simple text analysis),
   so they work offline, need no AI service or key, and never send your text anywhere. Review everything before use:
   the wording is a starting point. Reached from the menu, from Bruno's "+" button, or from Bruno's replies. */
(function(){
  const COMPANY='Virtuous Accounting Solutions CC';
  const hasEngine=()=>!!window.VIRTUOSO_ENGINE;
  const isAdm=()=>state.user&&state.user.type==='admin';
  const md=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^[-*] (.+)$/gm,'&bull; $1').replace(/\n/g,'<br>');
  const bear=(px,m)=>window.VIRTUOSO_BEAR?window.VIRTUOSO_BEAR.svg(px,{mood:m}):'';
  const cap=s=>String(s||'').trim().replace(/^./,c=>c.toUpperCase());
  const first=n=>String(n||'').trim().split(/\s+/)[0]||'there';
  const todayLong=()=>new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  const nad=n=>'N$ '+(+n||0).toLocaleString('en-NA',{minimumFractionDigits:2,maximumFractionDigits:2});
  const lines=t=>String(t||'').split(/\n|;/).map(s=>s.trim()).filter(Boolean);
  const bullets=a=>a.map(x=>'- '+cap(x.replace(/[.]+$/,''))+'.').join('\n');
  const me=()=>(state.user&&state.user.name)||'';
  const sign=n=>`${n||'[Your name]'}\n${COMPANY}\nWindhoek, Namibia`;

  /* ---------- generators ---------- */
  const G={};
  G.email=v=>{
    const formal=v.tone!=='friendly',to=(v.to||'').trim()||'[Recipient]',from=(v.from||me()).trim(),pts=lines(v.points),when=(v.when||'').trim();
    const K={
      intro:{sub:'Introduction from '+COMPANY,open:formal?'I hope this message finds you well. I am writing to introduce myself and '+COMPANY+'.':'I hope you are doing well! I wanted to reach out and introduce myself and '+COMPANY+'.',close:formal?'I would welcome the opportunity to speak with you. Please let me know a convenient time.':'I would love to chat when it suits you. Just let me know a good time.'},
      followup:{sub:'Following up',open:formal?'I am writing to follow up on our recent conversation.':'Just following up on our recent chat.',close:formal?'Please let me know if you need anything further from us.':'Let me know if there is anything I can help with.'},
      meeting:{sub:'Meeting request',open:formal?'I would like to arrange a meeting to discuss the matters below.':'I would love to set up a quick meeting to talk things through.',close:when?`I propose ${when}. Please let me know if that works for you or suggest another time.`:'Please let me know a time that suits you and I will send an invitation.'},
      info:{sub:'Request for information',open:formal?'I am writing to request some information.':'I hope you are well. Could you please help me with some information?',close:`I would be grateful if you could send this ${when?'by '+when:'at your earliest convenience'}.`},
      thanks:{sub:'Thank you',open:formal?'Thank you for your time and support.':'Thank you so much for your time and support!',close:formal?'We look forward to working with you again.':'We look forward to working with you again soon.'},
      quote:{sub:'Our proposal',open:formal?'Thank you for your enquiry. Please find our proposal below.':'Thanks for getting in touch! Here is our proposal.',close:'Please let me know if you would like to proceed or if you have any questions.'},
      response:{sub:'Response to your message',open:formal?'Thank you for bringing this to our attention.':'Thank you for letting us know.',close:'We value your feedback and will keep you updated on our progress.'}
    };
    const k=K[v.kind]||K.intro,sub=(v.subject||'').trim()||k.sub;
    return `Subject: ${sub}\n\n${formal?'Dear '+to+',':'Hi '+first(to)+','}\n\n${k.open}${pts.length?'\n\nKey points:\n'+bullets(pts):''}\n\n${k.close}\n\n${formal?'Kind regards,':'Warm regards,'}\n${sign(from)}`;
  };
  G.cold=v=>{
    const to=(v.to||'').trim()||'[Name]',co=(v.company||'your company').trim(),offer=(v.offer||'[what you offer]').trim(),ben=(v.benefit||'[the main benefit]').trim(),from=(v.from||me()).trim();
    const cta={call:'a 15-minute call this week',reply:'a quick reply to let me know if this is relevant',proposal:'me sending over a short proposal'}[v.cta]||'a short call';
    return `Subject options:\n1. ${cap(ben)} for ${co}\n2. Quick question, ${first(to)}\n3. An idea for ${co}\n\n---\n\nHi ${first(to)},\n\nI'm ${from||'[Your name]'} at ${COMPANY}. We help businesses like ${co} with ${offer}, so that ${ben.replace(/^so that /,'')}.\n\nWould you be open to ${cta}?\n\nThanks,\n${sign(from)}\n\nP.S. If now is not the right time, just tell me and I will not follow up again.`;
  };
  G.apology=v=>{
    const formal=v.tone!=='personal',to=(v.to||'').trim()||'[Recipient]',from=(v.from||me()).trim();
    const what=(v.what||'[what happened]').trim().replace(/[.]+$/,''),impact=(v.impact||'').trim().replace(/[.]+$/,''),fix=(v.fix||'').trim().replace(/[.]+$/,''),prevent=(v.prevent||'').trim().replace(/[.]+$/,'');
    return `${todayLong()}\n\n${formal?'Dear '+to+',':'Hi '+first(to)+','}\n\n${formal?'I am writing to sincerely apologise for':'I want to say how sorry I am about'} ${what.replace(/^(for|about)\s+/i,'')}.\n\n${impact?`I understand that this ${/\b(caused|led|resulted)\b/i.test(impact)?'':'caused '}${impact}, and I take full responsibility.`:'I take full responsibility for this and understand how frustrating it was.'}${fix?`\n\nTo put this right, ${fix}.`:''}${prevent?`\n\nTo make sure it does not happen again, ${prevent}.`:''}\n\n${formal?'Once again, please accept my sincere apologies. Thank you for your patience and understanding.':'Thank you for bearing with us. I really appreciate it.'}\n\n${formal?'Yours sincerely,':'Warm regards,'}\n${sign(from)}`;
  };
  G.reminder=v=>{
    const to=(v.to||'').trim()||'[Client]',inv=(v.inv||'').trim()||'[invoice number]',amt=parseFloat(v.amount),due=(v.due||'').trim()||'[due date]',from=(v.from||me()).trim(),bank=(v.bank||'').trim();
    const t=v.tone||'gentle',amount=isNaN(amt)?'[amount]':nad(amt);
    const subj={gentle:`Friendly reminder: invoice ${inv}`,firm:`Overdue: invoice ${inv}`,final:`Final notice: invoice ${inv}`}[t];
    const body={gentle:`I hope you are well. This is a friendly reminder that invoice ${inv} for ${amount}, due on ${due}, is still showing as unpaid on our records.\n\nIf you have already made payment, thank you, and please disregard this message. If not, we would appreciate payment at your earliest convenience.`,
      firm:`Our records show that invoice ${inv} for ${amount}, which was due on ${due}, remains unpaid.\n\nPlease arrange payment within 7 days, or let us know the expected payment date. If you have already paid, please send us the proof of payment so we can update our records.`,
      final:`This is a final notice regarding invoice ${inv} for ${amount}, which was due on ${due} and remains unpaid despite our earlier reminders.\n\nPlease settle this account within 7 days, or contact me immediately to discuss. If payment is not received or arranged, we will have to consider further steps.`}[t];
    return `Subject: ${subj}\n\nDear ${to},\n\n${body}${bank?`\n\nPayment details:\n${bank}`:''}\n\nThank you,\n${sign(from)}`;
  };
  G.contract=v=>{
    const type=v.type||'service',A=(v.a||COMPANY).trim(),B=(v.b||'[Other party name]').trim(),subj=(v.subject||'[describe the services or purpose]').trim(),fee=(v.fee||'[fee and payment terms]').trim(),
      start=(v.start||'[start date]').trim(),term=(v.term||'[term or end date]').trim(),notice=(v.notice||'30 days').trim(),law=(v.law||'the Republic of Namibia').trim();
    const head=`TEMPLATE ONLY. This is a starting draft, not legal advice. Have a lawyer review and adapt it before anyone signs.\n\n`;
    const parties=`This agreement is made on ${todayLong()} between:\n(1) ${A} ("the Provider"); and\n(2) ${B} ("the Client").`;
    const sig=`\nSIGNED by the parties:\n\nFor ${A}:\nName: ____________________   Signature: ____________________   Date: ____________\n\nFor ${B}:\nName: ____________________   Signature: ____________________   Date: ____________`;
    if(type==='nda')return head+`CONFIDENTIALITY AGREEMENT\n\n${parties.replace('"the Provider"','"the Disclosing Party"').replace('"the Client"','"the Receiving Party"')}\n\n1. Purpose. The parties wish to share confidential information for the purpose of: ${subj}.\n2. Confidential information. This means any non-public information shared by the Disclosing Party, in any form, that is marked confidential or would reasonably be understood to be confidential.\n3. Obligations. The Receiving Party will keep the information confidential, use it only for the purpose above, and share it only with people who need it and are bound to keep it confidential.\n4. Exceptions. These obligations do not apply to information that is public through no fault of the Receiving Party, was already known to it, or must be disclosed by law (in which case the Disclosing Party will be told where lawful).\n5. Return. On request, the Receiving Party will return or destroy the confidential information.\n6. Duration. These obligations start on ${start} and continue for ${term}.\n7. Governing law. This agreement is governed by the laws of ${law}.\n8. Whole agreement. This is the whole agreement on this subject and can only be changed in writing signed by both parties.\n${sig}`;
    if(type==='consulting')return head+`CONSULTING AGREEMENT\n\n${parties.replace('"the Provider"','"the Consultant"').replace('"the Client"','"the Client"')}\n\n1. Services. The Consultant will provide the following services: ${subj}.\n2. Independent consultant. The Consultant works as an independent contractor and not as an employee of the Client.\n3. Fees. The Client will pay: ${fee}. Amounts are in Namibian dollars unless stated otherwise.\n4. Term. This agreement starts on ${start} and continues for ${term}, unless ended earlier under clause 8.\n5. Expenses. Only expenses approved in advance in writing will be reimbursed.\n6. Confidentiality. Each party will keep the other's confidential information private and use it only for this engagement.\n7. Ownership of work. Unless agreed otherwise in writing, [state who owns the deliverables once they are paid for].\n8. Ending the agreement. Either party may end this agreement by giving ${notice} written notice. Fees for work done up to that date remain payable.\n9. Liability. [Agree a limit on liability with your lawyer.]\n10. Governing law. This agreement is governed by the laws of ${law}.\n${sig}`;
    return head+`SERVICE AGREEMENT\n\n${parties}\n\n1. Services. The Provider will provide the following services: ${subj}.\n2. Fees and payment. The Client will pay: ${fee}. Invoices are payable within [number] days of the invoice date. Amounts are in Namibian dollars unless stated otherwise.\n3. Term. This agreement starts on ${start} and continues for ${term}, unless ended earlier under clause 8.\n4. Client responsibilities. The Client will provide accurate information and documents on time. Delays may affect delivery dates and fees.\n5. Confidentiality. Each party will keep the other's confidential information private and use it only for this engagement.\n6. Records and data. Each party will handle personal information lawfully and only for the purposes of this agreement.\n7. Changes. Any change to the services or fees must be agreed in writing by both parties.\n8. Ending the agreement. Either party may end this agreement by giving ${notice} written notice. Fees for work done up to that date remain payable.\n9. Liability. [Agree a limit on liability with your lawyer.]\n10. Governing law. This agreement is governed by the laws of ${law}.\n${sig}`;
  };

  /* extractive summary: scores sentences by the frequency of their meaningful words */
  const STOP=new Set('the and for are was were has have had not but can its our out all any may per use used using this that with from they them their there then than into over such been being also will would should could about which while when what your you we he she it is in on at to of a an as by be or if so no do does did more most other some these those very just only'.split(' '));
  function summarize(text,count){
    const clean=String(text||'').replace(/\s+/g,' ').trim();
    const sents=clean.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/).map(s=>s.trim()).filter(s=>s.split(' ').length>=5);
    if(sents.length<=count)return {sentences:sents,keywords:keywords(clean,6),words:clean.split(' ').length};
    const freq={};clean.toLowerCase().match(/[a-z][a-z'-]+/g).forEach(w=>{if(!STOP.has(w)&&w.length>2)freq[w]=(freq[w]||0)+1});
    const mx=Math.max(...Object.values(freq),1);
    const score=sents.map((s,i)=>{const ws=s.toLowerCase().match(/[a-z][a-z'-]+/g)||[];let t=0;ws.forEach(w=>{if(freq[w])t+=freq[w]/mx});return {i,s,sc:(t/Math.pow(ws.length||1,0.6))*(i===0?1.25:i<3?1.1:1)}});
    const pick=score.sort((a,b)=>b.sc-a.sc).slice(0,count).sort((a,b)=>a.i-b.i).map(x=>x.s);
    return {sentences:pick,keywords:keywords(clean,6),words:clean.split(' ').length};
  }
  function keywords(t,n){const f={};(t.toLowerCase().match(/[a-z][a-z'-]+/g)||[]).forEach(w=>{if(!STOP.has(w)&&w.length>3)f[w]=(f[w]||0)+1});return Object.entries(f).sort((a,b)=>b[1]-a[1]).slice(0,n).map(x=>x[0])}

  /* business names */
  const PRE={professional:['Prime','Apex','Sterling','Summit','Meridian','Keystone','Pinnacle','Anchor','Vertex','Cornerstone','Landmark','Beacon'],modern:['Nova','Flux','Zen','Loop','Pulse','Orbit','Hive','Spark','Atlas','Lumen','Kite','Echo'],friendly:['Bright','Sunny','Trusty','Kind','Bloom','Cheery','Good','Cosy','Happy','Honest','Warm','Bear']};
  const SUF={Accounting:['Accounting','Advisory','Ledger','Books','Partners','Financial'],Consulting:['Consulting','Advisors','Partners','Group','Solutions'],Retail:['Trading','Stores','Market','Supplies','Retail'],Tech:['Labs','Systems','Tech','Digital','Works'],Food:['Kitchen','Foods','Eats','Table','Catering'],Construction:['Builders','Construction','Projects','Contracting','Works'],Education:['Academy','Learning','Institute','Tutors','College'],Health:['Care','Health','Wellness','Clinic','Medical'],Other:['Group','Solutions','Services','Enterprises','Co']};
  const END=['ly','ify','ora','ix','wise','hub','ful','io'];
  function rng(seed){let s=0;for(const c of seed)s=(s*31+c.charCodeAt(0))>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
  function names(v,shuffle){
    const kws=String(v.kw||'').split(/[,\n]/).map(s=>s.trim()).filter(Boolean).map(cap).slice(0,4),loc=cap(v.loc||''),count=+v.count||12;
    const r=rng((v.kw||'')+(v.industry||'')+(v.style||'')+shuffle),pick=a=>a[Math.floor(r()*a.length)];
    const out=new Set(),k=kws.length?kws:['Prime'],suf=SUF[v.industry]||SUF.Other,pre=PRE[v.style]||PRE.professional;
    let guard=0;
    while(out.size<count&&guard++<400){
      const kw=pick(k),m=Math.floor(r()*6),sf=(()=>{const c=suf.filter(x=>x.toLowerCase()!==kw.toLowerCase());return c.length?pick(c):pick(suf)})();let n;
      if(m===0)n=`${pick(pre)} ${kw} ${sf}`;else if(m===1)n=`${kw} ${sf}`;else if(m===2)n=`${pick(pre)}${kw.toLowerCase()}`.replace(/^./,c=>c.toUpperCase());
      else if(m===3){const stem=kw.replace(/[aeiou]+$/i,'');n=cap(stem+pick(END))}else if(m===4)n=`${kw} & ${pick(['Co','Partners','Associates','Sons','Daughters'])}`;else n=`${pick(pre)} ${sf}`;
      if(loc&&r()<0.35)n+=' '+loc;
      out.add(n);
    }
    return [...out];
  }

  /* ---------- charts ---------- */
  const PAL=['#0b3fb5','#e6b422','#1f8a4c','#d6336c','#7a3fb5','#e8710a','#0b7aa8','#8a5a2b'];
  const num=s=>parseFloat(String(s).replace(/[\s,]/g,''));
  function parseData(text){
    const rows=[];
    String(text||'').split(/\r?\n/).forEach(line=>{
      line=line.trim();if(!line)return;
      let m=line.match(/^(.*?)\s*[,;:\t]\s*(-?(?:\d{1,3}(?:[ ,]\d{3})+|\d+)(?:\.\d+)?)\s*%?$/)||line.match(/^(.*\S)\s+(-?\d+(?:\.\d+)?)\s*%?$/);
      if(m){const v=num(m[2]);if(!isNaN(v)&&m[1].trim())rows.push({label:m[1].trim().slice(0,60),value:v})}
    });
    return rows.slice(0,60);
  }
  const fmtN=n=>Math.abs(n)>=1000?n.toLocaleString('en-NA',{maximumFractionDigits:1}):String(Math.round(n*100)/100);
  const trunc=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;
  function niceMax(v){if(v<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(v))),f=v/p;return (f<=1?1:f<=2?2:f<=5?5:10)*p}
  function chartSVG(type,title,rows){
    const W=640,H=380,f='font-family="system-ui,Segoe UI,Arial,sans-serif"',vals=rows.map(r=>r.value),total=rows.reduce((s,r)=>s+Math.max(r.value,0),0);
    const desc=rows.map(r=>r.label+': '+fmtN(r.value)).join('; ');
    const head=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-labelledby="ct cd" ${f}><title id="ct">${esc(title||'Chart')}</title><desc id="cd">${esc(desc)}</desc><rect width="${W}" height="${H}" fill="#ffffff"/>${title?`<text x="${W/2}" y="26" text-anchor="middle" font-size="17" font-weight="700" fill="#14202a">${esc(trunc(title,70))}</text>`:''}`;
    if(type==='pie'||type==='donut'){
      const pos=rows.filter(r=>r.value>0);if(!pos.length)return head+`<text x="${W/2}" y="${H/2}" text-anchor="middle" fill="#555">Pie charts need positive values.</text></svg>`;
      const cx=200,cy=205,R=130,r0=type==='donut'?70:0;let a=-Math.PI/2,out='';
      pos.forEach((r,i)=>{const frac=r.value/total,b=a+frac*Math.PI*2,big=frac>0.5?1:0;
        const p=(ang,rad)=>[cx+Math.cos(ang)*rad,cy+Math.sin(ang)*rad];
        let d;if(frac>=0.9999){d=`M${cx+R} ${cy}A${R} ${R} 0 1 1 ${cx-R} ${cy}A${R} ${R} 0 1 1 ${cx+R} ${cy}`+(r0?`M${cx+r0} ${cy}A${r0} ${r0} 0 1 0 ${cx-r0} ${cy}A${r0} ${r0} 0 1 0 ${cx+r0} ${cy}`:'')}
        else{const [x1,y1]=p(a,R),[x2,y2]=p(b,R);d=r0?(()=>{const [x3,y3]=p(b,r0),[x4,y4]=p(a,r0);return `M${x1} ${y1}A${R} ${R} 0 ${big} 1 ${x2} ${y2}L${x3} ${y3}A${r0} ${r0} 0 ${big} 0 ${x4} ${y4}Z`})():`M${cx} ${cy}L${x1} ${y1}A${R} ${R} 0 ${big} 1 ${x2} ${y2}Z`}
        out+=`<path d="${d}" fill="${PAL[i%PAL.length]}" fill-rule="evenodd" stroke="#fff" stroke-width="2"/>`;a=b});
      const legend=pos.slice(0,12).map((r,i)=>`<g transform="translate(360 ${62+i*24})"><rect width="14" height="14" rx="3" fill="${PAL[i%PAL.length]}"/><text x="22" y="12" font-size="13" fill="#14202a">${esc(trunc(r.label,22))} (${Math.round(r.value/total*100)}%)</text></g>`).join('');
      return head+out+legend+'</svg>';
    }
    const mx=niceMax(Math.max(...vals,0)),mn=Math.min(...vals,0)<0?-niceMax(-Math.min(...vals)):0,span=mx-mn;
    if(type==='hbar'){
      const L=150,T=title?44:20,Rr=40,B=36,pw=W-L-Rr,ph=H-T-B,bh=Math.min(34,ph/rows.length*0.7),x0=L+(0-mn)/span*pw;let out='';
      for(let i=0;i<=4;i++){const v=mn+span*i/4,x=L+pw*i/4;out+=`<line x1="${x}" y1="${T}" x2="${x}" y2="${T+ph}" stroke="#e3e8f0"/><text x="${x}" y="${T+ph+16}" text-anchor="middle" font-size="11" fill="#555">${fmtN(v)}</text>`}
      rows.forEach((r,i)=>{const y=T+ph/rows.length*(i+0.5)-bh/2,x=L+(Math.min(r.value,0)-mn)/span*pw,w=Math.abs(r.value)/span*pw;
        out+=`<rect x="${x}" y="${y}" width="${Math.max(w,1)}" height="${bh}" rx="3" fill="${PAL[i%PAL.length]}"/><text x="${L-8}" y="${y+bh/2+4}" text-anchor="end" font-size="12" fill="#14202a">${esc(trunc(r.label,20))}</text><text x="${x+w+6}" y="${y+bh/2+4}" font-size="11" fill="#14202a">${fmtN(r.value)}</text>`});
      return head+out+`<line x1="${x0}" y1="${T}" x2="${x0}" y2="${T+ph}" stroke="#14202a"/></svg>`;
    }
    const L=62,T=title?48:22,Rr=20,B=rows.length>6?84:56,pw=W-L-Rr,ph=H-T-B,n=rows.length,yAt=v=>T+ph-(v-mn)/span*ph,slot=pw/n;let out='';
    for(let i=0;i<=4;i++){const v=mn+span*i/4,y=yAt(v);out+=`<line x1="${L}" y1="${y}" x2="${W-Rr}" y2="${y}" stroke="#e3e8f0"/><text x="${L-8}" y="${y+4}" text-anchor="end" font-size="11" fill="#555">${fmtN(v)}</text>`}
    const rot=n>6;
    rows.forEach((r,i)=>{const cx=L+slot*(i+0.5),lab=`<text x="${cx}" y="${T+ph+16}" ${rot?`transform="rotate(-35 ${cx} ${T+ph+16})" text-anchor="end"`:'text-anchor="middle"'} font-size="11" fill="#14202a">${esc(trunc(r.label,rot?16:12))}</text>`;out+=lab});
    if(type==='line'){
      const pts=rows.map((r,i)=>[L+slot*(i+0.5),yAt(r.value)]);
      out+=`<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${PAL[0]}" stroke-width="3" stroke-linejoin="round"/>`+pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="${PAL[0]}" stroke="#fff" stroke-width="2"/><text x="${p[0]}" y="${p[1]-10}" text-anchor="middle" font-size="11" fill="#14202a">${fmtN(rows[i].value)}</text>`).join('');
    }else{
      const bw=Math.min(56,slot*0.62),y0=yAt(0);
      rows.forEach((r,i)=>{const cx=L+slot*(i+0.5),y=yAt(Math.max(r.value,0)),h=Math.abs(yAt(r.value)-y0);out+=`<rect x="${cx-bw/2}" y="${r.value>=0?y:y0}" width="${bw}" height="${Math.max(h,1)}" rx="3" fill="${PAL[i%PAL.length]}"/><text x="${cx}" y="${(r.value>=0?y:y0+h)+(r.value>=0?-6:14)}" text-anchor="middle" font-size="11" fill="#14202a">${fmtN(r.value)}</text>`});
    }
    return head+out+`<line x1="${L}" y1="${yAt(0)}" x2="${W-Rr}" y2="${yAt(0)}" stroke="#14202a"/></svg>`;
  }

  /* ---------- tool registry ---------- */
  const SEL=(id,label,opts,def)=>({id,label,type:'select',opts,def});
  const TX=(id,label,ph,def)=>({id,label,type:'text',ph,def});
  const TA=(id,label,ph,rows)=>({id,label,type:'textarea',ph,rows:rows||4});
  const TOOLS=[
    {key:'form',name:'AI Form Builder',group:'Builders',color:'#e8710a',icon:'▤',admin:true,desc:'Describe a form in a sentence and Bruno builds it. You can then fine-tune it in the Form builder.',special:'form'},
    {key:'data',name:'AI Data Assistant',group:'Builders',color:'#1f8a4c',icon:'▦',desc:'Ask questions about your own data: approvals, leave, stock, cash, payroll status and more.',special:'data'},
    {key:'email',name:'Business Email Generator',group:'Writing',color:'#7a3fb5',icon:'✉',desc:'Draft a clear business email from a few key points.',inputs:[SEL('kind','Type of email',[['intro','Introduction'],['followup','Follow-up'],['meeting','Meeting request'],['info','Request for information'],['quote','Proposal or quote'],['thanks','Thank you'],['response','Response to a message']],'intro'),SEL('tone','Tone',[['formal','Formal'],['friendly','Friendly']],'formal'),TX('to','Recipient name','e.g. Ms Shikongo'),TX('from','Your name','',''),TX('subject','Subject (optional)','Leave blank for a suggested subject'),TX('when','Date, time or deadline (optional)','e.g. Tuesday at 10:00'),TA('points','Key points (one per line)','One point per line',4)],gen:G.email},
    {key:'cold',name:'Cold Email Generator',group:'Writing',color:'#d6336c',icon:'➤',desc:'A short, polite first-contact email with three subject lines.',inputs:[TX('to','Recipient name','e.g. Johannes'),TX('company','Their company','e.g. Kalahari Mining'),TX('offer','What you offer','e.g. monthly bookkeeping and VAT returns'),TX('benefit','Main benefit for them','e.g. you can stop worrying about deadlines'),SEL('cta','What do you want them to do?',[['call','Book a 15-minute call'],['reply','Reply if relevant'],['proposal','Let me send a proposal']],'call'),TX('from','Your name','','')],gen:G.cold},
    {key:'apology',name:'Apology Letter Generator',group:'Writing',color:'#c0392b',icon:'✎',desc:'A sincere apology that names the problem, takes responsibility, and says how you will fix it.',inputs:[SEL('tone','Style',[['formal','Formal letter'],['personal','Personal note']],'formal'),TX('to','Recipient','e.g. Mr Haufiku'),TX('from','Your name','','' ),TX('what','What happened','e.g. the delay in submitting your VAT return'),TX('impact','Effect on them (optional)','e.g. a late-filing worry'),TX('fix','How you will put it right (optional)','e.g. we have filed it today and will cover any penalty'),TX('prevent','How you will prevent a repeat (optional)','e.g. we now track all deadlines on a shared calendar')],gen:G.apology},
    {key:'reminder',name:'Payment Reminder Generator',group:'Writing',color:'#b8860b',icon:'N$',desc:'A polite or firm reminder for an unpaid invoice.',inputs:[SEL('tone','Tone',[['gentle','Gentle reminder'],['firm','Firm, overdue'],['final','Final notice']],'gentle'),TX('to','Client name','e.g. Benguela Fisheries'),TX('inv','Invoice number','e.g. INV-2041'),TX('amount','Amount (N$)','e.g. 12500'),TX('due','Due date','e.g. 15 October 2026'),TX('from','Your name','',''),TA('bank','Payment details (optional)','Bank, branch, account number and reference',3)],gen:G.reminder},
    {key:'contract',name:'Contract Generator',group:'Writing',color:'#0b7aa8',icon:'§',desc:'A plain-language contract skeleton to take to your lawyer. It is not legal advice.',inputs:[SEL('type','Type',[['service','Service agreement'],['consulting','Consulting agreement'],['nda','Confidentiality agreement']],'service'),TX('a','Your business',COMPANY,COMPANY),TX('b','Other party','Name of the client or other business'),TA('subject','Services or purpose','Describe the work or what is being protected',3),TX('fee','Fee and payment terms (not for NDA)','e.g. N$ 5,000 per month, invoiced monthly'),TX('start','Start date','e.g. 1 November 2026'),TX('term','Term','e.g. 12 months'),TX('notice','Notice period to end it','e.g. 30 days','30 days'),TX('law','Governing law','the Republic of Namibia','the Republic of Namibia')],gen:G.contract,note:'This is a template, not legal advice. Employment contracts have specific legal requirements and need a lawyer.'},
    {key:'summary',name:'Article Summarizer',group:'Summarise',color:'#0b7aa8',icon:'≣',desc:'Paste an article or notes and get the key sentences and main topics. It picks sentences from your text; it does not rewrite them.',special:'summary'},
    {key:'names',name:'Business Name Generator',group:'Utilities',color:'#7a3fb5',icon:'✦',desc:'Name ideas from your keywords. Always check that a name is free and not already registered before you use it.',special:'names'},
    {key:'chart',name:'Chart Maker',group:'Utilities',color:'#1f8a4c',icon:'◔',desc:'Turn a list of labels and numbers (or form answers) into a bar, line or pie chart you can download.',special:'chart'}
  ];
  const UNAVAILABLE=[['AI App Builder','Packaging forms into portals needs an AI model and a server.'],['AI Chatbot Builder','Chat agents need an AI model, outside accounts and a server.'],['AI Audio Summarizer','Turning audio into text needs a speech service that is not connected.']];
  const GROUPS=['Builders','Writing','Summarise','Utilities'];
  const tools=()=>TOOLS.filter(t=>!t.admin||isAdm());
  const byKey=k=>TOOLS.find(t=>t.key===k);

  const AIT={tool:null,menu:false,v:{},out:{},shuffle:0,chart:{type:'bar',title:'',data:'',src:'',form:'',q:'',svg:'',msg:''}};
  const val=(tk,id,def)=>{const o=AIT.v[tk]||{};return o[id]===undefined?(def===undefined?'':def):o[id]};

  /* ---------- page ---------- */
  function crumbs(t){
    const list=tools();
    return `<nav class="aitbar" aria-label="Breadcrumb"><button type="button" data-act="aitHome">Home</button><span aria-hidden="true">›</span><button type="button" data-act="aitList" ${t?'':'aria-current="page"'}>AI Tools</button>
      ${t?`<span aria-hidden="true">›</span><div class="aitdd"><button type="button" class="cur" data-act="aitMenu" aria-haspopup="listbox" aria-expanded="${AIT.menu}">${esc(t.name)} <span aria-hidden="true">${AIT.menu?'▴':'▾'}</span></button>
      ${AIT.menu?`<div class="aitmenu" role="listbox" aria-label="AI tools">${list.map(x=>`<button type="button" role="option" data-act="aitPick" data-k="${x.key}" aria-selected="${x.key===t.key}">${esc(x.name)}</button>`).join('')}</div>`:''}</div>`:''}</nav>`;
  }
  const outBox=(k,extra)=>AIT.out[k]?`<div class="aitout"><div class="row" style="justify-content:space-between;margin-bottom:8px"><b>Result</b><div class="row"><button type="button" class="btn sm" data-act="aitCopy" data-k="${k}">Copy</button><button type="button" class="btn ghost sm" data-act="aitTxt" data-k="${k}">Download .txt</button>${extra||''}</div></div><pre class="aitpre" id="aitOut-${k}">${esc(AIT.out[k])}</pre></div>`:'';
  function field(tk,x){
    const v=val(tk,x.id,x.def),id=`ait_${tk}_${x.id}`;
    if(x.type==='select')return `<label>${esc(x.label)}<select id="${id}" data-ait="${tk}|${x.id}">${x.opts.map(([k,l])=>`<option value="${esc(k)}" ${v===k?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
    if(x.type==='textarea')return `<label class="wide">${esc(x.label)}<textarea id="${id}" data-ait="${tk}|${x.id}" rows="${x.rows||4}" maxlength="3000" placeholder="${esc(x.ph||'')}">${esc(v)}</textarea></label>`;
    return `<label>${esc(x.label)}<input type="text" id="${id}" data-ait="${tk}|${x.id}" maxlength="300" value="${esc(v)}" placeholder="${esc(x.ph||'')}"></label>`;
  }
  function toolBody(t){
    const k=t.key;
    if(t.special==='form')return isAdm()?`<label class="wide">Describe your form<textarea data-ait="form|prompt" id="ait_form_prompt" rows="3" maxlength="1000" placeholder="e.g. Create a client onboarding form with name, email, phone, source of funds (Salary, Business, Savings) and a copy of ID">${esc(val('form','prompt'))}</textarea></label>
      <div class="row" style="flex-wrap:wrap;margin:8px 0">${['Create a client onboarding form with name, email, phone and a copy of ID','Create a staff survey called Office feedback with rating, what do you like, comments','Create a waiver form'].map(x=>`<button type="button" class="btn ghost sm" data-act="aitEx" data-k="form" data-id="prompt" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <button class="btn" type="button" data-act="aitForm">Build the form</button>${AIT.out.form?`<div class="aitout" role="status">${md(AIT.out.form)}</div>`:''}`
      :'<div class="fbnote">Building forms is for administrators. Ask your administrator.</div>';
    if(t.special==='data')return `<label class="wide">Ask about your data<input type="text" id="ait_data_q" data-ait="data|q" maxlength="300" value="${esc(val('data','q'))}" placeholder="e.g. What needs attention today?"></label>
      <div class="row" style="flex-wrap:wrap;margin:8px 0">${(hasEngine()?window.VIRTUOSO_ENGINE.hints().slice(0,5):[]).map(x=>`<button type="button" class="btn ghost sm" data-act="aitEx" data-k="data" data-id="q" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <button class="btn" type="button" data-act="aitData">Ask</button>${AIT.out.data?`<div class="aitout" role="status">${md(AIT.out.data)}</div>`:''}`;
    if(t.special==='summary')return `<label class="wide">Text to summarise<textarea id="ait_summary_text" data-ait="summary|text" rows="9" maxlength="30000" placeholder="Paste an article, report or notes here (up to about 5,000 words)">${esc(val('summary','text'))}</textarea></label>
      <label style="max-width:240px">Summary length<select data-ait="summary|len"><option value="3" ${val('summary','len','5')==='3'?'selected':''}>Short (3 sentences)</option><option value="5" ${val('summary','len','5')==='5'?'selected':''}>Medium (5 sentences)</option><option value="8" ${val('summary','len','5')==='8'?'selected':''}>Long (8 sentences)</option></select></label>
      <div style="margin-top:10px"><button class="btn" type="button" data-act="aitSummary">Summarise</button></div>${outBox('summary')}`;
    if(t.special==='names')return `<div class="form"><label>Keywords (comma separated)<input type="text" id="ait_names_kw" data-ait="names|kw" maxlength="200" value="${esc(val('names','kw'))}" placeholder="e.g. desert, ledger, trust"></label>
      <label>Industry<select data-ait="names|industry">${Object.keys(SUF).map(i=>`<option ${val('names','industry','Accounting')===i?'selected':''}>${i}</option>`).join('')}</select></label>
      <label>Style<select data-ait="names|style">${[['professional','Professional'],['modern','Modern'],['friendly','Friendly']].map(([a,b])=>`<option value="${a}" ${val('names','style','professional')===a?'selected':''}>${b}</option>`).join('')}</select></label>
      <label>Place to include (optional)<input type="text" data-ait="names|loc" maxlength="40" value="${esc(val('names','loc'))}" placeholder="e.g. Windhoek"></label>
      <label>How many<select data-ait="names|count">${[8,12,20].map(n=>`<option ${+val('names','count',12)===n?'selected':''}>${n}</option>`).join('')}</select></label></div>
      <div class="row" style="margin-top:10px"><button class="btn" type="button" data-act="aitNames">Generate names</button>${AIT.out.names?'<button class="btn ghost" type="button" data-act="aitNames" data-more="1">More ideas</button>':''}</div>${AIT.out.names?`<div class="aitout"><div class="row" style="justify-content:space-between;margin-bottom:8px"><b>Name ideas</b><button type="button" class="btn sm" data-act="aitCopy" data-k="names">Copy list</button></div><div class="aitchips">${AIT.out.names.split('\n').map(n=>`<span>${esc(n)}</span>`).join('')}</div><p class="note" style="margin:10px 0 0">Check that the name is not already registered or trademarked before you use it.</p></div>`:''}`;
    if(t.special==='chart'){
      const C=AIT.chart,withResp=(state.forms||[]).filter(f=>(state.subs||[]).some(s=>s.formId===f.id));
      const qs=C.form?(state.forms.find(f=>f.id===C.form)||{fields:[]}).fields.filter(x=>['select','radio','yesno','check'].includes(x.type)):[];
      const rows=parseData(C.data);
      return `<div class="form"><label>Chart type<select data-ait="chart|type">${[['bar','Bar chart'],['hbar','Horizontal bars'],['line','Line chart'],['pie','Pie chart'],['donut','Donut chart']].map(([a,b])=>`<option value="${a}" ${C.type===a?'selected':''}>${b}</option>`).join('')}</select></label>
        <label>Title<input type="text" data-ait="chart|title" maxlength="80" value="${esc(C.title)}" placeholder="e.g. Hours by customer"></label>
        <label>Data from<select data-ait="chart|src"><option value="">Type or paste below</option><option value="form" ${C.src==='form'?'selected':''}>Answers to a form question</option></select></label></div>
      ${C.src==='form'?`<div class="form"><label>Form<select data-ait="chart|form"><option value="">Choose a form</option>${withResp.map(f=>`<option value="${esc(f.id)}" ${C.form===f.id?'selected':''}>${esc(f.title)}</option>`).join('')}</select></label>
        <label>Question<select data-ait="chart|q"><option value="">Choose a question</option>${qs.map(x=>`<option value="${esc(x.id)}" ${C.q===x.id?'selected':''}>${esc(x.label)}</option>`).join('')}</select></label></div>${withResp.length?'':'<p class="note">No form has responses yet.</p>'}`:''}
      <label class="wide" style="margin-top:8px">Data (one per line: label, value)<textarea id="ait_chart_data" data-ait="chart|data" rows="7" maxlength="6000" placeholder="January, 120&#10;February, 95&#10;March, 143">${esc(C.data)}</textarea></label>
      <div class="row" style="margin:8px 0"><button class="btn ghost sm" type="button" data-act="aitSample">Use sample data</button><span class="note">${rows.length?rows.length+' rows ready':'Use a comma, colon or tab between the label and the number.'}</span></div>
      <button class="btn" type="button" data-act="aitChart">Make chart</button>${C.msg?`<div class="err" role="alert" style="margin-top:8px">${esc(C.msg)}</div>`:''}
      ${C.svg?`<div class="aitout"><div class="row" style="justify-content:space-between;margin-bottom:8px"><b>Your chart</b><div class="row"><button type="button" class="btn sm" data-act="aitSvg">Download SVG</button><button type="button" class="btn ghost sm" data-act="aitPng">Download PNG</button></div></div><div class="aitchart">${C.svg}</div></div>`:''}`;
    }
    return `<div class="form">${t.inputs.map(x=>field(k,x)).join('')}</div><div style="margin-top:12px"><button class="btn" type="button" data-act="aitGen" data-k="${k}">Generate</button></div>${t.note?`<p class="note">${esc(t.note)}</p>`:''}${outBox(k)}`;
  }
  function vAITools(){
    const t=AIT.tool&&byKey(AIT.tool)&&tools().includes(byKey(AIT.tool))?byKey(AIT.tool):null;
    if(!t){
      return `${crumbs(null)}<div class="aithero">${bear(120)}<div><h2 style="margin:0">Hey, how can I help?</h2><p class="sub" style="margin:4px 0 0">Pick a tool. Everything runs in your browser: nothing you type here is sent anywhere, and no AI service is used. Review all text before you use it.</p></div></div>
      <div class="stack">${GROUPS.map(g=>{const items=tools().filter(x=>x.group===g);return items.length?`<div class="panel"><h3 style="margin-top:0;font-size:.8em;letter-spacing:.08em;color:var(--muted)">${g.toUpperCase()}</h3><div class="aitgrid">${items.map(x=>`<button type="button" class="aitcard" data-act="aitPick" data-k="${x.key}"><i style="background:${x.color}" aria-hidden="true">${x.icon}</i><span><b>${esc(x.name)}</b><small>${esc(x.desc)}</small></span></button>`).join('')}</div></div>`:''}).join('')}
      <div class="panel"><h3 style="margin-top:0;font-size:.8em;letter-spacing:.08em;color:var(--muted)">NOT AVAILABLE</h3><div class="aitgrid">${UNAVAILABLE.map(([n,d])=>`<div class="aitcard off"><i style="background:#8a96a8" aria-hidden="true">✕</i><span><b>${esc(n)}</b><small>${esc(d)}</small></span></div>`).join('')}</div></div></div>`;
    }
    return `${crumbs(t)}<div class="aithero small">${bear(72)}<div><h2 style="margin:0">${esc(t.name)}</h2><p class="sub" style="margin:2px 0 0">${esc(t.desc)}</p></div></div><div class="panel">${toolBody(t)}</div>`;
  }

  /* ---------- wiring ---------- */
  const css=document.createElement('style');
  css.textContent=`
  .aitbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#0a1b3f;color:#fff;border-radius:12px;padding:10px 16px;margin-bottom:14px;position:relative;z-index:6}
  .aitbar>button{background:none;border:0;color:#dfe7f7;font:inherit;font-weight:600;cursor:pointer;padding:6px 4px;min-height:36px}
  .aitbar>button:hover{color:#fff;text-decoration:underline}.aitbar>button[aria-current=page]{color:#e6b422}
  .aitdd{position:relative}.aitdd .cur{background:none;border:0;color:#e6b422;font:inherit;font-weight:700;cursor:pointer;padding:6px 4px;min-height:36px}
  .aitmenu{position:absolute;left:0;top:calc(100% + 8px);width:min(320px,86vw);max-height:360px;overflow:auto;background:var(--surface);color:var(--fg);border:1px solid var(--line);border-radius:12px;box-shadow:0 14px 34px rgba(0,0,0,.3);padding:6px}
  .aitmenu button{display:block;width:100%;text-align:left;background:transparent;border:0;border-radius:8px;padding:11px 12px;font:inherit;color:var(--fg);cursor:pointer;min-height:44px}
  .aitmenu button:hover,.aitmenu button[aria-selected=true]{background:var(--bg);color:var(--accent);font-weight:600}
  .aithero{display:flex;gap:18px;align-items:center;background:linear-gradient(120deg,color-mix(in srgb,#e6b422 22%,var(--surface)),var(--surface));border:1px solid var(--line);border-radius:14px;padding:16px 20px;margin-bottom:14px}
  .aithero.small{padding:10px 16px}
  .aitgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px}
  .aitcard{display:flex;gap:12px;align-items:flex-start;text-align:left;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:12px;font:inherit;color:var(--fg);cursor:pointer}
  .aitcard:hover{border-color:var(--accent);box-shadow:0 3px 12px rgba(0,0,0,.1)}.aitcard.off{opacity:.65;cursor:default}.aitcard.off:hover{border-color:var(--line);box-shadow:none}
  .aitcard i{font-style:normal;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:700;flex:none}
  .aitcard span b{display:block}.aitcard small{display:block;color:var(--muted);margin-top:2px;font-size:.82em}
  .aitout{margin-top:14px;border:1px solid var(--line);background:var(--bg);border-radius:12px;padding:12px}
  .aitpre{white-space:pre-wrap;word-wrap:break-word;font:inherit;line-height:1.6;margin:0;background:transparent;border:0;padding:0}
  .aitchips{display:flex;flex-wrap:wrap;gap:8px}.aitchips span{background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:6px 12px}
  .aitchart{background:#fff;border-radius:10px;padding:6px;max-width:760px}
  @media(max-width:560px){.aithero{flex-direction:column;text-align:center}}
  `;
  document.head.appendChild(css);

  ICON.aitools='<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9zM5 15l.7 1.6L7.5 17l-1.8.7L5 19.500l-.7-1.800L2.500 17l1.800-.4z"/>';
  [NAV.adm,NAV.emp].forEach(nav=>{const g=nav.find(x=>x[0]==='Overview');if(g&&!g[1].some(x=>x[0]==='aitools'))g[1].push(['aitools','AI Tools'])});
  VIEWS.aitools=vAITools;

  const open=key=>{AIT.tool=key&&byKey(key)?key:null;AIT.menu=false;state.tab[state.role]='aitools';document.body.classList.remove('open');window.scrollTo(0,0);render()};
  window.VIRTUOSO_TOOLS={open,groups:()=>GROUPS.map(g=>({name:g,items:tools().filter(x=>x.group===g).map(x=>({key:x.key,name:x.name}))})).filter(g=>g.items.length),summarize,names,parseData,chartSVG};

  const download=(name,mime,text)=>{try{kDownloadAnchor(name,mime,text)}catch(_){const u=URL.createObjectURL(new Blob([text],{type:mime})),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500)}};
  const copy=(t,m)=>{if(navigator.clipboard)navigator.clipboard.writeText(t).then(()=>toast(m||'Copied'),()=>toast('Copy failed'));else toast('Copy is not available here')};
  document.addEventListener('input',e=>{
    const t=e.target;if(!t.dataset||!t.dataset.ait)return;const [k,id]=t.dataset.ait.split('|');
    if(k==='chart'){AIT.chart[id]=t.value;return}
    (AIT.v[k]=AIT.v[k]||{})[id]=t.value;
  },true);
  document.addEventListener('change',e=>{
    const t=e.target;if(!t.dataset||!t.dataset.ait)return;const [k,id]=t.dataset.ait.split('|');
    if(k==='chart'){
      AIT.chart[id]=t.value;
      /* Only redraw when the choice changes what is on screen. Redrawing on every blur would swallow the click on "Make chart". */
      if(id==='src'||id==='form'||id==='q'){e.stopImmediatePropagation();if(id==='form')AIT.chart.q='';if(id==='q'&&AIT.chart.form)fillFromForm();AIT.chart.msg='';render()}
      return;
    }
    (AIT.v[k]=AIT.v[k]||{})[id]=t.value;
  },true);
  function fillFromForm(){
    const C=AIT.chart,f=(state.forms||[]).find(x=>x.id===C.form),q=f&&f.fields.find(x=>x.id===C.q);if(!q)return;
    const cnt={};(state.subs||[]).filter(s=>s.formId===f.id).forEach(s=>{const a=s.ans[q.id];(Array.isArray(a)?a:[a]).forEach(v=>{if(v!=null&&v!=='')cnt[v]=(cnt[v]||0)+1})});
    C.data=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+', '+v).join('\n');C.title=C.title||q.label;
  }
  function svgToPng(svg,name){
    const img=new Image(),u=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
    img.onload=()=>{const c=document.createElement('canvas');c.width=1280;c.height=760;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);
      c.toBlob(b=>{if(!b)return toast('Could not make the PNG');const l=document.createElement('a');l.href=URL.createObjectURL(b);l.download=name;document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(l.href),1500)},'image/png')};
    img.onerror=()=>{URL.revokeObjectURL(u);toast('Could not make the PNG')};img.src=u;
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="ait"]');
    if(!b){if(AIT.menu&&!e.target.closest('.aitdd')&&state.tab&&state.tab[state.role]==='aitools'){AIT.menu=false;render()}return}
    e.stopImmediatePropagation();const d=b.dataset;
    switch(d.act){
      case 'aitHome':state.tab[state.role]='dash';AIT.menu=false;window.scrollTo(0,0);return render();
      case 'aitList':AIT.tool=null;AIT.menu=false;return render();
      case 'aitMenu':AIT.menu=!AIT.menu;return render();
      case 'aitPick':AIT.tool=d.k;AIT.menu=false;window.scrollTo(0,0);return render();
      case 'aitEx':(AIT.v[d.k]=AIT.v[d.k]||{})[d.id]=d.v;return render();
      case 'aitGen':{const t=byKey(d.k),vals=Object.assign({},...t.inputs.map(x=>({[x.id]:val(d.k,x.id,x.def)})));AIT.out[d.k]=t.gen(vals);return render()}
      case 'aitCopy':{const v=AIT.out[d.k];if(v)copy(v);return}
      case 'aitTxt':{const v=AIT.out[d.k];if(v)download((d.k)+'.txt','text/plain',v);return}
      case 'aitForm':{const p=(val('form','prompt')||'').trim();if(p.length<8){AIT.out.form='Describe the form first, for example: Create a client onboarding form with name, email and phone.';return render()}
        if(!window.VIRTUOSO_FORMS)return;const q=/\b(create|make|build|generate|draft|set up|new|design)\b/i.test(p)?p:'Create '+p;
        let r;try{r=window.VIRTUOSO_FORMS.createFromPrompt(q)}catch(_){r='Something went wrong building that. Try rephrasing.'}
        if(/^Created/.test(r)&&window.VIRTUOSO_FB){state.tab.adm='formbuilder';window.VIRTUOSO_FB.open(window.VIRTUOSO_FORMS.ctx.formId,'build');return}
        AIT.out.form=r;return render()}
      case 'aitData':{const q=(val('data','q')||'').trim();if(!q){AIT.out.data='Type a question first.';return render()}
        if(!hasEngine()){AIT.out.data='The data helper is not available yet.';return render()}
        window.VIRTUOSO_ENGINE.answer(q).then(r=>{AIT.out.data=r.reply.replace(/\[\[tool:[a-z-]+\|[^\]]+\]\]/g,'');render()});return}
      case 'aitSummary':{const txt=(val('summary','text')||'').trim();if(txt.split(/\s+/).length<40){AIT.out.summary='Paste at least a few paragraphs (about 40 words or more) to summarise.';return render()}
        const r=summarize(txt,+val('summary','len','5'));const short=r.sentences.join(' ');
        AIT.out.summary=`SUMMARY\n${short}\n\nKEY POINTS\n${r.sentences.map(s=>'- '+s).join('\n')}\n\nMAIN TOPICS\n${r.keywords.join(', ')||'(none found)'}\n\n${r.words} words shortened to ${short.split(/\s+/).length} (${Math.max(1,Math.round(short.split(/\s+/).length/r.words*100))}%).`;return render()}
      case 'aitNames':{if(d.more)AIT.shuffle++;else AIT.shuffle=0;const v={kw:val('names','kw'),industry:val('names','industry','Accounting'),style:val('names','style','professional'),loc:val('names','loc'),count:val('names','count','12')};
        AIT.out.names=names(v,AIT.shuffle).join('\n');return render()}
      case 'aitSample':AIT.chart.data='January, 120\nFebruary, 95\nMarch, 143\nApril, 110\nMay, 160\nJune, 138';AIT.chart.title=AIT.chart.title||'Sample: hours per month';AIT.chart.msg='';return render();
      case 'aitChart':{const rows=parseData(AIT.chart.data);
        if(rows.length<2){AIT.chart.msg='Add at least two lines like "January, 120".';AIT.chart.svg='';return render()}
        if((AIT.chart.type==='pie'||AIT.chart.type==='donut')&&!rows.some(r=>r.value>0)){AIT.chart.msg='Pie charts need at least one positive number.';AIT.chart.svg='';return render()}
        AIT.chart.msg='';AIT.chart.svg=chartSVG(AIT.chart.type,AIT.chart.title.trim(),rows);return render()}
      case 'aitSvg':{const s=AIT.chart.svg;if(s)download('chart.svg','image/svg+xml',s);return}
      case 'aitPng':{const s=AIT.chart.svg;if(s)svgToPng(s,'chart.png');return}
    }
  },true);

  /* ---------- Bruno understands requests for these tools ---------- */
  const E=window.VIRTUOSO_ENGINE;
  if(E&&E.addIntent){
    const mark=(k,label)=>`[[tool:${k}|${label}]]`;
    const openers=[['email',/\b(business|formal|professional)\s+e-?mail\b|\bwrite (me )?an? e-?mail\b/,'Business Email Generator','I can draft that in the AI Tools.'],
      ['cold',/\bcold (e-?mail|outreach)\b|\bsales e-?mail\b/,'Cold Email Generator','I can help with that in the AI Tools.'],
      ['apology',/\bapolog(y|ise|ize) (letter|e-?mail|note)\b|\bletter of apology\b/,'Apology Letter Generator','I can draft that in the AI Tools.'],
      ['reminder',/\b(payment|invoice|overdue) (reminder|notice)\b|\bremind\b.*\b(pay|invoice)\b/,'Payment Reminder Generator','I can draft that in the AI Tools.'],
      ['contract',/\b(contract|agreement|nda)\b.*\b(generate|draft|write|make|create)\b|\b(generate|draft|write|make|create)\b.*\b(contract|nda|service agreement)\b/,'Contract Generator','I can make a contract template in the AI Tools. It is a starting draft, not legal advice.'],
      ['chart',/\b(make|create|draw|build|generate|plot|show)\b.*\b(chart|graph)\b|\b(bar|line|pie|donut) (chart|graph)\b|\bchart maker\b/,'Chart Maker','I can turn your numbers into a chart in the AI Tools.']];
    openers.forEach(([k,re,label,say])=>E.addIntent({id:'tool-'+k,test:t=>!/^how\b/.test(t)&&re.test(t)&&!(k==='email'&&/\bconfirmation email\b/.test(t)),run:async()=>`${say}\n${mark(k,'Open '+label)}`}));
    E.addIntent({id:'tool-summary',test:(t,raw)=>/\bsummari[sz]e\b/.test(t)&&/[:\n]/.test(raw)&&raw.length>260&&!/\b(responses?|submissions?|forms?|kyc|petty|payroll)\b/.test(t.slice(0,60)),
      run:async raw=>{const body=raw.slice(raw.search(/[:\n]/)+1).trim(),r=summarize(body,4);return r.sentences.length?`Here is a short summary:\n${r.sentences.map(s=>'- '+s).join('\n')}\n\nMain topics: ${r.keywords.join(', ')||'none found'}.\n${mark('summary','Open Article Summarizer')}`:'I need a longer text with full sentences to summarise.'}});
    E.addIntent({id:'tool-summary-open',test:t=>/\b(summari[sz]e|summary of)\b.*\b(article|text|notes|report|document)\b/.test(t)&&!/\b(responses?|submissions?)\b/.test(t),run:async()=>`Paste the text into the Article Summarizer and I will pick out the key sentences.\n${mark('summary','Open Article Summarizer')}`});
    E.addIntent({id:'tool-names',test:t=>/\b(business|company|brand|trading) names?\b|\bname (ideas|for my)\b|\bname my (business|company)\b/.test(t),
      run:async(raw)=>{const m=raw.match(/\b(?:for|about|called)\s+(?:an?\s+|my\s+|a\s+)?([a-z][a-z ,&-]{2,60})$/i),kw=m?m[1].replace(/\b(business|company|firm|startup)\b/gi,'').trim():'';
        const list=names({kw,industry:'Other',style:'professional',loc:'',count:8},0);return `Some name ideas${kw?' for '+kw:''}:\n${list.map(n=>'- '+n).join('\n')}\nCheck that a name is free and not already registered before you use it.\n${mark('names','Open Business Name Generator')}`}});
    if(E.addHintsAll)E.addHintsAll(['Write a business email','Make a chart from my data']);
  }
})();
