/* Masarifi 8 — authorized operations, read-only exports and explicit AI administration. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MasarifiAdminCommand = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const list = value => Array.isArray(value) ? value : [];
  const count = value => value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.floor(Number(value)) : null;
  function csvCell(value) {
    let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    text = text.replace(/\u0000/g, '');
    if (!(typeof value === 'number' && Number.isFinite(value)) && /^[\s\uFEFF]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function csv(headers, rows) { return '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'; }
  function operations(snapshot) {
    if (!snapshot?.ready) return {queue: [], metrics: []};
    const overview = snapshot.overview, dashboard = overview?.dashboard || {}, table = snapshot.table || {}, queue = [], seen = new Set();
    function add(kind, row, label, priority) {
      if (!row || !idPattern.test(row.id || '')) return;
      const key = kind + ':' + row.id;
      if (seen.has(key)) return;
      seen.add(key); queue.push({kind, id: row.id, label: String(label || row.id), at: (kind === 'account' ? row.ends_at : row.created_at || row.updated_at) || row.ends_at || null, priority, userId: row.requester_user_id || row.owner_user_id || row.user_id || null, source: row.source || null});
    }
    list(overview?.pending_requests).forEach(row => add('request', row, row.request_no, 1));
    if (table.tab === 'requests' && table.ready !== false) list(table.rows).filter(row => row.status === 'pending_review').forEach(row => add('request', row, row.request_no, 1));
    list(overview?.unread_threads).forEach(row => add('thread', row, row.subject, 2));
    list(snapshot.notices).filter(row => !row.read_at && !row.opened_at && !row.dismissed_at).forEach(row => add('notice', row, row.title, 3));
    list(overview?.expiring).forEach(row => add('account', {...row, id: row.owner_user_id}, row.plan_id, 4));
    queue.sort((a, b) => a.priority - b.priority || String(a.at || '').localeCompare(String(b.at || '')));
    const metrics = [
      {key: 'pending', value: count(dashboard.pending_requests), scope: 'server'},
      {key: 'threads', value: overview ? list(overview.unread_threads).length : null, scope: 'loaded'},
      {key: 'expiring', value: count(dashboard.expiring_7d), scope: 'server'},
      {key: 'revoked', value: table.tab === 'devices' && table.ready !== false ? list(table.rows).filter(row => row.active === false).length : null, scope: 'page'}
    ];
    return {queue: queue.slice(0, 100), metrics};
  }
  function integer(value, min, max) { const n = Number(value); if (!Number.isSafeInteger(n) || n < min || n > max || String(value).trim() === '') throw Error('invalid_request'); return n; }
  function validateConfig(data) {
    return {enabled: data.enabled === true, project_daily_limit: integer(data.project_daily_limit, 1, 10000), default_daily_limit: integer(data.default_daily_limit, 1, 100), max_output_tokens: integer(data.max_output_tokens, 256, 3000)};
  }
  function validateGrant(data) {
    if (!idPattern.test(data.user_id || '')) throw Error('invalid_request');
    const expires = data.expires_at ? new Date(data.expires_at) : null;
    if (expires && (!Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now())) throw Error('invalid_request');
    return {user_id: data.user_id, enabled: data.enabled === true, daily_limit: integer(data.daily_limit, 1, 100), expires_at: expires ? expires.toISOString() : null};
  }
  const unavailableUntil = new Map();
  async function requestAI(bridge, action, data = {}, fetcher = root.fetch?.bind(root)) {
    if (!['admin_status', 'admin_config', 'admin_grant'].includes(action)) throw Error('invalid_request');
    const pin = await bridge.session();
    if (!bridge.current(pin)) throw Error('session_revoked');
    const connection = bridge.connection(), endpoint = connection.url.replace(/\/$/, '') + '/functions/v1/masarifi-ai';
    if ((unavailableUntil.get(endpoint) || 0) > Date.now()) throw Error('setup_required');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetcher(connection.url.replace(/\/$/, '') + '/functions/v1/masarifi-ai', {method: 'POST', signal: controller.signal, headers: {'Content-Type': 'application/json', apikey: connection.key, Authorization: 'Bearer ' + pin.token}, body: JSON.stringify({action, ...(action === 'admin_status' ? {} : {data})})});
      if (!bridge.current(pin)) throw Error('session_revoked');
      let result; try { result = await response.json(); } catch { result = null; }
      if (!bridge.current(pin)) throw Error('session_revoked');
      if (response.status === 404 || response.status === 410) { unavailableUntil.set(endpoint, Date.now() + 300000); throw Error('setup_required'); }
      if (response.ok) unavailableUntil.delete(endpoint);
      if (!response.ok || !result?.ok) {
        const code = response.status === 401 ? 'auth_required' : result?.code || (response.status === 403 ? 'admin_forbidden' : 'backend_unavailable');
        if (['admin_forbidden', 'auth_required', 'session_revoked'].includes(code)) bridge.revoke(pin, code);
        throw Error(code);
      }
      if (!result.data?.settings || !result.data?.usage || !Array.isArray(result.data?.entitlements)) throw Error('backend_unavailable');
      return result.data;
    } catch (error) { if (error.name === 'AbortError') throw Error('network_timeout'); throw error; }
    finally { clearTimeout(timer); }
  }
  const text = {
    origin_forbidden:['هذا العنوان غير مسموح لخدمة الذكاء الاصطناعي؛ راجع إعدادات الخادم.','This site origin is not allowed by the AI service. Check the server configuration.','Bu site adresine yapay zekâ hizmetinde izin verilmemiş. Sunucu ayarlarını kontrol edin.','Cette origine n’est pas autorisée par le service IA. Vérifiez le serveur.'], unsaved:['توجد تغييرات غير محفوظة. هل تريد تجاهلها؟','There are unsaved changes. Discard them?','Kaydedilmemiş değişiklikler var. Silinsin mi?','Des modifications ne sont pas enregistrées. Les abandonner ?'], operations:['مركز العمليات','Operations center','İşlem merkezi','Centre des opérations'], overview:['المتابعة','Follow-up','Takip','Suivi'], export:['تصدير الجدول','Export table','Tabloyu dışa aktar','Exporter le tableau'], ai:['الذكاء الاصطناعي','AI administration','Yapay zekâ yönetimi','Administration IA'], close:['إغلاق','Close','Kapat','Fermer'], refresh:['تحديث البيانات','Refresh data','Verileri yenile','Actualiser'], search:['بحث سريع عن حساب','Quick account search','Hızlı hesap arama','Recherche rapide de compte'], searchHint:['الاسم أو كود البرنامج أو معرّف الحساب','Name, program code or account ID','Ad, program kodu veya hesap kimliği','Nom, code ou identifiant du compte'], searchButton:['فتح نتائج البحث','Open search results','Sonuçları aç','Ouvrir les résultats'], pending:['طلبات التفعيل','Activation requests','Etkinleştirme talepleri','Demandes d’activation'], threads:['محادثات تحتاج متابعة','Threads awaiting follow-up','Takip bekleyen sohbetler','Conversations à suivre'], expiring:['تنتهي خلال 7 أيام','Expiring in 7 days','7 gün içinde sona eriyor','Expirent dans 7 jours'], revoked:['أجهزة مفصولة','Revoked devices','Bağlantısı kesilen cihazlar','Appareils révoqués'], server:['إجمالي الخادم','Server total','Sunucu toplamı','Total serveur'], loaded:['العناصر المحمّلة','Loaded items','Yüklenen öğeler','Éléments chargés'], page:['هذه الصفحة فقط','This page only','Yalnızca bu sayfa','Cette page uniquement'], unknown:['لم يُحمّل المصدر','Source not loaded','Kaynak yüklenmedi','Source non chargée'], queued:['قائمة المتابعة','Follow-up queue','Takip listesi','File de suivi'], empty:['لا توجد عناصر متابعة في المصادر المحمّلة.','No follow-up items in loaded sources.','Yüklenen kaynaklarda takip öğesi yok.','Aucun élément à suivre dans les sources chargées.'], scope:['تُعرض القراءات المتاحة فقط؛ هذه القائمة ليست حصرًا لكل الحسابات.','Only available readings are shown; this is not an inventory of all accounts.','Yalnızca mevcut ölçümler gösterilir; tüm hesapların envanteri değildir.','Seules les données disponibles sont affichées, pas tous les comptes.'], request:['طلب تفعيل','Activation request','Etkinleştirme talebi','Demande d’activation'], thread:['محادثة خاصة','Private thread','Özel sohbet','Conversation privée'], notice:['إشعار','Notification','Bildirim','Notification'], account:['اشتراك قريب من النهاية','Subscription nearing expiry','Süresi dolmak üzere abonelik','Abonnement bientôt expiré'], online:['اتصال متاح','Network available','Ağ kullanılabilir','Réseau disponible'], offline:['دون اتصال','Offline','Çevrimdışı','Hors ligne'], requests:['طلبات قيد التنفيذ','Requests in flight','Devam eden istekler','Requêtes en cours'], last:['آخر استجابة ناجحة','Last successful response','Son başarılı yanıt','Dernière réponse réussie'], latency:['زمن آخر طلب','Last request latency','Son istek süresi','Latence de la dernière requête'], support:['دعم بموافقة محددة','Support with explicit consent','Açık izinli destek','Assistance avec consentement'], notifications:['فتح الإشعارات','Open notifications','Bildirimleri aç','Ouvrir les notifications'], choose:['تحديد الصف','Select row','Satırı seç','Sélectionner la ligne'], all:['تحديد الصفحة','Select page','Sayfayı seç','Sélectionner la page'], selected:['صفوف مختارة','Selected rows','Seçili satırlar','Lignes sélectionnées'], download:['تنزيل CSV','Download CSV','CSV indir','Télécharger CSV'], exportHint:['يشمل التصدير الصفوف المحمّلة والأعمدة المعروضة فقط. تُحمى الخلايا النصية من صيغ الجداول.','Exports include loaded rows and visible columns only. Text cells are protected from spreadsheet formulas.','Yalnızca yüklenen satırlar ve görünen sütunlar aktarılır. Metin hücreleri formüllere karşı korunur.','L’export comprend uniquement les lignes chargées et colonnes affichées. Les cellules sont protégées contre les formules.'], noTable:['افتح جدول الطلبات أو الأجهزة أو الاشتراكات أولًا، ثم حدد الصفوف المطلوبة.','Open requests, devices or subscriptions first, then select rows.','Önce talepler, cihazlar veya abonelikler tablosunu açın ve satır seçin.','Ouvrez un tableau puis sélectionnez les lignes.'], aiHint:['الحدود والوصول تُفرض في الخادم. لا يُحفظ مفتاح المزوّد في المتصفح.','Limits and access are enforced by the server. Provider keys are never stored in the browser.','Sınırlar ve erişim sunucuda uygulanır. Sağlayıcı anahtarı tarayıcıda saklanmaz.','Les limites et accès sont appliqués au serveur. Les clés ne sont jamais stockées dans le navigateur.'], loading:['جار التحميل…','Loading…','Yükleniyor…','Chargement…'], setup_required:['يلزم نشر وظيفة الذكاء الاصطناعي وتهيئة قاعدة البيانات أولًا.','Deploy the AI function and database setup first.','Önce yapay zekâ işlevini ve veritabanı kurulumunu dağıtın.','Déployez d’abord la fonction IA et la base de données.'], service_not_configured:['خدمة الذكاء الاصطناعي غير مهيأة على الخادم.','AI service is not configured on the server.','Yapay zekâ hizmeti sunucuda yapılandırılmadı.','Le service IA n’est pas configuré au serveur.'], backend_unavailable:['تعذر الوصول إلى الخدمة. أعد المحاولة.','Service unavailable. Try again.','Hizmete erişilemiyor. Yeniden deneyin.','Service indisponible. Réessayez.'], network_timeout:['انتهت مهلة الاتصال؛ تحقق من الحالة قبل إعادة الحفظ.','Connection timed out; check status before saving again.','Bağlantı zaman aşımı; yeniden kaydetmeden durumu kontrol edin.','Délai dépassé : vérifiez l’état avant de réenregistrer.'], invalid_request:['تحقق من المعرّف والتاريخ والحدود الصحيحة.','Check the account ID, date and valid integer limits.','Kimliği, tarihi ve geçerli tam sayı sınırlarını kontrol edin.','Vérifiez l’identifiant, la date et les limites entières.'], session_revoked:['انتهت صلاحية جلسة الإدارة.','Admin session is no longer valid.','Yönetici oturumu artık geçerli değil.','La session administrateur n’est plus valide.'], blocked:['أكمل الإرسال أو أغلق نافذة التعديل أولًا.','Finish sending or close the editor first.','Önce gönderimi bitirin veya düzenleyiciyi kapatın.','Terminez l’envoi ou fermez l’éditeur.'], enabled:['تفعيل خدمة الذكاء الاصطناعي','Enable AI service','Yapay zekâ hizmetini etkinleştir','Activer le service IA'], projectLimit:['حد الطلبات اليومي للمشروع','Project daily request limit','Proje günlük istek sınırı','Limite quotidienne du projet'], userLimit:['الحد اليومي الافتراضي للمستخدم','Default daily user limit','Varsayılan günlük kullanıcı sınırı','Limite utilisateur par défaut'], tokens:['حد رموز الإجابة','Maximum output tokens','Yanıt belirteci sınırı','Limite de jetons de réponse'], save:['مراجعة وحفظ','Review and save','İncele ve kaydet','Vérifier et enregistrer'], review:['مراجعة التغيير','Review change','Değişikliği incele','Vérifier le changement'], confirm:['أؤكد اعتماد هذا التغيير','Confirm this change','Bu değişikliği onaylıyorum','Je confirme cette modification'], saved:['حُفظت الإعدادات على الخادم','Saved on the server','Sunucuya kaydedildi','Enregistré au serveur'], grant:['وصول مستخدم للذكاء الاصطناعي','User AI entitlement','Kullanıcı yapay zekâ erişimi','Accès IA utilisateur'], userId:['معرّف المستخدم','User ID','Kullanıcı kimliği','Identifiant utilisateur'], allow:['السماح بالاستخدام','Allow usage','Kullanıma izin ver','Autoriser l’utilisation'], expires:['تاريخ انتهاء اختياري','Optional expiry date','İsteğe bağlı bitiş tarihi','Expiration facultative'], grantLimit:['حد المستخدم اليومي','User daily limit','Kullanıcı günlük sınırı','Limite quotidienne utilisateur'], entitlements:['أحدث صلاحيات المستخدمين (حتى 100)','Latest user entitlements (up to 100)','Son kullanıcı izinleri (en fazla 100)','Derniers accès utilisateurs (100 maximum)'], model:['النموذج المحدد في الخادم','Server-configured model','Sunucuda ayarlanan model','Modèle défini au serveur'], today:['طلبات اليوم','Requests today','Bugünkü istekler','Requêtes du jour'], remaining:['الطلبات المتبقية للمشروع','Remaining project requests','Kalan proje istekleri','Requêtes restantes du projet'], tokenUsage:['رموز الإدخال والإجابة اليوم','Input and output tokens today','Bugünkü girdi ve çıktı belirteçleri','Jetons d’entrée et sortie du jour'], provider:['إعداد المزوّد','Provider setup','Sağlayıcı kurulumu','Configuration du fournisseur'], yes:['مهيأ','Configured','Yapılandırıldı','Configuré'], no:['غير مهيأ','Not configured','Yapılandırılmadı','Non configuré']
  };
  text.setup_required = ['خدمة المساعد السحابي غير منشورة أو غير متاحة. تبقى بقية أدوات التحكم متاحة. يمكن إعادة التحقق بعد خمس دقائق.','The cloud assistant service is not deployed or unavailable. Other admin tools remain available. Check again in five minutes.','Bulut asistanı hizmeti dağıtılmamış veya kullanılamıyor. Diğer yönetim araçları kullanılabilir. Beş dakika sonra yeniden kontrol edin.','Le service d’assistant cloud n’est pas déployé ou est indisponible. Les autres outils restent disponibles. Vérifiez à nouveau dans cinq minutes.'];
  const locale = () => root.MasarifiAdminLocale?.locale || 'ar';
  const t = key => text[key]?.[{ar:0,en:1,tr:2,fr:3}[locale()] ?? 0] || key;
  const errorText = error => t(Object.prototype.hasOwnProperty.call(text,error?.message)?error.message:'backend_unavailable');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString(locale()) : '—';
  const button = (action, label, extra = '') => `<button type="button" data-command="${action}" ${extra}>${escape(label)}</button>`;
  const metric = (label, value, scope = '') => `<article class="command-metric"><strong>${value === null ? '—' : escape(value)}</strong><span>${escape(label)}</span>${scope ? `<small>${escape(scope)}</small>` : ''}</article>`;
  let bridge, pane, active = 'overview', owner = null, selection = new Set(), tableSignature = '', tableNode = null, aiState = null, aiBusy = false, serial = 0, lastFocus = null, renderTimer = null, reviewing = null, dirty = false;
  function snapshot() { return bridge?.snapshot?.() || {ready:false}; }
  function signature(s) { return JSON.stringify([s.token, s.table?.tab, s.table?.offset, s.table?.columns, list(s.table?.rows).map(row => row.id || row)]); }
  function privateClear() { serial++; owner = null; selection.clear(); tableSignature = ''; tableNode = null; aiState = null; aiBusy = false; reviewing = null; dirty = false; if (pane) { pane.removeAttribute?.('aria-busy'); pane.close(); pane.replaceChildren(); } root.document?.querySelectorAll('[data-command-row],[data-command-all],.command-table-tools').forEach(node => node.closest('.command-check-cell')?.remove() || node.remove()); }
  function ensureOwner() { const s = snapshot(); if (!s.ready) { privateClear(); return null; } if (owner && owner !== s.token) privateClear(); owner = s.token; return s; }
  async function discardDraft() { const pin=owner,revision=serial,review=reviewing,forms=pane?[...pane.querySelectorAll('[data-command-form]')].map(form=>({form,value:root.MasarifiInteraction?.fingerprint?.(form)})):[];if((dirty||reviewing)&&await root.MasarifiInteraction?.confirm?.(t('unsaved'))!==true)return false;if(aiBusy||pin!==owner||revision!==serial||review!==reviewing||!snapshot().ready||forms.some(({form,value})=>form.isConnected===false||value!==root.MasarifiInteraction?.fingerprint?.(form)))return false;dirty=false;reviewing=null;return true; }
  async function close() { if (aiBusy || !await discardDraft()) return; if (pane?.open) pane.close(); lastFocus?.isConnected && lastFocus.focus({preventScroll:true}); }
  function notifyOverlay() { root.document.dispatchEvent(new CustomEvent('masarifi:admin-command-overlay', {detail:{open:!!pane?.open}})); }
  function open(tab = 'overview') {
    const s = ensureOwner(); if (!s) return;
    if (!bridge.canOpen()) { const error=root.document.getElementById('error');if(error)error.textContent=t('blocked');return; }
    if (!pane) {
      pane = root.document.createElement('dialog'); pane.id = 'masarifiAdminOperations'; pane.className = 'command-dialog';
      pane.addEventListener('close', notifyOverlay);
      pane.addEventListener('cancel', event => {event.preventDefault();close();});
      pane.addEventListener('click', onClick); pane.addEventListener('submit', onSubmit);
      const draft=event=>{const kind=event.target.closest('[data-command-form]')?.dataset.commandForm;if(kind==='config'||kind==='grant')dirty=true;};pane.addEventListener('input',draft);pane.addEventListener('change',draft);
      pane.addEventListener('keydown',async event=>{const el=event.target.closest('[data-command=tab]');if(!el||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||aiBusy)return;event.preventDefault();const tabs=[...pane.querySelectorAll('[data-command=tab]')],i=tabs.indexOf(el),step=(event.key==='ArrowRight'?1:-1)*(root.document.documentElement.dir==='rtl'?-1:1),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+step+tabs.length)%tabs.length;if(await discardDraft()){active=tabs[next].dataset.tab;render();pane.querySelector(`[data-tab="${active}"]`)?.focus();if(active==='ai'&&!aiState)fetchStatus();}});
      root.document.body.append(pane);
    }
    active = tab; lastFocus = root.document.activeElement; render(); if (!pane.open) pane.showModal(); notifyOverlay();
    if (active === 'ai' && !aiState) fetchStatus();
  }
  function render(message = '') {
    const s = ensureOwner(); if (!s || !pane) return;
    const drafts=dirty&&!reviewing?[...pane.querySelectorAll('[data-command-form="config"],[data-command-form="grant"]')].map(form=>({kind:form.dataset.commandForm,fields:[...form.elements].filter(input=>input.name).map(input=>({name:input.name,value:input.value,checked:input.checked,focused:input===root.document.activeElement,start:input.selectionStart,end:input.selectionEnd}))})):[];
    const heading = `<header class="command-heading"><div><span>MASARIFI / OPERATIONS</span><h2>${escape(t('operations'))}</h2></div>${button('close',t('close'),aiBusy?'disabled':'')}</header>`;
    const tabs = `<div class="command-tabs" role="tablist" aria-label="${escape(t('operations'))}">${['overview','export','ai'].map(key=>`<button type="button" data-command="tab" data-tab="${key}" role="tab" aria-selected="${key===active}" tabindex="${key===active?0:-1}" aria-controls="command-panel" class="${key===active?'active':''}">${escape(t(key))}</button>`).join('')}</div>`;
    pane.innerHTML = heading + tabs + `<p class="command-error" role="status">${escape(message)}</p><div id="command-panel" class="command-content" role="tabpanel">${active==='overview'?overviewHTML(s):active==='export'?exportHTML(s):reviewing?reviewHTML(reviewing.data):aiHTML()}</div>`;
    for(const form of pane.querySelectorAll('[data-command-form="config"],[data-command-form="grant"]')){const draft=drafts.find(value=>value.kind===form.dataset.commandForm);if(!draft)continue;for(const input of form.elements){const value=draft.fields.find(field=>field.name===input.name);if(!value)continue;input.value=value.value;input.checked=value.checked;if(value.focused){input.focus({preventScroll:true});if(typeof value.start==='number'&&typeof value.end==='number')input.setSelectionRange?.(value.start,value.end);}}}
    if(aiBusy)pane.setAttribute?.('aria-busy','true');else pane.removeAttribute?.('aria-busy');
  }
  function overviewHTML(s) {
    const model = operations(s);
    return `<form class="command-search" data-command-form="search"><label>${escape(t('search'))}<input name="query" type="search" maxlength="120" placeholder="${escape(t('searchHint'))}" required></label><button type="submit">${escape(t('searchButton'))}</button></form><div class="command-metrics">${model.metrics.map(m=>metric(t(m.key),m.value,m.value===null?t('unknown'):t(m.scope))).join('')}</div><p class="hint">${escape(t('scope'))} ${s.overviewAt?escape(t('last'))+': '+escape(date(s.overviewAt)):''}</p><div class="command-tools">${button('navigate',t('refresh'),'data-target="dashboard"')}${button('navigate',t('support'),'data-target="support"')}${button('notifications',t('notifications'))}</div><section class="command-queue"><h3>${escape(t('queued'))}</h3>${model.queue.map(item=>`<button type="button" data-command="queue" data-kind="${item.kind}" data-id="${escape(item.id)}" data-source="${escape(item.source||'')}"><span><small>${escape(t(item.kind))}</small><strong>${escape(typeof item.label==='object'?'':item.label)}</strong></span><time>${escape(date(item.at))}</time></button>`).join('')||`<p class="hint">${escape(t('empty'))}</p>`}</section><dl class="command-diagnostics"><div><dt>${escape(s.online?t('online'):t('offline'))}</dt><dd>${escape(s.connectionError||'')}</dd></div><div><dt>${escape(t('requests'))}</dt><dd>${s.requests||0}</dd></div><div><dt>${escape(t('last'))}</dt><dd>${escape(date(s.updatedAt))}</dd></div><div><dt>${escape(t('latency'))}</dt><dd>${s.latency==null?'—':escape(s.latency)+' ms'}</dd></div></dl>`;
  }
  function exportHTML(s) { return `<p class="hint">${escape(t('exportHint'))}</p>${s.table?.columns?.length?`<p>${escape(t('selected'))}: <strong>${selection.size}</strong> / ${list(s.table.rows).length}</p><div class="command-tools">${button('select-all',t('all'))}${button('download',t('download'),selection.size?'':'disabled')}</div>`:`<p class="hint">${escape(t('noTable'))}</p>`}`; }
  function aiHTML() {
    if (!aiState) return `<p class="hint">${escape(aiBusy?t('loading'):t('aiHint'))}</p>${button('ai-refresh',t('refresh'),aiBusy?'disabled':'')}`;
    const settings=aiState.settings,usage=aiState.usage;
    const disabled=aiBusy?'disabled':'';
    const input=(name,label,value,min,max)=>`<label>${escape(label)}<input name="${name}" type="number" min="${min}" max="${max}" step="1" value="${escape(value)}" required ${disabled}></label>`;
    return `<p class="hint">${escape(t('aiHint'))}</p><div class="command-metrics">${metric(t('today'),count(usage.requests))}${metric(t('remaining'),count(usage.remaining))}${metric(t('tokenUsage'),count(usage.tokens))}</div><p>${escape(t('model'))}: <bdi>${escape(settings.model||'—')}</bdi> · ${escape(t('provider'))}: ${escape(t(settings.provider_configured?'yes':'no'))}</p><form data-command-form="config" class="command-ai-form"><label class="command-checkbox"><input type="checkbox" name="enabled" ${settings.enabled?'checked':''} ${disabled}>${escape(t('enabled'))}</label><div class="command-form-grid">${input('project_daily_limit',t('projectLimit'),settings.project_daily_limit,1,10000)}${input('default_daily_limit',t('userLimit'),settings.default_daily_limit,1,100)}${input('max_output_tokens',t('tokens'),settings.max_output_tokens,256,3000)}</div><button type="submit" ${disabled}>${escape(t('save'))}</button></form><form data-command-form="grant" class="command-ai-form"><h3>${escape(t('grant'))}</h3><label>${escape(t('userId'))}<input name="user_id" type="text" autocomplete="off" spellcheck="false" dir="ltr" required pattern="[0-9a-fA-F-]{36}" maxlength="36" ${disabled}></label><div class="command-form-grid">${input('daily_limit',t('grantLimit'),settings.default_daily_limit,1,100)}<label>${escape(t('expires'))}<input name="expires_at" type="datetime-local" ${disabled}></label></div><label class="command-checkbox"><input name="enabled" type="checkbox" checked ${disabled}>${escape(t('allow'))}</label><button type="submit" ${disabled}>${escape(t('save'))}</button></form><section><h3>${escape(t('entitlements'))}</h3><div class="command-entitlements">${list(aiState.entitlements).map(e=>`<article><bdi>${escape(e.user_id)}</bdi><span>${e.enabled?'✓':'—'} · ${escape(e.daily_limit)} / ${escape(date(e.expires_at))}</span></article>`).join('')||'—'}</div>${button('ai-refresh',t('refresh'),disabled)}</section>`;
  }
  async function fetchStatus() {
    if (aiBusy || !ensureOwner() || !await discardDraft()) return; const pin=owner,request=++serial; aiBusy=true;render();
    try { const result=await requestAI(bridge,'admin_status');if(owner===pin&&serial===request){aiState=result;aiBusy=false;dirty=false;render();} }
    catch(error){if(owner===pin&&serial===request){aiBusy=false;render(errorText(error));}}
    finally{if(owner===pin&&serial===request)aiBusy=false;}
  }
  async function navigate(action) { if(!ensureOwner()||!await discardDraft())return;await close();try{await action();}catch(error){if(snapshot().ready){open();render(errorText(error));}} }
  function rowKey(row,index){return row.id?String(row.id):String(index);}
  function installTable(s) {
    const target=root.document.querySelector('#screen > .table-wrap table,#screen > .panel.table-wrap table'),model=s.table;
    if (!target || !model?.columns?.length || target.tBodies[0]?.rows.length!==list(model.rows).length) {root.document.querySelectorAll('.command-table-tools').forEach(n=>n.remove());return;}
    const next=signature(s);if(tableSignature!==next||tableNode!==target){selection.clear();tableSignature=next;tableNode=target;target.querySelectorAll('.command-check-cell').forEach(n=>n.remove());
      const th=root.document.createElement('th');th.className='command-check-cell';th.innerHTML=`<input type="checkbox" data-command-all aria-label="${escape(t('all'))}">`;target.tHead.rows[0].prepend(th);
      [...target.tBodies[0].rows].forEach((row,i)=>{const cell=root.document.createElement('td');cell.className='command-check-cell';cell.innerHTML=`<input type="checkbox" data-command-row="${escape(rowKey(model.rows[i],i))}" aria-label="${escape(t('choose'))}">`;row.prepend(cell);});
    }
    let tools=target.closest('.table-wrap').querySelector('.command-table-tools');if(!tools){tools=root.document.createElement('div');tools.className='command-table-tools';target.before(tools);}const all=target.querySelector('[data-command-all]');if(all){all.checked=selection.size===model.rows.length&&model.rows.length>0;all.indeterminate=selection.size>0&&selection.size<model.rows.length;}const value=`${t('selected')}: ${selection.size} / ${model.rows.length}`;if(tools.dataset.signature!==value){tools.innerHTML=`<span>${escape(value)}</span>${button('export',t('export'))}`;tools.dataset.signature=value;}
  }
  function download() {
    const s=ensureOwner();if(!s||signature(s)!==tableSignature||!selection.size){selection.clear();render(t('noTable'));return;}
    const model=s.table,chosen=model.rows.filter((row,i)=>selection.has(rowKey(row,i))),headers=model.columns.map(key=>model.labels[key]||key);
    const file=new Blob([csv(headers,chosen.map(row=>model.columns.map(key=>row[key])))],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(file),a=root.document.createElement('a');a.href=url;a.download='Masarifi_'+model.tab+'_'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function onClick(event) {
    const el=event.target.closest('[data-command]');if(!el)return;const action=el.dataset.command;
    if(action==='close'){close();return;}if(!ensureOwner()||aiBusy)return;
    if(action==='tab'){if(!await discardDraft())return;active=el.dataset.tab;render();if(active==='ai'&&!aiState)fetchStatus();}
    else if(action==='export')open('export');else if(action==='download')download();
    else if(action==='select-all'){const s=snapshot();list(s.table?.rows).forEach((row,i)=>selection.add(rowKey(row,i)));root.document.querySelectorAll('[data-command-row],[data-command-all]').forEach(n=>n.checked=true);installTable(s);render();}
    else if(action==='ai-refresh')fetchStatus();else if(action==='navigate')navigate(()=>bridge.navigate(el.dataset.target));
    else if(action==='notifications')navigate(()=>root.MasarifiAdminBridge.openNotifications());
    else if(action==='queue'){const kind=el.dataset.kind,id=el.dataset.id;navigate(()=>bridge.openItem(kind,id,el.dataset.source));}
    else if(action==='review-cancel'){if(await discardDraft())render();}
  }
  function reviewHTML(clean) { return `<form data-command-form="review" class="dialog-form"><div class="dialog-form-scroll"><h3>${escape(t('review'))}</h3><dl class="command-review">${Object.entries(clean).map(([key,value])=>`<div><dt>${escape(({enabled:t('allow'),project_daily_limit:t('projectLimit'),default_daily_limit:t('userLimit'),max_output_tokens:t('tokens'),user_id:t('userId'),daily_limit:t('grantLimit'),expires_at:t('expires')})[key])}</dt><dd><bdi>${escape(value===null?'—':typeof value==='boolean'?value?'✓':'—':value)}</bdi></dd></div>`).join('')}</dl><label class="command-checkbox"><input name="confirmed" type="checkbox" required>${escape(t('confirm'))}</label></div><footer class="dialog-actions"><button type="submit">${escape(t('save'))}</button>${button('review-cancel',t('close'))}</footer></form>`; }
  async function onSubmit(event) {
    const form=event.target.closest('[data-command-form]');if(!form)return;event.preventDefault();if(!ensureOwner()||aiBusy)return;
    const data=new FormData(form),kind=form.dataset.commandForm;
    if(kind==='search'){const query=String(data.get('query')||'').trim();if(query)navigate(()=>bridge.searchDirectory(query));return;}
    if(kind==='review'){
      if(!data.get('confirmed')||!reviewing||reviewing.owner!==owner)return;
      const pending=reviewing;aiBusy=true;pane.setAttribute('aria-busy','true');form.querySelector('[type=submit]').disabled=true;const request=++serial;
      try{const result=await requestAI(bridge,pending.action,pending.data);if(owner===pending.owner&&serial===request){aiState=result;reviewing=null;dirty=false;aiBusy=false;render(t('saved'));}}
      catch(error){if(owner===pending.owner&&serial===request){aiBusy=false;render(errorText(error));}}
      finally{if(owner===pending.owner&&serial===request){aiBusy=false;pane.removeAttribute('aria-busy');}}
      return;
    }
    try {
      const clean=kind==='config'?validateConfig({enabled:!!data.get('enabled'),project_daily_limit:data.get('project_daily_limit'),default_daily_limit:data.get('default_daily_limit'),max_output_tokens:data.get('max_output_tokens')}):validateGrant({user_id:String(data.get('user_id')||'').trim(),enabled:!!data.get('enabled'),daily_limit:data.get('daily_limit'),expires_at:data.get('expires_at')});
      dirty=false;reviewing={owner,action:kind==='config'?'admin_config':'admin_grant',data:clean};
      const content=pane.querySelector('.command-content');content.innerHTML=reviewHTML(clean);
    } catch(error){pane.querySelector('.command-error').textContent=errorText(error);}
  }
  function sync() {
    const s=ensureOwner();if(!s)return;
    const toolbar=root.document.querySelector('#adminRoot .toolbar');if(toolbar&&!toolbar.querySelector('[data-command-open]')){const openButton=root.document.createElement('button');openButton.type='button';openButton.dataset.commandOpen='';openButton.className='command-open-button';openButton.textContent=t('operations');openButton.addEventListener('click',()=>open());toolbar.append(openButton);}
    const openButton=toolbar?.querySelector('[data-command-open]');if(openButton&&openButton.textContent!==t('operations'))openButton.textContent=t('operations');root.document.querySelectorAll('[data-command-row]').forEach(n=>n.setAttribute('aria-label',t('choose')));const all=root.document.querySelector('[data-command-all]');if(all)all.setAttribute('aria-label',t('all'));installTable(s);
  }
  function schedule(){if(renderTimer)return;renderTimer=setTimeout(()=>{renderTimer=null;sync();},60);}
  function init(){bridge=root.MasarifiAdminCommandBridge;if(!bridge)return;root.document.addEventListener('masarifi:admin-command-state',()=>{if(!snapshot().ready)privateClear();else schedule();});root.document.addEventListener('change',event=>{const el=event.target;if(!el.matches('[data-command-row],[data-command-all]')||!ensureOwner())return;const s=snapshot();if(signature(s)!==tableSignature){selection.clear();schedule();return;}if(el.hasAttribute('data-command-all')){selection.clear();if(el.checked)list(s.table.rows).forEach((row,i)=>selection.add(rowKey(row,i)));root.document.querySelectorAll('[data-command-row]').forEach(n=>n.checked=el.checked);}else if(el.checked)selection.add(el.dataset.commandRow);else selection.delete(el.dataset.commandRow);installTable(s);});root.document.addEventListener('click',event=>{if(event.target.closest('.command-table-tools [data-command]'))onClick(event);});root.document.addEventListener('masarifi:locale',()=>{schedule();if(pane?.open&&!aiBusy&&!reviewing)render();});new MutationObserver(schedule).observe(root.document.getElementById('adminRoot'),{childList:true,subtree:true});sync();}
  if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
  return Object.freeze({csv,operations,validateConfig,validateGrant,requestAI,open,hasDraft:()=>!!(dirty||reviewing||aiBusy)});
});
