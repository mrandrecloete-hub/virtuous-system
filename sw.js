const C='virtuous-v31',A=['./','index.html','form.html','public-form.js','config.js','auth.js','live-employees.js','live-time.js','live-petty.js','live-leave.js','live-payroll.js','live-forms.js','live-timesheet.js','bear.js','assistant-engine.js','assistant-forms.js','form-builder.js','ai-tools.js','settings.js','assistant.js','icon.png','icon-192.png','icon-512.png','icon-maskable-512.png','logo.png','logo-dark.png','manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
  /* Only cache this site's own files, never data requests to the backend or other sites. */
  if(new URL(e.request.url).origin!==location.origin)return;e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{const c=r.clone();caches.open(C).then(x=>x.put(e.request,c)).catch(()=>{});return r}).catch(()=>caches.match(e.request).then(m=>m||caches.match('index.html'))))});
