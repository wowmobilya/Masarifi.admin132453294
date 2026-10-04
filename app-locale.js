/* Masarifi 8.5: phone language, install metadata and safe localized public links. */
(function(root){
'use strict';
if(root.MasarifiLocale)return;
const application='admin',supported=Object.freeze(['ar','tr','en','fr']);
const names={user:{ar:'مصاريفي',tr:'Masarifi — Giderlerim',en:'Masarifi — My Expenses',fr:'Masarifi — Mes dépenses'},admin:{ar:'مصاريفي — الإدارة',tr:'Masarifi — Yönetim',en:'Masarifi — Administration',fr:'Masarifi — Administration'}};
const shortNames={user:{ar:'مصاريفي',tr:'Giderlerim',en:'My Expenses',fr:'Mes dépenses'},admin:{ar:'إدارة مصاريفي',tr:'Masarifi Yönetim',en:'Masarifi Admin',fr:'Masarifi Admin'}};
const shareTexts={user:{ar:'مصاريفي — نظّم مصاريفك وصناديقك وتقاريرك من جهازك.',tr:'Masarifi — giderlerinizi, kasalarınızı ve raporlarınızı cihazınızdan yönetin.',en:'Masarifi — manage your expenses, cashboxes and reports from your device.',fr:'Masarifi — gérez vos dépenses, vos caisses et vos rapports depuis votre appareil.'},admin:{ar:'إدارة مصاريفي — إدارة الحسابات والاشتراكات وخدمة المستخدمين.',tr:'Masarifi Yönetim — hesapları, abonelikleri ve kullanıcı desteğini yönetin.',en:'Masarifi Administration — manage accounts, subscriptions and user support.',fr:'Administration de Masarifi — gérez les comptes, les abonnements et l’assistance.'}};
const preferenceKey=application==='admin'?'masarifi.admin.locale.v1':'masarifi.user.locale.v85';
const manifestDirectory=new URL('./',new URL(root.document.querySelector('link[rel="manifest"]')?.getAttribute('href')||'./manifest.webmanifest',root.location.href));
function normalize(value){const lang=String(value||'').trim().toLowerCase().split(/[-_]/)[0];return supported.includes(lang)?lang:null;}
function phoneLanguage(languages=root.navigator?.languages,language=root.navigator?.language){for(const value of [...(Array.isArray(languages)?languages:[]),language]){const lang=normalize(value);if(lang)return lang;}return'en';}
function readPreference(){try{return normalize(root.localStorage.getItem(preferenceKey));}catch{return null;}}
function writePreference(value){try{root.localStorage.setItem(preferenceKey,value);}catch{}}
function linkLanguage(){try{return normalize(new URL(root.location.href).searchParams.get('lang'));}catch{return null;}}
const initial=readPreference()||linkLanguage()||phoneLanguage();
function meta(name,content){let node=root.document.querySelector(`meta[name="${name}"]`);if(!node){node=root.document.createElement('meta');node.setAttribute('name',name);root.document.head.append(node);}node.setAttribute('content',content);}
function updateMetadata(value){
 const lang=normalize(value)||phoneLanguage(),document=root.document;
 document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.title=names[application][lang];
 const manifest=document.querySelector('link[rel="manifest"]');if(manifest)manifest.setAttribute('href',new URL('manifest.'+lang+'.webmanifest',manifestDirectory).href);
 meta('application-name',names[application][lang]);meta('apple-mobile-web-app-title',shortNames[application][lang]);
 meta('theme-color',document.documentElement.dataset.theme==='dark'?'#101112':'#f3f7f6');
 return lang;
}
function publicURL(value){const lang=normalize(value)||phoneLanguage(),entry=application==='admin'&&/\/admin\.html$/i.test(root.location.pathname)?'./admin.html':'./',url=new URL(entry,root.location.href);if(!['https:','http:'].includes(url.protocol))throw Error('v20AppLinkUnavailable');url.username='';url.password='';url.search='';url.hash='';url.searchParams.set('lang',lang);return url.href;}
function shareData(value){const lang=normalize(value)||phoneLanguage();return{title:names[application][lang],text:shareTexts[application][lang],url:publicURL(lang)};}
function attachUser(app,v6=root.V6){
 if(!app||app.__v85Locale)return;Object.defineProperty(app,'__v85Locale',{value:true});
 // V6 already owns system/manual preference normalization. Keep saved IndexedDB
 // choices authoritative; a URL language seeds only defaults before App.init.
 if(v6)v6.resolveLanguage=phoneLanguage;
 const linked=linkLanguage();if(!app.ready&&linked){app.prefs.languageMode=linked;app.prefs.language=linked;app.prefs.reportLanguage=linked;}
 const applyTheme=app.applyTheme;app.applyTheme=function(){const result=applyTheme.apply(this,arguments);const lang=updateMetadata(this.prefs.language);if(this.ready)writePreference(lang);return result;};
 updateMetadata(app.prefs.language);
}
function attachAdmin(api=root.MasarifiAdminLocale){
 if(!api||api.__v85Locale)return api;
 const chosen=readPreference()||initial;api.setLocale(chosen);
 const wrapped=Object.freeze({...api,__v85Locale:true,setLocale(value){const lang=normalize(value);if(!lang)return false;const changed=api.setLocale(lang);if(changed)updateMetadata(api.locale);return changed;},refresh(){const result=api.refresh();updateMetadata(api.locale);return result;},get locale(){return api.locale;},get direction(){return api.direction;}});
 root.MasarifiAdminLocale=wrapped;updateMetadata(api.locale);return wrapped;
}
if(application==='admin')writePreference(initial);
root.MasarifiLocale=Object.freeze({supported,normalize,phoneLanguage,initial,updateMetadata,publicURL,shareData,attachUser,attachAdmin});
updateMetadata(initial);
root.document.addEventListener('masarifi:locale',()=>updateMetadata(root.MasarifiAdminLocale?.locale||root.App?.prefs?.language||initial));
root.document.addEventListener('masarifi:theme',()=>updateMetadata(root.MasarifiAdminLocale?.locale||root.App?.prefs?.language||initial));
})(window);
