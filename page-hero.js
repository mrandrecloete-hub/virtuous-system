/* Shared look for premium pages: banner header (icon, big title with gold ending, subtitle, illustration),
   pill tabs and a small icon set. Used by Customize and Client KYC. window.VIRTUOSO_UI = { hero, tabs, icon }. */
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const P={
    gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    grid:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    doc:'<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    shield:'<path d="M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5L15.5 10"/>',
    users:'<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M19 20a6 6 0 0 0-3-5.2"/>',
    check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    warn:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    download:'<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    edit:'<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14 7l3 3"/>',
    dots:'<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    idcard:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.6 1.8-2.4 3-2.4s2.4.8 3 2.4M14 10h4M14 13h3"/>',
    reset:'<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    type:'<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    lines:'<path d="M4 7h16M4 12h16M4 17h10"/>',
    bolt:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    refresh:'<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
    chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
    task:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    save:'<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
    copy:'<rect x="9" y="9" width="11" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    print:'<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
    share:'<circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="6" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M8.3 10.8l7.4-3.6M8.3 13.2l7.4 3.6"/>',
    cube:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9"/>',
    question:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 17h.01"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>'
  };
  const icon=(n,s)=>`<svg viewBox="0 0 24 24" width="${s||20}" height="${s||20}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]||P.doc}</svg>`;

  /* illustrations (original artwork) */
  const ART={
    customize:`<svg viewBox="0 0 360 170" aria-hidden="true"><defs><linearGradient id="phg1" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#5aa2ff"/><stop offset="1" stop-color="#1747c9"/></linearGradient><linearGradient id="phg2" x1="0" x2="1"><stop offset="0" stop-color="#ffe07a"/><stop offset="1" stop-color="#e0a100"/></linearGradient></defs>
      <rect x="40" y="54" width="104" height="90" rx="14" fill="url(#phg1)" stroke="#9fc4ff" stroke-width="2"/><rect x="52" y="104" width="12" height="30" rx="3" fill="#fff" opacity=".9"/><rect x="70" y="90" width="12" height="44" rx="3" fill="#fff" opacity=".9"/><rect x="88" y="76" width="12" height="58" rx="3" fill="#fff" opacity=".9"/><rect x="106" y="96" width="12" height="38" rx="3" fill="#fff" opacity=".9"/>
      <g transform="translate(150 6)"><circle cx="48" cy="48" r="34" fill="none" stroke="url(#phg1)" stroke-width="16" stroke-dasharray="14 8"/><circle cx="48" cy="48" r="34" fill="none" stroke="#9fc4ff" stroke-width="3"/><circle cx="48" cy="48" r="12" fill="#04134a" stroke="#9fc4ff" stroke-width="3"/></g>
      <g transform="rotate(38 270 80)"><rect x="258" y="20" width="22" height="86" rx="6" fill="url(#phg2)"/><rect x="258" y="100" width="22" height="22" rx="4" fill="#d8dfee"/><path d="M250 122h38l-6 34c-2 8-24 8-26 0z" fill="#f4f6fb"/></g></svg>`,
    kyc:`<svg viewBox="0 0 360 170" aria-hidden="true"><defs><linearGradient id="phk1" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#7fb4ff"/><stop offset="1" stop-color="#1b55d6"/></linearGradient></defs>
      <rect x="110" y="24" width="190" height="122" rx="16" fill="url(#phk1)" opacity=".92" stroke="#bcd7ff" stroke-width="2"/><circle cx="160" cy="68" r="17" fill="#e8f1ff"/><path d="M130 124c4-22 20-30 30-30s26 8 30 30z" fill="#e8f1ff"/><rect x="210" y="54" width="70" height="8" rx="4" fill="#e8f1ff"/><rect x="210" y="74" width="56" height="8" rx="4" fill="#e8f1ff" opacity=".8"/><rect x="210" y="94" width="64" height="8" rx="4" fill="#e8f1ff" opacity=".6"/>
      <circle cx="288" cy="112" r="26" fill="#1fb86a" stroke="#fff" stroke-width="4"/><path d="M276 112l8 8 14-16" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };
  ART.formbuilder=`<svg viewBox="0 0 360 170" aria-hidden="true"><defs><linearGradient id="phf1" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#9ec3ff"/><stop offset="1" stop-color="#2a63d8"/></linearGradient><linearGradient id="phf2" x1="0" x2="1"><stop offset="0" stop-color="#ffe07a"/><stop offset="1" stop-color="#d79b00"/></linearGradient></defs>
      <rect x="60" y="14" width="200" height="124" rx="10" fill="#0c2a78" stroke="#8fb6f5" stroke-width="3"/><rect x="70" y="26" width="180" height="100" rx="5" fill="url(#phf1)" opacity=".85"/><rect x="82" y="38" width="70" height="8" rx="4" fill="#fff"/><rect x="82" y="56" width="140" height="12" rx="4" fill="#e8f1ff"/><rect x="82" y="78" width="140" height="12" rx="4" fill="#e8f1ff"/><rect x="82" y="100" width="46" height="14" rx="7" fill="#fff"/><path d="M40 146h240l-18 14H58z" fill="#7fa6e8" opacity=".7"/>
      <g transform="rotate(40 290 70)"><rect x="280" y="6" width="22" height="92" rx="8" fill="url(#phf2)"/><path d="M278 98h26l-7 28c-1 4-11 4-12 0z" fill="#f4f6fb"/><path d="M286 126h10l-5 16z" fill="#2a63d8"/></g></svg>`;
  ART.letters=`<svg viewBox="0 0 360 170" aria-hidden="true"><defs><linearGradient id="phl1" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#cfe1ff"/><stop offset="1" stop-color="#7fa8ec"/></linearGradient><linearGradient id="phl2" x1="0" x2="1"><stop offset="0" stop-color="#ffe07a"/><stop offset="1" stop-color="#d79b00"/></linearGradient></defs>
      <g transform="rotate(-8 150 90)"><rect x="60" y="30" width="170" height="120" rx="8" fill="url(#phl1)" opacity=".9"/><rect x="78" y="52" width="100" height="8" rx="4" fill="#4b6fb8"/><rect x="78" y="72" width="130" height="6" rx="3" fill="#6f8fcb"/><rect x="78" y="88" width="120" height="6" rx="3" fill="#6f8fcb"/><rect x="78" y="104" width="126" height="6" rx="3" fill="#6f8fcb"/><rect x="78" y="120" width="80" height="6" rx="3" fill="#6f8fcb"/></g>
      <g transform="rotate(35 280 80)"><rect x="268" y="6" width="22" height="104" rx="8" fill="#1a2f6e"/><rect x="268" y="14" width="22" height="10" fill="url(#phl2)"/><path d="M266 110h26l-6 36c-1 5-13 5-14 0z" fill="url(#phl2)"/></g></svg>`;
  const hasIcon={
    wallet:`<svg viewBox="0 0 64 64" width="78" height="78" aria-hidden="true"><defs><linearGradient id="phi6" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ffd166"/><stop offset="1" stop-color="#c98a00"/></linearGradient><linearGradient id="phi7" x1="0" x2="1"><stop offset="0" stop-color="#ffe07a"/><stop offset="1" stop-color="#d79b00"/></linearGradient></defs><path d="M8 20a6 6 0 0 1 6-6h30l-4 6z" fill="#b87d00"/><rect x="6" y="18" width="46" height="34" rx="8" fill="url(#phi6)"/><rect x="34" y="28" width="20" height="14" rx="6" fill="#8a5a00"/><circle cx="41" cy="35" r="3.2" fill="#ffe9a8"/><circle cx="50" cy="48" r="9" fill="none" stroke="url(#phi7)" stroke-width="5" stroke-dasharray="5 3.5"/><circle cx="50" cy="48" r="4" fill="#061a5c"/></svg>`,
    form:`<svg viewBox="0 0 64 64" width="76" height="76" aria-hidden="true"><defs><linearGradient id="phi4" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#7fb4ff"/><stop offset="1" stop-color="#1b55d6"/></linearGradient><linearGradient id="phi5" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ffe07a"/><stop offset="1" stop-color="#d79b00"/></linearGradient></defs><rect x="6" y="6" width="42" height="50" rx="9" fill="url(#phi4)" stroke="#cfe1ff" stroke-width="2"/><rect x="14" y="16" width="26" height="6" rx="3" fill="#fff"/><rect x="14" y="28" width="26" height="6" rx="3" fill="#fff" opacity=".85"/><rect x="14" y="40" width="16" height="6" rx="3" fill="#fff" opacity=".7"/><circle cx="46" cy="44" r="11" fill="none" stroke="url(#phi5)" stroke-width="7" stroke-dasharray="6 4"/><circle cx="46" cy="44" r="5" fill="#061a5c"/></svg>`,
    folder:`<svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true"><defs><linearGradient id="phi3" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ffe07a"/><stop offset="1" stop-color="#d79b00"/></linearGradient></defs><path d="M6 14a4 4 0 0 1 4-4h14l6 6h24a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill="url(#phi3)"/><rect x="18" y="22" width="30" height="26" rx="3" fill="#2f6fe4" stroke="#bcd7ff" stroke-width="2"/><path d="M24 30h18M24 36h18M24 42h11" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`,
    gear:`<svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true"><defs><linearGradient id="phi1" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ffe07a"/><stop offset="1" stop-color="#d79b00"/></linearGradient></defs><circle cx="32" cy="32" r="22" fill="none" stroke="url(#phi1)" stroke-width="12" stroke-dasharray="9 6"/><circle cx="32" cy="32" r="18" fill="none" stroke="url(#phi1)" stroke-width="5"/><circle cx="32" cy="32" r="8" fill="#04134a" stroke="url(#phi1)" stroke-width="4"/></svg>`,
    shield:`<svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true"><defs><linearGradient id="phi2" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ffe07a"/><stop offset="1" stop-color="#d79b00"/></linearGradient></defs><path d="M32 4l24 9v18c0 15-10 26-24 30C18 57 8 46 8 31V13z" fill="#0a2a7a" stroke="url(#phi2)" stroke-width="4"/><path d="M20 32l8 8 17-18" fill="none" stroke="url(#phi2)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };

  const css=document.createElement('style');
  css.textContent=`
  .pghero{position:relative;display:flex;align-items:center;gap:22px;min-height:150px;padding:20px 28px;margin:0 0 16px;border-radius:22px;color:#fff;overflow:hidden;
    background:radial-gradient(520px 220px at 88% 10%,rgba(90,150,255,.55),transparent 65%),radial-gradient(380px 200px at 10% 120%,rgba(246,213,106,.18),transparent 70%),linear-gradient(115deg,#04134a 0%,#07257f 50%,#0b3fb5 100%);box-shadow:0 14px 34px rgba(5,20,90,.35)}
  .pghero::after{content:"";position:absolute;inset:auto -10% -40px -10%;height:90px;background:radial-gradient(ellipse at 50% 100%,rgba(130,180,255,.35),transparent 70%);pointer-events:none}
  .pgh-ic{flex:none;display:grid;place-items:center;filter:drop-shadow(0 6px 12px rgba(0,0,0,.35))}
  .pgh-div{flex:none;width:2px;align-self:stretch;margin:6px 0;background:linear-gradient(180deg,transparent,#f3c64a,transparent)}
  .pgh-t{flex:1;min-width:0;position:relative;z-index:1}
  .pgh-title{margin:0;color:#fff;font-size:clamp(30px,4.4vw,48px);line-height:1.05;font-weight:800;letter-spacing:-.01em;text-wrap:balance}
  .pgh-title span{background:linear-gradient(180deg,#ffe17a,#f0a800);-webkit-background-clip:text;background-clip:text;color:transparent}
  .pgh-sub{margin:8px 0 0;color:#e3ecff;font-size:15px;line-height:1.4;max-width:60ch}
  .pgh-act{display:flex;flex-wrap:wrap;gap:12px;margin-top:14px}
  .pgh-art{flex:none;width:min(36%,360px);position:relative;z-index:1;filter:drop-shadow(0 10px 18px rgba(0,0,0,.35))}
  .pgh-art svg{display:block;width:100%;height:auto}
  @media (min-width:821px){.pghero{margin-top:-64px;padding-top:76px}}
  @media (max-width:820px){.pghero{padding:16px;gap:12px;min-height:0;border-radius:16px}.pgh-ic,.pgh-div,.pgh-art{display:none}.pgh-title{font-size:30px}.pgh-sub{font-size:13.5px}}
  .pgtabs{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 16px}
  .pgtabs button{display:inline-flex;align-items:center;gap:9px;border:1px solid #cfdcf7;border-radius:999px;background:#fff;color:#0a2a7a;font:inherit;font-weight:800;font-size:15px;padding:0 22px;min-height:50px;cursor:pointer;box-shadow:0 6px 16px rgba(15,40,110,.14)}
  .pgtabs button:hover{background:#eef4ff}
  .pgtabs button[aria-pressed=true]{background:linear-gradient(180deg,#ffd75e,#e8a600);color:#0a1b3f;border-color:#f0b400;box-shadow:0 8px 22px rgba(232,166,0,.45)}
  .pgtabs svg{flex:none}
  .sdbox{background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden;margin-bottom:16px;box-shadow:0 10px 26px rgba(15,40,110,.12)}
  .sdbar{display:flex;align-items:center;gap:12px;padding:14px 22px;background:linear-gradient(180deg,#0a2a7a,#051a56);color:#fff;font-weight:800;font-size:19px;border-bottom:3px solid #e8a600}
  .sdbar svg{color:#f3c64a}
  .sdbox>.in{padding:18px 22px}
  .sdfld{position:relative;display:flex;align-items:center}
  .sdfld svg{position:absolute;left:14px;color:var(--accent);pointer-events:none}
  .sdfld select{width:100%;padding-left:44px;min-height:48px;border-radius:12px;font-weight:600}
  .sdlite{display:inline-flex;align-items:center;gap:10px;border-radius:14px;padding:0 24px;min-height:52px;font:inherit;font-weight:800;font-size:16px;cursor:pointer;background:#fff;color:#0a3aa8;border:1.5px solid #b7cbf3;box-shadow:0 6px 16px rgba(15,40,110,.14)}
  .sdlite:hover{background:#eef4ff}
  .sdblocks{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(128px,1fr))}
  .sdblocks button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;min-height:78px;padding:10px 8px;border-radius:12px;border:1.5px solid #c6d4f1;background:#fff;color:#0a2a7a;font:inherit;font-weight:700;font-size:14px;line-height:1.2;cursor:pointer;box-shadow:0 4px 12px rgba(15,40,110,.1)}
  .sdblocks button svg{color:#1646c0}
  .sdblocks button:hover{background:#eef4ff;border-color:#8fb0ee}
  @media (max-width:820px){.pgtabs{gap:8px}.pgtabs button{min-height:42px;padding:0 14px;font-size:13.5px}}
  `;
  document.head.appendChild(css);

  function hero(o){
    const t=String(o.title||''),cut=o.gold?t.length-o.gold:Math.ceil(t.length*.55);
    const title=`${esc(t.slice(0,cut))}<span>${esc(t.slice(cut))}</span>`;
    return `<section class="pghero" aria-label="${esc(t)}">${o.icon&&hasIcon[o.icon]?`<div class="pgh-ic">${hasIcon[o.icon]}</div><div class="pgh-div"></div>`:''}<div class="pgh-t"><h1 class="pgh-title">${title}</h1><p class="pgh-sub">${esc(o.sub||'')}</p>${o.actions?`<div class="pgh-act">${o.actions}</div>`:''}</div>${o.art&&ART[o.art]?`<div class="pgh-art">${ART[o.art]}</div>`:''}</section>`;
  }
  /* items: [[key,label,iconName]]; attrs builds the data-* part for each button */
  function tabs(items,active,attrs){
    return `<div class="pgtabs" role="tablist">${items.map(([k,l,ic])=>`<button type="button" role="tab" ${attrs(k)} aria-pressed="${k===active}">${icon(ic,20)}<span>${esc(l)}</span></button>`).join('')}</div>`;
  }
  window.VIRTUOSO_UI={hero,tabs,icon};
})();
