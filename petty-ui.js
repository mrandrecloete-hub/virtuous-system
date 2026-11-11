/* PETTY CASH SHEET and PETTY CASH in the premium layout: banner header, white stat cards with coloured icons, a dashed
   upload zone, navy table headers and pill buttons. It wraps the existing pages (nothing about how they work changes):
   the page's own heading and intro become the banner, and the rest is restyled by CSS scoped to .pcx. */
(function(){
  const UI=()=>window.VIRTUOSO_UI;
  const ic=p=>'url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>')+'")';
  const ICON={
    wallet:ic('<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3"/><path d="M21 10h-5a2 2 0 0 0 0 4h5z"/>'),
    swap:ic('<path d="M7 7h12l-3-3M17 17H5l3 3"/>'),
    ok:ic('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    pause:ic('<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>'),
    list:ic('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>')
  };
  const cloud='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2f6fe4" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 9.5"/><path d="M12 21v-8M9 15.5l3-3 3 3"/></svg>')+'")';
  const css=document.createElement('style');
  css.textContent=`
  .pcx{display:block}
  .pcx>.row:first-child{background:#fff;border:1px solid #dfe8fb;border-radius:16px;padding:14px 18px;box-shadow:0 8px 22px rgba(15,40,110,.1);margin-bottom:16px;gap:16px}
  .pcx>.row:first-child label{font-weight:800;color:#0a2a7a}
  .pcx select,.pcx input[type=text],.pcx input[type=number],.pcx input[type=date],.pcx input:not([type]){border-radius:10px;min-height:44px}
  .pcx .panel{border-radius:18px;background:#fff;border:1px solid #e1e9fa;box-shadow:0 10px 26px rgba(15,40,110,.1)}
  .pcx .panel>h3,.pcx .panel>.ph>h3{color:#0a2a7a;font-weight:800}
  .pcx .tiles{grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
  .pcx .tile{display:grid;grid-template-columns:56px minmax(0,1fr);column-gap:14px;align-items:center;padding:14px 16px;border-radius:18px;background:linear-gradient(180deg,#fff,#f4f8ff);border:1px solid #e1e9fa;box-shadow:0 10px 24px rgba(15,40,110,.12)}
  .pcx .tile::before{content:"";grid-row:1/4;width:52px;height:52px;border-radius:16px;background-repeat:no-repeat;background-position:center;background-size:28px,cover;box-shadow:0 6px 14px rgba(20,60,170,.3)}
  .pcx .panel>.ph:first-child{margin:0 0 12px;padding:0;background:none;color:inherit;border:0}
  .pcx .panel>.ph:first-child h3{color:#0a2a7a;font-size:18px;font-weight:800}.pcx .panel>.ph:first-child h3::before{display:none}
  .pcx .ph .btn.ghost{color:#0a3aa8;background:#fff;border-color:#b7cbf3}
  .pcx .tile b{white-space:nowrap;font-size:clamp(17px,1.6vw,22px);line-height:1.15;color:#1646c0;font-weight:800;grid-column:2}
  .pcx .tile span,.pcx .tile small{grid-column:2;font-size:13px;color:#33406b}
  .pcx .tile:nth-child(5n+1)::before{background-image:${ICON.wallet},linear-gradient(135deg,#3b82f6,#1646c0)}
  .pcx .tile:nth-child(5n+2)::before{background-image:${ICON.swap},linear-gradient(135deg,#9b6cf7,#5a2fd1)}.pcx .tile:nth-child(5n+2) b{color:#5a2fd1}
  .pcx .tile:nth-child(5n+3)::before{background-image:${ICON.ok},linear-gradient(135deg,#34c47c,#16905a)}.pcx .tile:nth-child(5n+3) b{color:#16905a}
  .pcx .tile:nth-child(5n+4)::before{background-image:${ICON.pause},linear-gradient(135deg,#ffb020,#e07a00)}.pcx .tile:nth-child(5n+4) b{color:#d97100}
  .pcx .tile:nth-child(5n+5)::before{background-image:${ICON.ok},linear-gradient(135deg,#3b9bff,#1b6ae0)}
  .pcx .tile:has(input),.pcx .tile:has(label){display:block}.pcx .tile:has(input)::before,.pcx .tile:has(label)::before{display:none}
  .pcx .drop{border:2px dashed #9db8f0;background:linear-gradient(180deg,#f2f7ff,#e9f1ff);border-radius:18px;color:#25407f;padding:26px 16px 24px}
  .pcx .drop::before{content:"";display:block;width:64px;height:54px;margin:0 auto 10px;background:${cloud} center/contain no-repeat}
  .pcx .drop b{display:block;color:#0a2a7a;font-size:16px}
  .pcx .tbl table thead th{background:linear-gradient(180deg,#0a2a7a,#051a56);color:#fff;font-weight:800;padding:12px 14px;border:0;white-space:nowrap}
  .pcx .tbl table thead th:first-child{border-radius:12px 0 0 0}.pcx .tbl table thead th:last-child{border-radius:0 12px 0 0}
  .pcx .tbl table td{padding:11px 14px;border-bottom:1px solid #e3eafa}
  .pcx .btn.bad,.pcx .btn.sm.bad{background:#fff;color:#d12b2b;border:1.5px solid #e46b6b;border-radius:999px;font-weight:700}
  .pcx .btn.bad:hover{background:#fff0f0}
  @media(max-width:820px){.pcx .tile{grid-template-columns:48px minmax(0,1fr)}.pcx .tile::before{width:44px;height:44px;background-size:24px,cover}}
  `;
  document.head.appendChild(css);
  const HERO={sheets:['sheet',5],cash:['cash',4]};
  function wrap(tab){
    const base=VIEWS[tab];if(typeof base!=='function')return;
    VIEWS[tab]=function(){
      const h=base(),m=/<h2>([^<]*)<\/h2><p class="sub"[^>]*>([\s\S]*?)<\/p>/.exec(h),U=UI();
      if(!m||!U)return h;
      const sub=m[2].replace(/<[^>]+>/g,'');
      return U.hero({title:m[1],sub,icon:'wallet',gold:HERO[tab][1]})+'<div class="pcx">'+h.replace(m[0],'')+'</div>';
    };
  }
  ['sheets','cash'].forEach(wrap);
})();
