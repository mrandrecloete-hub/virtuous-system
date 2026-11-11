/* PAGES ON THE EMPLOYEE'S MENU (admin: People > Employee dashboards). After choosing an employee the admin sees every page on that
   person's menu and can rename it, hide it (delete from their menu), bring it back, replace it with a new custom page, or delete an
   added page. Changes are saved in the same published config as notices, tasks and pages (config.menu = {hidden:[], rename:{}}),
   so they use the existing Publish button, sync to the employee automatically and alert them. Hidden pages are cosmetic: the
   database rules still decide what the employee can open. Dashboard is always shown. Action prefix `dm`. */
(function(){
  const D=()=>window.VIRTUOSO_DASHEDIT;
  const MAXP=10;
  const menuOf=A=>{const c=A.config;if(!c.menu||typeof c.menu!=='object')c.menu={};if(!Array.isArray(c.menu.hidden))c.menu.hidden=[];if(!c.menu.rename||typeof c.menu.rename!=='object')c.menu.rename={};return c.menu};
  function panel(A){
    const mn=menuOf(A),base=D().base().flatMap(g=>g[1]);
    const rows=base.map(([k,l])=>{
      const hid=mn.hidden.includes(k),fixed=k==='dash';
      return `<tr><td><input data-dm="ren" data-k="${esc(k)}" value="${esc(mn.rename[k]||'')}" placeholder="${esc(l)}" maxlength="40" aria-label="Name for ${esc(l)}" ${fixed?'':''} style="min-width:140px"></td>
        <td>${hid?'<span class="pill bad">Hidden</span>':'<span class="pill ok">Shown</span>'}</td>
        <td>${fixed?'<span class="note">Always shown</span>':`<div class="row" style="flex-wrap:wrap;gap:6px"><button class="btn sm ${hid?'':'ghost bad'}" data-act="dmToggle" data-k="${esc(k)}">${hid?'Show on menu':'Delete from menu'}</button><button class="btn sm ghost" data-act="dmReplace" data-k="${esc(k)}" data-l="${esc(mn.rename[k]||l)}">Replace with new page</button></div>`}</td></tr>`}).join('');
    const pages=(A.config.pages||[]).map(p=>`<tr><td><b>${esc(p.title||'Page')}</b> <span class="note">added page</span></td><td><span class="pill">Added</span></td><td><div class="row" style="flex-wrap:wrap;gap:6px"><button class="btn sm ghost" data-act="dxPage" data-id="${esc(p.id)}">Edit page</button><button class="btn sm ghost bad" data-act="dmDelPage" data-id="${esc(p.id)}">Delete page</button></div></td></tr>`).join('');
    return `<div class="panel" style="margin-top:12px"><h3 style="margin:0 0 4px">Pages on this employee's menu</h3>
      <div class="note" style="margin-bottom:8px">Rename a page by typing a new name. Delete a page from their menu, replace it with a page you build, or add new pages with the Dashboard / New page buttons below. Press <b>Publish to dashboard</b> when done and the employee is alerted.</div>
      <div class="tbl"><table style="min-width:520px"><thead><tr><th>Menu name</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}${pages}</tbody></table></div></div>`;
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
    D().dirty();render();
  },true);
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-act^="dm"]');if(!b)return;e.stopImmediatePropagation();
    const A=D().admin(),mn=menuOf(A),a=b.dataset.act,k=b.dataset.k;
    if(a==='dmToggle'){const i=mn.hidden.indexOf(k);if(i>=0)mn.hidden.splice(i,1);else mn.hidden.push(k);D().dirty();return render()}
    if(a==='dmReplace'){
      if((A.config.pages||[]).length>=MAXP)return toast('Up to '+MAXP+' pages per employee');
      if(!confirm('Hide "'+b.dataset.l+'" from this employee\'s menu and create a new empty page with the same name for you to build?'))return;
      const p={id:D().rid(),title:String(b.dataset.l||'New page').slice(0,60),blocks:[]};
      A.config.pages.push(p);if(!mn.hidden.includes(k))mn.hidden.push(k);A.page=p.id;D().dirty();return render()}
    if(a==='dmDelPage'){
      const p=A.config.pages.find(x=>x.id===b.dataset.id);if(!p||!confirm('Delete the page "'+p.title+'" and everything on it?'))return;
      A.config.pages=A.config.pages.filter(x=>x.id!==p.id);A.config.blocks=(A.config.blocks||[]).filter(x=>!(x.type==='link'&&x.tab==='cp_'+p.id));
      if(A.page===p.id)A.page=null;D().dirty();return render()}
  },true);
})();
