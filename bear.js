/* Bruno, the friendly bear mascot (original artwork, drawn as inline SVG so it works offline and in dark mode).
   window.VIRTUOSO_BEAR.svg(size, {mood}) returns an <svg> string. Moods: 'happy' (default), 'think'.
   Animations (blink, thinking dots) stop when the person prefers reduced motion. */
(function(){
  let n=0;
  const css=document.createElement('style');
  css.textContent=`
  .bruno{display:block;overflow:visible}
  .bruno .eyes{transform-box:fill-box;transform-origin:center;animation:bruno-blink 5.5s infinite}
  .bruno.think .pupils{transform:translateY(-2.5px)}
  .bruno .dots{opacity:0}.bruno.think .dots{opacity:1}
  .bruno .dots circle{animation:bruno-dot 1.2s infinite}.bruno .dots circle:nth-child(2){animation-delay:.2s}.bruno .dots circle:nth-child(3){animation-delay:.4s}
  @keyframes bruno-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}
  @keyframes bruno-dot{0%,100%{opacity:.25}50%{opacity:1}}
  @media (prefers-reduced-motion:reduce){.bruno .eyes,.bruno .dots circle{animation:none}}
  `;
  document.head.appendChild(css);
  function svg(size,opts){
    const id='bru'+(++n),mood=(opts&&opts.mood)==='think'?' think':'';
    return `<svg class="bruno${mood}" width="${size}" height="${size}" viewBox="0 0 160 160" role="img" aria-label="Bruno the bear" focusable="false">
      <defs>
        <radialGradient id="${id}f" cx="50%" cy="38%" r="68%"><stop offset="0" stop-color="#cf9558"/><stop offset="1" stop-color="#9a6535"/></radialGradient>
        <radialGradient id="${id}b" cx="50%" cy="20%" r="80%"><stop offset="0" stop-color="#b57a43"/><stop offset="1" stop-color="#8a5a2f"/></radialGradient>
      </defs>
      <path d="M14 160C14 126 42 110 80 110s66 16 66 50z" fill="url(#${id}b)"/>
      <circle cx="40" cy="42" r="21" fill="#9a6535"/><circle cx="40" cy="42" r="11" fill="#eab98b"/>
      <circle cx="120" cy="42" r="21" fill="#9a6535"/><circle cx="120" cy="42" r="11" fill="#eab98b"/>
      <ellipse cx="80" cy="76" rx="48" ry="43" fill="url(#${id}f)"/>
      <path d="M38 116q42 24 84 0l4 15q-46 28-92 0z" fill="#0a1b3f"/>
      <path d="M37 123q43 24 86 0l1.5 6q-44.500 25-89 0z" fill="#e6b422"/>
      <rect x="92" y="127" width="17" height="28" rx="6" fill="#0a1b3f" transform="rotate(-9 100 141)"/>
      <rect x="94.500" y="138" width="12" height="4.500" fill="#e6b422" transform="rotate(-9 100 141)"/>
      <ellipse cx="80" cy="94" rx="23" ry="18" fill="#f4d6ae"/>
      <g class="eyes"><g class="pupils"><ellipse cx="61" cy="70" rx="5.200" ry="6.200" fill="#2a1a0d"/><ellipse cx="99" cy="70" rx="5.200" ry="6.200" fill="#2a1a0d"/>
        <circle cx="63" cy="67.500" r="1.900" fill="#fff"/><circle cx="101" cy="67.500" r="1.900" fill="#fff"/></g></g>
      <path d="M71 86q9-6 18 0q-2 9-9 10q-7-1-9-10z" fill="#3a2412"/><ellipse cx="77" cy="86.500" rx="3" ry="1.400" fill="#fff" opacity=".35"/>
      <path d="M80 96v4M80 100q-7 7-14 1.500M80 100q7 7 14 1.500" stroke="#3a2412" stroke-width="2.400" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="49" cy="88" r="6.500" fill="#ff8f8f" opacity=".32"/><circle cx="111" cy="88" r="6.500" fill="#ff8f8f" opacity=".32"/>
      <g class="dots" fill="#e6b422"><circle cx="124" cy="18" r="4"/><circle cx="137" cy="12" r="4"/><circle cx="150" cy="6" r="4"/></g>
    </svg>`;
  }
  window.VIRTUOSO_BEAR={svg};
})();
