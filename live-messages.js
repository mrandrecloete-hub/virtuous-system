/* MESSAGES page (everyone): WhatsApp-style two-way chat between the admin(s) and each employee. Needs migration 0017.
   One conversation per employee. Admins see every conversation, can start one with any employee and can send one message
   to several or all employees at once (it lands in each person's own conversation; replies stay private).
   Employees see only their own conversation. Text, emoji, reactions, replies, delete, read ticks, attachments
   (images, PDF, Office files, text, zip, audio; 15 MB each, 5 per message; paste or drag and drop) stored in the private
   'chat' bucket and opened through short-lived signed links. Live: updates arrive through Supabase Realtime plus a 15 s check.
   ?demo keeps everything in memory (state.msgdemo). Unread conversations show a badge on the Messages menu item and a
   card on every dashboard. */
(function(){
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const isAdm=()=>state.user&&state.user.type==='admin';
  const rid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36);
  const MAXF=15*1024*1024,MAXN=5,MAXT=4000;
  const OKEXT=/\.(jpe?g|png|gif|webp|pdf|docx?|xlsx?|pptx?|csv|txt|zip|mp3|m4a|wav|ogg|mp4|mov)$/i;
  const EMO={
    'Smileys':'😀 😃 😄 😁 😆 😅 😂 🤣 🙂 😉 😊 😇 🥰 😍 😘 😋 😎 🤓 🤔 🤗 😐 😴 😮 😢 😭 😡 🥳 🤝'.split(' '),
    'Gestures':'👍 👎 👌 ✌️ 🤞 👏 🙌 🙏 💪 👋 🤙 ☝️ 👀 🤷 🙋 ✍️'.split(' '),
    'Work':'✅ ❌ ⚠️ ❗ ❓ 📌 📎 📝 📅 ⏰ 📊 📈 💼 🧾 💰 🏦 📧 📞 🔒 🔑 ⭐ 🎯 🚀 💡'.split(' '),
    'Hearts & fun':'❤️ 🧡 💛 💚 💙 💜 🔥 🎉 🎂 🏆 ☕ 🍕 🌞 🌈 🌟 ✨'.split(' ')};
  const QUICK=['👍','❤️','😂','😮','🙏'];
  const M={uid:null,threads:[],msgs:{},reacts:{},names:{},emps:null,active:null,q:'',draft:{},reply:null,menu:null,emoji:null,emojiCat:'Smileys',
    att:{chat:[],nw:[]},nw:null,lb:null,loaded:false,busy:false,err:'',urls:{},lastUnread:0,tPoll:0,rt:null,mobile:'list',stick:true};
  const clean=(s,n)=>String(s==null?'':s).replace(/\u0000/g,'').slice(0,n||MAXT);
  const tm=d=>new Date(d).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  const dayLbl=d=>{const x=new Date(d),t=new Date(),y=new Date(Date.now()-864e5),same=(a,b)=>a.toDateString()===b.toDateString();
    return same(x,t)?'Today':same(x,y)?'Yesterday':x.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})};
  const short=d=>{const x=new Date(d),t=new Date();return x.toDateString()===t.toDateString()?tm(d):x.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})};
  const size=n=>n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
  const isImg=a=>/^image\//.test(a.type||'')||/\.(jpe?g|png|gif|webp)$/i.test(a.name||'');
  const ini=n=>(String(n||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('')||'?').toUpperCase();
  const linkify=t=>esc(t).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g,u=>`<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`).replace(/\n/g,'<br>');

  /* ---------- demo store ---------- */
  function demo(){
    if(state.msgdemo)return state.msgdemo;
    const d=state.msgdemo={threads:{},msgs:[],reacts:[]},now=Date.now();
    const seed=(u,txt,ago)=>{const t=new Date(now-ago).toISOString();
      d.threads[u]={id:'T'+u,employee_id:u,admin_read_at:t,emp_read_at:new Date(now-9e7).toISOString(),last_at:t,last_text:txt};
      d.msgs.push({id:rid(),thread_id:'T'+u,sender_id:'u0',sender_name:'Administrator',from_admin:true,body:txt,attachments:[],reply_to:null,deleted:false,created_at:t})};
    seed('u1','Welcome to Messages. Reply here if you need anything from the office. 👋',36e5);
    seed('u2','Please submit your timesheet for this week by Friday. ✅',72e5);
    return d;
  }
  const empName=id=>{const e=(M.emps||[]).find(x=>x.id===id);return e?e.name:(M.names[id]||'Employee')};

  /* ---------- data layer ---------- */
  async function loadEmps(){
    if(!isAdm()){M.emps=[];return}
    if(!LIVE){M.emps=staff().map(u=>({id:u.id,name:u.name,title:u.title}));return}
    const r=await sb().from('profiles').select('id,name,title').eq('role','emp').eq('access_enabled',true).order('name');
    M.emps=r.data||[];
  }
  async function loadThreads(){
    if(!LIVE){M.threads=Object.values(demo().threads).filter(t=>isAdm()||t.employee_id===state.user.id).map(t=>({...t}));return}
    const r=await sb().from('msg_threads').select('*').order('last_at',{ascending:false});
    if(r.error)throw r.error;M.threads=r.data||[];
  }
  async function loadMsgs(tid){
    if(!tid)return;
    if(!LIVE){M.msgs[tid]=demo().msgs.filter(m=>m.thread_id===tid).map(m=>({...m}));
      const ids=new Set(M.msgs[tid].map(m=>m.id));M.reacts[tid]=demo().reacts.filter(r=>ids.has(r.message_id));return}
    const r=await sb().from('msg_messages').select('*').eq('thread_id',tid).order('created_at',{ascending:false}).limit(300);
    if(r.error)throw r.error;const list=(r.data||[]).reverse();M.msgs[tid]=list;
    if(list.length){const rr=await sb().from('msg_reactions').select('*').in('message_id',list.map(m=>m.id));M.reacts[tid]=rr.data||[]}else M.reacts[tid]=[];
    resolveUrls(list);
  }
  async function resolveUrls(list){
    if(!LIVE)return;let any=false;
    for(const m of list)for(const a of (m.attachments||[])){
      const c=M.urls[a.path];if(c&&c.exp>Date.now()+60000)continue;
      const r=await sb().storage.from('chat').createSignedUrl(a.path,3600);
      if(r.data&&r.data.signedUrl){M.urls[a.path]={url:r.data.signedUrl,exp:Date.now()+3.5e6};any=true}
    }
    if(any&&M.active)paintMsgs(false);
  }
  const urlOf=a=>LIVE?((M.urls[a.path]||{}).url||''):(a.url||'');
  async function ensureThread(empId){
    if(!LIVE){const d=demo();if(!d.threads[empId]){const t=new Date().toISOString();d.threads[empId]={id:'T'+empId,employee_id:empId,admin_read_at:t,emp_read_at:t,last_at:t,last_text:''}}return d.threads[empId].id}
    const r=await sb().rpc('ensure_thread',{p_employee:empId});if(r.error)throw r.error;return r.data;
  }
  async function uploadFiles(tid,files){
    const out=[];
    for(const f of files){
      if(!LIVE){out.push({name:f.name,size:f.size,type:f.type||'',url:f.blobUrl});continue}
      const safe=f.name.replace(/[^\w.\- ]+/g,'_').slice(-80),path=tid+'/'+rid()+'-'+safe;
      const r=await sb().storage.from('chat').upload(path,f.file,{contentType:f.type||'application/octet-stream'});
      if(r.error)throw r.error;out.push({name:f.name,size:f.size,type:f.type||'',path});
    }
    return out;
  }
  async function sendTo(empId,body,files,replyTo){
    const tid=await ensureThread(empId),atts=files.length?await uploadFiles(tid,files):[];
    if(!LIVE){const d=demo(),t=d.threads[empId],now=new Date().toISOString(),adm=isAdm();
      d.msgs.push({id:rid(),thread_id:tid,sender_id:state.user.id,sender_name:state.user.name,from_admin:adm,body,attachments:atts,reply_to:replyTo||null,deleted:false,created_at:now});
      t.last_at=now;t.last_text=(body||'Attachment').slice(0,120);if(adm)t.admin_read_at=now;else t.emp_read_at=now;return tid}
    const r=await sb().rpc('send_message',{p_employee:empId,p_body:body,p_attachments:atts,p_reply:replyTo||null});
    if(r.error)throw r.error;return tid;
  }
  async function markRead(tid){
    const t=M.threads.find(x=>x.id===tid);if(!t||!unreadT(t))return;
    const now=new Date().toISOString();if(isAdm())t.admin_read_at=now;else t.emp_read_at=now;
    if(!LIVE){const d=Object.values(demo().threads).find(x=>x.id===tid);if(d){if(isAdm())d.admin_read_at=now;else d.emp_read_at=now}}
    else sb().rpc('mark_thread_read',{p_thread:tid}).then(()=>{});
    badge();
  }
  const unreadT=t=>new Date(t.last_at)>new Date(isAdm()?t.admin_read_at:t.emp_read_at);
  const unread=()=>state.user?M.threads.filter(unreadT).length:0;
  function badge(){const n=unread();if(n!==M.lastUnread){const up=n>M.lastUnread;M.lastUnread=n;if(typeof paintTabs==='function'&&state.user&&!state.user.mustChange)paintTabs();
      if(up&&M.loaded&&state.tab[state.role]!=='messages')toast('You have a new message');
      if(state.tab[state.role]==='dash'&&typeof render==='function')render()}}

  async function refresh(full){
    if(!state.user||state.user.mustChange)return;
    try{
      if(M.emps===null)await loadEmps();
      await loadThreads();M.err='';
      if(!isAdm()&&!M.active&&M.threads[0])M.active=M.threads[0].id;
      if(M.active)await loadMsgs(M.active);
    }catch(e){M.err=/relation .* does not exist|schema cache|msg_threads/i.test(e.message||'')?'Messages are not set up yet (migration 0017 must be run).':'Could not load messages.'}
    M.loaded=true;badge();
    if(onPage()){if(M.active&&isOpen())markRead(M.active);paintAll()}
  }
  const onPage=()=>state.user&&state.tab[state.role]==='messages'&&document.getElementById('mgRoot');
  const isOpen=()=>onPage()&&(!isAdm()||M.mobile==='chat'||window.innerWidth>820);
  setInterval(()=>{
    const u=state.user?state.user.id:null;
    if(u!==M.uid){M.uid=u;M.threads=[];M.msgs={};M.reacts={};M.emps=null;M.active=null;M.loaded=false;M.lastUnread=0;M.reply=null;M.draft={};M.att={chat:[],nw:[]};M.nw=null;M.tPoll=0;
      if(M.rt){try{sb().removeChannel(M.rt)}catch(e){}M.rt=null}
      if(u&&!state.user.mustChange){if(LIVE)subscribe();refresh()}return}
    if(u&&Date.now()-M.tPoll>(onPage()?6000:15000)){M.tPoll=Date.now();refresh()}
  },500);
  function subscribe(){
    try{M.rt=sb().channel('vx-msg-'+M.uid).on('postgres_changes',{event:'*',schema:'public',table:'msg_messages'},()=>{M.tPoll=Date.now();refresh()})
      .on('postgres_changes',{event:'*',schema:'public',table:'msg_threads'},()=>{M.tPoll=Date.now();refresh()}).subscribe()}catch(e){}
  }

  /* ---------- rendering ---------- */
  const CSS=`.mg{display:grid;grid-template-columns:320px 1fr;height:calc(100vh - 150px);min-height:430px;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--surface)}
.mg.solo{grid-template-columns:1fr}
.mg-l{border-right:1px solid var(--line);display:flex;flex-direction:column;min-width:0}
.mg-lh{padding:10px;border-bottom:1px solid var(--line);display:flex;gap:8px;align-items:center}.mg-lh input{flex:1;min-width:0}
.mg-ll{overflow:auto;flex:1}
.mg-r{display:flex;gap:10px;align-items:center;width:100%;text-align:left;border:0;border-bottom:1px solid var(--line);background:none;color:inherit;font:inherit;padding:10px 12px;cursor:pointer}
.mg-r:hover,.mg-r.on{background:var(--accent-soft)}
.mg-av{flex:none;width:38px;height:38px;border-radius:50%;background:var(--accent);color:var(--accent-fg);display:grid;place-items:center;font-weight:600;font-size:14px}
.mg-rt{flex:1;min-width:0}.mg-rt b{display:flex;justify-content:space-between;gap:6px;font-weight:600}.mg-rt small,.mg-rt span{display:block;color:var(--muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mg-dot{background:var(--accent);color:var(--accent-fg);border-radius:9px;min-width:18px;height:18px;font-size:11px;display:inline-grid;place-items:center;padding:0 5px}
.mg-c{display:flex;flex-direction:column;min-width:0;position:relative}
.mg-ch{display:flex;gap:10px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--line)}.mg-ch .back{display:none}
.mg-ms{flex:1;overflow:auto;padding:12px;background:var(--bg);display:flex;flex-direction:column;gap:4px}
.mg-day{align-self:center;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:2px 10px;font-size:12px;color:var(--muted);margin:8px 0}
.mg-row{display:flex;position:relative}.mg-row.me{justify-content:flex-end}
.mg-b{max-width:min(78%,520px);border-radius:12px;padding:6px 10px 4px;background:var(--surface);border:1px solid var(--line);overflow-wrap:anywhere;position:relative}
.me .mg-b{background:var(--accent-soft);border-color:var(--accent)}
.mg-nm{font-size:12px;font-weight:600;color:var(--accent)}
.mg-q{border-left:3px solid var(--accent);background:rgba(127,127,127,.12);border-radius:4px;padding:3px 8px;margin:3px 0;font-size:13px;color:var(--muted);cursor:pointer}
.mg-meta{display:flex;gap:6px;justify-content:flex-end;align-items:center;font-size:11px;color:var(--muted);margin-top:2px}.tick.rd{color:#2a8ce0}
.mg-mb{border:0;background:none;color:var(--muted);cursor:pointer;font-size:12px;padding:0 2px}
.mg-menu{position:absolute;z-index:5;top:100%;right:0;background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.2);padding:6px;min-width:190px}
.me .mg-menu{right:0}.mg-row:not(.me) .mg-menu{left:0;right:auto}
.mg-menu .qr{display:flex;gap:4px;padding:2px 2px 6px}.mg-menu .qr button{font-size:20px;border:0;background:none;cursor:pointer;border-radius:6px}.mg-menu .qr button:hover,.mg-menu>button:hover{background:var(--accent-soft)}
.mg-menu>button{display:block;width:100%;text-align:left;border:0;background:none;color:inherit;font:inherit;padding:6px 8px;border-radius:6px;cursor:pointer}
.mg-rx{display:flex;gap:4px;flex-wrap:wrap;margin-top:3px}.mg-rx button{border:1px solid var(--line);background:var(--surface);border-radius:12px;font-size:13px;padding:0 6px;cursor:pointer}.mg-rx button.on{border-color:var(--accent);background:var(--accent-soft)}
.mg-at img{max-width:100%;max-height:260px;border-radius:8px;display:block;cursor:zoom-in;margin:3px 0}
.mg-file{display:flex;gap:8px;align-items:center;border:1px solid var(--line);border-radius:8px;padding:6px 8px;margin:3px 0;background:var(--surface);color:inherit;text-decoration:none}
.mg-file i{font-style:normal;font-size:22px}.mg-file span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.mg-file small{color:var(--muted)}
.mg-comp{border-top:1px solid var(--line);padding:8px;position:relative;background:var(--surface)}
.mg-in{display:flex;gap:6px;align-items:flex-end}.mg-in textarea{flex:1;min-width:0;resize:none;max-height:140px;min-height:38px;font:inherit;padding:8px 10px;border-radius:18px;border:1px solid var(--line);background:var(--bg);color:var(--fg)}
.mg-ib{flex:none;width:38px;height:38px;border-radius:50%;border:0;background:none;font-size:20px;cursor:pointer;color:var(--muted)}.mg-ib:hover{background:var(--accent-soft)}
.mg-send{background:var(--accent);color:var(--accent-fg)}.mg-send:disabled{opacity:.4}
.mg-ap{display:flex;gap:6px;flex-wrap:wrap;padding:0 0 6px}.mg-chip{display:flex;gap:6px;align-items:center;border:1px solid var(--line);border-radius:8px;padding:3px 6px;font-size:13px;max-width:220px}.mg-chip img{width:34px;height:34px;object-fit:cover;border-radius:4px}.mg-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mg-chip button{border:0;background:none;cursor:pointer;color:var(--bad)}
.mg-rp{display:flex;gap:8px;align-items:center;border-left:3px solid var(--accent);background:var(--accent-soft);padding:4px 8px;border-radius:4px;margin-bottom:6px;font-size:13px}.mg-rp span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mg-em{position:absolute;bottom:100%;left:8px;z-index:6;width:min(330px,calc(100% - 16px));background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.2);padding:6px}
.mg-em nav{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px}.mg-em nav button{font-size:12px;border:0;background:none;color:var(--muted);cursor:pointer;padding:2px 6px;border-radius:6px}.mg-em nav button.on{background:var(--accent-soft);color:var(--fg)}
.mg-eg{display:grid;grid-template-columns:repeat(8,1fr);gap:2px;max-height:190px;overflow:auto}.mg-eg button{font-size:22px;border:0;background:none;cursor:pointer;border-radius:6px;padding:2px}.mg-eg button:hover{background:var(--accent-soft)}
.mg-empty{margin:auto;color:var(--muted);text-align:center;padding:20px}
.mg-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:70;display:grid;place-items:center;padding:12px}
.mg-md{background:var(--surface);border-radius:12px;width:min(560px,100%);max-height:calc(100vh - 24px);overflow:auto;padding:14px}
.mg-pick{max-height:200px;overflow:auto;border:1px solid var(--line);border-radius:8px;margin:6px 0}.mg-pick label{display:flex;gap:8px;padding:6px 10px;border-bottom:1px solid var(--line);cursor:pointer}
.mg-drop{outline:3px dashed var(--accent);outline-offset:-6px}
.mg-lb{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:80;display:grid;place-items:center;cursor:zoom-out}.mg-lb img{max-width:94vw;max-height:92vh}
@media(max-width:820px){.mg{grid-template-columns:1fr;height:calc(100vh - 130px)}.mg[data-m=chat] .mg-l{display:none}.mg[data-m=list] .mg-c{display:none}.mg-ch .back{display:inline-block}.mg-b{max-width:88%}}`;
  (function(){const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s)})();

  const ticks=(m,t)=>{if(!m.mine)return '';const rd=new Date(isAdm()?t.emp_read_at:t.admin_read_at)>=new Date(m.created_at);return `<span class="tick${rd?' rd':''}" title="${rd?'Read':'Sent'}">${rd?'✓✓':'✓'}</span>`};
  function fileIcon(a){const n=(a.name||'').toLowerCase();return /\.pdf$/.test(n)?'📕':/\.docx?$/.test(n)?'📘':/\.xlsx?$|\.csv$/.test(n)?'📗':/\.pptx?$/.test(n)?'📙':/\.zip$/.test(n)?'🗜️':/\.(mp3|m4a|wav|ogg)$/.test(n)?'🎵':/\.(mp4|mov)$/.test(n)?'🎬':'📄'}
  function bubble(m,t,list,rx){
    const mine=m.sender_id===state.user.id;m.mine=mine;
    const q=m.reply_to?list.find(x=>x.id===m.reply_to):null;
    let h=`<div class="mg-row ${mine?'me':''}" id="m_${esc(m.id)}"><div class="mg-b">`;
    if(!mine&&(m.from_admin||isAdm()))h+=`<div class="mg-nm">${esc(m.from_admin&&!isAdm()?'Virtuous Accounting':m.sender_name||'')}</div>`;
    else if(mine&&isAdm()&&false)h+='';
    if(m.deleted)return h+`<i style="color:var(--muted)">🚫 This message was deleted</i><div class="mg-meta">${tm(m.created_at)}</div></div></div>`;
    if(q)h+=`<div class="mg-q" data-act="mgJump" data-id="${esc(q.id)}"><b>${esc(q.sender_id===state.user.id?'You':(q.sender_name||''))}</b><br>${esc((q.deleted?'Deleted message':q.body||'Attachment').slice(0,100))}</div>`;
    (m.attachments||[]).forEach((a,i)=>{const u=urlOf(a);
      if(isImg(a))h+=u?`<div class="mg-at"><img src="${esc(u)}" alt="${esc(a.name)}" data-act="mgLb" data-u="${esc(u)}"></div>`:`<div class="mg-file"><i>🖼️</i><span>${esc(a.name)}</span><small>loading…</small></div>`;
      else h+=`<a class="mg-file" ${u?`href="${esc(u)}" download="${esc(a.name)}" target="_blank" rel="noopener noreferrer"`:''}><i>${fileIcon(a)}</i><span>${esc(a.name)}</span><small>${size(a.size||0)}</small></a>`});
    if(m.body)h+=`<div>${linkify(m.body)}</div>`;
    h+=`<div class="mg-meta"><span>${tm(m.created_at)}</span>${ticks(m,t)}<button class="mg-mb" data-act="mgMenu" data-id="${esc(m.id)}" aria-label="Message options">▾</button></div>`;
    const mine2={};(rx||[]).filter(r=>r.message_id===m.id).forEach(r=>{(mine2[r.emoji]=mine2[r.emoji]||[]).push(r.user_id)});
    const keys=Object.keys(mine2);
    if(keys.length)h+=`<div class="mg-rx">${keys.map(e=>`<button class="${mine2[e].includes(state.user.id)?'on':''}" data-act="mgReact" data-id="${esc(m.id)}" data-e="${e}">${e} ${mine2[e].length}</button>`).join('')}</div>`;
    if(M.menu===m.id)h+=`<div class="mg-menu"><div class="qr">${QUICK.map(e=>`<button data-act="mgReact" data-id="${esc(m.id)}" data-e="${e}">${e}</button>`).join('')}</div><button data-act="mgReply" data-id="${esc(m.id)}">↩ Reply</button>${(mine||isAdm())?`<button data-act="mgDel" data-id="${esc(m.id)}" style="color:var(--bad)">🗑 Delete</button>`:''}</div>`;
    return h+'</div></div>';
  }
  function curThread(){return M.threads.find(t=>t.id===M.active)}
  function attStrip(key){
    const a=M.att[key];if(!a.length)return '';
    return `<div class="mg-ap">${a.map((f,i)=>`<div class="mg-chip">${f.blobUrl&&isImg(f)?`<img src="${esc(f.blobUrl)}" alt="">`:`<i style="font-style:normal">${fileIcon(f)}</i>`}<span>${esc(f.name)}</span><button data-act="mgRmAtt" data-k="${key}" data-i="${i}" aria-label="Remove">✕</button></div>`).join('')}</div>`;
  }
  function emojiPanel(key){
    if(M.emoji!==key)return '';
    return `<div class="mg-em"><nav>${Object.keys(EMO).map(c=>`<button class="${c===M.emojiCat?'on':''}" data-act="mgEmCat" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</nav><div class="mg-eg">${EMO[M.emojiCat].map(e=>`<button data-act="mgEmoji" data-k="${key}" data-e="${e}">${e}</button>`).join('')}</div></div>`;
  }
  function composer(key,idp){
    return `${key==='chat'?'<div id="mgReply">'+replyBar()+'</div>':''}<div id="${idp}Att">${attStrip(key)}</div>
      <div class="mg-in"><button class="mg-ib" data-act="mgEm" data-k="${key}" aria-label="Emoji" title="Emoji">😊</button>
      <button class="mg-ib" data-act="mgPick" data-k="${key}" aria-label="Attach files" title="Attach files">📎</button>
      <textarea id="${idp}Text" data-k="${key}" rows="1" maxlength="${MAXT}" placeholder="Type a message" aria-label="Message"></textarea>
      <button class="mg-ib mg-send" data-act="mgSend" data-k="${key}" aria-label="Send" ${M.busy?'disabled':''}>➤</button></div><div id="${idp}Em">${emojiPanel(key)}</div>`;
  }
  const replyBar=()=>{const m=M.reply&&(M.msgs[M.active]||[]).find(x=>x.id===M.reply);return m?`<div class="mg-rp"><span><b>${esc(m.sender_id===state.user.id?'You':m.sender_name)}</b>: ${esc((m.body||'Attachment').slice(0,80))}</span><button class="mg-mb" data-act="mgNoReply" aria-label="Cancel reply">✕</button></div>`:''};

  function rows(){
    if(!isAdm())return '';
    const q=M.q.toLowerCase(),byEmp={};M.threads.forEach(t=>byEmp[t.employee_id]=t);
    const list=(M.emps||[]).filter(e=>!q||e.name.toLowerCase().includes(q)).map(e=>({e,t:byEmp[e.id]}))
      .sort((a,b)=>(b.t?+new Date(b.t.last_at):0)-(a.t?+new Date(a.t.last_at):0)||a.e.name.localeCompare(b.e.name));
    return list.map(({e,t})=>`<button class="mg-r ${t&&t.id===M.active?'on':''}" data-act="mgOpen" data-e="${esc(e.id)}"><span class="mg-av">${esc(ini(e.name))}</span><span class="mg-rt"><b><span style="color:inherit;font-size:inherit">${esc(e.name)}</span>${t&&t.last_text?`<small>${short(t.last_at)}</small>`:''}</b><span>${t&&t.last_text?esc(t.last_text):esc(e.title||'No messages yet')}</span></span>${t&&unreadT(t)?'<span class="mg-dot">●</span>':''}</button>`).join('')||'<div class="mg-empty">No employees found.</div>';
  }
  function head(){
    if(!M.active&&isAdm())return '';
    const t=curThread(),name=isAdm()?empName(t?t.employee_id:M.pendingEmp):'Virtuous Accounting',sub=isAdm()?((M.emps||[]).find(e=>e.id===(t?t.employee_id:M.pendingEmp))||{}).title||'Employee':'Administrator';
    return `${isAdm()?'<button class="mg-ib back" data-act="mgBack" aria-label="Back">←</button>':''}<span class="mg-av">${esc(ini(name))}</span><div><b>${esc(name)}</b><div class="note" style="font-size:12px">${esc(sub||'')}</div></div>`;
  }
  function paintMsgs(stick){
    const box=document.getElementById('mgMsgs');if(!box)return;
    const near=box.scrollHeight-box.scrollTop-box.clientHeight<80;
    const t=curThread(),list=M.msgs[M.active]||[],rx=M.reacts[M.active]||[];
    if(!M.active&&!M.pendingEmp&&isAdm()){box.innerHTML='<div class="mg-empty">Choose an employee on the left to read or start a conversation.</div>';return}
    if(!list.length){box.innerHTML='<div class="mg-empty">No messages yet. Say hello. 👋</div>';return}
    let last='',h='';
    list.forEach(m=>{const d=dayLbl(m.created_at);if(d!==last){h+=`<div class="mg-day">${d}</div>`;last=d}h+=bubble(m,t||{emp_read_at:0,admin_read_at:0},list,rx)});
    box.innerHTML=h;if(stick!==false&&(stick||near||M.stick))box.scrollTop=box.scrollHeight;M.stick=false;
  }
  function paintAll(){
    const l=document.getElementById('mgList');if(l)l.innerHTML=rows();
    const h=document.getElementById('mgHead');if(h)h.innerHTML=head();
    const r=document.getElementById('mgReply');if(r)r.innerHTML=replyBar();
    paintMsgs();
    const root=document.getElementById('mgRoot');if(root)root.dataset.m=M.mobile;
    const e=document.getElementById('mgErr');if(e)e.textContent=M.err;
  }
  function vMessages(){
    if(!state.user)return '';
    const adm=isAdm();
    if(!adm&&!M.active){const t=M.threads[0];if(t)M.active=t.id}
    if(!M.loaded)refresh();
    const mt=adm?'':'';
    const h=`<div class="note" id="mgErr" role="alert" style="color:var(--bad);margin-bottom:6px">${esc(M.err)}</div>
      <div class="mg ${adm?'':'solo'}" id="mgRoot" data-m="${M.mobile}">
      ${adm?`<aside class="mg-l"><div class="mg-lh"><input id="mgQ" placeholder="Search employees" value="${esc(M.q)}" aria-label="Search employees"><button class="btn sm" data-act="mgNew">New message</button></div><div class="mg-ll" id="mgList">${rows()}</div></aside>`:''}
      <section class="mg-c" id="mgChat"><div class="mg-ch" id="mgHead">${head()}</div><div class="mg-ms" id="mgMsgs" aria-live="polite"></div><div class="mg-comp" id="mgComp">${composer('chat','mg')}</div></section></div>`;
    setTimeout(()=>{paintAll();const ta=document.getElementById('mgText');if(ta){ta.value=M.draft[M.active||M.pendingEmp||'']||'';grow(ta)}
      if(M.active&&isOpen())markRead(M.active);const b=document.getElementById('mgMsgs');if(b)b.scrollTop=b.scrollHeight},0);
    return h;
  }
  function grow(ta){ta.style.height='auto';ta.style.height=Math.min(140,ta.scrollHeight)+'px'}

  /* ---------- new message dialog (admin) ---------- */
  function modal(){
    let el=document.getElementById('mgNw');
    if(!M.nw){if(el)el.remove();return}
    if(!el){el=document.createElement('div');el.id='mgNw';el.className='mg-ov';document.body.appendChild(el)}
    const n=M.nw,q=(n.q||'').toLowerCase(),emps=(M.emps||[]).filter(e=>!q||e.name.toLowerCase().includes(q));
    const keep=document.getElementById('mgNText');const val=keep?keep.value:(n.text||'');
    el.innerHTML=`<div class="mg-md" role="dialog" aria-label="New message"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">New message</h3><button class="mg-ib" data-act="mgNwClose" aria-label="Close">✕</button></div>
      <div class="note">Choose one, several or all employees. Each person gets it in their own conversation and can reply privately.</div>
      <div style="display:flex;gap:8px;margin-top:8px"><input id="mgNQ" placeholder="Search" value="${esc(n.q||'')}" style="flex:1" aria-label="Search"><button class="btn ghost sm" data-act="mgNwAll">${emps.length&&emps.every(e=>n.sel[e.id])?'Clear all':'Select all'}</button></div>
      <div class="mg-pick">${emps.map(e=>`<label><input type="checkbox" data-act="mgNwSel" data-e="${esc(e.id)}" ${n.sel[e.id]?'checked':''}> <span>${esc(e.name)} <small class="note">${esc(e.title||'')}</small></span></label>`).join('')||'<div class="mg-empty">No employees found.</div>'}</div>
      <div class="note">${Object.keys(n.sel).filter(k=>n.sel[k]).length} selected</div>
      <div id="mgNwAtt">${attStrip('nw')}</div>
      <div class="mg-in" style="margin-top:8px"><button class="mg-ib" data-act="mgEm" data-k="nw" aria-label="Emoji">😊</button><button class="mg-ib" data-act="mgPick" data-k="nw" aria-label="Attach files">📎</button>
      <textarea id="mgNText" data-k="nw" rows="3" maxlength="${MAXT}" placeholder="Type your message" aria-label="Message" style="border-radius:12px">${esc(val)}</textarea></div>
      <div style="position:relative"><div id="mgNwEm">${emojiPanel('nw')}</div></div>
      <div class="err" role="alert" id="mgNwErr">${esc(n.err||'')}</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px"><button class="btn ghost" data-act="mgNwClose">Cancel</button><button class="btn" data-act="mgSend" data-k="nw" ${M.busy?'disabled':''}>${M.busy?'Sending…':'Send'}</button></div></div>`;
  }

  /* ---------- actions ---------- */
  function addFiles(key,fileList){
    const arr=M.att[key],err=[];
    [...fileList].forEach(f=>{
      if(arr.length>=MAXN){err.push('Up to '+MAXN+' files per message.');return}
      if(f.size>MAXF){err.push(f.name+' is larger than 15 MB.');return}
      if(!OKEXT.test(f.name)){err.push(f.name+': this file type is not allowed.');return}
      arr.push({file:f,name:f.name,size:f.size,type:f.type,blobUrl:URL.createObjectURL(f)});
    });
    if(err.length)toast(err[0]);
    repaintComp(key);
  }
  function repaintComp(key){
    const a=document.getElementById(key==='chat'?'mgAtt':'mgNwAtt');if(a)a.innerHTML=attStrip(key);
    const em=document.getElementById(key==='chat'?'mgEm':'mgNwEm');if(em)em.innerHTML=emojiPanel(key);
    if(key==='chat'){const r=document.getElementById('mgReply');if(r)r.innerHTML=replyBar()}
  }
  function insertEmoji(key,e){
    const ta=document.getElementById(key==='chat'?'mgText':'mgNText');if(!ta)return;
    const s=ta.selectionStart==null?ta.value.length:ta.selectionStart,en=ta.selectionEnd==null?s:ta.selectionEnd;
    ta.value=ta.value.slice(0,s)+e+ta.value.slice(en);ta.focus();const p=s+e.length;try{ta.setSelectionRange(p,p)}catch(x){}
    ta.dispatchEvent(new Event('input',{bubbles:true}));
  }
  async function doSend(key){
    if(M.busy)return;
    const ta=document.getElementById(key==='chat'?'mgText':'mgNText'),body=clean(ta?ta.value:'').trim(),files=M.att[key].slice();
    if(!body&&!files.length)return;
    let targets;
    if(key==='chat'){const emp=isAdm()?(curThread()?curThread().employee_id:M.pendingEmp):state.user.id;if(!emp)return;targets=[emp]}
    else{targets=Object.keys(M.nw.sel).filter(k=>M.nw.sel[k]);if(!targets.length){M.nw.err='Choose at least one employee.';return modal()}}
    M.busy=true;M.nw&&(M.nw.err='');if(key==='nw')modal();else{const b=document.querySelector('[data-act=mgSend][data-k=chat]');if(b)b.disabled=true}
    let ok=0,fail='';
    for(const emp of targets){
      try{const tid=await sendTo(emp,body,files,key==='chat'?M.reply:null);ok++;if(key==='chat'){M.active=tid;M.pendingEmp=null}}
      catch(e){fail=/not permitted|policy/i.test(e.message||'')?'You are not allowed to send that.':/does not exist|schema cache|ensure_thread|send_message/i.test(e.message||'')?'Messages are not set up yet (migration 0017 must be run).':'Could not send: '+(e.message||'error')}
    }
    M.busy=false;
    if(fail){if(key==='nw'){M.nw.err=fail+(ok?' ('+ok+' sent)':'');modal()}else{M.err=fail;paintAll();const b=document.querySelector('[data-act=mgSend][data-k=chat]');if(b)b.disabled=false}if(!ok)return}
    files.forEach(f=>{if(LIVE&&f.blobUrl)URL.revokeObjectURL(f.blobUrl)});
    M.att[key]=[];if(ta)ta.value='';
    if(key==='chat'){M.draft[M.active||'']='';M.reply=null;M.emoji=null;if(ta)grow(ta);M.stick=true}
    else{M.nw=null;modal();if(ok)toast('Message sent to '+ok+' '+(ok===1?'employee':'employees'));
      if(targets.length===1){const t=await findThread(targets[0]);if(t){M.active=t;M.mobile='chat'}}}
    M.tPoll=Date.now();await refresh();if(key==='chat')repaintComp('chat');
  }
  async function findThread(emp){await loadThreads();const t=M.threads.find(x=>x.employee_id===emp);return t&&t.id}

  document.addEventListener('click',async e=>{
    const lbEl=e.target.closest&&e.target.closest('.mg-lb');if(lbEl){lbEl.remove();return}
    const b=e.target.closest&&e.target.closest('[data-act^="mg"]');
    if(!b){if(M.menu||M.emoji){const inside=e.target.closest&&e.target.closest('.mg-menu,.mg-em');if(!inside&&onPage()){M.menu=null;if(M.emoji){const k=M.emoji;M.emoji=null;repaintComp(k)}paintMsgs(false)}}return}
    if(b.tagName==='INPUT')return;
    e.stopImmediatePropagation();const a=b.dataset.act,k=b.dataset.k,id=b.dataset.id;
    switch(a){
      case 'mgNew':M.nw={sel:{},q:'',err:'',text:''};M.att.nw=[];return modal();
      case 'mgNwClose':M.nw=null;M.att.nw=[];M.emoji=null;return modal();
      case 'mgNwAll':{const q=(M.nw.q||'').toLowerCase(),list=(M.emps||[]).filter(x=>!q||x.name.toLowerCase().includes(q)),all=list.every(x=>M.nw.sel[x.id]);list.forEach(x=>{if(all)delete M.nw.sel[x.id];else M.nw.sel[x.id]=true});return modal()}
      case 'mgOpen':{const emp=b.dataset.e;M.draft[M.active||M.pendingEmp||'']=(document.getElementById('mgText')||{}).value||'';
        const t=M.threads.find(x=>x.employee_id===emp);M.active=t?t.id:null;M.pendingEmp=t?null:emp;M.reply=null;M.menu=null;M.mobile='chat';M.stick=true;
        if(t&&!M.msgs[t.id])await loadMsgs(t.id);paintAll();
        const ta=document.getElementById('mgText');if(ta){ta.value=M.draft[t?t.id:emp]||'';grow(ta)}
        if(t)markRead(t.id);return}
      case 'mgBack':M.mobile='list';return paintAll();
      case 'mgMenu':M.menu=M.menu===id?null:id;return paintMsgs(false);
      case 'mgReply':M.reply=id;M.menu=null;paintMsgs(false);repaintComp('chat');{const ta=document.getElementById('mgText');if(ta)ta.focus()}return;
      case 'mgNoReply':M.reply=null;return repaintComp('chat');
      case 'mgJump':{const n=document.getElementById('m_'+id);if(n)n.scrollIntoView({block:'center',behavior:'smooth'});return}
      case 'mgLb':{const d=document.createElement('div');d.className='mg-lb';d.innerHTML='<img alt="">';d.firstChild.src=b.dataset.u;document.body.appendChild(d);return}
      case 'mgEm':M.emoji=M.emoji===k?null:k;return repaintComp(k);
      case 'mgEmCat':M.emojiCat=b.dataset.c;return repaintComp(M.emoji||'chat');
      case 'mgEmoji':return insertEmoji(k,b.dataset.e);
      case 'mgPick':{const f=document.createElement('input');f.type='file';f.multiple=true;f.accept='image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip,audio/*,.mp4,.mov';f.onchange=()=>addFiles(k,f.files);f.click();return}
      case 'mgRmAtt':{const f=M.att[k].splice(+b.dataset.i,1)[0];if(f&&f.blobUrl)URL.revokeObjectURL(f.blobUrl);return repaintComp(k)}
      case 'mgSend':return doSend(k);
      case 'mgReact':{
        const tid=M.active,list=M.reacts[tid]=M.reacts[tid]||[],ex=list.find(r=>r.message_id===id&&r.user_id===state.user.id&&r.emoji===b.dataset.e);
        M.menu=null;
        if(ex){list.splice(list.indexOf(ex),1);if(!LIVE)demo().reacts=demo().reacts.filter(r=>!(r.message_id===id&&r.user_id===state.user.id&&r.emoji===ex.emoji));else sb().from('msg_reactions').delete().eq('message_id',id).eq('user_id',state.user.id).eq('emoji',ex.emoji).then(()=>{})}
        else{const r={message_id:id,user_id:state.user.id,emoji:b.dataset.e};list.push(r);if(!LIVE)demo().reacts.push({...r});else sb().from('msg_reactions').insert(r).then(()=>{})}
        return paintMsgs(false)}
      case 'mgDel':{if(!confirm('Delete this message for everyone?'))return;M.menu=null;
        if(!LIVE){const m=demo().msgs.find(x=>x.id===id);if(m){m.deleted=true;m.body='';m.attachments=[]}}else await sb().rpc('delete_message',{p_id:id});
        await loadMsgs(M.active);return paintMsgs(false)}
    }
  },true);
  document.addEventListener('change',e=>{
    const t=e.target;
    if(t.dataset&&t.dataset.act==='mgNwSel'){e.stopImmediatePropagation();if(t.checked)M.nw.sel[t.dataset.e]=true;else delete M.nw.sel[t.dataset.e];const n=document.querySelector('#mgNw .note:nth-of-type(3)');return modal()}
  },true);
  document.addEventListener('input',e=>{
    const t=e.target;
    if(t.id==='mgQ'){e.stopImmediatePropagation();M.q=t.value;const l=document.getElementById('mgList');if(l)l.innerHTML=rows();return}
    if(t.id==='mgNQ'){e.stopImmediatePropagation();const pos=t.selectionStart;M.nw.q=t.value;M.nw.text=(document.getElementById('mgNText')||{}).value||'';modal();const n=document.getElementById('mgNQ');n.focus();try{n.setSelectionRange(pos,pos)}catch(x){}return}
    if(t.id==='mgText'){M.draft[M.active||M.pendingEmp||'']=t.value;grow(t)}
  },true);
  document.addEventListener('keydown',e=>{
    const t=e.target;
    if(e.key==='Escape'){const lb=document.querySelector('.mg-lb');if(lb){lb.remove();return}if(M.nw){M.nw=null;modal();return}if(M.menu||M.emoji){M.menu=null;const k=M.emoji;M.emoji=null;if(onPage()){paintMsgs(false);if(k)repaintComp(k)}}}
    if(t.id==='mgText'&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&window.innerWidth>820){e.preventDefault();doSend('chat')}
  },true);
  document.addEventListener('paste',e=>{
    const t=e.target,k=t&&t.id==='mgText'?'chat':t&&t.id==='mgNText'?'nw':null;if(!k)return;
    const fs=[...(e.clipboardData&&e.clipboardData.files||[])];if(fs.length){e.preventDefault();addFiles(k,fs)}
  },true);
  ['dragover','dragleave','drop'].forEach(ev=>document.addEventListener(ev,e=>{
    const c=e.target.closest&&e.target.closest('#mgChat');if(!c)return;
    if(ev==='dragover'){e.preventDefault();c.classList.add('mg-drop')}
    else if(ev==='dragleave'){c.classList.remove('mg-drop')}
    else{e.preventDefault();c.classList.remove('mg-drop');if(e.dataTransfer&&e.dataTransfer.files.length)addFiles('chat',e.dataTransfer.files)}
  },true));

  /* ---------- registration: menu, icon, dashboard card ---------- */
  VIEWS.messages=vMessages;
  ICON.messages='<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>';
  [NAV.adm,NAV.emp].forEach(nav=>{const g=nav.find(x=>x[0]==='Overview');if(g&&!g[1].some(x=>x[0]==='messages'))g[1].splice(1,0,['messages','Messages'])});
  const baseDash=VIEWS.dash;
  VIEWS.dash=()=>{
    const h=baseDash(),n=unread();
    const card=n?`<button class="banner" data-tab="messages" style="display:block;width:100%;text-align:left;cursor:pointer;margin-bottom:12px;border-left-color:var(--accent);background:var(--accent-soft);color:inherit;font:inherit"><b>💬 ${n} unread conversation${n===1?'':'s'}</b><div class="note">${isAdm()?'Employees have replied. Open Messages to read them.':'You have a new message from the office. Open Messages to read it.'}</div></button>`
      :`<button class="tile link" data-tab="messages" style="margin-bottom:12px;max-width:260px"><b style="font-size:16px">💬 Messages</b><span>No unread messages</span></button>`;
    return card+h;
  };
  window.VIRTUOSO_MSG={unread,refresh};
})();
