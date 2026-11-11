/* MOBILE NAVIGATION: on screens up to 820px the sidebar becomes a permanent 68px icon rail (icons + tiny labels,
   active page in gold) so the dashboard keeps the rest of the width. The menu button expands it to a 272px panel
   that slides over the page behind a translucent scrim; choosing a page, tapping the scrim or pressing Escape
   closes it again. Desktop keeps the full sidebar. Also compacts the mobile header, headings, cards and watermark. */
(function(){
  const BP=820,RAIL=68,FULL=272;
  const css=document.createElement('style');
  css.id='mobileNavCss';
  css.textContent=`
@media (max-width:${BP}px){
  body{overflow-x:hidden}
  /* signed out: no menu rail, no app shell, only the sign-in card */
  body.auth-out #side,body.auth-out .shell,body.auth-out #scrim{display:none!important}
  body.auth-out #login{padding-left:16px;padding-right:16px}
  body.auth-out #login .lcard{max-width:100%;padding:18px 16px}
  body.auth-out #login .lcard::after{display:none}
  body.auth-out .lcard::before{font-size:20px}
  /* the rail is fixed, so the page simply starts after it */
  .shell{display:block!important;padding-left:calc(${RAIL}px + env(safe-area-inset-left,0px))}
  .col{min-width:0}
  /* the rail: always visible, independently scrollable, safe-area aware */
  body:not(.open) #side,body.open #side{position:fixed;left:0;top:0;bottom:0;height:100vh;height:100dvh;transform:none;transition:width .22s ease,box-shadow .22s ease;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none;z-index:30;
    padding:calc(10px + env(safe-area-inset-top,0px)) 6px calc(10px + env(safe-area-inset-bottom,0px)) max(6px,env(safe-area-inset-left,0px));gap:8px}
  #side::-webkit-scrollbar{display:none}
  body:not(.open) #side{width:${RAIL}px;max-width:${RAIL}px;box-shadow:4px 0 14px rgba(5,15,60,.2)}
  body.open #side{width:${FULL}px;max-width:88vw;padding-left:max(14px,env(safe-area-inset-left,0px));padding-right:14px;box-shadow:10px 0 32px rgba(5,15,60,.45)}
  body.open #scrim{display:block;position:fixed;inset:0;background:rgba(4,13,43,.5);backdrop-filter:blur(1.5px);z-index:25}
  /* brand */
  #side .brand{text-align:center;padding:0}
  body:not(.open) #side .brand .logo{max-width:46px;margin:2px auto 0}
  body:not(.open) #side .brand small{display:none}
  body.open #side .brand .logo{max-width:170px}
  /* nav items */
  #tabs{gap:4px}
  body:not(.open) .ng{display:none}
  body.open .ng{margin:12px 10px 4px}
  body:not(.open) #tabs .nv{flex-direction:column;justify-content:center;gap:3px;padding:7px 2px 6px;min-height:54px;border-radius:12px;text-align:center;position:relative;font-size:9.5px;line-height:1.1;font-weight:600;letter-spacing:0}
  body:not(.open) #tabs .nv svg{width:21px;height:21px}
  body:not(.open) #tabs .nv span:first-of-type{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}
  body:not(.open) #tabs .nv .badge{position:absolute;top:2px;right:4px;margin:0;min-width:16px;height:16px;line-height:16px;padding:0 4px;font-size:10px;background:#e03131;color:#fff;border-radius:8px}
  body.open #tabs .nv{padding:10px 12px;min-height:44px;border-radius:12px}
  /* footer of the rail: hide text, keep a compact sign-out */
  body:not(.open) .sidefoot{border-top:1px solid rgba(255,255,255,.15);padding-top:8px;gap:6px;align-items:center}
  body:not(.open) .sidefoot>div,body:not(.open) .sidefoot .tagline,body:not(.open) .sidefoot .motto{display:none}
  body:not(.open) .sidefoot .btn{width:100%;padding:0;min-height:40px;font-size:0;border-radius:10px;display:grid;place-items:center}
  body:not(.open) .sidefoot .btn::before{content:"";width:18px;height:18px;background:currentColor;-webkit-mask:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>') center/contain no-repeat;mask:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>') center/contain no-repeat}
  /* compact header */
  header{padding:8px 10px 2px}
  header .bar{flex-wrap:nowrap!important;gap:6px 8px}
  .bar>.row{flex-wrap:nowrap;gap:6px;min-width:0}
  .bar>.row:first-child{flex:1 1 0;min-width:0;overflow:hidden}
  .bar>.row:last-child{flex:none}
  #pageTitle{flex:1 1 0;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  .menu{width:36px;height:34px;flex:none}
  .net{padding:5px 8px;font-size:12px;gap:6px;white-space:nowrap;border-radius:10px;min-height:34px}
  #bell{padding:5px 8px}
  main{padding:6px 10px calc(70px + env(safe-area-inset-bottom,0px))}
  .foot{padding-inline:10px;font-size:11.5px}
  /* content: compact but readable */
  h2{font-size:22px;margin-bottom:4px}
  .sub{font-size:13px}
  .hello{margin-bottom:10px;gap:6px 10px}
  .hello .row .btn{min-height:38px;padding-inline:12px;font-size:13px}
  .tiles{gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
  .tile{padding:12px 12px 10px;border-radius:14px}
  .tile b{font-size:20px}
  .dgrid{gap:10px;margin-top:10px}
  .panel{padding:12px;border-radius:12px}
  /* watermark: lower opacity and start after the rail */
  .wm{left:${RAIL}px;right:0;opacity:calc(var(--wm-op) * .3);background-size:min(80%,420px)}
}
@media (max-width:372px){
  .net #netTxt{display:none}#net{gap:0}
}
@media (max-width:${BP}px) and (orientation:landscape){
  body:not(.open) #tabs .nv{min-height:46px;padding-top:5px;padding-bottom:4px}
  body:not(.open) #side .brand .logo{max-width:36px}
}
@media (prefers-reduced-motion:reduce){#side{transition:none!important}}`;
  document.head.appendChild(css);

  /* Tooltips / accessible labels for the icon rail, kept in sync with the menu. */
  if(typeof paintTabs==='function'){
    const orig=paintTabs;
    paintTabs=function(){orig.apply(this,arguments);document.querySelectorAll('#tabs .nv').forEach(b=>{const s=b.querySelector('span');if(s){b.title=s.textContent;b.setAttribute('aria-label',s.textContent)}});
      const m=document.getElementById('menu');if(m)m.setAttribute('aria-expanded',String(document.body.classList.contains('open')))};
  }
  const sync=()=>{const m=document.getElementById('menu');if(m){const open=document.body.classList.contains('open');m.setAttribute('aria-expanded',String(open));m.setAttribute('aria-label',open?'Collapse menu':'Expand menu')}};
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
  document.addEventListener('click',e=>{
    if(e.target&&e.target.id==='scrim'){document.body.classList.remove('open')}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('open'))document.body.classList.remove('open')});
  /* Leaving mobile widths: never keep a stale expanded state. */
  const mq=window.matchMedia('(max-width:'+BP+'px)');
  (mq.addEventListener?mq.addEventListener('change',()=>document.body.classList.remove('open')):mq.addListener(()=>document.body.classList.remove('open')));
})();
