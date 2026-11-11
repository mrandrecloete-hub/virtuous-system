/* OCR for the petty cash sheet and receipts. Runs entirely in the browser (nothing is uploaded):
   - PDFs with a text layer are read directly (exact, no guessing); scanned PDFs and photos are recognised with Tesseract (LSTM).
   - The reader finds the header row (Date, Description, Vendor, Amount), reads each row, fixes common OCR slips in numbers and dates,
     joins wrapped descriptions, and checks the lines against a "Total" row on the sheet when there is one.
   - A review screen shows every line (editable, low-confidence cells highlighted) before anything is added to the sheet.
   Libraries (vendor/ocr, vendor/pdfjs) are only downloaded when OCR is used. window.VIRTUOSO_OCR = { sheet, receipt, parseWords, parseMoney, parseDate }. */
(function(){
  const BASE=new URL('vendor/',document.baseURI).href;
  const scripts={};
  const loadScript=src=>scripts[src]||(scripts[src]=new Promise((ok,bad)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>bad(new Error('Could not load '+src));document.head.appendChild(s)}));
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad=n=>String(n).padStart(2,'0');

  /* ---------- numbers and dates ---------- */
  const MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
  function parseMoney(raw){
    let t=String(raw==null?'':raw).trim();if(!t)return null;
    t=t.replace(/\b(N\$|NAD|N\s?\$|USD|ZAR|R|\$)\s*/ig,'').replace(/[$]/g,'').trim();
    if(!/\d/.test(t))return null;
    const sym=(t.match(/[0-9]/g)||[]).length;if(sym<Math.ceil(t.replace(/\s/g,'').length*.5))return null;
    t=t.replace(/(?<=\d)[Oo](?=[\d.,\s]|$)|(?<=^|[\s.,])[Oo](?=\d)/g,'0').replace(/(?<=\d)[lI|](?=[\d.,\s]|$)|(?<=^|[\s.,])[lI|](?=\d)/g,'1').replace(/(?<=\d)S(?=[\d.,\s]|$)/g,'5');
    t=t.replace(/[^0-9.,\s-]/g,'').trim();
    t=t.replace(/(?<=\d)\s+(?=\d{3}\b)/g,'');            /* 1 245.75 -> 1245.75 */
    t=t.replace(/\s+/g,'');
    if(/^-?\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(t))t=t.replace(/,/g,'');
    else if(/^-?\d+,\d{1,2}$/.test(t))t=t.replace(',','.');
    else if(/^-?\d{1,3}(\.\d{3})+,\d{1,2}$/.test(t))t=t.replace(/\./g,'').replace(',','.');
    else t=t.replace(/,/g,'');
    if(!/^-?\d{1,9}(\.\d{1,2})?$/.test(t))return null;
    const n=parseFloat(t);return isFinite(n)?Math.round(n*100)/100:null;
  }
  function fyYear(month,ctxMonth){ /* ctxMonth 'YYYY-MM'; financial year March to February */
    const cy=+ctxMonth.slice(0,4),cm=+ctxMonth.slice(5,7),fyStart=cm>=3?cy:cy-1;
    return month>=3?fyStart:fyStart+1;
  }
  function parseDate(raw,ctx){
    let t=String(raw==null?'':raw).trim().toLowerCase();if(!t)return null;
    const cm=(ctx&&ctx.month)||null,dim=(y,m)=>new Date(y,m,0).getDate();
    t=t.replace(/(?<=\d)[o](?=\d|\s|$)|(?<=^|[\s/.-])[o](?=\d)/g,'0').replace(/(?<=\d)[l|i](?=\d)/g,'1').replace(/,/g,' ').replace(/\s+/g,' ');
    const ok=(y,m,d)=>{if(m<1||m>12||d<1||d>dim(y,m))return null;return y+'-'+pad(m)+'-'+pad(d)};
    const yy=x=>{x=+x;return x<100?2000+x:x};
    let m;
    if(m=/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(t))return ok(+m[1],+m[2],+m[3]);
    if(m=/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})/.exec(t))return ok(yy(m[3]),+m[2],+m[1]);
    if(m=/^(\d{1,2})(?:st|nd|rd|th)?[-/. ]*([a-z]{3,9})\.?(?:[-/. ]*(\d{2,4}))?/.exec(t)){const mo=MONTHS[m[2].slice(0,4)]||MONTHS[m[2].slice(0,3)];if(mo){const y=m[3]?yy(m[3]):(cm?fyYear(mo,cm):new Date().getFullYear());return ok(y,mo,+m[1])}}
    if(m=/^([a-z]{3,9})\.?[-/. ]*(\d{1,2})(?:st|nd|rd|th)?(?:[-/. ]*(\d{2,4}))?/.exec(t)){const mo=MONTHS[m[1].slice(0,4)]||MONTHS[m[1].slice(0,3)];if(mo){const y=m[3]?yy(m[3]):(cm?fyYear(mo,cm):new Date().getFullYear());return ok(y,mo,+m[2])}}
    if(m=/^(\d{1,2})[-/.](\d{1,2})$/.exec(t)){const mo=+m[2];const y=cm?fyYear(mo,cm):new Date().getFullYear();return ok(y,mo,+m[1])}
    if(cm&&(m=/^(\d{1,2})$/.exec(t)))return ok(+cm.slice(0,4),+cm.slice(5,7),+m[1]);
    return null;
  }
  const DATE_HEAD=/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/. ]\d{1,2}[-/. ]\d{2,4}|\d{1,2}(?:st|nd|rd|th)?[-/. ]*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:[-/. ,]*\d{2,4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[-/. ]*\d{1,2}(?:st|nd|rd|th)?(?:,?[-/. ]*\d{4})?|\d{1,2}[-/.]\d{1,2})(?=\s|$)/i;

  /* ---------- words -> rows -> cells ---------- */
  const median=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:0};
  function toRows(words){
    words=words.filter(w=>String(w.t).trim());if(!words.length)return {rows:[],H:12};
    const H=median(words.map(w=>w.y1-w.y0))||12;
    const sorted=words.slice().sort((a,b)=>(a.y0+a.y1)-(b.y0+b.y1));
    const rows=[];
    if(sorted.every(w=>w.ln!=null)){ /* the recogniser already grouped words into lines along the baseline, which survives a slightly crooked scan */
      const by=new Map();for(const w of sorted){if(!by.has(w.ln))by.set(w.ln,{w:[],yc:0});by.get(w.ln).w.push(w)}
      for(const r of by.values()){r.yc=r.w.reduce((a,w)=>a+(w.y0+w.y1)/2,0)/r.w.length;rows.push(r)}
      rows.sort((a,b)=>a.yc-b.yc);
    }else for(const w of sorted){
      const yc=(w.y0+w.y1)/2,r=rows[rows.length-1];
      if(r&&Math.abs(yc-r.yc)<=Math.max(H*.55,(w.y1-w.y0)*.45)){r.w.push(w);r.yc=(r.yc*(r.w.length-1)+yc)/r.w.length}
      else rows.push({w:[w],yc});
    }
    rows.forEach(r=>{
      r.w.sort((a,b)=>a.x0-b.x0);
      const cells=[];
      for(const w of r.w){
        const c=cells[cells.length-1];
        if(c&&w.x0-c.x1<H*1.15){c.t+=' '+w.t;c.x1=Math.max(c.x1,w.x1);c.c=Math.min(c.c,w.c==null?100:w.c)}
        else cells.push({t:w.t,x0:w.x0,x1:w.x1,c:w.c==null?100:w.c});
      }
      r.cells=cells;r.y0=Math.min(...r.w.map(w=>w.y0));r.y1=Math.max(...r.w.map(w=>w.y1));
      r.text=cells.map(c=>c.t).join(' ');
    });
    return {rows,H};
  }
  const KEYS={date:/^(date|dated|day)\b/i,desc:/(description|details?|particulars|item|purpose|narration|expense|reference)/i,vendor:/(vendor|supplier|payee|shop|store|paid to|merchant|spent at)/i,amount:/(amount|amt|total|value|cost|debit|paid|n\$|nad)/i};
  function findHeader(rows){
    for(let i=0;i<Math.min(rows.length,25);i++){
      const found={};
      rows[i].cells.forEach(c=>{for(const k of Object.keys(KEYS)){if(!found[k]&&KEYS[k].test(c.t.trim()))found[k]=c}});
      if(found.date&&found.amount||Object.keys(found).length>=3)return {i,cols:found};
    }
    return null;
  }

  /* Turn recognised words (from one or more pages) into sheet lines. ctx = {month:'YYYY-MM'} */
  function parseWords(pages,ctx){
    const lines=[],notes=[],totals=[];let headerSeen=false,scanned=0;
    for(const words of pages){
      const {rows,H}=toRows(words);scanned+=rows.length;
      const hd=findHeader(rows),cols=hd?hd.cols:null;if(hd)headerSeen=true;
      let prev=null,prevY=0;
      for(let i=hd?hd.i+1:0;i<rows.length;i++){
        const r=rows[i];if(!r.cells.length)continue;
        const joined=r.text.trim();
        const isTotal=/^(grand\s+)?total\b|^balance\b|^sub-?total\b/i.test(joined)||r.cells.some(c=>/^(grand\s+)?total\b/i.test(c.t.trim()));
        /* classify cells */
        let dateCell=null,dateIso=null,restCells=[];
        for(const c of r.cells){
          if(!dateCell&&!isTotal){
            const m=DATE_HEAD.exec(c.t.trim());
            if(m){const iso=parseDate(m[1],ctx);if(iso){dateCell=c;dateIso=iso;const rest=c.t.trim().slice(m[0].length).trim();if(rest)restCells.push({...c,t:rest,x0:c.x0+Math.max(0,(c.x1-c.x0)*(m[0].length/c.t.length))});continue}}
          }
          restCells.push(c);
        }
        const money=[];restCells.forEach((c,idx)=>{const v=parseMoney(c.t);if(v!=null&&/\d/.test(c.t)&&(c.t.replace(/[^0-9]/g,'').length>=1)&&!/[a-z]{3,}/i.test(c.t.replace(/N\$|NAD/ig,'')))money.push({c,v,idx})});
        if(isTotal){const m=money.sort((a,b)=>b.c.x1-a.c.x1)[0];if(m)totals.push(m.v);prev=null;continue}
        let amt=null,amtIdx=-1;
        if(money.length){
          let pick=money[0];
          if(cols&&cols.amount){const ac=(cols.amount.x0+cols.amount.x1)/2;pick=money.slice().sort((a,b)=>Math.abs((a.c.x0+a.c.x1)/2-ac)-Math.abs((b.c.x0+b.c.x1)/2-ac))[0];
            /* right-aligned amounts sit left of the header's centre: prefer the right-most number when it is closer to the right edge */
            const right=money.slice().sort((a,b)=>b.c.x1-a.c.x1)[0];if(Math.abs(right.c.x1-cols.amount.x1)<Math.abs(pick.c.x1-cols.amount.x1))pick=right}
          else pick=money.slice().sort((a,b)=>b.c.x1-a.c.x1)[0];
          amt=pick.v;amtIdx=pick.idx;
        }
        const text=restCells.filter((c,idx)=>idx!==amtIdx&&!(money.some(m=>m.idx===idx)&&amt!=null&&idx===amtIdx));
        const textCells=restCells.filter((c,idx)=>idx!==amtIdx).filter(c=>/[a-z]/i.test(c.t)&&c.t.replace(/[^a-z0-9]/gi,'').length>=3&&(c.c==null||c.c>=35||c.t.length>=8));
        let desc='',vendor='',conf=100;
        const used=[];
        if(cols&&cols.vendor&&cols.desc){
          for(const c of textCells){
            const dd=Math.abs(c.x0-cols.desc.x0),dv=Math.abs(c.x0-cols.vendor.x0);
            if(dv<dd&&c.x0>=cols.vendor.x0-H*2){vendor+=(vendor?' ':'')+c.t}else{desc+=(desc?' ':'')+c.t}
            conf=Math.min(conf,c.c);used.push(c);
          }
        }else{
          textCells.forEach((c,k)=>{if(k===0)desc=c.t;else if(k===1&&!cols)vendor=c.t;else desc+=' '+c.t;conf=Math.min(conf,c.c);used.push(c)});
          if(cols&&cols.vendor&&!cols.desc){vendor=desc;desc=''}
        }
        if(dateCell)conf=Math.min(conf,dateCell.c);
        if(amtIdx>=0)conf=Math.min(conf,restCells[amtIdx].c);
        const vertGap=r.y0-prevY;
        if(!dateIso&&amt==null&&textCells.length&&prev&&vertGap<H*2.4){ /* wrapped description */
          prev.desc=(prev.desc+' '+(desc||vendor)).trim();prevY=r.y1;continue;
        }
        if(dateIso&&amt==null&&!textCells.length)continue;
        if(!dateIso&&amt==null)continue;
        if(amt==null)continue;
        const flags=[];
        if(!dateIso){flags.push('Date not read');dateIso=prev?prev.date:''}
        if(conf<75)flags.push('Check this line (low confidence)');
        const line={date:dateIso,desc:desc.trim(),vendor:vendor.trim(),amt,conf:Math.round(conf),flags};
        if(!line.vendor&&line.desc){const p=line.desc.split(/\s[-–—]\s/);if(p.length>1){line.vendor=p[p.length-1];line.desc=p.slice(0,-1).join(' - ')}}
        lines.push(line);prev=line;prevY=r.y1;
      }
    }
    return {lines,totals,headerSeen,rowsScanned:scanned};
  }

  /* ---------- reading files ---------- */
  async function pdfDoc(file){
    await loadScript(BASE+'pdfjs/pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc=BASE+'pdfjs/pdf.worker.min.js';
    return pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  }
  async function pdfTextWords(page){
    const vp=page.getViewport({scale:1}),tc=await page.getTextContent(),words=[];
    for(const it of tc.items){
      const s=(it.str||'');if(!s.trim())continue;
      const tr=it.transform,h=Math.abs(it.height)||Math.hypot(tr[2],tr[3])||10,y1=vp.height-tr[5];
      words.push({t:s.trim(),x0:tr[4],x1:tr[4]+(it.width||s.length*h*.5),y0:y1-h,y1,c:100});
    }
    return words;
  }
  /* Estimate the skew of a scanned page (degrees) by finding the angle at which the dark pixels line up in the sharpest horizontal rows. */
  function skewAngle(cv){
    const sc=Math.min(1,720/cv.width),w=Math.max(8,Math.round(cv.width*sc)),h=Math.max(8,Math.round(cv.height*sc));
    const t=document.createElement('canvas');t.width=w;t.height=h;const cx=t.getContext('2d',{willReadFrequently:true});cx.drawImage(cv,0,0,w,h);
    const d=cx.getImageData(0,0,w,h).data,pts=[];let sum=0;for(let i=0;i<d.length;i+=4)sum+=d[i];const mean=sum/(w*h);
    for(let y=0,p=0;y<h;y++)for(let x=0;x<w;x++,p+=4)if(d[p]<mean*.72)pts.push(x,y);
    if(pts.length<400)return 0;
    const step=pts.length>120000?Math.ceil(pts.length/120000):1,score=a=>{const th=a*Math.PI/180,c=Math.cos(th),sn=Math.sin(th),bins=new Float32Array(h*2+4);
      for(let i=0;i<pts.length;i+=2*step){const y=pts[i+1]*c-pts[i]*sn+h;const b=y|0;if(b>=0&&b<bins.length)bins[b]++}
      let q=0;for(let i=0;i<bins.length;i++)q+=bins[i]*bins[i];return q};
    let best=0,bs=-1;for(let a=-4;a<=4.001;a+=.25){const q=score(a);if(q>bs){bs=q;best=a}}
    for(let a=best-.25;a<=best+.2501;a+=.05){const q=score(a);if(q>bs){bs=q;best=a}}
    return Math.abs(best)<.12?0:best;
  }
  /* Draw to a canvas, rotate, grayscale, stretch contrast, binarise (Otsu) and wipe table lines so the recogniser sees clean text. */
  function prepare(src,sw,sh,rot,targetW){
    const r=((rot||0)%360+360)%360,w0=r%180?sh:sw,h0=r%180?sw:sh;
    const k=Math.min(window.__OCR_KMAX||2.2,Math.max(.5,targetW/w0)),W=Math.round(w0*k),H=Math.round(h0*k);
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;const cx=cv.getContext('2d',{willReadFrequently:true});
    cx.fillStyle='#fff';cx.fillRect(0,0,W,H);cx.save();cx.translate(W/2,H/2);cx.rotate(r*Math.PI/180);
    const dw=r%180?H:W,dh=r%180?W:H;cx.drawImage(src,-dw/2,-dh/2,dw,dh);cx.restore();
    const sk=skewAngle(cv);
    if(sk){const c2=document.createElement('canvas');c2.width=W;c2.height=H;const x2=c2.getContext('2d');x2.fillStyle='#fff';x2.fillRect(0,0,W,H);x2.translate(W/2,H/2);x2.rotate(-sk*Math.PI/180);x2.drawImage(cv,-W/2,-H/2);cv.getContext('2d').drawImage(c2,0,0)}
    const im=cx.getImageData(0,0,W,H),d=im.data,g=new Uint8Array(W*H),hist=new Uint32Array(256);
    for(let i=0,p=0;i<d.length;i+=4,p++){const v=(d[i]*.299+d[i+1]*.587+d[i+2]*.114)|0;g[p]=v;hist[v]++}
    const tot=W*H;let acc=0,lo=0,hi=255;for(let v=0;v<256;v++){acc+=hist[v];if(acc>=tot*.01){lo=v;break}}acc=0;for(let v=255;v>=0;v--){acc+=hist[v];if(acc>=tot*.01){hi=v;break}}
    const span=Math.max(40,hi-lo);const h2=new Uint32Array(256);
    for(let p=0;p<g.length;p++){let v=((g[p]-lo)*255/span);v=v<0?0:v>255?255:v|0;g[p]=v;h2[v]++}
    let sum=0;for(let v=0;v<256;v++)sum+=v*h2[v];let sB=0,wB=0,best=0,thr=128;
    for(let v=0;v<256;v++){wB+=h2[v];if(!wB)continue;const wF=tot-wB;if(!wF)break;sB+=v*h2[v];const mB=sB/wB,mF=(sum-sB)/wF,bt=wB*wF*(mB-mF)*(mB-mF);if(bt>best){best=bt;thr=v}}
    const bin=new Uint8Array(W*H);for(let p=0;p<g.length;p++)bin[p]=g[p]>thr?255:0;
    /* wipe long horizontal and vertical dark runs (table rules) */
    const minRun=Math.round(Math.max(W,H)*.045),tol=Math.max(3,Math.round(Math.max(W,H)/380));
    const wipe=(len,at,idx)=>{ /* scan a line of pixels; bridge small gaps so broken rules are caught; clear runs that are long enough */
      let s=-1,e=-1,gap=0;
      for(let k=0;k<=len;k++){
        const dark=k<len&&bin[at(k)]===0;
        if(dark){if(s<0)s=k;e=k;gap=0}
        else if(s>=0){gap++;if(gap>tol||k===len){if(e-s+1>=minRun)for(let q=s;q<=e;q++)bin[at(q)]=255;s=-1;gap=0}}
      }
    };
    for(let y=0;y<H;y++)wipe(W,x=>y*W+x);
    for(let x=0;x<W;x++)wipe(H,y=>y*W+x);
    /* rules that are dashed or faded: a row (or column) that is mostly dark across the page is a rule, not text */
    {const rc=new Uint32Array(H),cc=new Uint32Array(W);
     for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(bin[y*W+x]===0){rc[y]++;cc[x]++}
     for(let y=0;y<H;y++)if(rc[y]>W*.3)for(let x=0;x<W;x++)bin[y*W+x]=255;
     for(let x=0;x<W;x++)if(cc[x]>H*.25)for(let y=0;y<H;y++)bin[y*W+x]=255}
    for(let p=0,i=0;p<bin.length;p++,i+=4){d[i]=d[i+1]=d[i+2]=bin[p];d[i+3]=255}
    cx.putImageData(im,0,0);return cv;
  }
  let worker=null,wLoading=null,onProg=null;
  async function getWorker(){
    if(worker)return worker;if(wLoading)return wLoading;
    wLoading=(async()=>{
      await loadScript(BASE+'ocr/tesseract.min.js');
      const w=await Tesseract.createWorker('eng',1,{workerPath:BASE+'ocr/worker.min.js',corePath:BASE+'ocr/',langPath:BASE+'ocr/',gzip:true,workerBlobURL:true,
        logger:m=>{if(onProg&&m&&typeof m.progress==='number')onProg(m.status,m.progress)}});
      await w.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1',user_defined_dpi:'300'});
      worker=w;return w;
    })();
    return wLoading;
  }
  /* Second look at every number: crop each numeric word, enlarge it and read it again with only digits, separators and Cr/Dr allowed.
     Numbers are what matters most on a statement, and a single-word, digits-only read is far more reliable than the page-wide read.
     When the two reads differ the new one is used and the word is marked (w.fx) so the line is flagged for review. */
  const NUMLIKE=t=>{t=String(t).trim();if(!/\d/.test(t)||/[\/]/.test(t)||/[A-Za-z]{3,}/.test(t))return false;return t.replace(/[^\d]/g,'').length/t.length>=.5};
  const STRICT=/^[-(+]?\d{1,3}(?:[, ]\d{3})*[.,]\d{2}\)?-?(?:cr|dr)?$|^[-(+]?\d+[.,]\d{2}\)?-?(?:cr|dr)?$/i;
  async function refineNumbers(w,cv,words){
    const cx=cv.getContext('2d',{willReadFrequently:true});let changed=0;
    try{
      await w.setParameters({tessedit_pageseg_mode:'8',tessedit_char_whitelist:'0123456789.,-CcRrDd'});
      for(const x of words){
        if(!NUMLIKE(x.t))continue;
        const pad=3,x0=Math.max(0,Math.floor(x.x0)-pad),y0=Math.max(0,Math.floor(x.y0)-pad),ww=Math.min(cv.width-x0,Math.ceil(x.x1-x.x0)+pad*2),hh=Math.min(cv.height-y0,Math.ceil(x.y1-x.y0)+pad*2);
        if(ww<8||hh<8)continue;
        const k=Math.min(4,Math.max(1,64/hh)),c=document.createElement('canvas');c.width=Math.round(ww*k)+24;c.height=Math.round(hh*k)+24;
        const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.imageSmoothingEnabled=true;g.drawImage(cv,x0,y0,ww,hh,12,12,Math.round(ww*k),Math.round(hh*k));
        const r=await w.recognize(c),t=String(r.data.text||'').replace(/\s+/g,'').trim();
        if(!t||!STRICT.test(t))continue;
        const old=String(x.t).replace(/\s+/g,'');
        /* a digits-only read turns stray vertical marks (table rules, specks) into a "1": never let the re-read ADD digits to a number that already looked right */
        const dg=v=>String(v).replace(/[^0-9]/g,'').length;
        if(STRICT.test(old)&&dg(t)>dg(old))continue;
        if(t.toLowerCase()!==old.toLowerCase()){x.alt=x.t;x.t=t;x.fx=true;changed++}
      }
    }catch(e){console.warn('number re-read skipped',e)}
    try{await w.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:''})}catch(e){}
    return changed;
  }
  async function ocrCanvas(cv){
    const w=await getWorker(),res=await w.recognize(cv),data=res.data;
    let words=[];
    (data.lines||[]).forEach((l,li)=>(l.words||[]).forEach(x=>words.push({t:x.text,x0:x.bbox.x0,x1:x.bbox.x1,y0:x.bbox.y0,y1:x.bbox.y1,c:x.confidence,ln:li})));
    if(!words.length)words=(data.words||[]).map(x=>({t:x.text,x0:x.bbox.x0,x1:x.bbox.x1,y0:x.bbox.y0,y1:x.bbox.y1,c:x.confidence}));
    await refineNumbers(w,cv,words);
    return {words,text:data.text||''};
  }
  /* returns {pages:[words[]], text, mode} */
  async function readFileWords(file,o){
    const prog=(o&&o.progress)||(()=>{}),rot=(o&&o.rotate)||0,pages=[],texts=[],imgs=[];let mode='text';
    const isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
    if(isPdf){
      const doc=await pdfDoc(file),n=Math.min(doc.numPages,20);
      for(let p=1;p<=n;p++){
        prog('Reading page '+p+' of '+n,(p-1)/n);
        const page=await doc.getPage(p);let words=rot?[]:await pdfTextWords(page);
        if(words.reduce((s,w)=>s+w.t.length,0)>=40){pages.push(words);texts.push(words.map(w=>w.t).join(' '));continue}
        mode='ocr';
        const vp1=page.getViewport({scale:1}),scale=Math.min(window.__OCR_KMAX||4,(window.__OCR_W||2600)/Math.max(vp1.width,1)),vp=page.getViewport({scale}),cv=document.createElement('canvas');
        cv.width=Math.round(vp.width);cv.height=Math.round(vp.height);await page.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
        const pc=prepare(cv,cv.width,cv.height,rot,window.__OCR_W||2600);
        onProg=(st,f)=>prog('Recognising text on page '+p+' of '+n+' ('+Math.round(f*100)+'%)',(p-1+f)/n);
        const r=await ocrCanvas(pc);pages.push(r.words);texts.push(r.text);try{imgs[p-1]=pc.toDataURL('image/jpeg',.8)}catch(e){}
      }
    }else{
      mode='ocr';prog('Opening the image',0);
      const bmp=await new Promise((ok,bad)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{ok(im);setTimeout(()=>URL.revokeObjectURL(u),2000)};im.onerror=()=>bad(new Error('That image could not be opened.'));im.src=u});
      const pc=prepare(bmp,bmp.naturalWidth,bmp.naturalHeight,rot,2400);
      onProg=(st,f)=>prog('Recognising text ('+Math.round(f*100)+'%)',f);
      const r=await ocrCanvas(pc);pages.push(r.words);texts.push(r.text);try{imgs[0]=pc.toDataURL('image/jpeg',.8)}catch(e){}
    }
    onProg=null;
    return {pages,imgs,text:texts.join('\n\n'),mode};
  }

  /* ---------- screens ---------- */
  const css=document.createElement('style');
  css.textContent=`#ocrOv{position:fixed;inset:0;z-index:120;background:rgba(5,15,60,.66);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px}
  #ocrBox{background:var(--surface,#fff);color:var(--fg,#14213d);width:min(1100px,100%);border-radius:18px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.45)}
  #ocrBox .oh{display:flex;align-items:center;gap:12px;background:linear-gradient(180deg,#0a2a7a,#051a56);color:#fff;padding:14px 20px;border-bottom:3px solid #e8a600;font-weight:800;font-size:19px}
  #ocrBox .oh .x{margin-left:auto;background:transparent;border:0;color:#fff;font-size:24px;cursor:pointer}
  #ocrBox .ob{padding:16px 20px}
  .ocbar{height:12px;border-radius:99px;background:#dfe8fb;overflow:hidden;margin:12px 0}.ocbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#2f6fe4,#1646c0);transition:width .2s}
  .ocsum{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 12px}.ocsum span{background:#eef4ff;border:1px solid #c6d8fb;border-radius:12px;padding:8px 12px;font-weight:700;color:#0a2a7a}
  .ocsum span.ok{background:#e1f6ea;border-color:#9fdcb8;color:#16783f}.ocsum span.bad{background:#fff0d6;border-color:#f3cf7a;color:#8a5a00}
  table.oct{width:100%;border-collapse:collapse;font-size:14px}table.oct th{background:#0a2a7a;color:#fff;text-align:left;padding:9px 8px;white-space:nowrap}
  table.oct td{padding:5px 6px;border-bottom:1px solid #e3eafa;vertical-align:top}table.oct input[type=text],table.oct input[type=date],table.oct input[type=number]{width:100%;min-height:36px;border-radius:8px;padding:4px 8px}
  table.oct tr.lo td{background:#fff8e1}table.oct tr.off td{background:#fdecec}table.oct tr.skip td{opacity:.55}
  .ocnote{font-size:12px;color:#8a5a00}.ocnote.r{color:#b3261e}
  #ocrBox .of{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:14px 20px;border-top:1px solid #e3eafa;background:#f7faff}
  #ocrBox pre{white-space:pre-wrap;max-height:240px;overflow:auto;background:#f3f6fc;border-radius:8px;padding:10px;font-size:12px}`;
  document.head.appendChild(css);
  const ov=()=>document.getElementById('ocrOv');
  function shell(title,body,foot){
    let o=ov();if(!o){o=document.createElement('div');o.id='ocrOv';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');document.body.appendChild(o)}
    o.innerHTML=`<div id="ocrBox"><div class="oh"><span>${esc(title)}</span><button class="x" type="button" data-ocr="close" aria-label="Close">&times;</button></div><div class="ob">${body}</div>${foot?`<div class="of">${foot}</div>`:''}</div>`;
  }
  const close=()=>{const o=ov();if(o)o.remove()};
  function progressUI(title){shell(title,`<div id="ocrMsg">Getting ready…</div><div class="ocbar"><i id="ocrBar"></i></div><p class="note" style="margin:0">Everything is read on this device. The first time can take a minute while the reader loads.</p>`,`<button class="btn ghost" type="button" data-ocr="close">Cancel</button>`)}
  const setProg=(m,f)=>{const a=document.getElementById('ocrMsg'),b=document.getElementById('ocrBar');if(a)a.textContent=m;if(b)b.style.width=Math.max(2,Math.round((f||0)*100))+'%'};

  let SES=null;
  const NADf=n=>typeof NAD==='function'?NAD(n):'N$ '+(+n).toFixed(2);
  function reviewUI(){
    const S=SES,m=state.month,ml=typeof monthLabel==='function'?monthLabel(m):m,L=S.lines;
    const sumOn=()=>L.filter(x=>x.on).reduce((s,x)=>s+(+x.amt||0),0);
    let tot=S.totals.length?S.totals[S.totals.length-1]:null;const all=L.reduce((s,x)=>s+(+x.amt||0),0);
    let decNote='';if(tot!=null&&all>0&&Math.abs(tot-all*100)<1.5){tot=all;decNote=' (its decimal point was not read)'}
    const match=tot!=null?Math.abs(all-tot)<.015:null;
    const rows=L.map((x,i)=>{const off=x.date&&x.date.slice(0,7)!==m,cls=!x.on?'skip':off?'off':(x.conf<75||x.flags.length)?'lo':'';
      return `<tr class="${cls}"><td><input type="checkbox" data-ocr="on" data-i="${i}" ${x.on?'checked':''} aria-label="Include line ${i+1}"></td><td style="min-width:150px"><input type="date" data-ocr="date" data-i="${i}" value="${esc(x.date)}"></td><td style="min-width:200px"><input type="text" data-ocr="desc" data-i="${i}" value="${esc(x.desc)}"></td><td style="min-width:150px"><input type="text" data-ocr="vendor" data-i="${i}" value="${esc(x.vendor)}"></td><td style="min-width:110px"><input type="number" step="0.01" min="0" data-ocr="amt" data-i="${i}" value="${esc(x.amt)}"></td>
        <td>${off?`<span class="ocnote r">Not in ${esc(ml)}</span>`:''}${x.flags.map(f=>`<div class="ocnote">${esc(f)}</div>`).join('')}</td></tr>`}).join('');
    shell('Check the lines read from '+S.name,
      `<div class="ocsum"><span>${L.length} line${L.length===1?'':'s'} found</span><span id="ocrSel">${L.filter(x=>x.on).length} selected, ${NADf(sumOn())}</span>
        ${tot!=null?`<span class="${match?'ok':'bad'}">${match?'Matches the total on the sheet ('+NADf(tot)+')'+decNote:'Sheet total '+NADf(tot)+' differs from the lines read ('+NADf(all)+'). Check the highlighted lines.'}</span>`:''}
        <span>${S.mode==='ocr'?'Scanned page, read with OCR':'Typed PDF, read exactly'}${S.headerSeen?'':' · no header row found'}</span></div>
      ${L.length?`<div class="tbl"><table class="oct"><thead><tr><th></th><th>Date</th><th>Description</th><th>Vendor</th><th>Amount</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table></div>`:`<p><b>No lines could be read.</b> ${S.mode==='ocr'?'Try the other rotations below, or a clearer scan. The sheet needs a Date and an Amount on each line.':'The PDF has text but no Date and Amount columns were found.'}</p>`}
      <p class="note">Yellow lines were hard to read, red lines are dated outside ${esc(ml)} (change the date to include them). Correct anything wrong before adding.</p>
      <details><summary>Show the text that was read</summary><pre>${esc(S.text.slice(0,6000))}</pre></details>`,
      `<button class="btn" type="button" data-ocr="add" ${L.some(x=>x.on)?'':'disabled'}>Add selected lines to the sheet</button>
       <label class="chk" style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" id="ocrReplace" ${S.replace?'checked':''}> Replace the lines already on the sheet</label>
       <span style="flex:1"></span>
       <label style="display:flex;gap:6px;align-items:center;margin:0">Page turned <select id="ocrRot">${[0,90,180,270].map(r=>`<option value="${r}" ${S.rotate===r?'selected':''}>${r}°</option>`).join('')}</select></label>
       <button class="btn ghost" type="button" data-ocr="again">Read again</button><button class="btn ghost" type="button" data-ocr="close">Cancel</button>`);
  }
  const score=p=>p.lines.filter(x=>x.date&&x.amt>0).length*100+p.lines.length;
  async function run(file,rotate){
    progressUI('Reading '+file.name);
    try{
      const auto=rotate==null;let rot=auto?0:rotate;
      let r=await readFileWords(file,{rotate:rot,progress:setProg});
      setProg('Finding the lines…',.97);
      let p=parseWords(r.pages,{month:state.month});
      if(auto&&r.mode==='ocr'&&p.lines.filter(x=>x.date).length<2){ /* maybe the page is turned: try the other ways up and keep the best */
        let best={sc:score(p),r,p,rot:0};
        for(const t of [180,90,270]){
          setProg('Trying the page turned '+t+'°…',.5);
          const r2=await readFileWords(file,{rotate:t,progress:(m,f)=>setProg('Trying the page turned '+t+'°… '+m.replace(/^Recognising text/,'reading'),.5+f*.4)});
          const p2=parseWords(r2.pages,{month:state.month}),sc=score(p2);
          if(sc>best.sc){best={sc,r:r2,p:p2,rot:t}}
          if(best.sc>=300)break;
        }
        r=best.r;p=best.p;rot=best.rot;
      }
      rotate=rot;
      SES={file,name:file.name,rotate:rotate||0,lines:p.lines.map(x=>({...x,on:!(x.date&&x.date.slice(0,7)!==state.month)&&!!x.date})),totals:p.totals,headerSeen:p.headerSeen,text:r.text,mode:r.mode,replace:false};
      reviewUI();
    }catch(e){console.error(e);shell('Could not read '+file.name,`<p class="err" role="alert">${esc(e&&e.message||'Something went wrong.')}</p><p class="note">Check your connection for the first load, then try again. A clear, upright scan or a typed PDF reads best.</p>`,`<button class="btn" type="button" data-ocr="close">Close</button>`)}
  }
  function addLines(){
    const S=SES,m=M();if(!S||!m)return;
    if(m.locked){toast('This month is locked');return}
    const pick=S.lines.filter(x=>x.on&&x.date&&x.date.slice(0,7)===state.month&&+x.amt>0);
    if(!pick.length){toast('Choose at least one line dated in '+monthLabel(state.month));return}
    if(S.replace){m.sheet=[];m.overrides={};m.links={}}
    let added=0,dup=0;
    for(const x of pick){
      const desc=(x.desc||x.vendor||'Petty cash').trim(),vendor=(x.vendor||x.desc||'').trim();
      if(m.sheet.some(l=>l.date===x.date&&Math.abs(l.amt-x.amt)<.005&&(l.desc===desc||l.vendor===vendor))){dup++;continue}
      m.sheet.push({id:uid(),date:x.date,amt:Math.round(+x.amt*100)/100,desc,vendor});added++;
    }
    m.sheet.sort((a,b)=>a.date.localeCompare(b.date));
    state.shMsg='OCR added '+added+' line'+(added===1?'':'s')+' from '+S.name+(dup?' ('+dup+' already on the sheet were skipped)':'')+'. Check them against the paper sheet.';
    if(typeof logA==='function')logA('Sheet read with OCR',S.name+': '+added+' lines');
    close();SES=null;render();
  }
  document.addEventListener('input',e=>{
    const t=e.target;if(!SES||!t.dataset||!t.dataset.ocr)return;const k=t.dataset.ocr,i=+t.dataset.i,x=SES.lines[i];
    if(k==='on'){x.on=t.checked}else if(k==='date'){x.date=t.value}else if(k==='amt'){x.amt=t.value}else if(k==='desc'){x.desc=t.value}else if(k==='vendor'){x.vendor=t.value}else return;
    e.stopImmediatePropagation();
    const s=document.getElementById('ocrSel');if(s)s.textContent=SES.lines.filter(y=>y.on).length+' selected, '+NADf(SES.lines.filter(y=>y.on).reduce((a,y)=>a+(+y.amt||0),0));
    const b=document.querySelector('[data-ocr="add"]');if(b)b.disabled=!SES.lines.some(y=>y.on);
  },true);
  document.addEventListener('change',e=>{
    const t=e.target;if(t&&t.id==='ocrReplace'&&SES){SES.replace=t.checked;e.stopImmediatePropagation()}
    if(t&&t.dataset&&t.dataset.ocr==='date'&&SES){SES.lines[+t.dataset.i].date=t.value;const x=SES.lines[+t.dataset.i];if(x.date&&x.date.slice(0,7)===state.month)x.on=true;e.stopImmediatePropagation();reviewUI()}
  },true);
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-ocr],[data-act="ocrSheet"]');if(!b)return;
    if(b.dataset.act==='ocrSheet'){e.stopImmediatePropagation();const f=MEM[state.month];if(f)return run(f);pick();return}
    e.stopImmediatePropagation();const k=b.dataset.ocr;
    if(k==='close'){close();return}
    if(k==='add')return addLines();
    if(k==='again'&&SES){const rot=+(document.getElementById('ocrRot')||{value:0}).value||0;return run(SES.file,rot)}
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ov())close()});

  const MEM={};
  function pick(){
    const i=document.createElement('input');i.type='file';i.accept='application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg';
    i.onchange=()=>{const f=i.files&&i.files[0];if(f){MEM[state.month]=f;run(f)}};i.click();
  }
  function sheet(file){MEM[state.month]=file;return run(file)}

  /* Receipts: fill vendor, date and total from a photo or PDF. The receipt stays "Needs review". */
  async function receipt(file,rc){
    try{
      const r=await readFileWords(file,{rotate:0,progress:()=>{}});
      const {rows}=toRows(r.pages.flat?r.pages.flat():[].concat(...r.pages));
      const ctx={month:state.month};
      let vendor='',date=null,total=null,best=null;
      for(const row of rows.slice(0,10)){const t=row.text.trim();if(/[a-z]{3,}/i.test(t)&&!/^(tel|phone|vat|www|http|date|cashier|invoice|receipt|tax)/i.test(t)&&!/\d{5,}/.test(t)){vendor=t.replace(/\s{2,}/g,' ').slice(0,60);break}}
      for(const row of rows){
        const t=row.text;
        if(!date){const mm=/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*\d{2,4})/i.exec(t);if(mm){const d=parseDate(mm[1],ctx);if(d)date=d}}
        const nums=row.cells.map(c=>parseMoney(c.t)).filter(v=>v!=null&&v>0);
        if(/\b(total|amount due|balance due|to pay|grand total)\b/i.test(t)&&!/sub-?total/i.test(t)&&nums.length){const v=nums[nums.length-1];if(best==null||/\btotal\b/i.test(t))best=v}
        nums.forEach(v=>{if(total==null||v>total)total=v});
      }
      const amt=best!=null?best:total;
      if(vendor&&!rc.vendor)rc.vendor=vendor;
      if(amt&&!(rc.amt>0))rc.amt=amt;
      if(date&&date.slice(0,7)===state.month)rc.date=date;
      rc.ocr=true;
      if(typeof toast==='function')toast('Receipt read: '+(rc.vendor||'vendor not found')+', '+(rc.amt>0?NADf(rc.amt):'amount not found')+'. Please check it.');
      if(typeof render==='function')render();
    }catch(e){console.error(e);if(typeof toast==='function')toast('The receipt could not be read. Fill it in by hand.')}
  }
  window.VIRTUOSO_OCR={sheet,receipt,parseWords,parseMoney,parseDate,toRows,readFileWords};
})();
