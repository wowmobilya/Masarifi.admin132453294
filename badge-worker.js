/* Persist only scoped counters and opaque IDs. Foreground pages paint their badge;
 * push events paint from the worker even while the app is closed. */
(function(){'use strict';
const STORE='masarifi-badge-preferences',url=new URL('__app_badge',self.registration.scope).href;
let queue=Promise.resolve();
const bounded=n=>Math.min(9999,Math.max(0,Math.floor(Number(n)||0)));
const keys=list=>Array.isArray(list)?list.filter(x=>typeof x==='string'&&/^(campaign|system):[0-9a-f-]{36}$/i.test(x)).slice(-256):[];
async function paint(count){try{if(count)await self.navigator?.setAppBadge?.(count);else await self.navigator?.clearAppBadge?.();}catch{}}
function change(fn,paintNative=false){const task=queue.catch(()=>{}).then(async()=>{const cache=await caches.open(STORE);let state={userId:null,count:0,seen:[],read:[],serverAt:0};try{const hit=await cache.match(url);if(hit){const saved=await hit.json();if(Array.isArray(saved.seen))state={...state,...saved};}}catch{}const next=await fn(state);if(!next)return;next.count=bounded(next.count);next.seen=next.seen.slice(-256);next.read=keys(next.read);await cache.put(url,new Response(JSON.stringify(next)));if(paintNative)await paint(next.count);return next;});queue=task;return task;}
self.MasarifiBadge={
 account(userId){return change(s=>s.userId===userId?s:{userId:userId||null,count:0,seen:[],read:[],serverAt:0});},
 async exact(userId,count,read=[],badgeAt){let applied=false;const at=Date.parse(badgeAt);const state=await change(s=>{if(!userId){applied=true;return{userId:null,count:0,seen:[],read:[],serverAt:0};}if(s.userId!==userId)return;const next={...s,read:[...new Set([...keys(s.read),...keys(read)])]};if(!Number.isFinite(at)||at>=(s.serverAt||0)){applied=true;next.count=bounded(count);if(Number.isFinite(at)){next.serverAt=at;if(next.count===0)next.readThrough=Math.max(s.readThrough||0,at);}}return next;});return{state,applied};},
 async push(userId,id,source='campaign',current=()=>true,payload={}){
  let fresh=false;await change(async s=>{if(!await current()||s.userId!==userId)return;
   const key=source+':'+id;if(keys(s.read).includes(key)||s.seen.includes(key))return;
   const at=Date.parse(payload.badge_at),total=payload.badge_count;s.seen.push(key);if(Number.isFinite(at)&&at<(s.readThrough||0))return s;fresh=true;
   if(Number.isInteger(total)&&total>=0&&Number.isFinite(at)){
    if(at>=(s.serverAt||0)){s.count=bounded(total);s.serverAt=at;}
   }else s.count=bounded(s.count)+1;
   return s;
  },true);return fresh;
 }
};
self.addEventListener('message',event=>{if(event.data?.type!=='APP_BADGE')return;event.waitUntil((async()=>{const d=event.data,result=await self.MasarifiBadge.exact(d.userId,d.count,d.readKeys,d.badge_at);if(!d.userId||result.state?.userId!==d.userId)return;const read=new Set(keys(d.readKeys)),known=new Set(result.state.seen),clearKnown=result.applied&&result.state.count===0;for(const n of await self.registration.getNotifications()){const p=n.data||{},key=(p.source||'campaign')+':'+p.id;if(p.userId===d.userId&&(read.has(key)||clearKnown&&known.has(key)))n.close();}})());});
})();
