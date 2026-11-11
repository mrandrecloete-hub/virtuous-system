/* STATEMENT CONVERSION (admin, Money > Statement conversion).
   PDF, scanned PDF or photo of a bank statement -> Excel file in the layout used for Zoho Books entry:
   one sheet "Sheet1", columns Date | Description | Reference | Debit | Credit | Balance,
   Date as text dd/mm/yyyy, Debit = money out, Credit = money in, Reference = BS<MM>/<NNN>, empty cells left empty.
   Reading happens in the browser (typed PDFs use their text layer, scans use OCR from ocr.js). Nothing is stored or sent anywhere.
   The running balance is used to check every line (and to repair a misread amount); lines that do not add up are marked for review.
   window.VIRTUOSO_STMT = { parse, buildXlsx, buildCsv }. Action prefix `sc`. */
(function(){
  'use strict';
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad=n=>String(n).padStart(2,'0');
  const r2=n=>Math.round(n*100)/100;
  const f2=n=>n==null||n===''?'':(+n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const MON={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,sept:9};
  const MONFULL=/^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?,?$/i;
  const dim=(y,m)=>new Date(y,m,0).getDate();

  /* ---------- money ---------- */
  const MONEY=/^(-|\(|\+)?(?:N\$|NAD|R|\$)?(\d{1,3}(?:[, ]\d{3})+|\d+)[.,](\d{2})(\)|-)?(cr|dr|c|d)?\.?$/i;
  function money(t){
    t=String(t).trim().replace(/[Oo](?=\d)|(?<=\d)[Oo]/g,'0');
    const m=MONEY.exec(t);if(!m)return null;
    let v=+(m[2].replace(/[, ]/g,'')+'.'+m[3]);
    const neg=m[1]==='-'||m[1]==='('||m[4]===')'||m[4]==='-';
    const mk=m[5]?(/^c/i.test(m[5])?'cr':'dr'):'';
    return {v,neg,mk};
  }
  const isMark=t=>/^(cr|dr|c|d)\.?$/i.test(t);

  /* ---------- dates ---------- */
  function dateAt(words,i,ctx){
    /* returns {n:wordsUsed, d,m,y|null} when the words starting at i form a date */
    const t=String(words[i].t).trim();let m;
    if(m=/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t))return {n:1,y:+m[1],m:+m[2],d:+m[3]};
    if(m=/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(t))return {n:1,d:+m[1],m:+m[2],y:+m[3]<100?2000+ +m[3]:+m[3]};
    if(m=/^(\d{1,2})[-/.](\d{1,2})$/.exec(t))return {n:1,d:+m[1],m:+m[2],y:null};
    if(m=/^(\d{1,2})(?:st|nd|rd|th)?[-/.]?([A-Za-z]{3,9})\.?[-/.]?(\d{2,4})?,?$/.exec(t)){const mo=MON[m[2].toLowerCase().slice(0,4)]||MON[m[2].toLowerCase().slice(0,3)];
      if(mo&&MONFULL.test(m[2]))return {n:1,d:+m[1],m:mo,y:m[3]?(+m[3]<100?2000+ +m[3]:+m[3]):null}}
    if(/^\d{1,2}(?:st|nd|rd|th)?$/.test(t)&&words[i+1]&&MONFULL.test(String(words[i+1].t).trim())){
      const mo=MON[String(words[i+1].t).toLowerCase().replace(/[^a-z]/g,'').slice(0,4)]||MON[String(words[i+1].t).toLowerCase().replace(/[^a-z]/g,'').slice(0,3)];
      if(mo){let n=2,y=null;const w3=words[i+2]&&String(words[i+2].t).trim();if(w3&&/^(19|20)\d{2}$/.test(w3)){y=+w3;n=3}else if(w3&&/^'?\d{2}$/.test(w3)&&false){}
        return {n,d:parseInt(t,10),m:mo,y}}}
    return null;
  }
  const validDate=(y,m,d)=>y&&m>=1&&m<=12&&d>=1&&d<=dim(y,m);

  /* ---------- text tidy (matches the sample: first letter of each word capital, rest lower case) ---------- */
  function tidy(s){
    return String(s).replace(/\s+/g,' ').trim().toLowerCase().replace(/(^|[\s\/\-:#*(])([a-z])/g,(m,a,b)=>a+b.toUpperCase());
  }

  /* ---------- statement period / year ---------- */
  function findPeriod(rows){
    const text=rows.map(r=>r.text).join('\n');
    let m,years=[];
    const re=/(\d{1,2})\s*(?:st|nd|rd|th)?[\s\-\/]*(jan[a-z]*|feb[a-z]*|mar[a-z]*|apr[a-z]*|may|jun[a-z]*|jul[a-z]*|aug[a-z]*|sep[a-z]*|oct[a-z]*|nov[a-z]*|dec[a-z]*)[\s\-\/,]*((?:19|20)\d{2})/gi;
    const found=[];while(m=re.exec(text)){const mo=MON[m[2].toLowerCase().slice(0,4)]||MON[m[2].toLowerCase().slice(0,3)];if(mo)found.push({d:+m[1],m:mo,y:+m[3]})}
    const re2=/(\d{1,2})[\/.\-](\d{1,2})[\/.\-]((?:19|20)\d{2})/g;while(m=re2.exec(text)){if(+m[2]<=12&&+m[1]<=31)found.push({d:+m[1],m:+m[2],y:+m[3]})}
    found.forEach(f=>years.push(f.y));
    const per=/(?:period|statement\s*date|from)[^\n]{0,40}/i.exec(text);
    let start=null,end=null;
    if(per){const seg=per[0];const fs=[];let mm;const r3=new RegExp(re.source,'gi');while(mm=r3.exec(seg)){const mo=MON[mm[2].toLowerCase().slice(0,4)]||MON[mm[2].toLowerCase().slice(0,3)];if(mo)fs.push({d:+mm[1],m:mo,y:+mm[3]})}
      if(fs.length)start=fs[0],end=fs[fs.length-1]}
    if(!end&&found.length){start=found[0];end=found[found.length-1]}
    const yc={};years.forEach(y=>yc[y]=(yc[y]||0)+1);
    const top=Object.keys(yc).sort((a,b)=>yc[b]-yc[a])[0];
    return {start,end,year:top?+top:new Date().getFullYear()};
  }
  function yearFor(m,per,def){
    if(per.start&&per.end&&per.start.y!==per.end.y){return m>=per.start.m&&m>per.end.m?per.start.y:(m<=per.end.m?per.end.y:per.start.y)}
    if(per.end&&per.start&&per.start.y===per.end.y)return per.end.y;
    return def;
  }

  /* ---------- header columns ---------- */
  const HDR=[['debit',/^(debits?|dr|withdrawals?|withdrawn|payments?|paid\s*out|money\s*out|out)$/i],['credit',/^(credits?|cr|deposits?|receipts?|paid\s*in|money\s*in|in)$/i],['balance',/^(balance|running\s*balance|bal)$/i],['amount',/^(amount|amt|transaction\s*amount)$/i],['date',/^(date|trans\.?\s*date|posting\s*date)$/i],['desc',/^(description|details?|particulars|narrative|transaction\s*details?)$/i]];
  function headerOf(row){
    const found={};
    const w=expand(row.w);
    if(w.length>10||w.some(x=>money(x.t)))return null;
    for(let i=0;i<w.length;i++){
      const t1=String(w[i].t).trim(),t2=w[i+1]?t1+' '+String(w[i+1].t).trim():'';
      for(const [k,re] of HDR){
        if(found[k])continue;
        if(t2&&re.test(t2)&&/\s/.test(t2)){found[k]={x0:w[i].x0,x1:w[i+1].x1};continue}
        if(re.test(t1.replace(/[^A-Za-z. ]/g,'')))found[k]={x0:w[i].x0,x1:w[i].x1};
      }
    }
    const n=['debit','credit','balance','amount'].filter(k=>found[k]).length;
    return n>=2&&(found.balance||found.debit||found.amount)&&(found.date||found.desc||n>=3)?found:null;
  }
  const colDist=(w,h)=>Math.min(Math.abs(w.x1-h.x1),Math.abs((w.x0+w.x1)/2-(h.x0+h.x1)/2),Math.abs(w.x0-h.x0));

  /* the reader may hand over whole phrases ("03 Mar", "1,600.00 Cr"): split them into single words with estimated positions */
  function expand(ws){
    const out=[];
    ws.forEach(w=>{const t=String(w.t);if(!/\s/.test(t.trim())||/^\d{1,3}( \d{3})+\.\d{2}\s?(cr|dr)?$/i.test(t.trim())){out.push(w);return}
      const len=t.length||1,wd=w.x1-w.x0;let m;const re=/\S+/g;
      while(m=re.exec(t)){out.push({...w,t:m[0],x0:w.x0+wd*m.index/len,x1:w.x0+wd*(m.index+m[0].length)/len})}});
    return out;
  }
  /* ---------- row analysis ---------- */
  const SKIP=/^(page\s*\d|\d+\s*(of|\/)\s*\d+$|statement\b|account\b|acc\.?\s*no|branch|vat\b|reg(istration)?\b|tel\b|fax\b|www\.|customer\b|opening\s+bal|closing\s+bal|balance\s+brought|brought\s+forward|carried\s+forward|total\b|date\b|description\b|please\b|continued|bank\s+charges\s+summary|interest\s+rate|\*+)/i;
  const OPEN=/(opening\s*balance|balance\s*brought\s*forward|brought\s*forward|b\/f\b|previous\s*balance|balance\s*b\/f)/i;
  const CLOSE=/(closing\s*balance|balance\s*carried\s*forward|carried\s*forward|c\/f\b)/i;

  function analyseRow(r,H,hdr,per,defY){
    const w=expand(r.w);
    /* merge "1 600.00" -> "1600.00" */
    for(let i=0;i<w.length-1;i++){
      if(/^\d{1,3}$/.test(w[i].t)&&/^\d{3}[.,]\d{2}(?:cr|dr)?$/i.test(w[i+1].t)&&w[i+1].x0-w[i].x1<H*.9){w.splice(i,2,{...w[i+1],t:w[i].t+w[i+1].t,x0:w[i].x0});i--}
    }
    /* OCR sometimes reads "286,906.32" as "286 906 32": join a trailing run of digit groups (before any Cr/Dr) */
    for(let guard=0;guard<3;guard++){
      let e=w.length;if(e&&isMark(w[e-1].t))e--;
      let st=e;while(st>0&&/^\d+$/.test(String(w[st-1].t).trim())&&e-st<4)st--;
      const run=w.slice(st,e).map(x=>String(x.t).trim());
      if(run.length>=3&&run[0].length<=3&&run.slice(1,-1).every(x=>x.length===3)&&run[run.length-1].length===2){
        const nw={...w[st],t:run.slice(0,-1).join(',')+'.'+run[run.length-1],x0:w[st].x0,x1:w[e-1].x1};w.splice(st,e-st,nw);
      }else break;
    }
    let i=0,date=null;
    const d=dateAt(w,0,per);
    if(d){date=d;i=d.n}
    const mon=[];let k=w.length;
    /* money words from the right, allowing Cr/Dr marker words */
    const items=[];
    for(let j=i;j<w.length;j++){
      const mv=money(w[j].t);
      if(mv){const nx=w[j+1];let mk=mv.mk;let used=1;if(!mk&&nx&&isMark(nx.t)&&nx.x0-w[j].x1<H*1.5){mk=/^c/i.test(nx.t)?'cr':'dr';used=2}
        items.push({j,mv:{...mv,mk},w:w[j],used});if(used===2)j++}
    }
    /* only money that sits after the description counts: keep trailing run of money words */
    let moneyItems=items;
    if(items.length){
      /* a money-looking number inside the description (followed by text) is description */
      const lastText=(()=>{for(let j=w.length-1;j>=i;j--){if(!money(w[j].t)&&!isMark(w[j].t))return j}return -1})();
      moneyItems=items.filter(it=>it.j>lastText);
    }
    const descEnd=moneyItems.length?moneyItems[0].j:w.length;
    const dw=w.slice(i,descEnd);const desc=dw.map(x=>x.t).join(' ').replace(/\s+/g,' ').trim();
    const dconf=dw.reduce((a,x)=>Math.min(a,x.c==null?100:x.c),100);
    return {date,desc,dconf,money:moneyItems,text:r.text,y0:r.y0,y1:r.y1};
  }

  /* ---------- main parser ---------- */
  function parse(pages,opt){
    opt=opt||{};
    const O=window.VIRTUOSO_OCR;
    const allRows=[],pageRows=[];
    let H=12;
    pages.forEach((words,pi)=>{const t=O.toRows(words);H=t.H||H;pageRows.push(t.rows);t.rows.forEach(r=>allRows.push(r))});
    const per=findPeriod(allRows);
    const defY=opt.year||per.year;
    let hdr=null,openBal=null,closeBal=null;
    const tx=[];let prev=null;let lastY=null;
    const notes=[];
    pageRows.forEach((rows,pi)=>{
      lastY=null;prev=null;
      for(const r of rows){
        const h=headerOf(r);if(h){hdr=h;prev=null;continue}
        const a=analyseRow(r,H,hdr,per,defY);
        const low=a.text.trim();
        if(!a.date){
          const mo=OPEN.test(low),mc=CLOSE.test(low);
          if((mo||mc)&&a.money.length){const mv=a.money[(hdr&&hdr.balance)||a.money.length===1?a.money.length-1:0].mv;const v=(mv.mk==='dr'||mv.neg)?-mv.v:mv.v;if(mo&&openBal==null)openBal=v;if(mc)closeBal=v;prev=null;continue}
          if(prev&&a.money.length===0&&low&&!SKIP.test(low)&&a.y0-prev.y1<H*1.7&&prev.extra<2&&!/^(\d+\s*)?(of\s*\d+)?$/.test(low)){prev.desc+=' '+low;prev.extra++;prev.y1=a.y1}
          else prev=null;
          continue;
        }
        /* dated row */
        const mo=OPEN.test(a.desc);
        if(!a.money.length){ /* dated line with no readable amount: keep it, marked, so nothing is lost silently */
          if(!mo&&(a.desc||/\d/.test(a.text.replace(/^[^ ]+ [^ ]+/,'')))){const t0={date:a.date,desc:a.desc,dconf:a.dconf,money:[],y1:a.y1,extra:0,page:pi,raw:a.text};tx.push(t0);prev=t0}
          continue;
        }
        if(mo&&openBal==null){const mv=a.money[a.money.length-1].mv;openBal=(mv.mk==='dr'||mv.neg)?-mv.v:mv.v;prev=null;continue}
        const t={date:a.date,desc:a.desc,dconf:a.dconf,money:a.money,y1:a.y1,extra:0,page:pi,raw:a.text};
        tx.push(t);prev=t;
      }
    });
    /* pending dated rows with no amount (description on the line above the amounts) are dropped silently */
    /* ---- decide the column layout ---- */
    const counts=tx.map(t=>t.money.length);
    const hasBalCol=hdr?!!hdr.balance:(counts.filter(c=>c>=2).length>=counts.length*.6);
    const hasDC=hdr&&hdr.debit&&hdr.credit;
    const out=[];
    tx.forEach(t=>{
      let amt=null,bal=null,dir=null,mk='',balMk='';
      if(hdr){
        /* assign each money word to the nearest header column */
        const cols=['debit','credit','balance','amount'].filter(k=>hdr[k]);
        t.money.forEach(it=>{
          let best=null,bd=1e9;cols.forEach(k=>{const dd=colDist(it.w,hdr[k]);if(dd<bd){bd=dd;best=k}});
          if(bd>H*9&&cols.length>1)return;
          const v=it.mv;
          if(best==='balance'){bal=(v.mk==='dr'||v.neg)?-v.v:v.v;balMk=v.mk}
          else if(best==='debit'){amt=v.v;dir='debit'}
          else if(best==='credit'){amt=v.v;dir='credit'}
          else if(best==='amount'){amt=v.v;mk=v.mk;if(v.neg)dir='debit'}
        });
      }else{
        const m=t.money;
        if(hasBalCol&&m.length>=2){const b=m[m.length-1].mv;bal=(b.mk==='dr'||b.neg)?-b.v:b.v;const a=m[m.length-2].mv;amt=a.v;mk=a.mk;if(a.neg)dir='debit'}
        else if(m.length){const a=m[m.length-1].mv;amt=a.v;mk=a.mk;if(a.neg)dir='debit'}
      }
      if(!dir&&mk)dir=mk==='cr'?'credit':'debit';
      out.push({date:t.date,desc:t.desc,amt,bal,dir,raw:t.raw,flags:[],balRead:bal!=null,dconf:t.dconf});
    });
    /* ---- years ---- */
    out.forEach(o=>{const d=o.date;const y=d.y||yearFor(d.m,per,defY);o.iso=validDate(y,d.m,d.d)?y+'-'+pad(d.m)+'-'+pad(d.d):null;if(!o.iso)o.flags.push('Date not read')});
    /* ---- directions and the running-balance check ---- */
    if(!hasBalCol){ /* no balances to lean on: use the sign convention of the statement */
      const anyCr=out.some(o=>o.dir==='credit'),anyDr=out.some(o=>o.dir==='debit');
      out.forEach(o=>{if(!o.dir&&o.amt!=null){if(anyCr&&!anyDr)o.dir='debit';else if(anyDr&&!anyCr)o.dir='credit'}});
    }
    /* No balance column and no markers (e.g. a card statement with one amount column): the printed opening and closing
       balances decide whether the unmarked amounts are debits. Only the direction is set; no number is changed. */
    if(!hasBalCol&&openBal!=null&&closeBal!=null){
      const un=out.filter(o=>o.amt!=null&&!o.dir);
      if(un.length){
        const cr=r2(out.filter(o=>o.dir==='credit').reduce((a,o)=>a+o.amt,0)),dr=r2(out.filter(o=>o.dir==='debit').reduce((a,o)=>a+o.amt,0)),u=r2(un.reduce((a,o)=>a+o.amt,0));
        const calc=r2(openBal-dr-u+cr);
        if(Math.abs(calc-closeBal)<.005||Math.abs(calc+closeBal)<.005)un.forEach(o=>{o.dir='debit'});
      }
    }
    resolveChain(out,openBal,opt.openingBalance,hasBalCol);
    out.forEach(o=>{if(o.dconf!=null&&o.dconf<85)o.flags.push('Check the description (scan was hard to read)')});
    return {hdr,rows:out,period:per,openBal:out.openUsed!=null?out.openUsed:openBal,closeBal,hasBalCol,pages:pages.length};
  }

  /* Checks the printed figures against each other. It NEVER changes a printed amount or balance and never
     calculates a missing one: disagreements are flagged, with a suggestion the user can accept (r.sugg). */
  function resolveChain(rows,openBal,manualOpen,hasBal){
    const n=rows.length;if(!n)return;
    const open=manualOpen!=null&&manualOpen!==''&&!isNaN(+manualOpen)?+manualOpen:openBal;
    rows.openUsed=open;                       /* printed (or typed by the user) only; never inferred */
    let prevBal=open;
    for(let i=0;i<n;i++){
      const r=rows[i];
      if(r.amt==null){
        r.flags.push('Amount not read');
        if(r.bal!=null&&prevBal!=null){const d=r2(r.bal-prevBal);if(Math.abs(d)>0)r.sugg={amt:Math.abs(d),dir:d>0?'credit':'debit',why:'the balance moved by '+f2(Math.abs(d))}}
      }else if(prevBal!=null&&r.bal!=null){
        const d=r2(r.bal-prevBal),match=Math.abs(Math.abs(d)-r.amt)<.005;
        if(match){
          const dd=d>0?'credit':'debit';
          if(r.dir&&r.dir!==dd){r.flags.push('Debit/credit disagrees with the balance');r.sugg={amt:r.amt,dir:dd,why:'the balance moved the other way'}}
          else if(!r.dir)r.dir=dd;              /* direction only; the numbers are untouched */
        }else{
          r.flags.push('Amount and balance do not agree (printed amount '+f2(r.amt)+', balance moved '+f2(Math.abs(d))+')');
          if(Math.abs(d)>0)r.sugg={amt:Math.abs(d),dir:d>0?'credit':'debit',why:'the balance moved by '+f2(Math.abs(d))};
        }
      }
      if(r.amt!=null&&!r.dir&&!r.sugg){r.flags.push('Debit or credit not clear: left empty, please choose')}
      if(r.bal==null&&hasBal)r.flags.push('Balance not read');
      prevBal=r.bal!=null?r.bal:null;          /* an unread balance breaks the chain instead of being guessed */
    }
  }

  /* ---------- build the Zoho-style rows ---------- */
  function toSheetRows(rows,o){
    const prefix=(o&&o.prefix!=null)?String(o.prefix):'BS',cnt={};
    return rows.map(r=>{
      const iso=r.iso||'';const mm=iso?iso.slice(5,7):'00',key=iso?iso.slice(0,7):'x';
      cnt[key]=(cnt[key]||0)+1;
      return {date:iso?iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4):'',desc:(o&&o.tidy===false)?r.desc:tidy(r.desc),ref:prefix+mm+'/'+String(cnt[key]).padStart(3,'0'),
        debit:r.dir==='debit'&&r.amt!=null?r.amt:null,credit:r.dir==='credit'&&r.amt!=null?r.amt:null,balance:r.bal!=null?r.bal:null,flags:r.flags||[]};
    });
  }

  /* ---------- Excel / CSV ---------- */
  const BASE=new URL('vendor/',document.baseURI).href;
  let exLib=null;
  const loadEx=()=>exLib||(exLib=new Promise((ok,bad)=>{if(window.ExcelJS)return ok(window.ExcelJS);const s=document.createElement('script');s.src=BASE+'exceljs/exceljs.min.js';s.onload=()=>ok(window.ExcelJS);s.onerror=()=>bad(new Error('Could not load the Excel writer'));document.head.appendChild(s)}));
  async function buildXlsx(rows){
    const E=await loadEx();const wb=new E.Workbook();const ws=wb.addWorksheet('Sheet1');
    ws.columns=[{header:'Date',key:'date',width:14.3},{header:'Description',key:'desc',width:58.3},{header:'Reference',key:'ref',width:13.2},{header:'Debit',key:'debit',width:14},{header:'Credit',key:'credit',width:14.85},{header:'Balance',key:'balance',width:16.5}];
    ws.getRow(1).eachCell(c=>{c.font={name:'Arial',size:11,bold:true}});
    rows.forEach(r=>{const row=ws.addRow({date:r.date,desc:r.desc,ref:r.ref,debit:r.debit==null?null:r.debit,credit:r.credit==null?null:r.credit,balance:r.balance==null?null:r.balance});row.eachCell({includeEmpty:true},c=>{c.font={name:'Arial',size:11}})});
    const buf=await wb.xlsx.writeBuffer();
    return new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function buildCsv(rows){
    const q=v=>{v=v==null?'':String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
    return new Blob(['﻿'+['Date','Description','Reference','Debit','Credit','Balance'].join(',')+'\r\n'+rows.map(r=>[r.date,r.desc,r.ref,r.debit,r.credit,r.balance].map(q).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  }
  function save(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(u)},1500)}

  /* ---------- page ---------- */
  const S={files:[],opt:{prefix:'BS',tidy:true,year:'',open:''},busy:false,seq:0};
  const baseName=n=>String(n).replace(/\.[^.]+$/,'');
  function sheetRows(f){const rs=toSheetRows(f.rows,{prefix:S.opt.prefix,tidy:S.opt.tidy});rs.forEach((x,k)=>{const r=f.rows[k];if(r.refOverride!=null)x.ref=r.refOverride;if(r.tidyDone)x.desc=r.desc});return rs}
  function totals(f){
    const rs=sheetRows(f);
    const deb=r2(rs.reduce((a,r)=>a+(r.debit||0),0)),cre=r2(rs.reduce((a,r)=>a+(r.credit||0),0));
    const tn=v=>{v=String(v==null?'':v).replace(/[, ]/g,'').trim();return v===''||isNaN(+v)?null:+v};
    const open=tn(f.openType)!=null?tn(f.openType):f.openBal;
    const lastBal=(()=>{for(let i=f.rows.length-1;i>=0;i--)if(f.rows[i].bal!=null)return f.rows[i].bal;return null})();
    const close=tn(f.closeType)!=null?tn(f.closeType):(f.closeBal!=null?f.closeBal:lastBal);
    const closeSrc=tn(f.closeType)!=null?'typed by you':(f.closeBal!=null?'printed closing balance':(lastBal!=null?'balance on the last line':''));
    const calc=open!=null?r2(open-deb+cre):null,alt=open!=null?r2(open+deb-cre):null;
    let diff=calc!=null&&close!=null?r2(calc-close):null;
    const flip=diff!=null&&Math.abs(diff)>=.005&&close!=null&&Math.abs(r2(calc+close))<.005;if(flip)diff=0;
    const ok=diff==null?null:(Math.abs(diff)<.005||flip);
    const altOk=diff!=null&&!ok&&Math.abs(r2(alt-close))<.005;
    return {rs,deb,cre,open,close,closeSrc,calc,diff,ok,altOk,flip,lastBal,flagged:f.rows.filter(r=>r.flags&&r.flags.length).length};
  }
  function cardHTML(f,i){
    if(f.status!=='done')return `<div class="panel scc" data-f="${f.id}"><div class="ph"><h3>${esc(f.name)}</h3><button class="btn ghost sm" type="button" data-act="scDrop" data-i="${i}">Remove</button></div>
      <p class="note" style="margin:0">${f.status==='error'?'<span class="err">'+esc(f.msg)+'</span>':esc(f.msg||'Waiting…')}</p>${f.status==='run'?`<div class="scbar"><i style="width:${Math.round((f.pct||0)*100)}%"></i></div>`:''}</div>`;
    const T=totals(f);
    const rows=f.rows.map((r,k)=>{const s=T.rs[k];const bad=r.flags&&r.flags.length;
      return `<tr class="${bad?'scbad':''}"><td><input data-sc="date" data-i="${i}" data-k="${k}" value="${esc(s.date)}" aria-label="Date" style="width:92px"></td>
      <td><input data-sc="desc" data-i="${i}" data-k="${k}" value="${esc(s.desc)}" aria-label="Description" style="width:100%;min-width:380px"></td>
      <td><input data-sc="ref" data-i="${i}" data-k="${k}" value="${esc(s.ref)}" aria-label="Reference" style="width:84px"></td>
      <td><input data-sc="debit" data-i="${i}" data-k="${k}" value="${s.debit==null?'':s.debit}" inputmode="decimal" aria-label="Debit" style="width:92px;text-align:right"></td>
      <td><input data-sc="credit" data-i="${i}" data-k="${k}" value="${s.credit==null?'':s.credit}" inputmode="decimal" aria-label="Credit" style="width:92px;text-align:right"></td>
      <td><input data-sc="balance" data-i="${i}" data-k="${k}" value="${s.balance==null?'':s.balance}" inputmode="decimal" aria-label="Balance" style="width:104px;text-align:right"></td>
      <td class="scf">${bad?`<span title="${esc((r.raw||'')+'')}">${esc(r.flags.join('; '))}</span>`:''}${r.sugg?` <button class="btn ghost sm" type="button" data-act="scUse" data-i="${i}" data-k="${k}" title="Because ${esc(r.sugg.why)}">Use ${f2(r.sugg.amt)} ${r.sugg.dir}</button>`:''}</td>
      <td><button class="btn ghost sm" type="button" data-act="scDel" data-i="${i}" data-k="${k}" aria-label="Delete line">&times;</button></td></tr>`}).join('');
    const cls=T.ok==null?'warn':T.ok?'ok':'bad';
    const msg=T.ok==null?'Cannot verify yet: '+(T.open==null?'opening balance not found (type it below)':'closing balance not found (type it below)'):T.ok?(T.flip?'AGREES: closing balance on the statement is the amount owed ('+f2(T.close)+'), which equals opening (credit) less debits plus credits':'AGREES: opening - debits + credits = closing balance'):'DOES NOT AGREE: difference '+f2(T.diff)+(T.altOk?'. It would agree if debits ADD to the balance (card-style statement): check the Debit/Credit columns.':'. Check the marked lines against the statement.');
    const inp=(k,v,ph)=>`<input data-scb="${k}" data-i="${i}" value="${esc(v||'')}" inputmode="decimal" placeholder="${ph}" style="width:120px;text-align:right">`;
    const box=`<div class="scver ${cls}" style="border:2px solid ${T.ok==null?'#c9a227':T.ok?'#2e9e5b':'#d33'};border-radius:10px;padding:10px 12px;margin:0 0 10px">
      <b>${esc(msg)}</b>
      <table style="margin-top:8px;min-width:0"><tbody>
      <tr><td>Opening balance (statement)</td><td class="n"><b>${T.open==null?'not found':f2(T.open)}</b></td><td>${inp('open',f.openType,'type if not found')}</td></tr>
      <tr><td>Total debits (money out)</td><td class="n"><b>${f2(T.deb)}</b></td><td></td></tr>
      <tr><td>Total credits (money in)</td><td class="n"><b>${f2(T.cre)}</b></td><td></td></tr>
      <tr><td>Closing balance calculated</td><td class="n"><b>${T.calc==null?'-':f2(T.calc)}</b></td><td></td></tr>
      <tr><td>Closing balance on the statement${T.closeSrc?' ('+T.closeSrc+')':''}</td><td class="n"><b>${T.close==null?'not found':f2(T.close)}</b></td><td>${inp('close',f.closeType,'type from statement')}</td></tr>
      <tr><td>Difference</td><td class="n"><b>${T.diff==null?'-':f2(T.diff)}</b></td><td></td></tr></tbody></table></div>`;
    return `<div class="panel scc" data-f="${f.id}"><div class="ph"><h3>${esc(f.name)}</h3><div class="row"><button class="btn sm" type="button" data-act="scXlsx" data-i="${i}">Download Excel</button><button class="btn ghost sm" type="button" data-act="scCsv" data-i="${i}">Download CSV</button><button class="btn ghost sm" type="button" data-act="scDrop" data-i="${i}">Remove</button></div></div>
      <p class="note" style="margin:0 0 8px">${f.rows.length} line${f.rows.length===1?'':'s'} read from ${f.pages} page${f.pages===1?'':'s'} (${f.mode==='ocr'?'scanned, read with OCR':'text in the PDF'}).${T.flagged?' <b>'+T.flagged+' line'+(T.flagged===1?'':'s')+' to review.</b>':''} The balances above are only a check; they are never added to the lines.</p>
      ${box}
      <div class="tbl" style="max-height:520px;overflow:auto"><table style="min-width:860px"><thead><tr><th>Date</th><th>Description</th><th>Reference</th><th class="n">Debit</th><th class="n">Credit</th><th class="n">Balance</th><th>Review</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="8" class="note">No transactions were found. Check that the file is a bank statement and try a clearer scan.</td></tr>'}</tbody></table></div>
      <div class="row" style="margin-top:8px"><button class="btn ghost sm" type="button" data-act="scAdd" data-i="${i}">Add a line</button></div></div>`;
  }
  const css=document.createElement('style');
  css.textContent=`.scc .scbar{height:8px;border-radius:6px;background:#e3e8f6;overflow:hidden;margin-top:10px}.scc .scbar i{display:block;height:100%;background:linear-gradient(90deg,#2347c9,#d8a926)}
  .scc tr.scbad td{background:#fff7e0}.scc .scf{font-size:12px;color:#7a5a00;min-width:170px}.scc input{padding:5px 7px;font-size:13px}
  .scopt{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));align-items:end}
  .scdrop{border:2px dashed #9db0e6;border-radius:14px;background:#f5f8ff;padding:26px 16px;text-align:center;cursor:pointer;margin-top:12px}.scdrop.over{background:#e8efff;border-color:#2347c9}
  .scdrop b{display:block;font-size:16px;color:#14307f}.scdrop span{color:#5b6684;font-size:13px}`;
  document.head.appendChild(css);

  function view(){
    if(!state.user||state.user.type!=='admin')return '<div class="panel"><p class="note">Only an administrator can convert statements.</p></div>';
    const U=window.VIRTUOSO_UI;
    const hero=U?U.hero({title:'Statement conversion',sub:'Turn PDF and scanned bank statements into an Excel file in the Zoho Books layout.',icon:'form',gold:10}):'<h2>Statement conversion</h2>';
    return `${hero}<div class="stack">
      <div class="panel"><div class="ph"><h3>Convert a statement</h3></div>
        <div class="scopt">
          <label>Reference prefix<input id="scPrefix" value="${esc(S.opt.prefix)}" maxlength="10" aria-label="Reference prefix"><small class="note">Gives BS03/001, BS03/002 &hellip; (month of the line)</small></label>
          <label>Year when the statement shows none<input id="scYear" value="${esc(S.opt.year)}" maxlength="4" inputmode="numeric" placeholder="auto"></label>
          <label>Opening balance (only if not printed)<input id="scOpen" value="${esc(S.opt.open)}" inputmode="decimal" placeholder="auto"></label>
          <label class="row" style="gap:8px;align-items:center"><input type="checkbox" id="scTidy" ${S.opt.tidy?'checked':''}> Tidy descriptions (Title Case, as in the sample)</label>
        </div>
        <div class="scdrop" id="scDropZone" tabindex="0" role="button" aria-label="Choose statements"><b>Drop statements here, or click to choose</b><span>PDF, scanned PDF, JPG or PNG. Select as many as you like.</span></div>
        <input type="file" id="scFile" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" hidden>
        <p class="note" style="margin:10px 0 0">Output columns: Date, Description, Reference, Debit (money out), Credit (money in), Balance. The file is read in this browser and is not stored or sent anywhere. Always check the marked lines and the balance check before importing into Zoho Books.</p>
      </div>
      ${S.files.map((f,i)=>cardHTML(f,i)).join('')}
    </div>`;
  }

  async function run(f){
    const O=window.VIRTUOSO_OCR;
    if(!O||!O.readFileWords){f.status='error';f.msg='Reading is not available.';return render()}
    f.status='run';f.msg='Opening the file…';f.pct=0;render();
    try{
      const x=await O.readFileWords(f.file,{rotate:0,progress:(m,p)=>{f.msg=m;f.pct=p||0;const b=document.querySelector('.scc[data-f="'+f.id+'"] .scbar i');if(b)b.style.width=Math.round((p||0)*100)+'%';const t=document.querySelector('.scc[data-f="'+f.id+'"] .note');if(t)t.textContent=m}});
      let res=parse(x.pages,{year:+S.opt.year||0,openingBalance:S.opt.open});
      if(!res.rows.length&&x.mode==='ocr'){ /* try the page turned, in case the scan is sideways */
        for(const rot of [90,270,180]){f.msg='Trying the page turned '+rot+'°…';render();const y=await O.readFileWords(f.file,{rotate:rot,progress:()=>{}});const r2_=parse(y.pages,{year:+S.opt.year||0,openingBalance:S.opt.open});if(r2_.rows.length){res=r2_;x.mode='ocr';break}}
      }
      f.rows=res.rows;f.openBal=res.openBal;f.closeBal=res.closeBal;f.openType='';f.closeType='';f.pages=x.pages.length;f.mode=x.mode;f.status='done';f.msg='';f.raw=x.pages;
    }catch(e){console.error(e);f.status='error';f.msg='This file could not be read: '+(e&&e.message||'error')}
    render();
  }
  function addFiles(list){
    for(const file of list){
      const okType=/\.(pdf|png|jpe?g)$/i.test(file.name)||/^(application\/pdf|image\/(png|jpeg))$/.test(file.type);
      const f={id:++S.seq,name:file.name,file,status:'wait',msg:'Waiting…'};
      if(!okType){f.status='error';f.msg='Use a PDF, JPG or PNG file.'}
      else if(file.size>25*1024*1024){f.status='error';f.msg='The file is larger than 25 MB.'}
      S.files.push(f);
    }
    render();
    (async()=>{if(S.busy)return;S.busy=true;for(const f of S.files.filter(x=>x.status==='wait'))await run(f);S.busy=false})();
  }
  const num=v=>{v=String(v).replace(/[, ]/g,'').trim();if(v==='')return null;const n=parseFloat(v);return isNaN(n)?null:r2(Math.abs(n))};
  function edit(i,k,field,val){
    const f=S.files[i],r=f&&f.rows[k];if(!r)return;
    if(field==='date'){const m=/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(val.trim());if(m&&validDate(+m[3],+m[2],+m[1])){r.iso=m[3]+'-'+pad(+m[2])+'-'+pad(+m[1]);r.flags=(r.flags||[]).filter(x=>x!=='Date not read')}else{r.flags=(r.flags||[]).filter(x=>x!=='Date not read');r.flags.push('Date not read');r.iso=null}}
    else if(field==='desc'){r.desc=val;r.tidyDone=true}
    else if(field==='ref'){r.refOverride=val}
    else if(field==='debit'){const n=num(val);if(n!=null){r.amt=n;r.dir='debit'}else if(r.dir==='debit')r.amt=null;r.flags=[];r.sugg=null}
    else if(field==='credit'){const n=num(val);if(n!=null){r.amt=n;r.dir='credit'}else if(r.dir==='credit')r.amt=null;r.flags=[];r.sugg=null}
    else if(field==='balance'){const raw=String(val).replace(/[, ]/g,'').trim();r.bal=raw===''?null:parseFloat(raw);if(isNaN(r.bal))r.bal=null;r.flags=[];r.sugg=null}
    render();
  }
  const sheetRowsPage=sheetRows;
  window.VIRTUOSO_STMT={parse,buildXlsx,buildCsv,toSheetRows,tidy,_sheet:()=>S.files.filter(f=>f.status==="done").map(sheetRows),_files:()=>S.files.map(f=>({s:f.status,m:f.msg}))};

  VIEWS.stmt=view;
  if(typeof ICON!=='undefined')ICON.stmt='<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 15.500h7M9 18.500h4"/>';
  const money_=NAV.adm.find(g=>g[0]==='Money');
  if(money_&&!money_[1].some(x=>x[0]==='stmt'))money_[1].push(['stmt','Statement conversion']);

  document.addEventListener('click',e=>{
    const z=e.target.closest&&e.target.closest('#scDropZone');
    if(z){e.stopImmediatePropagation();const i=document.getElementById('scFile');if(i)i.click();return}
    const b=e.target.closest&&e.target.closest('[data-act^="sc"]');if(!b)return;
    e.stopImmediatePropagation();
    const a=b.dataset.act,i=+b.dataset.i,f=S.files[i];
    if(a==='scDrop'){S.files.splice(i,1);return render()}
    if(a==='scDel'){f.rows.splice(+b.dataset.k,1);return render()}
    if(a==='scUse'){const r=f.rows[+b.dataset.k];if(r&&r.sugg){r.amt=r.sugg.amt;r.dir=r.sugg.dir;r.sugg=null;r.flags=['Amount taken from the balance by you'];}return render()}
    if(a==='scAdd'){f.rows.push({iso:null,date:{},desc:'',amt:null,bal:null,dir:null,flags:['New line'],raw:''});return render()}
    if(a==='scXlsx'){if(!f||!f.rows)return;buildXlsx(sheetRowsPage(f)).then(bl=>save(bl,baseName(f.name)+'.xlsx')).catch(x=>toast('Could not create the Excel file: '+(x.message||'error')));return}
    if(a==='scCsv'){if(!f||!f.rows)return;save(buildCsv(sheetRowsPage(f)),baseName(f.name)+'.csv');return}
  },true);
  document.addEventListener('change',e=>{
    const t=e.target;if(!t)return;
    if(t.id==='scFile'){e.stopImmediatePropagation();const fs=[...t.files];t.value='';if(fs.length)addFiles(fs);return}
    if(t.id==='scPrefix'){S.opt.prefix=t.value.replace(/[^A-Za-z0-9\-_]/g,'').slice(0,10);return render()}
    if(t.id==='scYear'){S.opt.year=t.value.replace(/\D/g,'').slice(0,4);return}
    if(t.dataset&&t.dataset.scb){const f=S.files[+t.dataset.i];if(f){f[t.dataset.scb==='open'?'openType':'closeType']=t.value;e.stopImmediatePropagation();render()}return}
    if(t.id==='scOpen'){S.opt.open=t.value;return}
    if(t.id==='scTidy'){S.opt.tidy=t.checked;return render()}
    if(t.dataset&&t.dataset.sc){e.stopImmediatePropagation();edit(+t.dataset.i,+t.dataset.k,t.dataset.sc,t.value)}
  },true);
  ['dragover','dragleave','drop'].forEach(ev=>document.addEventListener(ev,e=>{
    const z=e.target.closest&&e.target.closest('#scDropZone');if(!z)return;
    e.preventDefault();
    if(ev==='dragover')z.classList.add('over');else z.classList.remove('over');
    if(ev==='drop'&&e.dataTransfer&&e.dataTransfer.files.length)addFiles([...e.dataTransfer.files]);
  }));
})();
