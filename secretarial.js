/* SECRETARIAL (admin): a new page in the Money menu, directly under Statement conversion.
   Created empty on the owner's request ("I will tell you next what functions should be inside the secretarial page").
   Functions are added here one by one; this file is the home for them. Nothing is stored yet.
   Menu: Money > Secretarial (admins only). Action prefix `sr`. */
(function(){
  'use strict';
  const UI=()=>window.VIRTUOSO_UI;
  function view(){
    const sub='Company secretarial work for the firm and its clients. The tools for this page are being set up.';
    const hero=UI()&&UI().hero?UI().hero({title:'Secretarial',sub,icon:'folder',gold:5}):`<h2>Secretarial</h2><p class="sub">${esc(sub)}</p>`;
    return hero+`<div class="stack"><div class="panel"><h3>Secretarial</h3>
      <p class="note" style="margin:0">This page is ready. Tell me which functions you want here and I will add them.</p></div></div>`;
  }
  VIEWS.secretarial=view;
  if(typeof ICON!=='undefined')ICON.secretarial='<path d="M5 3h11l3 3v15H5z"/><path d="M8 8h8M8 12h8M8 16h5"/><circle cx="16.500" cy="17.500" r="2.500"/>';
  const money=NAV.adm.find(g=>g[0]==='Money');
  if(money&&!money[1].some(x=>x[0]==='secretarial')){const i=money[1].findIndex(x=>x[0]==='stmt');money[1].splice(i>=0?i+1:money[1].length,0,['secretarial','Secretarial'])}
  window.VIRTUOSO_SECRETARIAL={view};
})();
