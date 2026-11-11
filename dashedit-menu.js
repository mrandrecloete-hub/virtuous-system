/* PAGES ON THE EMPLOYEE'S MENU (admin: People > Employee dashboards). After choosing an employee the admin sees every page on that
   person's menu and can rename it, hide it (delete from their menu), bring it back, replace it with a new custom page, or delete an
   added page. Changes are saved in the same published config as notices, tasks and pages (config.menu = {hidden:[], rename:{}}),
   so they use the existing Publish button, sync to the employee automatically and alert them. Hidden pages are cosmetic: the
   database rules still decide what the employee can open. Dashboard is always shown. Dashboard functions (tiles, chart, quick buttons) are listed too and can be hidden or replaced with a card.
   Every row has an Actions dropdown (replace / delete). config.menu.hiddenFns holds the hidden functions. Action prefix `dm`. */
(function(){
  const D=()=>window.VIRTUOSO_DASHEDIT;
  const MAXP=10;
  const menuOf=A=>{const c=A.config;if(!c.menu||typeof c.menu!=='object')c.menu={};if(!Array.isArray(c.menu.hidden))c.menu.hidden=[];if(!c.menu.rename||typeof c.menu.rename!=='object')c.menu.rename={};return c.menu};
  const FNS=[['qlog','Quick button: Log time'],['qleave','Quick button: Apply for leave'],['qprofile','Quick button: My profile'],['hours','Tile: Hours this week'],['entries','Tile: Entries to submit'],['leavetile','Tile: Leave applications waiting'],['buy','Tile: Office items to buy'],['alerts','Tile: Unread alerts'],['chart','Chart: Hours by day'],['myleave','List: My leave'],['yourpages','Shortcuts: Your pages']];
  const fnOf=A=>{const m=menuOf(A);if(!Array.isArray(m.hiddenFns))m.hiddenFns=[];return m.hiddenFns};
  const sel=(kind,k,opts,l)=>`<select data-dm="act" data-kind="${kind}" data-k="${esc(k)}" data-l="${esc(l||'')}" aria-label="Actions"><option value="">Actions…</option>${opts.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select>`;
  function panel(A){
    const mn=menuOf(A),hf=fnOf(A),base=D().base().flatMap(g=>g[1]);
    const rows=base.map(([k,l])=>{
      const hid=mn.hidden.includes(k),fixed=k==='dash';
      return `<tr><td><input data-dm="ren" data-k="${esc(k)}" value="${esc(mn.rename[k]||'')}" placeholder="${esc(l)}" maxlength="40" aria-label="Name for ${esc(l)}" style="min-width:140px"></td>
        <td>${hid?'<span class="pill bad">Hidden</span>':'<span class="pill ok">Shown</span>'}</td>
        <td>${fixed?'<span class="note">Always shown</span>':sel('page',k,[[hid?'show':'hide',hid?'Show on menu':'Delete from menu'],['replace','Replace with a new page']],mn.rename[k]||l)}</td></tr>`}).join('');
    const pages=(A.config.pages||[]).map(p=>`<tr><td><b>${esc(p.title||'Page')}</b> <span class="note">added page</span></td><td><span class="pill">Added</span></td>
      <td>${sel('added',p.id,[['edit','Edit this page'],['clear','Replace (start empty)'],['del','Delete page']])}</td></tr>`).join('');
    const fns=FNS.map(([k,l])=>{const hid=hf.includes(k);
      return `<tr><td>${esc(l)}</td><td>${hid?'<span class="pill bad">Hidden</span>':'<span class="pill ok">Shown</span>'}</td>
        <td>${sel('fn',k,[[hid?'show':'hide',hid?'Show on dashboard':'Delete from dashboard'],['replace','Replace with a new card']],l)}</td></tr>`}).join('');
    return `<div class="panel" style="margin-top:12px"><h3 style="margin:0 0 4px">Pages on this employee's menu</h3>
      <div class="note" style="margin-bottom:8px">Every page has an <b>Actions</b> dropdown: replace it or delete it from their menu. Rename a page by typing a new name. Press <b>Publish to dashboard</b> when done and the employee is alerted.</div>
      <div class="tbl"><table style="min-width:520px"><thead><tr><th>Menu name</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}${pages}</tbody></table></div></div>
      <div class="panel" style="margin-top:12px"><h3 style="margin:0 0 4px">Functions on this employee's dashboard</h3>
      <div class="note" style="margin-bottom:8px">The tiles, chart, lists and quick buttons they see. Delete any of them, or replace one with a card of your own (it is added to the dashboard section below for you to fill in).</div>
      <div class="tbl"><table style="min-width:520px"><thead><tr><th>Function</th><th>Status</th><th>Actions</th></tr></thead><tbody>${fns}</tbody></table></div></div>`;
  }
  function wrap(){
    const base=VIEWS.dashedit;if(!base||!D())return;
    VIEWS.dashedit=()=>{
      const h=base(),A=D().admin(),i=h.indexOf('<div class="dxtabs">');
      if(i<0||!A.sel||A.loading)return h;
      return h.slice(0,i)+panel(A)+h.slice(i);
    };
  }
  wrap();
  document.addEventListener('change',e=>{
    const t=e.target;if(!t.dataset||t.dataset.dm!=='ren')return;e.stopImmediatePropagation();
    const A=D().admin(),mn=menuOf(A),v=String(t.value||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,40);
    if(v)mn.rename[t.dataset.k]=v;else delete mn.rename[t.dataset.k];
    D().dirty();render();autosave();
  },true);
  function autosave(){setTimeout(()=>{const b=document.querySelector('[data-act=dxPublish]');if(b&&!b.disabled)b.click()},50)}
  function doAct(t){
    const A=D().admin(),mn=menuOf(A),hf=fnOf(A),kind=t.dataset.kind,k=t.dataset.k,l=t.dataset.l,v=t.value;if(!v)return;
    const toggle=(arr,key,on)=>{const i=arr.indexOf(key);if(on&&i<0)arr.push(key);if(!on&&i>=0)arr.splice(i,1)};
    if(kind==='page'){
      if(v==='hide')toggle(mn.hidden,k,true);
      else if(v==='show')toggle(mn.hidden,k,false);
      else if(v==='replace'){
        if((A.config.pages||[]).length>=MAXP)return toast('Up to '+MAXP+' pages per employee');
        if(!confirm('Hide "'+l+'" from this employee\'s menu and create a new empty page with the same name for you to build?'))return;
        const p={id:D().rid(),title:String(l||'New page').slice(0,60),blocks:[]};A.config.pages.push(p);toggle(mn.hidden,k,true);A.page=p.id}
    }else if(kind==='fn'){
      if(v==='hide')toggle(hf,k,true);
      else if(v==='show')toggle(hf,k,false);
      else if(v==='replace'){
        if(!confirm('Hide "'+l+'" and add an empty card with that title to the dashboard for you to fill in?'))return;
        toggle(hf,k,true);A.config.blocks.push({id:D().rid(),type:'text',title:l.replace(/^[^:]*:\s*/,''),body:''});A.page=null}
    }else if(kind==='added'){
      const p=A.config.pages.find(x=>x.id===k);if(!p)return;
      if(v==='edit')A.page=p.id;
      else if(v==='clear'){if(!confirm('Remove everything on "'+p.title+'" so you can start again?'))return;p.blocks=[];A.page=p.id}
      else if(v==='del'){if(!confirm('Delete the page "'+p.title+'" and everything on it?'))return;
        A.config.pages=A.config.pages.filter(x=>x.id!==p.id);A.config.blocks=(A.config.blocks||[]).filter(x=>!(x.type==='link'&&x.tab==='cp_'+p.id));if(A.page===p.id)A.page=null}
    }
    D().dirty();render();
    if(['hide','show','del'].includes(v))autosave();
  }
  document.addEventListener('change',e=>{const t=e.target;if(t.dataset&&t.dataset.dm==='act'){e.stopImmediatePropagation();doAct(t)}},true);
  /* employee side: hide the functions the admin deleted (elements carry data-fn) */
  let lastCss='';
  setInterval(()=>{
    let css='';
    if(state.user&&state.user.type==='emp'&&D()){const c=D().cfg(),h=c&&c.menu&&Array.isArray(c.menu.hiddenFns)?c.menu.hiddenFns:[];
      css=h.filter(x=>/^[a-z]+$/.test(x)).map(x=>`[data-fn="${x}"]{display:none!important}`).join('');}
    if(css!==lastCss){lastCss=css;let st=document.getElementById('dmFnCss');if(!st){st=document.createElement('style');st.id='dmFnCss';document.head.appendChild(st)}st.textContent=css}
  },700);
})();
