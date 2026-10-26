/* Bruno, the Virtuoso helper: a friendly bear with a chat panel.
   Built-in brain (assistant-engine.js, no AI service or key). Reads data through the signed-in person's permissions
   and never changes records. A "+" menu opens the AI Tools; "Voice" uses the browser's speech-to-text where available. */
(function(){
  const ready=()=>!!window.VIRTUOSO_ENGINE;
  const bear=(px,m)=>window.VIRTUOSO_BEAR?window.VIRTUOSO_BEAR.svg(px,{mood:m}):'';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const md=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^[-*] (.+)$/gm,'• $1').replace(/\n/g,'<br>');
  /* Replies may contain [[tool:key|Label]] markers, shown as buttons that open that AI tool. */
  function replyHTML(t){
    const re=/\[\[tool:([a-z-]+)\|([^\]]+)\]\]/g;let html='',last=0,m;
    while((m=re.exec(t))){html+=md(t.slice(last,m.index))+`<button type="button" class="aitoolbtn" data-tool="${esc(m[1])}">${esc(m[2])}</button>`;last=re.lastIndex}
    return html+md(t.slice(last));
  }
  const history=[];let busy=false,introFor=null,listening=false,rec=null,voiceNoted=false;

  const css=document.createElement('style');
  css.textContent=`
  #aiBtn{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:30;border:0;border-radius:999px;padding:6px 18px 6px 6px;font:700 14px/1 inherit;background:#0a1b3f;color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.3);cursor:pointer;display:none;align-items:center;gap:8px;min-height:52px}
  body.open #aiBtn{display:none!important}
  #aiBtn.on{display:flex}#aiBtn:hover{transform:translateY(-2px)}#aiBtn:focus-visible{outline:3px solid #e6b422;outline-offset:2px}
  #aiBtn .face{width:42px;height:42px;border-radius:50%;background:linear-gradient(180deg,#fff7e0,#f3d9a0);border:2px solid #e6b422;display:grid;place-items:center;overflow:hidden;flex:none}
  body.ai-on #view{padding-bottom:96px}
  #aiPanel{position:fixed;right:16px;bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:31;width:min(410px,calc(100vw - 32px));height:min(640px,calc(100vh - 100px));display:none;flex-direction:column;background:var(--surface);color:var(--fg);border:1px solid var(--line);border-radius:18px;box-shadow:0 14px 40px rgba(0,0,0,.35);overflow:hidden}
  #aiPanel.on{display:flex}
  #aiPanel .ah{padding:8px 10px 8px 12px;background:linear-gradient(90deg,#0a1b3f,#14307a);color:#fff;display:flex;justify-content:space-between;align-items:center;gap:8px}
  #aiPanel .aiid{display:flex;align-items:center;gap:8px}#aiPanel .aiid .mini{width:34px;height:34px;border-radius:50%;background:#f7e3b5;display:grid;place-items:center;overflow:hidden}
  #aiPanel .aiid b{display:block;line-height:1.1}#aiPanel .aiid small{opacity:.8;font-size:11px}
  #aiPanel .ah button{background:rgba(255,255,255,.14);border:0;color:#fff;border-radius:8px;min-width:34px;min-height:34px;cursor:pointer;font-size:15px}
  #aiPanel .ah button:hover{background:rgba(255,255,255,.28)}
  #aiLog{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;background:linear-gradient(180deg,color-mix(in srgb,#e6b422 14%,var(--surface)),var(--surface) 55%)}
  #aiLog .hero{display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px;padding:6px 0 2px}
  #aiLog .hero h3{margin:2px 0 0;font-size:1.25em;color:var(--fg)}#aiLog .hero p{margin:0;font-size:12.5px;color:var(--muted);max-width:30ch}
  #aiLog .mrow{display:flex;gap:8px;align-items:flex-start;align-self:flex-start;max-width:96%}
  #aiLog .mrow .av{width:28px;height:28px;border-radius:50%;background:#f7e3b5;display:grid;place-items:center;overflow:hidden;flex:none;margin-top:2px}
  #aiLog .m{padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.5;word-wrap:break-word;max-width:100%}
  #aiLog .u{align-self:flex-end;background:var(--accent);color:var(--accent-fg);border-bottom-right-radius:4px;max-width:88%}
  #aiLog .a{background:var(--surface);border:1px solid var(--line);border-top-left-radius:4px}
  #aiLog .s{align-self:flex-start;font-size:12px;color:var(--muted);display:flex;align-items:center;gap:8px}
  #aiLog .h{display:flex;align-items:center;gap:10px;width:100%;border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:12px;padding:9px 10px;font-size:13.5px;cursor:pointer;text-align:left;min-height:44px}
  #aiLog .h:hover{border-color:var(--accent);box-shadow:0 2px 8px rgba(0,0,0,.08)}
  #aiLog .h i{font-style:normal;width:26px;height:26px;border-radius:7px;display:grid;place-items:center;color:#fff;font-size:13px;flex:none}
  .aitoolbtn{display:inline-block;margin:6px 6px 0 0;border:1px solid var(--accent);background:transparent;color:var(--accent);border-radius:999px;padding:6px 12px;font:600 13px/1.2 inherit;cursor:pointer;min-height:34px}
  .aitoolbtn:hover{background:var(--accent);color:var(--accent-fg)}
  #aiForm{position:relative;margin:0 10px 10px;border:1px solid var(--line);border-radius:16px;background:var(--surface);padding:8px 10px 8px;box-shadow:0 2px 10px rgba(0,0,0,.08)}
  #aiForm:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}
  #aiForm input#aiIn{width:100%;border:0;background:transparent;color:var(--fg);font:inherit;padding:6px 2px;min-height:38px;box-shadow:none;outline:none}
  #aiForm .airow{display:flex;align-items:center;gap:8px;margin-top:2px}#aiForm .sp{flex:1}
  #aiForm button{border:0;border-radius:999px;font:600 13px/1 inherit;cursor:pointer;min-height:36px;display:inline-flex;align-items:center;gap:6px}
  #aiPlus{width:36px;background:var(--bg);color:var(--fg);font-size:20px!important;border:1px solid var(--line)!important}
  #aiVoice{padding:0 14px;background:var(--bg);color:var(--fg);border:1px solid var(--line)!important}#aiVoice[aria-pressed=true]{background:#c0392b;color:#fff;border-color:#c0392b!important}
  #aiSend{padding:0 16px;background:var(--accent);color:var(--accent-fg)}#aiSend:disabled{opacity:.5;cursor:default}
  #aiMenu{position:absolute;left:0;bottom:calc(100% + 8px);width:min(300px,100%);max-height:320px;overflow:auto;background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.3);padding:6px;z-index:5}
  #aiMenu[hidden]{display:none}
  #aiMenu .g{font-size:11px;letter-spacing:.07em;color:var(--muted);font-weight:700;padding:8px 10px 2px;text-transform:uppercase}
  #aiMenu button{display:block;width:100%;text-align:left;background:transparent;border:0;border-radius:8px;padding:9px 10px;font:inherit;color:var(--fg);cursor:pointer;min-height:40px}
  #aiMenu button:hover,#aiMenu button:focus-visible{background:var(--bg)}
  @media(max-width:520px){#aiPanel{right:8px;left:8px;width:auto;bottom:calc(72px + env(safe-area-inset-bottom,0px))}#aiBtn span.t{display:none}#aiBtn{padding:6px}}
  `;
  document.head.appendChild(css);

  const btn=document.createElement('button');btn.id='aiBtn';btn.type='button';btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls','aiPanel');btn.setAttribute('aria-label','Ask Bruno, your helper');
  btn.innerHTML=`<span class="face">${bear(38)}</span><span class="t">Ask Bruno</span>`;
  const panel=document.createElement('div');panel.id='aiPanel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Bruno, your helper');
  panel.innerHTML=`<div class="ah"><div class="aiid"><span class="mini">${bear(32)}</span><div><b>Bruno</b><small>built-in helper, reads only</small></div></div><div><button type="button" id="aiNew" aria-label="Start a new chat" title="New chat">↺</button> <button type="button" id="aiClose" aria-label="Close" title="Close">✕</button></div></div>
    <div id="aiLog" aria-live="polite"></div>
    <form id="aiForm" autocomplete="off"><div id="aiMenu" role="menu" aria-label="AI tools" hidden></div>
      <input id="aiIn" placeholder="Tell Bruno what you need" maxlength="8000" aria-label="Tell Bruno what you need">
      <div class="airow"><button type="button" id="aiPlus" aria-haspopup="menu" aria-expanded="false" aria-label="AI tools" title="AI tools">+</button><span class="sp"></span>
        <button type="button" id="aiVoice" aria-pressed="false" hidden title="Speak instead of typing"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span>Voice</span></button>
        <button id="aiSend" type="submit">Send</button></div></form>`;
  document.body.append(btn,panel);
  const log=panel.querySelector('#aiLog'),inp=panel.querySelector('#aiIn'),send=panel.querySelector('#aiSend'),menu=panel.querySelector('#aiMenu'),plus=panel.querySelector('#aiPlus'),voice=panel.querySelector('#aiVoice');

  function scroll(){log.scrollTop=log.scrollHeight}
  function add(cls,html){
    if(cls==='a'){const r=document.createElement('div');r.className='mrow';r.innerHTML=`<span class="av">${bear(26)}</span><div class="m a">${html}</div>`;log.appendChild(r);scroll();return r.querySelector('.m')}
    const d=document.createElement('div');d.className='m '+cls;d.innerHTML=html;log.appendChild(d);scroll();return d;
  }
  function note(t,thinking){const d=document.createElement('div');d.className='s';d.innerHTML=(thinking?`<span class="av" style="width:24px;height:24px;display:inline-grid;place-items:center">${bear(22,'think')}</span>`:'')+`<span>${esc(t)}</span>`;log.appendChild(d);scroll();return d}
  const ICONS=[[/form|survey|quiz|waiver/i,'▤','#e8710a'],[/email|letter|reminder|write|draft/i,'✉','#7a3fb5'],[/chart|graph/i,'▦','#1f8a4c'],[/summar/i,'≣','#0b7aa8'],[/leave|hours|timesheet|payroll|approval/i,'◷','#1d5fd1'],[/stock|stationery|cash|petty/i,'◈','#b8860b']];
  const iconFor=t=>{for(const [re,g,c] of ICONS)if(re.test(t))return [g,c];return ['★','#0b3fb5']};
  const EXTRA=['Write a business email','Make a chart from my data'];
  function intro(){
    log.innerHTML='';introFor=ready();
    const hero=document.createElement('div');hero.className='hero';
    hero.innerHTML=`${bear(92)}<h3>Hey, how can I help?</h3><p>${ready()?'I look things up, explain how to do things and open handy AI tools. I never change your records.':'I need a moment to wake up. Try again shortly.'}</p>`;
    log.appendChild(hero);
    if(!ready())return;
    const list=window.VIRTUOSO_ENGINE.hints().slice(0,3).concat(window.VIRTUOSO_TOOLS?EXTRA:[]);
    list.forEach(t=>{const [g,c]=iconFor(t),b=document.createElement('button');b.type='button';b.className='h';b.innerHTML=`<i style="background:${c}" aria-hidden="true">${g}</i><span>${esc(t)}</span>`;b.onclick=()=>ask(t);log.appendChild(b)});
  }
  async function ask(text){
    text=(text||'').trim();if(!text||busy||!ready())return;
    closeMenu();stopVoice();busy=true;send.disabled=true;inp.value='';
    log.querySelectorAll('.h,.hero').forEach(x=>x.remove());
    add('u',esc(text));history.push({role:'user',content:text});
    const wait=note('Bruno is thinking…',true);
    try{
      const j=await window.VIRTUOSO_ENGINE.answer(text);
      history.push({role:'assistant',content:j.reply});
      wait.remove();add('a',replyHTML(j.reply));
    }catch(e){wait.remove();history.pop();add('a',esc(e.message||'Something went wrong.'))}
    busy=false;send.disabled=false;inp.focus();
  }

  /* ---------- tools menu ---------- */
  function openMenu(){
    const T=window.VIRTUOSO_TOOLS;
    if(!T){menu.innerHTML='<div class="g">AI tools</div><button type="button" disabled>Not loaded</button>'}
    else{
      const groups=T.groups();
      menu.innerHTML=`<button type="button" data-tool="">All AI tools</button>`+groups.map(g=>`<div class="g">${esc(g.name)}</div>`+g.items.map(t=>`<button type="button" role="menuitem" data-tool="${esc(t.key)}">${esc(t.name)}</button>`).join('')).join('');
    }
    menu.hidden=false;plus.setAttribute('aria-expanded','true');
  }
  function closeMenu(){menu.hidden=true;plus.setAttribute('aria-expanded','false')}
  plus.onclick=e=>{e.stopPropagation();menu.hidden?openMenu():closeMenu()};
  menu.addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(!b)return;closeMenu();openTool(b.dataset.tool)});
  panel.addEventListener('click',e=>{if(!menu.hidden&&!e.target.closest('#aiMenu')&&e.target!==plus)closeMenu()});
  function openTool(key){
    if(!window.VIRTUOSO_TOOLS)return;
    panel.classList.remove('on');btn.setAttribute('aria-expanded','false');window.VIRTUOSO_TOOLS.open(key||null);
  }
  log.addEventListener('click',e=>{const b=e.target.closest('.aitoolbtn');if(b)openTool(b.dataset.tool)});

  /* ---------- voice (browser speech-to-text, where supported) ---------- */
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(SR){voice.hidden=false}
  function stopVoice(){if(rec&&listening){try{rec.stop()}catch(_){}}listening=false;voice.setAttribute('aria-pressed','false');voice.querySelector('span').textContent='Voice'}
  voice.onclick=()=>{
    if(!SR)return;if(listening)return stopVoice();
    if(!voiceNoted){voiceNoted=true;note('Voice typing uses your browser\'s speech service, so your audio may be sent to your browser\'s provider to turn it into text.')}
    try{
      rec=new SR();rec.lang=navigator.language||'en-ZA';rec.interimResults=true;rec.continuous=false;
      rec.onresult=e=>{let t='';for(const r of e.results)t+=r[0].transcript;inp.value=t};
      rec.onerror=e=>{note(e.error==='not-allowed'||e.error==='service-not-allowed'?'Microphone access was blocked. Allow it in your browser to use Voice.':'Voice input did not work this time. You can type instead.');stopVoice()};
      rec.onend=()=>{const had=inp.value.trim();stopVoice();if(had)inp.focus()};
      rec.start();listening=true;voice.setAttribute('aria-pressed','true');voice.querySelector('span').textContent='Listening…';
    }catch(_){note('Voice input is not available in this browser.');stopVoice()}
  };

  function toggle(on){
    const open=on===undefined?!panel.classList.contains('on'):on;
    panel.classList.toggle('on',open);btn.setAttribute('aria-expanded',String(open));
    if(open){if(!log.children.length||introFor!==ready())intro();inp.focus()}else{closeMenu();stopVoice()}
  }
  btn.onclick=()=>toggle();
  panel.querySelector('#aiClose').onclick=()=>{toggle(false);btn.focus()};
  panel.querySelector('#aiNew').onclick=()=>{history.length=0;intro();inp.focus()};
  panel.querySelector('#aiForm').onsubmit=e=>{e.preventDefault();ask(inp.value)};
  document.addEventListener('keydown',e=>{if(e.key!=='Escape'||!panel.classList.contains('on'))return;if(!menu.hidden){closeMenu();plus.focus()}else toggle(false)});
  window.VIRTUOSO_ASSISTANT={open:()=>toggle(true),ask:t=>{toggle(true);return ask(t)}};

  /* Show only when signed in; clear the conversation on sign-out. */
  let was=false;
  setInterval(()=>{
    const inn=typeof state!=='undefined'&&!!state.user&&!state.user.mustChange;
    btn.classList.toggle('on',inn);document.body.classList.toggle('ai-on',inn);
    if(was&&!inn){history.length=0;log.innerHTML='';panel.classList.remove('on');closeMenu();stopVoice()}
    was=inn;
  },800);
})();
