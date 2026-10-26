/* FORM BUILDER page (admins). Every form tool in one place: build from a description, templates,
   change a form in plain language, quiz from pasted text, email drafts, response summary and report.
   Uses the same engine as the assistant (assistant-forms.js), so results match. Rule-based: no AI service.
   Forms are kept in this session until the forms module is saved to the database. */
(function(){
  const F=()=>window.VIRTUOSO_FORMS;
  if(!F())return;
  const esc2=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const md=s=>esc2(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^[-*] (.+)$/gm,'&bull; $1').replace(/\n/g,'<br>');
  const TABS=[['create','Create'],['templates','Templates'],['change','Change a form'],['quiz','Quiz'],['emails','Emails'],['responses','Responses']];
  const FB={tab:'create',v:{},out:{},formId:null};
  const val=(k,d='')=>FB.v[k]===undefined?d:FB.v[k];
  const forms=()=>F().forms();
  const subsOf=f=>(state.subs||[]).filter(s=>s.formId===f.id);
  const real=f=>f.fields.filter(x=>!['head','para'].includes(x.type));
  const pickForm=()=>{const fs=forms();return fs.find(f=>f.id===FB.formId)||fs.find(f=>f.id===F().ctx.formId)||fs[fs.length-1]||null};
  const out=(k)=>FB.out[k]?`<div class="panel" style="margin-top:12px;background:var(--bg)"><div style="line-height:1.55" id="fbOut-${k}">${md(FB.out[k].text)}</div>
    <div class="row" style="margin-top:10px">${FB.out[k].formId?`<button class="btn sm" data-act="fbOpen" data-id="${esc(FB.out[k].formId)}">Open in builder</button>`:''}<button class="btn ghost sm" data-act="fbCopy" data-k="${k}">Copy text</button></div></div>`:'';
  const formSelect=(id,opts={})=>{const fs=forms(),cur=pickForm();
    return `<select id="${id}" data-fbv="${id}" aria-label="Form">${opts.all?`<option value="">All forms with responses</option>`:''}${fs.map(f=>`<option value="${esc(f.id)}" ${(opts.all?val(id)===f.id:(cur&&cur.id===f.id))?'selected':''}>${esc(f.title)}${f.status==='closed'?' (closed)':''}</option>`).join('')}</select>`};
  const examples=(list,id)=>`<div class="row" style="flex-wrap:wrap;margin:6px 0">${list.map(t=>`<button type="button" class="btn ghost sm" data-act="fbEx" data-t="${esc(id)}" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;

  function section(){
    const tab=FB.tab;
    if(tab==='create')return `<div class="panel"><h3>Create a form from a description</h3>
      <p class="note" style="margin-top:0">Say what the form is for and what it should ask. Name the fields you want, and I build it.</p>
      <label class="wide">Describe your form<textarea id="fbPrompt" data-fbv="fbPrompt" rows="3" maxlength="1000" placeholder="e.g. Create a client onboarding form with name, email, phone, source of funds (Salary, Business, Savings) and a copy of ID">${esc2(val('fbPrompt'))}</textarea></label>
      ${examples(['Create a client onboarding form with name, email, phone and a copy of ID','Create a staff survey called Office feedback with rating, what do you like, comments','Create a contact form with name, email and message'],'fbPrompt')}
      <button class="btn" data-act="fbCreate">Build form</button>${out('create')}</div>`;
    if(tab==='templates')return `<div class="panel"><h3>Templates</h3><p class="note" style="margin-top:0">Start from a ready-made form, then change it. Wording for waivers and agreements is a starting point, not legal advice.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">${F().TEMPLATES.map(([k,t,d])=>`<div style="border:1px solid var(--line);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:6px"><b>${esc(t)}</b><span class="note">${esc(d)}</span><div><button class="btn sm" data-act="fbTpl" data-k="${k}">Use template</button></div></div>`).join('')}</div>${out('templates')}</div>`;
    if(tab==='change'){const f=pickForm();
      return `<div class="panel"><h3>Change a form in plain language</h3>${f?`
      <label>Form${formSelect('fbForm')}</label>
      <label class="wide">What should change?<input id="fbEdit" data-fbv="fbEdit" maxlength="300" value="${esc2(val('fbEdit'))}" placeholder="e.g. add a dropdown called Source of funds with options Salary, Business, Savings"></label>
      ${examples(['make phone required','add a phone number','remove the nationality field','rename Full name to Your full legal name','move Signature to the bottom','show Give details only if politically exposed is Yes','make all questions friendlier','rename the form to Client intake','close the form'],'fbEdit')}
      <div class="row"><button class="btn" data-act="fbApply">Apply change</button><button class="btn ghost" data-act="fbStatus" data-id="${esc(f.id)}">${f.status==='closed'?'Reopen the form':'Close the form'}</button><button class="btn ghost" data-act="fbOpen" data-id="${esc(f.id)}">Open in builder</button></div>${out('change')}
      <h3 style="margin-top:16px">${esc(f.title)} <span class="note">${real(f).length} questions, ${f.status==='closed'?'closed':'accepting responses'}</span></h3>
      <ol style="margin:0;padding-left:20px;line-height:1.7">${f.fields.map(x=>{const dep=x.showIf?f.fields.find(q=>q.id===x.showIf.fid):null;return `<li>${x.type==='head'?'<b>Section: '+esc(x.label)+'</b>':x.type==='para'?'<span class="note">Text block</span>':esc(x.label)+' <span class="note">('+esc((KLAB[x.type]||x.type).toLowerCase())+(x.req?', required':'')+(x.opts&&x.opts.length?': '+esc(x.opts.join(', ')):'')+(dep?'; shown only if '+esc(dep.label)+' is '+esc(x.showIf.val):'')+')</span>'}</li>`}).join('')}</ol>`
      :'<p class="note">There are no forms yet. Create one on the Create or Templates tab.</p>'}</div>`}
    if(tab==='quiz')return `<div class="panel"><h3>Quiz from text</h3>
      <p class="note" style="margin-top:0">Paste notes or document text. I turn facts (numbers, names, key terms) into multiple-choice questions and give you a private answer key. I cannot read PDF or Word files yet, so paste the text. Automatic marking is not built yet.</p>
      <label class="wide">Text to build the quiz from<textarea id="fbQuizText" data-fbv="fbQuizText" rows="8" maxlength="8000" placeholder="Paste at least a few sentences with specific facts...">${esc2(val('fbQuizText'))}</textarea></label>
      <label style="max-width:200px">Number of questions<select id="fbQuizN" data-fbv="fbQuizN">${[3,5,8,10,15].map(n=>`<option ${+val('fbQuizN',5)===n?'selected':''}>${n}</option>`).join('')}</select></label>
      <button class="btn" data-act="fbQuiz">Build quiz</button>${out('quiz')}</div>`;
    if(tab==='emails')return `<div class="panel"><h3>Email and autoresponder drafts</h3>
      <p class="note" style="margin-top:0">I write the text; copy it into your email program. Sending email from here is not available yet. Replace the [bracketed] parts.</p>
      <div class="form"><label>Type of email<select id="fbMailKind" data-fbv="fbMailKind">${[['confirm','Confirmation (autoresponder)'],['followup','Follow-up'],['reminder','Reminder for missing items'],['approved','Approved'],['declined','Declined']].map(([k,l])=>`<option value="${k}" ${val('fbMailKind','confirm')===k?'selected':''}>${l}</option>`).join('')}</select></label>
      <label>Form${forms().length?formSelect('fbMailForm'):''}</label></div>
      <button class="btn" data-act="fbMail">Draft email</button>${out('emails')}</div>`;
    return `<div class="panel"><h3>Responses: summary and report</h3>
      <p class="note" style="margin-top:0">Counts answers, flags things to check (for example politically exposed "Yes" answers, duplicate IDs and old pending items) and gives a rough sentiment for comments. It uses the responses in the Client KYC list.</p>
      <label>Form${formSelect('fbRespForm',{all:true})}</label>
      <label class="chk"><input type="checkbox" id="fbReport" data-fbv="fbReport" ${val('fbReport')?'checked':''}> Draft as a report</label>
      <button class="btn" data-act="fbAnalyse">Analyse responses</button>${out('responses')}</div>`;
  }

  function vFormBuilder(){
    const fs=forms();
    return `<h2>Form builder</h2><p class="sub">Build and change forms in plain language: descriptions, templates, quizzes, emails and response summaries. No AI service or key is used; I understand common phrasings and will say when I do not.</p>
    <div class="stack">
    <div class="row" role="tablist" aria-label="Form builder sections" style="flex-wrap:wrap">${TABS.map(([k,l])=>`<button class="btn ${FB.tab===k?'':'ghost'}" role="tab" aria-selected="${FB.tab===k}" data-act="fbTab" data-t="${k}">${l}</button>`).join('')}</div>
    ${section()}
    <div class="panel"><h3>Your forms</h3><div class="tbl"><table style="min-width:680px"><thead><tr><th>Form</th><th>For</th><th class="n">Questions</th><th class="n">Responses</th><th>Status</th><th></th></tr></thead><tbody>
    ${fs.map(f=>`<tr><td>${esc(f.title)}<div class="note">${esc(f.category||'General')}</div></td><td>${f.audience==='staff'?'Staff':'Clients'}</td><td class="n">${real(f).length}</td><td class="n">${subsOf(f).length}</td><td>${pill(f.status==='closed'?'Closed':'Accepting',f.status==='closed'?'warn':'ok')}</td>
      <td><div class="row"><button class="btn sm ghost" data-act="fbPick" data-id="${esc(f.id)}">Change</button><button class="btn sm ghost" data-act="fbOpen" data-id="${esc(f.id)}">Open in builder</button></div></td></tr>`).join('')||'<tr><td colspan="6" class="note">No forms yet.</td></tr>'}
    </tbody></table></div></div>
    <div class="panel"><p class="note" style="margin:0"><b>Not available:</b> chat and phone agents, WhatsApp, Messenger, Instagram and website bots, live-chat handoff, an app builder, reading PDF or Word files, per-form styling, and submission limits or expiry dates. These need an AI model, outside accounts and a server. Forms are kept for this session until the forms module is saved to the database.</p></div>
    </div>`;
  }

  /* ---------- wire into the app ---------- */
  const ICONP='<path d="M5 19l9-9"/><path d="M13 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/><path d="M18 12l.7 1.3L20 14l-1.3.7L18 16l-.7-1.3L16 14l1.3-.7z"/>';
  ICON.formbuilder=ICONP;
  const people=NAV.adm.find(g=>g[0]==='People');
  if(people&&!people[1].some(x=>x[0]==='formbuilder')){const i=people[1].findIndex(x=>x[0]==='kyc');people[1].splice(i+1,0,['formbuilder','Form builder'])}
  VIEWS.formbuilder=vFormBuilder;

  const go=(fn)=>{try{fn()}catch(e){console.error(e)}render()};
  const openBuilder=id=>{kInit();state.kyc.formId=id;state.kyc.view='build';state.tab.adm='kyc';document.body.classList.remove('open');window.scrollTo(0,0);render()};
  function run(key,fn){
    let text;try{text=fn()}catch(e){console.error(e);text='Something went wrong building that. Try rephrasing.'}
    const id=F().ctx.formId;FB.out[key]={text,formId:/^Created/.test(text)?id:null};
    if(/^Created/.test(text))FB.formId=id;render();
  }
  document.addEventListener('input',e=>{const t=e.target;if(t&&t.dataset&&t.dataset.fbv)FB.v[t.dataset.fbv]=t.type==='checkbox'?t.checked:t.value},true);
  document.addEventListener('change',e=>{
    const t=e.target;if(!(t&&t.dataset&&t.dataset.fbv))return;
    e.stopImmediatePropagation();FB.v[t.dataset.fbv]=t.type==='checkbox'?t.checked:t.value;
    if(t.id==='fbForm'){FB.formId=t.value;F().ctx.formId=t.value;render()}
  },true);
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="fb"]');if(!b)return;
    e.stopImmediatePropagation();const d=b.dataset;
    switch(d.act){
      case 'fbTab':FB.tab=d.t;return render();
      case 'fbEx':FB.v[d.t]=d.v;return render();
      case 'fbPick':FB.formId=d.id;F().ctx.formId=d.id;FB.tab='change';FB.out.change=null;window.scrollTo(0,0);return render();
      case 'fbOpen':return openBuilder(d.id);
      case 'fbCopy':{const t=FB.out[d.k]&&FB.out[d.k].text;if(t&&navigator.clipboard)navigator.clipboard.writeText(t.replace(/\*\*/g,'')).then(()=>toast('Copied'),()=>toast('Copy failed'));return}
      case 'fbCreate':{const p=(val('fbPrompt')||'').trim();if(p.length<8){FB.out.create={text:'Describe the form first, for example: Create a client onboarding form with name, email and phone.',formId:null};return render()}
        const q=/\b(create|make|build|generate|draft|set up|new|design)\b/i.test(p)?p:'Create '+p;return run('create',()=>F().createFromPrompt(q))}
      case 'fbTpl':return run('templates',()=>F().useTemplate(d.k));
      case 'fbApply':{const f=pickForm(),ins=(val('fbEdit')||'').trim();if(!f)return;if(!ins){FB.out.change={text:'Type what should change, or pick an example above.',formId:null};return render()}
        F().ctx.formId=f.id;return run('change',()=>F().editForm(ins,ins.toLowerCase())||'I did not understand that change. Try one of the examples above.')}
      case 'fbStatus':{const f=forms().find(x=>x.id===d.id);if(!f)return;f.status=f.status==='closed'?'open':'closed';FB.out.change={text:`**${f.title}** is now ${f.status==='closed'?'closed and no longer accepts responses':'open and accepting responses'}.`,formId:null};return render()}
      case 'fbQuiz':{const t=(val('fbQuizText')||'').trim(),n=+val('fbQuizN',5);return run('quiz',()=>F().makeQuiz('Make a '+n+' question quiz from this text: '+t))}
      case 'fbMail':{const k=val('fbMailKind','confirm'),f=pickMailForm();const phr={confirm:'confirmation',followup:'follow-up',reminder:'reminder',approved:'approval',declined:'decline'}[k];
        const q='draft a '+phr+' email'+(f?' for the '+f.title+' form':'');return run('emails',()=>F().draftEmail(q,q.toLowerCase()))}
      case 'fbAnalyse':{const id=val('fbRespForm'),f=forms().find(x=>x.id===id),rep=!!val('fbReport');
        const q=(rep?'draft a report on the ':'summarise the ')+(f?f.title+' ':'')+'responses';return run('responses',()=>F().analyse(q,q.toLowerCase()))}
    }
  },true);
  function pickMailForm(){const id=val('fbMailForm');return forms().find(f=>f.id===id)||pickForm()}
})();
