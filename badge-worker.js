/* Foreground clients paint their own badge; only push events paint from this worker.
 * Durable, scoped unread badge. Private notice contents are never stored here. */
(function(){'use strict';
const STORE='masarifi-badge-preferences',url=new URL('__app_badge',self.registration.scope).href;
let queue=Promise.resolve();
const bounded=n=>Math.min(9999,Math.max(0,Math.floor(Number(n)||0)));
async function paint(count){try{if(count)await self.navigator?.setAppBadge?.(count);else await self.navigator?.clearAppBadge?.();}catch{}}
function change(fn,paintNative=false){const task=queue.catch(()=>{}).then(async()=>{const cache=await caches.open(STORE);let state={userId:null,count:0,seen:[]};try{const hit=await cache.match(url);if(hit){const saved=await hit.json();if(Array.isArray(saved.seen))state=saved;}}catch{}const next=await fn(state);if(!next)return;next.count=bounded(next.count);next.seen=next.seen.slice(-256);await cache.put(url,new Response(JSON.stringify(next)));if(paintNative)await paint(next.count);});queue=task;return task;}
self.MasarifiBadge={
 account(userId){return change(s=>s.userId===userId?s:{userId:userId||null,count:0,seen:[]});},
 exact(userId,count){return change(s=>!userId?{userId:null,count:0,seen:[]}:s.userId!==userId?null:{...s,count:bounded(count)});},
 push(userId,id,source='campaign',current=()=>true){return change(async s=>{if(!await current())return;if(s.userId!==userId)return;const key=source+':'+id;if(s.seen.includes(key))return s;s.seen.push(key);s.count=bounded(s.count)+1;return s;},true);}
};
self.addEventListener('message',event=>{if(event.data?.type==='APP_BADGE')event.waitUntil(self.MasarifiBadge.exact(event.data.userId,event.data.count));});
})();
