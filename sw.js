importScripts('./badge-worker.js');
'use strict';

// Generated identity and integrity manifest. Run tools/finalize-release.cjs after every source edit.
const BUILD_ID='7cb85cfb994a5786eaf153efb9d27a2ae042accb1d717fab80c1bf21f2cd687f';
const BUILD_VERSION='8.7.1';
const SHELL_ASSETS={"./admin-command.css":"51679f87fc3544fc7101e622a277093112242211d27b4baed464723f1abd4d12","./admin-command.js":"f734ca566137ad342fc23560ffed6ee790402b791dbb674b7dc37fe59e3bc8de","./admin-icon.svg":"088acb19301422125b8955c278ae775c9514966f2399f397a9ad34f5f403771c","./app-experience.css":"d3502a956ea596bcbd73c1c19983128e358c8027d19e7b1a8c57abe4789d4d2f","./app-experience.js":"dca9ce74b11f620bc4f4709aceaad2a48ee6057d90629e8b0209238cefdb445a","./app-locale.js":"d3c10623ba6df70f131b42ef6b9a4c2841e8c539f27e2770cfd4270a46efac81","./app.css":"5235c8c8e09d8abaf7847c0066fb6d111a5b80605e615cf90ea65dad7dc1fe72","./badge-worker.js":"ec190079f79b71531e2068945c2c5e43992ff7771647762e5407b521f9c5d587","./icon-192.png":"f2c47da104798b7ebe0c4a2ec8f93fa4de2c49bc1223ff11684689c60500a40f","./icon-512.png":"4919666fdf6aba00c8082b3f9c853b9451de9c156c168f8884b5fc1e9a833e38","./index.html":"e77cc9c8e425331c86746dc8a5570798126ef98effe2a11aa8665296556a5eb9","./interaction-shell.css":"e9d5fd75882e3361d966b2cce7edb62d8bde1d1e07e9e002f354deb25cf8b17f","./interaction-shell.js":"1450295d2af67cbd57c627bdc66676c59daf4eb09cca77bedc5b4a4bef0cc742","./manifest.ar.webmanifest":"dd7030c51c63fd8cb71e2c75f208539a584146baef887f938f8c9821deb97d8a","./manifest.en.webmanifest":"3c952ef76ff7cac95ff2f9a81a671e4a04a2fb397a681561fe9d510268ab36db","./manifest.fr.webmanifest":"3f5445b0594ed57d0603ef4575c96c29ecff2ba5a7cf6121bb0088d4e22016c6","./manifest.tr.webmanifest":"3c75132100b7a231afdaea7d929619cb4ddcf3820e14321942bc10496b7b1bdb","./manifest.webmanifest":"dd7030c51c63fd8cb71e2c75f208539a584146baef887f938f8c9821deb97d8a","./notification-badge.png":"9aee874a6441d7fbb5411e636a79aeb93f10311ac21e36a4d7bf2052f0939872","./notification-preferences.css":"c1b55773a85c41ab03930ed1fbbabbc36c8b39faf923fbca7133819f75505829","./notification-preferences.js":"30c64c499b1cbdf1cdf38798d08736b9f2f39ca7928ad5970cd2ddb8aa5b8904","./theme-polish.css":"5ebcf07a40b37fafa908dbbc0bfe57af23918c96b47d4bbadd90a891812f0326","./user-usage.css":"d9995a83470741fa7cb29bc9af62cc95acc420856a2229a15cd5a03f12d2e0c1","./user-usage.js":"438ae3717be758196216a9129105f35f3c6c349637c42490859510ad6cf159fd","./vendors.js":"9e5a9107eb29bea7b83820e852e83784350fb3ef15205c498c33c341a18dfdb3"};
const SHELL_READY_URL=new URL('__verified_shell__',self.registration.scope).href;
const SHELL_HASH_PATTERN=/^[a-f0-9]{64}$/;
function shellURL(file){return new URL(file,self.registration.scope).href;}
async function shellDigest(response){const hash=await crypto.subtle.digest('SHA-256',await response.arrayBuffer());return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');}
function shellManifestValid(){return SHELL_HASH_PATTERN.test(BUILD_ID)&&Object.keys(SHELL_ASSETS).length>0&&Object.prototype.hasOwnProperty.call(SHELL_ASSETS,'./index.html')&&Object.entries(SHELL_ASSETS).every(([file,hash])=>file.startsWith('./')&&file!=='./release.json'&&SHELL_HASH_PATTERN.test(hash));}
async function shellReady(){
 if(!STATIC_ENABLED||!shellManifestValid())return false;
 try{if(!(await caches.keys()).includes(SHELL_CACHE))return false;const cache=await caches.open(SHELL_CACHE),marker=await cache.match(SHELL_READY_URL);if(!marker)return false;const saved=await marker.json();if(saved.buildId!==BUILD_ID||saved.version!==BUILD_VERSION)return false;
 for(const [file,hash] of Object.entries(SHELL_ASSETS)){const hit=await cache.match(shellURL(file));if(!hit||!hit.ok||await shellDigest(hit)!==hash)return false;}return true;
 }catch{return false;}
}
async function installShell(){
 if(!STATIC_ENABLED)return;
 if(!shellManifestValid())throw Error('Release is not finalized: missing verified shell manifest');
 // No cache write is made until every network response belongs to this exact build.
 const responses=await Promise.all(Object.entries(SHELL_ASSETS).map(async([file,hash])=>{const response=await fetch(new Request(shellURL(file),{cache:'no-store',credentials:'same-origin'}));if(!response.ok||await shellDigest(response.clone())!==hash)throw Error('Incomplete or mixed release asset: '+file);return [file,response];}));
 try{const cache=await caches.open(SHELL_CACHE);await cache.delete(SHELL_READY_URL);for(const [file,response] of responses)await cache.put(shellURL(file),response);await cache.put(SHELL_READY_URL,new Response(JSON.stringify({buildId:BUILD_ID,version:BUILD_VERSION}),{headers:{'Content-Type':'application/json'}}));}
 catch(error){await caches.delete(SHELL_CACHE);throw error;}
}
self.addEventListener('install',event=>event.waitUntil(installShell()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 if(STATIC_ENABLED){if(!await shellReady())throw Error('Cannot activate incomplete release');for(const key of await caches.keys())if(key.startsWith(SHELL_CACHE_PREFIX)&&key!==SHELL_CACHE)await caches.delete(key);}await self.clients.claim();
})()));
function replyBuild(event,message){if(typeof event.data?.requestId==='string')message.requestId=event.data.requestId;if(event.ports?.[0])event.ports[0].postMessage(message);else event.source?.postMessage(message);}
self.addEventListener('message',event=>{
 if(!['GET_BUILD_INFO','ACTIVATE'].includes(event.data?.type))return;
 event.waitUntil((async()=>{const ready=await shellReady(),info={buildId:BUILD_ID,version:BUILD_VERSION,ready};if(event.data.type==='GET_BUILD_INFO'){replyBuild(event,{type:'BUILD_INFO',...info});return;}
 // Bare ACTIVATE is retained solely for installed legacy clients. A supplied identity must match.
 const matches=!Object.prototype.hasOwnProperty.call(event.data,'buildId')||event.data.buildId===BUILD_ID,accepted=ready&&matches;
 replyBuild(event,{type:'ACTIVATE_RESULT',...info,accepted,reason:!ready?'not-ready':!matches?'build-mismatch':'accepted'});if(accepted)await self.skipWaiting();
 })());
});
const ADMIN_FILES=["./","./admin-command.css","./admin-command.js","./admin-icon.svg","./app-experience.css","./app-experience.js","./app-locale.js","./app.css","./badge-worker.js","./icon-192.png","./icon-512.png","./index.html","./interaction-shell.css","./interaction-shell.js","./manifest.ar.webmanifest","./manifest.en.webmanifest","./manifest.fr.webmanifest","./manifest.tr.webmanifest","./manifest.webmanifest","./notification-badge.png","./notification-preferences.css","./notification-preferences.js","./theme-polish.css","./user-usage.css","./user-usage.js","./vendors.js"];
const SHELL_CACHE_PREFIX='masarifi-admin-runtime:'+self.registration.scope+':',SHELL_CACHE=SHELL_CACHE_PREFIX+BUILD_ID;
const STATIC_ENABLED=!new URL(self.location.href).pathname.endsWith('/admin/push-sw.js');
const ADMIN_STATIC_ENABLED=STATIC_ENABLED;
self.addEventListener('fetch',event=>{if(!STATIC_ENABLED||event.request.method!=='GET')return;const url=new URL(event.request.url),scope=new URL(self.registration.scope);if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;const relative='./'+url.pathname.slice(scope.pathname.length);
 if(relative==='./release.json'||relative==='./admin.html'||relative.startsWith('./admin/')||/^\.\/(google-drive|docs)\//.test(relative)||/\.(md|pdf|zip|gs)$/i.test(relative))return;
 const asset=relative==='./'?'./index.html':relative;if(!Object.prototype.hasOwnProperty.call(SHELL_ASSETS,asset)&&event.request.mode!=='navigate')return;
 event.respondWith((async()=>{const file=Object.prototype.hasOwnProperty.call(SHELL_ASSETS,asset)?asset:'./index.html',cache=await caches.open(SHELL_CACHE),hit=await cache.match(shellURL(file));if(hit)return hit;
 // An evicted file must never mix this shell with another deployment's bytes.
 try{const response=await fetch(new Request(shellURL(file),{cache:'no-store',credentials:'same-origin'}));if(response.ok&&await shellDigest(response.clone())===SHELL_ASSETS[file]){try{await cache.put(shellURL(file),response.clone());}catch{}return response;}}catch{}
 return new Response('This app release is incomplete. Check for an update and try again.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});})());
});

const PUSH_PREFS='masarifi-admin-push-preferences';
const PUSH_IMAGE_ORIGIN='https://oxsrajzowlxydzgipquy.supabase.co';
let identityEpoch=0,identityQueue=Promise.resolve(),pushQueue=Promise.resolve(),settingsQueue=Promise.resolve();
const identityURL=()=>new URL('__admin_push_identity',self.registration.scope).href;
const validId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
function pushImage(value,expires){try{const u=new URL(value),id='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';if(u.origin!==PUSH_IMAGE_ORIGIN||u.username||u.password||u.hash)return;if(!u.search&&new RegExp('^/storage/v1/object/public/masarifi-announcements/'+id+'[.](jpg|png|webp)$','i').test(u.pathname))return u.href;if(!Number.isFinite(Date.parse(expires))||Date.parse(expires)<=Date.now())return;const token=u.searchParams.get('token');if(u.searchParams.size===1&&token&&token.length<2048&&/^[A-Za-z0-9_.-]+$/.test(token)&&new RegExp('^/storage/v1/object/sign/masarifi-service/'+id+'/'+id+'/'+id+'[.](jpg|png|webp)$','i').test(u.pathname))return u.href;}catch{}}
self.addEventListener('message',event=>{if(event.data?.type!=='PUSH_ACCOUNT')return;const epoch=++identityEpoch;const task=identityQueue.catch(()=>{}).then(async()=>{const cache=await caches.open(PUSH_PREFS);if(epoch!==identityEpoch)return;await self.MasarifiBadge.account(event.data.userId||null);if(epoch!==identityEpoch)return;if(event.data.userId)await cache.put(identityURL(),new Response(String(event.data.userId)));else await cache.delete(identityURL());if(epoch!==identityEpoch)return;for(const notice of await self.registration.getNotifications())if(!event.data.userId||notice.data?.userId&&notice.data.userId!==event.data.userId)notice.close();});identityQueue=task;event.waitUntil(task);});
async function sameRecipient(id,epoch){const cache=await caches.open(PUSH_PREFS),identity=await cache.match(identityURL());return !!identity&&(await identity.text())===id&&epoch===identityEpoch;}
const notificationSettingsURL=()=>new URL('__notification_settings',self.registration.scope).href;
async function notificationSettings(userId){try{const cache=await caches.open(PUSH_PREFS),hit=await cache.match(notificationSettingsURL()),saved=hit?await hit.json():null;return self.MasarifiNotifications.settings(saved?.userId===userId?saved:null);}catch{return self.MasarifiNotifications.settings(null);}}
self.addEventListener('message',event=>{if(event.data?.type!=='NOTIFICATION_SETTINGS')return;const epoch=identityEpoch,d=event.data;const task=settingsQueue.catch(()=>{}).then(async()=>{await identityQueue.catch(()=>{});if(!await sameRecipient(d.userId,epoch))return;const settings=self.MasarifiNotifications.settings(d),cache=await caches.open(PUSH_PREFS);if(!await sameRecipient(d.userId,epoch))return;await cache.put(notificationSettingsURL(),new Response(JSON.stringify({userId:d.userId,...settings})));});settingsQueue=task;event.waitUntil(task);});
self.addEventListener('push',event=>{const task=pushQueue.catch(()=>{}).then(async()=>{
 const epoch=identityEpoch,p=self.MasarifiNotifications.parse(event.data);if(!p||!await sameRecipient(p.user_id,epoch))return;
 await settingsQueue.catch(()=>{});if(!await sameRecipient(p.user_id,epoch))return;const settings=await notificationSettings(p.user_id),prefs=settings.preferences;
 if(!prefs.push||prefs.categories[p.category]?.push===false){await notifyWindows();return;}
 const badgePayload={...p,badge_enabled:p.badge_enabled!==false&&prefs.badge};
 let fresh=true;try{fresh=await self.MasarifiBadge.push(p.user_id,p.id,p.source,()=>sameRecipient(p.user_id,epoch),badgePayload);}catch{}if(!fresh||!await sameRecipient(p.user_id,epoch))return;
 const shown=await showPush(p.title.slice(0,180),{body:p.body.slice(0,2000),image:prefs.images?pushImage(p.image,p.image_expires_at):undefined,tag:'masarifi-admin-'+p.source+'-'+p.id,renotify:false,icon:new URL('icon-192.png',self.registration.scope).href,badge:new URL('notification-badge.png',self.registration.scope).href,data:{id:p.id,userId:p.user_id,source:p.source,expiresAt:p.expires_at},dir:'auto',timestamp:Date.now(),silent:p.silent===true||!prefs.sound||self.MasarifiNotifications.isQuiet(settings.quietHours)||await hasForegroundWindow()});
 if(shown)await self.MasarifiBadge.delivered(p.user_id,p.id,p.source).catch(()=>{});
 if(epoch!==identityEpoch){for(const n of await self.registration.getNotifications())if(n.data?.userId===p.user_id)n.close();}else await notifyWindows();
 });pushQueue=task;event.waitUntil(task);});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const epoch=identityEpoch,data=event.notification.data||{},scope=new URL(self.registration.scope),combined=!!self.location?.href&&new URL(self.location.href).pathname.endsWith('/admin/push-sw.js'),entry=combined?new URL('../admin.html',scope):scope;if(!data.userId||!validId(data.id)||!['campaign','system'].includes(data.source)||!await sameRecipient(data.userId,epoch))return;const message={type:'OPEN_ADMIN_NOTIFICATIONS',id:data.id,source:data.source};const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});if(epoch!==identityEpoch)return;for(const client of clients){const url=new URL(client.url);if(url.origin===scope.origin&&(combined?url.pathname===entry.pathname:url.pathname.startsWith(scope.pathname))){client.postMessage(message);return client.focus();}}const url=new URL(entry.href);url.searchParams.set('notifications','1');url.searchParams.set('notice',data.id);url.searchParams.set('source',data.source);return self.clients.openWindow(url.href);})());});

function isAdminWindow(client){const scope=new URL(self.registration.scope),url=new URL(client.url);return url.origin===scope.origin&&(ADMIN_STATIC_ENABLED?url.pathname.startsWith(scope.pathname):url.pathname===new URL('../admin.html',scope).pathname);}
async function notifyWindows(){for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:!ADMIN_STATIC_ENABLED}))if(isAdminWindow(client))client.postMessage({type:'MASARIFI_PUSH_RECEIVED'});}
async function hasForegroundWindow(){return(await self.clients.matchAll({type:'window',includeUncontrolled:!ADMIN_STATIC_ENABLED})).some(client=>isAdminWindow(client)&&client.visibilityState==='visible');}
async function showPush(title,options){const epoch=identityEpoch,current=async()=>await sameRecipient(options.data?.userId,epoch)&&Date.parse(options.data?.expiresAt)>Date.now();if(!await current())return false;try{await self.registration.showNotification(title,options);}catch(error){if(!options.image)throw error;if(!await current())return false;delete options.image;await self.registration.showNotification(title,options);}return true;}

