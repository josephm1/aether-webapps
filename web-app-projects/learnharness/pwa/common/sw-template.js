'use strict';
const PREFIX=__PREFIX__,CACHE=__CACHE__,ASSETS=__ASSETS__;
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{
  // Sequential fetch/store bounds transient memory. Only immutable build assets.
  for(const asset of ASSETS){const response=await fetch(asset,{cache:'reload'});if(!response.ok)throw new Error('Offline asset missing: '+asset);await cache.put(asset,response);}
 }catch(error){await caches.delete(CACHE);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='APPLY_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(url.origin!==self.location.origin||request.method!=='GET')return;
 // Never cache user records, AI requests, tokens, credentials or external responses.
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/__aether_host__/'))return;
 if(request.mode==='navigate'){event.respondWith((async()=>{const shell=await(await caches.open(CACHE)).match('/index.html');return shell||fetch(request);})());return;}
 if(ASSETS.includes(url.pathname))event.respondWith((async()=>{const cached=await(await caches.open(CACHE)).match(url.pathname);return cached||fetch(request);})());
});
