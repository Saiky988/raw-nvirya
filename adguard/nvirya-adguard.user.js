// ==UserScript==
// @name         Nvirya AdGuard
// @namespace    https://nvirya.com/adguard
// @version      10.3.0
// @updateURL    https://raw.nvirya.com/adguard/nvirya-adguard.user.js
// @downloadURL  https://raw.nvirya.com/adguard/nvirya-adguard.user.js
// @description  
// @author       Sayra
// @match        *://*/*
// @icon         https://www.nvirya.com/assets/icon.png
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @run-at       document-start
// @all-frames   true
// ==/UserScript==
(function () {
'use strict';

const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
const D = W.document;
if (W.__NVIRYA_ADGUARD_X__) return;
try { Object.defineProperty(W, '__NVIRYA_ADGUARD_X__', { value: true }); } catch (e) { W.__NVIRYA_ADGUARD_X__ = true; }

const VERSION = '10.3.0';
const CONFIG_VERSION = 3;
const K_CFG = 'nvirya_x_config';
const K_WL  = 'nvirya_x_whitelist';
const K_SR  = 'nvirya_x_site_rules';
const K_ST  = 'nvirya_x_stats';
const K_SESS= 'nvirya_x_session';

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

function loadConfig() {
  let cfg = store.get(K_CFG, null);
  if (!cfg || typeof cfg !== 'object') cfg = Object.assign({}, DEFAULT_CONFIG);
  // migrate
  if (cfg.version !== CONFIG_VERSION) {
    cfg = Object.assign({}, DEFAULT_CONFIG, cfg, { version: CONFIG_VERSION });
  } else {
    cfg = Object.assign({}, DEFAULT_CONFIG, cfg);
  }
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
  manualBlocks: new Map(), // hostname -> [{selector, action}]
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

const RE_AD_HOST = /(?:^|\.)(?:doubleclick|googlesyndication|googleadservices|adservice\.google|adsystem\.amazon|adnxs|adsrvr|rubiconproject|pubmatic|openx|criteo|casalemedia|smartadserver|yieldmo|yieldone|360yield|adhese|sharethrough|teads|bidswitch|onetag|zedo|mgid|taboola|outbrain|revcontent|adcash|clickadu|popads|popcash|propellerads|adsterra|ad-maven|admaven|exoclick|juicyads|trafficjunky|onclickmax|adnium|zorvec|hilltopads|clickaine|admicro|adflex|adpia|adtrue|adpushup|ecomobi|innity|komoona|popin|zucks|geniee|vclick|vietad|yeah1ads|adnow|monetag)(?:\.|$)/i;

const RE_GAMBLING_HOST = /(?:^|\.)(?:yo88|hitclub|gemwin|zowin|rikvip|sunwin|debet|3bet|five88|sin88|ball88|sv88|bom88|win79|k8cc|j88|fun88|w88|m88|188bet|fb88|ee88|hi88|go88|nohu|bet88|v9bet|kubet|ku11|ku9|jun88|8xbet|new88|789bet|789club|b52|iwin|man88|hbet|f8bet|bk8|vwin)(?:\.|$)/i;

const RE_AD_PATH = /(?:^|\/)(?:ads?|adserver|adservice|advert|adunit|adframe|popunder|popads|banner[-_]?ads?|ad[-_]?(?:slot|unit|frame|box|banner|container))(?:\/|\.|$)/i;

const RE_AD_TOKEN = /(?:^|[^a-z0-9])(?:ads?|advert|advertis(?:e|ing|ement)|sponsor(?:ed)?[-_](?:ad|box|slot|block|content|unit)|banner[-_]?ads?|ad[-_]?banner|popunder|popup[-_]ad|sticky[-_]ad|interstitial[-_]ad|ad[-_](?:box|slot|unit|zone|block|wrap|holder|container|banner|area|space|placeholder|overlay))(?=[^a-z0-9]|$)/i;

const RE_SIZING = /\b(?:728x90|300x250|320x50|468x60|160x600|300x600|970x250|970x90|336x280|320x100|250x250)\b/i;

const RE_TRACKER = /(?:^|\.)(?:google-analytics|googletagmanager|hotjar|mixpanel|segment\.io|amplitude|fullstory|mouseflow|clarity\.ms)(?:\.|$)/i;

const RE_ANTIADB = /(?:^|[^a-z])(?:adblock|adblocker|adblock[-_]?detect|adblock[-_]?warning|adblock[-_]?modal|blockadblock|adblock-notice)(?:[^a-z]|$)/i;

const TRUSTED_POPUP_HOSTS = [
  'accounts.google.com', 'login.microsoftonline.com', 'login.live.com',
  'appleid.apple.com', 'facebook.com', 'paypal.com', 'stripe.com',
  'checkout.stripe.com', 'amazon.com', 'github.com', 'okta.com',
  'auth0.com', 'onelogin.com', 'duosecurity.com'
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

const stats = {
  ads: 0, popups: 0, redirects: 0, hidden: 0, removed: 0, requests: 0,
  load() {
    const s = store.get(K_ST, null) || {};
    this.ads = s.ads|0; this.popups = s.popups|0; this.redirects = s.redirects|0;
    this.hidden = s.hidden|0; this.removed = s.removed|0; this.requests = s.requests|0;
  },
  save() { store.set(K_ST, { ads:this.ads, popups:this.popups, redirects:this.redirects, hidden:this.hidden, removed:this.removed, requests:this.requests }); },
  reset() { this.ads=this.popups=this.redirects=this.hidden=this.removed=this.requests=0; this.save(); }
};
stats.load();
let statsDirty = false;
setInterval(() => { if (statsDirty) { stats.save(); statsDirty = false; } }, 4000);

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
    if (PLAYER_TAGS.has(tag)) return true;
    const id = cur.id || '';
    const cls = typeof cur.className === 'string' ? cur.className : (cur.getAttribute ? (cur.getAttribute('class') || '') : '');
    if (id && PLAYER_ID_RE.test(id)) return true;
    if (cls && PLAYER_CLASS_RE.test(cls)) return true;
    // Custom elements that look like players
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
  if (kind === 'popup') stats.popups++;
  else stats.redirects++;
  statsDirty = true;
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
  const dummy = {
    closed: true,
    opener: null,
    location: dummyLocation,
    close: function () {},
    focus: function () {},
    blur: function () {},
    postMessage: function () {}
  };
  return dummy;
}

function popupBlock(source, detail) {
  recordBlocked('popup', source, detail);
  return makeDummyWindow();
}

function installPopupGuard() {
  const origOpen = W.open;
  if (typeof origOpen !== 'function') return;
  if (origOpen.__nvirya) return;

  const guarded = function (url, name, features) {
    try {
      if (!config.popupProtection || isDisabledHere()) return origOpen.apply(this, arguments);
      const rawStr = url == null ? '' : String(url).trim();
      // about:blank can be navigated later to bypass a URL check, so it is
      // blocked rather than treated as a harmless intermediate window.
      if (!rawStr || /^about:blank(?:[#?].*)?$/i.test(rawStr))
        return popupBlock('empty-or-blank-url', rawStr || '(empty)');
      const u = safeUrl(rawStr);
      if (!u) return popupBlock('unparseable-url', rawStr);
      if (isAdUrl(u)) return popupBlock('ad-url', u.href);
      if (!isAllowedPopupDestination(u)) return popupBlock('untrusted-cross-site', u.href);
      return origOpen.apply(this, arguments);
    } catch (e) {
      log('ERROR','popup', e && e.message);
      // Fail closed: a parsing or browser-wrapper error must not turn into an
      // unguarded popup.
      recordBlocked('popup', 'guard-error', e && e.message);
      return makeDummyWindow();
    }
  };
  try { Object.defineProperty(guarded, '__nvirya', { value: true }); } catch (e) {}
  try {
    W.open = guarded;
    if (W.open !== guarded) log('WARN','popup','window.open hook was not installed');
  } catch (e) { log('WARN','popup','window.open hook unavailable', e && e.message); }
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
  // An external link inside the player subtree is usually an injected layer,
  // not a playback control.
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

function installRedirectGuard() {
  installAnchorClickHook();

  // A capture listener catches synthetic clicks and suspicious overlays.
  // Trusted, ordinary same-tab links remain usable; only third-party ad or
  // player-overlay navigation is cancelled.
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

  // Safari/WebKit often exposes window.location as an unforgeable property.
  // Patch only configurable browser descriptors; click, anchor and meta-refresh
  // guards below remain the fallback when it cannot be intercepted.
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

  // Some engines expose a configurable Window.location descriptor; otherwise
  // assignment to window.location is covered only by the browser's native guard
  // and the fallbacks above.
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
  // fetch
  try {
    if (typeof W.fetch === 'function' && !W.fetch.__nvirya) {
      const origFetch = W.fetch;
      const patched = function (input, init) {
        try {
          if (config.enabled && !isDisabledHere()) {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            const u = safeUrl(url);
            if (u && isAdUrl(u) && config.strictMode) {
              stats.requests++; statsDirty = true;
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

  // XHR open
  try {
    const XHR = W.XMLHttpRequest;
    if (XHR && XHR.prototype && !XHR.prototype.__nvirya_open) {
      const origOpen = XHR.prototype.open;
      XHR.prototype.open = function (method, url) {
        try {
          if (config.enabled && !isDisabledHere() && config.strictMode) {
            const u = safeUrl(url);
            if (u && isAdUrl(u)) {
              stats.requests++; statsDirty = true;
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

  // sendBeacon
  try {
    if (typeof W.navigator.sendBeacon === 'function' && !W.navigator.sendBeacon.__nvirya) {
      const orig = W.navigator.sendBeacon;
      const patched = function (url, data) {
        try {
          if (config.enabled && !isDisabledHere() && config.strictMode) {
            const u = safeUrl(url);
            if (u && isAdUrl(u)) { stats.requests++; statsDirty = true; log('BLOCK','beacon', u.href); return false; }
          }
        } catch (e) {}
        return orig.apply(this, arguments);
      };
      try { Object.defineProperty(patched, '__nvirya', { value: true }); } catch (e) {}
      try { W.navigator.sendBeacon = patched; } catch (e) {}
    }
  } catch (e) {}
}

const CANDIDATE_TAGS = new Set(['img','iframe','a','div','section','dialog','aside','ins','embed','object','script','span']);
const NEVER_REMOVE_TAGS = new Set(['html','head','body','main','video','audio','source','form','input','button','nav','header','footer','script']);
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

// Returns { action: 'remove'|'hide'|'ignore', reason }
function inspectNode(el) {
  if (!el || el.nodeType !== 1) return { action: 'ignore' };
  const tag = (el.tagName || '').toLowerCase();
  if (NEVER_REMOVE_TAGS.has(tag)) return { action: 'ignore' };
  if (isProtectedPlayer(el)) return { action: 'ignore' };

  // Fast path: bail cheaply if neither id/class nor interesting attr
  const idc = ((el.id || '') + ' ' + classString(el)).trim();
  const src = attr(el,'src') || attr(el,'data-src') || attr(el,'data-original') || attr(el,'data-lazy-src') || '';
  const href = attr(el,'href') || '';
  const style = attr(el,'style') || '';

  // Strong signals first (single-signal block)
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

  // Multi-signal
  let signals = 0;
  let reason = '';
  if (idc && RE_AD_TOKEN.test(idc)) { signals++; reason = reason || 'ad-token'; }
  if (RE_SIZING.test(src) || RE_SIZING.test(idc) || RE_SIZING.test(style)) { signals++; reason = reason || 'ad-sizing'; }

  if (tag === 'img') {
    // Tracking pixel
    const w = el.naturalWidth || el.width || 0;
    const h = el.naturalHeight || el.height || 0;
    if (w === 1 && h === 1) { signals++; reason = reason || 'tracking-pixel'; }
  }

  if (signals >= 2) return { action: 'remove', reason };
  if (signals === 1 && !config.strictMode && tag === 'iframe') return { action: 'hide', reason };
  if (signals >= 1 && config.strictMode) return { action: 'hide', reason };
  return { action: 'ignore' };
}

// Overlay / click hijack detection — called only on suspicious looking divs
function isSuspiciousOverlay(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = (el.tagName || '').toLowerCase();
  if (tag !== 'div' && tag !== 'section' && tag !== 'iframe') return false;
  let cs;
  try { cs = W.getComputedStyle(el); } catch (e) { return false; }
  if (!cs) return false;
  if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;
  const z = parseInt(cs.zIndex, 10);
  if (!isFinite(z) || z < 10000) return false;
  const op = parseFloat(cs.opacity);
  if (isFinite(op) && op > 0.15) return false;
  // Must cover most of viewport
  const w = el.offsetWidth, h = el.offsetHeight;
  if (w < W.innerWidth * 0.6 || h < W.innerHeight * 0.6) return false;
  // Must have effectively empty content or be an external iframe
  if (tag === 'iframe') {
    const src = attr(el,'src') || '';
    const u = safeUrl(src);
    if (u && u.hostname && !hostMatches(u.hostname, hostname)) {
      return true;
    }
    return false;
  }
  const txt = (el.textContent || '').trim();
  if (txt.length > 40) return false;
  return true;
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

  // Require an ad/network signal, an external linked banner, or a sparse
  // image-only card with an explicit close control to avoid generic dialogs.
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
    stats.removed++; stats.ads++; statsDirty = true;
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
      if (removeTrackedAdNode(el, reason || 'remove')) pruneAdAncestors(parent);
    } else if (action === 'hide') {
      if (state.hiddenNodes.has(el)) return;
      state.hiddenNodes.add(el);
      el.setAttribute('data-nvirya-hidden', reason || '1');
      stats.hidden++; statsDirty = true;
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
    const style = D.createElement('style');
    style.setAttribute('data-nvirya-cosmetic','');
    style.textContent = css;
    (D.head || D.documentElement).appendChild(style);
    cosmeticStyleEl = style;
  } catch (e) {}
}

// Per-domain manual rules from picker
function installSiteRulesCSS() {
  const rules = state.siteRules[hostname];
  if (!rules || !rules.length) return;
  const css = rules.map(r => r.action === 'hide' ? `${r.selector}{display:none!important;}` : `${r.selector}{display:none!important;}`).join('\n');
  if (!css) return;
  try {
    const style = D.createElement('style');
    style.setAttribute('data-nvirya-site-rules','');
    style.textContent = css;
    (D.head || D.documentElement).appendChild(style);
  } catch (e) {}
}

let observer = null;
const pendingQueue = [];
const pendingSet = new WeakSet();
let scheduled = false;
const MAX_QUEUE = 800;
const handledMetaRefresh = new WeakSet();

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

  // Fast reject: skip elements that aren't candidates
  const tag = (el.tagName || '').toLowerCase();
  if (!CANDIDATE_TAGS.has(tag)) {
    // Still descend into children via observer; nothing to inspect here
    return;
  }

  if ((tag === 'div' || tag === 'section' || tag === 'dialog') && isFloatingAdModal(el)) {
    applyAction(el, 'remove', 'floating-ad-modal');
    return;
  }

  const decision = inspectNode(el);
  if (decision.action !== 'ignore') {
    applyAction(el, decision.action, decision.reason);
    return;
  }

  // Overlay check — only for div/section/iframe with plausible signals
  if ((tag === 'div' || tag === 'section' || tag === 'iframe')) {
    if (isSuspiciousOverlay(el)) {
      applyAction(el, 'remove', 'suspicious-overlay');
    }
  }
}

function enqueue(el) {
  if (!el || el.nodeType !== 1) return;
  if (pendingSet.has(el)) return;
  if (pendingQueue.length >= MAX_QUEUE) {
    // Drop oldest to keep fresh — prevents storm
    pendingQueue.shift();
  }
  pendingSet.add(el);
  pendingQueue.push(el);
  scheduleProcess();
}

function scanSubtree(root) {
  if (!root || root.nodeType !== 1) return;
  enqueue(root);
  // Limit subtree walk to avoid huge scans
  let walked = 0;
  const it = D.createTreeWalker ? D.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null) : null;
  if (it) {
    let n = it.nextNode();
    while (n && walked < 500) { enqueue(n); n = it.nextNode(); walked++; }
  } else {
    const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
    const lim = Math.min(all.length, 500);
    for (let i = 0; i < lim; i++) enqueue(all[i]);
  }
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
              if (n.nodeType === 1 && String(n.tagName).toLowerCase() === 'meta'
                && (attr(n, 'http-equiv') || '').trim().toLowerCase() === 'refresh') continue;
              enqueue(n);
              // Also enqueue a limited set of children to catch subtree ads
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
    });
  } catch (e) { return; }
  const target = D.documentElement || D;
  observer.observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src','href','style','class','id','data-src','http-equiv','aria-label','title']
  });
}

function initialScan() {
  const root = D.body || D.documentElement;
  if (!root) return;
  removeMetaRefresh(root);
  scheduleOverlayCleanup(root);
  // Chunked scan of initial DOM
  const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
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
  // Re-check whitelist/disable status; refresh rules; keep protection running
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
  if (!config.antiAdblock) return;
  try {
    const all = D.querySelectorAll('[class*="adblock" i],[id*="adblock" i],[class*="adblocker" i]');
    const lim = Math.min(all.length, 30);
    for (let i = 0; i < lim; i++) {
      const el = all[i];
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
        stats.hidden++; statsDirty = true;
        log('BLOCK','anti-adblock','removed overlay');
      }
    }
  } catch (e) {}
}

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
  let pickerEl = null, pickerLabelEl = null, pickerActive = false;
  let pickerHover = null;
  let toastTimer = null;
  let lastToast = '';
  let statsTimer = null;
  let fab = { side: 'r', y: 0.7 };

  /* ---------- DOM helpers (no innerHTML: safe under Trusted Types) ---------- */
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
    shield:  ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
    sun:     [['c', 12, 12, 4], 'M12 2v2', 'M12 20v2', 'M4.93 4.93l1.41 1.41', 'M17.66 17.66l1.41 1.41', 'M2 12h2', 'M20 12h2', 'M6.34 17.66l-1.41 1.41', 'M19.07 4.93l-1.41 1.41'],
    moon:    ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
    close:   ['M18 6 6 18', 'M6 6l12 12'],
    chevron: ['m9 18 6-6-6-6'],
    allow:   [['c', 12, 12, 10], 'm8 12 3 3 5-6'],
    pause:   [['c', 12, 12, 10], 'M10 9v6', 'M14 9v6'],
    target:  [['c', 12, 12, 10], 'M22 12h-4', 'M6 12H2', 'M12 6V2', 'M12 22v-4'],
    wand:    ['M15 4V2', 'M15 16v-2', 'M8 9h2', 'M20 9h2', 'M17.8 11.8 19 13', 'M15 9h.01', 'M17.8 6.2 19 5', 'M3 21l9-9', 'M12.2 6.2 11 5'],
    undo:    ['M3 7v6h6', 'M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13'],
    copy:    [['r', 9, 9, 13, 13, 2], 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1']
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

  /* ---------- Theme ---------- */
  const LIGHT_VARS = `
      --cs: light;
      --sheet: rgba(255,255,255,.92);
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
      --sheet: rgba(18,18,21,.92);
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

    /* ---------- Floating button ---------- */
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
    .handle.hidden { display: none; }
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

    /* ---------- Backdrop ---------- */
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

    /* ---------- Sheet (mobile: bottom sheet) ---------- */
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

    /* ---------- Sheet (tablet / desktop: floating dialog card) ---------- */
    @media (min-width: 641px) {
      .sheet {
        left: 50%; right: auto; top: 50%; bottom: auto;
        width: 380px; max-height: 85vh;
        border: 1px solid var(--border);
        border-radius: 20px;
        box-shadow: 0 24px 70px rgba(0,0,0,.35);
        opacity: 0;
        transform: translate(-50%, -46%) scale(.96);
      }
      .sheet.open { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      .pill { display: none; }
    }

    /* ---------- Header ---------- */
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

    /* ---------- Body ---------- */
    .body {
      flex: 1; min-height: 0;
      overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
      padding: 14px 16px calc(20px + env(safe-area-inset-bottom, 0px));
    }
    .sec-title { margin: 20px 4px 8px; font-size: 13px; font-weight: 600; color: var(--muted); }

    /* Status card */
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

    /* Stats */
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .stat { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 12px 14px; min-width: 0; }
    .stat:last-child:nth-child(odd) { grid-column: 1 / -1; }
    .stat b { display: block; font-size: 24px; font-weight: 700; letter-spacing: -.02em; line-height: 1.15; font-variant-numeric: tabular-nums; color: var(--text); }
    .stat span { display: block; margin-top: 2px; font-size: 12px; color: var(--muted); }

    /* iOS-style grouped list */
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

    /* Switch (iOS style) */
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

    /* Segmented control */
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

    /* ---------- Toast ---------- */
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

    @media (prefers-reduced-motion: reduce) {
      .handle, .backdrop, .sheet, .toast, .track, .track::after, .item, .seg button { transition: none !important; }
      .led { animation: none !important; }
    }
  `;

  /* ---------- Theme logic ---------- */
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

  /* ---------- Floating button position ---------- */
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

  /* ---------- Build ---------- */
  function build() {
    host = document.createElement('div');
    host.setAttribute('data-nvirya-ui', '');
    host.style.cssText = 'all:initial;';
    root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);

    // Floating action button
    handleEl = el('div', {
      class: 'handle', role: 'button', tabindex: '0',
      'aria-label': 'nvirya AdGuard', 'aria-haspopup': 'dialog', 'aria-expanded': 'false',
      'data-state': 'ok'
    }, icon('shield'), el('span', { class: 'fab-dot' }));
    root.appendChild(handleEl);

    // Backdrop
    backdropEl = el('div', { class: 'backdrop', onclick: () => setMenu(false) });
    root.appendChild(backdropEl);

    // Sheet
    sheetEl = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Nvirya AdGuard X', 'aria-hidden': 'true', tabindex: '-1' });
    themeBtn = el('button', { class: 'icon-btn', type: 'button', onclick: () => setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark') });
    const closeBtn = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => setMenu(false) }, icon('close'));
    const head = el('div', { class: 'head' },
      el('div', { class: 'titles' },
        el('h1', null, 'Nvirya AdGuard X'),
        el('div', { class: 'badge' }, hostname || '(unknown)')
      ),
      el('div', { class: 'head-btns' }, themeBtn, closeBtn)
    );
    grabEl = el('div', { class: 'grab' }, el('div', { class: 'pill' }), head);
    bodyEl = el('div', { class: 'body' });
    sheetEl.appendChild(grabEl);
    sheetEl.appendChild(bodyEl);
    root.appendChild(sheetEl);

    // Toast
    toastEl = el('div', { class: 'toast', role: 'status' });
    root.appendChild(toastEl);

    (D.documentElement || D.body).appendChild(host);

    loadFab();
    buildBody();
    applyTheme();
    applyFab();
    if (!config.edgeHandle) handleEl.classList.add('hidden');
    wireHandle();
    wireSheet();

    // Keep "auto" theme icon in sync with the OS setting, and keep the FAB on-screen
    try {
      const mq = W.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', updateThemeUI);
      else if (mq.addListener) mq.addListener(updateThemeUI);
    } catch (e) {}
    try {
      W.addEventListener('resize', applyFab, { passive: true });
      W.addEventListener('orientationchange', () => setTimeout(applyFab, 200), { passive: true });
    } catch (e) {}
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

  function buildBody() {
    clear(bodyEl);

    // Status card
    statusEl = el('div', { class: 'status' });
    bodyEl.appendChild(statusEl);

    // Stats grid
    bodyEl.appendChild(sectionTitle('Blocked (session totals)'));
    statsEl = el('div', { class: 'stats' });
    bodyEl.appendChild(statsEl);

    // Actions (iOS Settings style list)
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
    actions.appendChild(item({ label: 'Undo last block', sub: 'Restore the last removed element', tone: 'gray', icon: 'undo', chevron: true,
      onclick: () => { undoLast(); } }));
    bodyEl.appendChild(actions);

    // Settings
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
      ['edgeHandle', 'Floating button'],
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
        saveConfig();
        if (k === 'edgeHandle') handleEl.classList.toggle('hidden', !inp.checked || !config.edgeHandle);
        if (k === 'enabled' || k === 'cosmeticFiltering' || k === 'redirectProtection') refreshProtection();
        renderStatus(); renderStats();
      });
      row.appendChild(el('span', { class: 'switch' }, inp, el('span', { class: 'track' })));
      swGroup.appendChild(row);
    }
    bodyEl.appendChild(swGroup);

    // Data
    bodyEl.appendChild(sectionTitle('Data'));
    const data = el('div', { class: 'group' });
    data.appendChild(item({ label: 'Reset settings', sub: 'Restore the default options', danger: true, onclick: () => {
      if (!confirm('Reset all settings to defaults?')) return;
      config = Object.assign({}, DEFAULT_CONFIG);
      saveConfig(); buildBody(); applyTheme();
      handleEl.classList.toggle('hidden', !config.edgeHandle);
      refreshProtection(); toast('Settings reset');
    }}));
    data.appendChild(item({ label: 'Clear statistics', sub: 'Set all counters back to zero', danger: true, onclick: () => {
      if (!confirm('Clear statistics?')) return;
      stats.reset(); renderStats(); toast('Stats cleared');
    }}));
    data.appendChild(item({ label: 'Reset site rules', sub: 'Remove all blocked elements on this site', danger: true, onclick: () => {
      if (!confirm('Clear all manual rules for this site?')) return;
      delete state.siteRules[hostname]; persistSiteRules(); toast('Site rules cleared'); onLocationChange();
    }}));
    bodyEl.appendChild(data);

    // Debug
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
    const rows = [
      ['Ads removed', stats.ads],
      ['Elements hidden', stats.hidden],
      ['Popups blocked', stats.popups],
      ['Redirects blocked', stats.redirects],
      ['Requests blocked', stats.requests],
    ];
    if (statsEl.childNodes.length !== rows.length) {
      clear(statsEl);
      for (const r of rows) statsEl.appendChild(el('div', { class: 'stat' }, el('b', null, '0'), el('span', null, r[0])));
    }
    rows.forEach((r, i) => {
      const b = statsEl.childNodes[i].firstChild;
      const s = fmt(r[1]);
      if (b.textContent !== s) b.textContent = s;
    });
  }

  function setMenu(open) {
    if (!sheetEl) return;
    menuOpen = !!open;
    sheetEl.classList.toggle('open', menuOpen);
    backdropEl.classList.toggle('open', menuOpen);
    handleEl.classList.toggle('away', menuOpen);
    handleEl.setAttribute('aria-expanded', String(menuOpen));
    sheetEl.setAttribute('aria-hidden', String(!menuOpen));
    if (statsTimer) { clearInterval(statsTimer); statsTimer = null; }
    if (menuOpen) {
      renderStatus(); renderStats(); updateThemeUI();
      statsTimer = setInterval(renderStats, 1000);
      try { sheetEl.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  /* ---------- Gestures ---------- */
  function wireHandle() {
    // Draggable FAB: free drag, snaps to the nearest side edge on release
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

    // Close on Escape (the backdrop handles outside taps)
    D.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (pickerActive) exitPicker(true);
        else if (menuOpen) setMenu(false);
      }
    }, true);
  }

  function isSheetMode() {
    try { return !W.matchMedia('(min-width: 641px)').matches; } catch (e) { return (W.innerWidth || 0) <= 640; }
  }

  // Swipe down to close (bottom-sheet mode only)
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
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.classList.remove('show'); toastTimer = null; lastToast = ''; }, 2000);
  }

  function updateUIStatus() { renderStatus(); renderStats(); }

  /* ---------- Picker ---------- */
  function buildPicker() {
    if (pickerEl) return;
    pickerEl = document.createElement('div');
    pickerEl.setAttribute('data-nvirya-picker','');
    pickerEl.style.cssText = 'position:fixed;z-index:2147483003;pointer-events:none;border:2px solid #3b82f6;background:rgba(59,130,246,.1);border-radius:3px;transition:all .05s linear;box-sizing:border-box;';
    pickerLabelEl = document.createElement('div');
    pickerLabelEl.style.cssText = 'position:fixed;z-index:2147483004;pointer-events:none;background:#0b0b0d;color:#f4f4f5;font:11px system-ui,-apple-system,sans-serif;padding:3px 7px;border-radius:4px;border:1px solid rgba(255,255,255,.1);white-space:nowrap;';
    (D.body || D.documentElement).appendChild(pickerEl);
    (D.body || D.documentElement).appendChild(pickerLabelEl);
  }

  function enterPicker() {
    if (!config.elementPicker) return;
    buildPicker();
    pickerActive = true;
    pickerEl.style.display = 'block';
    pickerLabelEl.style.display = 'block';
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
    D.removeEventListener('mousemove', pickerMove, true);
    D.removeEventListener('click', pickerClick, true);
    D.removeEventListener('touchmove', pickerTouchMove, true);
    D.removeEventListener('touchend', pickerTouchEnd, true);
    if (!silent) toast('Picker closed');
  }

  function describe(el) {
    if (!el) return '';
    const tag = (el.tagName || '').toLowerCase();
    const id = el.id ? '#' + el.id : '';
    const cls = classString(el);
    const firstCls = cls ? '.' + cls.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    return tag + id + firstCls;
  }

  function pickerMove(e) {
    if (!pickerActive) return;
    if (e.composedPath && e.composedPath().indexOf(host) !== -1) return;
    const el = D.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === pickerEl || el === pickerLabelEl) return;
    if (el === pickerHover) return;
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
    if (!e.changedTouches || !e.changedTouches.length) return;
    const t = e.changedTouches[0];
    const el = D.elementFromPoint(t.clientX, t.clientY);
    if (el) selectElement(el);
  }

  function pickerClick(e) {
    if (!pickerActive) return;
    if (e.composedPath && e.composedPath().indexOf(host) !== -1) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const el = D.elementFromPoint(e.clientX, e.clientY);
    if (el) selectElement(el);
  }

  function makeSelector(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id && /^[a-zA-Z][\w-]*$/.test(el.id)) return '#' + el.id;
    // data-testid / data-qa / data-attr
    for (const a of ['data-testid','data-qa','data-test','data-cy','data-id']) {
      const v = el.getAttribute(a);
      if (v) return `${el.tagName.toLowerCase()}[${a}="${CSS.escape(v)}"]`;
    }
    // Class combination with tag
    const cls = classString(el).split(/\s+/).filter(c => c && c.length < 40);
    if (cls.length) {
      const combo = cls.slice(0, 2).map(c => '.' + CSS.escape(c)).join('');
      // Verify uniqueness
      try {
        const matches = D.querySelectorAll(el.tagName.toLowerCase() + combo);
        if (matches.length === 1) return el.tagName.toLowerCase() + combo;
      } catch (e) {}
      return el.tagName.toLowerCase() + combo;
    }
    // Fallback to parent + nth-child — less stable
    const parent = el.parentElement;
    if (!parent) return el.tagName.toLowerCase();
    const idx = Array.prototype.indexOf.call(parent.children, el) + 1;
    return `${makeSelector(parent) || parent.tagName.toLowerCase()} > ${el.tagName.toLowerCase()}:nth-child(${idx})`;
  }

  function selectElement(el) {
    if (!el || el.nodeType !== 1) return;
    if (isProtectedPlayer(el) && !confirm('This element looks like a player. Blocking it may break playback. Continue?')) {
      exitPicker(true); return;
    }
    const sel = makeSelector(el);
    if (!sel) { toast('Could not build selector'); exitPicker(true); return; }
    if (!confirm('Block this element?\n\n' + sel)) { exitPicker(true); return; }
    if (!state.siteRules[hostname]) state.siteRules[hostname] = [];
    state.siteRules[hostname].push({ selector: sel, action: 'hide', created: Date.now() });
    persistSiteRules();
    // Hide immediately
    try {
      el.setAttribute('data-nvirya-hidden','manual');
      state.hiddenNodes.add(el);
      stats.hidden++; statsDirty = true;
    } catch (e) {}
    installSiteRulesCSS();
    toast('Element blocked');
    exitPicker(true);
  }

  /* ---------- Debug ---------- */
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
    lines.push('Stats: ' + JSON.stringify({ ads: stats.ads, hidden: stats.hidden, popups: stats.popups, redirects: stats.redirects, requests: stats.requests }));
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
    isPickerActive: () => pickerActive
  };
})();

function cleanPage() {
  try {
    // Remove obvious cosmetic-only ad nodes on demand
    const sel = '[id^="google_ads_"], ins.adsbygoogle, iframe[src*="googlesyndication"], iframe[src*="doubleclick"]';
    const list = D.querySelectorAll(sel);
    const lim = Math.min(list.length, 200);
    for (let i = 0; i < lim; i++) {
      const el = list[i];
      if (!isProtectedPlayer(el)) {
        el.setAttribute('data-nvirya-hidden','clean');
        state.hiddenNodes.add(el);
        stats.hidden++;
      }
    }
    statsDirty = true;
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
    GM_registerMenuCommand('Toggle debug', () => {
      config.debug = !config.debug; saveConfig(); UI.toast('Debug ' + (config.debug ? 'on' : 'off'));
    });
  } catch (e) {}
}

function init() {
  if (state.initialized) return;
  state.initialized = true;

  // Early guards
  installPopupGuard();
  installRedirectGuard();
  installNetworkGuard();

  const start = () => {
    // Cosmetic CSS
    installCosmeticCSS();
    installSiteRulesCSS();

    // Observer on documentElement (so it captures head/body swaps too)
    startObserver();

    // Initial scan
    initialScan();

    // Anti-adblock scan (delayed to let overlays appear)
    setTimeout(handleAntiAdblock, 1500);
    setTimeout(handleAntiAdblock, 4000);

    // SPA hooks
    installSPAHooks();

    // UI
    try { UI.build(); } catch (e) { log('ERROR','ui', e && e.message); }
    if (!config.edgeHandle) {
      const h = document.querySelector('[data-nvirya-ui]');
      if (h && h.shadowRoot) {
        const handle = h.shadowRoot.querySelector('.handle');
        if (handle) handle.classList.add('hidden');
      }
    }

    // Menu commands
    registerMenuCommands();

    // Stats flush on unload
    try {
      W.addEventListener('pagehide', () => { try { stats.save(); } catch (e) {} }, { capture: true });
      W.addEventListener('beforeunload', () => { try { stats.save(); } catch (e) {} });
    } catch (e) {}

    // Fullscreen handling
    try {
      D.addEventListener('fullscreenchange', () => {
        const fsEl = D.fullscreenElement;
        const h = document.querySelector('[data-nvirya-ui]');
        if (!h || !h.shadowRoot) return;
        const handle = h.shadowRoot.querySelector('.handle');
        if (!handle) return;
        handle.style.display = fsEl ? 'none' : '';
      });
    } catch (e) {}

    log('INFO','init', 'ready v' + VERSION);
  };

  if (D.documentElement && D.body) {
    start();
  } else if (D.documentElement) {
    // Body not yet present
    const mo = new MutationObserver((muts, obs) => {
      if (D.body) { obs.disconnect(); start(); }
    });
    try { mo.observe(D.documentElement, { childList: true, subtree: true }); } catch (e) { setTimeout(start, 100); }
    D.addEventListener('DOMContentLoaded', () => { if (!state.initialized) return; start(); }, { once: true });
    // Failsafe
    setTimeout(() => { try { mo.disconnect(); } catch (e) {} start(); }, 5000);
  } else {
    setTimeout(init, 20);
    return;
  }
}

try {
  init();
} catch (e) {
  try { console.error('[Nvirya AdGuard X] init failed', e); } catch (e2) {}
}
})();
