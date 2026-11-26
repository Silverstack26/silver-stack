const CACHE = 'silver-stack-v270';
const CORE = ['./index.html','./styles.css?v=270','./app.js?v=270','./config.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install', event => event.waitUntil((async()=>{
  const cache = await caches.open(CACHE);
  await cache.addAll(CORE.map(url=>new Request(url,{cache:'reload'})));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async()=>{
  for(const key of await caches.keys()) if(key.startsWith('silver-stack-') && key!==CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event=>{
  const req=event.request, url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin)return;
  const nav=req.mode==='navigate';
  if(!nav && !CORE.some(path=>new URL(path,self.registration.scope).pathname===url.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try {
      const response=await fetch(req,{cache:'no-store'});
      if(response.ok && response.type==='basic' && (!nav || (!url.search && !url.hash))) {
        try {await cache.put(nav?new URL('./index.html',self.registration.scope).href:req,response.clone());} catch (_) {}
      }
      return response;
    } catch(err) {
      if(nav && url.search) return new Response('Connect to the internet to open this link.',{status:503,headers:{'Content-Type':'text/plain'}});
      return (await cache.match(nav?new URL('./index.html',self.registration.scope).href:req)) || Response.error();
    }
  })());
});
