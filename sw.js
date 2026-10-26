const C='virtuous-v10',A=['./','index.html','config.js','auth.js','live-employees.js','live-time.js','assistant-engine.js','assistant.js','icon.png','icon-192.png','icon-512.png','logo.png','logo-dark.png','manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{const c=r.clone();caches.open(C).then(x=>x.put(e.request,c)).catch(()=>{});return r}).catch(()=>caches.match(e.request).then(m=>m||caches.match('index.html'))))});
