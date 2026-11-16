/* DASHBOARD LOOK (everyone, owner's request "allow all employees to customize their dashboard... they
   can adjust color, theme and background... apply a background theme or wallpaper which they download"):
   adds a "Dashboard look" tab inside Settings > My settings (window.VIRTUOSO_DASHBG, rendered by settings.js)
   where every person - admin or employee - can pick an accent colour and a background for their OWN
   Dashboard page: one of a few built-in gradient themes, or a photo of their own choosing. Saved on this
   device only (localStorage vx_dashbg), like the other Appearance preferences; nothing is written to the
   database, so this never touches what anyone else sees. Deliberately separate from Customize (studio.js,
   admin only), which can add/hide/rename whole pages - this module cannot touch pages or the menu at all,
   it only changes how the Dashboard page looks for the person who set it. The wallpaper is resized and
   recompressed in the browser before saving so it fits comfortably in localStorage; a photo that is still
   too big after that is rejected with a plain message asking for a smaller one. Action prefix `dt`. */
(function(){
  const KEY='vx_dashbg';
  const MAXB64=950000; // ~950 KB of base64, comfortably inside a browser's per-origin localStorage quota
  const ACCENTS=[
    {k:'',name:'Brand (default)',sw:null},
    {k:'blue',name:'Blue',sw:'#2f5bd8',fg:'#ffffff',soft:'#e4eafc'},
    {k:'green',name:'Green',sw:'#1a7f55',fg:'#ffffff',soft:'#e1f3ea'},
    {k:'purple',name:'Purple',sw:'#6f43d8',fg:'#ffffff',soft:'#ece4fb'},
    {k:'teal',name:'Teal',sw:'#0f8a8a',fg:'#ffffff',soft:'#e0f3f3'},
    {k:'red',name:'Red',sw:'#b3261e',fg:'#ffffff',soft:'#fbe4e2'},
    {k:'rose',name:'Rose',sw:'#c43b78',fg:'#ffffff',soft:'#fbe4ee'},
  ];
  const THEMES=[
    {k:'',name:'None (plain)',css:''},
    {k:'skyline',name:'Blue skyline',css:'linear-gradient(160deg,#dbeaff 0%,#eef5ff 45%,#ffffff 100%)'},
    {k:'meadow',name:'Soft meadow',css:'linear-gradient(160deg,#e3f3e6 0%,#f1faf0 45%,#ffffff 100%)'},
    {k:'dusk',name:'Navy dusk',css:'linear-gradient(160deg,#101c3f 0%,#1c2f63 55%,#2f5bd8 100%)'},
    {k:'gold',name:'Gold haze',css:'linear-gradient(160deg,#fff4da 0%,#fdecc3 45%,#ffffff 100%)'},
    {k:'sunset',name:'Sunset',css:'linear-gradient(160deg,#ffd9a8 0%,#ffb3a0 45%,#f06d9a 100%)'},
  ];
  const DEF={accent:'',theme:'',img:'',imgName:''};
  let P=Object.assign({},DEF);
  try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&typeof s==='object')for(const k in DEF)if(typeof s[k]===typeof DEF[k])P[k]=s[k]}catch(e){}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(P))}catch(e){toast('Could not save - your browser storage may be full')}};

  const css=document.createElement('style');
  document.head.appendChild(css);
  function apply(){
    const h=document.documentElement;
    const a=ACCENTS.find(x=>x.k===P.accent);
    if(a&&a.sw){h.style.setProperty('--accent',a.sw);h.style.setProperty('--accent-fg',a.fg);h.style.setProperty('--accent-soft',a.soft)}
    else{h.style.removeProperty('--accent');h.style.removeProperty('--accent-fg');h.style.removeProperty('--accent-soft')}
    const t=THEMES.find(x=>x.k===P.theme);
    const bgCss=P.img?`center/cover no-repeat url("${P.img}")`:t&&t.css?t.css:'';
    css.textContent=bgCss?`body.hasdashbg main{background:${bgCss};border-radius:10px}
      body.hasdashbg main>*{background:var(--surface);border-radius:10px;padding:10px;box-shadow:0 1px 3px rgba(0,0,0,.08)}`:'';
    mark();
  }
  const mark=()=>document.body.classList.toggle('hasdashbg',!!(state.user&&state.tab&&state.tab[state.role]==='dash'&&(P.img||P.theme)));
  document.addEventListener('DOMContentLoaded',apply);
  if(typeof render==='function'){const prevRender=render;render=function(){const r=prevRender.apply(this,arguments);mark();return r}}
  apply();

  function resizeFile(file){
    return new Promise((resolve,reject)=>{
      if(!/^image\//.test(file.type||''))return reject('Please choose an image file (JPG, PNG, etc).');
      if(file.size>15*1024*1024)return reject('That image is too large. Choose one under 15 MB.');
      const fr=new FileReader();
      fr.onerror=()=>reject('Could not read that file.');
      fr.onload=()=>{
        const img=new Image();
        img.onerror=()=>reject('Could not read that image.');
        img.onload=()=>{
          const max=1600,sc=Math.min(1,max/Math.max(img.width,img.height));
          const w=Math.max(1,Math.round(img.width*sc)),h=Math.max(1,Math.round(img.height*sc));
          const c=document.createElement('canvas');c.width=w;c.height=h;
          c.getContext('2d').drawImage(img,0,0,w,h);
          let q=0.75,out=c.toDataURL('image/jpeg',q);
          while(out.length>MAXB64&&q>0.35){q-=0.1;out=c.toDataURL('image/jpeg',q)}
          if(out.length>MAXB64)return reject('That image is still too large after shrinking it. Try a smaller or simpler photo.');
          resolve(out);
        };
        img.src=fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function html(){
    const swatch=(cur,list,act,extra)=>list.map(x=>{
      const on=x.k===cur;
      const style=x.sw?`background:${x.sw}`:(x.css||'background:var(--surface);border:1px dashed var(--line)');
      return `<button type="button" data-dt="${act}" data-k="${esc(x.k)}" title="${esc(x.name)}" aria-pressed="${on}"
        style="width:46px;height:46px;border-radius:50%;${style};border:${on?'3px solid var(--fg)':'2px solid var(--line)'};cursor:pointer;flex:none"></button>`;
    }).join('');
    return `<div class="panel stsec"><h3>Dashboard look</h3>
      <p class="note" style="margin:0">Saved on this device only. Changes only how your own Dashboard page looks - it cannot add, hide or rename any pages (an administrator still controls those from Customize).</p>
      <div><div class="l" style="margin-bottom:6px"><b>Accent colour</b><span>Used for buttons, highlights and badges across the app.</span></div>
        <div class="row" style="gap:10px;flex-wrap:wrap">${swatch(P.accent,ACCENTS,'accent')}</div></div>
      <div><div class="l" style="margin-bottom:6px"><b>Dashboard background theme</b><span>A background behind your Dashboard page only.</span></div>
        <div class="row" style="gap:10px;flex-wrap:wrap">${swatch(P.theme,THEMES,'theme')}</div></div>
      <div><div class="l" style="margin-bottom:6px"><b>Or use your own wallpaper</b><span>Upload a photo from this device to use as your Dashboard background instead.</span></div>
        <div class="row" style="gap:10px;align-items:center;flex-wrap:wrap">
          <label class="btn ghost" style="cursor:pointer">Choose image<input type="file" id="dtFile" accept="image/*" style="display:none"></label>
          ${P.img?`<span class="note">${esc(P.imgName||'Custom wallpaper')} in use</span><button class="btn sm ghost" type="button" data-act="dtRemove">Remove</button>`:''}
        </div>
        <div class="err" id="dtErr" role="alert" style="margin-top:6px">${esc(S_dt.err)}</div>
      </div>
      <div class="stbar"><button class="btn ghost" type="button" data-act="dtReset">Reset to default</button></div></div>`;
  }
  const S_dt={err:''};
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-dt]');
    if(b){
      const act=b.dataset.dt,k=b.dataset.k;
      if(act==='accent')P.accent=k;else if(act==='theme'){P.theme=k;P.img='';P.imgName='';}
      S_dt.err='';save();apply();if(typeof render==='function')render();return;
    }
    const r=e.target.closest&&e.target.closest('[data-act="dtRemove"]');
    if(r){P.img='';P.imgName='';save();apply();if(typeof render==='function')render();return}
    const rs=e.target.closest&&e.target.closest('[data-act="dtReset"]');
    if(rs){P=Object.assign({},DEF);S_dt.err='';save();apply();if(typeof render==='function')render();return}
  });
  document.addEventListener('change',e=>{
    if(e.target&&e.target.id==='dtFile'){
      const f=e.target.files&&e.target.files[0];if(!f)return;
      resizeFile(f).then(url=>{P.img=url;P.imgName=f.name;P.theme='';S_dt.err='';save();apply();if(typeof render==='function')render();toast('Wallpaper saved')})
        .catch(msg=>{S_dt.err=msg;if(typeof render==='function')render();});
    }
  });
  window.VIRTUOSO_DASHBG={html};
})();
