// ==UserScript==
// @name         Nvirya AdGuard
// @license      MIT
// @namespace    https://nvirya.com/adguard
// @version      10.5.2
// @updateURL    https://raw.nvirya.com/adguard/nvirya-adguard.user.js
// @downloadURL  https://raw.nvirya.com/adguard/nvirya-adguard.user.js
// @description  A lightweight, mobile-first userscript designed to block intrusive ads, popups, redirects, and overlays with a native-style UI and custom element picker.
// @author       Nvirya
// @match        *://*/*
// @icon         https://raw.nvirya.com/assets/icon128x128.png
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      raw.nvirya.com
// @connect      raw.nvirya.com
// @connect      discord.com
// @connect      discordapp.com
// @run-at       document-start
// @all-frames   true
// ==/UserScript==
(function () {
'use strict';

const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
const D = W.document;
if (W.__NVIRYA_ADGUARD_X__) return;
try { Object.defineProperty(W, '__NVIRYA_ADGUARD_X__', { value: true }); } catch (e) { W.__NVIRYA_ADGUARD_X__ = true; }
const VERSION = '10.5.2';

function installScriptletDefusers() {
  try {
    const adsQueue = [];
    adsQueue.loaded = true;
    adsQueue.push = function () { return this.length; };
    try {
      Object.defineProperty(W, 'adsbygoogle', {
        configurable: true, enumerable: true,
        get: function () { return adsQueue; },
        set: function (value) {
          if (Array.isArray(value) && value !== adsQueue) {
            try { Array.prototype.push.apply(adsQueue, value); } catch (e) {}
          }
          adsQueue.loaded = true;
        }
      });
    } catch (e) {
      try { W.adsbygoogle = adsQueue; } catch (e2) {}
    }
    try { W.adsbygoogle.loaded = true; W.adsbygoogle.push = function () { return this.length || 0; }; } catch (e) {}

    const makeDefuser = function () {
      const api = function () {};
      api.prototype.setOption = function () { return this; };
      api.prototype.check = function () { return this; };
      api.prototype.clearEvent = function () { return this; };
      api.prototype.emitEvent = function () { return this; };
      api.prototype.on = function () { return this; };
      api.prototype.onDetected = function () { return this; };
      api.prototype.onNotDetected = function () { return this; };
      api.prototype.onDetectedOnce = function () { return this; };
      api.prototype.onNotDetectedOnce = function () { return this; };
      api.prototype.checkOnLoad = function () { return this; };
      api.prototype.isDetected = function () { return false; };
      api.prototype.detected = false;
      api.prototype.blocked = false;
      api.prototype.version = '3.0.0';
      return api;
    };
    ['BlockAdBlock', 'FuckAdBlock', 'FairBlock', 'BabasBml'].forEach(function (name) {
      const stub = makeDefuser();
      try {
        Object.defineProperty(W, name, {
          configurable: true, enumerable: true,
          get: function () { return stub; },
          set: function () {}
        });
      } catch (e) { try { W[name] = stub; } catch (e2) {} }
    });
  } catch (e) {}
}

function cleanTrackingQuery() {
  try {
    const url = new URL(W.location.href);
    const exact = /^(?:fbclid|gclid|dclid|gbraid|wbraid|msclkid|twclid|igshid|yclid|mc_cid|mc_eid|ref_src|ref_url|si|feature|spm|vero_id|oly_anon_id|oly_enc_id|_hsenc|_hsmi|mkt_tok|s_cid|ef_id|cmpid|campaign_id|ad_id)$/i;
    const remove = [];
    url.searchParams.forEach(function (_, key) {
      if (/^utm_/i.test(key) || exact.test(key)) remove.push(key);
    });
    if (remove.length) {
      remove.forEach(function (key) { url.searchParams.delete(key); });
      W.history.replaceState(W.history.state, '', url.pathname + (url.search ? url.search : '') + url.hash);
    }
  } catch (e) {}
}

installScriptletDefusers();
cleanTrackingQuery();
installEventListenerGuard();
installPopupGuard();
installRedirectGuard();
installNetworkGuard();

const CONFIG_VERSION = 5;
const K_CFG      = 'nvirya_x_config';
const K_WL       = 'nvirya_x_whitelist';
const K_SR       = 'nvirya_x_site_rules';
const K_ST       = 'nvirya_x_stats';
const K_SESS     = 'nvirya_x_session';
const K_LAST_REP = 'nvirya_x_last_report';
const UPDATE_URL            = 'https://raw.nvirya.com/adguard/nvirya-adguard.user.js';
const STAY_INSTALL_URL      = 'stay://x-callback-url/install?scriptURL=' + encodeURIComponent(UPDATE_URL);
const K_UPD_LAST            = 'nvirya_x_last_update_check';
const K_UPD_REMOTE          = 'nvirya_x_update_remote';
const K_UPD_SNOOZE          = 'nvirya_x_update_snooze';

const UPDATE_CHECK_INTERVAL = 1 * 60 * 60 * 1000;
const UPDATE_RETRY_AFTER    = 15 * 60 * 1000;
const UPDATE_SNOOZE_MS      = 12 * 60 * 60 * 1000;
const UPDATE_START_DELAY    = 1500;
const UPDATE_TIMEOUT        = 4000;

// Feedback/Bug report Discord webhook 
const WEBHOOK_PAYLOAD       = "==QYnpEV6R0VtJmYDdVVwpmWQdFai9kMyJDcCR3Zyx0RxJ0b0NzRfJTb5s2YmNGMxYEdN9UWFJlZ0lXVzhEVhNzRrRlcT9SNxcjNzgTO5czM2gDN1MzN1UTMvM3av9GaiV2dvkGch9SbvNmLkJ3bjNXak9yL6MHc0RHa";

const DEFAULT_CONFIG = {
  version: CONFIG_VERSION,
  enabled: true,
  popupProtection: true,
  redirectProtection: true,
  cosmeticFiltering: true,
  playerProtection: true,
  antiAdblock: true,
  strictMode: false,
  elementPicker: true,
  showFloatingButton: true,
  edgeHandle: true,
  theme: 'auto',            // 'auto' | 'light' | 'dark'
  debug: false
};

const hasGM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
const memStore = new Map();
const store = {
  get(key, def) {
    try {
      if (hasGM) {
        const v = GM_getValue(key, undefined);
        return v === undefined ? def : v;
      }
      if (memStore.has(key)) return memStore.get(key);
      const raw = W.localStorage.getItem(key);
      return raw == null ? def : JSON.parse(raw);
    } catch (e) { return def; }
  },
  set(key, val) {
    try {
      if (hasGM) { GM_setValue(key, val); return; }
      memStore.set(key, val);
      try { W.localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
    } catch (e) {}
  },
  del(key) {
    try {
      if (hasGM) { GM_setValue(key, undefined); return; }
      memStore.delete(key);
      W.localStorage.removeItem(key);
    } catch (e) {}
  }
};

function getWebhookTarget() {
  try {
    if (!WEBHOOK_PAYLOAD) return '';
    const b64 = WEBHOOK_PAYLOAD.split('').reverse().join('');
    const decoded = atob(b64);
    return decoded.startsWith('http') ? decoded : '';
  } catch (e) {
    return '';
  }
}


function loadConfig() {
  let cfg = store.get(K_CFG, null);
  if (!cfg || typeof cfg !== 'object') cfg = Object.assign({}, DEFAULT_CONFIG);
  if (cfg.version !== CONFIG_VERSION) {
    cfg = Object.assign({}, DEFAULT_CONFIG, cfg, { version: CONFIG_VERSION });
  } else {
    cfg = Object.assign({}, DEFAULT_CONFIG, cfg);
  }
  if (cfg.showFloatingButton === undefined) {
    cfg.showFloatingButton = cfg.edgeHandle !== undefined ? cfg.edgeHandle : true;
  }
  cfg.edgeHandle = cfg.showFloatingButton;
  return cfg;
}
function saveConfig() { store.set(K_CFG, config); }

let config = loadConfig();

const hostname = (location.hostname || '').toLowerCase().replace(/\.$/, '');
const state = {
  whitelist: store.get(K_WL, []) || [],
  siteRules: store.get(K_SR, {}) || {},
  sessionDisabled: store.get(K_SESS, {}) || {},
  tempAllowPopupHosts: new Set(),
  manualBlocks: new Map(),
  hiddenNodes: new WeakSet(),
  removedNodes: [],
  pickerActive: false,
  initialized: false
};

function persistWhitelist() { store.set(K_WL, state.whitelist.slice()); }
function persistSiteRules() { store.set(K_SR, state.siteRules); }
function persistSession() { store.set(K_SESS, state.sessionDisabled); }

function hostMatches(host, pattern) {
  if (!host || !pattern) return false;
  const h = host.toLowerCase().replace(/\.$/, '');
  const p = String(pattern).toLowerCase().replace(/\.$/, '');
  if (!p) return false;
  return h === p || h.endsWith('.' + p);
}
function isWhitelisted(h) {
  if (!h) return false;
  for (const w of state.whitelist) if (hostMatches(h, w)) return true;
  return false;
}
function addWhitelist(h) {
  if (!h) return;
  const l = h.toLowerCase();
  if (state.whitelist.includes(l)) return;
  state.whitelist.push(l);
  persistWhitelist();
}
function removeWhitelist(h) {
  const l = String(h || '').toLowerCase();
  state.whitelist = state.whitelist.filter(x => x.toLowerCase() !== l);
  persistWhitelist();
}

function isDisabledHere() {
  if (!config.enabled) return true;
  if (state.sessionDisabled[hostname]) return true;
  if (isWhitelisted(hostname)) return true;
  return false;
}

const RE_AD_HOST =
/(?:^|\.)(?:doubleclick|googlesyndication|googleadservices|adservice\.google|adsystem\.amazon|adnxs|appnexus|adsrvr|rubiconproject|pubmatic|openx|criteo|casalemedia|smartadserver|yieldmo|yieldone|360yield|adhese|sharethrough|teads|bidswitch|onetag|zedo|mgid|taboola|outbrain|revcontent|adcash|clickadu|popads|popcash|propellerads|adsterra|ad-maven|admaven|exoclick|juicyads|trafficjunky|onclickmax|hppymel|wingsmob|macly|viirhpfa|werefilledwit|adnium|zorvec|hilltopads|clickaine|admicro|adflex|adpia|adtrue|adpushup|ecomobi|innity|komoona|popin|zucks|geniee|vclick|vietad|yeah1ads|adnow|monetag|go2cloud|bkcdn|magsrv|tsyndicate|brazzersnetwork|indexexchange|triplelift|spotx|spotxchange|tremor|telaria|conversant|eqads|gumgum|sovrn|lijit|districtm|fyber|smaato|mopub|inmobi|vungle|applovin|chartboost|unityads|adcolony|vidible|springserve|freewheel|stickyads|adrecover|33across|emxdgt|flashtalking|groundtruth|krux|bluekai|lotame|eyeota|exelator|liveramp|thetradedesk|quantcast|quantserve|scorecardresearch|imrworldwide|moatads|doubleverify|adsafeprotected|serving-sys|atdmt|media\.net|ads\.twitter|ads-twitter|an\.facebook|ads\.tiktok|adx|adsota|masoffer|accesstrade|cloudfront|googletagmanager\.com)(?:\.|$)/i;

const RE_GAMBLING_HOST =
/(?:^|\.)(?:yo88|hitclub|gemwin|zowin|rikvip|sunwin|debet|3bet|five88|sin88|ball88|sv88|bom88|win79|k8cc|j88|fun88|w88|m88|188bet|fb88|ee88|hi88|go88|nohu|bet88|v9bet|kubet|ku11|ku9|jun88|8xbet|new88|789bet|789club|b52|iwin|man88|hbet|f8bet|bk8|vwin|11bet|12bet|138bet|letou|vn88|dafabet|sbobet|cmd368|bong88|123b|mibet|one88|oxbet|red88|sm66|mmwin|78win|win55|fabet|lucky88|vx88|tt88|qq88|kimsa|loto188|shbet|mb66|gk88|okvip|rr88|79king|bj88|king88|69vn|betvisa|thabet|ta88|zbet|mu9|sodo66|qh88|onbet|vz99|k8vina|i9bet|viva88)(?:\.|$)/i;

const RE_AD_PATH =
/(?:^|\/)(?:ads?|adserver|adservice|advert|adunit|adframe|popunder|popads|banner[-_]?ads?|ad[-_]?(?:slot|unit|frame|box|banner|container|zone|loader|delivery|wrapper|rotate)|vast|vpaid|prebid|revive|openx|adclient|adtag|nativeads?|interstitial[-_]?ad|sponsored[-_]?post|adclick|aff[-_]?click|clickserv(?:er)?)(?:\/|\.|$)/i;

const RE_AD_TOKEN =
/(?:^|[^a-z0-9])(?:ads?|advert|advertis(?:e|ing|ement)|sponsor(?:ed)?[-_](?:ad|box|slot|block|content|unit)|banner[-_]?ads?|ad[-_]?banner|popunder|popup[-_]ad|sticky[-_]ad|interstitial[-_]ad|ad[-_](?:box|slot|unit|zone|block|wrap|holder|container|banner|area|space|placeholder|overlay|loader|placement|wrapper)|adsbygoogle|taboola[-_]|outbrain[-_]|mgid[-_]|carbonads|dfp[-_]?ad)(?=[^a-z0-9]|$)/i;

const RE_SIZING =
/\b(?:728x90|300x250|320x50|468x60|160x600|300x600|970x250|970x90|336x280|320x100|250x250|120x600|240x400|180x150|125x125|980x120|980x90|960x90|950x90|1200x628|1080x1920|300x1050|320x480|480x320|768x1024|1024x768|580x400|300x50|728x250|768x90)\b/i;

const RE_TRACKER =
/(?:^|\.)(?:google-analytics|googletagservices|hotjar|mixpanel|segment\.io|amplitude|fullstory|mouseflow|clarity\.ms|heap-analytics|pendo|smartlook|logrocket|statcounter|histats|chartbeat|parsely|luckyorange|glassbox|adjust\.com|appsflyer|branch\.io|app\.link|mc\.yandex|contentsquare|optimizely|kissmetrics)(?:\.|$)/i;

const RE_ANTIADB =
/(?:^|[^a-z])(?:adblock|adblocker|adblock[-_]?(?:detect|warning|modal|notice|killer|check|popup|screen|wall|overlay|msg|disable|guard)|blockadblock|fuckadblock|antiadblock|ad[-_]?shield|fairblock|babasbml|detect[-_]?adblock|ads[-_]?blocker|please[-_]?disable[-_]?adblock|turn[-_]?off[-_]?adblock)(?:[^a-z]|$)/i;

const RE_TRACKING_QUERY =
/(?:[?&](?:utm_(?:source|medium|campaign|term|content)|click_?id|clk_?id|aff(?:iliate)?(?:_id|_sub)?|camp(?:aign)?_?id|ref_?id|track(?:ing)?_?id|ad_?id|banner_?id|zone_?id|gclid|fbclid|dclid|msclkid|mc_cid|mc_eid|spm|ref_src|gbraid|wbraid|si|trk|trac_?id|sub_?id|s2s_?id)=)/i;

const TRUSTED_POPUP_HOSTS = [
  'accounts.google.com', 'login.microsoftonline.com', 'login.live.com',
  'appleid.apple.com', 'id.apple.com', 'facebook.com', 'twitter.com',
  'x.com', 'linkedin.com', 'github.com', 'gitlab.com', 'discord.com',
  'slack.com', 'id.atlassian.com', 'okta.com', 'auth0.com', 'onelogin.com',
  'duosecurity.com', 'id.zalo.me', 'oauth.telegram.org',
  'paypal.com', 'stripe.com', 'checkout.stripe.com', 'amazon.com', 'pay.google.com', 
  'shopify.com', 'checkout.razorpay.com', 'vnpay.vn', 'momo.vn', 'zalopay.vn', 'onepay.vn', 'payos.vn', 't.me'
];

function isTrustedPopupHost(host) {
  if (!host) return false;
  const h = host.toLowerCase().replace(/\.$/, '');
  for (const t of TRUSTED_POPUP_HOSTS) if (hostMatches(h, t)) return true;
  return false;
}

const LOG_LEVELS = { DEBUG: 0, INFO: 1, BLOCK: 2, WARN: 3, ERROR: 4 };
const logRing = [];
function log(level, type, msg, extra) {
  const entry = { t: Date.now(), level, type, msg, extra, host: hostname };
  logRing.push(entry);
  if (logRing.length > 200) logRing.shift();
  if (config.debug || level >= LOG_LEVELS.WARN) {
    try {
      const tag = '[Nvirya ' + level + ']';
      if (level === 'ERROR') console.error(tag, type, msg, extra || '');
      else if (level === 'WARN') console.warn(tag, type, msg, extra || '');
      else console.log(tag, type, msg, extra || '');
    } catch (e) {}
  }
}

let statsSaveTimeout = null;

const stats = {
  session: { ads: 0, popups: 0, redirects: 0, hidden: 0, removed: 0, requests: 0 },
  lifetime: { ads: 0, popups: 0, redirects: 0, hidden: 0, removed: 0, requests: 0 },

  get ads() { return this.session.ads; },
  set ads(v) { const d = v - this.session.ads; this.session.ads = v; this.lifetime.ads += d; this.scheduleSave(); },
  get popups() { return this.session.popups; },
  set popups(v) { const d = v - this.session.popups; this.session.popups = v; this.lifetime.popups += d; this.scheduleSave(); },
  get redirects() { return this.session.redirects; },
  set redirects(v) { const d = v - this.session.redirects; this.session.redirects = v; this.lifetime.redirects += d; this.scheduleSave(); },
  get hidden() { return this.session.hidden; },
  set hidden(v) { const d = v - this.session.hidden; this.session.hidden = v; this.lifetime.hidden += d; this.scheduleSave(); },
  get removed() { return this.session.removed; },
  set removed(v) { const d = v - this.session.removed; this.session.removed = v; this.lifetime.removed += d; this.scheduleSave(); },
  get requests() { return this.session.requests; },
  set requests(v) { const d = v - this.session.requests; this.session.requests = v; this.lifetime.requests += d; this.scheduleSave(); },

  load() {
    const s = store.get(K_ST, null) || {};
    this.lifetime.ads = (s.ads | 0);
    this.lifetime.popups = (s.popups | 0);
    this.lifetime.redirects = (s.redirects | 0);
    this.lifetime.hidden = (s.hidden | 0);
    this.lifetime.removed = (s.removed | 0);
    this.lifetime.requests = (s.requests | 0);
  },

  saveImmediate() {
    if (statsSaveTimeout) {
      clearTimeout(statsSaveTimeout);
      statsSaveTimeout = null;
    }
    store.set(K_ST, {
      ads: this.lifetime.ads,
      popups: this.lifetime.popups,
      redirects: this.lifetime.redirects,
      hidden: this.lifetime.hidden,
      removed: this.lifetime.removed,
      requests: this.lifetime.requests
    });
  },

  scheduleSave() {
    if (statsSaveTimeout) return;
    statsSaveTimeout = setTimeout(() => {
      statsSaveTimeout = null;
      this.saveImmediate();
    }, 100);
  },

  inc(key, delta = 1) {
    if (this.session[key] !== undefined) this.session[key] += delta;
    if (this.lifetime[key] !== undefined) this.lifetime[key] += delta;
    this.scheduleSave();
    if (typeof UI !== 'undefined' && UI.isMenuOpen && UI.isMenuOpen()) {
      UI.renderStats();
    }
  },

  save() { this.saveImmediate(); },

  reset() {
    this.session = { ads: 0, popups: 0, redirects: 0, hidden: 0, removed: 0, requests: 0 };
    this.lifetime = { ads: 0, popups: 0, redirects: 0, hidden: 0, removed: 0, requests: 0 };
    this.saveImmediate();
  }
};
stats.load();

try {
  const syncFlush = () => { stats.saveImmediate(); };
  W.addEventListener('pagehide', syncFlush, { capture: true });
  W.addEventListener('beforeunload', syncFlush);
  D.addEventListener('visibilitychange', () => {
    if (D.visibilityState === 'hidden') syncFlush();
  });
} catch (e) {}

function safeUrl(input) {
  if (!input) return null;
  try {
    if (input instanceof URL) return input;
    if (typeof input !== 'string') return null;
    const s = input.trim();
    if (!s) return null;
    return new URL(s, location.href);
  } catch (e) { return null; }
}

const MULTI_LABEL_PUBLIC_SUFFIXES = new Set([
  'ac.uk','co.uk','gov.uk','ltd.uk','me.uk','net.uk','org.uk','plc.uk',
  'com.au','net.au','org.au','edu.au','gov.au','asn.au','id.au',
  'co.nz','net.nz','org.nz','govt.nz','ac.nz',
  'co.jp','ne.jp','or.jp','ac.jp','go.jp',
  'co.kr','or.kr','ne.kr','go.kr','ac.kr',
  'com.br','net.br','org.br','gov.br','edu.br',
  'com.cn','net.cn','org.cn','gov.cn','edu.cn',
  'com.sg','net.sg','org.sg','gov.sg','edu.sg',
  'com.my','net.my','org.my','gov.my','edu.my',
  'com.ph','net.ph','org.ph','gov.ph','edu.ph',
  'com.vn','net.vn','org.vn','gov.vn','edu.vn','ac.vn',
  'co.in','firm.in','net.in','org.in','gen.in','ind.in',
  'com.tr','net.tr','org.tr','gov.tr','edu.tr',
  'com.tw','net.tw','org.tw','gov.tw','edu.tw',
  'co.id','web.id','or.id','ac.id','go.id',
  'co.th','in.th','or.th','ac.th','go.th',
  'com.hk','net.hk','org.hk','gov.hk','edu.hk',
  'com.pk','net.pk','org.pk','gov.pk','edu.pk',
  'com.bd','net.bd','org.bd','gov.bd','edu.bd'
]);
function rootDomain(host) {
  const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!h || h === 'localhost' || h.indexOf(':') !== -1 || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(h)) return h;
  const parts = h.split('.').filter(Boolean);
  if (parts.length <= 2) return h;
  const suffix2 = parts.slice(-2).join('.');
  return MULTI_LABEL_PUBLIC_SUFFIXES.has(suffix2) ? parts.slice(-3).join('.') : suffix2;
}
function sameRootDomain(a, b) {
  const ra = rootDomain(a), rb = rootDomain(b);
  return !!ra && !!rb && ra === rb;
}
function isAllowedPopupDestination(url) {
  if (!url) return false;
  if (url.protocol === 'blob:' && url.origin === location.origin) return true;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return isTrustedPopupHost(url.hostname) || sameRootDomain(url.hostname, hostname);
}

function isAdUrl(u) {
  if (!u) return false;
  const h = u.hostname.toLowerCase();
  const p = u.pathname.toLowerCase();
  if (RE_GAMBLING_HOST.test(h)) return true;
  if (RE_AD_HOST.test(h)) return true;
  if (RE_AD_PATH.test(p)) return true;
  return false;
}

const PLAYER_TAGS = new Set(['video','audio','source','track']);
const PLAYER_CLASS_RE = /(?:^|[-_\s])(?:jwplayer|jw[-_]?video|jw[-_]?wrapper|video[-_]?js|vjs[-_]|plyr|plyr__|artplayer|dplayer|videojs|media[-_]?player|video[-_]?player|shaka[-_]?video|hls[-_]?player|dashjs|flowplayer|clappr|afterglow|mediaelement)(?:[-_\s]|$)/i;
const PLAYER_ID_RE = /^(?:player|video[-_]?player|movie[-_]?player|main[-_]?player|media[-_]?player|jwplayer|vjs_container|artplayer)$/i;
const PLAYER_CONTROL_RE = /(?:^|[-_\s])(?:play|pause|fullscreen|full[-_]?screen|volume|mute|seek|progress|control|vjs-control|jw-icon|plyr__control)(?:[-_\s]|$)/i;

function isProtectedPlayer(el) {
  if (!config.playerProtection) return false;
  let cur = el, depth = 0;
  while (cur && cur.nodeType === 1 && depth < 6) {
    const tag = cur.tagName ? cur.tagName.toLowerCase() : '';
    if (tag === 'source' && cur.parentElement && cur.parentElement.tagName.toLowerCase() === 'picture') {
      return false;
    }
    if (PLAYER_TAGS.has(tag)) return true;
    const id = cur.id || '';
    const cls = typeof cur.className === 'string' ? cur.className : (cur.getAttribute ? (cur.getAttribute('class') || '') : '');
    if (id && PLAYER_ID_RE.test(id)) return true;
    if (cls && PLAYER_CLASS_RE.test(cls)) return true;
    if (tag && /-(?:player|video)$/.test(tag)) return true;
    cur = cur.parentElement;
    depth++;
  }
  return false;
}

function isActualPlayerControlPath(path) {
  let inPlayer = false;
  for (const node of path) {
    if (!node || node.nodeType !== 1) continue;
    if (isProtectedPlayer(node)) inPlayer = true;
    const tag = (node.tagName || '').toLowerCase();
    const cls = classString(node);
    const label = attr(node, 'aria-label') || attr(node, 'title') || '';
    if (inPlayer && (tag === 'video' || tag === 'audio')) return true;
    if (inPlayer && (PLAYER_CONTROL_RE.test(cls) || /(?:play|pause|fullscreen|full screen|volume|mute)/i.test(label))) return true;
  }
  return false;
}

function recordBlocked(kind, source, detail) {
  if (kind === 'popup') stats.inc('popups');
  else stats.inc('redirects');
  log('BLOCK', kind, source, detail || '');
}

function makeDummyWindow() {
  const dummyLocation = {};
  try {
    Object.defineProperty(dummyLocation, 'href', {
      configurable: false, enumerable: true,
      get: () => 'about:blank',
      set: () => {}
    });
  } catch (e) {}
  dummyLocation.assign = function () {};
  dummyLocation.replace = function () {};
  return {
    closed: true,
    opener: null,
    location: dummyLocation,
    close: function () {},
    focus: function () {},
    blur: function () {},
    postMessage: function () {}
  };
}

function popupBlock(source, detail) {
  recordBlocked('popup', source, detail);
  return makeDummyWindow();
}

function installEventListenerGuard() {
  try {
    const origAEL = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (/^(?:click|mousedown|mouseup|pointerdown|pointerup|touchstart|touchend)$/i.test(type)) {
        try {
          const stack = new Error().stack || '';
          if (RE_AD_HOST.test(stack) || /wingsmob|cloudfront/i.test(stack)) {
            log('BLOCK', 'event-trap', 'Blocked ad click-listener:', type);
            return;
          }
        } catch (err) {}
      }
      return origAEL.apply(this, arguments);
    };
  } catch (e) {}
}

function installPopupGuard() {
  const origOpen = W.open;
  if (typeof origOpen !== 'function') return;
  if (origOpen.__nvirya) return;

  const guarded = function (url, name, features) {
    try {
      if (!config.popupProtection || isDisabledHere()) return origOpen.apply(this, arguments);
      const rawStr = url == null ? '' : String(url).trim();
      if (!rawStr || /^about:blank(?:[#?].*)?$/i.test(rawStr))
        return popupBlock('empty-or-blank-url', rawStr || '(empty)');
      const u = safeUrl(rawStr);
      if (!u) return popupBlock('unparseable-url', rawStr);
      if (isAdUrl(u)) return popupBlock('ad-url', u.href);
      if (!isAllowedPopupDestination(u)) return popupBlock('untrusted-cross-site', u.href);
      return origOpen.apply(this, arguments);
    } catch (e) {
      log('ERROR','popup', e && e.message);
      recordBlocked('popup', 'guard-error', e && e.message);
      return makeDummyWindow();
    }
  };
  try { Object.defineProperty(guarded, '__nvirya', { value: true }); } catch (e) {}
	try {
	  Object.defineProperty(W, 'open', {
 	   configurable: true,
 	   writable: true,
 	   value: guarded
	  });
	  if (W.Window && W.Window.prototype) {
 	   Object.defineProperty(W.Window.prototype, 'open', {
   	   configurable: true,
  	   writable: true,
   	   value: guarded
      });
    }
  } catch (e) {
    try { W.open = guarded; } catch (err) {}
  }
}

function shouldBlockRedirectUrl(u) {
  if (!u) return false;
  if (isAdUrl(u)) return true;
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  return !isTrustedPopupHost(u.hostname) && !sameRootDomain(u.hostname, hostname);
}

function isUntrustedCrossSiteUrl(u) {
  if (!u) return false;
  if (u.protocol === 'blob:') return u.origin !== location.origin;
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  return !isTrustedPopupHost(u.hostname) && !sameRootDomain(u.hostname, hostname);
}

function targetOpensNewContext(anchor) {
  const target = (attr(anchor, 'target') || '').trim().toLowerCase();
  return !!target && target !== '_self' && target !== '_parent' && target !== '_top';
}

function eventPath(e) {
  try { if (e.composedPath) return e.composedPath(); } catch (err) {}
  const path = [];
  let node = e.target;
  while (node) { path.push(node); node = node.parentNode || node.host || null; }
  return path;
}

function isExtensionUiPath(path) {
  return path.some(node => node && node.nodeType === 1
    && (attr(node, 'data-nvirya-ui') !== null || attr(node, 'data-nvirya-picker') !== null));
}

function findAnchorInPath(path) {
  for (const node of path) {
    if (node && node.nodeType === 1 && String(node.tagName).toLowerCase() === 'a') return node;
  }
  return null;
}

function isSuspiciousPlayerOverlayClick(target, path) {
  if (!target || target.nodeType !== 1 || isActualPlayerControlPath(path)) return false;
  if (path.some(node => node && node.nodeType === 1 && isProtectedPlayer(node))) return true;

  const tag = String(target.tagName || '').toLowerCase();
  if (tag !== 'a' && tag !== 'div' && tag !== 'section' && tag !== 'iframe') return false;
  let style, rect;
  try { style = W.getComputedStyle(target); rect = target.getBoundingClientRect(); } catch (e) { return false; }
  if (!style || (style.position !== 'fixed' && style.position !== 'absolute')) return false;
  const z = parseInt(style.zIndex, 10);
  if (!isFinite(z) || z < 10) return false;

  let videos = [];
  try { videos = D.querySelectorAll('video,audio'); } catch (e) {}
  const limit = Math.min(videos.length, 8);
  for (let i = 0; i < limit; i++) {
    const media = videos[i];
    if (!isProtectedPlayer(media)) continue;
    const r = media.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const iw = Math.max(0, Math.min(rect.right, r.right) - Math.max(rect.left, r.left));
    const ih = Math.max(0, Math.min(rect.bottom, r.bottom) - Math.max(rect.top, r.top));
    if (iw >= r.width * 0.65 && ih >= r.height * 0.65) return true;
  }
  return false;
}

function blockNavigationEvent(e, kind, source, url) {
  try {
    if (e.cancelable === false) return false;
    e.preventDefault();
    if (e.defaultPrevented === false) return false;
  } catch (err) { return false; }
  try { e.stopPropagation(); e.stopImmediatePropagation(); } catch (err) {}
  recordBlocked(kind, source, url);
  return true;
}

function installAnchorClickHook() {
  try {
    const proto = W.HTMLAnchorElement && W.HTMLAnchorElement.prototype;
    if (!proto || proto.__nvirya_click) return;
    const originalClick = proto.click;
    if (typeof originalClick !== 'function') return;
    const guardedClick = function () {
      try {
        if (config.redirectProtection && !isDisabledHere()) {
          const u = safeUrl(this.href || attr(this, 'href'));
          if (u && (isAdUrl(u) || shouldBlockRedirectUrl(u))) {
            const kind = targetOpensNewContext(this) ? 'popup' : 'redirect';
            recordBlocked(kind, 'anchor.click()', u.href);
            return;
          }
        }
      } catch (e) { log('ERROR','anchor-click', e && e.message); }
      return originalClick.apply(this, arguments);
    };
    try { Object.defineProperty(guardedClick, '__nvirya', { value: true }); } catch (e) {}
    proto.click = guardedClick;
    try { Object.defineProperty(proto, '__nvirya_click', { value: true }); } catch (e) {}
  } catch (e) { log('WARN','anchor-click','HTMLAnchorElement.click hook unavailable', e && e.message); }
}

function installScriptElementGuard() {
  try {
    const origCreateElement = D.createElement;
    D.createElement = function(tagName, options) {
      const el = origCreateElement.apply(this, arguments);
      if (typeof tagName === 'string' && tagName.toLowerCase() === 'script') {
        const origSetAttribute = el.setAttribute;
        let srcDescriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
        if (srcDescriptor && srcDescriptor.set) {
          const origSrcSet = srcDescriptor.set;
          Object.defineProperty(el, 'src', {
            configurable: true,
            set: function(val) {
              const u = safeUrl(val);
              if (u && (isAdUrl(u) || isBlacklistedScriptHost(u.hostname))) {
                log('BLOCK', 'script-src', 'Blocked dynamic script:', u.href);
                stats.inc('requests');
                return;
              }
              return origSrcSet.call(this, val);
            },
            get: srcDescriptor.get
          });
        }
      }
      return el;
    };
  } catch (e) {
    log('WARN', 'guard', 'Cannot hook createElement for script', e && e.message);
  }
}

function isBlacklistedScriptHost(host) {
  if (!host) return false;
  return /(?:^|\.)(?:googletagmanager\.com|wingsmob\.com|cloudfront\.net)(?:\.|$)/i.test(host);
}

function installIframePopupGuard() {
  try {
    const origAppend = Node.prototype.appendChild;
    Node.prototype.appendChild = function(child) {
      const res = origAppend.apply(this, arguments);
      try {
        if (child && child.nodeType === 1 && String(child.tagName).toLowerCase() === 'iframe') {
          if (child.contentWindow && child.contentWindow.open) {
            child.contentWindow.open = W.open;
          }
        }
      } catch (err) {}
      return res;
    };
  } catch (e) {}
}

function defuseGoogleTagManager() {
  try {
    Object.defineProperty(W, 'google_tag_manager', {
      configurable: false,
      enumerable: true,
      get: () => new Proxy({}, {
        get: () => () => {}
      }),
      set: () => {}
    });
  } catch (e) {}
}

function installRedirectGuard() {
  installAnchorClickHook();

  try {
    D.addEventListener('click', function (e) {
      if (!config.redirectProtection || isDisabledHere()) return;
      const path = eventPath(e);
      if (isExtensionUiPath(path)) return;
      const anchor = findAnchorInPath(path);
      if (!anchor) return;
      const u = safeUrl(anchor.href || attr(anchor, 'href'));
      if (!u) return;
      const adLink = isAdUrl(u);
      const crossRoot = isUntrustedCrossSiteUrl(u);
      const opensNew = targetOpensNewContext(anchor);
      const syntheticExternal = e.isTrusted === false && crossRoot;
      const blockedNewContext = opensNew && !isAllowedPopupDestination(u);
      const hijack = crossRoot && isSuspiciousPlayerOverlayClick(e.target, path);
      if (adLink || blockedNewContext || syntheticExternal || hijack) {
        const kind = opensNew ? 'popup' : 'redirect';
        const reason = adLink ? 'ad-anchor-click'
          : blockedNewContext ? 'untrusted-target-blank'
          : syntheticExternal ? 'synthetic-cross-site-click'
          : 'player-overlay-cross-site-click';
        blockNavigationEvent(e, kind, reason, u.href);
      }
    }, true);
  } catch (e) { log('WARN','redirect','capture click hook unavailable', e && e.message); }

  try {
    const LocProto = W.Location && W.Location.prototype;
    if (LocProto) {
      const hrefDesc = Object.getOwnPropertyDescriptor(LocProto, 'href');
      if (hrefDesc && hrefDesc.configurable && typeof hrefDesc.set === 'function') {
        const originalSet = hrefDesc.set;
        try {
          Object.defineProperty(LocProto, 'href', {
            configurable: true, enumerable: hrefDesc.enumerable,
            get: hrefDesc.get,
            set: function (value) {
              try {
                const base = this.href || location.href;
                const u = new URL(String(value), base);
                if (config.redirectProtection && !isDisabledHere() && shouldBlockRedirectUrl(u)) {
                  recordBlocked('redirect', 'location.href', u.href);
                  return;
                }
              } catch (e) { log('ERROR','redirect','href parse', e && e.message); }
              return originalSet.call(this, value);
            }
          });
        } catch (e) { log('WARN','redirect','Location.href setter is not patchable'); }
      }

      ['assign','replace'].forEach(prop => {
        const desc = Object.getOwnPropertyDescriptor(LocProto, prop);
        if (desc && !desc.configurable) return;
        const orig = LocProto[prop];
        if (typeof orig !== 'function') return;
        try {
          Object.defineProperty(LocProto, prop, {
            configurable: true, writable: true, enumerable: desc ? desc.enumerable : false,
            value: function (value) {
              try {
                const base = this.href || location.href;
                const u = new URL(String(value), base);
                if (config.redirectProtection && !isDisabledHere() && shouldBlockRedirectUrl(u)) {
                  recordBlocked('redirect', 'location.' + prop, u.href);
                  return;
                }
              } catch (e) { log('ERROR','redirect', prop + ' parse', e && e.message); }
              return orig.apply(this, arguments);
            }
          });
        } catch (e) { log('WARN','redirect','Location.' + prop + ' is not patchable'); }
      });
    }
  } catch (e) { log('WARN','redirect','Location prototype unavailable', e && e.message); }

  try {
    const winLoc = Object.getOwnPropertyDescriptor(W, 'location');
    if (winLoc && winLoc.configurable && typeof winLoc.set === 'function') {
      const originalWindowLocationSet = winLoc.set;
      Object.defineProperty(W, 'location', {
        configurable: true, enumerable: winLoc.enumerable,
        get: winLoc.get,
        set: function (value) {
          try {
            const u = new URL(String(value), location.href);
            if (config.redirectProtection && !isDisabledHere() && shouldBlockRedirectUrl(u)) {
              recordBlocked('redirect', 'window.location', u.href);
              return;
            }
          } catch (e) {}
          return originalWindowLocationSet.call(this, value);
        }
      });
    }
  } catch (e) { log('WARN','redirect','window.location descriptor unavailable'); }
}

function installNetworkGuard() {
  try {
    if (typeof W.fetch === 'function' && !W.fetch.__nvirya) {
      const origFetch = W.fetch;
      const patched = function (input, init) {
        try {
          if (config.enabled && !isDisabledHere()) {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            const u = safeUrl(url);
            if (u && isAdUrl(u) && config.strictMode) {
              stats.inc('requests');
              log('BLOCK','network','fetch', u.href);
              return Promise.reject(new TypeError('Blocked by nvirya AdGuard X'));
            }
          }
        } catch (e) { log('ERROR','fetch', e && e.message); }
        return origFetch.apply(this, arguments);
      };
      try { Object.defineProperty(patched, '__nvirya', { value: true }); } catch (e) {}
      W.fetch = patched;
    }
  } catch (e) {}

  try {
    const XHR = W.XMLHttpRequest;
    if (XHR && XHR.prototype && !XHR.prototype.__nvirya_open) {
      const origOpen = XHR.prototype.open;
      XHR.prototype.open = function (method, url) {
        try {
          if (config.enabled && !isDisabledHere() && config.strictMode) {
            const u = safeUrl(url);
            if (u && isAdUrl(u)) {
              stats.inc('requests');
              log('BLOCK','network','xhr', u.href);
              this.__nvirya_blocked = true;
            }
          }
        } catch (e) { log('ERROR','xhr', e && e.message); }
        if (this.__nvirya_blocked) return;
        return origOpen.apply(this, arguments);
      };
      try { Object.defineProperty(XHR.prototype, '__nvirya_open', { value: true }); } catch (e) {}
      const origSend = XHR.prototype.send;
      XHR.prototype.send = function () {
        if (this.__nvirya_blocked) return;
        return origSend.apply(this, arguments);
      };
    }
  } catch (e) {}

  try {
    if (typeof W.navigator.sendBeacon === 'function' && !W.navigator.sendBeacon.__nvirya) {
      const orig = W.navigator.sendBeacon;
      const patched = function (url, data) {
        try {
          if (config.enabled && !isDisabledHere() && config.strictMode) {
            const u = safeUrl(url);
            if (u && isAdUrl(u)) { stats.inc('requests'); log('BLOCK','beacon', u.href); return false; }
          }
        } catch (e) {}
        return orig.apply(this, arguments);
      };
      try { Object.defineProperty(patched, '__nvirya', { value: true }); } catch (e) {}
      try { W.navigator.sendBeacon = patched; } catch (e) {}
    }
  } catch (e) {}
}

const CANDIDATE_TAGS = new Set([
  'img','iframe','a','div','section','dialog','aside','ins','embed','object','script','span',
  'picture','source','figure'
]);
const NEVER_REMOVE_TAGS = new Set([
  'html','head','body','main','video','audio','form','input','button','nav','header','footer','script'
]);
const CLOSE_TOKEN_RE = /(?:^|[-_\s])(?:close|dismiss|btn[-_]?close|modal[-_]?close|popup[-_]?close|ad[-_]?close|dialog[-_]?close)(?:[-_\s]|$)/i;
const CLOSE_ICON_TEXT_RE = /^(?:[\u00D7\u2715\u2716xX\u2297]|close)$/i;

function attr(el, name) {
  try { return el.getAttribute ? el.getAttribute(name) : null; } catch (e) { return null; }
}
function classString(el) {
  const c = el.className;
  if (typeof c === 'string') return c;
  if (c && typeof c.baseVal === 'string') return c.baseVal;
  return attr(el, 'class') || '';
}

function extractSrcsetUrls(srcset) {
  if (!srcset || typeof srcset !== 'string') return [];
  const urls = [];
  const regex = /(?:^|,)\s*(data:[^,\s]+,[^\s]+|[^\s,]+)(?:\s+[^,]+)?/gi;
  let match;
  while ((match = regex.exec(srcset)) !== null) {
    const u = match[1].trim();
    if (u) urls.push(u);
  }
  return urls;
}

function isMatchingAdBannerSize(el) {
  if (!el || el.nodeType !== 1) return false;
  const idc = ((el.id || '') + ' ' + classString(el)).trim();
  const styleAttr = attr(el, 'style') || '';
  if (RE_SIZING.test(idc) || RE_SIZING.test(styleAttr)) return true;

  if (/aspect-ratio\s*:\s*(?:300\/250|728\/90|320\/50|300\/100|320\/100|160\/600|300\/600|970\/250|970\/90|336\/280|468\/60|1\/1)/i.test(styleAttr)) {
    return true;
  }

  let w = parseInt(attr(el, 'width'), 10);
  let h = parseInt(attr(el, 'height'), 10);
  if (isNaN(w) || isNaN(h)) {
    try {
      const r = el.getBoundingClientRect();
      w = Math.round(r.width);
      h = Math.round(r.height);
    } catch (e) { return false; }
  }
  if (!w || !h) return false;

  return (
    (Math.abs(w - 300) <= 15 && Math.abs(h - 250) <= 15) ||
    (Math.abs(w - 728) <= 20 && Math.abs(h - 90) <= 15) ||
    (Math.abs(w - 320) <= 15 && Math.abs(h - 50) <= 12) ||
    (Math.abs(w - 300) <= 15 && Math.abs(h - 100) <= 15) ||
    (Math.abs(w - 320) <= 15 && Math.abs(h - 100) <= 15) ||
    (Math.abs(w - 160) <= 15 && Math.abs(h - 600) <= 25) ||
    (Math.abs(w - 300) <= 15 && Math.abs(h - 600) <= 25) ||
    (Math.abs(w - 970) <= 25 && Math.abs(h - 250) <= 20) ||
    (Math.abs(w - 970) <= 25 && Math.abs(h - 90) <= 15) ||
    (Math.abs(w - 336) <= 15 && Math.abs(h - 280) <= 15) ||
    (Math.abs(w - 468) <= 20 && Math.abs(h - 60) <= 15) ||
    (Math.abs(w - 250) <= 15 && Math.abs(h - 250) <= 15)
  );
}

function isResponsiveAdContainer(el) {
  if (!el || el.nodeType !== 1) return false;
  if (isProtectedPlayer(el) || hasProtectedCleanupContent(el)) return false;
  if (!isMatchingAdBannerSize(el)) return false;

  const links = el.tagName.toLowerCase() === 'a' ? [el] : (el.querySelectorAll ? el.querySelectorAll('a[href]') : []);
  if (!links.length) return false;

  let hasAdOrTrackingLink = false;
  for (let i = 0; i < Math.min(links.length, 3); i++) {
    const a = links[i];
    const u = safeUrl(a.href || attr(a, 'href'));
    if (!u) continue;
    if (isAdUrl(u)) { hasAdOrTrackingLink = true; break; }
    if (isUntrustedCrossSiteUrl(u) && RE_TRACKING_QUERY.test(u.search)) { hasAdOrTrackingLink = true; break; }
    const aIdc = ((a.id || '') + ' ' + classString(a)).trim();
    if (isUntrustedCrossSiteUrl(u) && RE_AD_TOKEN.test(aIdc)) { hasAdOrTrackingLink = true; break; }
  }
  if (!hasAdOrTrackingLink) return false;
  if (meaningfulText(el).length > 40) return false;
  return true;
}

function inspectNode(el) {
  if (!el || el.nodeType !== 1) return { action: 'ignore' };
  const tag = (el.tagName || '').toLowerCase();
  if (NEVER_REMOVE_TAGS.has(tag)) return { action: 'ignore' };
  if (isProtectedPlayer(el)) return { action: 'ignore' };

  // <picture>
  if (tag === 'picture') {
    let hasAd = false;
    const childMedia = el.querySelectorAll ? el.querySelectorAll('source, img') : [];
    for (let i = 0; i < childMedia.length; i++) {
      const cm = childMedia[i];
      const src = attr(cm, 'src') || attr(cm, 'data-src') || '';
      if (src) {
        const u = safeUrl(src);
        if (u && isAdUrl(u)) { hasAd = true; break; }
      }
      const srcset = attr(cm, 'srcset') || attr(cm, 'data-srcset') || '';
      if (srcset) {
        const urls = extractSrcsetUrls(srcset);
        for (let k = 0; k < urls.length; k++) {
          const u = safeUrl(urls[k]);
          if (u && isAdUrl(u)) { hasAd = true; break; }
        }
        if (hasAd) break;
      }
    }
    if (hasAd) return { action: 'remove', reason: 'ad-picture-srcset' };
  }

  // Handle <source> tag inside <picture>
  if (tag === 'source') {
    const p = el.parentElement;
    if (p && p.tagName && p.tagName.toLowerCase() === 'picture') {
      const srcset = attr(el, 'srcset') || attr(el, 'data-srcset') || '';
      const src = attr(el, 'src') || '';
      let hasAd = false;
      if (src) {
        const u = safeUrl(src);
        if (u && isAdUrl(u)) hasAd = true;
      }
      if (!hasAd && srcset) {
        const urls = extractSrcsetUrls(srcset);
        for (let k = 0; k < urls.length; k++) {
          const u = safeUrl(urls[k]);
          if (u && isAdUrl(u)) { hasAd = true; break; }
        }
      }
      if (hasAd) {
        applyAction(p, 'remove', 'ad-picture-srcset');
        return { action: 'ignore' };
      }
    }
    return { action: 'ignore' };
  }

  const idc = ((el.id || '') + ' ' + classString(el)).trim();
  const src = attr(el,'src') || attr(el,'data-src') || attr(el,'data-original') || attr(el,'data-lazy-src') || '';
  const href = attr(el,'href') || '';
  const style = attr(el,'style') || '';

  if (src) {
    const u = safeUrl(src);
    if (u && isAdUrl(u)) return { action: 'remove', reason: 'ad-url' };
  }
  if (href) {
    const u = safeUrl(href);
    if (u && isAdUrl(u)) return { action: 'remove', reason: 'ad-href' };
  }
  if (tag === 'iframe') {
    const sb = attr(el,'sandbox') || '';
    const hasEscape = /allow-popups-to-escape-sandbox|allow-top-navigation(?:-to-custom-protocols)?/i.test(sb);
    const hasSameOrigin = /allow-same-origin/i.test(sb);
    if (hasEscape && !hasSameOrigin) return { action: 'remove', reason: 'sandbox-escape' };
  }

  // Scan srcset on the <img> tag and filter Base64/Data-URI images with link tracking
  if (tag === 'img') {
    const srcset = attr(el, 'srcset') || attr(el, 'data-srcset') || '';
    if (srcset) {
      const urls = extractSrcsetUrls(srcset);
      for (let k = 0; k < urls.length; k++) {
        const u = safeUrl(urls[k]);
        if (u && isAdUrl(u)) {
          const p = el.parentElement;
          if (p && p.tagName && p.tagName.toLowerCase() === 'picture') {
            applyAction(p, 'remove', 'ad-picture-srcset');
            return { action: 'ignore' };
          }
          return { action: 'remove', reason: 'ad-srcset-url' };
        }
      }
    }

    if (src && src.startsWith('data:image/')) {
      let anchor = el.parentElement;
      let depth = 0;
      while (anchor && anchor.nodeType === 1 && depth < 3) {
        if (anchor.tagName && anchor.tagName.toLowerCase() === 'a') break;
        anchor = anchor.parentElement;
        depth++;
      }
      if (anchor && anchor.tagName && anchor.tagName.toLowerCase() === 'a') {
        const aHref = anchor.href || attr(anchor, 'href') || '';
        const u = safeUrl(aHref);
        if (u) {
          const adLink = isAdUrl(u);
          const crossTracking = isUntrustedCrossSiteUrl(u) && RE_TRACKING_QUERY.test(u.search);
          const aIdc = ((anchor.id || '') + ' ' + classString(anchor)).trim();
          if (adLink || crossTracking || (isUntrustedCrossSiteUrl(u) && RE_AD_TOKEN.test(aIdc))) {
            applyAction(anchor, 'remove', 'data-uri-ad-anchor');
            return { action: 'ignore' };
          }
        }
      }
    }
  }

  if ((tag === 'div' || tag === 'section' || tag === 'aside' || tag === 'figure' || tag === 'a' || tag === 'ins') && isResponsiveAdContainer(el)) {
    return { action: 'remove', reason: 'responsive-ad-container' };
  }

  let signals = 0;
  let reason = '';
  if (idc && RE_AD_TOKEN.test(idc)) { signals++; reason = reason || 'ad-token'; }
  if (RE_SIZING.test(src) || RE_SIZING.test(idc) || RE_SIZING.test(style)) { signals++; reason = reason || 'ad-sizing'; }

  if (tag === 'img') {
    const w = el.naturalWidth || el.width || 0;
    const h = el.naturalHeight || el.height || 0;
    if (w === 1 && h === 1) { signals++; reason = reason || 'tracking-pixel'; }
  }

  if (signals >= 2) return { action: 'remove', reason };
  if (signals === 1 && !config.strictMode && tag === 'iframe') return { action: 'hide', reason };
  if (signals >= 1 && config.strictMode) return { action: 'hide', reason };
  return { action: 'ignore' };
}

function isSuspiciousOverlay(el) {
  return isInvisibleTrap(el);
}

function hasNviryaAncestor(el) {
  let cur = el, depth = 0;
  while (cur && cur.nodeType === 1 && depth < 12) {
    if (attr(cur, 'data-nvirya-ui') !== null || attr(cur, 'data-nvirya-picker') !== null) return true;
    cur = cur.parentElement;
    depth++;
  }
  return false;
}

function isNviryaNode(el) {
  if (hasNviryaAncestor(el)) return true;
  try {
    return !!(el && el.querySelector && el.querySelector('[data-nvirya-ui],[data-nvirya-picker]'));
  } catch (e) { return false; }
}

const trapQueue = [];
const trapQueued = new WeakSet();
let trapObserver = null;
let trapFlushScheduled = false;
let scrollBaseline = new WeakMap();
let scrollOverrideStyles = new WeakMap();
let scrollUnlockTimers = [];

function isProtectedTrapSurface(el) {
  if (!el || el.nodeType !== 1 || hasNviryaAncestor(el)) return true;
  const safeTags = /^(?:nav|header|footer|main|dialog|video|audio|iframe|canvas|svg|form|input|select|textarea|button)$/i;
  let cur = el, depth = 0;
  while (cur && cur.nodeType === 1 && depth++ < 10) {
    const tag = String(cur.tagName || '');
    if ((cur === el || !/^(?:html|body)$/i.test(tag)) && safeTags.test(tag)) return true;
    if (attr(cur, 'data-nvirya-safe') !== null || attr(cur, 'data-nvirya-ui') !== null
      || attr(cur, 'data-nvirya-picker') !== null || attr(cur, 'aria-modal') === 'true') return true;
    const role = (attr(cur, 'role') || '').toLowerCase();
    if (/^(?:dialog|alertdialog|menu|menubar|navigation|button|link|listbox|combobox|search)$/.test(role)) return true;
    const mark = ((cur.id || '') + ' ' + classString(cur)).toLowerCase();
    if (/(?:^|[\s_-])(?:navbar|navigation|nav-menu|drawer|sidebar|menu|modal|dialog|cookie-consent|login|signin|auth)(?:$|[\s_-])/.test(mark)) return true;
    cur = cur.parentElement;
  }
  return false;
}

function isInvisibleTrap(el) {
  if (!el || el.nodeType !== 1 || !el.isConnected || isProtectedTrapSurface(el)) return false;
  let style, rect;
  try {
    style = W.getComputedStyle(el);
    if (!style || (style.position !== 'fixed' && style.position !== 'absolute')) return false;
    const z = parseInt(style.zIndex, 10);
    if (!isFinite(z) || z < 10000) return false;
    const opacity = parseFloat(style.opacity);
    const image = String(style.backgroundImage || 'none').trim().toLowerCase();
    if (image && image !== 'none') return false;
    const bg = String(style.backgroundColor || '').replace(/\s+/g, '').toLowerCase();
    const transparentBg = bg === 'transparent' || /^rgba\(\d{1,3},\d{1,3},\d{1,3},0(?:\.0+)?\)$/.test(bg);
    if (!(isFinite(opacity) && opacity <= 0.08) && !transparentBg) return false;
    rect = el.getBoundingClientRect();
  } catch (e) { return false; }
  const vw = W.innerWidth || D.documentElement.clientWidth || 0;
  const vh = W.innerHeight || D.documentElement.clientHeight || 0;
  if (!vw || !vh || !rect || rect.width <= 0 || rect.height <= 0) return false;
  const width = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0));
  const height = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
  if (width * height < vw * vh * 0.8) return false;
  if (isNviryaNode(el) || isProtectedPlayer(el)) return false;
  try {
    if (el.querySelector('input,form,video,audio,iframe,canvas,button,a[href],select,textarea,[contenteditable="true"],[role="button"],[role="menu"],[role="dialog"],[aria-modal="true"]')) return false;
  } catch (e) {}
  return meaningfulText(el).length < 5;
}

function captureScrollBaseline(el) {
  if (!el || el.nodeType !== 1 || scrollBaseline.has(el)) return;
  const props = ['overflow', 'overflow-x', 'overflow-y', 'position', 'top', 'right', 'bottom', 'left', 'width', 'margin-right', 'touch-action'];
  const snapshot = { computed: {}, inline: {}, priority: {} };
  try {
    const computed = W.getComputedStyle(el);
    for (const prop of props) {
      const camel = prop.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
      snapshot.computed[prop] = computed ? computed[camel] || computed.getPropertyValue(prop) : '';
      snapshot.inline[prop] = el.style.getPropertyValue(prop);
      snapshot.priority[prop] = el.style.getPropertyPriority(prop);
    }
    scrollBaseline.set(el, snapshot);
  } catch (e) {}
}

function hasVisibleLegitimateModal() {
  try {
    const nodes = D.querySelectorAll('dialog[open],[role="dialog"],[role="alertdialog"],[aria-modal="true"],[role="menu"],[role="navigation"]');
    for (let i = 0; i < Math.min(nodes.length, 40); i++) {
      const el = nodes[i];
      if (el.hasAttribute('data-nvirya-hidden') || isNviryaNode(el)) continue;
      const style = W.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (!style || style.display === 'none' || style.visibility === 'hidden'
        || parseFloat(style.opacity) === 0 || rect.width < 2 || rect.height < 2) continue;
      if (meaningfulText(el).length >= 5 || el.querySelector('input,form,button,a[href],video,audio')) {
        releasePageScrollOverrides();
        return true;
      }
    }
  } catch (e) {}
  return false;
}

function rememberScrollOverride(el, prop) {
  let saved = scrollOverrideStyles.get(el);
  if (!saved) { saved = {}; scrollOverrideStyles.set(el, saved); }
  if (!Object.prototype.hasOwnProperty.call(saved, prop)) {
    saved[prop] = { value: el.style.getPropertyValue(prop), priority: el.style.getPropertyPriority(prop) };
  }
}

function releasePageScrollOverrides() {
  for (const el of [D.documentElement, D.body]) {
    const saved = el && scrollOverrideStyles.get(el);
    if (!saved) continue;
    for (const prop of Object.keys(saved)) {
      try {
        if (saved[prop].value) el.style.setProperty(prop, saved[prop].value, saved[prop].priority);
        else el.style.removeProperty(prop);
      } catch (e) {}
    }
    scrollOverrideStyles.delete(el);
  }
}

function unlockPageScroll() {
  if (hasVisibleLegitimateModal()) return false;
  const roots = [D.documentElement, D.body];
  let changed = false;
  const overflowProps = ['overflow', 'overflow-x', 'overflow-y'];
  for (const el of roots) {
    if (!el) continue;
    captureScrollBaseline(el);
    const base = scrollBaseline.get(el);
    if (!base) continue;
    let cs;
    try { cs = W.getComputedStyle(el); } catch (e) { continue; }
    if (!cs) continue;
    for (const prop of overflowProps) {
      const camel = prop.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
      const current = String(cs[camel] || cs.getPropertyValue(prop) || '').toLowerCase();
      const original = String(base.computed[prop] || '').toLowerCase();
      if ((current === 'hidden' || current === 'clip') && original !== 'hidden' && original !== 'clip') {
        const value = base.inline[prop] || base.computed[prop] || 'visible';
        rememberScrollOverride(el, prop);
        try { el.style.setProperty(prop, value, base.priority[prop] || 'important'); changed = true; } catch (e) {}
      }
    }
    const position = String(cs.position || '').toLowerCase();
    if (position === 'fixed' && String(base.computed.position || '').toLowerCase() !== 'fixed') {
      try {
        rememberScrollOverride(el, 'position');
        el.style.setProperty('position', base.inline.position || base.computed.position || 'static', base.priority.position || 'important');
        ['top', 'right', 'bottom', 'left', 'width', 'margin-right'].forEach(function (prop) {
          rememberScrollOverride(el, prop);
          const val = base.inline[prop] || base.computed[prop];
          if (val) el.style.setProperty(prop, val, base.priority[prop] || 'important');
          else el.style.removeProperty(prop);
        });
        changed = true;
      } catch (e) {}
    }
  }
  if (changed) log('INFO', 'scroll', 'restored page scrolling after overlay cleanup');
  return changed;
}

function scheduleUnlockPageScroll() {
  if (scrollUnlockTimers.length) return;
  [0, 120, 420, 900].forEach(function (delay) {
    scrollUnlockTimers.push(setTimeout(function () {
      unlockPageScroll();
      if (delay === 900) scrollUnlockTimers = [];
    }, delay));
  });
}

function queueTrapNode(node, includeDescendants) {
  if (!node || node.nodeType !== 1 || hasNviryaAncestor(node)
    || attr(node, 'data-nvirya-ui') !== null || attr(node, 'data-nvirya-picker') !== null) return;
  const push = function (el) {
    if (!el || el.nodeType !== 1 || trapQueued.has(el)) return;
    if (trapQueue.length >= 1400) {
      const dropped = trapQueue.shift();
      if (dropped) trapQueued.delete(dropped);
    }
    trapQueued.add(el);
    trapQueue.push(el);
  };
  push(node);
  if (includeDescendants && node.querySelectorAll) {
    try {
      const descendants = node.querySelectorAll('*');
      for (let i = 0; i < Math.min(descendants.length, 80); i++) push(descendants[i]);
    } catch (e) {}
  }
  scheduleTrapFlush();
}

function scheduleTrapFlush() {
  if (trapFlushScheduled) return;
  trapFlushScheduled = true;
  const run = function () {
    trapFlushScheduled = false;
    const limit = Math.min(60, trapQueue.length);
    for (let i = 0; i < limit; i++) {
      const el = trapQueue.shift();
      if (!el) continue;
      trapQueued.delete(el);
      
      if (!isDisabledHere() && isInvisibleTrap(el)) {
        try {
          if (!el.hasAttribute('data-nvirya-disarmed')) {
            el.setAttribute('data-nvirya-disarmed', 'true');
            el.style.setProperty('pointer-events', 'none', 'important');
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('width', '0px', 'important');
            el.style.setProperty('height', '0px', 'important');
            el.style.setProperty('opacity', '0', 'important');
            el.style.setProperty('z-index', '-999999', 'important');
            state.hiddenNodes.add(el);
            stats.inc('hidden');
            log('BLOCK', 'dom', 'Disarmed invisible click-trap in-place');
          }
        } catch (e) {}
      }
    }
    if (trapQueue.length) scheduleTrapFlush();
  };
  if (typeof W.requestAnimationFrame === 'function') W.requestAnimationFrame(run);
  else setTimeout(run, 16);
}

function startInvisibleTrapObserver() {
  if (trapObserver) return;
  const target = D.documentElement || D;
  try {
    trapObserver = new MutationObserver(function (mutations) {
      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              if (/^(?:html|body)$/i.test(String(node.tagName))) captureScrollBaseline(node);
              queueTrapNode(node, true);
            }
          }
        } else if (mutation.type === 'attributes') {
          queueTrapNode(mutation.target, false);
        } else if (mutation.type === 'characterData') {
          queueTrapNode(mutation.target.parentElement, false);
        }
      }
    });
    trapObserver.observe(target, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['style', 'class', 'id', 'role', 'aria-modal', 'aria-label', 'hidden', 'data-state'],
      characterData: true
    });
    if (D.documentElement) {
      captureScrollBaseline(D.documentElement);
      queueTrapNode(D.documentElement, true);
      const all = D.documentElement.querySelectorAll ? D.documentElement.querySelectorAll('*') : [];
      let index = 0;
      const scanBatch = function () {
        const end = Math.min(index + 80, all.length);
        for (; index < end; index++) queueTrapNode(all[index], false);
        if (index < all.length) setTimeout(scanBatch, 20);
      };
      scanBatch();
    }
    if (D.body) captureScrollBaseline(D.body);
  } catch (e) { trapObserver = null; }
}

function isCloseControl(el) {
  if (!el || el.nodeType !== 1 || hasNviryaAncestor(el)) return false;
  const idc = ((el.id || '') + ' ' + classString(el)).trim();
  if (idc && CLOSE_TOKEN_RE.test(idc)) return true;
  const label = (attr(el, 'aria-label') || attr(el, 'title') || '').trim();
  if (/^(?:close|dismiss)(?:\b|[\s_-])/i.test(label)) return true;
  if (el.children && el.children.length > 1) return false;
  const text = String(el.textContent || '').trim();
  return !!text && text.length <= 8 && CLOSE_ICON_TEXT_RE.test(text);
}

function meaningfulText(root, excludedNode) {
  if (!root) return '';
  const stack = [root];
  let out = '', visited = 0;
  while (stack.length && visited < 500 && out.length < 500) {
    const node = stack.pop();
    if (!node || node === excludedNode) continue;
    visited++;
    if (node.nodeType === 3) {
      out += ' ' + (node.nodeValue || '');
      continue;
    }
    if (node.nodeType !== 1 || isCloseControl(node)) continue;
    const tag = String(node.tagName || '').toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript') continue;
    const children = node.childNodes || [];
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
  }
  return out.replace(/\s+/g, ' ').trim();
}

function hasFormControls(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = String(el.tagName || '').toLowerCase();
  if (/^(?:form|input|select|textarea)$/.test(tag) || attr(el, 'contenteditable') === 'true') return true;
  try { return !!el.querySelector('form,input,select,textarea,[contenteditable="true"]'); }
  catch (e) { return false; }
}

function hasProtectedPlayerContent(el) {
  if (!el || el.nodeType !== 1) return false;
  if (isProtectedPlayer(el)) return true;
  let media = [];
  try { media = el.querySelectorAll('video,audio'); } catch (e) {}
  const limit = Math.min(media.length, 12);
  for (let i = 0; i < limit; i++) if (isProtectedPlayer(media[i])) return true;
  return false;
}

function hasProtectedCleanupContent(el) {
  if (!el || isNviryaNode(el) || hasFormControls(el) || hasProtectedPlayerContent(el)) return true;
  return meaningfulText(el).length >= 50;
}

function containsCloseControl(el) {
  if (!el) return false;
  if (isCloseControl(el)) return true;
  let nodes = [];
  try {
    nodes = el.querySelectorAll('[class*="close" i],[id*="close" i],[aria-label*="close" i],[aria-label*="dismiss" i],button,[role="button"],span,svg');
  } catch (e) {}
  const limit = Math.min(nodes.length, 80);
  for (let i = 0; i < limit; i++) if (isCloseControl(nodes[i])) return true;
  return false;
}

function isEmptyOrCloseOnly(node, depth) {
  if (!node || depth > 10) return false;
  if (node.nodeType === 3) {
    const text = String(node.nodeValue || '').trim();
    return !text || CLOSE_ICON_TEXT_RE.test(text);
  }
  if (node.nodeType !== 1) return true;
  if (isCloseControl(node)) return true;
  const tag = String(node.tagName || '').toLowerCase();
  if (/^(?:a|img|iframe|object|embed|video|audio|canvas|form|input|select|textarea)$/.test(tag)) return false;
  const children = node.childNodes || [];
  for (let i = 0; i < children.length; i++) {
    if (!isEmptyOrCloseOnly(children[i], depth + 1)) return false;
  }
  return true;
}

function isFloatingContainer(el) {
  if (!el || el.nodeType !== 1) return false;
  let style;
  try { style = W.getComputedStyle(el); } catch (e) { return false; }
  if (!style) return false;
  const z = parseInt(style.zIndex, 10);
  return style.position === 'fixed' || style.position === 'absolute' || (isFinite(z) && z >= 10);
}

function isFloatingAdModal(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = String(el.tagName || '').toLowerCase();
  if (tag !== 'div' && tag !== 'section' && tag !== 'dialog') return false;

  let style, rect;
  try { style = W.getComputedStyle(el); rect = el.getBoundingClientRect(); } catch (e) { return false; }
  if (!style || (style.position !== 'fixed' && style.position !== 'absolute')) return false;
  const z = parseInt(style.zIndex, 10);
  if (!isFinite(z) || z < 100) return false;

  const vw = W.innerWidth || D.documentElement.clientWidth || 0;
  const vh = W.innerHeight || D.documentElement.clientHeight || 0;
  if (!vw || !vh || rect.width <= 150 || rect.height <= 150) return false;
  if (rect.left < -2 || rect.top < -2 || rect.right > vw + 2 || rect.bottom > vh + 2) return false;
  if (rect.width * rect.height >= vw * vh * 0.9) return false;
  const centered = Math.abs((rect.left + rect.width / 2) - vw / 2) <= vw * 0.22
    && Math.abs((rect.top + rect.height / 2) - vh / 2) <= vh * 0.22;
  if (style.position === 'absolute' && !centered) return false;

  if (hasProtectedCleanupContent(el)) return false;
  const text = meaningfulText(el);
  if (text.length >= 50) return false;
  let links = [], media = [];
  try {
    links = el.querySelectorAll('a[href]');
    media = el.querySelectorAll('img,iframe,object,embed');
  } catch (e) {}
  if (links.length > 2 || media.length > 2 || links.length + media.length === 0) return false;

  let adEvidence = false, untrustedExternalLink = false, trustedIdentityLink = false;
  const marked = ((el.id || '') + ' ' + classString(el)).trim();
  if (RE_AD_TOKEN.test(marked)) adEvidence = true;
  for (let i = 0; i < Math.min(links.length, 3); i++) {
    const link = links[i];
    const u = safeUrl(link.href || attr(link, 'href'));
    const marker = ((link.id || '') + ' ' + classString(link)).trim();
    if (RE_AD_TOKEN.test(marker) || (u && isAdUrl(u))) adEvidence = true;
    if (u && isUntrustedCrossSiteUrl(u)) untrustedExternalLink = true;
    if (u && isTrustedPopupHost(u.hostname)) trustedIdentityLink = true;
  }
  for (let i = 0; i < Math.min(media.length, 3); i++) {
    const item = media[i];
    const u = safeUrl(attr(item, 'src') || attr(item, 'data-src') || '');
    const marker = ((item.id || '') + ' ' + classString(item)).trim();
    if (RE_AD_TOKEN.test(marker) || (u && isAdUrl(u))) adEvidence = true;
    if (u && isUntrustedCrossSiteUrl(u)) untrustedExternalLink = true;
    if (u && isTrustedPopupHost(u.hostname)) trustedIdentityLink = true;
  }

  const sparseImageDialog = media.length > 0 && text.length < 15 && containsCloseControl(el);
  if (trustedIdentityLink && !adEvidence) return false;
  return adEvidence || (media.length > 0 && untrustedExternalLink) || sparseImageDialog;
}

function isBackdropFor(backdrop, modal) {
  if (!backdrop || !modal || backdrop === modal || backdrop.nodeType !== 1) return false;
  const tag = String(backdrop.tagName || '').toLowerCase();
  if (tag !== 'div' && tag !== 'section') return false;
  if (hasProtectedCleanupContent(backdrop) || meaningfulText(backdrop).length > 2) return false;
  let bs, ms, br, mr;
  try {
    bs = W.getComputedStyle(backdrop); ms = W.getComputedStyle(modal);
    br = backdrop.getBoundingClientRect(); mr = modal.getBoundingClientRect();
  } catch (e) { return false; }
  if (!bs || !ms || (bs.position !== 'fixed' && bs.position !== 'absolute')) return false;
  const bz = parseInt(bs.zIndex, 10), mz = parseInt(ms.zIndex, 10);
  if (!isFinite(bz) || !isFinite(mz) || mz < 10 || bz > mz || mz - bz > 1) return false;
  const vw = W.innerWidth || D.documentElement.clientWidth || 0;
  const vh = W.innerHeight || D.documentElement.clientHeight || 0;
  return !!vw && !!vh && br.width >= vw * 0.95 && br.height >= vh * 0.95
    && br.width * br.height >= mr.width * mr.height;
}

function adjacentBackdropNodes(el) {
  if (!el || !el.parentElement) return [];
  const out = [];
  const prev = el.previousElementSibling, next = el.nextElementSibling;
  if (prev && isBackdropFor(prev, el)) out.push(prev);
  if (next && isBackdropFor(next, el)) out.push(next);
  return out;
}

function removeTrackedAdNode(el, reason) {
  if (!el || !el.parentNode) return false;
  try {
    if (state.removedNodes.length > 200) state.removedNodes.shift();
    const parent = el.parentNode, next = el.nextSibling;
    state.removedNodes.push({ el, parent, next });
    parent.removeChild(el);
    stats.inc('removed');
    stats.inc('ads');
    log('BLOCK','dom', reason || 'remove', el.tagName);
    return true;
  } catch (e) { log('ERROR','apply', e && e.message); return false; }
}

function removePairedBackdrops(el) {
  const backdrops = adjacentBackdropNodes(el);
  for (const backdrop of backdrops) removeTrackedAdNode(backdrop, 'backdrop-removed');
}

function pruneAdAncestors(start) {
  let current = start;
  for (let depth = 0; current && depth < 4; depth++) {
    const tag = String(current.tagName || '').toLowerCase();
    if (tag === 'body' || tag === 'html' || tag === 'main') break;
    const next = current.parentElement;
    if (!hasProtectedCleanupContent(current) && isFloatingContainer(current)
      && isEmptyOrCloseOnly(current, 0)) {
      removePairedBackdrops(current);
      if (removeTrackedAdNode(current, 'parent-pruned')) {
        current = next;
        continue;
      }
    }
    current = next;
  }
}

function applyAction(el, action, reason) {
  if (!el || !el.parentNode) return;
  try {
    if (action === 'remove') {
      const parent = el.parentNode;
      removePairedBackdrops(el);
      if (removeTrackedAdNode(el, reason || 'remove')) {
        pruneAdAncestors(parent);
        if (/invisible-click-trap|anti-adblock|floating-ad-modal|suspicious-overlay/i.test(reason || '')) scheduleUnlockPageScroll();
      }
    } else if (action === 'hide') {
      if (state.hiddenNodes.has(el)) return;
      state.hiddenNodes.add(el);
      el.setAttribute('data-nvirya-hidden', reason || '1');
      stats.inc('hidden');
      if (/anti-adblock|floating-ad-modal|suspicious-overlay/i.test(reason || '')) scheduleUnlockPageScroll();
    }
  } catch (e) { log('ERROR','apply', e && e.message); }
}

function hasNonClosePayload(root, excludedNode) {
  if (!root) return false;
  const stack = [root];
  let visited = 0;
  while (stack.length && visited < 500) {
    const node = stack.pop();
    if (!node || node === excludedNode) continue;
    visited++;
    if (node.nodeType === 3) {
      const text = String(node.nodeValue || '').trim();
      if (text && !CLOSE_ICON_TEXT_RE.test(text)) return true;
      continue;
    }
    if (node.nodeType !== 1 || isCloseControl(node) || isNviryaNode(node)) continue;
    const tag = String(node.tagName || '').toLowerCase();
    if (/^(?:a|img|iframe|object|embed|video|audio|canvas|form|input|select|textarea)$/.test(tag)) return true;
    const children = node.childNodes || [];
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
  }
  return false;
}

function hasNearbyMeaningfulContent(closeEl, rect) {
  const parent = closeEl && closeEl.parentElement;
  if (!parent) return false;
  const parentTag = String(parent.tagName || '').toLowerCase();
  if (parentTag !== 'body' && parentTag !== 'html') {
    if (hasFormControls(parent) || hasProtectedPlayerContent(parent)) return true;
    if (meaningfulText(parent, closeEl).length > 20) return true;
    return hasNonClosePayload(parent, closeEl);
  }

  const siblings = parent.children || [];
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i];
    if (sibling === closeEl || isCloseControl(sibling)) continue;
    let sr;
    try { sr = sibling.getBoundingClientRect(); } catch (e) { continue; }
    const dx = Math.max(0, rect.left - sr.right, sr.left - rect.right);
    const dy = Math.max(0, rect.top - sr.bottom, sr.top - rect.bottom);
    if (Math.sqrt(dx * dx + dy * dy) > 100) continue;
    if (meaningfulText(sibling).length > 10 || hasNonClosePayload(sibling, null)) return true;
  }
  return false;
}

function isOrphanCloseButton(el) {
  if (!el || !isCloseControl(el) || isNviryaNode(el) || isProtectedPlayer(el)) return false;
  const parent = el.parentElement;
  if (!parent || hasFormControls(parent) || hasProtectedPlayerContent(parent)) return false;
  let style, rect;
  try { style = W.getComputedStyle(el); rect = el.getBoundingClientRect(); } catch (e) { return false; }
  if (!style || (style.position !== 'fixed' && style.position !== 'absolute')) return false;
  const z = parseInt(style.zIndex, 10);
  if (!isFinite(z) || z < 50) return false;
  if (hasNearbyMeaningfulContent(el, rect)) return false;
  const parentTag = String(parent.tagName || '').toLowerCase();
  return parentTag === 'body' || parentTag === 'html' || !hasNonClosePayload(parent, el);
}

function cleanupOrphanCloseButtons(root) {
  if (isDisabledHere()) return;
  let nodes = [];
  const query = '[class*="close" i],[id*="close" i],[aria-label*="close" i],[aria-label*="dismiss" i],button,[role="button"],span,svg,a,div';
  try {
    if (root && root.nodeType === 1 && root.matches && root.matches(query)) nodes.push(root);
    const found = root && root.querySelectorAll ? root.querySelectorAll(query) : D.querySelectorAll(query);
    for (let i = 0; i < found.length; i++) nodes.push(found[i]);
  } catch (e) { return; }
  const limit = Math.min(nodes.length, 800);
  for (let i = 0; i < limit; i++) {
    const el = nodes[i];
    if (!el || !el.parentNode || !isOrphanCloseButton(el)) continue;
    const parent = el.parentElement;
    removePairedBackdrops(el);
    if (removeTrackedAdNode(el, 'orphan-close-removed')) pruneAdAncestors(parent);
  }
}

function cleanupFloatingAdModals(root) {
  if (isDisabledHere()) return;
  let nodes = [];
  const query = 'div,section,dialog';
  try {
    if (root && root.nodeType === 1 && root.matches && root.matches(query)) nodes.push(root);
    const found = root && root.querySelectorAll ? root.querySelectorAll(query) : D.querySelectorAll(query);
    for (let i = 0; i < found.length; i++) nodes.push(found[i]);
  } catch (e) { return; }
  const limit = Math.min(nodes.length, 1200);
  for (let i = 0; i < limit; i++) {
    const el = nodes[i];
    if (el && el.parentNode && isFloatingAdModal(el)) applyAction(el, 'remove', 'floating-ad-modal');
  }
}

let overlayCleanupScheduled = false;
let lastOverlayCleanupTs = 0;
const overlayCleanupRoots = new Set();
function scheduleOverlayCleanup(root) {
  if (root) {
    const candidate = root.nodeType === 1 ? root : root.parentElement;
    if (candidate) overlayCleanupRoots.add(candidate);
    if (overlayCleanupRoots.size > 100) {
      overlayCleanupRoots.clear();
      if (D.documentElement) overlayCleanupRoots.add(D.documentElement);
    }
  }
  if (overlayCleanupScheduled) return;
  overlayCleanupScheduled = true;
  const delay = Math.max(60, 350 - (Date.now() - lastOverlayCleanupTs));
  setTimeout(() => {
    overlayCleanupScheduled = false;
    lastOverlayCleanupTs = Date.now();
    if (isDisabledHere()) return;
    try {
      const roots = Array.from(overlayCleanupRoots);
      overlayCleanupRoots.clear();
      if (!roots.length && D.documentElement) roots.push(D.documentElement);
      for (const scope of roots) {
        cleanupFloatingAdModals(scope);
        cleanupOrphanCloseButtons(scope);
      }
    } catch (e) { log('ERROR','overlay-cleanup', e && e.message); }
  }, delay);
}

let cosmeticStyleEl = null;
function installCosmeticCSS() {
  if (!config.cosmeticFiltering) return;
  const css = `
    [id^="google_ads_"], [id^="aswift_"], [id^="div-gpt-ad"],
    ins.adsbygoogle,
    [data-ad-slot], [data-ad-client], [data-ad-unit],
    iframe[src*="googlesyndication"], iframe[src*="doubleclick"],
    iframe[src*="adservice.google"], iframe[src*="amazon-adsystem"],
    [data-nvirya-hidden] {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
  `;
  try {
    let style = D.querySelector('style[data-nvirya-cosmetic]');
    if (!style) {
      style = D.createElement('style');
      style.setAttribute('data-nvirya-cosmetic','');
      (D.head || D.documentElement).appendChild(style);
    }
    style.textContent = css;
    cosmeticStyleEl = style;
  } catch (e) {}
}

function installSiteRulesCSS() {
  const rules = state.siteRules[hostname];
  let style = D.querySelector('style[data-nvirya-site-rules]');
  if (!rules || !rules.length) {
    if (style && style.parentNode) style.parentNode.removeChild(style);
    return;
  }
  const css = rules.map(r => `${r.selector}{display:none!important;}`).join('\n');
  try {
    if (!style) {
      style = D.createElement('style');
      style.setAttribute('data-nvirya-site-rules','');
      (D.head || D.documentElement).appendChild(style);
    }
    style.textContent = css;
  } catch (e) {}
}

let observer = null;
const pendingQueue = [];
const pendingSet = new WeakSet();
let scheduled = false;
const MAX_QUEUE = 800;
const handledMetaRefresh = new WeakSet();
const trackedVideos = new WeakSet();
const clickedSkipButtons = new WeakSet();
const activeAdVideos = new WeakMap();
let videoScanScheduled = false;
let videoScanTimer = null;
let lastVideoScan = 0;

function hasAdPlayerMarker(video) {
  let cur = video, depth = 0;
  while (cur && cur.nodeType === 1 && depth++ < 7) {
    const marker = ((cur.id || '') + ' ' + classString(cur) + ' ' + (attr(cur, 'aria-label') || '')).toLowerCase();
    const dataAd = (attr(cur, 'data-ad-playing') || attr(cur, 'data-ad-showing') || '').toLowerCase();
    if (dataAd === 'true' || /(?:ad[-_\s]?(?:showing|playing|video|container|player)|video[-_\s]?ad|ima[-_\s]?ad|preroll|midroll|advertisement|jw-flag-ads|dplayer-ad|artplayer-ad|videoadui)/i.test(marker)) return true;
    cur = cur.parentElement;
  }
  const src = String(video.currentSrc || video.src || attr(video, 'src') || '').toLowerCase();
  return /(?:googlesyndication|doubleclick|adservice|\/ads?(?:\/|[-_.])|imasdk)/i.test(src);
}

function restoreAdVideo(video) {
  const saved = activeAdVideos.get(video);
  if (!saved) return;
  activeAdVideos.delete(video);
  try { video.muted = saved.muted; } catch (e) {}
  try { if (isFinite(saved.volume)) video.volume = saved.volume; } catch (e) {}
  try { if (isFinite(saved.playbackRate) && saved.playbackRate > 0) video.playbackRate = saved.playbackRate; } catch (e) {}
}

function handleAdVideo(video) {
  if (!video || !hasAdPlayerMarker(video)) return false;
  if (!activeAdVideos.has(video)) {
    activeAdVideos.set(video, {
      muted: !!video.muted,
      volume: Number(video.volume),
      playbackRate: Number(video.playbackRate)
    });
  }
  try { video.muted = true; } catch (e) {}
  try { video.volume = 0; } catch (e) {}
  try { video.playbackRate = 16; } catch (e) {}
  const duration = Number(video.duration);
  if (isFinite(duration) && duration > 0) {
    try { video.currentTime = duration; } catch (e) {
      try { if (typeof video.fastSeek === 'function') video.fastSeek(duration); } catch (e2) {}
    }
  }
  return true;
}

function scheduleVideoAdScan() {
  if (videoScanScheduled || isDisabledHere()) return;
  videoScanScheduled = true;
  const run = function () {
    videoScanScheduled = false;
    if (isDisabledHere() || !D.body) return;
    const now = Date.now();
    if (now - lastVideoScan < 180) {
      if (!videoScanTimer) videoScanTimer = setTimeout(function () { videoScanTimer = null; scheduleVideoAdScan(); }, 180);
      return;
    }
    lastVideoScan = now;
    let hasActiveAd = false;
    try {
      const skip = D.querySelectorAll('.ytp-ad-skip-button,.ytp-ad-skip-button-modern,.videoAdUiSkipButton,[class*="skip-ad" i],[class*="ad-skip" i],[aria-label*="skip ad" i],[data-testid*="skip-ad" i],.jw-skip,.vjs-ad-skip-button,.dplayer-ad-skip,.artplayer-ad-skip');
      for (let i = 0; i < Math.min(skip.length, 30); i++) {
        const button = skip[i];
        if (clickedSkipButtons.has(button) || isNviryaNode(button)) continue;
        const rect = button.getBoundingClientRect();
        const style = W.getComputedStyle(button);
        if (!style || style.display === 'none' || style.visibility === 'hidden' || rect.width < 2 || rect.height < 2) continue;
        if (button.disabled || attr(button, 'aria-disabled') === 'true') continue;
        clickedSkipButtons.add(button);
        try { button.click(); log('INFO', 'video-ad', 'clicked skip-ad control'); } catch (e) {}
      }
      const videos = D.querySelectorAll('video');
      for (let i = 0; i < Math.min(videos.length, 40); i++) {
        const video = videos[i];
        if (!trackedVideos.has(video)) {
          trackedVideos.add(video);
          video.addEventListener('timeupdate', scheduleVideoAdScan, { passive: true });
          video.addEventListener('loadedmetadata', scheduleVideoAdScan, { passive: true });
          video.addEventListener('play', scheduleVideoAdScan, { passive: true });
          video.addEventListener('ended', scheduleVideoAdScan, { passive: true });
        }
        if (handleAdVideo(video)) hasActiveAd = true;
        else if (activeAdVideos.has(video)) restoreAdVideo(video);
      }
    } catch (e) {}
    if (hasActiveAd && !videoScanTimer) {
      videoScanTimer = setTimeout(function () { videoScanTimer = null; scheduleVideoAdScan(); }, 500);
    } else if (!hasActiveAd && videoScanTimer) {
      clearTimeout(videoScanTimer);
      videoScanTimer = null;
    }
  };
  if (typeof W.requestAnimationFrame === 'function') W.requestAnimationFrame(run);
  else setTimeout(run, 32);
}

function removeMetaRefresh(root) {
  if (!config.redirectProtection || isDisabledHere() || !root) return;
  const candidates = [];
  try {
    if (root.nodeType === 1 && String(root.tagName).toLowerCase() === 'meta') candidates.push(root);
    if (root.querySelectorAll) {
      const found = root.querySelectorAll('meta[http-equiv]');
      for (let i = 0; i < found.length; i++) candidates.push(found[i]);
    }
  } catch (e) {}
  for (const meta of candidates) {
    if (handledMetaRefresh.has(meta)) continue;
    const equiv = (attr(meta, 'http-equiv') || '').trim().toLowerCase();
    if (equiv !== 'refresh') continue;
    handledMetaRefresh.add(meta);
    const content = attr(meta, 'content') || '';
    try {
      if (!meta.parentNode) continue;
      meta.parentNode.removeChild(meta);
      recordBlocked('redirect', 'meta-refresh', content);
    } catch (e) { log('ERROR','meta-refresh', e && e.message); }
  }
}

function scheduleProcess() {
  if (scheduled) return;
  scheduled = true;
  const run = () => {
    scheduled = false;
    processQueue();
  };
  if (typeof W.requestIdleCallback === 'function') {
    W.requestIdleCallback(run, { timeout: 250 });
  } else {
    setTimeout(run, 32);
  }
}

function processQueue() {
  if (pendingQueue.length === 0) return;
  const budget = Math.min(pendingQueue.length, 120);
  let count = 0;
  while (count < budget && pendingQueue.length) {
    const el = pendingQueue.shift();
    pendingSet.delete(el);
    try { inspectAndAct(el); } catch (e) { log('ERROR','scan', e && e.message); }
    count++;
  }
  if (pendingQueue.length) scheduleProcess();
}

function inspectAndAct(el) {
  if (!el || el.nodeType !== 1) return;
  if (isDisabledHere()) return;
  if (isNviryaNode(el)) return;
  if (el.hasAttribute && el.hasAttribute('data-nvirya-hidden')) return;

  const tag = (el.tagName || '').toLowerCase();
  if (!CANDIDATE_TAGS.has(tag)) return;

  if ((tag === 'div' || tag === 'section' || tag === 'dialog') && isFloatingAdModal(el)) {
    applyAction(el, 'remove', 'floating-ad-modal');
    return;
  }

  const decision = inspectNode(el);
  if (decision.action !== 'ignore') {
    applyAction(el, decision.action, decision.reason);
    return;
  }

  if (tag === 'div' || tag === 'section' || tag === 'iframe') {
    if (isSuspiciousOverlay(el)) applyAction(el, 'remove', 'suspicious-overlay');
  }
}

function enqueue(el) {
  if (!el || el.nodeType !== 1) return;
  if (pendingSet.has(el)) return;
  if (pendingQueue.length >= MAX_QUEUE) pendingQueue.shift();
  pendingSet.add(el);
  pendingQueue.push(el);
  scheduleProcess();
}

function startObserver() {
  if (observer) return;
  try {
    observer = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.type === 'childList') {
          scheduleOverlayCleanup(m.target);
          for (const n of m.addedNodes) {
            if (n.nodeType === 1) {
              scheduleOverlayCleanup(n);
              removeMetaRefresh(n);
              if (String(n.tagName).toLowerCase() === 'meta'
                && (attr(n, 'http-equiv') || '').trim().toLowerCase() === 'refresh') continue;
              enqueue(n);
              if (n.children && n.children.length) {
                const lim = Math.min(n.children.length, 30);
                for (let k = 0; k < lim; k++) enqueue(n.children[k]);
              }
            }
          }
        } else if (m.type === 'attributes') {
          scheduleOverlayCleanup(m.target);
          removeMetaRefresh(m.target);
          enqueue(m.target);
        }
      }
      scheduleOverlayCleanup();
      scheduleVideoAdScan();
    });
  } catch (e) { return; }
  const target = D.documentElement || D;
  observer.observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src','href','style','class','id','data-src','srcset','data-srcset','http-equiv','aria-label','title']
  });
}

function initialScan() {
  const root = D.body || D.documentElement;
  if (!root) return;
  removeMetaRefresh(root);
  scheduleOverlayCleanup(root);
  queueTrapNode(root, true);
  scheduleVideoAdScan();
  const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
  let trapIndex = 0;
  function scanTrapBatch() {
    const end = Math.min(trapIndex + 60, all.length);
    for (; trapIndex < end; trapIndex++) queueTrapNode(all[trapIndex], false);
    if (trapIndex < all.length) setTimeout(scanTrapBatch, 16);
  }
  scanTrapBatch();
  const CHUNK = 200;
  let i = 0;
  function step() {
    const end = Math.min(i + CHUNK, all.length);
    for (; i < end; i++) enqueue(all[i]);
    if (i < all.length) scheduleProcess(), setTimeout(step, 24);
    else scheduleProcess();
  }
  step();
}

function installSPAHooks() {
  try {
    const h = W.history;
    if (h && !h.__nvirya) {
      ['pushState','replaceState'].forEach(k => {
        const orig = h[k];
        if (typeof orig !== 'function') return;
        h[k] = function () {
          const ret = orig.apply(this, arguments);
          try { onLocationChange(); } catch (e) {}
          return ret;
        };
      });
      try { Object.defineProperty(h, '__nvirya', { value: true }); } catch (e) {}
    }
    W.addEventListener('popstate', onLocationChange, true);
  } catch (e) {}
}
let lastHref = location.href;
function onLocationChange() {
  if (location.href === lastHref) return;
  lastHref = location.href;
  if (isDisabledHere()) {
    if (observer) { try { observer.disconnect(); } catch (e) {} observer = null; }
  } else {
    if (!observer) startObserver();
    installSiteRulesCSS();
    initialScan();
  }
  updateUIStatus();
}

function handleAntiAdblock() {
  if (!config.antiAdblock || isDisabledHere()) return;
  try {
    const all = D.querySelectorAll('[class*="adblock" i],[id*="adblock" i],[class*="adblocker" i]');
    const lim = Math.min(all.length, 30);
    for (let i = 0; i < lim; i++) {
      const el = all[i];
      if (isNviryaNode(el) || hasFormControls(el) || hasProtectedPlayerContent(el)) continue;
      const idc = ((el.id || '') + ' ' + classString(el));
      if (!RE_ANTIADB.test(idc)) continue;
      let cs;
      try { cs = W.getComputedStyle(el); } catch (e) { continue; }
      if (!cs) continue;
      const isOverlay = (cs.position === 'fixed' || cs.position === 'absolute')
        && parseInt(cs.zIndex || 0, 10) > 1000
        && el.offsetWidth >= W.innerWidth * 0.5
        && el.offsetHeight >= W.innerHeight * 0.5;
      if (isOverlay) {
        el.setAttribute('data-nvirya-hidden','anti-adblock');
        state.hiddenNodes.add(el);
        stats.inc('hidden');
        scheduleUnlockPageScroll();
        log('BLOCK','anti-adblock','removed overlay');
      }
    }
  } catch (e) {}
}

function getSanitizedUrl() {
  try {
    const u = new URL(location.href);
    const sensitive = /auth|token|session|key|pass|code|secret|credential|email|user/i;
    const cleanParams = new URLSearchParams();
    u.searchParams.forEach((v, k) => {
      if (!sensitive.test(k)) cleanParams.set(k, v);
      else cleanParams.set(k, '[REDACTED]');
    });
    u.search = cleanParams.toString() ? '?' + cleanParams.toString() : '';
    u.hash = '';
    return u.href;
  } catch (e) {
    return (location.origin || '') + (location.pathname || '');
  }
}

function compareVersions(a, b) {
  const parse = (v) => String(v == null ? '' : v).split('.').filter(s => s !== '').map(s => parseInt(s, 10) || 0);
  const pa = parse(a), pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

const Updater = (() => {
  let checking = false;
  let scheduled = false;

  function isTopFrame() {
    try { return W.top === W.self; } catch (e) { return false; }
  }

  function getAvailable() {
    const remote = store.get(K_UPD_REMOTE, null);
    if (!remote) return null;
    if (compareVersions(VERSION, remote) < 0) return String(remote);
    store.del(K_UPD_REMOTE);
    return null;
  }

  function isSnoozed() {
    const until = Number(store.get(K_UPD_SNOOZE, 0)) || 0;
    const now = Date.now();
    return until > now && until - now <= UPDATE_SNOOZE_MS + 1000;
  }

  function snooze() { store.set(K_UPD_SNOOZE, Date.now() + UPDATE_SNOOZE_MS); }

  function fetchRemoteVersion(done) {
    let finished = false;
    const finish = (err, ver) => { if (finished) return; finished = true; done(err, ver); };
    const parse = (text) => {
      const head = String(text || '').slice(0, 8192);
      const m = head.match(/\/\/\s*@version\s+([0-9.]+)/i);
      const ver = m && m[1].replace(/^\.+|\.+$/g, '');
      if (ver && /\d/.test(ver)) finish(null, ver);
      else finish(new Error('no @version in remote file'));
    };

    if (typeof GM_xmlhttpRequest === 'function') {
      try {
        GM_xmlhttpRequest({
          method: 'GET',
          url: UPDATE_URL,
          headers: { 'Range': 'bytes=0-4095', 'Cache-Control': 'no-cache' },
          nocache: true,
          timeout: UPDATE_TIMEOUT,
          onload: (res) => {
            if (res.status === 200 || res.status === 206) parse(res.responseText);
            else finish(new Error('HTTP ' + res.status));
          },
          onerror: () => finish(new Error('network error')),
          ontimeout: () => finish(new Error('timeout')),
          onabort: () => finish(new Error('aborted'))
        });
        return;
      } catch (e) { /* fetch */ }
    }

    try {
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = setTimeout(() => { try { if (ctrl) ctrl.abort(); } catch (e) {} finish(new Error('timeout')); }, UPDATE_TIMEOUT);
      fetch(UPDATE_URL, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
        .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.text(); })
        .then(text => { clearTimeout(timer); parse(text); })
        .catch(err => { clearTimeout(timer); finish(err || new Error('network error')); });
    } catch (e) { finish(e); }
  }

  function check(manual) {
    if (checking) { if (manual) UI.toast('Checking...'); return; }
    const now = Date.now();
    const last = Number(store.get(K_UPD_LAST, 0)) || 0;
    if (!manual && last <= now && now - last < UPDATE_CHECK_INTERVAL) return;

    checking = true;
    store.set(K_UPD_LAST, now);
    UI.setUpdateChecking(true);
    if (manual) UI.toast('Checking...');

    fetchRemoteVersion((err, remote) => {
      checking = false;
      UI.setUpdateChecking(false);
      try {
        if (err) {
          log('WARN', 'update', 'check failed', err && err.message);
          store.set(K_UPD_LAST, Date.now() - UPDATE_CHECK_INTERVAL + UPDATE_RETRY_AFTER);
          if (manual) UI.toast('Không thể kiểm tra cập nhật');
          return;
        }
        if (compareVersions(VERSION, remote) < 0) {
          store.set(K_UPD_REMOTE, remote);
          if (manual) store.del(K_UPD_SNOOZE);
          UI.setUpdateAvailable(remote);
          if (manual || !isSnoozed()) UI.showUpdateBanner(remote);
          log('INFO', 'update', 'new version available', remote);
        } else {
          store.del(K_UPD_REMOTE);
          UI.setUpdateAvailable(null);
          UI.hideUpdateBanner();
          if (manual) UI.toast('Bạn đang dùng bản mới nhất!');
        }
      } catch (e) { log('ERROR', 'update', e && e.message); }
    });
  }

  function schedule() {
    if (scheduled || !isTopFrame()) return;
    scheduled = true;
    const run = () => {
      try {
        const avail = getAvailable();
        if (avail && !isSnoozed()) UI.showUpdateBanner(avail);
        check(false);
      } catch (e) { log('ERROR', 'update', e && e.message); }
    };
    setTimeout(() => {
      if (typeof W.requestIdleCallback === 'function') W.requestIdleCallback(run, { timeout: 3000 });
      else run();
    }, UPDATE_START_DELAY);
  }

  return { check, schedule, getAvailable, isSnoozed, snooze };
})();

const UI = (() => {
  const K_FAB = 'nvirya_x_fab';
  const THEMES = ['auto', 'light', 'dark'];
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const FAB_SIZE = 46, FAB_MARGIN = 10;

  let host = null, root = null;
  let menuOpen = false;
  let handleEl = null, backdropEl = null, sheetEl = null, grabEl = null, bodyEl = null;
  let themeBtn = null, segBtns = [];
  let statusEl = null, statsEl = null, toastEl = null;
  let reportModalEl = null, reportReasonSelect = null, reportNoteInput = null;
  let pickerEl = null, pickerLabelEl = null, pickerBarEl = null, pickerActive = false;
  let pickerHover = null, pickerTarget = null, lastPickerTouchAt = 0;
  let toastTimer = null;
  let lastToast = '';
  let statsTimer = null;
  let fab = { side: 'r', y: 0.7 };
  let statsMode = 'session'; // 'session' | 'lifetime'
  let segSessionBtn = null, segLifetimeBtn = null;
  let updateEl = null, ubTitleEl = null, newBadgeEl = null;
  let updateAvailable = null, updateChecking = false;
  let uiReady = false;

  function el(tag, props, ...children) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      if (k === 'style' && typeof props[k] === 'object') Object.assign(e.style, props[k]);
      else if (k === 'class') e.className = props[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), props[k]);
      else if (k === 'text') e.textContent = props[k];
      else e.setAttribute(k, props[k]);
    }
    for (const c of children) if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return e;
  }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }

  const ICONS = {
    shield:   ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
    sun:      [['c', 12, 12, 4], 'M12 2v2', 'M12 20v2', 'M4.93 4.93l1.41 1.41', 'M17.66 17.66l1.41 1.41', 'M2 12h2', 'M20 12h2', 'M6.34 17.66l-1.41 1.41', 'M19.07 4.93l-1.41 1.41'],
    moon:     ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
    close:    ['M18 6 6 18', 'M6 6l12 12'],
    chevron:  ['m9 18 6-6-6-6'],
    allow:    [['c', 12, 12, 10], 'm8 12 3 3 5-6'],
    pause:    [['c', 12, 12, 10], 'M10 9v6', 'M14 9v6'],
    target:   [['c', 12, 12, 10], 'M22 12h-4', 'M6 12H2', 'M12 6V2', 'M12 22v-4'],
    wand:     ['M15 4V2', 'M15 16v-2', 'M8 9h2', 'M20 9h2', 'M17.8 11.8 19 13', 'M15 9h.01', 'M17.8 6.2 19 5', 'M3 21l9-9', 'M12.2 6.2 11 5'],
    undo:     ['M3 7v6h6', 'M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13'],
    copy:     [['r', 9, 9, 13, 13, 2], 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
    flag:     ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7'],
    download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3']
  };
  function icon(name, cls) {
    const s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    if (cls) s.setAttribute('class', cls);
    for (const part of (ICONS[name] || [])) {
      let n;
      if (typeof part === 'string') {
        n = document.createElementNS(SVG_NS, 'path');
        n.setAttribute('d', part);
      } else if (part[0] === 'c') {
        n = document.createElementNS(SVG_NS, 'circle');
        n.setAttribute('cx', part[1]); n.setAttribute('cy', part[2]); n.setAttribute('r', part[3]);
      } else {
        n = document.createElementNS(SVG_NS, 'rect');
        n.setAttribute('x', part[1]); n.setAttribute('y', part[2]);
        n.setAttribute('width', part[3]); n.setAttribute('height', part[4]); n.setAttribute('rx', part[5]);
      }
      s.appendChild(n);
    }
    return s;
  }
  function fmt(n) { try { return Number(n || 0).toLocaleString(); } catch (e) { return String(n); } }

  const LIGHT_VARS = `
      --cs: light;
      --sheet: rgba(255,255,255,.94);
      --card: #f4f4f6;
      --card-hover: #eaeaea;
      --text: #18181b;
      --muted: #71717a;
      --border: rgba(0,0,0,.08);
      --accent: #3b82f6;
      --danger: #dc2626;
      --pill: rgba(0,0,0,.18);
      --ring: #ffffff;
      --backdrop: rgba(20,20,26,.34);
      --switch-off: #d4d4d8;
      --seg-bg: rgba(0,0,0,.06);
      --seg-on: #ffffff;
      --toast-bg: #18181b;
      --toast-fg: #f4f4f5;
      --shadow: 0 -10px 40px rgba(0,0,0,.16);
      --fab-shadow: 0 4px 16px rgba(0,0,0,.2);
  `;
  const DARK_VARS = `
      --cs: dark;
      --sheet: rgba(18,18,21,.94);
      --card: #1a1a1e;
      --card-hover: #232328;
      --text: #f4f4f5;
      --muted: #a1a1aa;
      --border: rgba(255,255,255,.08);
      --accent: #3b82f6;
      --danger: #f87171;
      --pill: rgba(255,255,255,.22);
      --ring: #121215;
      --backdrop: rgba(0,0,0,.52);
      --switch-off: #3f3f46;
      --seg-bg: rgba(255,255,255,.08);
      --seg-on: #3a3a41;
      --toast-bg: #f4f4f5;
      --toast-fg: #18181b;
      --shadow: 0 -10px 40px rgba(0,0,0,.5);
      --fab-shadow: 0 4px 16px rgba(0,0,0,.5);
  `;

  const CSS = `
    :host { all: initial; }
    :host { ${LIGHT_VARS} }
    @media (prefers-color-scheme: dark) {
      :host([data-theme="auto"]) { ${DARK_VARS} }
    }
    :host([data-theme="dark"]) { ${DARK_VARS} }
    :host([data-theme="light"]) { ${LIGHT_VARS} }

    * {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, system-ui, "Helvetica Neue", Arial, sans-serif;
      -webkit-tap-highlight-color: transparent;
    }
    button { font: inherit; color: inherit; margin: 0; }
    svg { display: block; }

    .handle {
      position: fixed; left: auto; top: auto;
      width: ${FAB_SIZE}px; height: ${FAB_SIZE}px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: var(--sheet);
      color: var(--accent);
      border: 1px solid var(--border);
      box-shadow: var(--fab-shadow);
      -webkit-backdrop-filter: blur(14px) saturate(1.4);
      backdrop-filter: blur(14px) saturate(1.4);
      opacity: .78;
      cursor: grab;
      user-select: none; -webkit-user-select: none;
      touch-action: none;
      z-index: 2147482999;
      transition: left .28s cubic-bezier(.32,.72,0,1), top .28s cubic-bezier(.32,.72,0,1), opacity .18s ease, transform .18s ease;
    }
    .handle svg { width: 22px; height: 22px; }
    .handle:hover, .handle:focus-visible { opacity: 1; }
    .handle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .handle.hidden { display: none !important; }
    .handle.dragging { cursor: grabbing; opacity: 1; transform: scale(1.08); transition: opacity .18s ease, transform .18s ease; }
    .handle.away { opacity: 0; pointer-events: none; transform: scale(.8); }
    .handle { --lc: 34,197,94; }
    .handle[data-state="warn"] { --lc: 245,158,11; }
    .handle[data-state="off"] { --lc: 113,113,122; }
    .fab-dot {
      position: absolute; top: 3px; right: 3px;
      width: 10px; height: 10px; border-radius: 50%;
      background: rgb(var(--lc));
      box-shadow: 0 0 0 2px var(--ring);
    }

    .backdrop {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: var(--backdrop);
      -webkit-backdrop-filter: blur(8px);
      backdrop-filter: blur(8px);
      opacity: 0; visibility: hidden;
      touch-action: none;
      transition: opacity .3s ease, visibility 0s linear .3s;
      z-index: 2147483000;
    }
    .backdrop.open { opacity: 1; visibility: visible; transition-delay: 0s; }

    .sheet {
      position: fixed; left: 0; right: 0; bottom: 0;
      max-height: 85vh; max-height: 85dvh;
      display: flex; flex-direction: column;
      background: var(--sheet);
      color: var(--text);
      color-scheme: var(--cs);
      font-size: 14px; line-height: 1.4;
      border: 1px solid var(--border); border-bottom: none;
      border-radius: 24px 24px 0 0;
      box-shadow: var(--shadow);
      -webkit-backdrop-filter: blur(28px) saturate(1.5);
      backdrop-filter: blur(28px) saturate(1.5);
      overflow: hidden;
      transform: translateY(105%);
      visibility: hidden;
      transition: transform .4s cubic-bezier(.32,.72,0,1), opacity .25s ease, visibility 0s linear .4s;
      will-change: transform;
      z-index: 2147483001;
    }
    .sheet.open { transform: translateY(0); visibility: visible; transition-delay: 0s; }
    .sheet:focus { outline: none; }

    @media (min-width: 641px) {
      .sheet {
        left: 50%; right: auto; top: 50%; bottom: auto;
        width: 390px; max-height: 85vh;
        border: 1px solid var(--border);
        border-radius: 20px;
        box-shadow: 0 24px 70px rgba(0,0,0,.35);
        opacity: 0;
        transform: translate(-50%, -46%) scale(.96);
      }
      .sheet.open { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      .pill { display: none; }
    }

    .grab { flex: none; padding-top: 8px; touch-action: none; }
    .pill { width: 36px; height: 5px; border-radius: 3px; background: var(--pill); margin: 0 auto 8px; }
    .head {
      display: flex; align-items: center; gap: 10px;
      padding: 6px 16px 12px;
      border-bottom: 1px solid var(--border);
    }
    @media (min-width: 641px) { .head { padding-top: 16px; } }
    .titles { flex: 1; min-width: 0; }
    .titles h1 { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: -.01em; color: var(--text); }
    .badge {
      display: inline-block; max-width: 100%;
      margin-top: 4px; padding: 2px 9px;
      border-radius: 999px;
      background: var(--card); border: 1px solid var(--border);
      color: var(--muted); font-size: 11.5px; line-height: 1.5;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      vertical-align: top;
    }
    .head-btns { flex: none; display: flex; gap: 8px; }
    .icon-btn {
      width: 32px; height: 32px; border-radius: 50%;
      display: grid; place-items: center;
      background: var(--card); color: var(--muted);
      border: none; cursor: pointer; padding: 0;
      transition: background .15s ease, color .15s ease;
    }
    .icon-btn svg { width: 16px; height: 16px; }
    .icon-btn:active { background: var(--card-hover); color: var(--text); }
    .icon-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    @media (hover: hover) { .icon-btn:hover { background: var(--card-hover); color: var(--text); } }

    .body {
      flex: 1; min-height: 0;
      overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
      padding: 14px 16px calc(20px + env(safe-area-inset-bottom, 0px));
    }
    .sec-title { margin: 20px 4px 8px; font-size: 13px; font-weight: 600; color: var(--muted); }

    .status {
      display: flex; align-items: center; gap: 12px;
      padding: 14px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
    }
    .led {
      --lc: 34,197,94;
      flex: none; width: 10px; height: 10px; border-radius: 50%;
      background: rgb(var(--lc));
      box-shadow: 0 0 8px rgba(var(--lc), .7);
      animation: pulse 2.2s ease-out infinite;
    }
    .led.warn { --lc: 245,158,11; }
    .led.off { --lc: 113,113,122; animation: none; box-shadow: none; }
    @keyframes pulse {
      0%   { box-shadow: 0 0 0 0 rgba(var(--lc), .55), 0 0 8px rgba(var(--lc), .6); }
      70%  { box-shadow: 0 0 0 10px rgba(var(--lc), 0), 0 0 8px rgba(var(--lc), .6); }
      100% { box-shadow: 0 0 0 0 rgba(var(--lc), 0), 0 0 8px rgba(var(--lc), .6); }
    }
    .status .t { font-size: 15px; font-weight: 600; }
    .status .s { font-size: 12px; color: var(--muted); margin-top: 1px; }

    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .stat { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 12px 14px; min-width: 0; }
    .stat:last-child:nth-child(odd) { grid-column: 1 / -1; }
    .stat b { display: block; font-size: 24px; font-weight: 700; letter-spacing: -.02em; line-height: 1.15; font-variant-numeric: tabular-nums; color: var(--text); }
    .stat span { display: block; margin-top: 2px; font-size: 12px; color: var(--muted); font-weight: 500; }
    .stat-sub { display: block; margin-top: 2px; font-size: 11px; color: var(--muted); opacity: .85; }

    .group { background: var(--card); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; --sep: 14px; }
    .group.icons { --sep: 56px; }
    .group.pad { padding: 6px; }
    .group + .group { margin-top: 10px; }
    .item {
      position: relative;
      display: flex; align-items: center; gap: 12px;
      width: 100%; min-height: 50px;
      padding: 10px 14px;
      background: none; border: none;
      color: var(--text); text-align: left;
      font-size: 15px; cursor: pointer;
      transition: background .12s ease;
    }
    .item + .item::before { content: ''; position: absolute; top: 0; left: var(--sep); right: 0; height: 1px; background: var(--border); }
    .item:active { background: var(--card-hover); }
    .item:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
    @media (hover: hover) { .item:hover { background: var(--card-hover); } }
    .item .txt { flex: 1; min-width: 0; display: block; }
    .item .lbl { display: block; font-weight: 500; }
    .item .sub { display: block; margin-top: 1px; font-size: 12px; color: var(--muted); }
    .item.danger .lbl { color: var(--danger); }
    .chev { flex: none; width: 16px; height: 16px; color: var(--muted); opacity: .6; }
    .tile { flex: none; width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; color: #fff; }
    .tile svg { width: 17px; height: 17px; }
    .t-green  { background: #34c759; }
    .t-orange { background: #ff9f0a; }
    .t-blue   { background: #3b82f6; }
    .t-purple { background: #6366f1; }
    .t-gray   { background: #8e8e93; }

    .switch { position: relative; flex: none; width: 46px; height: 28px; }
    .switch input { position: absolute; top: 0; left: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; z-index: 1; }
    .track { position: absolute; top: 0; left: 0; right: 0; bottom: 0; border-radius: 14px; background: var(--switch-off); transition: background .22s ease; }
    .track::after {
      content: ''; position: absolute; top: 2px; left: 2px;
      width: 24px; height: 24px; border-radius: 50%;
      background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3);
      transition: transform .24s cubic-bezier(.32,.72,0,1);
    }
    .switch input:checked + .track { background: var(--accent); }
    .switch input:checked + .track::after { transform: translateX(18px); }
    .switch input:focus-visible + .track { outline: 2px solid var(--accent); outline-offset: 2px; }

    .seg { display: flex; padding: 3px; gap: 2px; border-radius: 10px; background: var(--seg-bg); }
    .seg button {
      flex: 1; padding: 7px 0; border: none; border-radius: 8px;
      background: none; color: var(--muted);
      font-size: 13px; font-weight: 600; cursor: pointer;
      transition: background .18s ease, color .18s ease, box-shadow .18s ease;
    }
    .seg button[aria-pressed="true"] { background: var(--seg-on); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,.18); }
    .seg button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

    .footer { margin-top: 18px; text-align: center; font-size: 11.5px; color: var(--muted); opacity: .8; }

    .toast {
      position: fixed; left: 50%; bottom: calc(18px + env(safe-area-inset-bottom, 0px));
      transform: translate(-50%, 16px);
      background: var(--toast-bg); color: var(--toast-fg);
      padding: 9px 14px; border-radius: 999px;
      font-size: 13px; font-weight: 500;
      box-shadow: 0 6px 24px rgba(0,0,0,.25);
      opacity: 0; pointer-events: none;
      transition: opacity .2s ease, transform .2s ease;
      z-index: 2147483002; max-width: 90vw;
    }
    .toast.top { bottom: auto; top: calc(14px + env(safe-area-inset-top, 0px)); transform: translate(-50%, -16px); }
    .toast.show, .toast.top.show { opacity: 1; transform: translate(-50%, 0); }

    .new-badge {
      display: none;
      margin-left: 8px; padding: 2px 7px;
      border-radius: 999px;
      background: #ff3b30; color: #fff;
      font-size: 10px; font-weight: 700; letter-spacing: .04em; line-height: 1.4;
      vertical-align: middle; position: relative; top: -1px;
    }
    .new-badge.show { display: inline-block; }

    .update-banner {
      position: fixed; left: 50%; top: calc(12px + env(safe-area-inset-top, 0px));
      width: min(92vw, 380px);
      padding: 14px;
      background: var(--sheet); color: var(--text);
      border: 1px solid var(--border); border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.08);
      -webkit-backdrop-filter: blur(28px) saturate(1.5);
      backdrop-filter: blur(28px) saturate(1.5);
      font-size: 14px; line-height: 1.4;
      opacity: 0; visibility: hidden; pointer-events: none;
      transform: translate(-50%, calc(-100% - 24px));
      transition: transform .45s cubic-bezier(.32,.72,0,1), opacity .25s ease, visibility 0s linear .45s;
      will-change: transform;
      z-index: 2147483004;
    }
    .update-banner.show {
      opacity: 1; visibility: visible; pointer-events: auto;
      transform: translate(-50%, 0);
      transition-delay: 0s;
    }
    .ub-row { display: flex; align-items: flex-start; gap: 12px; }
    .ub-icon { width: 36px; height: 36px; border-radius: 10px; }
    .ub-icon svg { width: 19px; height: 19px; }
    .ub-txt { flex: 1; min-width: 0; }
    .ub-title { font-size: 15px; font-weight: 700; letter-spacing: -.01em; }
    .ub-desc { margin-top: 2px; font-size: 12.5px; color: var(--muted); }
    .ub-close { width: 28px; height: 28px; margin: -2px -2px 0 0; }
    .ub-actions { display: flex; gap: 8px; margin-top: 12px; }
    .ub-btn {
      flex: 1; display: flex; align-items: center; justify-content: center;
      min-height: 38px; padding: 0 12px;
      border: none; border-radius: 12px;
      font-size: 14px; font-weight: 600;
      cursor: pointer; text-decoration: none;
      transition: opacity .15s ease;
    }
    .ub-btn:active { opacity: .8; }
    .ub-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .ub-btn.later { background: var(--card); color: var(--text); border: 1px solid var(--border); }
    .ub-btn.go { background: var(--accent); color: #fff; }

    .report-modal {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: var(--backdrop);
      -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      padding: 16px; opacity: 0; visibility: hidden;
      transition: opacity .25s ease, visibility 0s linear .25s;
      z-index: 2147483010;
    }
    .report-modal.open { opacity: 1; visibility: visible; transition-delay: 0s; }
    .report-card {
      background: var(--sheet); color: var(--text);
      width: 100%; max-width: 360px;
      border: 1px solid var(--border); border-radius: 20px;
      padding: 18px; box-shadow: var(--shadow);
      display: flex; flex-direction: column; gap: 10px;
      box-sizing: border-box;
    }
    .report-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .report-head h2 { margin: 0; font-size: 16px; font-weight: 700; }
    .report-lbl { font-size: 12.5px; font-weight: 600; color: var(--muted); margin-top: 4px; }
    .report-select, .report-textarea {
      width: 100%; box-sizing: border-box;
      background: var(--card); color: var(--text);
      border: 1px solid var(--border); border-radius: 10px;
      padding: 9px 12px; font-size: 13.5px; font-family: inherit;
    }
    .report-select:focus, .report-textarea:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
    .report-textarea { resize: vertical; min-height: 64px; }
    .report-actions { display: flex; gap: 8px; margin-top: 8px; }
    .report-btn {
      flex: 1; padding: 10px 0; border-radius: 10px; border: none;
      font-size: 13.5px; font-weight: 600; cursor: pointer;
      transition: opacity .15s ease;
    }
    .report-btn.cancel { background: var(--card); color: var(--text); border: 1px solid var(--border); }
    .report-btn.submit { background: var(--accent); color: #fff; }
    .report-btn:active { opacity: .8; }

    @media (prefers-reduced-motion: reduce) {
      .update-banner { transition: none !important; }
      .handle, .backdrop, .sheet, .toast, .track, .track::after, .item, .seg button, .report-modal { transition: none !important; }
      .led { animation: none !important; }
    }
  `;

  function themeSetting() { return THEMES.indexOf(config.theme) !== -1 ? config.theme : 'auto'; }
  function effectiveTheme() {
    const t = themeSetting();
    if (t !== 'auto') return t;
    try { return W.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { return 'light'; }
  }
  function updateThemeUI() {
    const eff = effectiveTheme();
    if (themeBtn) {
      clear(themeBtn);
      themeBtn.appendChild(icon(eff === 'dark' ? 'sun' : 'moon'));
      const lbl = eff === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
      themeBtn.setAttribute('aria-label', lbl);
      themeBtn.setAttribute('title', lbl);
    }
    const cur = themeSetting();
    for (const b of segBtns) b.setAttribute('aria-pressed', String(b.dataset.val === cur));
  }
  function applyTheme() {
    if (host) host.setAttribute('data-theme', themeSetting());
    updateThemeUI();
  }
  function setTheme(val) {
    config.theme = THEMES.indexOf(val) !== -1 ? val : 'auto';
    saveConfig();
    applyTheme();
  }

  function loadFab() {
    const s = store.get(K_FAB, null);
    if (s && (s.side === 'l' || s.side === 'r') && typeof s.y === 'number' && isFinite(s.y)) {
      fab = { side: s.side, y: Math.max(0, Math.min(1, s.y)) };
    }
  }
  function applyFab() {
    if (!handleEl) return;
    const vw = D.documentElement.clientWidth || W.innerWidth || 360;
    const vh = W.innerHeight || 640;
    const left = fab.side === 'l' ? FAB_MARGIN : Math.max(FAB_MARGIN, vw - FAB_SIZE - FAB_MARGIN);
    const top = Math.max(FAB_MARGIN, Math.min(vh - FAB_SIZE - FAB_MARGIN, Math.round(fab.y * vh)));
    handleEl.style.left = left + 'px';
    handleEl.style.top = top + 'px';
  }

  function build() {
    if (uiReady && host && host.isConnected) return;
    host = document.createElement('div');
    host.setAttribute('data-nvirya-ui', '');
    host.style.cssText = 'all:initial;';
    root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);

    handleEl = el('div', {
      class: 'handle', role: 'button', tabindex: '0',
      'aria-label': 'nvirya AdGuard', 'aria-haspopup': 'dialog', 'aria-expanded': 'false',
      'data-state': 'ok'
    }, icon('shield'), el('span', { class: 'fab-dot' }));
    root.appendChild(handleEl);

    backdropEl = el('div', { class: 'backdrop', onclick: () => setMenu(false) });
    root.appendChild(backdropEl);

    sheetEl = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Nvirya AdGuard X', 'aria-hidden': 'true', tabindex: '-1' });
    themeBtn = el('button', { class: 'icon-btn', type: 'button', onclick: () => setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark') });
    const closeBtn = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => setMenu(false) }, icon('close'));
    const head = el('div', { class: 'head' },
      el('div', { class: 'titles' },
        el('h1', null, 'Nvirya AdGuard X',
          newBadgeEl = el('span', { class: 'new-badge', 'aria-label': 'There is a new update' }, 'NEW')),
        el('div', { class: 'badge' }, hostname || '(unknown)')
      ),
      el('div', { class: 'head-btns' }, themeBtn, closeBtn)
    );
    grabEl = el('div', { class: 'grab' }, el('div', { class: 'pill' }), head);
    bodyEl = el('div', { class: 'body' });
    sheetEl.appendChild(grabEl);
    sheetEl.appendChild(bodyEl);
    root.appendChild(sheetEl);

    toastEl = el('div', { class: 'toast', role: 'status' });
    root.appendChild(toastEl);

    updateEl = el('div', { class: 'update-banner', role: 'alert', 'aria-hidden': 'true' },
      el('div', { class: 'ub-row' },
        el('span', { class: 'tile t-blue ub-icon' }, icon('download')),
        el('div', { class: 'ub-txt' },
          ubTitleEl = el('div', { class: 'ub-title' }, 'There is a new update!'),
          el('div', { class: 'ub-desc' }, 'The update helps improve the ability to block ads.')
        ),
        el('button', { class: 'icon-btn ub-close', type: 'button', 'aria-label': 'Để sau', onclick: () => dismissUpdateBanner() }, icon('close'))
      ),
			el('div', { class: 'ub-actions' },
        el('button', { class: 'ub-btn later', type: 'button', onclick: () => dismissUpdateBanner() }, 'Để sau'),
        el('a', { class: 'ub-btn go', href: STAY_INSTALL_URL,
          onclick: () => { Updater.snooze(); hideUpdateBanner(); 
          } 
        }, 'Cập nhật ngay')
      )
    );
    root.appendChild(updateEl);

    (D.documentElement || D.body).appendChild(host);

    loadFab();
    updateAvailable = Updater.getAvailable();
    buildBody();
    applyTheme();
    applyFab();
    applyUpdateBadge();

    if (!config.showFloatingButton) handleEl.classList.add('hidden');

    wireHandle();
    wireSheet();

    try {
      const mq = W.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', updateThemeUI);
      else if (mq.addListener) mq.addListener(updateThemeUI);
    } catch (e) {}
    try {
      W.addEventListener('resize', applyFab, { passive: true });
      W.addEventListener('orientationchange', () => setTimeout(applyFab, 200), { passive: true });
    } catch (e) {}

    uiReady = true;
  }

  function sectionTitle(t) { return el('div', { class: 'sec-title' }, t); }

  function item(o) {
    const b = el('button', { class: 'item' + (o.danger ? ' danger' : ''), type: 'button', onclick: o.onclick });
    if (o.tone) b.appendChild(el('span', { class: 'tile t-' + o.tone }, icon(o.icon)));
    const txt = el('span', { class: 'txt' }, el('span', { class: 'lbl' }, o.label || ''));
    txt.appendChild(el('span', { class: 'sub' }, o.sub || ''));
    b.appendChild(txt);
    if (o.chevron) b.appendChild(icon('chevron', 'chev'));
    if (o.role) b.dataset.role = o.role;
    return b;
  }

  function setStatsMode(mode) {
    statsMode = mode;
    if (segSessionBtn) segSessionBtn.setAttribute('aria-pressed', String(mode === 'session'));
    if (segLifetimeBtn) segLifetimeBtn.setAttribute('aria-pressed', String(mode === 'lifetime'));
    renderStats();
  }

  function buildBody() {
    clear(bodyEl);

    statusEl = el('div', { class: 'status' });
    bodyEl.appendChild(statusEl);

    bodyEl.appendChild(sectionTitle('Blocked Stats'));
    const statSeg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Stats Mode', style: { marginBottom: '8px' } });
    segSessionBtn = el('button', { type: 'button', 'aria-pressed': 'true', onclick: () => setStatsMode('session') }, 'This Page');
    segLifetimeBtn = el('button', { type: 'button', 'aria-pressed': 'false', onclick: () => setStatsMode('lifetime') }, 'All Time');
    statSeg.appendChild(segSessionBtn);
    statSeg.appendChild(segLifetimeBtn);
    bodyEl.appendChild(statSeg);

    statsEl = el('div', { class: 'stats' });
    bodyEl.appendChild(statsEl);

    bodyEl.appendChild(sectionTitle('Actions'));
    const actions = el('div', { class: 'group icons' });

    actions.appendChild(item({ role: 'wl', tone: 'green', icon: 'allow', chevron: true, onclick: () => {
      if (isWhitelisted(hostname)) { removeWhitelist(hostname); toast('Removed from whitelist'); }
      else { addWhitelist(hostname); toast('Whitelisted for this site'); }
      renderStatus(); refreshProtection();
    }}));
    actions.appendChild(item({ role: 'td', tone: 'orange', icon: 'pause', chevron: true, onclick: () => {
      if (state.sessionDisabled[hostname]) { delete state.sessionDisabled[hostname]; persistSession(); toast('Protection enabled for this session'); }
      else { state.sessionDisabled[hostname] = true; persistSession(); toast('Disabled for this session'); }
      renderStatus(); refreshProtection();
    }}));
    actions.appendChild(item({ label: 'Block element', sub: 'Pick an element to hide on this site', tone: 'blue', icon: 'target', chevron: true,
      onclick: () => { setMenu(false); enterPicker(); } }));
    actions.appendChild(item({ label: 'Clean page', sub: 'Hide leftover ad frames now', tone: 'purple', icon: 'wand', chevron: true,
      onclick: () => { cleanPage(); toast('Page cleaned'); } }));
    actions.appendChild(item({ label: 'Report broken / Missed ad', sub: 'Report missed ads or page breakage', tone: 'orange', icon: 'flag', chevron: true,
      onclick: () => openReportModal() }));
    actions.appendChild(item({ label: 'Undo last block', sub: 'Restore the last removed element', tone: 'gray', icon: 'undo', chevron: true,
      onclick: () => undoLast() }));
    bodyEl.appendChild(actions);

    bodyEl.appendChild(sectionTitle('Settings'));
    const themeGroup = el('div', { class: 'group pad' });
    const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Theme' });
    segBtns = [];
    for (const [val, label] of [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]) {
      const b = el('button', { type: 'button', onclick: () => setTheme(val) }, label);
      b.dataset.val = val;
      segBtns.push(b);
      seg.appendChild(b);
    }
    themeGroup.appendChild(seg);
    bodyEl.appendChild(themeGroup);

    const toggles = [
      ['enabled', 'Protection'],
      ['popupProtection', 'Popup blocking'],
      ['redirectProtection', 'Redirect protection'],
      ['cosmeticFiltering', 'Cosmetic filtering'],
      ['playerProtection', 'Player protection'],
      ['antiAdblock', 'Anti-adblock cleanup'],
      ['strictMode', 'Strict mode'],
      ['showFloatingButton', 'Show floating button'],
      ['debug', 'Debug logging'],
    ];
    const swGroup = el('div', { class: 'group' });
    for (const [k, label] of toggles) {
      const row = el('label', { class: 'item' });
      row.appendChild(el('span', { class: 'txt' }, el('span', { class: 'lbl' }, label)));
      const inp = el('input', { type: 'checkbox', role: 'switch' });
      inp.checked = !!config[k];
      inp.addEventListener('change', () => {
        config[k] = inp.checked;
        if (k === 'showFloatingButton') {
          config.edgeHandle = inp.checked;
          if (handleEl) handleEl.classList.toggle('hidden', !inp.checked);
        }
        saveConfig();
        if (k === 'enabled' || k === 'cosmeticFiltering' || k === 'redirectProtection') refreshProtection();
        renderStatus(); renderStats();
      });
      row.appendChild(el('span', { class: 'switch' }, inp, el('span', { class: 'track' })));
      swGroup.appendChild(row);
    }
    bodyEl.appendChild(swGroup);

    bodyEl.appendChild(sectionTitle('Backup & Share Rules'));
    const shareGroup = el('div', { class: 'group icons' });
    shareGroup.appendChild(item({
      label: 'Export Rules',
      sub: 'Copy custom site rules to clipboard',
      tone: 'blue',
      icon: 'copy',
      chevron: true,
      onclick: () => exportSiteRules()
    }));
    shareGroup.appendChild(item({
      label: 'Import Rules',
      sub: 'Merge rules from JSON or Base64',
      tone: 'purple',
      icon: 'download',
      chevron: true,
      onclick: () => importSiteRules()
    }));
    bodyEl.appendChild(shareGroup);

    bodyEl.appendChild(sectionTitle('Data'));
    const data = el('div', { class: 'group' });
    data.appendChild(item({ role: 'upd', label: 'Check for updates', sub: 'Current version v' + VERSION,
      onclick: () => Updater.check(true) }));
    data.appendChild(item({ label: 'Reset settings', sub: 'Restore the default options', danger: true, onclick: () => {
      if (!confirm('Reset all settings to defaults?')) return;
      config = Object.assign({}, DEFAULT_CONFIG);
      saveConfig(); buildBody(); applyTheme();
      if (handleEl) handleEl.classList.toggle('hidden', !config.showFloatingButton);
      refreshProtection(); toast('Settings reset');
    }}));
    data.appendChild(item({ label: 'Clear statistics', sub: 'Set all counters back to zero', danger: true, onclick: () => {
      if (!confirm('Clear all lifetime and session statistics?')) return;
      stats.reset(); renderStats(); toast('Stats cleared');
    }}));
    data.appendChild(item({ label: 'Reset site rules', sub: 'Remove all blocked elements on this site', danger: true, onclick: () => {
      if (!confirm('Clear all manual rules for this site?')) return;
      delete state.siteRules[hostname]; persistSiteRules(); toast('Site rules cleared'); onLocationChange();
    }}));
    bodyEl.appendChild(data);

    bodyEl.appendChild(sectionTitle('Debug'));
    const dbg = el('div', { class: 'group icons' });
    dbg.appendChild(item({ label: 'Copy debug info', sub: 'Copy diagnostics to the clipboard', tone: 'gray', icon: 'copy', onclick: () => {
      const info = collectDebugInfo();
      try { navigator.clipboard.writeText(info); toast('Debug info copied'); } catch (e) { console.log(info); toast('Logged to console'); }
    }}));
    bodyEl.appendChild(dbg);

    bodyEl.appendChild(el('div', { class: 'footer' }, 'Nvirya AdGuard X v' + VERSION));

    updateThemeUI();
    renderStatus(); renderStats();
    renderUpdateItem();
  }

  function renderUpdateItem() {
    if (!bodyEl) return;
    const b = bodyEl.querySelector('[data-role="upd"]');
    if (!b) return;
    const s = b.querySelector('.sub');
    if (!s) return;
    if (updateChecking) s.textContent = 'Checking...';
    else if (updateAvailable) s.textContent = 'There is a new version v' + updateAvailable + ' (now v' + VERSION + ')';
    else s.textContent = 'Current version v' + VERSION;
  }
  function applyUpdateBadge() {
    if (newBadgeEl) newBadgeEl.classList.toggle('show', !!updateAvailable);
  }
  function setUpdateAvailable(ver) {
    updateAvailable = ver || null;
    applyUpdateBadge();
    renderUpdateItem();
  }
  function setUpdateChecking(on) {
    updateChecking = !!on;
    renderUpdateItem();
  }
  function showUpdateBanner(ver) {
    if (!updateEl) return;
    if (ver) setUpdateAvailable(ver);
    if (!updateAvailable) return;
    if (ubTitleEl) ubTitleEl.textContent = 'There is a new update! (v' + updateAvailable + ')';
    updateEl.classList.add('show');
    updateEl.setAttribute('aria-hidden', 'false');
  }
  function hideUpdateBanner() {
    if (!updateEl) return;
    updateEl.classList.remove('show');
    updateEl.setAttribute('aria-hidden', 'true');
  }
  function dismissUpdateBanner() {
    Updater.snooze();
    hideUpdateBanner();
  }

  function renderStatus() {
    let tone = 'ok', label = 'Protected', sub = 'Blocking ads, popups and redirects';
    if (!config.enabled) { tone = 'off'; label = 'Disabled (global)'; sub = 'Turn on Protection in Settings to resume'; }
    else if (state.sessionDisabled[hostname]) { tone = 'warn'; label = 'Disabled for this session'; sub = 'Blocking is paused on this site'; }
    else if (isWhitelisted(hostname)) { tone = 'warn'; label = 'Whitelisted'; sub = 'This site is allowed to show ads'; }

    if (handleEl) handleEl.setAttribute('data-state', tone);
    if (!statusEl || !bodyEl) return;

    clear(statusEl);
    statusEl.appendChild(el('span', { class: 'led' + (tone === 'ok' ? '' : ' ' + tone) }));
    statusEl.appendChild(el('div', null,
      el('div', { class: 't' }, label),
      el('div', { class: 's' }, sub)
    ));

    const setItem = (role, label2, sub2) => {
      const b = bodyEl.querySelector('[data-role="' + role + '"]');
      if (!b) return;
      const l = b.querySelector('.lbl'), s = b.querySelector('.sub');
      if (l) l.textContent = label2;
      if (s) s.textContent = sub2;
    };
    const wl = isWhitelisted(hostname);
    setItem('wl', wl ? 'Remove from whitelist' : 'Do not block this site',
      wl ? 'Resume blocking on this site' : 'Always allow this site to run unfiltered');
    const sd = !!state.sessionDisabled[hostname];
    setItem('td', sd ? 'Enable for this session' : 'Disable for this session',
      sd ? 'Turn blocking back on' : 'Pause blocking on this site');
  }

  function renderStats() {
    if (!statsEl) return;
    const currentData = statsMode === 'session' ? stats.session : stats.lifetime;
    const secondaryData = statsMode === 'session' ? stats.lifetime : stats.session;
    const secLabel = statsMode === 'session' ? 'All-time: ' : 'This page: ';

    const rows = [
      ['Ads removed', currentData.ads, secondaryData.ads],
      ['Elements hidden', currentData.hidden, secondaryData.hidden],
      ['Popups blocked', currentData.popups, secondaryData.popups],
      ['Redirects blocked', currentData.redirects, secondaryData.redirects],
      ['Requests blocked', currentData.requests, secondaryData.requests],
    ];

    if (statsEl.childNodes.length !== rows.length) {
      clear(statsEl);
      for (const r of rows) {
        const statCard = el('div', { class: 'stat' },
          el('b', null, fmt(r[1])),
          el('span', null, r[0]),
          el('small', { class: 'stat-sub' }, secLabel + fmt(r[2]))
        );
        statsEl.appendChild(statCard);
      }
    } else {
      rows.forEach((r, i) => {
        const card = statsEl.childNodes[i];
        const b = card.childNodes[0];
        const span = card.childNodes[1];
        const sub = card.childNodes[2];
        const valStr = fmt(r[1]);
        const subStr = secLabel + fmt(r[2]);
        if (b.textContent !== valStr) b.textContent = valStr;
        if (span.textContent !== r[0]) span.textContent = r[0];
        if (sub && sub.textContent !== subStr) sub.textContent = subStr;
      });
    }
  }

  function setMenu(open) {
    if (!sheetEl) return;
    menuOpen = !!open;
    sheetEl.classList.toggle('open', menuOpen);
    backdropEl.classList.toggle('open', menuOpen);
    if (handleEl) {
      handleEl.classList.toggle('away', menuOpen);
      handleEl.setAttribute('aria-expanded', String(menuOpen));
    }
    sheetEl.setAttribute('aria-hidden', String(!menuOpen));
    if (statsTimer) { clearInterval(statsTimer); statsTimer = null; }
    if (menuOpen) {
      renderStatus(); renderStats(); updateThemeUI();
      statsTimer = setInterval(renderStats, 1000);
      try { sheetEl.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  function wireHandle() {
    let drag = null;
    handleEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const r = handleEl.getBoundingClientRect();
      drag = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
      try { handleEl.setPointerCapture(e.pointerId); } catch (er) {}
    });
    handleEl.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < 6) return;
        drag.moved = true;
        handleEl.classList.add('dragging');
      }
      const vw = D.documentElement.clientWidth || W.innerWidth;
      const vh = W.innerHeight;
      handleEl.style.left = Math.max(4, Math.min(vw - FAB_SIZE - 4, drag.ox + dx)) + 'px';
      handleEl.style.top = Math.max(4, Math.min(vh - FAB_SIZE - 4, drag.oy + dy)) + 'px';
    });
    const endDrag = (e, cancelled) => {
      if (!drag) return;
      const d = drag; drag = null;
      handleEl.classList.remove('dragging');
      try { handleEl.releasePointerCapture(e.pointerId); } catch (er) {}
      if (d.moved) {
        const r = handleEl.getBoundingClientRect();
        const vw = D.documentElement.clientWidth || W.innerWidth;
        const vh = W.innerHeight || 1;
        fab = { side: (r.left + r.width / 2) < vw / 2 ? 'l' : 'r', y: Math.max(0, Math.min(1, r.top / vh)) };
        store.set(K_FAB, fab);
        applyFab();
      } else if (!cancelled) {
        setMenu(!menuOpen);
      }
    };
    handleEl.addEventListener('pointerup', (e) => endDrag(e, false));
    handleEl.addEventListener('pointercancel', (e) => endDrag(e, true));
    handleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMenu(!menuOpen); }
    });

    D.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (pickerActive) exitPicker(true);
        else if (reportModalEl && reportModalEl.classList.contains('open')) closeReportModal();
        else if (menuOpen) setMenu(false);
      }
    }, true);
  }

  function isSheetMode() {
    try { return !W.matchMedia('(min-width: 641px)').matches; } catch (e) { return (W.innerWidth || 0) <= 640; }
  }

  function wireSheet() {
    let tracking = false, dragging = false, fromGrab = false;
    let x0 = 0, y0 = 0, t0 = 0, dy = 0;

    const reset = () => {
      sheetEl.style.transition = '';
      sheetEl.style.transform = '';
      backdropEl.style.transition = '';
      backdropEl.style.opacity = '';
    };

    sheetEl.addEventListener('touchstart', (e) => {
      if (!menuOpen || !isSheetMode() || !e.touches || e.touches.length !== 1) { tracking = false; return; }
      tracking = true; dragging = false; dy = 0;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
      fromGrab = !!(grabEl && grabEl.contains(e.target));
    }, { passive: true });

    sheetEl.addEventListener('touchmove', (e) => {
      if (!tracking || !e.touches || !e.touches.length) return;
      const x = e.touches[0].clientX, y = e.touches[0].clientY;
      const rawY = y - y0, rawX = x - x0;
      if (!dragging) {
        if (Math.abs(rawX) > Math.abs(rawY) && Math.abs(rawX) > 8) { tracking = false; return; }
        if (rawY < -6) { tracking = false; return; }
        if (rawY <= 6) return;
        if (!fromGrab && bodyEl.scrollTop > 0) { tracking = false; return; }
        dragging = true;
        sheetEl.style.transition = 'none';
        backdropEl.style.transition = 'none';
      }
      dy = Math.max(0, rawY);
      sheetEl.style.transform = 'translateY(' + dy + 'px)';
      const h = sheetEl.offsetHeight || 1;
      backdropEl.style.opacity = String(Math.max(0, 1 - dy / h));
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    const finish = () => {
      if (!tracking) return;
      tracking = false;
      if (!dragging) return;
      dragging = false;
      const h = sheetEl.offsetHeight || 1;
      const velocity = dy / Math.max(1, Date.now() - t0);
      const close = dy > h * 0.25 || (velocity > 0.5 && dy > 30);
      reset();
      if (close) setMenu(false);
    };
    sheetEl.addEventListener('touchend', finish, { passive: true });
    sheetEl.addEventListener('touchcancel', finish, { passive: true });
  }

  function toast(msg) {
    if (!toastEl) return;
    if (msg === lastToast && toastTimer) return;
    lastToast = msg;
    toastEl.textContent = msg;
    toastEl.classList.toggle('top', menuOpen);
    toastEl.style.top = (menuOpen && updateEl && updateEl.classList.contains('show'))
      ? 'calc(' + (updateEl.offsetHeight + 22) + 'px + env(safe-area-inset-top, 0px))' : '';
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.classList.remove('show'); toastTimer = null; lastToast = ''; }, 2200);
  }

  function updateUIStatus() { renderStatus(); renderStats(); }

  function buildReportModal() {
    if (reportModalEl) return;

    const closeBtn = el('button', {
      class: 'icon-btn',
      type: 'button',
      'aria-label': 'Close',
      onclick: () => closeReportModal()
    }, icon('close'));

    const head = el('div', { class: 'report-head' },
      el('div', { class: 'titles' },
        el('h2', null, 'Report an incident'),
        el('div', { class: 'badge', style: { marginTop: '2px' } }, hostname || '(unknown)')
      ),
      closeBtn
    );

    reportReasonSelect = el('select', { class: 'report-select' },
      el('option', { value: 'Lọt quảng cáo (Missed ad)' }, 'Lọt quảng cáo (Missed ad)'),
      el('option', { value: 'Lỗi giao diện (Broken layout)' }, 'Lỗi giao diện (Broken layout)'),
      el('option', { value: 'Lỗi phát video (Player issue)' }, 'Lỗi phát video (Player issue)'),
      el('option', { value: 'Khác (Other)' }, 'Khác (Other)')
    );

    reportNoteInput = el('textarea', {
      class: 'report-textarea',
      placeholder: 'Note more about the location of advertising...',
      rows: '3'
    });

    const cancelBtn = el('button', {
      class: 'report-btn cancel',
      type: 'button',
      onclick: () => closeReportModal()
    }, 'Hủy');

    const submitBtn = el('button', {
      class: 'report-btn submit',
      type: 'button',
      onclick: () => submitReport()
    }, 'Send a report');

    const actions = el('div', { class: 'report-actions' }, cancelBtn, submitBtn);

    const card = el('div', { class: 'report-card' },
      head,
      el('div', { class: 'report-lbl' }, 'Reason:'),
      reportReasonSelect,
      el('div', { class: 'report-lbl' }, 'Notes (optional):'),
      reportNoteInput,
      actions
    );

    reportModalEl = el('div', { class: 'report-modal' }, card);
    root.appendChild(reportModalEl);
  }

  function openReportModal() {
    if (!reportModalEl) buildReportModal();
    if (reportNoteInput) reportNoteInput.value = '';
    reportModalEl.classList.add('open');
  }

  function closeReportModal() {
    if (reportModalEl) reportModalEl.classList.remove('open');
  }

  function submitReport() {
    const lastMap = store.get(K_LAST_REP, {}) || {};
    const lastTime = lastMap[hostname] || 0;
    const elapsed = Date.now() - lastTime;
    if (elapsed < 30000) {
      const waitSec = Math.ceil((30000 - elapsed) / 1000);
      toast(`Please wait ${waitSec}s before sending again`);
      return;
    }

    const webhookUrl = getWebhookTarget();
    if (!webhookUrl) {
      toast('Have not configured a valid webhook in the script');
      closeReportModal();
      return;
    }

    const reason = (reportReasonSelect && reportReasonSelect.value) || 'Missed ad';
    const note = (reportNoteInput && reportNoteInput.value.trim()) || '';
    const cleanUrl = getSanitizedUrl();
    const recentLogs = logRing.slice(-5).map(e => `[${e.level}] ${e.type}: ${e.msg} ${e.extra || ''}`).join('\n') || 'There is no log';

    const payload = {
      username: 'Nvirya AdGuard Reporter',
      avatar_url: 'https://raw.nvirya.com/assets/icon.png',
      embeds: [
        {
          title: 'Báo cáo sự cố: ' + reason,
          color: reason.includes('Lọt') ? 15158332 : 16107018,
          fields: [
            { name: 'Domain', value: hostname || 'unknown', inline: true },
            { name: 'Phiên bản', value: 'v' + VERSION, inline: true },
            { name: 'Lý do', value: reason, inline: true },
            { name: 'URL (Sanitized)', value: cleanUrl },
            { name: 'Ghi chú', value: note || '(Không có)' },
            {
              name: 'Thống kê chặn',
              value: `• **Phiên hiện tại (Session):** Chặn ${stats.session.ads} ads, Ẩn ${stats.session.hidden} el, Chặn ${stats.session.popups} popups\n• **Tổng tích lũy (Lifetime):** Chặn ${stats.lifetime.ads} ads, Ẩn ${stats.lifetime.hidden} el`
            },
            { name: 'Logs gần nhất', value: '```text\n' + recentLogs + '\n```' },
            { name: 'User Agent', value: '```\n' + (navigator.userAgent || 'unknown').slice(0, 220) + '\n```' }
          ],
          footer: { text: 'Nvirya AdGuard Security Report' },
          timestamp: new Date().toISOString()
        }
      ]
    };

    const onSuccess = () => {
      lastMap[hostname] = Date.now();
      store.set(K_LAST_REP, lastMap);
      toast('The report has been sent successfully! Thank you.');
      closeReportModal();
    };

    const onError = (msg) => {
      toast('Send failed: ' + (msg || 'Connection error'));
    };

    const bodyStr = JSON.stringify(payload);
    if (typeof GM_xmlhttpRequest === 'function') {
      GM_xmlhttpRequest({
        method: 'POST',
        url: webhookUrl,
        headers: { 'Content-Type': 'application/json' },
        data: bodyStr,
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) onSuccess();
          else onError('HTTP ' + res.status);
        },
        onerror: (err) => onError((err && err.statusText) || 'CORS / Network error')
      });
    } else {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr
      }).then(res => {
        if (res.ok) onSuccess();
        else onError('HTTP ' + res.status);
      }).catch(err => onError(err && err.message));
    }
  }

  function exportSiteRules() {
    const rules = state.siteRules || {};
    let totalRules = 0;
    for (const h in rules) if (Array.isArray(rules[h])) totalRules += rules[h].length;
    if (totalRules === 0) {
      toast('There are no optional rules to export yet');
      return;
    }
    const jsonStr = JSON.stringify(rules);
    let payload = jsonStr;
    try {
      payload = btoa(unescape(encodeURIComponent(jsonStr)));
    } catch (e) {
      payload = jsonStr;
    }

    const fallback = () => prompt('Copy rule code (Base64/JSON):', payload);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(payload).then(() => {
          toast(`Đã sao chép ${totalRules} Rules on Clipboard!`);
        }).catch(fallback);
      } else {
        fallback();
      }
    } catch (e) { fallback(); }
  }

  function importSiteRules() {
    const input = prompt('Paste the rule chain (JSON or Base64):');
    if (!input || !input.trim()) return;
    const raw = input.trim();
    let parsed = null;

    try {
      const decoded = decodeURIComponent(escape(atob(raw)));
      parsed = JSON.parse(decoded);
    } catch (e) {
      try { parsed = JSON.parse(raw); } catch (e2) {}
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      toast('Invalid rule format');
      return;
    }

    let mergedCount = 0;
    if (!state.siteRules) state.siteRules = {};

    for (const host of Object.keys(parsed)) {
      const hostRules = parsed[host];
      if (!Array.isArray(hostRules)) continue;
      const normHost = host.toLowerCase().trim();
      if (!state.siteRules[normHost]) state.siteRules[normHost] = [];

      const existingSelectors = new Set(state.siteRules[normHost].map(r => r.selector));
      for (const rule of hostRules) {
        if (rule && rule.selector && !existingSelectors.has(rule.selector)) {
          state.siteRules[normHost].push({
            selector: rule.selector,
            action: rule.action || 'hide',
            created: rule.created || Date.now()
          });
          existingSelectors.add(rule.selector);
          mergedCount++;
        }
      }
    }

    persistSiteRules();
    installSiteRulesCSS();
    initialScan();
    toast(`Successfully merged ${mergedCount} new rule!`);
  }

  function buildPicker() {
    if (pickerEl) return;
    pickerEl = document.createElement('div');
    pickerEl.setAttribute('data-nvirya-picker','');
    pickerEl.style.cssText = 'position:fixed;z-index:2147483003;pointer-events:none;border:2px solid #3b82f6;background:rgba(59,130,246,.1);border-radius:3px;transition:all .05s linear;box-sizing:border-box;';
    pickerLabelEl = document.createElement('div');
    pickerLabelEl.style.cssText = 'position:fixed;z-index:2147483004;pointer-events:none;background:#0b0b0d;color:#f4f4f5;font:11px system-ui,-apple-system,sans-serif;padding:3px 7px;border-radius:4px;border:1px solid rgba(255,255,255,.1);white-space:nowrap;';
    (D.body || D.documentElement).appendChild(pickerEl);
    (D.body || D.documentElement).appendChild(pickerLabelEl);
    pickerBarEl = document.createElement('div');
    pickerBarEl.setAttribute('data-nvirya-picker', '');
    pickerBarEl.setAttribute('role', 'toolbar');
    pickerBarEl.setAttribute('aria-label', 'Element picker navigation');
    pickerBarEl.style.cssText = 'position:fixed;display:none;align-items:center;gap:5px;padding:6px;z-index:2147483005;pointer-events:auto;background:#111827;color:#fff;border:1px solid rgba(255,255,255,.22);border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.35);font:12px system-ui,-apple-system,sans-serif;white-space:nowrap;';
    const buttonStyle = 'border:0;border-radius:6px;padding:7px 9px;background:#273449;color:#fff;font:inherit;cursor:pointer;touch-action:manipulation;';
    const parentBtn = el('button', { type: 'button', style: { cssText: buttonStyle }, onclick: () => traversePicker(-1) }, 'Parent');
    const childBtn = el('button', { type: 'button', style: { cssText: buttonStyle }, onclick: () => traversePicker(1) }, 'Child');
    const blockBtn = el('button', { type: 'button', style: { cssText: buttonStyle + 'background:#2563eb;', onclick: () => confirmPickerSelection() }, 'aria-label': 'Block selected element' }, 'Block');
    const cancelBtn = el('button', { type: 'button', style: { cssText: buttonStyle + 'background:#374151;', onclick: () => exitPicker(false) } }, 'Cancel');
    pickerBarEl.append(parentBtn, childBtn, blockBtn, cancelBtn);
    (root || D.documentElement).appendChild(pickerBarEl);
  }

  function enterPicker() {
    if (!config.elementPicker) return;
    buildPicker();
    pickerActive = true;
    pickerEl.style.display = 'block';
    pickerLabelEl.style.display = 'block';
    if (pickerBarEl) pickerBarEl.style.display = 'none';
    pickerTarget = null;
    D.addEventListener('mousemove', pickerMove, true);
    D.addEventListener('click', pickerClick, true);
    D.addEventListener('touchmove', pickerTouchMove, true);
    D.addEventListener('touchend', pickerTouchEnd, true);
    toast('Tap an element to block');
  }

  function exitPicker(silent) {
    pickerActive = false;
    if (pickerEl) pickerEl.style.display = 'none';
    if (pickerLabelEl) pickerLabelEl.style.display = 'none';
    if (pickerBarEl) pickerBarEl.style.display = 'none';
    pickerTarget = null;
    D.removeEventListener('mousemove', pickerMove, true);
    D.removeEventListener('click', pickerClick, true);
    D.removeEventListener('touchmove', pickerTouchMove, true);
    D.removeEventListener('touchend', pickerTouchEnd, true);
    if (!silent) toast('Picker closed');
  }

  function describe(el) {
    if (!el) return '';
    const tag = (el.tagName || '').toLowerCase();
    const id = el.id && isStableToken(el.id) ? '#' + el.id : '';
    const stable = classString(el).split(/\s+/).filter(isStableClassToken).slice(0, 1);
    const cls = stable.length ? '.' + stable[0] : '';
    return tag + id + cls;
  }

  function showPickerTarget(el) {
    if (!el || el.nodeType !== 1 || isNviryaNode(el)) return;
    pickerTarget = el;
    pickerHover = el;
    const rect = el.getBoundingClientRect();
    pickerEl.style.left = rect.left + 'px';
    pickerEl.style.top = rect.top + 'px';
    pickerEl.style.width = rect.width + 'px';
    pickerEl.style.height = rect.height + 'px';
    pickerLabelEl.textContent = describe(el);
    pickerLabelEl.style.left = Math.max(4, rect.left) + 'px';
    pickerLabelEl.style.top = Math.max(4, rect.top - 22) + 'px';
    const buttons = pickerBarEl ? pickerBarEl.querySelectorAll('button') : [];
    if (buttons.length >= 4) {
      const tag = String(el.tagName || '').toLowerCase();
      buttons[0].disabled = !el.parentElement || /^(?:body|html)$/.test(String(el.parentElement.tagName || '').toLowerCase());
      buttons[1].disabled = !el.firstElementChild;
    }
    if (pickerBarEl) {
      pickerBarEl.style.display = 'flex';
      const left = Math.max(6, Math.min((W.innerWidth || 320) - 250, rect.left));
      const top = rect.bottom + 10 + 52 < (W.innerHeight || 480) ? rect.bottom + 10 : Math.max(6, rect.top - 58);
      pickerBarEl.style.left = left + 'px';
      pickerBarEl.style.top = top + 'px';
    }
  }

  function pickerMove(e) {
    if (!pickerActive) return;
    if (pickerTarget) return;
    if (e.composedPath && e.composedPath().indexOf(host) !== -1) return;
    const el = D.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === pickerEl || el === pickerLabelEl) return;
    if (el === pickerHover && pickerTarget) return;
    pickerHover = el;
    const r = el.getBoundingClientRect();
    pickerEl.style.left = r.left + 'px';
    pickerEl.style.top = r.top + 'px';
    pickerEl.style.width = r.width + 'px';
    pickerEl.style.height = r.height + 'px';
    pickerLabelEl.textContent = describe(el);
    pickerLabelEl.style.left = Math.max(4, r.left) + 'px';
    pickerLabelEl.style.top = Math.max(4, r.top - 22) + 'px';
  }

  function pickerTouchMove(e) {
    if (!e.touches || e.touches.length !== 1) return;
    pickerMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
  }

  function pickerTouchEnd(e) {
    if (e.composedPath && e.composedPath().indexOf(host) !== -1) return;
    if (!e.changedTouches || !e.changedTouches.length) return;
    const t = e.changedTouches[0];
    const el = D.elementFromPoint(t.clientX, t.clientY);
    if (el) {
      e.preventDefault();
      e.stopPropagation();
      lastPickerTouchAt = Date.now();
      selectElement(el);
    }
  }

  function pickerClick(e) {
    if (!pickerActive) return;
    if (e.composedPath && e.composedPath().indexOf(host) !== -1) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (Date.now() - lastPickerTouchAt < 650) return;
    const el = D.elementFromPoint(e.clientX, e.clientY);
    if (el) selectElement(el);
  }

  function isStableToken(value) {
    const token = String(value || '');
    if (!token || token.length > 64) return false;
    if (/^(?:css|sc|jss|jsx|emotion|chakra|tw)[-_][a-z0-9_-]*\d[a-z0-9_-]*$/i.test(token)) return false;
    if (/(?:^|[-_])[a-f0-9]{8,}(?:$|[-_])/i.test(token)) return false;
    if (/^[a-z0-9_-]{20,}$/i.test(token)) return false;
    return /^[a-zA-Z_][\w-]*$/.test(token);
  }

  function isStableClassToken(token) {
    return isStableToken(token) && !/^(?:tw|css|sc|jss|jsx|emotion|chakra)[-_]/i.test(token);
  }

  function makeSelector(el, depth) {
    if (!el || el.nodeType !== 1) return null;
    const tag = String(el.tagName || '').toLowerCase();
    if (/^(?:html|body)$/.test(tag)) return tag;
    depth = depth || 0;
    const unique = function (selector) {
      try { return D.querySelectorAll(selector).length === 1; } catch (e) { return false; }
    };
    const quote = function (value) { return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); };
    const identity = [];
    if (el.id && isStableToken(el.id)) identity.push('#' + (W.CSS && W.CSS.escape ? W.CSS.escape(el.id) : el.id));
    for (const name of ['data-testid', 'data-test', 'data-qa', 'data-cy', 'data-id', 'role', 'aria-label', 'name', 'title']) {
      const value = el.getAttribute(name);
      if (value && value.length <= 100) identity.push(tag + '[' + name + '="' + quote(value) + '"]');
    }
    for (const selector of identity) if (unique(selector)) return selector;
    const stableClasses = classString(el).split(/\s+/).filter(isStableClassToken).slice(0, 2);
    for (let count = stableClasses.length; count > 0; count--) {
      const selector = tag + stableClasses.slice(0, count).map(function (token) {
        return '.' + (W.CSS && W.CSS.escape ? W.CSS.escape(token) : token.replace(/[^a-zA-Z0-9_-]/g, '\\$&'));
      }).join('');
      if (unique(selector)) return selector;
    }

    const parent = el.parentElement;
    if (!parent || depth >= 6) return tag;
    let index = 0;
    for (const sibling of parent.children) {
      if (String(sibling.tagName).toLowerCase() === tag) index++;
      if (sibling === el) break;
    }
    const local = tag + ':nth-of-type(' + Math.max(1, index) + ')';
    const parentSelector = makeSelector(parent, depth + 1) || String(parent.tagName || 'body').toLowerCase();
    const path = parentSelector + ' > ' + local;
    return unique(path) ? path : path;
  }

  function selectElement(el) {
    if (!el || el.nodeType !== 1 || isNviryaNode(el)) return;
    showPickerTarget(el);
  }

  function traversePicker(direction) {
    if (!pickerTarget) return;
    const next = direction < 0 ? pickerTarget.parentElement : pickerTarget.firstElementChild;
    if (!next || /^(?:body|html)$/i.test(String(next.tagName || '')) || isNviryaNode(next)) return;
    showPickerTarget(next);
  }

  function confirmPickerSelection() {
    const selected = pickerTarget;
    if (!selected || !selected.isConnected) { toast('Element is no longer on the page'); return; }
    if (isProtectedPlayer(selected) && !confirm('This element belongs to the media player. Blocking can damage video playback. Continue?')) {
      exitPicker(true); return;
    }
    const sel = makeSelector(selected);
    if (!sel) { toast('Không thể tạo selector'); exitPicker(true); return; }
    if (!confirm('Chặn phần tử này trên trang?\n\n' + sel)) { exitPicker(true); return; }
    if (!state.siteRules[hostname]) state.siteRules[hostname] = [];
    state.siteRules[hostname].push({ selector: sel, action: 'hide', created: Date.now() });
    persistSiteRules();
    try {
      selected.setAttribute('data-nvirya-hidden','manual');
      state.hiddenNodes.add(selected);
      stats.inc('hidden');
    } catch (e) {}
    installSiteRulesCSS();
    toast('Đã chặn phần tử');
    exitPicker(true);
  }

  function collectDebugInfo() {
    const lines = [];
    lines.push('Nvirya AdGuard X v' + VERSION);
    lines.push('Host: ' + hostname);
    lines.push('URL: ' + location.href.split('?')[0]);
    lines.push('Enabled: ' + config.enabled);
    lines.push('Whitelisted: ' + isWhitelisted(hostname));
    lines.push('Session-disabled: ' + !!state.sessionDisabled[hostname]);
    lines.push('Strict mode: ' + config.strictMode);
    lines.push('Observer: ' + (observer ? 'active' : 'inactive'));
    lines.push('Queue length: ' + pendingQueue.length);
    lines.push('Stats (Session): ' + JSON.stringify(stats.session));
    lines.push('Stats (Lifetime): ' + JSON.stringify(stats.lifetime));
    lines.push('Recent events:');
    const tail = logRing.slice(-15);
    for (const e of tail) lines.push('  ' + e.level + ' ' + e.type + ' ' + e.msg + (e.extra ? ' ' + e.extra : ''));
    return lines.join('\n');
  }

  return {
    build,
    setMenu,
    setTheme,
    toast,
    enterPicker,
    exitPicker,
    updateUIStatus,
    renderStats,
    showUpdateBanner,
    hideUpdateBanner,
    setUpdateAvailable,
    setUpdateChecking,
    isMenuOpen: () => menuOpen,
    isPickerActive: () => pickerActive
  };
})();

function cleanPage() {
  try {
    const sel = '[id^="google_ads_"], ins.adsbygoogle, iframe[src*="googlesyndication"], iframe[src*="doubleclick"]';
    const list = D.querySelectorAll(sel);
    const lim = Math.min(list.length, 200);
    for (let i = 0; i < lim; i++) {
      const el = list[i];
      if (!isProtectedPlayer(el)) {
        el.setAttribute('data-nvirya-hidden','clean');
        state.hiddenNodes.add(el);
        stats.inc('hidden');
      }
    }
    handleAntiAdblock();
  } catch (e) { log('ERROR','clean', e && e.message); }
}

function undoLast() {
  const last = state.removedNodes.pop();
  if (!last || !last.parent) { UI.toast('Nothing to undo'); return; }
  try {
    if (last.next && last.next.parentNode === last.parent) last.parent.insertBefore(last.el, last.next);
    else last.parent.appendChild(last.el);
    UI.toast('Restored');
  } catch (e) { UI.toast('Could not restore'); }
}

function refreshProtection() {
  if (isDisabledHere()) {
    if (observer) { try { observer.disconnect(); } catch (e) {} observer = null; }
    if (cosmeticStyleEl) cosmeticStyleEl.disabled = true;
  } else {
    if (cosmeticStyleEl) cosmeticStyleEl.disabled = false;
    if (!observer) startObserver();
    initialScan();
  }
  UI.updateUIStatus();
}

function registerMenuCommands() {
  if (typeof GM_registerMenuCommand !== 'function') return;
  try {
    GM_registerMenuCommand('Open Nvirya AdGuard X', () => UI.setMenu(true));
    GM_registerMenuCommand('Disable on this site (session)', () => {
      state.sessionDisabled[hostname] = true; persistSession(); refreshProtection(); UI.toast('Disabled for session');
    });
    GM_registerMenuCommand('Enable on this site', () => {
      delete state.sessionDisabled[hostname]; persistSession(); refreshProtection(); UI.toast('Enabled');
    });
    GM_registerMenuCommand('Block element on this page', () => UI.enterPicker());
    GM_registerMenuCommand('Check for updates', () => Updater.check(true));
    GM_registerMenuCommand('Toggle debug', () => {
      config.debug = !config.debug; saveConfig(); UI.toast('Debug ' + (config.debug ? 'on' : 'off'));
    });
  } catch (e) {}
}

function init() {
  startInvisibleTrapObserver();
  if (!D.documentElement) {
    if (D.readyState === 'loading') {
      D.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      setTimeout(init, 16);
    }
    return;
  }

  if (state.initialized) return;
  state.initialized = true;
	
	installScriptElementGuard();
  installIframePopupGuard();
  defuseGoogleTagManager();
  installPopupGuard();
  installRedirectGuard();
  installNetworkGuard();

  const isTop = (function () {
    try { return W.self === W.top; } catch (e) { return false; }
  })();

  const start = () => {
    installCosmeticCSS();
    installSiteRulesCSS();
    startObserver();
    initialScan();
    scheduleVideoAdScan();

    setTimeout(handleAntiAdblock, 1500);
    setTimeout(handleAntiAdblock, 4000);

    installSPAHooks();

    if (isTop) {
      try { UI.build(); } catch (e) { log('ERROR', 'ui', e && e.message); }
      
      if (!config.showFloatingButton) {
        const h = D.querySelector('[data-nvirya-ui]');
        if (h && h.shadowRoot) {
          const handle = h.shadowRoot.querySelector('.handle');
          if (handle) handle.classList.add('hidden');
        }
      }

      registerMenuCommands();

      try { Updater.schedule(); } catch (e) { log('ERROR', 'update', e && e.message); }

      try {
        D.addEventListener('fullscreenchange', () => {
          const fsEl = D.fullscreenElement;
          const h = D.querySelector('[data-nvirya-ui]');
          if (!h || !h.shadowRoot) return;
          const handle = h.shadowRoot.querySelector('.handle');
          if (!handle) return;
          handle.style.display = fsEl ? 'none' : '';
        });
      } catch (e) {}
    }

    log('INFO', 'init', 'ready v' + VERSION);
  };

  if (D.body) {
    start();
  } else {
    let started = false;
    const triggerStart = () => {
      if (started) return;
      started = true;
      if (bodyObserver) {
        try { bodyObserver.disconnect(); } catch (e) {}
      }
      start();
    };

    let bodyObserver = null;
    try {
      bodyObserver = new MutationObserver(() => {
        if (D.body) triggerStart();
      });
      bodyObserver.observe(D.documentElement, { childList: true });
    } catch (e) {}

    D.addEventListener('DOMContentLoaded', triggerStart, { once: true });
    setTimeout(triggerStart, 1500);
  }
}

try {
  W.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      if (!observer) startObserver();
      installCosmeticCSS();
      installSiteRulesCSS();
    }
  });
} catch (e) {}

try {
  init();
} catch (e) {
  try { console.error('[Nvirya AdGuard X] init failed', e); } catch (e2) {}
}
})();
