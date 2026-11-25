/* BIPA SECTION (Secretarial page). Templates of the Business and Intellectual Property Authority forms, laid out like the paper forms:
   CC 2 Amended Founding Statement, CC 3 Application for the Restoration of the Registration of a Corporation, CC 7 Annual Duty Return,
   BO 1 Beneficial Ownership Declaration Form. Each one is FILLABLE on screen (the page you fill in is the form itself), can be PREVIEWED,
   PRINTED (always through the shared preview window), saved as a DRAFT on this device and DOWNLOADED (Word .doc or HTML; Save as PDF from the preview).
   One layout builder serves both the screen form (inputs) and the printed document (the typed values), so they can never differ.
   Official-use areas, signatures and the BIPA barcode/logo are left blank on purpose. Templates only: check against the current BIPA form before lodging.
   Drafts live in this browser (localStorage `vx_bipa_<id>`); nothing is sent anywhere. Action prefix `sr`. window.VIRTUOSO_BIPA = { view, templates }. */
(function(){
  'use strict';
  const NL=/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
  const clip=(s,n)=>String(s==null?'':s).replace(NL,' ').slice(0,n||300);
  const KEY=id=>'vx_bipa_'+id;
  const B={id:null,V:{},X:{pages:1,owners:1,notes:true},msg:'',cat:'all',t:null,note:null};
  let MODE='edit';
  const g=k=>B.V[k]==null?'':String(B.V[k]);

  /* ---------- tiny layout kit (screen inputs / printed values) ---------- */
  const px=w=>w==null?'':(typeof w==='number'?w+'px':w);
  function fld(k,o){o=o||{};const v=g(k),st=o.w!=null?` style="width:${px(o.w)}"`:'';
    if(MODE==='print')return `<span class="v${o.c?' '+o.c:''}"${st}>${esc(v)}</span>`;
    return `<input class="in${o.c?' '+o.c:''}" data-sr="${k}" value="${esc(v)}" maxlength="${o.max||200}"${st}${o.ph?` placeholder="${esc(o.ph)}"`:''} aria-label="${esc(o.al||k)}">`;}
  function dat(k,o){o=o||{};const v=g(k);
    if(MODE==='print'){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v);return `<span class="v"${o.w!=null?` style="width:${px(o.w)}"`:''}>${m?m[3]+'/'+m[2]+'/'+m[1]:esc(v)}</span>`}
    return `<input class="in" type="date" data-sr="${k}" value="${esc(v)}"${o.w!=null?` style="width:${px(o.w)}"`:''} aria-label="${esc(o.al||k)}">`;}
  function ta(k,rows,o){o=o||{};const v=g(k);
    if(MODE==='print')return `<div class="vm" style="min-height:${rows*17}px">${esc(v)}</div>`;
    return `<textarea class="in ta" data-sr="${k}" rows="${rows}" maxlength="${o.max||800}" aria-label="${esc(o.al||k)}">${esc(v)}</textarea>`;}
  function bx(k,n,o){o=o||{};const v=g(k).padEnd(n,' ');let h='<span class="bx">';
    for(let i=0;i<n;i++){const c=v[i]===' '?'':v[i];
      h+=MODE==='print'?`<i>${esc(c)}</i>`:`<input data-srb="${k}" data-i="${i}" data-n="${n}" maxlength="1" value="${esc(c)}" aria-label="${esc((o.al||k)+' '+(i+1))}">`;}
    return h+'</span>';}
  function ck(k,label,o){const on=B.V[k]===true;
    if(MODE==='print')return `<span class="cb${on?' on':''}"></span>${label?' '+label:''}`;
    return `<label class="ckl"><input type="checkbox" data-srck="${k}"${on?' checked':''}> ${label||''}</label>`;}
  const row=(label,f,o)=>`<div class="r${o&&o.c?' '+o.c:''}"><span class="l">${label}</span><span class="f">${f}</span></div>`;
  const sig=l=>`<div class="r"><span class="l">${l}</span><span class="f"><span class="v sg"></span></span></div>`;
  const hdr=(code,act)=>`<div class="top"><span>REPUBLIC OF NAMIBIA</span><b class="code">${code}</b></div><div class="bar">BUSINESS AND INTELLECTUAL PROPERTY AUTHORITY - BIPA</div><div class="act">${act}</div>`;
  const page=(h,cls)=>`<section class="pg${cls?' '+cls:''}">${h}</section>`;
  const FIA='<p class="red">**Please note: in addition to the requirements of this Act and Regulations, any additional information requested is in terms Section 4 of the Financial Intelligence Act, 2012 (Act No. 13 of 2012), as well as the Regulations thereunder.</p>';
  function contacts(){
    let h='<h4 class="ct">MEMBER(S) / WITNESS CONTACT DETAILS</h4><p class="red sm">**Please note: in addition to the requirements of the CC Act and Regulations, any additional information requested is in terms of Section 4 of the Financial Intelligence Act, 2012 (Act No. 13 of 2012), as well as the Regulations thereunder.</p><table class="ctb">';
    for(let i=1;i<=6;i++){
      h+=`<tr><td class="lb">1. Name</td><td>${fld('ct'+i+'_n',{al:'Contact '+i+' name'})}</td></tr><tr><td class="lb">2. Land-line number of applicant (if available);</td><td>${fld('ct'+i+'_l',{al:'Land-line'})}</td></tr><tr><td class="lb">3. Mobile number (compulsory);</td><td>${fld('ct'+i+'_m',{al:'Mobile'})}</td></tr><tr><td class="lb">4. Fax Number (if available);</td><td>${fld('ct'+i+'_f',{al:'Fax'})}</td></tr><tr><td class="lb">5. E-mail Address (if available);</td><td>${fld('ct'+i+'_e',{al:'E-mail'})}</td></tr><tr class="gap"><td colspan="2"></td></tr>`;}
    return h+'</table><p class="sm">If there are more members for the space provided for, please make a copy/recreate this page.</p>';
  }
  const witness=p=>`<div class="wit">${row('Witness Signature','<span class="v sg"></span> &nbsp; Date of signature '+dat(p+'_wd',{w:130}))}${row('Full names',fld(p+'_wn'))}${row('Residential address',fld(p+'_wr'))}${row('Business address',fld(p+'_wb'))}${row('Postal address',fld(p+'_wp'))}${row('Email address:',fld(p+'_we'))}</div>`;

  /* ---------- the four templates ---------- */
  function buildCC3(){
    return page(`${hdr('CC 3','CLOSE CORPORATIONS ACT, 1988<br>(Section 26(6))<br>(Regulation 14)')}
      <h2 class="ti">Application for the Restoration of the Registration of a Corporation</h2><p class="c b">(To be lodged in duplicate)</p>
      <table class="bxt"><tr><td class="sm">REGISTRATION NUMBER OF CORPORATION<br>${fld('reg',{al:'Registration number'})}</td><td class="sm" style="width:34%"><b>N$ 225,00</b> fee payable in terms of the Act and as set out in the regulations</td></tr></table>
      ${row('Full name of Corporation:',fld('corp'))}${row('I/We:',fld('who'))}${row('in my/our capacity as:',fld('cap'))}
      <p>apply in terms of Section 26(6) of the above-named Act for the restoration of the Corporation which was deregistered:</p>
      <div class="r"><span class="l">On</span><span class="f">${fld('dereg')}</span><span class="l">and of which notice was given in the Gazette</span><span class="f">${fld('gaz')}</span></div>
      <div class="r"><span class="l">Of</span><span class="f">${fld('gazOf')}</span><span class="l">for the following reasons:</span></div>
      ${ta('reasons',5,{al:'Reasons'})}
      <p>${ck('amended','')} An amended founding statement, if necessary, is attached</p>
      <div class="r sp"><span class="l">Signed</span><span class="f"><span class="v sg"></span></span><span class="l">&nbsp; Date</span><span class="f">${dat('sdate',{w:140})}</span></div>
      <div class="off"><p>The registration of the Corporation has been restored with effect from:</p><div class="blank"></div>
        <p>as published in the Gazette <span class="ln" style="width:42%"></span> of <span class="ln" style="width:30%"></span></p>
        <div class="two"><div><span class="ln"></span><br><b>REGISTRAR OF CLOSE CORPORATIONS</b></div><div><span class="ln"></span><br><b>DATE</b></div></div></div>
      <div class="split"><div><p><b>(To be completed by Corporation)</b></p>${row('Name',fld('cname'))}${row('Postal Address:',fld('cpost1'))}${row('',fld('cpost2'))}${row('Email address:',fld('cmail'))}</div>
      <div class="ofc"><b>For Office Use</b><p><b>Data Processing</b></p><p>1) <b>Recorded</b><br><b>Date and initials</b> <span class="ln" style="width:55%"></span></p><p>2) <b>Corrections</b><br><b>Date and initials</b> <span class="ln" style="width:55%"></span></p></div></div>`);
  }
  function buildCC7(){
    return page(`${hdr('CC 7','CLOSE CORPORATIONS ACT, 1988<br>(Sections 13(2))<br>(Regulations 11)')}
      <h2 class="ti">Annual Duty</h2>
      <div class="split top7"><div><p class="sm">Name and postal address of Corporation</p>${ta('addr',3,{al:'Name and postal address'})}</div>
        <div class="boxr"><p class="sm c">REGISTRATION NUMBER</p>${fld('reg',{al:'Registration number'})}</div></div>
      <div class="split"><div class="main7">
        <div class="r"><span class="l">A. END OF FINANCIAL YEAR</span><span class="f dmy"><small>DAY</small>${fld('fyD',{w:46,c:'c',max:2})}<small>MONTH</small>${fld('fyM',{w:46,c:'c',max:2})}<small>YEAR</small>${fld('fyY',{w:62,c:'c',max:4})}</span></div>
        <div class="r"><span class="l">B. DATE INCORPORATED<br>&nbsp;&nbsp;&nbsp;&nbsp;OR CONVERSION DATE</span><span class="f dmy"><small>DAY</small>${fld('inD',{w:46,c:'c',max:2})}<small>MONTH</small>${fld('inM',{w:46,c:'c',max:2})}<small>YEAR</small>${fld('inY',{w:62,c:'c',max:4})}</span></div>
        <p class="b">C.</p><p>Name/names of member/members and percentage interest of each member in the Corporation at the end of the current financial year.</p>
        <table class="mem">${[1,2,3,4,5].map(i=>`<tr><td>${i}.</td><td>${fld('mn'+i,{al:'Member '+i})}</td><td class="pc">${fld('mp'+i,{w:46,c:'c',max:6})}%</td><td>${i+5}.</td><td>${fld('mn'+(i+5),{al:'Member '+(i+5)})}</td><td class="pc">${fld('mp'+(i+5),{w:46,c:'c',max:6})}%</td></tr>`).join('')}</table>
        <p class="b">D. &nbsp;PROOF OF PAYMENT OF ANNUAL DUTY AND/OR ADDITIONAL FEE</p>
        <div class="pay">Payment as prescribed in Terms of Section 32 of the BIPA Act.<br><b>N$ 120.00</b></div>
        <div class="r sp"><span class="l">E. SIGNED</span><span class="f"><span class="v sg"></span></span><span class="l">&nbsp; DATE</span><span class="f">${dat('sdate',{w:140})}</span></div></div>
      <div class="ofc narrow"><b>For Office Use</b><p>1. Recorded<br>Date and initials</p><p>2. Corrections and Enquiries<br>Date and initials</p></div></div>
      <div class="cut"></div><p class="sm">(To be completed by the corporation)</p>
      <div class="split"><div><p>ANNUAL DUTY FOR FINANCIAL YEAR 20${fld('ayr',{w:40,c:'c',max:2})}</p>${row('Name of corporation',fld('cname'))}${row('Postal address',fld('cpost'))}</div>
        <div class="ofc narrow"><b>Return received</b><div class="blank" style="height:44px"></div><b>Stamp of Business Registration Office</b></div></div>
      ${FIA}`)+page(contacts(),'ct');
  }
  const NOTES2=['Form CC 2 must be written in block capitals or be typewritten, lithographed or printed in legible characters with deep permanent black ink, and lodged in triplicate.','Change(s) effective from date of registration or upon a later date mentioned','Where a person signs on behalf of a member, a power of attorney must be attached.','Minor children and other persons under legal disability must be assisted by their parents, guardians or representatives, as the case may be, and the capacity must be stated.','If no identity document has been issued, a written statement to this effect must be attached.','Particulars which do not change should also be furnished.','No fee is payable in respect of any changes in particulars under Part B and C.','New members must personally sign the form.','Form CC 2 which does not comply with the requirements of the Act, regulations or these notes, will be rejected.','Particulars to be furnished under PART C.'];
  const NOTES2C=['Full names and surname. (if juristic person, mention name and capacity and if trustee, also mention name and particulars of testamentary trust).','Identity number ((i) if no identity document has been issued, state date of birth and see par. 4 above.) ((ii) If juristic person, mention registration number).','Size of interest expressed as a percentage.','Particulars of interest and fair value thereof.','Residential address','Postal address.','Signature of member or representative (where applicable).'];
  function memberBlock(p,m){const s=`m${p}_${m}_`;
    return `<div class="mb">${row('Full names and surname',fld(s+'n'))}
      <div class="ymd"><span>Year</span><span>Month</span><span>Day</span></div>
      <div class="r"><span class="l">Identity number or date of birth <small>(i)</small></span><span class="f">${bx(s+'id',13,{al:'Identity number'})}</span></div>
      <div class="r"><span class="l">Registration number <small>(ii)</small></span><span class="f">${bx(s+'rg',13,{al:'Registration number'})}</span></div>
      <div class="r"><span class="l">Percentage of interest</span><span class="f">${fld(s+'pc',{w:80,max:8})}</span><span class="l">&nbsp; Particulars of contribution</span><span class="f">${fld(s+'pt')}</span></div>
      ${row('Residential address',fld(s+'ra'))}${row('Postal address',fld(s+'pa'))}${row('Email address:',fld(s+'em'))}${sig('Signature of member or representative')}</div>`;}
  function buildCC2(){
    const N=Math.max(1,Math.min(4,B.X.pages)),pg=[];
    pg.push(page(`${hdr('CC 2','CLOSE CORPORATIONS ACT, 1988<br>(Sections 12, 13, 14, 24, 27, 29, 47 and 60)<br>(Regulations 2, 3 and 13)')}
      <h2 class="ti">Amended Founding Statement</h2><p>Before filling in the form, first see notes on page 2.</p>
      <table class="bxt"><tr><td class="sm">REGISTRATION NUMBER OF CORPORATION<br>${fld('reg',{al:'Registration number'})}</td><td class="sm" style="width:34%">DATE OF RECEIPT<br>&nbsp;</td></tr></table>
      <h3 class="pt">PART A</h3><p class="rt sm">Dates of commencement of change</p>
      ${[['Full name of corporation','corp'],['Previous name of corporation (if applicable)*','prev'],['Literal translation of name (if applicable)*','lit'],['Shortened form of name (if applicable)*','short'],['Description of principal business*','biz'],['Date of end of financial year*','fye']].map(([l,k])=>`<div class="r dc"><span class="l">${l}</span><span class="f">${fld(k)}</span><span class="d">* ${dat('dc_'+k,{w:120})}</span></div>`).join('')}
      <h3 class="pt">PART B</h3>
      <div class="r dc"><span class="l">Postal address*</span><span class="f">${fld('post')}</span><span class="d">* ${dat('dc_post',{w:120})}</span></div>
      ${row('Email address:',fld('mail'))}
      <div class="r dc"><span class="l">Address of registered office (not post office box)*</span><span class="f">${fld('reg1')}</span><span class="d">* ${dat('dc_reg',{w:120})}</span></div>
      <div class="r dc"><span class="l">Name and address of accounting officer*</span><span class="f">${fld('ao')}</span><span class="d">* ${dat('dc_ao',{w:120})}</span></div>
      ${row('',fld('ao2'))}<p class="c sm">(Attach written consent to appointment)</p>
      ${row('Full name of association or body of which accounting officer is a member',fld('aoBody'))}${row('Membership/Practice No.',fld('aoNo',{w:200}),{c:'rt'})}
      ${sig('Signature of previous accounting officer:')}${sig('Signature of current accounting officer:')}<p class="sm">* See note 2 on page 2</p>`));
    if(B.X.notes)pg.push(page(`<div class="top"><span></span><b class="code">- 2 -&nbsp;&nbsp; CC 2</b></div><h3 class="c">NOTES</h3><ol class="nt">${NOTES2.map((n,i)=>`<li>${n}${i===9?`<ol type="a">${NOTES2C.map(c=>`<li>${c}</li>`).join('')}</ol>`:''}</li>`).join('')}</ol>`));
    for(let p=1;p<=N;p++)pg.push(page(`<div class="top"><span></span><b class="code">- ${p+2} -&nbsp;&nbsp; CC 2</b></div>
      ${row('NAME OF CORPORATION',fld('corp'))}<table class="bxt"><tr><td class="sm">REGISTRATION NUMBER</td><td>${fld('reg')}</td></tr></table>
      <h3 class="pt">PART C</h3><div class="r"><span class="l">Date of Change</span><span class="f">${dat('c'+p+'_dc',{w:140})}</span></div><p class="b">MEMBERS</p>${memberBlock(p,1)}${memberBlock(p,2)}${witness('w'+p)}`));
    const rows=[];for(let i=1;i<=12;i++)rows.push(`<tr><td>${fld('cs'+i+'_n',{al:'Member who ceases '+i})}</td><td>${fld('cs'+i+'_i',{al:'Identity number'})}</td><td></td></tr>`);
    pg.push(page(`<div class="top"><span></span><b class="code">- ${N+3} -&nbsp;&nbsp; CC 2</b></div>${row('NAME OF CORPORATION',fld('corp'))}<table class="bxt"><tr><td class="sm">REGISTRATION NUMBER</td><td>${fld('reg')}</td></tr></table>
      <h3 class="pt">MEMBERS WHO CEASE TO BE MEMBERS</h3><table class="grid"><thead><tr><th>Full name and surname of member</th><th>Identity number</th><th>Signature</th></tr></thead><tbody>${rows.join('')}</tbody></table>
      <p class="sm">Membership ceases on the date of registration of the Amended Founding Statement.</p>${witness('wc')}`));
    pg.push(page(contacts(),'ct'));
    return pg.join('');
  }
  const BO_TYPES=['1','2','3','4','5','6','7','8'];
  const BO_NOTES=`<h3 class="c">Part C (COMPLETION NOTES)</h3><p class="b">1. INSTRUCTIONS</p><ol type="a"><li>Complete all relevant sections in block letters.</li><li>Complete the form in black ink only.</li><li>Any information that is not originally in the Latin alphabet, please use a recognised transliteration into the Latin alphabet.</li><li>Spell out all words - No abbreviations.</li><li>ALL mandatory fields must be completed.</li><li>Attach certified or notarised proof of identity copy not older than 6 months for each Beneficial Owner.</li><li>Attach proof of Registration with Accountable Institution/ FIC.</li></ol>
    <p class="b">2. EXPLANATORY NOTES</p>
    <p><b>a. What is this form?</b><br>This form is the Beneficial Ownership Declaration Form used for the purpose of collecting beneficial ownership information on legal persons registered or to be registered with BIPA. The form consists of 3 Sections, Section A consist of Company information and the type of beneficial ownership, Section B consist of Beneficial Owner’s particular and the attestation and Section C consists of the completion notes.</p>
    <p><b>b. Who should complete this form?</b><br>All existing companies and close corporations or companies and close corporations that are to be registered with BIPA must complete this form.</p>
    <p><b>c. When should this form be submitted to BIPA?</b><br>The Beneficial Ownership Declaration form must be submitted to BIPA at: i. registration of a company or close corporation; ii. the end of the company or close corporation’s financial year end together with the annual returns; and iii. within seven (7) days after a material change to the beneficial ownership of a company or close corporation.</p>
    <p><b>d. Who is a Beneficial Owner?</b><br>Beneficial owner is the natural person (s) who ultimately owns or controls company or close corporations or the natural person on whose behalf a transaction is being conducted. It also includes those natural persons who exercise ultimate effective control over a legal person. Only a natural person can be an ultimate beneficial owner, and more than one natural person be the ultimate beneficial owner of a given legal person.</p>`;
  const BO_NOTES2=`<p><b>e. Type of Beneficial Ownership.</b><br>FOR EACH BENEFICIAL OWNER, PLEASE TICK ALL APPLICABLE COLUMN TO INDICATE THE TYPE OF BENEFICIAL OWNERSHIP (NATURE OF INTEREST) [See Part B]. The following are the type of beneficial ownership: (All Potential Beneficial Owners should be tested against all categories (1-8)</p>
    <ol><li>A natural person who directly or indirectly or through a trust, other legal person or other legal arrangements holds 25 percent or more of the shares, voting rights or other ownership interest in the legal person;</li><li>A natural person who holds the position of a senior managing in the legal person; (Only select when category 1 is not applicable,)</li><li>A natural person or through a trust, other legal person or other legal arrangements who jointly exercise direct or indirect control over the legal person;</li><li>A natural person who directly or indirectly controls several legal persons and holds a combination of 25 percent or more of shares, voting right or ownership interest in the legal persons;</li><li>A natural person who has the right, directly or indirectly, to appoint or remove a majority of the board of directors of the legal person;</li><li>A natural person who has the power to materially influence the decision-making or policy of the legal person;</li><li>A natural person who derives substantive economic benefits, including dividends, rights to profit, enjoyment of assets of the legal person or ability to use significant assets of the legal person, even if the person has no other formal link to the legal person; or</li><li>A natural person who has influence or ultimate control over the legal person through any other means.</li></ol>
    <p><b>f. Who is an Accountable Institution?</b><br>An Accountable Institution is a: 1. Legal practitioner who acts on behalf of a client to create, operate or manage a legal person; 2. Accountants and Auditors who act on behalf of a client to create, operate or manage a legal person; 3. Company Service Providers who do the following: i. Acting as a formation agent of legal persons (Companies and Close Corporations); ii. Acting as (or arranging for another person to act as) a director of a company; iii. Acting as a secretary of a company; iv. Acting as (or arranging for another person to act as) a nominee shareholder for another person; v. Provide a registered office, business address or office accommodation, correspondence or administrative address of a company.</p>
    <p><b>g. What are the consequences for late submission or non-submission of the Beneficial Ownership form?</b><br>i. The Registrar will issue a written directive instructing the entity to submit the Beneficial Ownership information. ii. If an entity or person fails to comply with the Directive, the Registrar shall impose a financial penalty not exceeding N$ 50 000 and a financial penalty not exceeding N$ 1000 for every day of non-compliance. iii. The Registrar shall list the entity on an inactive list and thereafter deregister the entity six months after the date the entity was listed.</p>
    <p><b>h. What are the consequences for providing false or misleading BO information, withholding BO information and making false entry into the BO registry?</b><br>Conviction to a fine not exceeding N$ 10 000 000.00 or imprisonment for a period not exceeding 10 years or conviction to both a fine and imprisonment.</p>`;
  function ownerBlock(i){const s='o'+i+'_';
    const c=(a,l,b,l2)=>`<tr><td class="q"><b>${a}</b> ${l}<br>${fld(s+b,{al:l})}</td><td class="q"><b>${l2[0]}</b> ${l2[1]}<br>${fld(s+l2[2],{al:l2[1]})}</td></tr>`;
    return `<table class="grid bo"><thead><tr><th colspan="2">PART B – BENEFICIAL OWNER PARTICULARS [IF MORE THAN ONE BENEFICIAL OWNER, PLEASE PRINT AND COMPLETE PART B FOR EACH BENEFICIAL OWNER]${B.X.owners>1?' – OWNER '+i:''}</th></tr><tr><th colspan="2" class="l">1. BENEFICIAL OWNER PARTICULARS</th></tr></thead><tbody>
      ${c('I.','FIRST NAME:','fn',['II.','SURNAME:','sn'])}${c('III.','ANY PREVIOUS NAME (E.G., MAIDEN NAME):','pn',['IV.','DATE OF BIRTH (DD-MM-YYYY):','dob'])}${c('V.','PLACE OF BIRTH:','pb',['VI.','NATIONALITY:','nat'])}
      <tr><td class="q"><b>VII.</b> RESIDENTIAL ADDRESS (INCLUDING ERF, STREET NAME, CITY, STATE AND COUNTRY)<br>${ta(s+'ra',3)}</td><td class="q"><b>VIII.</b> BUSINESS ADDRESS (INCLUDING ERF, STREET NAME, CITY AND COUNTRY)<br>${ta(s+'ba',3)}<br><b>X.</b> TAX IDENTIFICATION NUMBER (TIN). (IF APPLICABLE):<br>${fld(s+'tin')}</td></tr>
      ${c('XI.','TELEPHONE/MOBILE NUMBER:','tel',['XII.','EMAIL ADDRESS:','em'])}${c('XIII.','PRIMARY IDENTIFICATION TYPE (SEE INSTRUCTIONS):','idt',['XIV.','PRIMARY IDENTIFICATION NUMBER (SEE INSTRUCTIONS):','idn'])}${c('XV.','IDENTIFICATION ISSUING COUNTRY/ STATE/REGION:','idc',['XVI.','PLACE OF WORK AND POSITION HELD:','pw'])}
      <tr><td class="q">2. DATE BENEFICIAL OWNERSHIP COMMENCED</td><td class="q">${bx(s+'from',8,{al:'Commenced D D M M Y Y Y Y'})} <small>D D M M Y Y Y Y</small></td></tr>
      <tr><td class="q">3. DATE BENEFICIAL OWNERSHIP CEASED</td><td class="q">${bx(s+'to',8,{al:'Ceased D D M M Y Y Y Y'})}</td></tr></tbody></table>`;}
  function buildBO1(){
    const PUR=['REGISTRATION OF NEW COMPANY','REGISTRATION OF NEW CLOSE CORPORATION','SUBMISSION OF ANNUAL RETURNS / DUTY','COMPANY/CLOSE CORPORATION UPDATES / BO UPDATES'],TYP=['PUBLIC COMPANY (LTD)','PRIVATE COMPANY (PTY (LTD))','SECTION 21 COMPANY (NGO)','FOREIGN ENTITY','CLOSE CORPORATION'];
    const own=[];for(let i=1;i<=15;i++)own.push(`<tr><td>${fld('b'+i+'_n',{al:'Beneficial owner '+i})}</td>${BO_TYPES.map(t=>`<td class="tk">${ck('b'+i+'_t'+t,'')}</td>`).join('')}</tr>`);
    const pg=[];
    pg.push(page(`<div class="bohead"><div class="bo1"><b>BO</b><br><br><b>BENEFICIAL OWNERSHIP (BO)<br>DECLARATION FORM</b></div><div class="bo2">IN ACCORDANCE WITH THE COMPANIES AMENDMENT ACT NO.4 OF 2023, CLOSE CORPORATION AMENDMENT ACT NO. 5 OF 2023 &amp; FINANCIAL INTELLIGENCE ACT 2012</div></div>
      <p class="c b">PLEASE READ THE INSTRUCTIONS BELOW (PART C) AND TICK APPROPRIATELY<br><i>COMPLETE FORM WITH BLACK INK IN BLOCK LETTERS – NO ABBREVIATIONS</i></p>
      <table class="grid bo"><thead><tr><th colspan="2" class="l">PART A – ENTITY PARTICULARS</th></tr></thead><tbody>
      <tr><td class="q" style="width:46%"><b>1. PURPOSE OF BENEFICIAL OWNERSHIP INFORMATION SUBMISSION (PLEASE TICK)</b></td><td class="q">${PUR.map((l,i)=>`<div class="tl">${l}<span>${ck('pur'+i,'')}</span></div>`).join('')}</td></tr>
      <tr><td colspan="2" class="q"><b>2. ENTITY INFORMATION</b></td></tr>
      <tr><td class="q"><b>I.</b> FULL LEGAL NAME OF ENTITY:<br>${fld('ent')}</td><td class="q"><b>II.</b> TIN OF ENTITY (IF ANY):<br>${fld('tin')}</td></tr>
      <tr><td class="q"><b>III.</b> ENTITY REGISTRATION NUMBER (IF ANY):<br>${fld('regno')}</td><td class="q"><b>IV.</b> COUNTRY OF INCORPORATION:<br>${fld('country')}</td></tr>
      <tr><td class="q"><b>3. TYPE OF ENTITY (PLEASE TICK AGAINST THE CORRECT BOX)</b></td><td class="q">${TYP.map((l,i)=>`<div class="tl">${l}<span>${ck('typ'+i,'')}</span></div>`).join('')}</td></tr>
      <tr><td colspan="2" class="q"><b>4. BENEFICIAL OWNERS (SEE INSTRUCTIONS ON PAGE 4)</b><br>THE ABOVE-MENTIONED ENTITY HAS THE FOLLOWING BENEFICIAL OWNERS <span class="red">[Please see Part C (2) (e)]</span></td></tr></tbody></table>
      <table class="grid bo own"><thead><tr><th rowspan="2" style="width:38%">NAME OF BENEFICIAL OWNER</th><th colspan="8">TYPE OF BENEFICIAL OWNERSHIP<br>(TICK ALL APPLICABLE COLUMN FOR EACH BENEFICIAL OWNER)</th></tr><tr>${BO_TYPES.map(t=>`<th>${t}</th>`).join('')}</tr></thead><tbody>${own.join('')}</tbody></table>`,'bo'));
    const N=Math.max(1,Math.min(6,B.X.owners));let pb='';for(let i=1;i<=N;i++)pb+=ownerBlock(i);
    pg.push(page(pb+`<div class="decl"><p class="c b">DECLARATION</p><p>1. &nbsp;I, UNDERSIGNED, FOR AND ON BEHALF OF THE REPORTING ENTITY CONFIRM THAT, ALL INFORMATION PROVIDED IN THE ABOVE BENEFICIAL OWNERSHIP DECLARATION IS ACCURATE AND RELIABLE.</p>
      ${row('<b>NAME OF DIRECTOR/SHAREHOLDER/MEMBER/BENEFICIAL OWNER:</b><br>[DELETE WHERE NOT APPLICABLE]',fld('d1n'))}
      <div class="r sp"><span class="l"><b>SIGNATURE:</b></span><span class="f"><span class="v sg"></span></span><span class="l"><b>&nbsp; DATE (DDMMYYYY):</b></span><span class="f">${bx('d1d',8,{al:'Date DDMMYYYY'})}</span></div></div>
      <div class="decl"><p>2. &nbsp;I, UNDERSIGNED, FOR AND ON BEHALF OF THE REPORTING ENTITY CONFIRM THAT TO THE BEST OF MY KNOWLEDGE ALL INFORMATION PROVIDED IN THE ABOVE BENEFICIAL OWNERSHIP DECLARATION IS ACCURATE AND RELIABLE.</p>
      ${row('<b>NAME OF ACCOUNTABLE INSTITUTION:</b>',fld('d2i'))}<div class="r"><span class="l"><b>NAME OF AUTHORIZED STAFF:</b></span><span class="f">${fld('d2n')}</span><span class="l"><b>POSITION:</b></span><span class="f">${fld('d2p')}</span></div>
      <div class="r sp"><span class="l"><b>SIGNATURE:</b></span><span class="f"><span class="v sg"></span></span><span class="l"><b>&nbsp; DATE (DDMMYYYY):</b></span><span class="f">${bx('d2d',8,{al:'Date DDMMYYYY'})}</span></div><p class="sm"><i><b>*IN THE CASE OF AN EXTERNAL COMPANY THE LOCAL MANAGER SHOULD SIGN.</b></i></p></div>
      <div class="decl off"><p><b><u>OFFICIAL USE ONLY</u> [TO BE COMPLETED BY BIPA OFFICIAL]</b></p><div class="r"><span class="l"><b>NAME OF REGISTRATION OFFICER:</b></span><span class="f"><span class="v sg"></span></span></div>
      <div class="r sp"><span class="l"><b>SIGNATURE:</b></span><span class="f"><span class="v sg"></span></span><span class="l"><b>&nbsp; DATE (DDMMYYYY):</b></span><span class="f"><span class="bx"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span></span></div></div>`,'bo'));
    if(B.X.notes){pg.push(page(BO_NOTES,'bo notes'));pg.push(page(BO_NOTES2,'bo notes'))}
    return pg.join('');
  }
  function buildBO2(){
    return page(`<div class="bohead"><div class="bo1"><b>BO2</b><br><br><b>ANNUAL CONFIRMATORY<br>BENEFICIAL OWNERSHIP(BO)<br>DECLARATION FORM</b></div><div class="bo2">IN ACCORDANCE WITH THE COMPANIES AMENDMENT ACT NO.4 OF 2023, CLOSE CORPORATION AMENDMENT ACT NO. 5 OF 2023 &amp; FINANCIAL INTELLIGENCE ACT 2012</div></div>
      <p class="c b"><i>COMPLETE FORM WITH BLACK INK IN BLOCK LETTERS – NO ABBREVIATIONS</i></p>
      <table class="grid bo"><thead><tr><th class="l">PART A – ENTITY PARTICULARS</th></tr></thead><tbody>
      <tr><td class="q"><b>1. ENTITY INFORMATION</b></td></tr>
      <tr><td class="q"><b>I.</b> FULL LEGAL NAME OF ENTITY:<br>${fld('ent')}</td></tr>
      <tr><td class="q"><b>II.</b> ENTITY REGISTRATION NUMBER:<br>${fld('regno')}</td></tr></tbody></table>
      <div class="decl" style="margin-top:34px"><p class="c b">DECLARATION</p><p>1. &nbsp;I, UNDERSIGNED, FOR AND ON BEHALF OF THE REPORTING ENTITY CONFIRM THAT, ALL INFORMATION PROVIDED PREVIOUSLY, REMAIN THE SAME AND IS ACCURATE, ADEQUATE AND UP TO DATE.</p>
      ${row('<b>NAME OF DIRECTOR/SHAREHOLDER/MEMBER/BENEFICIAL OWNER:</b><br>[DELETE WHERE NOT APPLICABLE]',fld('d1n'))}
      <div class="r sp"><span class="l"><b>SIGNATURE:</b></span><span class="f"><span class="v sg"></span></span><span class="l"><b>&nbsp; DATE (DDMMYYYY):</b></span><span class="f">${bx('d1d',8,{al:'Date DDMMYYYY'})}</span></div></div>
      <p class="c b">OR</p>
      <div class="decl"><p>2. &nbsp;I, UNDERSIGNED, FOR AND ON BEHALF OF THE REPORTING ENTITY CONFIRM THAT TO THE BEST OF MY KNOWLEDGE ALL INFORMATION PROVIDED PREVIOUSLY REMAIN THE SAME AND IS ACCURATE, ADEQUATE AND UP TO DATE.</p>
      ${row('<b>NAME OF ACCOUNTABLE INSTITUTION:</b>',fld('d2i'))}
      <div class="r"><span class="l"><b>NAME OF AUTHORISED STAFF:</b></span><span class="f">${fld('d2n')}</span><span class="l"><b>POSITION:</b></span><span class="f">${fld('d2p')}</span></div>
      <div class="r sp"><span class="l"><b>SIGNATURE:</b></span><span class="f"><span class="v sg"></span></span><span class="l"><b>&nbsp; DATE (DDMMYYYY):</b></span><span class="f">${bx('d2d',8,{al:'Date DDMMYYYY'})}</span></div><p class="sm"><i><b>*IN THE CASE OF AN EXTERNAL COMPANY THE LOCAL MANAGER SHOULD SIGN.</b></i></p></div>
      <div class="decl off"><p><b><u>OFFICIAL USE ONLY</u> [TO BE COMPLETED BY BIPA OFFICIAL]</b></p><div class="r"><span class="l"><b>NAME OF REGISTRATION OFFICER:</b></span><span class="f"><span class="v sg"></span></span></div>
      <div class="r sp"><span class="l"><b>SIGNATURE:</b></span><span class="f"><span class="v sg"></span></span><span class="l"><b>&nbsp; DATE (DDMMYYYY):</b></span><span class="f"><span class="bx"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span></span></div></div>`,'bo');
  }

  const TEMPLATES=[
    {id:'cc2',code:'CC 2',name:'Amended Founding Statement',category:'Close Corporations – Changes',pages:'Cover + notes + members pages',build:buildCC2,extra:'pages',font:'serif'},
    {id:'cc3',code:'CC 3',name:'Application for the Restoration of the Registration of a Corporation',category:'Close Corporations – Deregistration',pages:'1 page',build:buildCC3,font:'serif'},
    {id:'cc7',code:'CC 7',name:'Annual Duty Return',category:'Close Corporations – Annual returns',pages:'2 pages',build:buildCC7,font:'serif'},
    {id:'bo1',code:'BO 1',name:'Beneficial Ownership Declaration Form',category:'Beneficial Ownership – Companies and Close Corporations',pages:'Form + notes',build:buildBO1,extra:'owners',font:'sans'},
    {id:'bo2',code:'BO 2',name:'Annual Confirmatory Beneficial Ownership Declaration Form',category:'Beneficial Ownership – Annual confirmation',pages:'1 page',build:buildBO2,font:'sans'}];
  const tpl=id=>TEMPLATES.find(t=>t.id===id);
  try{localStorage.removeItem('vx_bipa_hidden')}catch(e){}   /* earlier versions let a template be hidden; templates are never hidden now */

  /* ---------- styles (shared by the screen form and the printed document) ---------- */
  const CSS=`.bp *{box-sizing:border-box}.bp{font:11.5px 'Times New Roman',Times,serif;color:#000}.bp.sans{font-family:Arial,Helvetica,sans-serif;font-size:10.5px}
  .bp .pg{width:190mm;max-width:100%;margin:0 auto 14px;background:#fff;padding:9mm 10mm;border:1px solid #cfd6e4;box-shadow:0 2px 10px rgba(0,0,0,.08);position:relative}
  .bp .top{display:flex;justify-content:space-between;font-size:10.5px}.bp .code{font-size:13px}
  .bp .bar{border-top:1.5px solid #000;border-bottom:1.5px solid #000;text-align:center;font-weight:700;font-size:10.5px;margin:2px 0;padding:1px 0}
  .bp .act{text-align:center;font-weight:700;font-size:10.5px;line-height:1.25}.bp .ti{text-align:center;font-size:15px;margin:10px 0 6px}.bp .c{text-align:center}.bp .b{font-weight:700}.bp .sm{font-size:9.5px}.bp .red{color:#d11;font-weight:700;font-size:9px}
  .bp .r{display:flex;align-items:flex-end;gap:6px;margin:7px 0}.bp .r .l{white-space:nowrap}.bp .r .f{flex:1;min-width:0}.bp .r.sp .f{flex:1}.bp .r.rt{justify-content:flex-end}.bp .r.rt .f{flex:none}
  .bp .in,.bp .v{font:inherit;border:0;border-bottom:1px solid #000;background:transparent;width:100%;padding:1px 2px;border-radius:0;min-height:17px;display:block;min-width:30px}.bp .v{display:inline-block;width:100%;line-height:15px;min-height:17px}.bp .v.sg{min-height:17px}
  .bp .in{background:#f4f8ff}.bp .in:focus{outline:2px solid #1f7a4d;background:#fff}.bp .c.in,.bp .c.v{text-align:center}
  .bp textarea.in{border:1px solid #9fb0d0;resize:vertical;line-height:17px;display:block;width:100%}.bp .vm{white-space:pre-wrap;background:repeating-linear-gradient(transparent 0 16px,#000 16px 17px);line-height:17px;padding:0 2px}
  .bp .bxt{width:60%;border:1px solid #000;border-collapse:collapse;margin:8px 0}.bp .bxt td{border:1px solid #000;padding:3px 5px;vertical-align:top}
  .bp .split{display:flex;gap:10px;align-items:stretch;margin:6px 0}.bp .split>div{flex:1}.bp .ofc{border:1px solid #000;padding:5px 7px;font-size:10px}.bp .ofc.narrow{flex:0 0 36%}.bp .blank{border-bottom:1px solid #000;height:17px;margin:4px 0}
  .bp .ln{display:inline-block;border-bottom:1px solid #000;width:100%;height:13px}.bp .two{display:flex;gap:30px;margin-top:20px}.bp .two>div{flex:1}.bp .off{border-top:1px solid #000;margin-top:10px;padding-top:4px}
  .bp .cut{border-top:2px dashed #000;margin:12px 0 6px}.bp .pay{border:1px solid #000;width:62%;margin:5px auto 10px;text-align:center;padding:4px}.bp .main7{flex:1}.bp .boxr{flex:0 0 34%;border:1px solid #000;padding:4px}.bp .top7{align-items:flex-start}
  .bp .dmy small{font-size:9px;font-weight:700;margin:0 3px}.bp .dmy{display:flex;align-items:flex-end;gap:2px}.bp .dmy .v,.bp .dmy .in{width:auto}
  .bp table.mem{width:100%;border-collapse:collapse;margin:6px 0}.bp .mem td{padding:4px 3px;vertical-align:bottom}.bp .mem .pc{width:70px;white-space:nowrap}
  .bp .pt{text-align:center;margin:14px 0 4px;font-size:13px}.bp .rt{text-align:right}.bp .dc .d{white-space:nowrap;border-left:1px solid #000;padding-left:6px}
  .bp .ymd{display:flex;gap:6px;justify-content:flex-start;margin-left:210px;font-size:9px}.bp .ymd span{width:40px;text-align:center;border:1px solid #000}
  .bp .bx{display:inline-flex}.bp .bx i,.bp .bx input{width:20px;height:22px;border:1px solid #000;margin-left:-1px;text-align:center;font:inherit;font-style:normal;padding:0;line-height:20px;background:#f4f8ff;border-radius:0}.bp .bx i{background:#fff}
  .bp .mb{border-bottom:3px solid #000;padding-bottom:6px;margin-bottom:8px}.bp .wit{margin-top:10px}.bp small{font-size:9px}
  .bp table.grid{width:100%;border-collapse:collapse;margin:6px 0}.bp .grid th,.bp .grid td{border:1px solid #000;padding:3px 5px;vertical-align:top}.bp .grid th{background:#e9edf7}.bp .grid th.l{text-align:left}.bp .grid td .in,.bp .grid td .v{border:0}
  .bp .ctb{width:100%;border-collapse:collapse}.bp .ctb td{border:1px solid #000;padding:4px 6px}.bp .ctb .lb{width:46%;font-weight:700;font-size:10px}.bp .ctb .gap td{border:0;height:6px}.bp .ct{text-align:center}
  .bp ol.nt li{margin:6px 0}.bp.sans p{margin:5px 0}
  .bp .cb{display:inline-block;width:12px;height:12px;border:1px solid #000;vertical-align:middle;position:relative;background:#fff}.bp .cb.on::after{content:'\\2715';position:absolute;inset:-3px 0 0 1px;font-size:12px;font-weight:700}
  .bp .tk{text-align:center;width:6.5%}.bp .tl{display:flex;justify-content:space-between;border-bottom:1px solid #999;padding:2px 0;gap:6px}.bp .q{font-size:10px}
  .bp .bohead{display:flex;border:1px solid #000}.bp .bo1{flex:1;text-align:center;padding:8px;border-right:1px solid #000}.bp .bo2{flex:0 0 36%;color:#e07b00;font-weight:700;font-size:10px;padding:8px}
  .bp .decl{border:1px solid #000;padding:6px 8px;margin:10px 0}.bp .ckl{display:inline-flex;gap:4px;align-items:center}
  @media print{@page{size:A4 portrait;margin:11mm}body{margin:0}.bp .pg{box-shadow:none;border:0;margin:0;padding:0;width:auto;page-break-after:always;break-after:page}.bp .pg:last-child{page-break-after:auto}}`;

  /* ---------- data: drafts ---------- */
  function load(id){
    B.id=id;B.msg='';B.V={};B.X={pages:1,owners:1,notes:true};
    try{const s=JSON.parse(localStorage.getItem(KEY(id))||'null');if(s&&typeof s==='object'){if(s.V&&typeof s.V==='object')Object.keys(s.V).slice(0,1500).forEach(k=>{if(/^[A-Za-z0-9_]+$/.test(k)){const v=s.V[k];B.V[k]=v===true?true:clip(v,800)}});
      if(s.X){B.X.pages=Math.max(1,Math.min(4,+s.X.pages||1));B.X.owners=Math.max(1,Math.min(6,+s.X.owners||1));B.X.notes=s.X.notes!==false}}}catch(e){}
  }
  const filled=()=>Object.keys(B.V).some(k=>B.V[k]!==''&&B.V[k]!==false&&B.V[k]!=null)||B.X.pages>1||B.X.owners>1;
  function save(quiet){try{if(!filled()){localStorage.removeItem(KEY(B.id));if(!quiet)B.msg='Nothing is filled in, so no draft was kept.';return true}localStorage.setItem(KEY(B.id),JSON.stringify({V:B.V,X:B.X,at:Date.now()}));putProfile(B.id,B.V,(tpl(B.id)||{}).code,B.keepSrc);if(!quiet){B.msg='Draft saved on this device.'}return true}catch(e){B.msg='Could not save the draft (browser storage is not available).';return false}}
  const hasDraft=id=>{try{return !!localStorage.getItem(KEY(id))}catch(e){return false}};
  function docHTML(t){
    MODE='print';let body='';try{body=t.build()}finally{MODE='edit'}
    let blob='';try{blob=btoa(unescape(encodeURIComponent(JSON.stringify({v:1,id:t.id,V:B.V,X:B.X}))))}catch(e){}
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(t.code+' '+t.name)}</title><style>body{margin:0;background:#e9ecf3;padding:12px 0}@media print{body{background:#fff;padding:0}}${CSS}</style></head><body><div class="bp${t.font==='sans'?' sans':''}">${body}</div><!--vx-bipa:${blob}--></body></html>`;
  }
  const fname=t=>(t.code+' '+t.name).replace(/[^A-Za-z0-9]+/g,'-').replace(/-+$/,'')+(g('corp')||g('ent')||g('cname')?'-'+(g('corp')||g('ent')||g('cname')).replace(/[^A-Za-z0-9]+/g,'-').slice(0,40):'');
  function preview(){const t=tpl(B.id);if(!t)return;if(window.VIRTUOSO_DOCS&&VIRTUOSO_DOCS.overlay)return VIRTUOSO_DOCS.overlay(docHTML(t),{title:t.code+' – '+t.name,name:fname(t)});toast('The print preview is not available.')}
  function dlWord(){const t=tpl(B.id);if(!t)return;
    const html=docHTML(t).replace('<html>','<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+html],{type:'application/msword'}));a.download=fname(t)+'.doc';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);toast('Downloaded as a Word document.')}


  /* ---------- UPDATE FROM A PREVIOUS DOCUMENT ----------
     Upload last year's form: files saved from this app (HTML / Word .doc download) carry their data and load exactly;
     PDFs (typed or scanned), Word .docx and images are read by labels (best effort, always check). The year is moved on,
     signing dates, dates of change and event-specific entries are cleared, everything else is carried over. */
  const L=(re,keys,o)=>({re,keys:[].concat(keys),next:!o||o.next!==false,num:o&&o.num,first:o&&o.first});
  const seq=(pre,post,n,m)=>{const a=[];for(let i=1;i<=n;i++)for(let j=1;j<=(m||1);j++)a.push(pre+i+(m?'_'+j:'')+post);return a};
  const CT=(n)=>[L(/^\s*\d?\.?\s*name\s*[:_]*\s*$/i,seq('ct','_n',n)),L(/land-?line number of applicant \(if available\)\s*;?/i,seq('ct','_l',n)),L(/mobile number \(compulsory\)\s*;?/i,seq('ct','_m',n)),L(/fax number \(if available\)\s*;?/i,seq('ct','_f',n)),L(/e-?mail address \(if available\)\s*;?/i,seq('ct','_e',n))];
  const BOP=[['o#_fn',/first name/i],['o#_sn',/\bsurname/i],['o#_pn',/previous name/i],['o#_dob',/date of birth/i],['o#_pb',/place of birth/i],['o#_nat',/nationality/i],['o#_ra',/residential address/i],['o#_ba',/business address/i],['o#_tin',/tax identification number/i],['o#_tel',/telephone\/mobile/i],['o#_em',/email address/i],['o#_idt',/primary identification type/i],['o#_idn',/primary identification number/i],['o#_idc',/issuing country/i],['o#_pw',/place of work/i]];
  const bo=()=>[L(/full legal name of entity/i,'ent'),L(/tin of entity/i,'tin'),L(/entity registration number/i,'regno'),L(/country of incorporation/i,'country'),
    L(/name of director\/shareholder/i,'d1n'),L(/name of accountable institution/i,'d2i'),L(/name of authori[sz]ed staff/i,'d2n'),L(/\bposition\s*:/i,'d2p')];
  const RULES={
    cc3:[L(/registration number of corporation/i,'reg'),L(/full name of corporation/i,'corp'),L(/^\s*i\/we\b/i,'who'),L(/in my\/our capacity as/i,'cap'),L(/^\s*name\s*[:_]/i,'cname'),L(/postal address/i,'cpost1'),L(/e-?mail address/i,'cmail')],
    cc7:[L(/^\s*registration number/i,'reg'),L(/name and postal address of corporation/i,'addr'),L(/name of corporation/i,'cname'),L(/^\s*postal address/i,'cpost')].concat(CT(6)),
    cc2:[L(/registration number of corporation/i,'reg'),L(/^\s*full name of corporation/i,'corp'),L(/previous name of corporation/i,'prev'),L(/literal translation/i,'lit'),L(/shortened form/i,'short'),L(/description of principal business/i,'biz'),L(/date of end of financial year/i,'fye'),
      L(/^\s*postal address/i,'post'),L(/^\s*email address\s*:/i,['mail']),L(/address of registered office/i,'reg1'),L(/name and address of accounting officer/i,'ao'),L(/association or body/i,'aoBody'),L(/membership\/practice/i,'aoNo'),
      L(/^\s*full names and surname\s*[:_]*\s*$/i,['m1_1_n','m1_2_n','m2_1_n','m2_2_n','m3_1_n','m3_2_n','m4_1_n','m4_2_n']),L(/^\s*percentage of interest\s*[:_]*\s*$/i,['m1_1_pc','m1_2_pc','m2_1_pc','m2_2_pc','m3_1_pc','m3_2_pc','m4_1_pc','m4_2_pc']),
      L(/^\s*particulars of contribution\s*[:_]*\s*$/i,['m1_1_pt','m1_2_pt','m2_1_pt','m2_2_pt','m3_1_pt','m3_2_pt','m4_1_pt','m4_2_pt'])].concat(CT(6)),
    bo1:bo().concat(BOP.map(([k,re])=>L(re,[1,2,3,4,5,6].map(i=>k.replace('#',i))))),
    bo2:bo()
  };
  const ALLRE=()=>Object.values(RULES).flat().map(r=>r.re);
  const JUNK=/^\(|^\/|^of\b|^to\b|^no\.?$|^number\b|\(if |\(e\.g|\(see |\(dd|\(tin\)|state and country|street name|if available|if juristic|fee payable|date and initials|apply in terms|attach written|which accounting officer|post office box|for the space|a member$|^name$|^date\b|^signature|^position\b|^city and|^country\)|^instructions\)|^address\b|^\(?compulsory|^\d\.\s|date beneficial|local manager|^\[|^trust\)|^(on|of)$/i;
  const cleanVal=(v,num)=>{v=String(v||'');
    const c=v.indexOf(':');if(c>=0&&c<60&&!/\d/.test(v.slice(0,c)))v=v.slice(c+1);
    v=v.replace(/^\s*\([^)]*\)\s*[*:;.]?\s*/,'').replace(/^[\s:;_\-*.]+/,'').replace(/[\s_]+$/,'').replace(/\s{2,}/g,' ').trim();
    if(!v||/^[_\-.\s*]*$/.test(v)||JUNK.test(v)||v.length>110)return '';return num?v.replace(/[^0-9]/g,''):v.slice(0,300)};
  function extractLines(tid,rows){   /* rows: [[{t,x}]] */
    const rules=RULES[tid]||[],V={},seen=new Map(),all=ALLRE();
    const isLabel=t=>all.some(r=>r.test(t))||/^\s*(part\s+[a-c]|members?|declaration|official use|return received|stamp of business|for office use)\b/i.test(t);
    rows.forEach((row,ri)=>row.forEach((seg,si)=>{
      for(const r of rules){
        const m=r.re.exec(seg.t);if(!m)continue;
        const n=(seen.get(r)||0);if(n>=r.keys.length)continue;
        let val=cleanVal(seg.t.slice(m.index+m[0].length),r.num);
        if(!val){   /* value in the next cell of the same row (table layouts) */
          const nx=row[si+1];if(nx&&!isLabel(nx.t))val=cleanVal(nx.t,r.num);
        }
        if(!val){   /* value sits below the label: the segment of the next rows nearest to the label's column */
          for(let d=1;d<=2&&!val&&ri+d<rows.length;d++){
            const cand=rows[ri+d].filter(c=>!isLabel(c.t));if(!cand.length)continue;
            cand.sort((a,b)=>Math.abs(a.x-seg.x)-Math.abs(b.x-seg.x));
            const c=cand[0];if(seg.x!==0&&Math.abs(c.x-seg.x)>90)continue;
            val=cleanVal(c.t,r.num);
          }
        }
        seen.set(r,n+1);if(val)V[r.keys[n]]=val;break;
      }
    }));
    /* CC 7 member lines "1. Name 60 %" and the financial year end */
    if(tid==='cc7'){
      rows.forEach(row=>[{t:row.map(c=>c.t).join(' ')}].forEach(seg=>{let m;const re=/(?:^|\s)(\d{1,2})\s*[.)]\s*([^%\d][^%]*?)\s+(\d{1,3}(?:[.,]\d+)?)\s*%/g;while((m=re.exec(seg.t))){const i=+m[1];if(i>=1&&i<=10&&!/annual|duty|section/i.test(m[2])){V['mn'+i]=cleanVal(m[2]);V['mp'+i]=m[3]}}}));
      for(let i=0;i<rows.length;i++){const t=rows[i].map(c=>c.t).join(' '),am=/financial year\s*20\s*(\d{2})\b/i.exec(t+' '+(rows[i+1]?rows[i+1].map(c=>c.t).join(' '):''));if(am&&/annual duty/i.test(t)){V.ayr=am[1];break}}
      for(let i=0;i<rows.length;i++){const t=rows[i].map(c=>c.t).join(' ');if(/end of financial year/i.test(t)){
        const nums=[];for(let d=0;d<=2&&i+d<rows.length;d++)rows[i+d].forEach(c=>c.t.split(/\s+/).forEach(w=>{if(/^\d{1,4}$/.test(w))nums.push(w)}));
        const y=nums.find(n=>/^\d{4}$/.test(n)),dm=nums.filter(n=>/^\d{1,2}$/.test(n));if(y&&dm.length>=2){V.fyD=dm[0].padStart(2,'0');V.fyM=dm[1].padStart(2,'0');V.fyY=y;break}break}}
    }
    /* pattern fallbacks for the details every form shares */
    const nameKey={cc3:'corp',cc7:'cname',cc2:'corp',bo1:'ent',bo2:'ent'}[tid],regKey={cc3:'reg',cc7:'reg',cc2:'reg',bo1:'regno',bo2:'regno'}[tid];
    const flat=rows.map(r=>r.map(c=>c.t).join(' ')),txt=flat.join('\n');
    if(regKey&&!V[regKey]){const m=/\b((?:CC|[A-Z]{1,2})\/\d{4}\/\d{3,6}|\d{4}\/\d{3,6})\b/.exec(txt);if(m)V[regKey]=m[1]}
    if(nameKey&&!V[nameKey]){const re=/^[A-Z0-9][A-Z0-9&.,'’ -]{2,60}\s(?:CC|C\.C\.|\(PTY\)\s*LTD|PTY\s*LTD|LTD|LIMITED|TRUST|CLOSE CORPORATION)\.?$/i;
      for(const r of rows){const seg=r.find(c=>!/:/.test(c.t)&&re.test(c.t.trim())&&!isLabel(c.t));if(seg){V[nameKey]=seg.t.trim().slice(0,120);break}}}
    const em=/[\w.+-]+@[\w-]+\.[\w.-]+/.exec(txt);if(em){const k=tid==='cc2'?'mail':tid==='cc3'?'cmail':'';if(k&&!V[k])V[k]=em[0]}
    if(tid==='cc2'||tid==='cc7'){const ph=/(?:\+264\s?|\b0)\d{2}\s?\d{3}\s?\d{4}\b/.exec(txt);if(ph&&!V.ct1_m)V.ct1_m=ph[0]}
    return V;
  }
  const textToRows=txt=>String(txt).split(/\r?\n/).map(t=>t.replace(/\t+/g,'    ').trim()).filter(Boolean).map(t=>[{t,x:0}]);
  async function inflateRaw(u8){const ds=new DecompressionStream('deflate-raw'),w=ds.writable.getWriter();w.write(u8);w.close();return new Uint8Array(await new Response(ds.readable).arrayBuffer())}
  async function docxText(file){
    const u=new Uint8Array(await file.arrayBuffer()),dv=new DataView(u.buffer);let e=-1;
    for(let i=u.length-22;i>=Math.max(0,u.length-70000);i--)if(dv.getUint32(i,true)===0x06054b50){e=i;break}
    if(e<0)throw new Error('This does not look like a Word .docx file.');
    let p=dv.getUint32(e+16,true);const n=dv.getUint16(e+10,true);
    for(let k=0;k<n;k++){
      if(dv.getUint32(p,true)!==0x02014b50)break;
      const meth=dv.getUint16(p+10,true),csz=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true);
      const name=new TextDecoder().decode(u.subarray(p+46,p+46+nl));
      if(name==='word/document.xml'){
        const ln=dv.getUint16(lo+26,true),lx=dv.getUint16(lo+28,true),st=lo+30+ln+lx,raw=u.subarray(st,st+csz);
        const xml=new TextDecoder().decode(meth===0?raw:await inflateRaw(raw));
        return xml.replace(/<w:tab\/>/g,'    ').replace(/<\/w:p>/g,'\n').replace(/<w:br\/>/g,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
      }
      p+=46+nl+xl+cl;
    }
    throw new Error('The Word file has no readable text.');
  }
  async function readPrevious(file,tid){
    const name=file.name||'file',lower=name.toLowerCase();
    if(file.size>25*1024*1024)throw new Error('That file is too large (25 MB at most).');
    const head=new Uint8Array(await file.slice(0,8).arrayBuffer());
    if(head[0]===0xD0&&head[1]===0xCF&&head[2]===0x11&&head[3]===0xE0)throw new Error('Old binary Word (.doc) files cannot be read here. Open it in Word and save it as .docx or PDF, then upload that.');
    if(/\.(html?|doc|json|txt)$/.test(lower)||file.type==='text/html'||file.type==='application/json'||file.type==='text/plain'){
      const txt=await file.text();
      let data=null;const m=/<!--vx-bipa:([A-Za-z0-9+\/=]+)-->/.exec(txt);
      try{if(m)data=JSON.parse(decodeURIComponent(escape(atob(m[1]))));else if(/\.json$/.test(lower))data=JSON.parse(txt)}catch(e){data=null}
      if(data&&typeof data==='object'&&data.V&&typeof data.V==='object')return {kind:'data',id:String(data.id||''),V:data.V,X:data.X||{},via:'exact'};
      if(/\.json$/.test(lower))throw new Error('That JSON file is not a BIPA form from this app.');
      let plain=txt;if(/<\s*(html|body|table|div|p)\b/i.test(txt)){const d=new DOMParser().parseFromString(txt,'text/html');d.querySelectorAll('script,style,head').forEach(x=>x.remove());d.body.querySelectorAll('br,p,div,tr,li,h1,h2,h3,h4').forEach(x=>x.append('\n'));d.body.querySelectorAll('td,th').forEach(x=>x.append('    '));plain=d.body.textContent}
      return {kind:'text',rows:textToRows(plain),via:'text'};
    }
    if(/\.docx$/.test(lower))return {kind:'text',rows:textToRows(await docxText(file)),via:'text'};
    if(/\.pdf$/.test(lower)||file.type==='application/pdf'||/^image\//.test(file.type)||/\.(png|jpe?g)$/.test(lower)){
      if(!window.VIRTUOSO_OCR||!VIRTUOSO_OCR.readFileWords)throw new Error('Reading PDFs and images is not available.');
      toast('Reading the document…');
      const r=await VIRTUOSO_OCR.readFileWords(file,{progress:()=>{}});const rows=[];
      r.pages.forEach(words=>{const rr=VIRTUOSO_OCR.toRows(words),Hs=words.map(w=>w.y1-w.y0).sort((a,b)=>a-b),H=Hs[Math.floor(Hs.length/2)]||10;
        rr.rows.forEach(row=>{const ws=row.w.slice().sort((a,b)=>a.x0-b.x0),segs=[];
          ws.forEach(w=>{const last=segs[segs.length-1];if(last&&w.x0-last.x1<=H*1.1){last.t+=' '+w.t;last.x1=w.x1}else segs.push({t:w.t,x:w.x0,x1:w.x1})});rows.push(segs)})});
      return {kind:'text',rows,via:r.mode==='ocr'?'ocr':'text'};
    }
    throw new Error('Upload a PDF, a Word .docx, a picture, or a form downloaded from this app (.html or .doc).');
  }
  const CLEAR=/^(sdate|wd|w\d+_wd|wc_wd|d1d|d2d|c\d+_dc|dc_.*)$/;
  const EVENT={cc3:['dereg','gaz','gazOf','reasons','amended'],cc2:['cs1_n','cs1_i','cs2_n','cs2_i','cs3_n','cs3_i','cs4_n','cs4_i','cs5_n','cs5_i','cs6_n','cs6_i','cs7_n','cs7_i','cs8_n','cs8_i','cs9_n','cs9_i','cs10_n','cs10_i','cs11_n','cs11_i','cs12_n','cs12_i'],cc7:[],bo1:[],bo2:[]};
  const lastDay=(y,m)=>new Date(y,m,0).getDate();
  function rollForward(id,V,Y){
    const out={},ch=[];let cleared=0;
    Object.keys(V).forEach(k=>{if(!/^[A-Za-z0-9_]+$/.test(k))return;let v=V[k];if(v!==true)v=clip(v,800);if(v===''||v==null||v===false)return;out[k]=v});
    Object.keys(out).forEach(k=>{if(CLEAR.test(k)||(EVENT[id]||[]).includes(k)){delete out[k];cleared++}});
    if(cleared)ch.push('Cleared '+cleared+' entr'+(cleared===1?'y':'ies')+' that belong to the old document (signing dates, dates of change, one-off details).');
    if(id==='cc7'&&Y){
      const old=out.fyY||(out.ayr?'20'+out.ayr:'');
      out.fyY=String(Y);out.ayr=String(Y).slice(-2);
      if(out.fyD&&out.fyM&&/^0?2$/.test(String(out.fyM))&&/^(28|29)$/.test(String(out.fyD))){const d=String(lastDay(Y,2));if(d!==out.fyD){ch.push('Financial year end day set to '+d+' February '+Y+'.');out.fyD=d}}
      ch.push('Financial year '+(old?old+' → ':'')+Y+' (end of financial year and "Annual duty for financial year").');
    }
    return {V:out,changes:ch};
  }
  function yearOf(id,V){if(id!=='cc7')return null;const y=parseInt(V.fyY,10)||(V.ayr?2000+parseInt(V.ayr,10):0);return y>2000&&y<2100?y:null}
  function yearDialog(prev,cb){
    const old=document.getElementById('srYr');if(old)old.remove();
    const w=document.createElement('div');w.id='srYr';w.setAttribute('role','dialog');w.setAttribute('aria-modal','true');
    w.style.cssText='position:fixed;inset:0;z-index:99997;background:rgba(10,20,50,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    const def=prev?prev+1:new Date().getFullYear();
    w.innerHTML=`<div style="background:#fff;color:#16254a;border-radius:14px;max-width:440px;width:100%;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.4);font:14px system-ui,sans-serif"><h3 style="margin:0 0 6px;font-size:18px">Create the updated form</h3><p style="margin:0 0 10px;color:#5a6685">${prev?'The previous document is for financial year <b>'+prev+'</b>.':'No year was found in the previous document.'} Choose the year for the new form. Everything else is carried over.</p>
      <label>Year of the new form<input id="srYrIn" type="number" min="2000" max="2099" value="${def}" style="width:100%"></label>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button type="button" class="btn ghost" id="srYrNo">Cancel</button><button type="button" class="btn" id="srYrGo">Create</button></div></div>`;
    document.body.appendChild(w);const close=()=>w.remove();
    w.querySelector('#srYrNo').onclick=close;w.addEventListener('mousedown',e=>{if(e.target===w)close()});
    w.querySelector('#srYrGo').onclick=()=>{const y=parseInt(w.querySelector('#srYrIn').value,10);if(!(y>=2000&&y<2100))return;close();cb(y)};
    w.querySelector('#srYrIn').focus();
  }
  async function handleUpload(file,tid){
    const t=tpl(tid);if(!t)return;
    let res;try{res=await readPrevious(file,tid)}catch(e){return toast(e.message||'That file could not be read.')}
    let V={},X={pages:1,owners:1,notes:true};
    if(res.kind==='data'){
      if(res.id&&res.id!==tid){const o=tpl(res.id);return toast('That file is a '+(o?o.code+' ('+o.name+')':'different form')+', not '+t.code+'. Upload it on the matching form.')}
      V=res.V;X=Object.assign(X,res.X||{});
    }else V=extractLines(tid,res.rows);
    const n=Object.keys(V).filter(k=>V[k]!==''&&V[k]!==false&&V[k]!=null).length;
    if(!n)return toast('Nothing could be read from that document. Try a clearer copy, a PDF, or a form downloaded from this app.');
    const finish=Y=>{
      const R=rollForward(tid,V,Y);load(tid);B.V=R.V;
      B.X.pages=Math.max(1,Math.min(4,+X.pages||1));B.X.owners=Math.max(1,Math.min(6,+X.owners||1));B.X.notes=X.notes!==false;
      const how=res.via==='exact'?'read exactly (it was downloaded from this app)':res.via==='ocr'?'read from a scan (check every value carefully)':'read from the text of the document (check every value)';
      B.note={file:file.name,how,count:Object.keys(R.V).length,changes:R.changes};
      putProfile(tid,R.V,t.code+' – '+file.name);
      save(true);rerender();
    };
    if(tid==='cc7')yearDialog(yearOf(tid,V),finish);else finish(null);
  }

  /* ---------- SAVED COMPANY DETAILS: every form pulls what is already known ----------
     Whatever is read from an uploaded old document, or typed into any form, is kept (on this device) as one set of company details.
     A form that is opened fresh is filled in from it automatically (entity name, registration number, addresses, members, contacts,
     beneficial owners, declarants). Signing dates and signatures are never carried. */
  const PKEY='vx_bipa_profile';
  const range=(a,b)=>{const r=[];for(let i=a;i<=b;i++)r.push(i);return r};
  function pairs(tid){   /* [formKey, canonicalKey] */
    const P=[];const add=(k,c)=>P.push([k,c]);
    const ct=()=>range(1,6).forEach(i=>['n','l','m','f','e'].forEach(x=>add('ct'+i+'_'+x,'ct'+i+'_'+x)));
    if(tid==='cc3'){add('corp','name');add('cname','name');add('reg','reg');add('cpost1','post');add('cmail','mail')}
    if(tid==='cc7'){add('cname','name');add('reg','reg');add('cpost','post');range(1,10).forEach(i=>{add('mn'+i,'mem'+i+'n');add('mp'+i,'mem'+i+'p')});add('fyD','fyD');add('fyM','fyM');ct()}
    if(tid==='cc2'){add('corp','name');add('reg','reg');add('post','post');add('mail','mail');add('reg1','regoffice');add('biz','biz');add('fye','fye');add('ao','ao');add('aoBody','aoBody');add('aoNo','aoNo');
      range(1,4).forEach(p=>range(1,2).forEach(j=>{const n=(p-1)*2+j;['n:n','id:id','rg:rg','pc:p','pt:pt','ra:ra','pa:pa','em:em'].forEach(z=>{const [a,b]=z.split(':');add('m'+p+'_'+j+'_'+a,'mem'+n+b)})}));ct()}
    if(tid==='bo1'||tid==='bo2'){add('ent','name');add('regno','reg');['d1n','d2i','d2n','d2p'].forEach(k=>add(k,k))}
    if(tid==='bo1'){add('tin','tin');add('country','country');range(1,10).forEach(i=>add('b'+i+'_n','mem'+i+'n'));
      range(1,6).forEach(i=>['fn','sn','pn','dob','pb','nat','ra','ba','tin','tel','em','idt','idn','idc','pw'].forEach(x=>add('o'+i+'_'+x,'o'+i+'_'+x)));
      range(1,10).forEach(i=>range(1,8).forEach(t=>add('b'+i+'_t'+t,'bt'+i+'_'+t)))}
    return P;
  }
  const getProfile=()=>{try{const o=JSON.parse(localStorage.getItem(PKEY)||'null');return o&&typeof o==='object'&&o.P&&typeof o.P==='object'?o:{P:{},src:{}}}catch(e){return {P:{},src:{}}}};
  function putProfile(tid,V,from,keep){
    const pr=getProfile(),cnt=Object.keys(pr.P).length;let n=0;
    pairs(tid).forEach(([k,c])=>{const v=V[k];if(v===''||v==null||v===false)return;if(v===true||String(v).trim()!==''){pr.P[c]=v===true?true:clip(v,800);n++}});
    if(!n)return 0;
    if(!keep)pr.src=Object.assign({},pr.src,{at:Date.now(),from:from||(tpl(tid)||{}).code||tid});
    try{localStorage.setItem(PKEY,JSON.stringify(pr))}catch(e){}
    return n;
  }
  function applyProfile(tid,V){
    const pr=getProfile(),out={};let n=0;
    pairs(tid).forEach(([k,c])=>{if(V[k]!=null&&V[k]!==''&&V[k]!==false)return;const v=pr.P[c];if(v===''||v==null||v===false)return;out[k]=v;n++});
    return {V:out,n,src:pr.src};
  }
  const profileSummary=()=>{const pr=getProfile(),P=pr.P;if(!Object.keys(P).length)return null;return {name:P.name||'',reg:P.reg||'',count:Object.keys(P).length,from:(pr.src||{}).from||'',at:(pr.src||{}).at||0}};
  /* which BIPA form is this text? */
  function detectForm(rows){
    const t=rows.map(r=>r.map(c=>c.t).join(' ')).join(' \n ').toLowerCase();
    if(/annual confirmatory/.test(t))return 'bo2';
    if(/beneficial ownership.{0,40}declaration|declaration form.{0,40}beneficial|\bbo\s*declaration/.test(t))return 'bo1';
    if(/amended founding statement/.test(t))return 'cc2';
    if(/restoration of the registration/.test(t))return 'cc3';
    if(/annual duty/.test(t)&&/close corporations act|registration number/.test(t))return 'cc7';
    return '';
  }
  async function handleMany(files){
    let docs=0,fields=0,fail=[];
    for(const file of files){
      try{
        const res=await readPrevious(file,'');let tid='',V={};
        if(res.kind==='data'){tid=res.id;V=res.V}
        else{tid=detectForm(res.rows);if(!tid){fail.push(file.name+' (could not tell which BIPA form it is)');continue}V=extractLines(tid,res.rows)}
        if(!tpl(tid)){fail.push(file.name+' (not a BIPA form from this app)');continue}
        const R=rollForward(tid,V,null),n=putProfile(tid,R.V,(tpl(tid).code)+' – '+file.name);
        if(n){docs++;fields+=n}else fail.push(file.name+' (nothing could be read)');
      }catch(e){fail.push(file.name+' ('+(e&&e.message||'unreadable')+')')}
    }
    B.msg=docs?'Read '+docs+' document'+(docs===1?'':'s')+' ('+fields+' details saved). New forms now fill themselves in from these details.'+(fail.length?' Not used: '+fail.join('; ')+'.':''):'Nothing could be used. '+fail.join('; ');
    toast(docs?'Saved details from '+docs+' document'+(docs===1?'':'s'):'Nothing could be read');rerender();
  }
  const upAll=document.createElement('input');upAll.type='file';upAll.multiple=true;upAll.hidden=true;upAll.id='srUpAll';upAll.accept='.pdf,.png,.jpg,.jpeg,.docx,.doc,.html,.htm,.json,.txt,application/pdf,image/*';document.body.appendChild(upAll);
  upAll.addEventListener('change',()=>{const fs=[...(upAll.files||[])];upAll.value='';if(fs.length)handleMany(fs)});

  const up=document.createElement('input');up.type='file';up.hidden=true;up.id='srUp';up.accept='.pdf,.png,.jpg,.jpeg,.docx,.doc,.html,.htm,.json,.txt,application/pdf,image/*';document.body.appendChild(up);
  up.addEventListener('change',()=>{const f=up.files&&up.files[0],tid=up.dataset.t;up.value='';if(f&&tid)handleUpload(f,tid)});

  /* ---------- page ---------- */
  const css=document.createElement('style');
  css.textContent=`.bpl .bpbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px}.bpl .bpbar .grow{flex:1}.bpl .bpmsg{font-size:12.5px;color:var(--muted)}
  .bpl table.bpt{width:100%;border-collapse:collapse}.bpl .bpt th{background:#0a2a7a;color:#fff;text-align:left;padding:10px 12px;white-space:nowrap}.bpl .bpt td{padding:11px 12px;border-bottom:1px solid #e3e9f6;vertical-align:middle}
  .bpl .bpcat{display:inline-block;background:#eef3ff;color:#0a2a7a;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700}.bpl .bpcode{display:inline-grid;place-items:center;width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,#1f4fa3,#0a2a7a);color:#fff;font-weight:800;font-size:13px}
  .bpl .bpx{display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:#f4f8ff;border:1px solid #dfe8fb;border-radius:12px;padding:8px 12px;margin:0 0 12px}
  .bpl .bpwrap{overflow-x:auto;padding:8px 0}${CSS.replace(/@media print\{[\s\S]*$/,'')}`;
  document.head.appendChild(css);

  function view(){
    if(B.id&&tpl(B.id))return editor();
    const rows=TEMPLATES.filter(t=>B.cat==='all'||t.category.startsWith(B.cat)).map(t=>`<tr><td><span class="bpcode">${esc(t.code)}</span></td><td><b>${esc(t.name)}</b><div class="note">${esc(t.pages)}</div></td><td><span class="bpcat">${esc(t.category)}</span></td>
      <td>${hasDraft(t.id)?'<span class="pill warn">Draft saved</span>':''}</td><td style="white-space:nowrap"><button class="btn sm" data-act="srOpen" data-id="${t.id}">Fill in</button> <button class="btn sm ghost" data-act="srUpload" data-id="${t.id}" title="Upload last year's document and create the updated one">Update from previous</button> <button class="btn sm ghost" data-act="srBlank" data-id="${t.id}">Blank copy</button> <button class="btn sm ghost" data-act="srDel" data-id="${t.id}" aria-label="Delete what is filled in on ${esc(t.code)}" title="${hasDraft(t.id)?'Delete the filled-in form and make it blank again':'Nothing is filled in'}" style="color:var(--bad)"${hasDraft(t.id)?'':' disabled'}>Delete</button></td></tr>`).join('');
    return `<div class="panel bpl"><div class="ph"><h3>BIPA forms</h3></div><p class="note" style="margin:0 0 10px">Business and Intellectual Property Authority templates. Open one to fill it in on screen, then preview, print or download it. Drafts stay on this device.</p>
      ${(()=>{const p=profileSummary();return `<div class="bpx"><span>${p?'<b>Saved company details:</b> '+esc(p.name||'(no name yet)')+(p.reg?' · '+esc(p.reg):'')+' · '+p.count+' details'+(p.from?' · from '+esc(p.from):''):'<b>No company details saved yet.</b>'}</span><button class="btn sm" data-act="srUploadAll" title="Upload old BIPA documents (any form, several at once). New forms then fill themselves in.">Upload old documents</button>${p?'<button class="btn sm ghost" data-act="srForget" style="color:var(--bad)">Forget saved details</button>':''}<span class="note">Upload last year\'s documents once. Every new form then fills itself in; typing in any form also updates these details.</span></div>`})()}
      <div class="bpmsg" id="srMsg0" role="status" style="margin-bottom:8px">${esc(B.msg)}</div>
      <div class="bpbar"><label>Category <select id="srCat" aria-label="Category"><option value="all">All</option><option value="Close Corporations"${B.cat==='Close Corporations'?' selected':''}>Close Corporations</option><option value="Beneficial Ownership"${B.cat==='Beneficial Ownership'?' selected':''}>Beneficial Ownership</option></select></label></div>
      <div class="tbl"><table class="bpt"><thead><tr><th></th><th>Name</th><th>Category</th><th></th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="note">No templates in this category.</td></tr>'}</tbody></table></div></div>`;
  }
  function editor(){
    const t=tpl(B.id);MODE='edit';let body='';try{body=t.build()}catch(e){console.error(e);body='<p>This form could not be shown.</p>'}
    return `<div class="panel bpl"><div class="ph"><h3>${esc(t.code)} – ${esc(t.name)}</h3><span class="pill">${esc(t.category)}</span></div>
      <div class="bpbar"><button class="btn ghost sm" data-act="srBack">‹ All BIPA forms</button><span class="grow"></span>
        <button class="btn sm ghost" data-act="srUpload" data-id="${t.id}" title="Upload last year's document and create the updated one">Update from previous document</button><button class="btn sm" data-act="srPreview">Preview and print</button><button class="btn sm ghost" data-act="srWord">Download Word (.doc)</button><button class="btn sm ghost" data-act="srSave">Save draft</button><button class="btn sm ghost" data-act="srClear" style="color:var(--bad)">Delete filled form</button></div>
      <div class="bpmsg" id="srMsg" role="status">${esc(B.msg)}</div>
      ${B.note?`<div class="banner ok" role="status" style="margin:8px 0"><b>${B.note.auto?'Filled in from ':'Created from '}${esc(B.note.file)}.</b> ${B.note.count} field${B.note.count===1?'':'s'} filled in, ${esc(B.note.how)}.${B.note.changes.length?'<ul style="margin:4px 0 0 18px">'+B.note.changes.map(c=>'<li>'+esc(c)+'</li>').join('')+'</ul>':''}<div>Check every detail before you print. Signatures stay blank.</div></div>`:''}
      <div class="bpx">${t.extra==='pages'?`<span>Members pages (Part C): <b>${B.X.pages}</b></span><button class="btn sm ghost" data-act="srAddP" ${B.X.pages>=4?'disabled':''}>Add a members page</button><button class="btn sm ghost" data-act="srRemP" ${B.X.pages<=1?'disabled':''}>Remove the last one</button>`:''}
        ${t.extra==='owners'?`<span>Beneficial owners (Part B): <b>${B.X.owners}</b></span><button class="btn sm ghost" data-act="srAddO" ${B.X.owners>=6?'disabled':''}>Add a beneficial owner</button><button class="btn sm ghost" data-act="srRemO" ${B.X.owners<=1?'disabled':''}>Remove the last one</button>`:''}
        ${t.extra?`<label class="ckl"><input type="checkbox" data-srnotes ${B.X.notes?'checked':''}> Include the notes pages when printing</label>`:''}
        <span class="note">Signatures, witness lines and the official-use boxes stay blank for you to complete by hand after printing.</span></div>
      <div class="bpwrap"><div class="bp${t.font==='sans'?' sans':''}">${body}</div></div></div>`;
  }

  /* ---------- actions ---------- */
  let tm=null;const later=()=>{clearTimeout(tm);tm=setTimeout(()=>{if(B.id){save(true);const e=document.getElementById('srMsg');if(e)e.textContent='Draft saved on this device.'}},700)};
  const rerender=()=>{if(state.tab&&state.tab[state.role]==='secretarial'){const y=window.scrollY;render();window.scrollTo(0,y)}};
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="sr"]');if(!b)return;
    const a=b.dataset.act;e.stopImmediatePropagation();
    if(a==='srOpen'){load(b.dataset.id);B.note=null;B.keepSrc=false;
      if(!hasDraft(b.dataset.id)){const A=applyProfile(b.dataset.id,B.V);if(A.n){Object.assign(B.V,A.V);B.keepSrc=true;const S=A.src||{};B.note={file:S.from||'your saved details',how:'filled in automatically from details you entered or uploaded earlier',count:A.n,changes:['Signing dates and signatures are never carried over. Check every detail, then preview and print.'],auto:true};save(true)}}
      return rerender()}
    if(a==='srUploadAll'){upAll.click();return}
    if(a==='srForget'){if(!confirm('Forget the saved company details? Forms you already filled in are not changed.'))return;try{localStorage.removeItem(PKEY)}catch(x){}B.msg='Saved company details forgotten.';return rerender()}
    if(a==='srUpload'){up.dataset.t=b.dataset.id;up.click();return}
    if(a==='srBlank'){load(b.dataset.id);B.V={};const t=tpl(b.dataset.id);B.id=b.dataset.id;preview();B.id=null;return}
    if(a==='srDel'){const t=tpl(b.dataset.id);if(!t)return;
      if(!confirm('Delete what is filled in on '+t.code+' ('+t.name+')? The form stays in the list and becomes blank again. Nothing is kept as a draft.'))return;
      try{localStorage.removeItem(KEY(t.id))}catch(x){}if(B.id===t.id){B.V={};B.X={pages:1,owners:1,notes:true}}clearTimeout(tm);toast(t.code+' is blank again');return rerender()}
    if(a==='srBack'){if(B.id)save(true);B.id=null;return rerender()}
    if(a==='srPreview'){save(true);return preview()}
    if(a==='srWord'){save(true);return dlWord()}
    if(a==='srSave'){save();B.msg=B.msg;const m=document.getElementById('srMsg');if(m)m.textContent=B.msg;return toast('Draft saved on this device')}
    if(a==='srClear'){if(!confirm('Delete everything filled in on this form and make it blank again? Nothing is kept as a draft.'))return;clearTimeout(tm);B.V={};B.note=null;B.X={pages:1,owners:1,notes:true};try{localStorage.removeItem(KEY(B.id))}catch(x){}B.msg='Form is blank again.';return rerender()}
    if(a==='srAddP'){B.X.pages=Math.min(4,B.X.pages+1);save(true);return rerender()}
    if(a==='srRemP'){if(B.X.pages>1&&confirm('Remove the last members page and what is typed on it?')){const p=B.X.pages;Object.keys(B.V).filter(k=>k.startsWith('m'+p+'_')||k.startsWith('c'+p+'_')||k.startsWith('w'+p+'_')).forEach(k=>delete B.V[k]);B.X.pages--;save(true);rerender()}return}
    if(a==='srAddO'){B.X.owners=Math.min(6,B.X.owners+1);save(true);return rerender()}
    if(a==='srRemO'){if(B.X.owners>1&&confirm('Remove the last beneficial owner and what is typed on it?')){const p='o'+B.X.owners+'_';Object.keys(B.V).filter(k=>k.startsWith(p)).forEach(k=>delete B.V[k]);B.X.owners--;save(true);rerender()}return}
  },true);
  document.addEventListener('input',e=>{
    const t=e.target;if(!t||!B.id)return;
    if(t.dataset&&(t.dataset.sr||t.dataset.srb))B.keepSrc=false;
    if(t.dataset&&t.dataset.sr){const k=t.dataset.sr;if(!/^[A-Za-z0-9_]+$/.test(k))return;B.V[k]=clip(t.value,t.tagName==='TEXTAREA'?800:300);
      document.querySelectorAll('[data-sr="'+k+'"]').forEach(x=>{if(x!==t&&x.value!==t.value)x.value=t.value});later();return}
    if(t.dataset&&t.dataset.srb){const k=t.dataset.srb,i=+t.dataset.i,n=+t.dataset.n;if(!/^[A-Za-z0-9_]+$/.test(k))return;
      const cur=(g(k)).padEnd(n,' ').split('');cur[i]=(t.value||' ').slice(-1);B.V[k]=cur.join('').replace(/\s+$/,'');t.value=t.value.slice(-1);
      if(t.value&&t.nextElementSibling&&t.nextElementSibling.tagName==='INPUT')t.nextElementSibling.focus();later()}
  },true);
  document.addEventListener('keydown',e=>{const t=e.target;if(e.key==='Backspace'&&t&&t.dataset&&t.dataset.srb&&!t.value&&t.previousElementSibling&&t.previousElementSibling.tagName==='INPUT')t.previousElementSibling.focus()},true);
  document.addEventListener('change',e=>{
    const t=e.target;if(!t)return;
    if(t.id==='srCat'){B.cat=t.value;return rerender()}
    if(!B.id)return;
    if(t.dataset&&t.dataset.srck){B.keepSrc=false;const k=t.dataset.srck;if(/^[A-Za-z0-9_]+$/.test(k)){B.V[k]=!!t.checked;later()}return}
    if(t.dataset&&'srnotes' in t.dataset){B.X.notes=!!t.checked;later()}
  },true);

  window.VIRTUOSO_BIPA={_extract:extractLines,_roll:rollForward,view,templates:()=>TEMPLATES.map(t=>({id:t.id,code:t.code,name:t.name,category:t.category})),_html:(id,v,x)=>{const t=tpl(id);B.id=id;B.V=v||{};B.X=Object.assign({pages:1,owners:1,notes:true},x||{});return docHTML(t)}};
})();
