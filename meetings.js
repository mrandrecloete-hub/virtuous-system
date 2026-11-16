/* MEETINGS (menu: Meetings, for administrators and employees).
   Video and voice meetings for the company, with chat, emojis, reactions, raise hand, mute / unmute, camera on / off,
   screen sharing, a people list and host controls (mute everyone, end for all).
   HOW IT WORKS: the call is WebRTC straight between the people's browsers (up to about 6 people works well: every person
   connects to every other person). Supabase Realtime is only the "telephone line" used to set the calls up and to carry
   chat and reactions: one PRIVATE broadcast channel per meeting ('meeting:<id>'); migration 0031 decides who may use it
   (active staff, for an open meeting). Meetings and their saved chat live in `meetings` / `meeting_messages`.
   ICE: free public STUN servers by default; for people behind strict firewalls or some mobile networks a TURN server is
   needed: put an array of ICE servers in app_settings key `meeting_ice` (e.g. [{urls:'turn:...',username:'..',credential:'..'}]).
   SAMPLE MODE (?demo): no database; meetings work between tabs of the same browser (BroadcastChannel) so it can be tried out.
   Nothing is recorded. Media never passes through our servers. Action prefix `mt`; room controls use data-mt. */
(function(){
  'use strict';
  const cfg=window.VIRTUOSO||{};
  const LIVE=!!(cfg.supabaseUrl&&cfg.anonKey)&&!/[?&]demo\b/.test(location.search);
  const sb=()=>window.VIRTUOSO&&window.VIRTUOSO.client;
  const me=()=>state.user;
  const isAdm=()=>me()&&me().type==='admin';
  const rid=()=>Math.random().toString(36).slice(2,10);
  const uuid=()=>(crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)}));
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const clip=(s,n)=>String(s==null?'':s).replace(/[\u0000-\u001f]/g,' ').slice(0,n);
  const initials=n=>String(n||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'?';
  const REACT=['👍','👏','❤️','😂','😮','🎉'];
  const EMOJI=['😀','😁','😂','🤣','😊','😍','😘','😎','🤔','😮','😢','😭','😡','🙏','👍','👎','👏','🙌','💪','🎉','🔥','✅','❌','❤️','💯','⭐','☕','🍕','🎂','👋','🤝','👀'];
  const ICEDEF=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}];
  let ICE=ICEDEF,iceLoaded=false;

  /* ---------- icons ---------- */
  const IC={
    mic:'<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>',
    micoff:'<path d="M1 1l22 22"/><path d="M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V4a3 3 0 0 0-5.9-.8"/><path d="M17 16.9A7 7 0 0 1 5 12v-2M19 10v2a7 7 0 0 1-.1 1.2M12 19v4M8 23h8"/>',
    cam:'<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    camoff:'<path d="M1 1l22 22"/><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.7 0H14a2 2 0 0 1 2 2v3.3l1 1L23 7v10"/>',
    screen:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    chat:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    people:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    leave:'<path d="M10.7 13.3a16 16 0 0 0 3.4 2.6l1.3-1.3a2 2 0 0 1 2.1-.4 13 13 0 0 0 2.8.7 2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7 13 13 0 0 0 .7 2.8 2 2 0 0 1-.4 2.1z"/><path d="M1 1l22 22"/>',
    smile:'<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>'
  };
  const ic=(n,s)=>`<svg viewBox="0 0 24 24" width="${s||22}" height="${s||22}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;

  /* ---------- meetings list ---------- */
  state.meetings=state.meetings||[];state.meetChat=state.meetChat||{};
  const M={list:[],loaded:false,loading:false,err:'',form:false,join:null,uid:null,deep:null};
  const fmt=s=>{const d=new Date(s);return isNaN(d)?'':d.toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})};
  const linkOf=id=>location.origin+location.pathname+'?meet='+id;
  async function load(force){
    if(M.loading||(M.loaded&&!force))return;
    if(!LIVE){
      if(!state.meetings.length){const t=new Date();t.setMinutes(0,0,0);t.setHours(t.getHours()+1);
        state.meetings.push({id:uuid(),title:'Team stand-up',description:'Daily check-in',starts_at:t.toISOString(),status:'open',created_by:me()?me().id:null,created_at:new Date().toISOString()})}
      M.list=state.meetings.slice();M.loaded=true;return;
    }
    if(!sb())return;
    M.loading=true;
    const r=await sb().from('meetings').select('id,title,description,starts_at,status,created_by,created_at').order('starts_at',{ascending:false}).limit(60);
    M.loading=false;M.loaded=true;
    if(r.error){M.err=/does not exist|schema cache|permission/i.test(r.error.message||'')?'Meetings need database migration 0031. Run it in the Supabase SQL editor, then reload.':'Could not load meetings: '+r.error.message;M.list=[]}
    else{M.err='';M.list=r.data||[]}
    if(state.tab&&state.tab[state.role]==='meet')render();
  }
  async function create(o){
    const row={title:clip(o.title,120)||'Meeting',description:clip(o.description,1000)||null,starts_at:o.starts_at||new Date().toISOString()};
    if(!LIVE){const m={id:uuid(),...row,status:'open',created_by:me().id,created_at:new Date().toISOString()};state.meetings.unshift(m);M.list=state.meetings.slice();return m}
    const r=await sb().from('meetings').insert(row).select('id,title,description,starts_at,status,created_by,created_at').single();
    if(r.error)throw new Error(r.error.message);
    M.list.unshift(r.data);return r.data;
  }
  async function endMeeting(m){
    if(!LIVE){const x=state.meetings.find(y=>y.id===m.id);if(x)x.status='ended';M.list=state.meetings.slice();return}
    const r=await sb().from('meetings').update({status:'ended',ended_at:new Date().toISOString()}).eq('id',m.id);
    if(r.error)throw new Error(r.error.message);
    const x=M.list.find(y=>y.id===m.id);if(x)x.status='ended';
  }
  async function loadIce(){
    if(iceLoaded)return;iceLoaded=true;
    if(!LIVE||!sb())return;
    try{const r=await sb().from('app_settings').select('value').eq('key','meeting_ice');
      const v=r.data&&r.data[0]&&r.data[0].value;
      if(Array.isArray(v)&&v.length){const ok=v.filter(s=>s&&(typeof s.urls==='string'||Array.isArray(s.urls))&&/^(stun|turn|turns):/i.test([].concat(s.urls)[0]||'')).map(s=>({urls:s.urls,...(s.username?{username:String(s.username)}:{}),...(s.credential?{credential:String(s.credential)}:{})}));if(ok.length)ICE=ok}}catch(e){}
  }

  /* ---------- the signalling line ---------- */
  function makeSignal(room,onmsg,onstatus){
    if(!LIVE){
      const bc=new BroadcastChannel('vx-meet-'+room);bc.onmessage=e=>onmsg(e.data);setTimeout(()=>onstatus('SUBSCRIBED'),0);
      return {send:p=>bc.postMessage(p),close:()=>bc.close()};
    }
    const ch=sb().channel('meeting:'+room,{config:{private:true,broadcast:{self:false,ack:false}}});
    ch.on('broadcast',{event:'sig'},m=>onmsg(m.payload));
    ch.subscribe((st,err)=>onstatus(st,err));
    return {send:p=>ch.send({type:'broadcast',event:'sig',payload:p}),close:()=>{try{sb().removeChannel(ch)}catch(e){}}};
  }

  /* ---------- sounds ---------- */
  let actx=null;
  const ac=()=>actx||(actx=new (window.AudioContext||window.webkitAudioContext)());
  function beep(kind){
    try{const c=ac(),o=c.createOscillator(),g=c.createGain(),t=c.currentTime;
      const f=kind==='join'?[660,880]:kind==='leave'?[520,360]:kind==='hand'?[760,760]:[600,600];
      o.frequency.setValueAtTime(f[0],t);o.frequency.setValueAtTime(f[1],t+.09);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.24);
      o.connect(g).connect(c.destination);o.start(t);o.stop(t+.26)}catch(e){}
  }

  /* ---------- the room ---------- */
  let R=null;
  class Room{
    constructor(m,opt){
      this.m=m;this.id=rid();this.name=clip(me().name,60)||'Guest';this.uid=me().id;this.adm=isAdm();
      this.peers=new Map();this.ms=new MediaStream();this.camTrack=null;this.screenTrack=null;
      this.micOn=!!opt.mic;this.camOn=!!opt.cam;this.hand=false;this.chat=[];this.seen=new Set();this.side=null;this.unread=0;this.t0=Date.now();this.meters=new Map();this.closed=false;
    }
    isHost(uid,adm){return (this.m.created_by&&uid===this.m.created_by)||!!adm}
    get host(){return this.isHost(this.uid,this.adm)}
    /* ----- interface ----- */
    ui(){
      const d=document.createElement('div');d.id='mtRoom';d.setAttribute('role','dialog');d.setAttribute('aria-label','Meeting: '+this.m.title);
      d.innerHTML=`<div class="mtTop"><b class="mtTitle">${esc(this.m.title)}</b><span class="mtClock" id="mtClock">00:00</span><span class="mtNote" id="mtNote">Connecting…</span><span class="grow"></span><button type="button" class="mtMini" data-mt="copy"><span class="lg">Copy invite link</span><span class="sm">Invite</span></button></div>
      <div class="mtMain"><div class="mtGrid" id="mtGrid"></div>
        <aside class="mtSide" id="mtSide" hidden><div class="mtTabs"><button type="button" data-mt="tab-chat" id="mtTabChat">Chat</button><button type="button" data-mt="tab-people" id="mtTabPeople">People</button><button type="button" class="x" data-mt="side-close" aria-label="Close panel">×</button></div><div id="mtPanel"></div></aside></div>
      <div class="mtReacts" id="mtReacts" aria-hidden="true"></div>
      <div class="mtPop" id="mtPop" hidden></div>
      <div class="mtBar" role="toolbar" aria-label="Meeting controls">
        <button type="button" data-mt="mic" id="mtMic"></button><button type="button" data-mt="cam" id="mtCam"></button><button type="button" data-mt="share" id="mtShare" title="Share your screen">${ic('screen')}<span>Share</span></button>
        <button type="button" data-mt="hand" id="mtHand" title="Raise your hand"><span class="emo">✋</span><span>Hand</span></button>
        <button type="button" data-mt="react" id="mtReactBtn" title="Reactions">${ic('smile')}<span>React</span></button>
        <button type="button" data-mt="chat" id="mtChatBtn" title="Chat">${ic('chat')}<span>Chat</span><i class="mtDot" id="mtDot" hidden></i></button>
        <button type="button" data-mt="people" id="mtPeopleBtn" title="People">${ic('people')}<span id="mtCount">1</span></button>
        <button type="button" class="leave" data-mt="leave" title="Leave the meeting">${ic('leave')}<span>Leave</span></button></div>`;
      document.body.appendChild(d);document.body.classList.add('mt-open');this.el=d;
      d.addEventListener('click',e=>this.click(e));d.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='mtInput'&&!e.shiftKey){e.preventDefault();this.send()}});
      this.paintBar();this.clock=setInterval(()=>{const s=Math.floor((Date.now()-this.t0)/1000),x=$('#mtClock');if(x)x.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')},1000);
    }
    note(t,ms){const n=$('#mtNote');if(!n)return;n.textContent=t||'';clearTimeout(this.nt);if(ms)this.nt=setTimeout(()=>{if(n)n.textContent=''},ms)}
    paintBar(){
      const set=(id,on,html,title)=>{const b=$(id);if(!b)return;b.innerHTML=html;b.classList.toggle('off',!on);b.title=title;b.setAttribute('aria-pressed',String(on))};
      set('#mtMic',this.micOn,ic(this.micOn?'mic':'micoff')+'<span>'+(this.micOn?'Mute':'Unmute')+'</span>',this.micOn?'Mute your microphone':'Unmute your microphone');
      set('#mtCam',this.camOn,ic(this.camOn?'cam':'camoff')+'<span>'+(this.camOn?'Camera off':'Camera on')+'</span>',this.camOn?'Turn your camera off':'Turn your camera on');
      const h=$('#mtHand');if(h)h.classList.toggle('on',this.hand);const s=$('#mtShare');if(s){s.classList.toggle('on',!!this.screenTrack);s.querySelector('span').textContent=this.screenTrack?'Stop':'Share'}
      const c=$('#mtCount');if(c)c.textContent=String(this.peers.size+1);
      const dot=$('#mtDot');if(dot)dot.hidden=!this.unread;
    }
    tile(p,local){
      let t=this.el.querySelector('[data-p="'+p.id+'"]');
      if(!t){t=document.createElement('div');t.className='mtTile'+(local?' me':'');t.dataset.p=p.id;
        t.innerHTML='<video autoplay playsinline '+(local?'muted':'')+'></video><div class="mtAv"><span></span></div><div class="mtName"><i class="mtMic"></i><b></b></div><div class="mtHandI">✋</div><div class="mtConn"></div>';
        t.addEventListener('dblclick',()=>t.classList.toggle('spot'));
        const g=$('#mtGrid');g.appendChild(t);const v=t.querySelector('video');if(local)v.srcObject=this.ms;else if(p.stream)v.srcObject=p.stream}
      const st=local?{mic:this.micOn,cam:this.camOn||!!this.screenTrack,hand:this.hand}:p.st||{};
      t.querySelector('.mtName b').textContent=(local?'You':p.name)+(this.isHost(p.uid,p.adm)||(local&&this.host)?' (host)':'');
      t.querySelector('.mtAv span').textContent=initials(local?this.name:p.name);
      t.classList.toggle('novid',!st.cam);t.classList.toggle('muted',st.mic===false);t.classList.toggle('hand',!!st.hand);
      t.classList.toggle('sharing',!!(local?this.screenTrack:st.share));
      this.layout();return t;
    }
    layout(){const g=$('#mtGrid');if(!g)return;const n=g.children.length;g.dataset.n=String(Math.min(n,9))}
    /* ----- media ----- */
    async media(){
      let a=null,v=null,why='';
      const want={audio:this.micOn,video:this.camOn};
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){this.micOn=false;this.camOn=false;this.note('This browser cannot use the camera or microphone (it needs https). You can still listen and chat.');return}
      const ask=async c=>{try{return await navigator.mediaDevices.getUserMedia(c)}catch(e){why=e&&e.name||'error';return null}};
      if(want.audio||want.video){
        let s=await ask({audio:want.audio?{echoCancellation:true,noiseSuppression:true,autoGainControl:true}:false,video:want.video?{width:{ideal:640},height:{ideal:360},frameRate:{ideal:24}}:false});
        if(!s&&want.audio&&want.video){s=await ask({audio:{echoCancellation:true,noiseSuppression:true},video:false});if(s)this.camOn=false}
        if(s){a=s.getAudioTracks()[0]||null;v=s.getVideoTracks()[0]||null}
      }
      if(want.audio&&!a){this.micOn=false}
      if(want.video&&!v){this.camOn=false}
      if(a)this.ms.addTrack(a);if(v){this.camTrack=v;this.ms.addTrack(v)}
      if((want.audio&&!a)||(want.video&&!v))this.note(why==='NotAllowedError'?'Camera or microphone blocked. Allow them in the browser (padlock icon), then use the buttons below.':'Could not start the camera or microphone. You can still listen and chat.',9000);
    }
    audioOut(){return this.ms.getAudioTracks()[0]||null}
    videoOut(){return this.screenTrack||this.camTrack||null}
    setSenders(kind,track){this.peers.forEach(p=>{const s=p.senders&&p.senders[kind];if(s)s.replaceTrack(track).catch(()=>{})})}
    /* ----- joining ----- */
    async join(){
      this.ui();await this.media();await loadIce();
      const you={id:this.id,name:this.name,uid:this.uid};this.tile(you,true);this.paintBar();this.meter(this.id,this.ms,true);
      this.history();
      this.sig=makeSignal(this.m.id,x=>this.onSig(x),(st,err)=>{
        if(this.closed)return;
        if(st==='SUBSCRIBED'){this.out({t:'hello'});this.note('In the meeting',4000);beep('join')}
        else if(st==='CHANNEL_ERROR'||st==='TIMED_OUT'||st==='CLOSED'){this.note(LIVE?'Could not open the meeting line. If this keeps happening, migration 0031 may not be run yet, or this meeting has ended.':'Could not connect.')}
      });
      this.onHide=()=>this.out({t:'bye'});window.addEventListener('pagehide',this.onHide);
      this.gate=setInterval(()=>{if(!me())this.leave()},1500);
    }
    out(o){if(this.sig&&!this.closed)this.sig.send({from:this.id,name:this.name,uid:this.uid,adm:this.adm,...o})}
    state(){return {mic:this.micOn,cam:this.camOn||!!this.screenTrack,hand:this.hand,share:!!this.screenTrack}}
    sendState(){this.out({t:'st',st:this.state()});this.paintBar();this.tile({id:this.id,name:this.name,uid:this.uid},true)}
    peer(m){
      let p=this.peers.get(m.from);
      if(p&&m.t==='hello'){this.drop(m.from,true);p=null}
      if(!p){p={id:m.from,name:clip(m.name,60)||'Guest',uid:m.uid,adm:!!m.adm,st:m.st||{},pc:null,stream:null,ice:[],wait:[]};this.peers.set(m.from,p);this.tile(p);this.people();this.paintBar()}
      else{p.name=clip(m.name,60)||p.name;if(m.st)p.st=m.st;p.adm=!!m.adm}
      return p;
    }
    pc(p,answering){
      const pc=new RTCPeerConnection({iceServers:ICE});p.pc=pc;
      if(!answering){ /* the caller makes one audio and one video line that both directions use */
        const ta=pc.addTransceiver('audio',{direction:'sendrecv',streams:[this.ms]}),tv=pc.addTransceiver('video',{direction:'sendrecv',streams:[this.ms]});
        p.senders={audio:ta.sender,video:tv.sender};
        const a=this.audioOut(),v=this.videoOut();if(a)ta.sender.replaceTrack(a).catch(()=>{});if(v)tv.sender.replaceTrack(v).catch(()=>{});
      }
      pc.ontrack=e=>{
        const s=(e.streams&&e.streams[0])||p.stream||new MediaStream();if(!(e.streams&&e.streams[0]))s.addTrack(e.track);
        p.stream=s;const t=this.tile(p),v=t.querySelector('video');if(v.srcObject!==s){v.srcObject=s;v.play&&v.play().catch(()=>{})}
        this.meter(p.id,s,false);
      };
      pc.onicecandidate=e=>{if(!e.candidate)return;p.ice.push(e.candidate.toJSON());clearTimeout(p.iceT);p.iceT=setTimeout(()=>{const c=p.ice.splice(0);if(c.length)this.out({t:'ice',to:p.id,c})},120)};
      pc.onconnectionstatechange=()=>{
        const t=this.el&&this.el.querySelector('[data-p="'+p.id+'"] .mtConn');const s=pc.connectionState;
        if(t)t.textContent=s==='connected'?'':s==='failed'?'Connection failed':s==='disconnected'?'Reconnecting…':'Connecting…';
        if(s==='failed')this.note(p.name+': the connection failed. A firewall or network may be blocking calls (an administrator can add a TURN server).',10000);
      };
      return pc;
    }
    /* the answering side: the lines come from the caller's offer, so attach our own microphone and camera to them */
    adopt(p){
      p.senders={};
      p.pc.getTransceivers().forEach(t=>{
        const kind=t.receiver&&t.receiver.track&&t.receiver.track.kind;if(kind!=='audio'&&kind!=='video')return;
        try{t.direction='sendrecv'}catch(e){}
        p.senders[kind]=t.sender;const tr=kind==='audio'?this.audioOut():this.videoOut();
        if(tr)t.sender.replaceTrack(tr).catch(()=>{});
        try{t.sender.setStreams(this.ms)}catch(e){}
      });
    }
    async offerTo(p){
      const pc=p.pc||this.pc(p);
      const o=await pc.createOffer();await pc.setLocalDescription(o);
      this.out({t:'offer',to:p.id,sdp:pc.localDescription.sdp});
    }
    async flush(p){for(const c of p.wait.splice(0)){try{await p.pc.addIceCandidate(c)}catch(e){}}}
    async onSig(m){
      if(!m||this.closed||m.from===this.id||(m.to&&m.to!==this.id))return;
      try{
        if(m.t==='hello'){const p=this.peer(m);this.out({t:'present',to:p.id,st:this.state()});beep('join');return}
        if(m.t==='present'){const p=this.peer(m);if(!p.pc)await this.offerTo(p);return}
        if(m.t==='offer'){const p=this.peer(m);const pc=p.pc||this.pc(p,true);await pc.setRemoteDescription({type:'offer',sdp:m.sdp});if(!p.senders)this.adopt(p);await this.flush(p);const a=await pc.createAnswer();await pc.setLocalDescription(a);this.out({t:'answer',to:p.id,sdp:pc.localDescription.sdp});return}
        if(m.t==='answer'){const p=this.peers.get(m.from);if(p&&p.pc&&p.pc.signalingState==='have-local-offer'){await p.pc.setRemoteDescription({type:'answer',sdp:m.sdp});await this.flush(p)}return}
        if(m.t==='ice'){const p=this.peers.get(m.from);if(!p||!Array.isArray(m.c))return;for(const c of m.c.slice(0,40)){if(p.pc&&p.pc.remoteDescription){try{await p.pc.addIceCandidate(c)}catch(e){}}else p.wait.push(c)}return}
        if(m.t==='st'){const p=this.peers.get(m.from);if(p){const was=p.st&&p.st.hand;p.st=m.st||{};this.tile(p);this.people();if(p.st.hand&&!was){beep('hand');this.note(p.name+' raised a hand',4000)}}return}
        if(m.t==='react'){this.float(String(m.e||'').slice(0,8),m.name||'');return}
        if(m.t==='chat'){this.addChat({id:m.id,uid:m.uid,name:m.name,text:clip(m.text,2000),ts:m.ts||Date.now()},true);return}
        if(m.t==='mute'){if(this.isHost(m.uid,m.adm)&&(m.who==='all'||m.who===this.id)&&this.micOn){this.setMic(false);this.note((m.name||'The host')+' muted you. You can unmute yourself.',6000)}return}
        if(m.t==='end'){if(this.isHost(m.uid,m.adm)){this.note('The host ended the meeting',3000);this.leave(true)}return}
        if(m.t==='bye'){const p=this.peers.get(m.from);if(p){this.note(p.name+' left',3000);beep('leave')}this.drop(m.from);return}
      }catch(e){console.warn('meeting signal',m&&m.t,e)}
    }
    drop(id,silent){
      const p=this.peers.get(id);if(!p)return;
      try{p.pc&&p.pc.close()}catch(e){}clearTimeout(p.iceT);this.peers.delete(id);this.meters.delete(id);
      const t=this.el&&this.el.querySelector('[data-p="'+id+'"]');if(t)t.remove();this.layout();if(!silent){this.people();this.paintBar()}
    }
    /* ----- controls ----- */
    setMic(on){const a=this.audioOut();if(a)a.enabled=on;this.micOn=on&&!!a;this.sendState()}
    async mic(){
      if(!this.audioOut()){
        try{const s=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});const a=s.getAudioTracks()[0];this.ms.addTrack(a);this.setSenders('audio',a);this.micOn=true;this.meter(this.id,this.ms,true);this.sendState()}
        catch(e){this.note('The microphone is blocked or missing. Allow it in the browser (padlock icon).',8000)}return}
      this.setMic(!this.micOn);
    }
    async cam(){
      if(this.camTrack){this.camTrack.stop();this.ms.removeTrack(this.camTrack);this.camTrack=null;this.camOn=false;this.setSenders('video',this.screenTrack||null);this.sendState();return}
      try{const s=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:360},frameRate:{ideal:24}}});const v=s.getVideoTracks()[0];this.camTrack=v;this.ms.addTrack(v);this.camOn=true;if(!this.screenTrack)this.setSenders('video',v);this.sendState()}
      catch(e){this.note('The camera is blocked or missing. Allow it in the browser (padlock icon).',8000)}
    }
    async share(){
      if(this.screenTrack){this.stopShare();return}
      if(!navigator.mediaDevices||!navigator.mediaDevices.getDisplayMedia){this.note('Screen sharing is not available in this browser.',6000);return}
      try{const s=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});const v=s.getVideoTracks()[0];this.screenTrack=v;v.onended=()=>this.stopShare();this.setSenders('video',v);
        const lv=this.el.querySelector('[data-p="'+this.id+'"] video');if(lv)lv.srcObject=new MediaStream([v]);this.sendState()}
      catch(e){if(e&&e.name!=='NotAllowedError')this.note('Could not share the screen.',6000)}
    }
    stopShare(){
      if(!this.screenTrack)return;try{this.screenTrack.stop()}catch(e){}this.screenTrack=null;this.setSenders('video',this.camTrack||null);
      const lv=this.el&&this.el.querySelector('[data-p="'+this.id+'"] video');if(lv)lv.srcObject=this.ms;this.sendState();
    }
    toggleHand(){this.hand=!this.hand;this.sendState();if(this.hand)beep('hand')}
    react(e){this.out({t:'react',e});this.float(e,'You')}
    float(e,name){
      const w=$('#mtReacts');if(!w||!e)return;const s=document.createElement('div');s.className='mtFloat';s.style.left=(8+Math.random()*80)+'%';
      s.innerHTML='<span>'+esc(e)+'</span><small>'+esc(name)+'</small>';w.appendChild(s);setTimeout(()=>s.remove(),2600);
    }
    /* ----- speaking indicators ----- */
    meter(id,stream,local){
      try{if(!stream||!stream.getAudioTracks().length)return;if(this.meters.has(id)&&this.meters.get(id).s===stream.id+stream.getAudioTracks().length)return;
        const c=ac(),src=c.createMediaStreamSource(stream),an=c.createAnalyser();an.fftSize=256;src.connect(an);
        this.meters.set(id,{an,buf:new Uint8Array(an.frequencyBinCount),s:stream.id+stream.getAudioTracks().length,local});
        if(!this.mt)this.mt=setInterval(()=>this.speak(),260)}catch(e){}
    }
    speak(){
      this.meters.forEach((m,id)=>{m.an.getByteFrequencyData(m.buf);let s=0;for(let i=0;i<m.buf.length;i++)s+=m.buf[i];const lvl=s/m.buf.length;
        const t=this.el&&this.el.querySelector('[data-p="'+id+'"]');if(t)t.classList.toggle('speaking',lvl>18&&(!m.local||this.micOn))});
    }
    /* ----- chat ----- */
    async history(){
      if(!LIVE){(state.meetChat[this.m.id]||[]).forEach(x=>this.addChat(x,false));return}
      try{const r=await sb().from('meeting_messages').select('id,user_id,author,body,at').eq('meeting_id',this.m.id).order('at',{ascending:true}).limit(100);
        (r.data||[]).forEach(x=>this.addChat({id:x.id,uid:x.user_id,name:x.author||'Someone',text:x.body,ts:new Date(x.at).getTime()},false))}catch(e){}
    }
    addChat(m,live){
      if(!m.id||this.seen.has(m.id))return;this.seen.add(m.id);this.chat.push(m);if(this.chat.length>300)this.chat.shift();
      if(live&&this.side!=='chat'){this.unread++;this.paintBar();beep('chat')}
      if(this.side==='chat')this.panel();
    }
    send(){
      const i=$('#mtInput');if(!i)return;const text=clip(i.value,2000).trim();if(!text)return;i.value='';
      const m={id:uuid(),uid:this.uid,name:this.name,text,ts:Date.now()};
      this.out({t:'chat',id:m.id,text,ts:m.ts});this.addChat(m,false);
      if(!LIVE){(state.meetChat[this.m.id]=state.meetChat[this.m.id]||[]).push(m)}
      else sb().from('meeting_messages').insert({id:m.id,meeting_id:this.m.id,body:text,author:this.name}).then(r=>{if(r.error)this.note('Your message was sent but could not be saved.',6000)});
      const p=$('#mtPanelList');if(p)p.scrollTop=p.scrollHeight;
    }
    /* ----- side panels ----- */
    open(which){
      this.side=this.side===which?null:which;const s=$('#mtSide');s.hidden=!this.side;this.el.classList.toggle('withSide',!!this.side);
      if(this.side==='chat')this.unread=0;this.panel();this.paintBar();
      const tc=$('#mtTabChat'),tp=$('#mtTabPeople');if(tc)tc.classList.toggle('on',this.side==='chat');if(tp)tp.classList.toggle('on',this.side==='people');
    }
    panel(){
      const w=$('#mtPanel');if(!w)return;
      if(this.side==='chat'){
        const list=this.chat.map(m=>`<div class="mtMsg ${m.uid===this.uid?'mine':''}"><b>${m.uid===this.uid?'You':esc(m.name||'')}</b><small>${new Date(m.ts).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</small><p>${esc(m.text)}</p></div>`).join('')||'<p class="mtEmpty">No messages yet. Say hello.</p>';
        const keep=$('#mtInput')?$('#mtInput').value:'';
        w.innerHTML=`<div class="mtList" id="mtPanelList">${list}</div><div class="mtEmojis" id="mtEmojis" hidden>${EMOJI.map(e=>`<button type="button" data-mt="emoji" data-e="${e}">${e}</button>`).join('')}</div>
          <div class="mtCompose"><button type="button" class="mtEmo" data-mt="emojis" aria-label="Emoji">😊</button><input id="mtInput" maxlength="2000" placeholder="Type a message" autocomplete="off" aria-label="Message"><button type="button" class="mtSend" data-mt="send">Send</button></div>`;
        const i=$('#mtInput');if(i){i.value=keep;}const pl=$('#mtPanelList');if(pl)pl.scrollTop=pl.scrollHeight;
      }else if(this.side==='people'){this.people()}
    }
    people(){
      if(this.side!=='people'){this.paintBar();return}
      const w=$('#mtPanel');if(!w)return;
      const row=(p,local)=>{const st=local?this.state():p.st||{};
        return `<div class="mtPer"><span class="av">${esc(initials(p.name))}</span><div><b>${esc(local?'You':p.name)}</b>${this.isHost(p.uid,p.adm)?'<small>Host</small>':''}</div><span class="ico">${st.hand?'✋':''}${st.share?'🖥':''}<i class="${st.mic===false?'mOff':''}">${ic(st.mic===false?'micoff':'mic',16)}</i><i class="${st.cam?'':'mOff'}">${ic(st.cam?'cam':'camoff',16)}</i></span>${!local&&this.host?`<button type="button" class="mtMini" data-mt="mute" data-id="${p.id}">Mute</button>`:''}</div>`};
      w.innerHTML=`<div class="mtList">${row({name:this.name,uid:this.uid},true)}${[...this.peers.values()].map(p=>row(p,false)).join('')}</div>
        ${this.host?'<div class="mtHost"><button type="button" class="mtMini" data-mt="muteall">Mute everyone</button><button type="button" class="mtMini danger" data-mt="endall">End meeting for everyone</button></div>':''}`;
      this.paintBar();
    }
    pop(which){
      const p=$('#mtPop');if(!p)return;if(this.popOpen===which){p.hidden=true;this.popOpen=null;return}this.popOpen=which;
      if(which==='react'){p.innerHTML=REACT.map(e=>`<button type="button" data-mt="r" data-e="${e}">${e}</button>`).join('');p.hidden=false}
    }
    click(e){
      const b=e.target.closest&&e.target.closest('[data-mt]');if(!b||!this.el.contains(b))return;
      const a=b.dataset.mt;
      if(a!=='react'&&a!=='r'){const p=$('#mtPop');if(p){p.hidden=true;this.popOpen=null}}
      if(a==='mic')this.mic();else if(a==='cam')this.cam();else if(a==='share')this.share();else if(a==='hand')this.toggleHand();
      else if(a==='react')this.pop('react');else if(a==='r'){this.react(b.dataset.e)}
      else if(a==='chat'||a==='tab-chat')this.open('chat');else if(a==='people'||a==='tab-people')this.open('people');
      else if(a==='side-close'){this.side=null;$('#mtSide').hidden=true;this.el.classList.remove('withSide');this.paintBar()}
      else if(a==='emojis'){const m=$('#mtEmojis');if(m)m.hidden=!m.hidden}
      else if(a==='emoji'){const i=$('#mtInput');if(i){i.value+=b.dataset.e;i.focus()}}
      else if(a==='send')this.send();
      else if(a==='copy'){const l=linkOf(this.m.id);(navigator.clipboard?navigator.clipboard.writeText(l):Promise.reject()).then(()=>this.note('Invite link copied',3000),()=>this.note(l,12000))}
      else if(a==='mute'){this.out({t:'mute',who:b.dataset.id});this.note('Asked them to mute',3000)}
      else if(a==='muteall'){this.out({t:'mute',who:'all'});this.note('Asked everyone to mute',3000)}
      else if(a==='endall'){if(confirm('End this meeting for everyone?'))this.endAll()}
      else if(a==='leave')this.leave();
    }
    async endAll(){
      this.out({t:'end'});try{await endMeeting(this.m)}catch(e){}
      setTimeout(()=>this.leave(true),150);
    }
    leave(quiet){
      if(this.closed)return;this.closed=true;
      try{this.sig&&this.sig.send({from:this.id,name:this.name,uid:this.uid,t:'bye'})}catch(e){}
      window.removeEventListener('pagehide',this.onHide);clearInterval(this.clock);clearInterval(this.mt);clearInterval(this.gate);
      setTimeout(()=>{try{this.sig&&this.sig.close()}catch(e){}},200);
      this.peers.forEach(p=>{try{p.pc&&p.pc.close()}catch(e){}});this.peers.clear();
      [this.camTrack,this.screenTrack,...this.ms.getTracks()].forEach(t=>{try{t&&t.stop()}catch(e){}});
      if(this.el)this.el.remove();document.body.classList.remove('mt-open');R=null;beep('leave');
      if(!quiet)toast('You left the meeting');
      if(state.tab&&state.tab[state.role]==='meet')render();
    }
  }

  /* ---------- starting a meeting ---------- */
  function prejoin(m){
    if(R){toast('You are already in a meeting.');return}
    const o=document.createElement('div');o.id='mtPre';o.setAttribute('role','dialog');o.setAttribute('aria-label','Join meeting');
    o.innerHTML=`<div class="mtCard"><h3>${esc(m.title)}</h3><p class="note" style="margin:0">${m.starts_at?esc(fmt(m.starts_at)):''}</p>
      <label class="chk"><input type="checkbox" id="mtPreMic" checked> Join with my microphone on</label><label class="chk"><input type="checkbox" id="mtPreCam" checked> Join with my camera on</label>
      <p class="note" style="margin:0">Your browser will ask to use the microphone and camera. Anyone in the company with the link can join. Nothing is recorded.</p>
      <div class="row"><button class="btn" type="button" data-pre="go">Join now</button><button class="btn ghost" type="button" data-pre="no">Cancel</button></div></div>`;
    document.body.appendChild(o);
    o.addEventListener('click',e=>{const b=e.target.closest('[data-pre]');if(!b)return;const mic=$('#mtPreMic').checked,cam=$('#mtPreCam').checked;o.remove();
      if(b.dataset.pre==='go'){R=new Room(m,{mic,cam});R.join().catch(err=>{console.error(err);toast('Could not start the meeting: '+(err&&err.message||'error'));if(R){R.leave(true)}})}});
  }
  async function openById(id){
    if(!UUID.test(id))return toast('That is not a meeting code.');
    await load(true);let m=M.list.find(x=>x.id===id);
    if(!m&&!LIVE)m={id,title:'Meeting (sample mode)',created_by:null,status:'open',starts_at:null};
    if(!m){const r=LIVE&&sb()?await sb().from('meetings').select('id,title,description,starts_at,status,created_by,created_at').eq('id',id).maybeSingle():null;m=r&&r.data}
    if(!m)return toast('That meeting was not found.');
    if(m.status==='ended')return toast('That meeting has ended.');
    prejoin(m);
  }

  /* ---------- the page ---------- */
  const css=document.createElement('style');
  css.textContent=`
  .mtw{display:grid;gap:14px}.mtrow{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .mtlist .mtitem{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:12px 4px;border-top:1px solid var(--line)}
  .mtlist .mtitem:first-child{border-top:0}.mtitem b{display:block}.mtitem span{font-size:12.5px;color:var(--muted)}
  .mtpill{font-size:11.5px;border-radius:999px;padding:2px 9px;border:1px solid var(--line);color:var(--muted)}.mtpill.on{background:#e3f5e8;color:#1b6b3a;border-color:#b9e2c6}
  .mtform{display:grid;gap:10px;max-width:560px}.mtform label{display:grid;gap:4px}
  body.mt-open{overflow:hidden}
  #mtPre{position:fixed;inset:0;z-index:250;background:rgba(5,15,60,.7);display:flex;align-items:center;justify-content:center;padding:16px}
  #mtPre .mtCard{background:#fff;color:#0b1a44;border-radius:16px;padding:20px;max-width:420px;width:100%;display:grid;gap:12px;box-shadow:0 20px 60px rgba(0,0,0,.5);--fg:#0b1a44;--muted:#2c4378;--line:#c9d6f0}
  #mtPre .chk{display:flex;gap:8px;align-items:center}
  #mtRoom{position:fixed;inset:0;z-index:240;background:#0a1230;color:#eef3ff;display:flex;flex-direction:column;font-family:inherit}
  #mtRoom button{font:inherit;cursor:pointer}
  .mtTop{display:flex;gap:12px;align-items:center;padding:10px 14px;background:#07102b;border-bottom:1px solid #1d2c5c;min-height:48px}
  .mtTitle{font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:40vw}.mtClock{font-variant-numeric:tabular-nums;color:#9fb4ee;font-size:13px}
  .mtNote{font-size:12.5px;color:#f6d56a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mtTop .grow{flex:1}
  .mtMini{border:1px solid #3a4f94;background:#14224f;color:#eef3ff;border-radius:8px;padding:6px 10px;font-size:12.5px;min-height:32px}.mtMini:hover{background:#1c2f69}.mtMini.danger{background:#7a1a1a;border-color:#a33}
  .mtMain{flex:1;display:flex;min-height:0}
  .mtGrid{flex:1;display:grid;gap:10px;padding:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));grid-auto-rows:minmax(0,1fr);align-content:center;overflow:auto;min-width:0}
  .mtGrid[data-n="1"]{grid-template-columns:1fr}.mtGrid[data-n="2"],.mtGrid[data-n="3"],.mtGrid[data-n="4"]{grid-template-columns:repeat(2,minmax(0,1fr))}.mtGrid[data-n="5"],.mtGrid[data-n="6"]{grid-template-columns:repeat(3,minmax(0,1fr))}
  .mtMini{white-space:nowrap}.mtMini .sm{display:none}
  .mtTile{position:relative;background:#16224d;border-radius:14px;overflow:hidden;min-height:140px;border:2px solid transparent;aspect-ratio:16/9}
  .mtGrid[data-n="1"] .mtTile{aspect-ratio:auto;height:100%;max-height:78vh}
  .mtTile.spot{grid-column:1/-1;aspect-ratio:auto;min-height:55vh}
  .mtTile video{width:100%;height:100%;object-fit:cover;background:#0b1535;display:block}.mtTile.me video{transform:scaleX(-1)}.mtTile.me.sharing video{transform:none}.mtTile.sharing video{object-fit:contain}
  .mtTile.novid video{visibility:hidden}.mtAv{position:absolute;inset:0;display:none;align-items:center;justify-content:center}.mtTile.novid .mtAv{display:flex}
  .mtAv span{width:84px;height:84px;border-radius:50%;background:linear-gradient(145deg,#1f4fd8,#0a2a7a);display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:700;color:#fff;border:2px solid #e8a600}
  .mtName{position:absolute;left:8px;bottom:8px;background:rgba(5,10,35,.7);padding:3px 9px;border-radius:999px;font-size:12.5px;display:flex;gap:6px;align-items:center;max-width:90%}.mtName b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mtName .mtMic{display:none;width:14px;height:14px;background:no-repeat center/contain url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ff6b6b' stroke-width='2.4' stroke-linecap='round'%3E%3Cpath d='M1 1l22 22'/%3E%3Cpath d='M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V4a3 3 0 0 0-5.9-.8'/%3E%3Cpath d='M17 16.9A7 7 0 0 1 5 12v-2M12 19v4M8 23h8'/%3E%3C/svg%3E")}.mtTile.muted .mtMic{display:block}
  .mtHandI{position:absolute;top:8px;right:8px;font-size:26px;display:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))}.mtTile.hand .mtHandI{display:block}
  .mtConn{position:absolute;top:8px;left:8px;font-size:12px;background:rgba(5,10,35,.7);padding:2px 8px;border-radius:999px}.mtConn:empty{display:none}
  .mtTile.speaking{border-color:#41d27b;box-shadow:0 0 0 2px rgba(65,210,123,.35)}
  .mtSide{width:340px;max-width:100%;background:#0d1840;border-left:1px solid #1d2c5c;display:flex;flex-direction:column;min-height:0}.mtSide[hidden]{display:none}
  .mtTabs{display:flex;gap:4px;padding:8px;border-bottom:1px solid #1d2c5c}.mtTabs button{background:transparent;border:0;color:#9fb4ee;padding:8px 12px;border-radius:8px;min-height:36px}.mtTabs button.on{background:#1b2c66;color:#fff}.mtTabs .x{margin-left:auto;font-size:20px}
  #mtPanel{flex:1;display:flex;flex-direction:column;min-height:0}.mtList{flex:1;overflow:auto;padding:10px;display:grid;gap:8px;align-content:start}
  .mtMsg{background:#16275d;border-radius:10px;padding:8px 10px;max-width:92%}.mtMsg.mine{background:#1e47b8;justify-self:end}.mtMsg b{font-size:12.5px}.mtMsg small{margin-left:8px;color:#9fb4ee;font-size:11px}.mtMsg p{margin:2px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
  .mtEmpty{color:#9fb4ee;text-align:center;margin-top:30px}
  .mtCompose{display:flex;gap:6px;padding:8px;border-top:1px solid #1d2c5c}.mtCompose input{flex:1;background:#fff;color:#0b1a44;border:0;border-radius:10px;padding:8px 10px;min-height:40px;font:inherit}.mtEmo{background:#16275d;border:0;border-radius:10px;font-size:20px;width:42px}.mtSend{background:#d8a926;color:#1a1200;border:0;border-radius:10px;padding:0 14px;font-weight:700}
  .mtEmojis{display:grid;grid-template-columns:repeat(8,1fr);gap:2px;padding:6px 8px;border-top:1px solid #1d2c5c;background:#0b1536}.mtEmojis[hidden]{display:none}.mtEmojis button{background:transparent;border:0;font-size:22px;min-height:38px;border-radius:8px}.mtEmojis button:hover{background:#1b2c66}
  .mtPer{display:flex;align-items:center;gap:10px;background:#16275d;border-radius:10px;padding:8px 10px}.mtPer .av{width:34px;height:34px;border-radius:50%;background:#1f4fd8;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
  .mtPer div{flex:1;min-width:0}.mtPer b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mtPer small{color:#f6d56a}.mtPer .ico{display:flex;gap:6px;align-items:center}.mtPer .ico i{display:inline-flex;color:#7fe0a3}.mtPer .ico i.mOff{color:#ff8a8a}
  .mtHost{display:flex;gap:8px;flex-wrap:wrap;padding:10px;border-top:1px solid #1d2c5c}
  .mtBar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;padding:10px 10px calc(10px + env(safe-area-inset-bottom,0px));background:#07102b;border-top:1px solid #1d2c5c;position:relative}
  .mtBar button{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:62px;min-height:54px;border-radius:12px;border:1px solid #2d417f;background:#15235a;color:#eef3ff;padding:6px 8px;font-size:11.5px}
  .mtBar button:hover{background:#1d3178}.mtBar button.off{background:#8a1f1f;border-color:#c33}.mtBar button.on{background:#d8a926;color:#1a1200;border-color:#f6d56a}.mtBar .emo{font-size:20px;line-height:22px}
  .mtBar .leave{background:#c62828;border-color:#e55}.mtBar .leave:hover{background:#d93636}
  .mtDot{position:absolute;top:6px;right:10px;width:10px;height:10px;border-radius:50%;background:#ff5252}
  .mtPop{position:absolute;bottom:76px;left:50%;transform:translateX(-50%);display:flex;gap:4px;background:#101d4a;border:1px solid #2d417f;border-radius:14px;padding:6px;z-index:5}.mtPop[hidden]{display:none}.mtPop button{background:transparent;border:0;font-size:28px;border-radius:10px;min-width:46px;min-height:46px}.mtPop button:hover{background:#1d3178}
  .mtReacts{position:absolute;left:0;right:0;bottom:80px;height:60vh;pointer-events:none;overflow:hidden}
  .mtFloat{position:absolute;bottom:0;display:flex;flex-direction:column;align-items:center;animation:mtUp 2.5s ease-out forwards}.mtFloat span{font-size:44px}.mtFloat small{font-size:11px;background:rgba(5,10,35,.7);padding:1px 8px;border-radius:999px}
  @keyframes mtUp{0%{transform:translateY(0) scale(.6);opacity:0}12%{opacity:1;transform:translateY(-20px) scale(1)}100%{transform:translateY(-55vh) scale(1.15);opacity:0}}
  @media (max-width:760px){.mtSide{position:absolute;inset:48px 0 68px 0;width:auto;z-index:4}.mtTitle{max-width:30vw}.mtMini .lg{display:none}.mtMini .sm{display:inline}.mtNote{max-width:34vw}.mtTile.spot{min-height:40vh}.mtGrid{grid-template-columns:1fr!important}
    .mtBar{flex-wrap:nowrap;gap:4px;padding:8px 6px calc(8px + env(safe-area-inset-bottom,0px))}.mtBar button{flex:1 1 0;min-width:0;padding:6px 2px;min-height:50px}.mtBar button span:not(.emo):not(#mtCount){display:none}.mtDot{right:6px}}
  @media (prefers-reduced-motion:reduce){.mtFloat{animation-duration:1.2s}}
  `;
  document.head.appendChild(css);

  function vMeet(){
    if(!M.loaded)load();
    const U=window.VIRTUOSO_UI;
    const hero=U?U.hero({title:'Meetings',sub:'Video and voice meetings with chat, reactions and screen sharing, for everyone in the company.',icon:'timesheet',gold:8}):'<h2>Meetings</h2>';
    const supported=!!(window.RTCPeerConnection&&navigator.mediaDevices);
    const list=M.list.length?M.list.map(m=>{
      const mine=me()&&m.created_by===me().id,live=m.status==='open';
      return `<div class="mtitem"><div><b>${esc(m.title)}</b><span>${esc(fmt(m.starts_at))}${m.description?' &middot; '+esc(m.description):''}</span></div>
        <div class="mtrow"><span class="mtpill ${live?'on':''}">${live?'Open':'Ended'}</span>${live?`<button class="btn sm" type="button" data-act="mtJoin" data-id="${esc(m.id)}">Join</button><button class="btn sm ghost" type="button" data-act="mtCopy" data-id="${esc(m.id)}">Copy link</button>`:''}${live&&(mine||isAdm())?`<button class="btn sm ghost" type="button" data-act="mtEnd" data-id="${esc(m.id)}">End</button>`:''}</div></div>`}).join('')
      :'<p class="note" style="margin:0">No meetings yet. Start one now, or schedule one for later.</p>';
    return `${hero}<div class="mtw">
      ${!supported?'<div class="banner" role="alert">This browser cannot run video calls. Use a recent Chrome, Edge, Firefox or Safari over https.</div>':''}
      ${M.err?`<div class="banner" role="alert">${esc(M.err)}</div>`:''}
      ${LIVE?'':'<div class="banner">Sample mode: meetings only work between tabs of this same browser. In the live app everyone in the company can join.</div>'}
      <div class="panel"><div class="ph"><h3>Start or join</h3></div>
        <div class="mtrow"><button class="btn" type="button" data-act="mtNew">Start a meeting now</button><button class="btn ghost" type="button" data-act="mtSched">${M.form?'Close':'Schedule a meeting'}</button>
          <input id="mtCode" placeholder="Paste a meeting link or code" style="flex:1;min-width:200px" aria-label="Meeting link or code"><button class="btn ghost" type="button" data-act="mtCode">Join</button></div>
        ${M.form?`<form id="mtForm" class="mtform" style="margin-top:12px" novalidate><label><b>Title</b><input id="mtTitle" maxlength="120" placeholder="Monday planning"></label>
          <label><b>When</b><input id="mtWhen" type="datetime-local"></label><label><b>Notes (optional)</b><textarea id="mtDesc" rows="2" maxlength="1000"></textarea></label>
          <div class="err" id="mtErr" role="alert"></div><div class="mtrow"><button class="btn" type="submit">Save meeting</button></div></form>`:''}
        <p class="note" style="margin:10px 0 0">Calls go straight between people's browsers and are not recorded. Works well for up to about 6 people. You will be asked to allow the microphone and camera.</p></div>
      <div class="panel"><div class="ph"><h3>Meetings</h3><button class="btn sm ghost" type="button" data-act="mtRefresh">Refresh</button></div><div class="mtlist">${list}</div></div></div>`;
  }
  VIEWS.meet=vMeet;
  ICON.meet='<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>';
  [NAV.adm,NAV.emp].forEach(nav=>{const g=nav.find(x=>x[0]==='Overview');if(g&&!g[1].some(x=>x[0]==='meet')){const i=g[1].findIndex(x=>x[0]==='messages');g[1].splice(i>=0?i+1:1,0,['meet','Meetings'])}});

  document.addEventListener('click',async e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="mt"]');if(!b)return;
    const a=b.dataset.act;if(!['mtNew','mtSched','mtCode','mtJoin','mtCopy','mtEnd','mtRefresh'].includes(a))return;
    e.stopImmediatePropagation();
    if(a==='mtRefresh'){M.loaded=false;await load(true);return render()}
    if(a==='mtSched'){M.form=!M.form;return render()}
    if(a==='mtNew'){try{const m=await create({title:(me().name.split(' ')[0]||'My')+"'s meeting"});prejoin(m)}catch(x){toast('Could not start the meeting: '+x.message)}return}
    if(a==='mtCode'){const v=($('#mtCode').value||'').trim(),m=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(v);if(!m)return toast('Paste a meeting link or code.');return openById(m[0])}
    const m=M.list.find(x=>x.id===b.dataset.id);
    if(a==='mtJoin'){if(m)prejoin(m);return}
    if(a==='mtCopy'){const l=linkOf(b.dataset.id);(navigator.clipboard?navigator.clipboard.writeText(l):Promise.reject()).then(()=>toast('Invite link copied'),()=>toast(l));return}
    if(a==='mtEnd'){if(m&&confirm('End "'+m.title+'"? Nobody will be able to join it again.')){try{await endMeeting(m);render()}catch(x){toast('Could not end it: '+x.message)}}return}
  },true);
  document.addEventListener('submit',async e=>{
    if(!e.target||e.target.id!=='mtForm')return;e.preventDefault();e.stopImmediatePropagation();
    const t=($('#mtTitle').value||'').trim(),w=$('#mtWhen').value,err=$('#mtErr');
    if(!t){err.textContent='Give the meeting a title.';return}
    try{await create({title:t,description:$('#mtDesc').value,starts_at:w?new Date(w).toISOString():new Date().toISOString()});M.form=false;toast('Meeting saved');render()}
    catch(x){err.textContent='Could not save: '+x.message}
  },true);

  /* invite link: ?meet=<id> opens the join box after sign-in */
  const deep=(/[?&]meet=([0-9a-f-]{36})/i.exec(location.search)||[])[1];
  if(deep)M.deep=deep;
  setInterval(()=>{
    const u=me()?me().id:null;
    if(u!==M.uid){M.uid=u;M.loaded=false;M.loading=false;M.list=[];M.err=''}
    if(u&&M.deep&&!R){const id=M.deep;M.deep=null;state.tab[state.role]='meet';render();openById(id)}
  },800);
  window.VIRTUOSO_MEET={inRoom:()=>!!R,_room:()=>R};
})();
