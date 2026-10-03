/* Persist only scoped counters and opaque IDs. Foreground pages paint their badge;
 * push events paint from the worker even while the app is closed. */
(function(){'use strict';
const STORE='masarifi-badge-preferences',url=new URL('__app_badge',self.registration.scope).href;
let queue=Promise.resolve();
const bounded=n=>Math.min(9999,Math.max(0,Math.floor(Number(n)||0)));
const keys=list=>Array.isArray(list)?list.filter(x=>typeof x==='string'&&/^(campaign|system):[0-9a-f-]{36}$/i.test(x)).slice(-256):[];
async function paint(count){try{if(count)await self.navigator?.setAppBadge?.(count);else await self.navigator?.clearAppBadge?.();}catch{}}
function change(fn,paintNative=false){const task=queue.catch(()=>{}).then(async()=>{const cache=await caches.open(STORE);let state={userId:null,count:0,seen:[],delivered:[],read:[],serverAt:0,badgeEnabled:true};try{const hit=await cache.match(url);if(hit){const saved=await hit.json();if(Array.isArray(saved.seen))state={...state,...saved,delivered:Array.isArray(saved.delivered)?saved.delivered:keys(saved.seen)};}}catch{}const next=await fn(state);if(!next)return;next.count=bounded(next.count);next.seen=keys(next.seen);next.delivered=keys(next.delivered);next.read=keys(next.read);await cache.put(url,new Response(JSON.stringify(next)));if(paintNative)await paint(next.badgeEnabled===false?0:next.count);return next;});queue=task;return task;}
self.MasarifiBadge={
 delivered(userId,id,source='campaign'){return change(s=>{if(s.userId!==userId)return;const key=source+':'+id;if(s.seen.includes(key)&&!keys(s.delivered).includes(key))s.delivered=[...keys(s.delivered),key];return s;});},
 account(userId){return change(async s=>{if(s.userId===userId)return s;if(s.userId||s.count)await paint(0);return{userId:userId||null,count:0,seen:[],delivered:[],read:[],serverAt:0,badgeEnabled:true};});},
 async exact(userId,count,read=[],badgeAt,badgeEnabled){let applied=false;const at=Date.parse(badgeAt);const state=await change(async s=>{if(!userId){applied=true;if(s.userId||s.count)await paint(0);return{userId:null,count:0,seen:[],delivered:[],read:[],serverAt:0,badgeEnabled:true};}if(s.userId!==userId)return;const next={...s,read:[...new Set([...keys(s.read),...keys(read)])]};if(typeof badgeEnabled==='boolean')next.badgeEnabled=badgeEnabled;if(!Number.isFinite(at)||at>=(s.serverAt||0)){applied=true;next.count=bounded(count);if(Number.isFinite(at)){next.serverAt=at;if(next.count===0)next.readThrough=Math.max(s.readThrough||0,at);}}return next;},true);return{state,applied};},
 async push(userId,id,source='campaign',current=()=>true,payload={}){
  let fresh=false;await change(async s=>{if(!await current()||s.userId!==userId)return;
   const key=source+':'+id,at=Date.parse(payload.badge_at),total=payload.badge_count;if(keys(s.read).includes(key)||keys(s.delivered).includes(key)||Number.isFinite(at)&&at<=(s.readThrough||0))return;if(s.seen.includes(key)){fresh=true;return s;}s.seen.push(key);fresh=true;
   if(typeof payload.badge_enabled==='boolean')s.badgeEnabled=payload.badge_enabled;
   if(Number.isInteger(total)&&total>=0&&Number.isFinite(at)){
    if(at>=(s.serverAt||0)){s.count=bounded(total);s.serverAt=at;if(typeof payload.badge_enabled==='boolean')s.badgeEnabled=payload.badge_enabled;}
   }else s.count=bounded(s.count)+1;
   return s;
  },true);return fresh;
 }
};
self.addEventListener('message',event=>{if(event.data?.type!=='APP_BADGE')return;event.waitUntil((async()=>{const d=event.data,result=await self.MasarifiBadge.exact(d.userId,d.count,d.readKeys,d.badge_at,d.badge_enabled);if(!d.userId||result.state?.userId!==d.userId)return;const read=new Set(keys(d.readKeys)),known=new Set(result.state.seen),clearKnown=result.applied&&result.state.count===0;for(const n of await self.registration.getNotifications()){const p=n.data||{},key=(p.source||'campaign')+':'+p.id;if(p.userId===d.userId&&(read.has(key)||clearKnown&&known.has(key)))n.close();}})());});
})();

/* One bounded payload/settings policy is shared by both notification workers. */
(function(){'use strict';
const categories=['family_expense','family_income','family_update','family_delete','family_other','family_access','direct_messages','photos','announcements','subscriptions','system'];
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const time=value=>typeof value==='string'&&/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
function quietHours(raw){return{enabled:raw?.enabled===true,start:time(raw?.start)?raw.start:'22:00',end:time(raw?.end)?raw.end:'07:00'};}
function isQuiet(raw,now=new Date()){const q=quietHours(raw);if(!q.enabled)return false;const minutes=s=>Number(s.slice(0,2))*60+Number(s.slice(3)),start=minutes(q.start),end=minutes(q.end),at=now.getHours()*60+now.getMinutes();return start===end||start<end&&at>=start&&at<end||start>end&&(at>=start||at<end);}
function settings(raw){const r={quietHours:quietHours(raw?.quietHours),preferences:{categories:{}}};for(const k of ['sound','images','badge','push'])r.preferences[k]=raw?.preferences?.[k]!==false;for(const k of categories)r.preferences.categories[k]={push:raw?.preferences?.categories?.[k]?.push!==false};return r;}
function expiry(value){if(typeof value!=='string')return false;const parts=/^([0-9]{4})-(0[1-9]|1[0-2])-([0-2][0-9]|3[01])[T ]([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:[.][0-9]{1,6})?(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])$/.exec(value);if(!parts||Number(parts[3])<1)return false;const day=new Date(0);day.setUTCFullYear(Number(parts[1]),Number(parts[2])-1,Number(parts[3]));return day.getUTCMonth()===Number(parts[2])-1&&day.getUTCDate()===Number(parts[3])&&Number.isFinite(Date.parse(value));}
function parse(data){let p;try{if(typeof data?.text==='function'){const text=data.text();if(typeof text!=='string'||text.length>30000)return null;p=JSON.parse(text);}else p=data?.json();}catch{return null;}if(!p||typeof p!=='object'||Array.isArray(p)||!uuid(p.id)||typeof p.user_id!=='string'||!p.user_id||p.user_id.length>200||/[\u0000-\u001f]/.test(p.user_id)||!['campaign','system'].includes(p.source??'campaign')||typeof p.title!=='string'||!p.title.trim()||p.title.length>4096||typeof p.body!=='string'||p.body.length>16000||typeof p.expires_at!=='string'||p.expires_at.length>48||!expiry(p.expires_at)||Date.parse(p.expires_at)<=Date.now())return null;const category=categories.includes(p.category)?p.category:null;return{...p,source:p.source||'campaign',category};}
self.MasarifiNotifications={quietHours,isQuiet,settings,parse};
})();
