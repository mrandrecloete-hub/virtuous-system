/* Assistant: forms, templates, quizzes, emails and response analysis. Rule-based: no AI service or key.
   It writes into the same form list as the Client KYC builder (state.forms), so anything it makes can be
   opened, edited, filled and reviewed there. Forms live in this session until the forms module is saved to
   the database. It recognises common phrasings; it is not a free-form language model. */
(function(){
  const E=window.VIRTUOSO_ENGINE;if(!E||!E.addIntent)return;
  const ctx={formId:null,lastQuiz:null};
  const COMPANY='Virtuous Accounting Solutions CC';
  const sc=s=>{s=String(s).replace(/\s+/g,' ').trim();return s.charAt(0).toUpperCase()+s.slice(1)};
  const list=(rows,max=14)=>rows.slice(0,max).map(r=>'- '+r).join('\n')+(rows.length>max?'\n- and '+(rows.length-max)+' more':'');
  const forms=()=>{kInit();return state.forms};
  const today=()=>E.today();
  const isoToday=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())};
  const refresh=()=>{try{if(state.tab[state.role]==='kyc')render()}catch(_){}};
  const strip=s=>s.replace(/^["“'‘]+|["”'’]+$/g,'').trim();

  /* ---------- splitting a list of fields, respecting (brackets) and "quotes" ---------- */
  function splitTop(s){
    const flag=[];let depth=0,q=false;
    for(const ch of s){if(ch==='('||ch==='[')depth++;if(ch===')'||ch===']')depth=Math.max(0,depth-1);if(ch==='"'||ch==='“'||ch==='”')q=!q;flag.push(depth>0||q)}
    const out=[],re=/\s*(,|;|&|\band\b|\bplus\b)\s*/gi;let last=0,m;
    while((m=re.exec(s))){if(flag[m.index]||flag[m.index+m[0].length-1]&&false)continue;out.push(s.slice(last,m.index));last=m.index+m[0].length}
    out.push(s.slice(last));
    return out.map(x=>x.trim()).filter(Boolean);
  }

  /* ---------- turning one phrase into a field ---------- */
  const STRONG=[['multiple choice','check'],['checkboxes','check'],['checkbox','check'],['tick boxes','check'],['tick box','check'],['single choice','radio'],['radio','radio'],['drop-down','select'],['dropdown','select'],['yes/no','yesno'],['yes or no','yesno'],['file upload','file'],['long text','long'],['paragraph','long'],['heading','head'],['section','head']];
  const WEAK=[['select','select'],['date','date'],['number','number'],['email','email'],['phone','phone'],['upload','file'],['signature','sign'],['text','short']];
  const DEFLAB={date:'Date',number:'Number',email:'Email address',phone:'Mobile number',file:'Document upload',sign:'Signature',short:'Answer',long:'Comments',select:'Choose one',radio:'Choose one',check:'Choose all that apply',yesno:'Yes or no',head:'Section',idno:'ID or passport number'};
  const CAT=[
    [/^(full )?name$|^your name$/,'short','Full name'],[/^first name$/,'short','First name'],[/^(last name|surname)$/,'short','Surname'],
    [/\be-?mail\b/,'email','Email address'],[/\b(phone|mobile|cell(phone)?|telephone|contact number|whatsapp number)\b/,'phone','Mobile number'],
    [/\b(id|identity|passport)( number| no\.?)?\b|\bid number\b/,'idno','ID or passport number'],[/\b(date of birth|dob|birthday|birth date)\b/,'date','Date of birth'],
    [/\baddress\b/,'long',null],[/\b(company|business|registered|entity) name\b/,'short',null],[/\bregistration (number|no)\b|\breg(istration)? no\b/,'short',null],
    [/\bvat\b/,'short','VAT number'],[/\b(tax|tin) (number|no)\b/,'short','Tax number'],[/\b(occupation|job title|position|designation|role)\b/,'short',null],
    [/\bnationality\b/,'short','Nationality'],[/\bgender\b/,'select','Gender',['Female','Male','Other','Prefer not to say']],
    [/\b(income|salary|amount|quantity|age|hours|price|budget|turnover)\b/,'number',null],[/\bdate\b|\bwhen\b/,'date',null],
    [/\b(signature|sign(ed)?)\b/,'sign',null],
    [/\b(rating|satisfaction|score)\b/,'select',null,['1 - Poor','2','3','4','5 - Excellent']],
    [/\b(comments?|feedback|message|notes?|reason|description|details|suggestions?|experience|complaint|why)\b/,'long',null],
    [/\b(consent|agree|agreement|terms|accept)\b/,'yesno',null]
  ];
  function parseItem(raw){
    let s=String(raw).trim().replace(/^[-•*\d.)\s]+/,'').replace(/[.]+$/,'');let req=null;
    if(/\b(required|mandatory|compulsory)\b/i.test(s)){req=true;s=s.replace(/[\(\[]?\b(required|mandatory|compulsory)\b[\)\]]?/ig,'').trim()}
    if(/\boptional\b/i.test(s)){req=false;s=s.replace(/[\(\[]?\boptional\b[\)\]]?/ig,'').trim()}
    s=strip(s).replace(/^(?:an?|the|their|his|her|your|my|our|some)\s+/i,'').replace(/\s+(?:field|question|box)$/i,'').trim();
    if(!s)return null;
    let opts=null,type=null,label=s;
    const mo=s.match(/^(.*?)\s*[\(\[]\s*(.+?)\s*[\)\]]\s*$/);
    if(mo&&/[,|\/]/.test(mo[2])){label=mo[1].trim();opts=mo[2].split(/\s*[,|\/]\s*/).map(x=>x.trim()).filter(Boolean)}
    const low=label.toLowerCase();
    for(const [w,t] of STRONG){if(low===w||low.startsWith(w+' ')||low.startsWith(w+':')){type=t;label=label.slice(w.length).replace(/^\s*(?:called|named|for|about|:|-)?\s*/i,'');break}}
    if(!type)for(const [w,t] of WEAK){const m=low.match(new RegExp('^'+w+'\\s*(?:called|named|for|about|:|-)\\s*(.+)$'));if(m){type=t;label=label.slice(label.length-m[1].length);break}}
    label=strip(label).replace(/^(?:question|field|called|named)\b\s*[:\-]?\s*/i,'').replace(/^(?:called|named)\b\s*/i,'');
    if(!type){
      if(/^(upload|attach|scan)\b|\b(copy of|scan of|photo of|picture of|proof of|certified copy|certificate)\b|\bupload\b|\battachment\b/i.test(label)){type='file';label=label.replace(/^(upload|attach|scan)(\s+of)?\s+/i,'');if(!/^(copy|proof|photo|picture|certified|certificate)/i.test(label))label='Copy of '+label.replace(/^(a|an|the)\s+/i,'')}
      else if(/\?$/.test(label)&&!/^(what|why|how|describe|please describe|where|who|which)\b/i.test(label))type='yesno';
      else if(/^(are|do|did|have|has|is|will|can|would|were|was)\s+(you|we|they|there|it)\b/i.test(label))type='yesno';
      else if(/^(what|why|how|describe|please describe|tell us)\b/i.test(label))type='long';
      else for(const [re,t,lab,o] of CAT){if(re.test(label.toLowerCase())){type=t;if(lab&&label.toLowerCase().split(' ').length<=lab.split(' ').length+1&&/^(full name|name|your name|first name|last name|surname|nationality|gender|vat|tax|email|e-mail|phone|mobile|cell|date of birth|dob|id|passport)/i.test(label))label=lab;if(o&&!opts)opts=o;break}}
    }
    if(!type)type='short';
    if(opts&&opts.length&&!['select','radio','check','yesno'].includes(type))type=opts.length<=4?'radio':'select';
    if(opts&&type==='yesno'&&!(opts.length===2&&/^yes$/i.test(opts[0])))type=opts.length<=4?'radio':'select';
    if((type==='select'||type==='radio'||type==='check')&&opts&&opts.length<2)opts=null;
    if(!label)label=DEFLAB[type]||'Question';
    label=sc(label);
    if(/^(radio|select|check)$/.test(type)&&!opts)opts=['Option 1','Option 2'];
    const spec={type,label,opts:opts||[],req:req===null?false:req};
    return spec;
  }
  const mkField=sp=>kF(sp.type,sp.label,{req:!!sp.req,opts:sp.opts||[]});

  /* ---------- templates ---------- */
  const para=t=>kF('para',t);
  const T={
    waiver:()=>({title:'Waiver and release',desc:'Template text for you to adapt. Have it reviewed by a legal adviser before relying on it.',thanks:'Thank you. Your signed waiver has been recorded.',category:'General',fields:[
      kF('head','Participant details'),kF('short','Full name',{req:true}),kF('idno','ID or passport number',{req:true}),kF('phone','Mobile number',{req:true}),kF('email','Email address'),
      kF('head','Waiver'),para('I understand that taking part involves risk. I accept that risk and release '+COMPANY+' and its staff from claims arising from my participation, except where the law does not allow this. [Adapt this wording with your adviser.]'),
      kF('yesno','I have read and accept this waiver',{req:true}),kF('sign','Signature',{req:true})]}),
    permission:()=>({title:'Permission slip',desc:'Please complete this form to give permission for the activity below.',thanks:'Thank you. Permission has been recorded.',category:'General',fields:[
      kF('head','Participant'),kF('short','Child or participant full name',{req:true}),kF('short','Parent or guardian full name',{req:true}),kF('phone','Contact number',{req:true}),kF('email','Email address'),
      kF('head','Activity'),kF('short','Activity or event',{req:true}),kF('date','Date of activity',{req:true}),kF('long','Medical conditions or allergies'),kF('short','Emergency contact name and number',{req:true}),
      kF('yesno','I give permission for the participant to take part',{req:true}),kF('sign','Parent or guardian signature',{req:true})]}),
    exit:()=>({title:'Exit ticket',desc:'Two minutes. Tell us what stuck and what did not.',thanks:'Thanks for your feedback.',category:'General',fields:[
      kF('long','What is the main thing you learned today?',{req:true}),kF('long','What is still unclear?'),kF('select','How well did you understand today?',{req:true,opts:['1 - Not at all','2','3','4','5 - Completely']}),kF('short','Name (optional)')]}),
    survey:()=>({title:'Feedback survey',desc:'Your answers help us improve. It takes about two minutes.',thanks:'Thank you for your feedback.',category:'General',fields:[
      kF('select','Overall, how satisfied are you with our service?',{req:true,opts:['1 - Very unhappy','2','3','4','5 - Very happy']}),kF('yesno','Would you recommend us to others?',{req:true}),
      kF('long','What did we do well?'),kF('long','What could we do better?'),kF('email','Email address (optional, if you want a reply)')]}),
    agreement:()=>({title:'Service agreement',desc:'Template skeleton. Fill the bracketed parts and have a legal adviser review it before use. It is not legal advice.',thanks:'Thank you. Your signed agreement has been recorded.',category:'General',fields:[
      kF('head','Parties'),kF('short','Client full name or registered name',{req:true}),kF('short','ID or registration number',{req:true}),kF('long','Address',{req:true}),
      kF('head','Agreement'),para('1. Services. '+COMPANY+' will provide the following services: [describe the services].'),para('2. Fees. The client will pay [fees and payment terms]. Fees are in Namibian dollars.'),
      para('3. Term. This agreement starts on [start date] and continues until [end date or notice period].'),para('4. Confidentiality. Each party will keep the other\'s confidential information private, except where the law requires disclosure.'),
      para('5. Changes. Any change must be agreed in writing by both parties.'),kF('yesno','I have read and accept this agreement',{req:true}),kF('sign','Client signature',{req:true}),kF('date','Date signed',{req:true})]}),
    job:()=>({title:'Job application',desc:'Apply for a position with '+COMPANY+'.',thanks:'Thank you. We have received your application.',category:'General',fields:[
      kF('head','About you'),kF('short','Full name',{req:true}),kF('email','Email address',{req:true}),kF('phone','Mobile number',{req:true}),kF('short','Position applying for',{req:true}),kF('number','Years of experience'),
      kF('head','Documents'),kF('file','CV',{req:true}),kF('long','Cover letter or motivation')]}),
    incident:()=>({title:'Incident report',desc:'Report what happened as soon as possible.',thanks:'Your report has been received.',category:'General',audience:'staff',fields:[
      kF('date','Date of incident',{req:true}),kF('short','Location',{req:true}),kF('short','People involved'),kF('long','What happened?',{req:true}),kF('short','Witnesses'),kF('long','Action taken'),kF('file','Photo or document')]})
  };
  const TEMPLATE_RE=[[/\bwaiver|release form|indemnity\b/,'waiver'],[/\bpermission slip|consent slip|parental consent\b/,'permission'],[/\bexit ticket\b/,'exit'],[/\b(survey|feedback form|satisfaction|questionnaire)\b/,'survey'],
    [/\b(contract|agreement|engagement letter|service level)\b/,'agreement'],[/\b(job application|application form|recruitment)\b/,'job'],[/\bincident|accident report\b/,'incident']];

  /* ---------- locating a form and a field ---------- */
  const GENERIC=/^(the|this|that|my|our|your|current|new|last|same|a|an|all|every|each|any|these|those|some)$/;
  function findForm(t){
    const fs=forms();
    const m=t.match(/\b(?:in|on|to|for|of|from)\s+(?:the\s+)?["“]?([a-z0-9][a-z0-9 \-']{2,50}?)["”]?\s+(?:form|survey|quiz|questionnaire)\b/);
    if(m&&!GENERIC.test(m[1].trim())){const q=m[1].trim(),f=fs.find(x=>x.title.toLowerCase()===q)||fs.find(x=>x.title.toLowerCase().includes(q));if(f)return f}
    for(const f of fs.slice().reverse()){if(f.title.length>3&&t.includes(f.title.toLowerCase()))return f}
    return fs.find(f=>f.id===ctx.formId)||null;
  }
  function findFormExplicit(t){
    const fs=forms();
    const m=t.match(/\b(?:in|on|to|for|of|from)\s+(?:the\s+)?["“]?([a-z0-9][a-z0-9 \-']{2,50}?)["”]?\s+(?:form|survey|quiz|questionnaire|responses|submissions)\b/);
    if(m&&!GENERIC.test(m[1].trim())){const q=m[1].trim(),f=fs.find(x=>x.title.toLowerCase()===q)||fs.find(x=>x.title.toLowerCase().includes(q));if(f)return f}
    for(const f of fs.slice().reverse()){if(f.title.length>3&&t.includes(f.title.toLowerCase()))return f}
    if(/\bkyc\b/.test(t)){const k=fs.filter(x=>/kyc/i.test(x.title)||x.category==='KYC');const w=k.filter(x=>(state.subs||[]).some(s=>s.formId===x.id));if(w.length===1)return w[0]}
    return null;
  }
  function findField(f,name){
    const q=strip(name).toLowerCase().replace(/\s+(field|question)$/,'').trim();if(!q)return null;
    const fs=f.fields;
    const hit=fs.find(x=>x.label.toLowerCase()===q)||fs.find(x=>x.label.toLowerCase().startsWith(q))||fs.find(x=>x.label.toLowerCase().includes(q))||fs.find(x=>q.includes(x.label.toLowerCase())&&x.label.length>3);
    if(hit)return hit;
    /* "phone", "email", "id", "signature"... mean the field of that kind, whatever it is labelled. */
    const SYN=[[/^(phone|mobile|cell|cellphone|telephone|contact)( number)?$/,'phone'],[/^e-?mail( address)?$/,'email'],[/^(id|passport|id number|id or passport( number)?)$/,'idno'],[/^(signature|sign)$/,'sign'],[/^(files?|uploads?|documents?|attachments?|scan|copy)$/,'file'],[/^(dob|date of birth|birth ?day)$/,'date'],[/^(date)$/,'date'],[/^(number)$/,'number'],[/^(dropdown|select)$/,'select']];
    for(const [re,ty] of SYN){if(re.test(q)){const c=fs.filter(x=>x.type===ty);if(c.length===1)return c[0];if(c.length>1)return c[0]}}
    return null;
  }
  const nofield=(f,q)=>`I could not find a field called "${q}" on **${f.title}**. Its fields are:\n`+list(f.fields.map(x=>x.label||'(untitled)'));
  const noForm=()=>forms().length?'Which form? Name it, for example "make email required in the Individual client KYC form", or create a new one first and I will keep working on that.':'There is no form to change yet. Create one first, for example: "Create a client onboarding form with name, email, phone and a copy of ID".';

  /* ---------- Create ---------- */
  function newForm(spec,audience){
    const f=Object.assign({id:'f'+(++state.kseq+10),status:'open',created:isoToday(),audience:audience||'client',category:'General'},spec);
    forms().push(f);ctx.formId=f.id;try{logA('Form created',f.title+' (assistant)')}catch(_){};refresh();return f;
  }
  const cutName=n=>sc(strip(n.split(/\s+(?:with|including|that|which|containing|asking|collecting|and|for|to)\s+/i)[0]));
  function createFromPrompt(raw){
    const t=raw.toLowerCase();
    const nameM=raw.match(/(?:called|named|titled)\s+["“]?([^"”,.;:]+)/i);
    let tplKey=null;if(/\b(company|business|entity|close corporation|trust)\b.*\b(kyc|onboarding|know your customer)\b|\b(kyc|onboarding)\b.*\b(company|business|entity|close corporation|trust)\b/.test(t))tplKey='co';
    else if(/\b(kyc|know your customer|client onboarding|customer onboarding|onboarding form)\b/.test(t))tplKey='ind';
    else for(const [re,k] of TEMPLATE_RE)if(re.test(t)){tplKey=k;break}
    const itemsM=raw.match(/\b(?:with|including|include|that (?:asks|collects)|asking (?:for|about)|collecting|collect|asks? for|fields?:|containing|requesting|needs?)\s+(.+)$/i);
    let items=itemsM?splitTop(itemsM[1]).map(parseItem).filter(Boolean):[];
    let spec;
    if((tplKey==='ind'||tplKey==='co')&&items.length)tplKey=null;
    if(tplKey==='ind'||tplKey==='co')spec=Object.assign({category:'KYC'},kTemplate(tplKey));
    else if(tplKey)spec=T[tplKey]();
    else{
      let title=nameM?cutName(nameM[1]):null;
      if(!title){const m=raw.match(/(?:an?|the|new)\s+([a-z][a-z \-]{2,40}?)\s+(form|survey|questionnaire|checklist)\b/i);title=m?sc(m[1].trim()+' '+m[2].toLowerCase()):'New form'}
      if(!items.length)items=['Full name','Email','Phone','Message'].map(parseItem);
      if(/\b(kyc|onboarding|know your customer)\b/.test(t)&&!nameM){const kt=raw.match(/(?:an?|the|new)\s+([a-z][a-z \-]{2,40}?)\s+form\b/i);if(kt)title=sc(kt[1].trim()+' form')}
      spec={title,desc:'Please complete the form below.',thanks:'Thank you. Your response has been recorded.',category:'General',fields:[]};
    }
    if(nameM)spec.title=cutName(nameM[1]);
    if(items.length){
      let extra=items.map(mkField);
      if(tplKey&&spec.fields.length){const have=spec.fields.map(x=>x.label.toLowerCase()),single=['email','phone','idno','sign'];
        extra=extra.filter(x=>!have.includes(x.label.toLowerCase())&&!(single.includes(x.type)&&spec.fields.some(y=>y.type===x.type)))}
      if(tplKey&&spec.fields.length){const i=spec.fields.findIndex(x=>x.type==='head'&&/declaration|waiver|agreement/i.test(x.label));if(i>0)spec.fields.splice(i,0,...extra);else spec.fields.push(...extra)}
      else spec.fields.push(...extra);
    }
    if(!tplKey&&spec.fields.length&&!spec.fields.some(x=>x.type==='sign')&&/\b(sign|signature|signed)\b/.test(t)){/*handled by item parse*/}
    const aud=/\b(staff|employee|employees|internal|hr)\b/.test(t)?'staff':(spec.audience||'client');
    if(/\b(kyc|onboarding)\b/.test(t))spec.category='KYC';
    const f=newForm(spec,aud);
    const real=f.fields.filter(x=>!['head','para'].includes(x.type));
    return `Created **${f.title}** (${aud==='staff'?'staff':'client'} form) with ${real.length} question${real.length===1?'':'s'}:\n`+list(f.fields.map(x=>{const lab=KLAB[x.type]||x.type;return x.type==='head'?`Section: ${x.label}`:x.type==='para'?'Text block':`${x.label} (${lab.toLowerCase()}${x.req?', required':''})`}),24)
      +'\n\nOpen **Form builder** to refine it, or **Client KYC** to preview, share or print it. To change it just tell me, for example: "make phone required", "add a dropdown called Source of funds (Salary, Business, Savings)", "show Details only if PEP is Yes", "rename the form to Client intake".'
      +(tplKey&&['waiver','agreement'].includes(tplKey)?'\n\nThis is template wording, not legal advice. Have it reviewed before use.':'')
      +'\n\nNote: forms are kept for this session only until the forms module is saved to the database.';
  }

  /* ---------- Edit ---------- */
  function addCommand(raw,f){
    let body=raw.replace(/^\s*(?:please\s+)?(?:also\s+)?(?:add|insert|include|put in)\s+/i,'').trim();
    let pos=null;
    const pm=body.match(/\s+(?:at the (top|beginning|start)|at the (bottom|end)|after\s+(?:the\s+)?(.+?)|before\s+(?:the\s+)?(.+?))(?:\s+(?:field|question))?\s*(?:in|on|to)?\s*(?:the\s+)?(?:[a-z0-9 ]+form)?\s*$/i);
    if(pm&&(pm[1]||pm[2]||pm[3]||pm[4])){pos=pm[1]?'top':pm[2]?'bottom':pm[3]?{after:pm[3]}:{before:pm[4]};body=body.slice(0,pm.index).trim()}
    body=body.replace(/\s+(?:to|in|on)\s+(?:the\s+)?(?:[a-z0-9 \-']+\s+)?(?:form|survey|quiz)$/i,'');
    let opts=null;const om=body.match(/\s*(?:with (?:the )?(?:options?|choices?)|options?:|choices?:)\s*(.+)$/i);
    if(om){opts=splitTop(om[1]).map(strip);body=body.slice(0,om.index).trim()}
    const sp=parseItem(body);if(!sp)return null;
    if(opts&&opts.length){sp.opts=opts;if(!['select','radio','check'].includes(sp.type))sp.type=opts.length<=4?'radio':'select'}
    const fld=mkField(sp);
    let idx=f.fields.length;
    if(pos==='top')idx=0;else if(pos&&pos.after){const a=findField(f,pos.after);if(a)idx=f.fields.indexOf(a)+1}else if(pos&&pos.before){const a=findField(f,pos.before);if(a)idx=f.fields.indexOf(a)}
    else{const i=f.fields.findIndex(x=>x.type==='sign');if(i>=0&&f.fields.slice(i).every(x=>['sign','para'].includes(x.type)||x.type==='head'))idx=i}
    f.fields.splice(idx,0,fld);
    return fld;
  }
  const TYPEWORDS={'dropdown':'select','drop-down':'select','date':'date','number':'number','email':'email','phone':'phone','long text':'long','paragraph':'long','short text':'short','text':'short','yes/no':'yesno','yes or no':'yesno','file upload':'file','file':'file','upload':'file','signature':'sign','multiple choice':'check','checkboxes':'check','single choice':'radio','radio':'radio'};
  /* If the user names a form that does not exist, say so instead of changing a different one. */
  function missingForm(t){
    const m=t.match(/\b(?:in|on|to|for|of|from)\s+(?:the\s+)?["“]?([a-z0-9][a-z0-9 \-']{2,50}?)["”]?\s+(?:form|survey|quiz|questionnaire)\b/);
    if(!m)return null;const q=m[1].trim();
    if(/^(the|this|that|my|our|current|new|last|same|a|an)$/.test(q))return null;
    return forms().some(x=>x.title.toLowerCase()===q||x.title.toLowerCase().includes(q)||t.includes(x.title.toLowerCase()))?null:q;
  }
  function editForm(raw,t){
    const miss=missingForm(t);
    if(miss)return `I could not find a form called "${miss}". Your forms:\n`+list(forms().map(x=>x.title),20);
    const f=findForm(t);if(!f)return noForm();ctx.formId=f.id;
    raw=raw.replace(/\s+(?:in|on|for|of)\s+(?:the\s+)?["“]?[a-z0-9][a-z0-9 \-']*?["”]?\s+(?:form|survey|quiz|questionnaire)\s*$/i,'');
    let m;
    if((m=raw.match(/^\s*(?:please\s+)?(?:rename|retitle|call)\s+(?:the\s+|this\s+)?(?:[a-z0-9 \-']+\s+)?form\s+(?:to|as)\s+(.+)$/i))||(m=raw.match(/(?:set|change|update)\s+(?:the\s+)?(?:form\s+)?title\s+(?:to|as)\s+(.+)$/i))){
      const old=f.title;f.title=sc(strip(m[1]));refresh();return `Renamed **${old}** to **${f.title}**.`}
    if((m=raw.match(/(?:set|change|update)\s+(?:the\s+)?(?:form\s+)?description\s+(?:to|as)\s+(.+)$/i))){f.desc=strip(m[1]);refresh();return `Updated the description of **${f.title}**.`}
    if((m=raw.match(/(?:set|change|update)\s+(?:the\s+)?(?:thank[- ]?you|confirmation|success)\s+message\s+(?:to|as)\s+(.+)$/i))){f.thanks=strip(m[1]);refresh();return `Updated the thank-you message on **${f.title}**.`}
    if(/\b(close|stop accepting|pause|shut)\b.*\b(form|responses|submissions)\b/.test(t)){f.status='closed';refresh();return `**${f.title}** is now closed and no longer accepts responses. Say "reopen the form" to open it again.`}
    if(/\b(reopen|re-open|open up|start accepting|open)\b.*\b(form|responses|submissions)\b/.test(t)){f.status='open';refresh();return `**${f.title}** is open and accepting responses.`}
    if((m=raw.match(/\bmake\s+(?:all\s+)?(?:the\s+)?(?:questions?|fields?)\s+(?:in\s+.+?\s+)?(friendlier|more friendly|friendly|more formal|formal|shorter|clearer|plainer)\b/i))){
      const mode=/formal/i.test(m[1])?'formal':/short|clear|plain/i.test(m[1])?'short':'friendly';let n=0;
      f.fields.forEach(x=>{if(['head','para','yesno','sign','file'].includes(x.type)||/\?$/.test(x.label))return;
        const base=x.label.replace(/^(please\s+(provide|enter|share|state)\s+(your\s+)?|what is your\s+|kindly\s+(provide|state)\s+(your\s+)?)/i,'').replace(/^your\s+/i,'').replace(/\?$/,'').trim(),lb=base.charAt(0).toLowerCase()+base.slice(1);
        const nl=mode==='formal'?'Please provide your '+lb:mode==='friendly'?'What is your '+lb+'?':sc(base.replace(/\s*\(.*\)$/,''));
        if(nl!==x.label){x.label=nl;n++}});refresh();
      return `Reworded ${n} question${n===1?'':'s'} on **${f.title}** to sound ${mode==='formal'?'more formal':mode==='friendly'?'friendlier':'shorter and plainer'}. Review them in the builder. I use simple patterns, so check the wording.`}
    if((m=raw.match(/^\s*(?:please\s+)?(?:make|set|mark)\s+(?:all\s+)?(?:the\s+)?(?:fields?|questions?)?\s*(.*?)\s+(?:as\s+)?(required|mandatory|optional|not required|compulsory)\s*$/i))){
      const makeReq=!/optional|not required/i.test(m[2]);let target=strip(m[1]).replace(/\s+(field|question)s?$/i,'');
      if(!target||/^(all|every|everything|the fields|fields)$/i.test(target)){let n=0;f.fields.forEach(x=>{if(!['head','para'].includes(x.type)&&x.req!==makeReq){x.req=makeReq;n++}});refresh();return `Marked ${n} field${n===1?'':'s'} on **${f.title}** as ${makeReq?'required':'optional'}.`}
      const x=findField(f,target);if(!x)return nofield(f,target);x.req=makeReq;refresh();return `**${x.label}** is now ${makeReq?'required':'optional'}.`}
    if((m=raw.match(/^\s*(?:please\s+)?(?:show|display)\s+(?:the\s+)?(.+?)\s+only\s+(?:if|when)\s+(?:the\s+)?(.+?)\s+(?:is|=|equals|answer is|is answered|was answered)\s+["“]?(.+?)["”]?\s*$/i))){
      const dep=findField(f,m[1]),trg=findField(f,m[2]);if(!dep)return nofield(f,m[1]);if(!trg)return nofield(f,m[2]);if(dep===trg)return 'A field cannot depend on itself.';
      let val=strip(m[3]);if(trg.type==='yesno')val=/^(y|yes|true)/i.test(val)?'Yes':'No';else if(trg.opts&&trg.opts.length){const o=trg.opts.find(x=>x.toLowerCase()===val.toLowerCase());if(o)val=o}
      dep.showIf={fid:trg.id,val};const di=f.fields.indexOf(dep),ti=f.fields.indexOf(trg);if(di<ti){f.fields.splice(di,1);f.fields.splice(f.fields.indexOf(trg)+1,0,dep)}
      refresh();return `Done. **${dep.label}** now shows only when **${trg.label}** is "${val}".`}
    if((m=raw.match(/^\s*(?:please\s+)?(?:always show|remove (?:the )?(?:rule|logic|condition) (?:on|from|for))\s+(?:the\s+)?(.+?)\s*$/i))){const x=findField(f,m[1]);if(!x)return nofield(f,m[1]);x.showIf=null;refresh();return `**${x.label}** now always shows.`}
    if((m=raw.match(/^\s*(?:please\s+)?(?:move|put)\s+(?:the\s+)?(.+?)\s+(?:field\s+|question\s+)?(?:to\s+the\s+|to\s+|at\s+the\s+)?(top|bottom|start|end|beginning)\s*$/i))||(m=raw.match(/^\s*(?:please\s+)?move\s+(?:the\s+)?(.+?)\s+(after|before)\s+(?:the\s+)?(.+?)\s*$/i))){
      const x=findField(f,m[1]);if(!x)return nofield(f,m[1]);const i=f.fields.indexOf(x);f.fields.splice(i,1);
      if(m[3]===undefined){const top=/top|start|beginning/i.test(m[2]);if(top)f.fields.unshift(x);else f.fields.push(x);refresh();return `Moved **${x.label}** to the ${top?'top':'bottom'}.`}
      const ref=findField(f,m[3]);if(!ref){f.fields.splice(i,0,x);return nofield(f,m[3])}
      const ri=f.fields.indexOf(ref);f.fields.splice(/after/i.test(m[2])?ri+1:ri,0,x);refresh();return `Moved **${x.label}** ${m[2].toLowerCase()} **${ref.label}**.`}
    if((m=raw.match(/^\s*(?:please\s+)?add\s+help(?:\s+text)?\s+(?:to|for|on)\s+(?:the\s+)?(.+?)\s*[:\-]\s*(.+)$/i))){const x=findField(f,m[1]);if(!x)return nofield(f,m[1]);x.help=strip(m[2]);refresh();return `Added help text to **${x.label}**.`}
    if((m=raw.match(/^\s*(?:please\s+)?change\s+(?:the\s+)?(?:type of\s+)?(.+?)\s+(?:field\s+)?to\s+(?:an?\s+)?(dropdown|drop-down|date|number|email|phone|long text|paragraph|short text|text|yes\/no|yes or no|file upload|file|signature|multiple choice|checkboxes|single choice|radio)(?:\s*(?:with (?:the )?(?:options?|choices?)|:)\s*(.+))?\s*$/i))){
      const x=findField(f,m[1]);if(!x)return nofield(f,m[1]);x.type=TYPEWORDS[m[2].toLowerCase()];
      if(m[3])x.opts=splitTop(m[3]).map(strip);if(['select','radio','check'].includes(x.type)&&(!x.opts||x.opts.length<2))x.opts=['Option 1','Option 2'];
      refresh();return `Changed **${x.label}** to ${(KLAB[x.type]||x.type).toLowerCase()}${['select','radio','check'].includes(x.type)?' with options: '+x.opts.join(', '):''}.`}
    if((m=raw.match(/^\s*(?:please\s+)?(?:rename|reword|rewrite|retitle|change)\s+(?:the\s+)?(?:question|field|label|wording of|text of)?\s*["“]?(.+?)["”]?\s+(?:to|as|into|so it says|to say)\s+["“]?(.+?)["”]?\s*$/i))){
      const x=findField(f,m[1]);if(!x)return nofield(f,m[1]);const old=x.label;x.label=sc(strip(m[2]));refresh();return `Reworded "${old}" to "${x.label}".`}
    if((m=raw.match(/^\s*(?:please\s+)?(?:remove|delete|drop|take out|get rid of)\s+(?:the\s+)?(.+?)(?:\s+(?:field|question))?(?:\s+(?:from|in|on)\s+(?:the\s+)?[a-z0-9 \-']*(?:form|survey|quiz))?\s*$/i))){
      const x=findField(f,m[1]);if(!x)return nofield(f,m[1]);f.fields=f.fields.filter(q=>q!==x);f.fields.forEach(q=>{if(q.showIf&&q.showIf.fid===x.id)q.showIf=null});refresh();return `Removed **${x.label}** from **${f.title}**.`}
    if(/^\s*(?:please\s+)?(?:also\s+)?(?:add|insert|include|put in)\s+/i.test(raw)){
      const x=addCommand(raw,f);if(!x)return 'Tell me what to add, for example: "add a phone number" or "add a dropdown called Source of funds with options Salary, Business, Savings".';
      refresh();return `Added **${x.label}** (${(KLAB[x.type]||x.type).toLowerCase()}${x.req?', required':''}${x.opts&&x.opts.length?': '+x.opts.join(', '):''}) to **${f.title}**. It now has ${f.fields.filter(q=>!['head','para'].includes(q.type)).length} questions.`}
    return null;
  }
  const EDIT_RE=/^\s*(?:please\s+)?(?:also\s+)?(?:add|insert|include|put in|remove|delete|drop|take out|get rid of|rename|retitle|reword|rewrite|make|set|mark|show|display|always show|move|put|change|update|close|reopen|re-open|open|stop accepting|pause)\b/i;
  const FORMISH=/\b(field|question|form|survey|quiz|dropdown|required|optional|mandatory|title|description|thank|heading|section|responses|submissions|help text|logic|only if|only when|upload|signature)\b/i;

  /* ---------- Quiz from text ---------- */
  const STOP=new Set('about after again also because before being between could during each every from have having into more most other over same should since some such than that their then there these they this those through under until very were what when where which while will with would your the and for are was has had not but can its our out all any may per use used using'.split(' '));
  const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
  function buildQuiz(text,n){
    const sents=text.replace(/\s+/g,' ').split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(s=>s.length>=35&&s.length<=260);
    const nums=[],caps=[],words=[];
    sents.forEach(s=>{(s.match(/\b\d[\d,.]*%?/g)||[]).forEach(x=>nums.push(x.replace(/[.,]$/,'')));
      (s.slice(s.search(/\s/)).match(/\b[A-Z][a-z]{3,}(?:\s[A-Z][a-z]{2,})*\b/g)||[]).forEach(x=>caps.push(x));
      (s.match(/\b[a-z]{7,}\b/g)||[]).forEach(w=>{if(!STOP.has(w))words.push(w)})});
    const uniq=a=>[...new Set(a)];const U={num:uniq(nums),cap:uniq(caps),word:uniq(words)};
    const qs=[];
    for(const s of shuffle(sents)){
      if(qs.length>=n)break;
      let kind=null,ans=null;
      const nm=(s.match(/\b\d[\d,.]*%?/g)||[]).map(x=>x.replace(/[.,]$/,'')).filter(Boolean);
      const cp=(s.slice(s.search(/\s/)).match(/\b[A-Z][a-z]{3,}(?:\s[A-Z][a-z]{2,})*\b/g)||[]);
      const wd=(s.match(/\b[a-z]{7,}\b/g)||[]).filter(w=>!STOP.has(w));
      if(nm.length){kind='num';ans=nm[0]}else if(cp.length){kind='cap';ans=cp[0]}else if(wd.length){kind='word';ans=wd.sort((a,b)=>b.length-a.length)[0]}else continue;
      let dis=[];
      if(kind==='num'){const v=parseFloat(ans.replace(/[,%]/g,''));if(!isNaN(v)){const suf=ans.endsWith('%')?'%':'';const yr=/^(19|20)\d\d$/.test(ans),c=yr?[v+1,v-1,v+2,v-2,v+5,v-5]:v>=100?[Math.round(v*1.1),Math.round(v*0.9),Math.round(v*2),Math.round(v/2),Math.round(v*1.25),Math.round(v*0.75)]:[v+1,v-1,v+2,v*2,Math.max(0,v-2),Math.round(v/2)];dis=uniq(c.filter(x=>x!==v&&x>=0).map(x=>String(x)+suf))}}
      dis=dis.concat(shuffle(U[kind].filter(x=>x!==ans&&!s.includes(x))));
      dis=uniq(dis).filter(x=>x!==ans).slice(0,3);
      if(dis.length<3)continue;
      const q=s.replace(ans,'_____');if(q===s)continue;
      qs.push({q,ans,opts:shuffle([ans,...dis])});
    }
    return qs;
  }
  function makeQuiz(raw){
    const nM=raw.match(/\b(\d{1,2})\s+(?:quiz\s+)?questions?\b/i),n=Math.min(15,Math.max(1,nM?+nM[1]:5));
    let text=raw;const ci=raw.search(/[:\n]/);
    const lead=raw.match(/\b(?:from|using|based on|about|on)\s+(?:this|the following|these)(?:\s+text|\s+notes|\s+document|\s+passage|\s+content)?\s*[:,\-]?\s*/i);
    if(lead)text=raw.slice(lead.index+lead[0].length);else if(ci>=0&&ci<80)text=raw.slice(ci+1);
    text=text.trim();
    if(text.length<150)return 'To make a quiz, paste the text after the request, for example:\n"Make a 5 question quiz from this text: <paste your notes or document text here>".\nI need a few sentences (at least about 150 characters) to work from. I cannot read PDFs or Word files yet, so paste the text.';
    const qs=buildQuiz(text,n);
    if(!qs.length)return 'I could not find enough facts in that text to build good questions (I look for numbers, names and key terms). Try a longer passage with specific details.';
    const title='Quiz: '+sc(text.split(/\s+/).slice(0,5).join(' ').replace(/[^\w\s'-]/g,'').trim());
    const spec={title,desc:'Choose the best answer for each question.',thanks:'Thank you. Your answers have been recorded.',category:'Quiz',fields:[kF('short','Your name',{req:true}),...qs.map((x,i)=>Object.assign(kF('radio','Q'+(i+1)+'. '+x.q,{req:true,opts:x.opts}),{answer:x.ans}))]};
    const f=newForm(spec,'client');ctx.lastQuiz={id:f.id,key:qs.map((x,i)=>`Q${i+1}: ${x.ans}`)};
    return `Created **${f.title}** with ${qs.length} multiple-choice question${qs.length===1?'':'s'}. Open **Form builder** to refine it, or **Client KYC** to preview and share it.\n\n**Answer key (keep private):**\n`+list(ctx.lastQuiz.key,15)
      +'\n\nQuestions are made by blanking out a fact in a sentence, so read them over and edit any that sound odd. Automatic marking is not built yet: compare responses to the key above.'
      +(qs.length<n?`\n\nI could only build ${qs.length} of the ${n} you asked for from that text.`:'');
  }

  /* ---------- Emails ---------- */
  function wantsEmail(t){
    const v=t.match(/\b(write|draft|generate|create|compose|make)\b/),e=t.match(/\b(email|e-mail|autoresponder|auto-responder)\b/);
    if(!v||!e||e.index<v.index)return false;
    const prefix=t.slice(v.index,e.index);
    if(/\b(form|survey|quiz|waiver|questionnaire|with|including|asking|collect\w*|contain\w*|field|question)\b/.test(prefix))return false;
    if(/\b(email|e-mail)\s+(field|question|address)\b|\b(required|optional|mandatory)\b/.test(t))return false;
    return true;
  }
  function draftEmail(raw,t){
    const f=findFormExplicit(t)||findForm(t),fname=f?f.title:'the form';
    const kind=/\b(follow[- ]?up|nudge|chase)\b/.test(t)?'followup':/\b(reminder|missing|incomplete|outstanding)\b/.test(t)?'reminder':/\b(approv|accepted|welcome)\b/.test(t)?'approved':/\b(reject|declin|unsuccessful|regret)\b/.test(t)?'declined':'confirm';
    const sig=`Kind regards\n[Your name]\n${COMPANY}\nWindhoek, Namibia`;
    const E_={
      confirm:[`We received your ${fname}`,`Dear [Name],\n\nThank you for completing our ${fname}. We have received it (reference [Reference]) and will review it shortly. We will contact you if we need anything else.\n\n${sig}`],
      followup:[`Following up on your ${fname}`,`Dear [Name],\n\nWe are following up on the ${fname} you sent us. Is there anything you need from us to move forward? Please reply to this email and we will help.\n\n${sig}`],
      reminder:[`Action needed: please complete your ${fname}`,`Dear [Name],\n\nYour ${fname} is not complete yet. We still need: [list the missing items]. Please send them by [date] so we can finish the review.\n\n${sig}`],
      approved:[`Your ${fname} has been approved`,`Dear [Name],\n\nGood news. Your ${fname} (reference [Reference]) has been reviewed and approved. [Add next steps.]\n\n${sig}`],
      declined:[`Update on your ${fname}`,`Dear [Name],\n\nThank you for your ${fname}. After review we are unable to proceed at this time because [reason]. If you believe this is a mistake, or you can provide more information, please reply to this email.\n\n${sig}`]
    }[kind];
    return `Here is a draft ${kind==='confirm'?'confirmation (autoresponder)':kind} email. Replace the [bracketed] parts:\n\n**Subject:** ${E_[0]}\n\n${E_[1]}\n\nI cannot send emails from here yet: copy this into your email program.`;
  }

  /* ---------- Analysis of responses ---------- */
  const POS=new Set('good great excellent happy satisfied love loved helpful fast quick friendly easy smooth professional thank thanks pleased wonderful recommend amazing perfect efficient clear prompt'.split(' '));
  const NEG=new Set('bad poor slow terrible unhappy angry rude difficult confusing late problem problems issue issues complaint disappointed worst delay delayed unhelpful frustrating expensive broken wrong messy unclear'.split(' '));
  function sentiment(texts){
    let p=0,n=0;const freq={};
    texts.forEach(tx=>{const w=String(tx).toLowerCase().match(/[a-z']+/g)||[];w.forEach((x,i)=>{const neg=i>0&&/^(not|no|never|hardly)$/.test(w[i-1]);
      if(POS.has(x)){neg?n++:p++}else if(NEG.has(x)){neg?p++:n++}
      if(x.length>3&&!STOP.has(x))freq[x]=(freq[x]||0)+1})});
    return {p,n,label:p+n===0?'no clear sentiment':p>n*1.5?'mostly positive':n>p*1.5?'mostly negative':'mixed',top:Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>x[0])};
  }
  const FLAG=/pep|politically|sanction|convict|bankrupt|conflict|criminal/i;
  function analyse(raw,t){
    const fs=forms(),subs=state.subs||[];
    let f=findFormExplicit(t);
    const targets=f?[f]:fs.filter(x=>subs.some(s=>s.formId===x.id));
    if(!targets.length)return 'There are no responses to analyse yet. Once clients submit forms, ask me to "summarise the responses".';
    const report=/\b(report|draft)\b/.test(t),out=[];
    targets.forEach(form=>{
      const ss=subs.filter(s=>s.formId===form.id);if(!ss.length){out.push(`**${form.title}:** no responses yet.`);return}
      const by={};ss.forEach(s=>by[s.status]=(by[s.status]||0)+1);
      const lines=[`**${form.title}** (${ss.length} response${ss.length===1?'':'s'})`,'Status: '+Object.entries(by).map(([k,v])=>`${v} ${k.toLowerCase()}`).join(', ')];
      const pend=ss.filter(s=>s.status==='Pending'&&s.date),td=today(),age=s=>Math.round((new Date((typeof td==='string'?td:td.toISOString().slice(0,10))+'T00:00:00')-new Date(s.date+'T00:00:00'))/864e5);
      const old=pend.filter(s=>age(s)>=3);if(old.length)lines.push(`Attention: ${old.length} pending for 3 or more days (oldest ${Math.max(...old.map(age))} days).`);
      form.fields.forEach(x=>{
        const vals=ss.map(s=>s.ans[x.id]).filter(v=>!(v==null||v===''||(Array.isArray(v)&&!v.length)));if(!vals.length)return;
        if(['select','radio','yesno','check'].includes(x.type)){
          const c={};vals.flat().forEach(v=>c[v]=(c[v]||0)+1);const top=Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,4);
          lines.push(`${x.label}: `+top.map(([k,v])=>`${k} ${v} (${Math.round(v/vals.length*100)}%)`).join(', '));
          if(x.type==='yesno'&&FLAG.test(x.label)&&c.Yes)lines.push(`Check: ${c.Yes} answered Yes to "${x.label}". Review those carefully.`);
        }else if(x.type==='number'){const nn=vals.map(Number).filter(v=>!isNaN(v));if(nn.length)lines.push(`${x.label}: average ${(nn.reduce((a,b)=>a+b,0)/nn.length).toFixed(2)}, from ${Math.min(...nn)} to ${Math.max(...nn)}`)}
        else if(x.type==='long'){const sn=sentiment(vals);if(sn.p+sn.n>0)lines.push(`${x.label}: ${sn.label} (${sn.p} positive, ${sn.n} negative words). Common words: ${sn.top.join(', ')}`)}
      });
      form.fields.filter(x=>x.type==='idno').forEach(x=>{const c={};ss.forEach(s=>{const v=s.ans[x.id];if(v)c[v]=(c[v]||0)+1});const d=Object.entries(c).filter(([,v])=>v>1);if(d.length)lines.push(`Check: possible duplicate ${x.label.toLowerCase()} (${d.map(([k])=>k).join(', ')}).`)});
      out.push(lines.map((l,i)=>i?'- '+l:l).join('\n'));
    });
    return (report?'**Draft report: form responses**\n\n':'')+out.join('\n\n')+'\n\nThis counts the responses in the Client KYC list. Sentiment is a simple word count, so treat it as a rough guide.';
  }

  /* ---------- Intents (admin only; they run before the built-in ones) ---------- */
  const NOT_POSSIBLE=/\b(whatsapp|messenger|instagram|wordpress|voice agent|phone (call|agent)|chat ?bot|ai agent|customer service bot|live chat|hand ?off|escalat\w*|omni-?channel|app builder|portal builder|24\/7 (bot|agent))\b/;
  [
    {id:'limits',admin:true,test:t=>/\b(form|survey|quiz)\b/.test(t)&&/\b(styl\w+|colou?r|theme|font|branding|logo|submission limit|limit submissions|expir\w+|expiry|deadline|close (on|at|after)|access control|password protect)\b/.test(t)&&!/\bhow\b/.test(t),
      run:async()=>'Not available yet: per-form styling, submission limits, expiry dates and access lists. Forms use the Virtuoso navy and gold look, and I can close a form for you ("close the form") or reopen it.'},
    {id:'agents',admin:true,test:t=>NOT_POSSIBLE.test(t),
      run:async()=>'I cannot do that. Chat and phone agents, WhatsApp, Messenger, Instagram or website bots, live-chat handoff and the app builder need an AI model, outside accounts and a server, and none are connected. I can build and edit forms from your descriptions, make document templates and quizzes, draft emails and summarise responses. Say "help" for examples.'},
    {id:'email',admin:true,test:t=>!/^how\b/.test(t)&&wantsEmail(t),run:async(raw,t)=>draftEmail(raw,t)},
    {id:'quiz',admin:true,test:t=>!/^how\b/.test(t)&&/\b(quiz|test|exam|assessment)\b/.test(t)&&/\b(make|create|build|generate|turn)\b/.test(t)&&/\b(from|using|based on|about|this|following|text|notes|document|passage)\b/.test(t),run:async raw=>makeQuiz(raw)},
    {id:'analyse',admin:true,test:t=>!/^how\b/.test(t)&&/\b(summar\w+|analy[sz]\w*|insights?|breakdown|sentiment|patterns?|draft (a )?report|report on)\b/.test(t)&&/\b(responses?|submissions?|answers|forms?|kyc|surveys?|feedback)\b/.test(t),run:async(raw,t)=>analyse(raw,t)},
    {id:'create',admin:true,test:(t,raw)=>!/^how\b/.test(t)&&/\b(create|make|build|generate|draft|set up|new|design)\b/.test(t)&&/\b(form|survey|questionnaire|waiver|release|permission slip|exit ticket|agreement|contract|engagement letter|checklist|kyc|onboarding|application|incident)\b/.test(t)&&!/\b(quiz)\b/.test(t)&&!wantsEmail(t)&&!/^\s*(make|set|mark|show|display)\s+(all\s+)?(the\s+)?\w+.*\b(required|optional|mandatory|only if|only when|friendlier|formal|shorter)\b/i.test(raw),
      run:async raw=>createFromPrompt(raw)},
    {id:'edit',admin:true,test:(t,raw)=>!/^how\b/.test(t)&&((EDIT_RE.test(raw)&&(FORMISH.test(raw)||ctx.formId)&&!/\b(petty|payroll|employees?|staff|users?|leave|timesheets?|stationery|billing|cash|advance|loans?|passwords?|stock)\b/.test(t))||/^\s*(rename|retitle)\s+(the\s+)?(this\s+)?form\b/i.test(raw)),
      run:async(raw,t)=>{const r=editForm(raw,t);return r||'I did not understand that change. Try: "add a phone number", "remove the nationality field", "make email required", "rename X to Y", "move X to the top", "show Details only if PEP is Yes", or "rename the form to Client intake".'}},
    {id:'forms-help',test:t=>/\b(what|which)\b.*\b(forms?|templates?)\b.*\b(can|do)\b|form builder|what can you build/.test(t)||/^how\b.*\b(form|forms|quiz|survey|waiver|template|templates)\b/.test(t),
      run:async()=>{const fs=forms();return 'I can build and change forms from plain language:\n- **Create:** "Create a client onboarding form with name, email, phone and a copy of ID", or ask for a waiver, permission slip, exit ticket, survey, service agreement, job application or incident report.\n- **Change:** "add a dropdown called Source of funds (Salary, Business, Savings)", "make phone required", "show Details only if PEP is Yes", "move X to the top", "rename the form to Client intake", "close the form".\n- **Quiz:** "Make a 5 question quiz from this text: …"\n- **Emails:** "Draft a confirmation email for the KYC form".\n- **Analyse:** "Summarise the KYC responses".\n\nYou have '+fs.length+' form'+(fs.length===1?'':'s')+' now. Not available: chat and phone agents, WhatsApp, app builder.'}}
  ].reverse().forEach(E.addIntent);
  const TEMPLATES=[['ind','Individual client KYC','Personal details, source of funds, ID and address documents, declaration and signature.'],['co','Company client KYC','Entity details, ownership, turnover, registration documents and an authorised signature.'],
    ['waiver','Waiver and release','Participant details, waiver wording to adapt, acceptance and signature.'],['permission','Permission slip','Participant, guardian, activity, medical notes, emergency contact and consent.'],
    ['exit','Exit ticket','Three quick questions: what stuck, what is unclear, how well it was understood.'],['survey','Feedback survey','Satisfaction rating, recommendation and two open comments.'],
    ['agreement','Service agreement','Parties, services, fees, term and confidentiality skeleton with a signature.'],['job','Job application','Contact details, position, experience, CV upload and motivation.'],['incident','Incident report','Date, place, people, what happened, action taken and a photo.']];
  function useTemplate(key){
    const spec=(key==='ind'||key==='co')?Object.assign({category:'KYC'},kTemplate(key)):T[key]();
    const f=newForm(spec,spec.audience||'client');
    return `Created **${f.title}** from the template with ${f.fields.filter(x=>!['head','para'].includes(x.type)).length} questions.`+(['waiver','agreement'].includes(key)?'\n\nThis is template wording, not legal advice. Have it reviewed before use.':'');
  }
  window.VIRTUOSO_FORMS={ctx,forms,TEMPLATES,createFromPrompt,useTemplate,editForm,makeQuiz,draftEmail,analyse,findFormExplicit};
  E.addHints(['Create a client onboarding form with name, email, phone and a copy of ID','Create a waiver form','Summarise the KYC responses','Draft a confirmation email for the KYC form','What can you build with forms?']);
})();
