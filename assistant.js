/* Virtuoso assistant panel. Talks to the `assistant` Edge Function, which holds the AI key and
   queries data as the signed-in user. Nothing sensitive is stored in the browser. */
(function(){
  const cfg=()=>window.VIRTUOSO||{};
  const ready=()=>!!(cfg().supabaseUrl&&cfg().getAccessToken);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const md=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^[-*] (.+)$/gm,'• $1').replace(/\n/g,'<br>');
  const HINTS={
    adm:['What is blocking payroll this month?','Who has unapproved timesheets?','Any overdue cash advances or low stock?','Summarise petty cash for the current month'],
    emp:['How much leave do I have left?','What is the status of my requests?','How many hours have I logged this week?','What stationery is running low?']
  };
  const history=[];let busy=false,introFor=null;

  const css=document.createElement('style');
  css.textContent=`
  #aiBtn{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:30;border:0;border-radius:999px;padding:12px 18px;font:600 14px/1 inherit;background:var(--accent);color:var(--accent-fg);box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer;display:none}
  #aiBtn.on{display:block}
  #aiPanel{position:fixed;right:16px;bottom:calc(72px + env(safe-area-inset-bottom,0px));z-index:31;width:min(400px,calc(100vw - 32px));height:min(560px,calc(100vh - 120px));display:none;flex-direction:column;background:var(--surface);color:var(--fg);border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.3);overflow:hidden}
  #aiPanel.on{display:flex}
  #aiPanel .ah{padding:10px 14px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;font-weight:600}
  #aiPanel .ah small{font-weight:400;color:var(--muted)}
  #aiLog{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
  #aiLog .m{max-width:92%;padding:8px 11px;border-radius:10px;font-size:14px;line-height:1.45;word-wrap:break-word}
  #aiLog .u{align-self:flex-end;background:var(--accent);color:var(--accent-fg)}
  #aiLog .a{align-self:flex-start;background:var(--bg);border:1px solid var(--line)}
  #aiLog .s{align-self:flex-start;font-size:12px;color:var(--muted)}
  #aiLog .h{align-self:flex-start;border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:999px;padding:6px 11px;font-size:13px;cursor:pointer;text-align:left}
  #aiForm{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line)}
  #aiForm input{flex:1}
  #aiForm button{border:0;border-radius:6px;padding:0 14px;background:var(--accent);color:var(--accent-fg);font-weight:600;cursor:pointer}
  #aiForm button:disabled{opacity:.5;cursor:default}`;
  document.head.appendChild(css);

  const btn=document.createElement('button');btn.id='aiBtn';btn.type='button';btn.textContent='Ask Virtuoso';btn.setAttribute('aria-expanded','false');
  const panel=document.createElement('div');panel.id='aiPanel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Virtuoso assistant');
  panel.innerHTML=`<div class="ah"><span>Virtuoso assistant</span><small>read-only</small></div><div id="aiLog" aria-live="polite"></div><form id="aiForm"><input id="aiIn" placeholder="Ask about payroll, leave, cash, stock…" autocomplete="off" maxlength="1000" aria-label="Your question"><button id="aiSend">Send</button></form>`;
  document.body.append(btn,panel);
  const log=panel.querySelector('#aiLog'),inp=panel.querySelector('#aiIn'),send=panel.querySelector('#aiSend');

  function add(cls,html){const d=document.createElement('div');d.className='m '+cls;d.innerHTML=html;log.appendChild(d);log.scrollTop=log.scrollHeight;return d}
  function note(t){const d=document.createElement('div');d.className='s';d.textContent=t;log.appendChild(d);log.scrollTop=log.scrollHeight;return d}
  function intro(){
    log.innerHTML='';introFor=ready();
    if(!ready()){add('a','The assistant needs the live backend, which is not connected yet. In this demo it cannot answer. Once Supabase is configured (see <code>config.js</code>), ask me about payroll, timesheets, leave, petty cash, stationery and KYC. I can read and analyse your data but never change it.');return}
    add('a','Hi. Ask me anything about the data you have access to. I look things up and calculate, I do not guess, and I never change records.');
    const role=(typeof state!=='undefined'&&state.role==='adm')?'adm':'emp';
    HINTS[role].forEach(t=>{const b=document.createElement('button');b.type='button';b.className='h';b.textContent=t;b.onclick=()=>ask(t);log.appendChild(b)});
  }
  async function ask(text){
    text=(text||'').trim();if(!text||busy||!ready())return;
    busy=true;send.disabled=true;inp.value='';
    log.querySelectorAll('.h').forEach(x=>x.remove());
    add('u',esc(text));history.push({role:'user',content:text});
    const wait=note('Looking into it…');
    try{
      const token=await cfg().getAccessToken();
      if(!token)throw new Error('Please sign in again.');
      const r=await fetch(cfg().supabaseUrl.replace(/\/$/,'')+'/functions/v1/assistant',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,apikey:cfg().anonKey||''},body:JSON.stringify({messages:history.slice(-20)})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||'The assistant is unavailable right now.');
      history.push({role:'assistant',content:j.reply});
      wait.remove();add('a',md(j.reply));
      if(j.looked_at&&j.looked_at.length)note('Checked: '+[...new Set(j.looked_at.map(x=>x.split(':')[1]||x))].join(', '));
    }catch(e){wait.remove();history.pop();add('a',esc(e instanceof TypeError?'I could not reach the assistant service. It may not be deployed yet or you may be offline. Ask your administrator to check that the assistant function is deployed.':(e.message||'Something went wrong.')))}
    busy=false;send.disabled=false;inp.focus();
  }
  btn.onclick=()=>{const on=panel.classList.toggle('on');btn.setAttribute('aria-expanded',on);if(on){if(!log.children.length||introFor!==ready())intro();inp.focus()}};
  panel.querySelector('#aiForm').onsubmit=e=>{e.preventDefault();ask(inp.value)};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('on'))btn.click()});

  /* Show only when signed in; clear the conversation on sign-out. */
  let was=false;
  setInterval(()=>{
    const inn=typeof state!=='undefined'&&!!state.user&&!state.user.mustChange;
    btn.classList.toggle('on',inn);
    if(was&&!inn){history.length=0;log.innerHTML='';panel.classList.remove('on')}
    was=inn;
  },800);
})();
