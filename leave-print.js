/* Professional Leave Application Form: preview, print, save as PDF, download.
   window.VIRTUOSO_LEAVEPRINT.open(data) shows the form in an overlay. The form is built as one
   self-contained HTML document (logo embedded), so the downloaded file opens anywhere. */
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=s=>{if(!s)return '';const d=new Date(String(s).slice(0,10)+'T00:00:00');return isNaN(d)?esc(s):d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long',year:'numeric'})};
  const blank=(v,w)=>v?esc(v):`<span class="bl" style="min-width:${w||180}px"></span>`;
  let logo=null;
  async function logoData(){
    if(logo)return logo;
    try{const r=await fetch('logo.png',{cache:'force-cache'}),b=await r.blob();
      logo=await new Promise(ok=>{const f=new FileReader();f.onload=()=>ok(f.result);f.onerror=()=>ok('logo.png');f.readAsDataURL(b)})}
    catch(e){logo='logo.png'}
    return logo;
  }
  function docHTML(d,img){
    const ref=d.ref||'Not yet submitted',st=d.status||'Draft preview';
    const half=d.half?'Half day':'Full day(s)';
    const days=d.days?`${d.days} working day${+d.days===1?'':'s'}`:'';
    const types=['Annual','Sick','Study','Compassionate','Unpaid'];
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Leave Application Form${d.name?' - '+esc(d.name):''}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><style>
@page{size:A4;margin:11mm 14mm}
*{box-sizing:border-box}
body{margin:0;background:#e9ecf3;font:13px/1.5 "Segoe UI",Arial,Helvetica,sans-serif;color:#14213d;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:14mm 16mm;position:relative}
@media print{body{background:#fff}.page{width:auto;min-height:0;margin:0;padding:0}}
.hd{display:flex;align-items:center;gap:16px;border-bottom:3px solid #c9a227;padding-bottom:12px}
.hd img{height:64px;width:auto;display:block}
.hd .co{flex:1}.hd .co b{display:block;font-size:17px;color:#0f1f4d;letter-spacing:.2px}.hd .co span{color:#5b6684;font-size:12px}
.hd .meta{text-align:right;font-size:12px;color:#5b6684}.hd .meta b{color:#0f1f4d}
h1{margin:12px 0 2px;font-size:21px;letter-spacing:1.5px;text-transform:uppercase;color:#0f1f4d;text-align:center}
.sub{text-align:center;color:#5b6684;font-size:12px;margin-bottom:8px}
h2{margin:11px 0 5px;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:#fff;background:#0f1f4d;padding:5px 10px;border-left:5px solid #c9a227}
table.f{width:100%;border-collapse:collapse}
table.f td{border:1px solid #c8cfe0;padding:5px 10px;vertical-align:top}
table.f td.k{width:30%;background:#f3f5fa;color:#33406b;font-weight:600}
.bl{display:inline-block;border-bottom:1px solid #7b86a6;height:16px;vertical-align:bottom}
.chk{display:inline-flex;align-items:center;gap:6px;margin-right:14px}
.bx{display:inline-block;width:13px;height:13px;border:1.5px solid #0f1f4d;text-align:center;line-height:11px;font-size:11px;font-weight:700}
.reason{min-height:44px;white-space:pre-wrap}
.decl{font-size:12px;color:#33406b;margin:6px 0}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:26px}
.sig div{border-top:1px solid #14213d;padding-top:4px;font-size:12px;color:#33406b}
.stamp{display:inline-block;border:2px solid #0f1f4d;color:#0f1f4d;padding:2px 10px;border-radius:4px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:11px}
.ft{margin-top:14px;border-top:1px solid #c8cfe0;padding-top:8px;font-size:11px;color:#6a7592;display:flex;justify-content:space-between}
</style></head><body><div class="page">
<div class="hd"><img src="${esc(img)}" alt="Virtuoso System logo"><div class="co"><b>Virtuous Accounting Solutions CC</b><span>Virtuoso System &middot; Windhoek, Namibia</span></div>
<div class="meta">Reference: <b>${esc(ref)}</b><br>Status: <b>${esc(st)}</b><br>Printed: ${esc(new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}))}</div></div>
<h1>Leave Application Form</h1><div class="sub">To be completed by the employee and approved by management</div>
<h2>1. Employee details</h2>
<table class="f"><tr><td class="k">Full name</td><td>${blank(d.name,260)}</td></tr>
<tr><td class="k">Position</td><td>${blank(d.title,260)}</td></tr>
<tr><td class="k">Email</td><td>${blank(d.email,260)}</td></tr></table>
<h2>2. Leave details</h2>
<table class="f"><tr><td class="k">Type of leave</td><td>${types.map(t=>`<span class="chk"><span class="bx">${d.type===t?'&#10003;':''}</span>${t}</span>`).join('')}</td></tr>
<tr><td class="k">First day of leave</td><td>${d.from?fmt(d.from):blank('',200)}</td></tr>
<tr><td class="k">Last day of leave</td><td>${d.to?fmt(d.to):blank('',200)}</td></tr>
<tr><td class="k">Length</td><td>${d.days?esc(days)+' &middot; '+esc(half):blank('',200)}</td></tr>
<tr><td class="k">Reason</td><td class="reason">${d.reason?esc(d.reason):''}</td></tr></table>
<h2>3. While you are away</h2>
<table class="f"><tr><td class="k">Phone number</td><td>${blank(d.phone,200)}</td></tr>
<tr><td class="k">Work covered by</td><td>${blank(d.cover,200)}</td></tr>
<tr><td class="k">Supporting document</td><td><span class="chk"><span class="bx">${d.doc?'&#10003;':''}</span>Attached</span><span class="chk"><span class="bx">${d.doc===false?'&#10003;':''}</span>Not attached</span> <span style="color:#6a7592">(a doctor's note is required for sick leave over 2 days)</span></td></tr></table>
<h2>4. Employee declaration</h2>
<p class="decl">I confirm that the details given above are correct and that I understand my leave is only approved once it has been approved by management.</p>
<div class="sig"><div>Employee signature</div><div>Date</div></div>
<h2>5. For management use</h2>
<table class="f"><tr><td class="k">Decision</td><td><span class="chk"><span class="bx">${d.status==='Approved'?'&#10003;':''}</span>Approved</span><span class="chk"><span class="bx">${d.status==='Rejected'?'&#10003;':''}</span>Not approved</span>${d.status&&d.status!=='Draft preview'?`<span class="stamp">${esc(d.status)}</span>`:''}</td></tr>
<tr><td class="k">Comments</td><td style="height:48px"></td></tr></table>
<div class="sig"><div>Approved by (name and signature)</div><div>Date</div></div>
<div class="ft"><span>Virtuous Accounting Solutions CC &middot; Confidential staff record</span><span>Generated by Virtuoso System</span></div>
</div></body></html>`;
  }

  /* Shared by the Leave, KYC and Form builder previews: overlay with Print, Save as PDF, Download, Close. */
  async function overlay(html,o){
    close();o=o||{};
    const wrap=document.createElement('div');wrap.id='lpOverlay';
    wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');wrap.setAttribute('aria-label',(o.title||'Form')+' preview');
    wrap.style.cssText='position:fixed;inset:0;z-index:100;background:rgba(10,18,44,.72);display:flex;flex-direction:column';
    const bar=document.createElement('div');
    bar.style.cssText='display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 14px;background:#0f1f4d;color:#fff';
    bar.innerHTML='<b style="flex:1;min-width:160px">'+esc(o.title||'Form')+': preview</b>'
      +'<button class="btn sm" id="lpPrint" type="button">Print</button>'
      +'<button class="btn sm ghost" id="lpPdf" type="button" style="color:#fff;border-color:rgba(255,255,255,.5)">Save as PDF</button>'
      +'<button class="btn sm ghost" id="lpDl" type="button" style="color:#fff;border-color:rgba(255,255,255,.5)">Download</button>'
      +'<button class="btn sm ghost" id="lpClose" type="button" style="color:#fff;border-color:rgba(255,255,255,.5)">Close</button>';
    const fr=document.createElement('iframe');
    fr.title=o.title||'Form';fr.style.cssText='flex:1;border:0;width:100%;background:#e9ecf3';fr.srcdoc=html;
    wrap.append(bar,fr);document.body.appendChild(wrap);
    const printIt=()=>{try{fr.contentWindow.focus();fr.contentWindow.print()}catch(e){toast('Printing is not available here. Use Download instead.')}};
    bar.querySelector('#lpPrint').onclick=printIt;
    bar.querySelector('#lpPdf').onclick=()=>{toast('In the print window, choose "Save as PDF" as the destination.');printIt()};
    bar.querySelector('#lpDl').onclick=()=>{
      const nm=String(o.name||o.title||'form').replace(/[^A-Za-z0-9._-]+/g,'_')+'.html';
      const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));a.download=nm;
      document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);toast('Form downloaded');
    };
    bar.querySelector('#lpClose').onclick=close;
    wrap.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    bar.querySelector('#lpPrint').focus();
  }
  async function open(d){
    const html=docHTML(d,await logoData());
    return overlay(html,{title:'Leave application form',name:'Leave-Application-'+(d.name||'form')+(d.from?'-'+d.from:'')});
  }
  function close(){const o=document.getElementById('lpOverlay');if(o)o.remove()}
  window.VIRTUOSO_LEAVEPRINT={open,close,html:docHTML};
  window.VIRTUOSO_DOCS={logoData,overlay,close,esc};
})();
