// ==UserScript==
// @name         Nvirya AdGuard
// @license      MIT
// @namespace    https://nvirya.com/adguard
// @version      11.7.2
// @description  A lightweight, ultra-powerful userscript & extension engine designed to eliminate intrusive ads, stealth overlays, instant redirects, and popups on mobile (iOS Stay) and desktop.
// @author       Nvirya
// @homepageURL  https://adguard.nvirya.com
// @supportURL   https://adguard.nvirya.help
// @match        *://*/*
// @icon         https://raw.nvirya.com/assets/icon128x128.png
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      reporter.nvirya.com
// @connect      raw.nvirya.com
// @connect      *
// @run-at       document-start
// @all-frames   true
// @changelog    Fixed Cloudflare Turnstile & Under Attack infinite reload loops and protected closed Shadow DOM verification widgets.
// @changelog    Fixed Google Search results disappearing when scrolling to the bottom of search pages.
// @changelog    Refined inline script and URL path regex boundaries to prevent false positives on legitimate scripts and redirect links.
// @changelog    Enforced site whitelist and session pause checks before injecting main-world hooks, and masked native function toString signatures.
// @changelog    Expanded the safe third-party allowlist for payment, auth, captcha, and CDN services, and scoped Page Visibility spoofing.
// @downloadURL  https://update.greasyfork.org/scripts/599226/Nvirya%20AdGuard.user.js
// @updateURL    https://update.greasyfork.org/scripts/599226/Nvirya%20AdGuard.meta.js
// ==/UserScript==
/* ==Changelog==
- Fixed Cloudflare Turnstile & Under Attack infinite reload loops and protected closed Shadow DOM verification widgets.
- Fixed Google Search results disappearing when scrolling to the bottom of search pages.
- Refined inline script and URL path regex boundaries to prevent false positives on legitimate scripts and redirect links.
- Enforced site whitelist and session pause checks before injecting main-world hooks, and masked native function toString signatures.
- Expanded the safe third-party allowlist for payment, auth, captcha, and CDN services, and scoped Page Visibility spoofing.
==/Changelog== */
(function() {
	'use strict';

	const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
	const D = W.document;
	if (W.__NVIRYA_ADGUARD_X__) return;
	try { Object.defineProperty(W, '__NVIRYA_ADGUARD_X__', { value: true }); } catch (e) { W.__NVIRYA_ADGUARD_X__ = true; }
	const VERSION = '11.7.2';
	const RE_GOOGLE_CORE_HOST = /(?:^|\.)(?:gstatic\.com|googleusercontent\.com|google\.[a-z.]+)$/i;
	const RE_YOUTUBE_HOST = /(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/i;
	const RE_YOUTUBE_AD_ENDPOINT = /(?:youtube\.com\/(?:api\/stats\/ads|pagead\/(?!ad_status)|get_midroll_|pcs\/activeview|youtubei\/v1\/player\/ad_break)|doubleclick\.net|googlesyndication\.com|googleadservices\.com|adservice\.google)/i;
	const RE_YOUTUBE_CDN_WHITELIST = /(?:googlevideo\.com|ytimg\.com|yt3\.ggpht\.com|youtube-nocookie\.com|youtube\.com\/(?:videoplayback|s\/player|yts\/|ptracking|api\/stats\/(?:playback|watchtime|qoe|atr)|youtubei\/v1\/(?!player\/ad_break))|instream\/ad_status\.js)/i;
	const RE_TRANSLATOR_WHITELIST = /(?:translate\.google\.[a-z.]+|translate\.googleapis\.com|bing\.com\/translator|bing\.com\/ttranslatev3|bing\.com\/tfetspktok|play\.google\.com\/log|bat\.bing\.com|api\.cognitive\.microsofttranslator\.com)/i;
	const TRUSTED_DOCS_DOMAINS = /(?:wikipedia\.org|wiktionary\.org|wikimedia\.org|github\.com|gitlab\.com|archive\.org)$/i;
	const RE_SEARCH_DEBOUNCE_HOST = /(?:^|\.)(?:google\.[a-z.]+|bing\.com)$/i;
	const SEARCH_ENGINES = /(?:^|\.)(?:google\.[a-z.]+|bing\.com|yandex\.[a-z.]+|duckduckgo\.com|baidu\.com|coccoc\.com|yahoo\.com|ecosia\.org|brave\.com)$/i;

	function isSearchEngineDomain(host) {
		const h = String(host || (W.location && W.location.hostname) || (typeof hostname !== 'undefined' ? hostname : '') || '').toLowerCase().replace(/\.$/, '');
		if (!h) return false;
		return RE_SEARCH_DEBOUNCE_HOST.test(h) || isGoogleCoreHost(h) || SEARCH_ENGINES.test(h);
	}

	const RE_SECURITY_CHALLENGE = /(?:challenges\.cloudflare\.com|turnstile\/v0\/api\.js|\bcdn-cgi\/(?:challenge-platform|images\/trace|l\/chk_)|cf-turnstile|cf_chl_|__cf_chl|cf-spinner|cf-please-wait|hcaptcha\.com|recaptcha\.net|google\.com\/recaptcha|ddos-guard|arkoselabs\.com|funcaptcha\.com|geetest\.com)/i;
	const RE_SECURITY_CHALLENGE_HOST = /(?:^|\.)(?:challenges\.cloudflare\.com|hcaptcha\.com|recaptcha\.net|ddos-guard\.net|arkoselabs\.com|funcaptcha\.com|geetest\.com)$/i;
	const SCRIPT_START_TIME = Date.now();
	const RE_BAIT_ELEMENT = /ads?[-_]?box|adsbygoogle|banner[-_]?ad|ad[-_]?slot|ad[-_]?unit|ad[-_]?placement|textads|banner-ads/i;

	const runIdleTask = (fn, timeout = 2000) => (typeof W.requestIdleCallback === 'function' ? W.requestIdleCallback(fn, { timeout: timeout || 2500 }) : setTimeout(fn, timeout));

	function processInChunks(items, handler, maxDurationMs = 8, onComplete) {
		if (!items || !items.length) {
			if (onComplete) onComplete();
			return;
		}
		let index = 0;
		function step() {
			const start = (W.performance && W.performance.now) ? W.performance.now() : Date.now();
			while (index < items.length && (((W.performance && W.performance.now) ? W.performance.now() : Date.now()) - start) < maxDurationMs) {
				handler(items[index], index);
				index++;
			}
			if (index < items.length) {
				if (typeof W.requestIdleCallback === 'function') {
					W.requestIdleCallback(step, { timeout: 60 });
				} else {
					setTimeout(step, 0);
				}
			} else if (onComplete) {
				onComplete();
			}
		}
		step();
	}

	function mainWorldShield(targetWin) {
		const W = targetWin || window;
		const D = W.document || document;
		if (W.__NVIRYA_MAIN_SHIELD__) return;
		try { Object.defineProperty(W, '__NVIRYA_MAIN_SHIELD__', { value: true }); } catch (e) { W.__NVIRYA_MAIN_SHIELD__ = true; }

		const mwHost = String((W.location && W.location.hostname) || '').toLowerCase().replace(/\.$/, '');
		const mwHref = String((W.location && W.location.href) || '');
		if (
			/(?:^|\.)(?:challenges\.cloudflare\.com|hcaptcha\.com|recaptcha\.net|ddos-guard\.net|arkoselabs\.com|funcaptcha\.com|geetest\.com|gstatic\.com|googleusercontent\.com|google\.[a-z.]+|bing\.com|wikipedia\.org|github\.com|gitlab\.com)$/i.test(mwHost) ||
			/(?:challenges\.cloudflare\.com|\bcdn-cgi\/(?:challenge-platform|l\/chk_)|cf_chl_|__cf_chl)/i.test(mwHref) ||
			Boolean(W._cf_chl_opt || W.__cf$cv$params)
		) {
			return;
		}
		try {
			if (D.querySelector && D.querySelector('#challenge-running, #challenge-stage, #challenge-form, #cf-wrapper, script[src*="/cdn-cgi/challenge-platform/"]')) {
				W.__nvirya_has_security_challenge = true;
				return;
			}
		} catch (e) {}
		const isYouTube = /(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/i.test(mwHost);
		const RE_YT_AD_BLOCK = /(?:youtube\.com\/(?:api\/stats\/ads|pagead\/(?!ad_status)|get_midroll_|pcs\/activeview|youtubei\/v1\/player\/ad_break)|doubleclick\.net|googlesyndication\.com|googleadservices\.com|adservice\.google)/i;
		const RE_YT_STREAM_SAFE = /(?:googlevideo\.com|ytimg\.com|yt3\.ggpht\.com|youtube-nocookie\.com|youtube\.com\/(?:videoplayback|s\/player|yts\/|ptracking|api\/stats\/(?:playback|watchtime|qoe|atr)|youtubei\/v1\/(?!player\/ad_break))|instream\/ad_status\.js|translate\.google\.[a-z.]+|translate\.googleapis\.com|bing\.com\/translator|bing\.com\/ttranslatev3|bing\.com\/tfetspktok|play\.google\.com\/log|bat\.bing\.com|api\.cognitive\.microsofttranslator\.com)/i;

		if (isYouTube) {
			const YT_PLAYER_ENDPOINT_RE = /youtubei\/v1\/(?:player|watch|next)(?:[/?#]|$)/i;
			const YT_AD_KEYS_FAST_RE = /"(?:adPlacements|playerAds|adSlots|adBreakHeartbeatParams|adBreakRenderer)"/;

			const cleanYoutubePlayerObj = (obj) => {
				if (!obj || typeof obj !== 'object') return false;
				let altered = false;
				const stripKeys = (target) => {
					if (!target || typeof target !== 'object') return;
					if (Array.isArray(target.adPlacements) && target.adPlacements.length > 0) {
						target.adPlacements = [];
						altered = true;
					}
					if (Array.isArray(target.playerAds) && target.playerAds.length > 0) {
						target.playerAds = [];
						altered = true;
					}
					if (Array.isArray(target.adSlots) && target.adSlots.length > 0) {
						target.adSlots = [];
						altered = true;
					}
					if ('adBreakHeartbeatParams' in target) {
						delete target.adBreakHeartbeatParams;
						altered = true;
					}
					if ('adBreakRenderer' in target) {
						delete target.adBreakRenderer;
						altered = true;
					}
				};
				stripKeys(obj);
				if (obj.playerResponse && typeof obj.playerResponse === 'object') {
					stripKeys(obj.playerResponse);
				}
				if (Array.isArray(obj.onResponseReceivedEndpoints)) {
					for (let i = 0; i < obj.onResponseReceivedEndpoints.length; i++) {
						const ep = obj.onResponseReceivedEndpoints[i];
						if (ep && typeof ep === 'object') stripKeys(ep);
					}
				}
				return altered;
			};

			try {
				W.google_ad_status = 1;
				let _ytInitialPlayerResponse = W.ytInitialPlayerResponse;
				if (_ytInitialPlayerResponse && typeof _ytInitialPlayerResponse === 'object') {
					cleanYoutubePlayerObj(_ytInitialPlayerResponse);
				}
				Object.defineProperty(W, 'ytInitialPlayerResponse', {
					configurable: true,
					get: () => _ytInitialPlayerResponse,
					set: (v) => {
						try { if (v && typeof v === 'object') cleanYoutubePlayerObj(v); } catch (e) {}
						_ytInitialPlayerResponse = v;
					}
				});
			} catch (e) {}

			try {
				if (typeof W.fetch === 'function' && !W.fetch.__nvirya_yt_mw) {
					const origYtFetch = W.fetch;
					const ytFetch = function(input, init) {
						let urlStr = '';
						try {
							urlStr = typeof input === 'string' ? input : (input && input.url) || String(input || '');
						} catch (e) {}
						if (urlStr && RE_YT_AD_BLOCK.test(urlStr)) {
							const isAdBreak = /youtubei\/v1\/player\/ad_break/i.test(urlStr);
							const body = isAdBreak ? '{}' : '';
							const ct = isAdBreak ? 'application/json' : 'text/plain';
							if (typeof Response === 'function') {
								return Promise.resolve(new Response(body, { status: 200, statusText: 'OK', headers: { 'Content-Type': ct } }));
							}
						}
						const p = origYtFetch.apply(this, arguments);
						if (!urlStr || !YT_PLAYER_ENDPOINT_RE.test(urlStr)) return p;
						return p.then((resp) => {
							try { if (resp) resp.__nvirya_yt_target = true; } catch (e) {}
							return resp;
						});
					};
					try { Object.defineProperty(ytFetch, '__nvirya_yt_mw', { value: true }); } catch (e) {}
					W.fetch = ytFetch;
				}
			} catch (e) {}

			try {
				const rProto = W.Response && W.Response.prototype;
				if (rProto && !rProto.__nvirya_yt_resp) {
					const origJson = rProto.json;
					const origText = rProto.text;
					if (typeof origJson === 'function') {
						rProto.json = function() {
							const p = origJson.call(this);
							if (!this.__nvirya_yt_target && !YT_PLAYER_ENDPOINT_RE.test(this.url || '')) return p;
							return p.then((d) => {
								try { cleanYoutubePlayerObj(d); } catch (e) {}
								return d;
							});
						};
					}
					if (typeof origText === 'function') {
						rProto.text = function() {
							const p = origText.call(this);
							if (!this.__nvirya_yt_target && !YT_PLAYER_ENDPOINT_RE.test(this.url || '')) return p;
							return p.then((tStr) => {
								if (typeof tStr !== 'string' || !YT_AD_KEYS_FAST_RE.test(tStr)) return tStr;
								try {
									const o = JSON.parse(tStr);
									if (cleanYoutubePlayerObj(o)) return JSON.stringify(o);
								} catch (e) {}
								return tStr;
							});
						};
					}
					try { Object.defineProperty(rProto, '__nvirya_yt_resp', { value: true }); } catch (e) {}
				}
			} catch (e) {}

			try {
				const XHRProto = W.XMLHttpRequest && W.XMLHttpRequest.prototype;
				if (XHRProto && !XHRProto.__nvirya_yt_xhr_proto) {
					const origOpen = XHRProto.open;
					const origSend = XHRProto.send;
					const origRespTextDesc = Object.getOwnPropertyDescriptor(XHRProto, 'responseText');
					const origRespDesc = Object.getOwnPropertyDescriptor(XHRProto, 'response');

					XHRProto.open = function(method, url) {
						const uStr = typeof url === 'string' ? url : String(url || '');
						this.__nvirya_yt_url = uStr;
						this.__nvirya_yt_cache = null;
						this.__nvirya_yt_ad_blocked = Boolean(uStr && RE_YT_AD_BLOCK.test(uStr));
						if (this.__nvirya_yt_ad_blocked) {
							try { return origOpen.call(this, method || 'GET', 'data:application/json,%7B%7D'); } catch (e) {}
						}
						return origOpen.apply(this, arguments);
					};

					XHRProto.send = function() {
						if (this.__nvirya_yt_ad_blocked) {
							const xhr = this;
							const emptyJson = '{}';
							const respVal = xhr.responseType === 'json' ? {} : emptyJson;
							try {
								Object.defineProperty(xhr, 'readyState', { configurable: true, get: () => 4 });
								Object.defineProperty(xhr, 'status', { configurable: true, get: () => 200 });
								Object.defineProperty(xhr, 'statusText', { configurable: true, get: () => 'OK' });
								Object.defineProperty(xhr, 'responseText', { configurable: true, get: () => emptyJson });
								Object.defineProperty(xhr, 'response', { configurable: true, get: () => respVal });
							} catch (e) {}
							setTimeout(() => {
								try {
									if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange(new Event('readystatechange'));
									xhr.dispatchEvent(new Event('readystatechange'));
									if (typeof xhr.onload === 'function') xhr.onload(new Event('load'));
									xhr.dispatchEvent(new Event('load'));
									if (typeof xhr.onloadend === 'function') xhr.onloadend(new Event('loadend'));
									xhr.dispatchEvent(new Event('loadend'));
								} catch (e) {}
							}, 1);
							return;
						}
						return origSend.apply(this, arguments);
					};

					const pruneRawPlayerText = (xhr, raw) => {
						if (typeof raw !== 'string' || !xhr.__nvirya_yt_url || !YT_PLAYER_ENDPOINT_RE.test(xhr.__nvirya_yt_url)) {
							return raw;
						}
						if (!YT_AD_KEYS_FAST_RE.test(raw)) return raw;
						if (xhr.__nvirya_yt_cache && xhr.__nvirya_yt_cache.raw === raw) {
							return xhr.__nvirya_yt_cache.out;
						}
						try {
							const obj = JSON.parse(raw);
							const out = cleanYoutubePlayerObj(obj) ? JSON.stringify(obj) : raw;
							xhr.__nvirya_yt_cache = { raw, out };
							return out;
						} catch (e) {
							return raw;
						}
					};

					if (origRespTextDesc && typeof origRespTextDesc.get === 'function') {
						Object.defineProperty(XHRProto, 'responseText', {
							configurable: true,
							enumerable: origRespTextDesc.enumerable,
							get: function() {
								if (this.__nvirya_yt_ad_blocked) return '{}';
								const raw = origRespTextDesc.get.call(this);
								if (this.responseType && this.responseType !== '' && this.responseType !== 'text') return raw;
								return pruneRawPlayerText(this, raw);
							}
						});
					}

					if (origRespDesc && typeof origRespDesc.get === 'function') {
						Object.defineProperty(XHRProto, 'response', {
							configurable: true,
							enumerable: origRespDesc.enumerable,
							get: function() {
								if (this.__nvirya_yt_ad_blocked) return this.responseType === 'json' ? {} : '{}';
								const res = origRespDesc.get.call(this);
								if (!this.__nvirya_yt_url || !YT_PLAYER_ENDPOINT_RE.test(this.__nvirya_yt_url)) return res;
								if (typeof res === 'string') return pruneRawPlayerText(this, res);
								if (res && typeof res === 'object' && this.responseType === 'json') {
									try { cleanYoutubePlayerObj(res); } catch (e) {}
								}
								return res;
							}
						});
					}

					try { Object.defineProperty(XHRProto, '__nvirya_yt_xhr_proto', { value: true }); } catch (e) {}
				}
			} catch (e) {}

			return;
		}

		const RE_SHIELD_AD_URL = /(?:^|\.|\/\/)(?:doubleclick|googlesyndication|googleadservices|adservice\.google|pagead2?|googletagservices|adsystem\.amazon|amazon-adsystem|adnxs|adsrvr|criteo|taboola|outbrain|outbrainimg|zemanta|mgid|pubmatic|rubiconproject|openx|smartadserver|scorecardresearch|moatads|doubleverify|adsafeprotected|quantserve|quantcast|highrevenueformat|cloudiniry|p7jeusk9n|kettledroopingcontinuation|zoologyfibre|effectivegatecpm|profitablegatecpm|highcpmgate|topcpmgate|revenuecpmgate|cpmrevenuegate|al5sm|co5n|optimalcpm|formatcpm|creativecpm|richcpm|484r|bvtpk|genaalkyls|bebangcaromel|casherscamize|nucleindinkly|kirpankinky|rushloiters|urosomeentrec|pucksdopes|ay267|bblaa|405kk|luugy|a-ads|balauplease|monetag|propellerads|admaven|ad-maven|popads|popcash|adsterra|exoclick|onclickmax|wingsmob)(?:\.|\/|$)|https?:\/\/[^/\s]+\.(?:qpon|cfd|sbs|cyou|icu|rest|bar|buzz|monster|cam|hair|skin|quest)(?:[\/:?#]|$)|(?:^|\/)(?:pagead\/show_ads\.js|pagead\/js\/adsbygoogle\.js|tag\/js\/gpt\.js|outbrain\.js|apu\.php|cgi-bin\/(?:dl|pop|jump|gate|out|tracker).*\.cgi|(?:\/|^)ad[_-]?(?:gate|jump|direct|click))(?:\/|\.|$)/i;

		const scheduleAsyncTask = (fn) => {
			if (typeof queueMicrotask === 'function') queueMicrotask(fn);
			else setTimeout(fn, 0);
		};

		const markNativeFn = (fn, name) => {
			try {
				const nativeStr = `function ${name || ''}() { [native code] }`;
				Object.defineProperty(fn, 'toString', {
					configurable: true,
					writable: true,
					enumerable: false,
					value: () => nativeStr
				});
			} catch (e) {}
			return fn;
		};

		const createSelfHealingMock = (overrides = {}, nameHint = 'mock', depth = 0) => {
			const childCache = new Map();
			const baseFn = markNativeFn(function() {}, nameHint);
			let proxyRef = null;

			const handler = {
				get(target, prop, receiver) {
					if (prop === '__isNviryaMock') return true;
					if (prop === 'then') return undefined;
					if (overrides && Object.prototype.hasOwnProperty.call(overrides, prop)) {
						return overrides[prop];
					}
					if (prop === Symbol.toPrimitive) {
						return (hint) => (hint === 'number' ? 1 : (hint === 'string' ? '' : true));
					}
					if (prop === Symbol.iterator) {
						return function*() {};
					}
					if (prop === Symbol.toStringTag) return 'Object';
					if (prop === 'valueOf') return () => true;
					if (prop === 'toString') return () => `function ${String(nameHint || '')}() { [native code] }`;
					if (prop === 'prototype') return target.prototype || Object.prototype;
					if (prop === 'constructor') return Object;

					if (typeof prop === 'string') {
						if (/^(?:loaded|ready|apiReady|pubadsReady|isInitialized|enabled|isSupported|active)$/.test(prop)) return true;
						if (/^(?:isEmpty|isBlocked|adblock|detected|blocked|error)$/.test(prop)) return false;
						if (prop === 'version') return '2.16.0';
						if (prop === 'length') return 0;
						if (prop === 'push') {
							return markNativeFn(function(...items) {
								for (let i = 0; i < items.length; i++) {
									const item = items[i];
									if (typeof item === 'function') {
										scheduleAsyncTask(() => { try { item(); } catch (e) {} });
									}
								}
								return items.length;
							}, 'push');
						}
						if (prop === 'catch' || prop === 'finally') {
							return markNativeFn(() => Promise.resolve(proxyRef), prop);
						}
						if (/^(?:forEach|filter|slice|splice|map)$/.test(prop)) {
							return markNativeFn(() => [], prop);
						}
					}

					if (Reflect.has(target, prop)) {
						return Reflect.get(target, prop, receiver);
					}

					if (depth > 8) return markNativeFn(() => proxyRef, String(prop));
					if (!childCache.has(prop)) {
						childCache.set(prop, createSelfHealingMock({}, typeof prop === 'string' ? prop : 'mock', depth + 1));
					}
					return childCache.get(prop);
				},
				set(target, prop, value) {
					try {
						overrides[prop] = value;
						target[prop] = value;
					} catch (e) {}
					return true;
				},
				has() {
					return true;
				},
				apply(target, thisArg, args) {
					if (overrides && typeof overrides.__call === 'function') {
						try { return overrides.__call.apply(thisArg, args); } catch (e) {}
					}
					if (args && args.length > 0 && /^(?:cmd|ready|fetchBids|onNotDetected|onNotDetectedOnce|check|getAdserverTargeting)$/i.test(String(nameHint || ''))) {
						for (let i = 0; i < args.length; i++) {
							if (typeof args[i] === 'function') {
								const cb = args[i];
								scheduleAsyncTask(() => { try { cb([]); } catch (e) {} });
							}
						}
					}
					return proxyRef;
				},
				construct() {
					return proxyRef;
				},
				getOwnPropertyDescriptor(target, prop) {
					if (overrides && Object.prototype.hasOwnProperty.call(overrides, prop)) {
						return { configurable: true, enumerable: true, writable: true, value: overrides[prop] };
					}
					if (Reflect.has(target, prop)) {
						return Object.getOwnPropertyDescriptor(target, prop);
					}
					return { configurable: true, enumerable: true, writable: true, value: handler.get(target, prop, proxyRef) };
				}
			};

			proxyRef = new Proxy(baseFn, handler);
			return proxyRef;
		};

		const defineResilientGlobal = (prop, stubValue, mergeExisting = false) => {
			try {
				let currentVal = stubValue;
				const existing = W[prop];
				if (mergeExisting && existing && typeof existing === 'object' && !existing.__isNviryaMock) {
					try { Object.assign(currentVal, existing); } catch (e) {}
				}
				Object.defineProperty(W, prop, {
					configurable: true,
					enumerable: true,
					get: () => currentVal,
					set: (newVal) => {
						if (newVal && typeof newVal === 'object') {
							try {
								if (Array.isArray(newVal) && Array.isArray(currentVal.cmd)) {
									for (let i = 0; i < newVal.length; i++) currentVal.cmd.push(newVal[i]);
								}
							} catch (e) {}
						}
					}
				});
			} catch (e) {
				try { W[prop] = stubValue; } catch (e2) {}
			}
		};

		const ensureVendorGlobalsPopulated = () => {
			try {
				if (!W.OBR || !W.OBR.__isNviryaMock) {
					const obrExtern = createSelfHealingMock({
						researchWidget: markNativeFn(() => true, 'researchWidget'),
						reloadWidget: markNativeFn(() => true, 'reloadWidget'),
						refreshWidget: markNativeFn(() => true, 'refreshWidget'),
						renderSpaWidgets: markNativeFn(() => true, 'renderSpaWidgets'),
						cancelRecommendation: markNativeFn(() => true, 'cancelRecommendation'),
						onOdbReturn: markNativeFn(() => true, 'onOdbReturn'),
						getCountOfCells: markNativeFn(() => 4, 'getCountOfCells'),
						getStat: markNativeFn(() => ({}), 'getStat'),
						video: createSelfHealingMock({
							init: markNativeFn(() => true, 'init'),
							startPlayer: markNativeFn(() => true, 'startPlayer')
						}, 'video')
					}, 'extern');
					const obrStub = createSelfHealingMock({
						ready: true,
						isInitialized: true,
						version: '2.16.0',
						extern: obrExtern,
						controller: createSelfHealingMock({}, 'controller'),
						display: createSelfHealingMock({}, 'display')
					}, 'OBR');
					defineResilientGlobal('OBR', obrStub, true);
					defineResilientGlobal('outbrain', obrStub, false);
					defineResilientGlobal('outbrain_rater', createSelfHealingMock({}, 'outbrain_rater'), false);
					try { W.OB_releaseVer = '20260401'; } catch (e) {}
				}
			} catch (e) {}

			try {
				const existingGpt = W.googletag;
				const preQueuedCmds = (existingGpt && Array.isArray(existingGpt.cmd)) ? existingGpt.cmd.slice() : [];
				if (!existingGpt || !existingGpt.__isNviryaMock) {
					const cmdQueue = [];
					cmdQueue.push = markNativeFn(function(...fns) {
						for (let i = 0; i < fns.length; i++) {
							const fn = fns[i];
							if (typeof fn === 'function') {
								scheduleAsyncTask(() => { try { fn(); } catch (err) {} });
							}
						}
						return Array.prototype.push.apply(this, fns);
					}, 'push');

					const createGptSlot = (adUnitPath, size, optDiv) => {
						let slotMock = null;
						slotMock = createSelfHealingMock({
							addService: markNativeFn(() => slotMock, 'addService'),
							setTargeting: markNativeFn(() => slotMock, 'setTargeting'),
							updateTargetingFromMap: markNativeFn(() => slotMock, 'updateTargetingFromMap'),
							clearTargeting: markNativeFn(() => slotMock, 'clearTargeting'),
							defineSizeMapping: markNativeFn(() => slotMock, 'defineSizeMapping'),
							setCollapseEmptyDiv: markNativeFn(() => slotMock, 'setCollapseEmptyDiv'),
							setCategoryExclusion: markNativeFn(() => slotMock, 'setCategoryExclusion'),
							setClickUrl: markNativeFn(() => slotMock, 'setClickUrl'),
							getSlotElementId: markNativeFn(() => optDiv || 'div-gpt-ad-1', 'getSlotElementId'),
							getAdUnitPath: markNativeFn(() => adUnitPath || '/0/adunit', 'getAdUnitPath'),
							getTargeting: markNativeFn(() => [], 'getTargeting'),
							getTargetingKeys: markNativeFn(() => [], 'getTargetingKeys'),
							getSizes: markNativeFn(() => Array.isArray(size) ? size : [
								[300, 250]
							], 'getSizes'),
							getResponseInformation: markNativeFn(() => ({
								advertiserId: 1,
								campaignId: 1,
								creativeId: 1,
								lineItemId: 1,
								sourceAgnosticCreativeId: 1,
								sourceAgnosticLineItemId: 1
							}), 'getResponseInformation')
						}, 'Slot');
						return slotMock;
					};

					const slotsList = [createGptSlot('/1/main', [300, 250], 'div-gpt-ad-1')];
					let pubadsService = null;
					pubadsService = createSelfHealingMock({
						addEventListener: markNativeFn((type, listener) => {
							if (typeof listener === 'function') {
								const tStr = String(type || '');
								if (tStr === 'slotRenderEnded' || tStr === 'slotOnload' || tStr === 'impressionViewable' || tStr === 'slotRequested') {
									setTimeout(() => {
										try {
											listener({
												isEmpty: false,
												slot: slotsList[0] || createGptSlot(),
												creativeId: 1001,
												lineItemId: 2001,
												serviceName: 'publisher_ads',
												size: [300, 250],
												sourceAgnosticCreativeId: 1001,
												sourceAgnosticLineItemId: 2001
											});
										} catch (e) {}
									}, 15);
								}
							}
							return pubadsService;
						}, 'addEventListener'),
						removeEventListener: markNativeFn(() => true, 'removeEventListener'),
						enableSingleRequest: markNativeFn(() => true, 'enableSingleRequest'),
						enableAsyncRendering: markNativeFn(() => true, 'enableAsyncRendering'),
						enableSyncRendering: markNativeFn(() => true, 'enableSyncRendering'),
						enableLazyLoad: markNativeFn(() => true, 'enableLazyLoad'),
						collapseEmptyDivs: markNativeFn(() => true, 'collapseEmptyDivs'),
						disableInitialLoad: markNativeFn(() => true, 'disableInitialLoad'),
						setTargeting: markNativeFn(() => pubadsService, 'setTargeting'),
						clearTargeting: markNativeFn(() => pubadsService, 'clearTargeting'),
						getTargeting: markNativeFn(() => [], 'getTargeting'),
						getTargetingKeys: markNativeFn(() => [], 'getTargetingKeys'),
						setCentering: markNativeFn(() => undefined, 'setCentering'),
						setLocation: markNativeFn(() => pubadsService, 'setLocation'),
						setPublisherProvidedId: markNativeFn(() => pubadsService, 'setPublisherProvidedId'),
						setPrivacySettings: markNativeFn(() => pubadsService, 'setPrivacySettings'),
						setRequestNonPersonalizedAds: markNativeFn(() => pubadsService, 'setRequestNonPersonalizedAds'),
						getSlots: markNativeFn(() => slotsList, 'getSlots'),
						getSlotIdMap: markNativeFn(() => ({}), 'getSlotIdMap'),
						refresh: markNativeFn(() => true, 'refresh'),
						clear: markNativeFn(() => true, 'clear'),
						display: markNativeFn(() => true, 'display'),
						isInitialLoadDisabled: markNativeFn(() => false, 'isInitialLoadDisabled')
					}, 'PubAdsService');

					const createSizeMappingBuilder = () => {
						let builder = null;
						builder = createSelfHealingMock({
							addSize: markNativeFn(() => builder, 'addSize'),
							build: markNativeFn(() => [], 'build')
						}, 'SizeMappingBuilder');
						return builder;
					};

					const gptStub = createSelfHealingMock({
						apiReady: true,
						pubadsReady: true,
						cmd: cmdQueue,
						pubads: markNativeFn(() => pubadsService, 'pubads'),
						companionAds: markNativeFn(() => createSelfHealingMock({}, 'CompanionAdsService'), 'companionAds'),
						content: markNativeFn(() => createSelfHealingMock({}, 'ContentService'), 'content'),
						defineSlot: markNativeFn((adUnitPath, size, optDiv) => {
							const s = createGptSlot(adUnitPath, size, optDiv);
							slotsList.push(s);
							return s;
						}, 'defineSlot'),
						defineOutOfPageSlot: markNativeFn((adUnitPath, optDiv) => {
							const s = createGptSlot(adUnitPath, [1, 1], optDiv);
							slotsList.push(s);
							return s;
						}, 'defineOutOfPageSlot'),
						defineUnit: markNativeFn((adUnitPath, size, optDiv) => createGptSlot(adUnitPath, size, optDiv), 'defineUnit'),
						sizeMapping: markNativeFn(createSizeMappingBuilder, 'sizeMapping'),
						enableServices: markNativeFn(() => true, 'enableServices'),
						display: markNativeFn(() => true, 'display'),
						destroySlots: markNativeFn(() => true, 'destroySlots'),
						openConsole: markNativeFn(() => undefined, 'openConsole'),
						getVersion: markNativeFn(() => '2026040101', 'getVersion'),
						enums: createSelfHealingMock({ OutOfPageFormat: { INTERSTITIAL: 1, TOP_ANCHOR: 2, BOTTOM_ANCHOR: 3 } }, 'enums')
					}, 'googletag');

					defineResilientGlobal('googletag', gptStub, false);
					for (let i = 0; i < preQueuedCmds.length; i++) {
						if (typeof preQueuedCmds[i] === 'function') {
							scheduleAsyncTask(() => { try { preQueuedCmds[i](); } catch (err) {} });
						}
					}
				}
			} catch (e) {}

			try {
				if (!W.Criteo || !W.Criteo.__isNviryaMock) {
					defineResilientGlobal('Criteo', createSelfHealingMock({
						events: {
							push: markNativeFn((fn) => {
								if (typeof fn === 'function') scheduleAsyncTask(() => { try { fn(); } catch (e) {} });
								return 1;
							}, 'push')
						},
						DisplayAd: markNativeFn(() => true, 'DisplayAd'),
						DisplayAcceptableAdIfAdblocked: markNativeFn(() => true, 'DisplayAcceptableAdIfAdblocked'),
						CallRTA: markNativeFn(() => true, 'CallRTA'),
						ComputeStandalone: markNativeFn(() => true, 'ComputeStandalone'),
						Passback: createSelfHealingMock({}, 'Passback'),
						pubTag: createSelfHealingMock({}, 'pubTag')
					}, 'Criteo'), false);
				}
				if (!W._taboola || !W._taboola.__isNviryaMock) {
					const taboolaArr = [];
					taboolaArr.__isNviryaMock = true;
					taboolaArr.push = markNativeFn(function() { return this.length; }, 'push');
					defineResilientGlobal('_taboola', taboolaArr, false);
					defineResilientGlobal('TRC', createSelfHealingMock({ ready: true }, 'TRC'), false);
				}
				if (!W.apstag || !W.apstag.__isNviryaMock) {
					defineResilientGlobal('apstag', createSelfHealingMock({
						init: markNativeFn(() => true, 'init'),
						fetchBids: markNativeFn((cfg, cb) => {
							if (typeof cb === 'function') scheduleAsyncTask(() => { try { cb([]); } catch (e) {} });
							return Promise.resolve([]);
						}, 'fetchBids'),
						setDisplayBids: markNativeFn(() => true, 'setDisplayBids'),
						targetingKeys: markNativeFn(() => [], 'targetingKeys'),
						cleared: markNativeFn(() => true, 'cleared')
					}, 'apstag'), false);
				}
				if (!W.COMSCORE || !W.COMSCORE.__isNviryaMock) {
					defineResilientGlobal('COMSCORE', createSelfHealingMock({
						beacon: markNativeFn(() => true, 'beacon'),
						purge: markNativeFn(() => [], 'purge')
					}, 'COMSCORE'), false);
				}
			} catch (e) {}
		};

		const isChallengeActive = () => {
			try {
				if (W.__nvirya_has_security_challenge || W._cf_chl_opt || W.__cf$cv$params) return true;
				if (D.querySelector && D.querySelector('#challenge-running, #challenge-stage, #challenge-form, #cf-wrapper, .cf-turnstile, script[src*="/cdn-cgi/challenge-platform/"], script[src*="challenges.cloudflare.com"]')) {
					W.__nvirya_has_security_challenge = true;
					return true;
				}
			} catch (e) {}
			return false;
		};

		ensureVendorGlobalsPopulated();
		const RE_SHIELD_INLINE = /apu\.php\?zoneid|484r\.com|bvtpk\.com|rushloiters|kirpankinky|pucksdopes|bebangcaromel|casherscamize|nucleindinkly|genaalkyls|urosomeentrec|_vrx|atOptions|popunder|(?:[?&]zoneid=\d{5,}|['"]zoneid['"]\s*:\s*['"]?\d{5,})|dataset\.zone\s*=|createElement\(['"]script['"]\)[\s\S]{0,240}?https?:\/\/[a-z0-9.-]+\.(?:cfd|qpon|sbs|cyou|icu|rest|buzz|monster|cam|hair|skin|quest)(?:[\/:'"?#]|$)/i;

		const RE_TRAP_EVENT_TYPES = /^(?:click|mousedown|mouseup|pointerdown|pointerup|touchstart|touchend|contextmenu|blur|focus|beforeunload)$/i;

		const isSecurityStack = () => {
			try {
				const cs = D.currentScript;
				if (cs) {
					const src = cs.src || (cs.getAttribute && cs.getAttribute('src')) || '';
					if (/challenge-platform|challenges\.cloudflare|turnstile|hcaptcha|recaptcha|ddos-guard|arkoselabs|funcaptcha|geetest/i.test(src)) return true;
				}
				const st = (new Error().stack) || '';
				return /challenge-platform|challenges\.cloudflare|turnstile|hcaptcha|recaptcha|ddos-guard|arkoselabs|funcaptcha|geetest/i.test(st);
			} catch (e) { return false; }
		};

		const isAdStack = () => {
			try {
				if (isChallengeActive()) return false;
				const cs = D.currentScript;
				if (cs) {
					const src = cs.src || (cs.getAttribute && cs.getAttribute('src')) || '';
					if (src) return !/eruda|vconsole|chobitsu|challenge-platform|challenges\.cloudflare|turnstile|hcaptcha|recaptcha/i.test(src) && RE_SHIELD_AD_URL.test(src);
				}
				const st = (new Error().stack) || '';
				if (!st || /eruda|vconsole|chobitsu|challenge-platform|challenges\.cloudflare|turnstile|hcaptcha|recaptcha/i.test(st)) return false;
				return RE_SHIELD_AD_URL.test(st);
			} catch (e) { return false; }
		};

		try {
			const origST = W.setTimeout;
			const origSI = W.setInterval;
			if (typeof origST === 'function') {
				W.setTimeout = markNativeFn(function(fn, delay) {
					if (!isChallengeActive()) {
						if (typeof fn === 'string') {
							if (RE_SHIELD_INLINE.test(fn)) return 0;
						} else if (D.currentScript && isAdStack()) {
							return 0;
						}
					}
					return origST.apply(this, arguments);
				}, 'setTimeout');
			}
			if (typeof origSI === 'function') {
				W.setInterval = markNativeFn(function(fn, delay) {
					if (!isChallengeActive()) {
						if (typeof fn === 'string') {
							if (RE_SHIELD_INLINE.test(fn)) return 0;
						} else if (D.currentScript && isAdStack()) {
							return 0;
						}
					}
					return origSI.apply(this, arguments);
				}, 'setInterval');
			}
		} catch (e) {}

		try {
			const origAEL = W.EventTarget && W.EventTarget.prototype && W.EventTarget.prototype.addEventListener;
			if (typeof origAEL === 'function') {
				W.EventTarget.prototype.addEventListener = markNativeFn(function(type, listener, options) {
					if (RE_TRAP_EVENT_TYPES.test(String(type || '')) && isAdStack()) return;
					return origAEL.apply(this, arguments);
				}, 'addEventListener');
			}
		} catch (e) {}

		try {
			const elProto = W.Element && W.Element.prototype;
			if (elProto && typeof elProto.attachShadow === 'function' && !elProto.attachShadow.__nvirya) {
				const origAttachShadow = elProto.attachShadow;
				const patchedAttachShadow = markNativeFn(function(init) {
					try {
						const isOwnUi = this.hasAttribute && (this.hasAttribute('data-nvirya-ui') || this.hasAttribute('data-nvirya-picker'));
						if (!isOwnUi) {
							if (isSecurityStack() || (this.classList && (this.classList.contains('cf-turnstile') || this.hasAttribute('data-sitekey')))) {
								try {
									this.setAttribute('data-nvirya-safe', 'captcha');
									W.__nvirya_has_security_challenge = true;
								} catch (e) {}
								return origAttachShadow.apply(this, arguments);
							}
							if (isAdStack()) {
								try {
									this.style.setProperty('display', 'none', 'important');
									this.remove();
								} catch (e) {}
								const dummyHost = D.createElement('div');
								return origAttachShadow.call(dummyHost, { mode: 'open' });
							}
						}
					} catch (e) {}
					return origAttachShadow.apply(this, arguments);
				}, 'attachShadow');
				try { Object.defineProperty(patchedAttachShadow, '__nvirya', { value: true }); } catch (e) {}
				elProto.attachShadow = patchedAttachShadow;
			}
		} catch (e) {}

		const isBlockedScriptEl = (node) => {
			if (!node || node.nodeType !== 1 || String(node.tagName || '').toLowerCase() !== 'script') return false;
			if (isChallengeActive()) return false;
			const src = node.src || (node.getAttribute && node.getAttribute('src')) || '';
			if (src && /eruda|vconsole|chobitsu|challenge-platform|challenges\.cloudflare|turnstile|hcaptcha|recaptcha|ddos-guard|arkoselabs|funcaptcha|geetest/i.test(src)) {
				if (/challenge-platform|challenges\.cloudflare|turnstile/i.test(src)) W.__nvirya_has_security_challenge = true;
				return false;
			}
			const zone = (node.dataset && node.dataset.zone) || (node.getAttribute && node.getAttribute('data-zone')) || '';
			const text = !src ? (node.textContent || '') : '';
			if (text && (/eruda|vconsole|chobitsu|_cf_chl_opt|__cf\$cv\$params|challenge-platform|cf-turnstile/i.test(text))) {
				if (/_cf_chl_opt|__cf\$cv\$params|challenge-platform/i.test(text)) W.__nvirya_has_security_challenge = true;
				return false;
			}
			return !!(zone || (src && RE_SHIELD_AD_URL.test(src)) || (text && RE_SHIELD_INLINE.test(text)));
		};

		const hookBlockedScriptListeners = (el) => {
			if (!el || el.__nvirya_ael_hooked) return;
			try { el.__nvirya_ael_hooked = true; } catch (e) {}
			try {
				const origElAEL = el.addEventListener;
				if (typeof origElAEL === 'function') {
					el.addEventListener = function(type, listener, options) {
						if (String(type || '').toLowerCase() === 'error') return;
						return origElAEL.apply(this, arguments);
					};
				}
			} catch (e) {}
		};

		const spoofScriptOnload = (el, spoofUrl) => {
			if (!el) return;
			if (spoofUrl) {
				try { el.__nvirya_spoof_src = String(spoofUrl); } catch (e) {}
			}
			hookBlockedScriptListeners(el);
			try { el.onerror = null; } catch (e) {}
			if (el.__nvirya_onload_spoofed) return;
			try { el.__nvirya_onload_spoofed = true; } catch (e) {}
			const fireLoad = () => {
				try {
					ensureVendorGlobalsPopulated();
					try { el.readyState = 'complete'; } catch (e) {}
					const evt = typeof CustomEvent === 'function' ?
						new Event('load', { bubbles: false, cancelable: false }) :
						new Event('load');
					if (typeof el.onload === 'function') el.onload.call(el, evt);
					if (typeof el.dispatchEvent === 'function') el.dispatchEvent(evt);
				} catch (e) {}
			};
			scheduleAsyncTask(() => {
				setTimeout(fireLoad, 0);
			});
		};

		const killScriptNode = (node) => {
			if (!isBlockedScriptEl(node)) return false;
			const rawSrc = (node && (node.src || (node.getAttribute && node.getAttribute('src')))) || '';
			try {
				node.type = 'javascript/blocked';
				node.removeAttribute('src');
				node.removeAttribute('data-zone');
				node.textContent = '';
				spoofScriptOnload(node, rawSrc);
			} catch (e) {}
			return true;
		};

		try {
			D.addEventListener('beforescriptexecute', (e) => {
				if (killScriptNode(e.target)) {
					e.preventDefault();
					e.stopPropagation();
				}
			}, true);
		} catch (e) {}

		try {
			const scriptKillerObs = new MutationObserver((mutations) => {
				for (let i = 0; i < mutations.length; i++) {
					const m = mutations[i];
					if (m.type === 'attributes') {
						killScriptNode(m.target);
						continue;
					}
					const added = m.addedNodes;
					for (let j = 0; j < added.length; j++) {
						const n = added[j];
						if (!n || n.nodeType !== 1) continue;
						if (String(n.tagName || '').toLowerCase() === 'script') {
							killScriptNode(n);
						} else if (n.querySelectorAll) {
							const scripts = n.querySelectorAll('script');
							for (let k = 0; k < scripts.length; k++) killScriptNode(scripts[k]);
						}
					}
				}
			});
			scriptKillerObs.observe(D, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'data-zone'] });
			const existingScripts = D.querySelectorAll ? D.querySelectorAll('script') : [];
			for (let i = 0; i < existingScripts.length; i++) killScriptNode(existingScripts[i]);
			W.addEventListener('load', () => {
				setTimeout(() => { try { scriptKillerObs.disconnect(); } catch (e) {} }, 6000);
			}, { once: true });
		} catch (e) {}

		try {
			const scriptProto = W.HTMLScriptElement && W.HTMLScriptElement.prototype;
			if (scriptProto) {
				const origSrcDesc = Object.getOwnPropertyDescriptor(scriptProto, 'src');
				if (origSrcDesc && origSrcDesc.set) {
					const origSet = origSrcDesc.set;
					Object.defineProperty(scriptProto, 'src', {
						configurable: true,
						enumerable: origSrcDesc.enumerable,
						set: function(val) {
							const sVal = String(val || '');
							if (!/eruda|vconsole|chobitsu/i.test(sVal) && (RE_SHIELD_AD_URL.test(sVal) || (this.dataset && this.dataset.zone))) {
								this.type = 'javascript/blocked';
								spoofScriptOnload(this, sVal);
								return;
							}
							return origSet.call(this, val);
						},
						get: function() {
							if (this.__nvirya_spoof_src) return this.__nvirya_spoof_src;
							return origSrcDesc.get ? origSrcDesc.get.call(this) : '';
						}
					});
				}
				const origSetAttr = scriptProto.setAttribute;
				if (typeof origSetAttr === 'function') {
					scriptProto.setAttribute = function(name, val) {
						const n = String(name || '').toLowerCase();
						const v = String(val || '');
						if ((n === 'src' && !/eruda|vconsole|chobitsu/i.test(v) && RE_SHIELD_AD_URL.test(v)) || n === 'data-zone') {
							this.type = 'javascript/blocked';
							spoofScriptOnload(this, v);
							return;
						}
						return origSetAttr.apply(this, arguments);
					};
				}
				const origCreateEl = D.createElement;
				if (typeof origCreateEl === 'function' && !origCreateEl.__nvirya_mw_ce) {
					const mwCreateEl = function(tagName) {
						const el = origCreateEl.apply(this, arguments);
						if (String(tagName || '').toLowerCase() === 'script') {
							hookBlockedScriptListeners(el);
						}
						return el;
					};
					try { Object.defineProperty(mwCreateEl, '__nvirya_mw_ce', { value: true }); } catch (e) {}
					D.createElement = mwCreateEl;
				}
				const nodeProto = W.Node && W.Node.prototype;
				if (nodeProto && !nodeProto.__nvirya_mw_append) {
					const origAppend = nodeProto.appendChild;
					const origInsert = nodeProto.insertBefore;
					nodeProto.appendChild = function(child) {
						if (child && child.nodeType === 1 && String(child.tagName || '').toLowerCase() === 'script') {
							if (child.__nvirya_spoof_src || isBlockedScriptEl(child)) {
								spoofScriptOnload(child, child.__nvirya_spoof_src || child.src);
								return child;
							}
						}
						return origAppend.apply(this, arguments);
					};
					nodeProto.insertBefore = function(child, ref) {
						if (child && child.nodeType === 1 && String(child.tagName || '').toLowerCase() === 'script') {
							if (child.__nvirya_spoof_src || isBlockedScriptEl(child)) {
								spoofScriptOnload(child, child.__nvirya_spoof_src || child.src);
								return child;
							}
						}
						return origInsert.apply(this, arguments);
					};
					try { Object.defineProperty(nodeProto, '__nvirya_mw_append', { value: true }); } catch (e) {}
				}
			}
		} catch (e) {}

		try {
			const origFunction = W.Function;
			const patchedFunction = markNativeFn(function() {
				if (!isChallengeActive() && !isSecurityStack()) {
					const bodyStr = Array.prototype.join.call(arguments, ' ');
					if (bodyStr.includes('_vrx') || RE_SHIELD_INLINE.test(bodyStr)) {
						return function() {};
					}
				}
				return origFunction.apply(this, arguments);
			}, 'Function');
			patchedFunction.prototype = origFunction.prototype;
			try {
				Object.defineProperty(W, 'Function', {
					configurable: true,
					writable: true,
					value: patchedFunction
				});
			} catch (e) {
				W.Function = patchedFunction;
			}
		} catch (e) {}

		try {
			const purgeMqc = () => {
				try {
					if (W.localStorage) {
						for (let i = W.localStorage.length - 1; i >= 0; i--) {
							const k = W.localStorage.key(i);
							if (k && /^mqc/i.test(k)) W.localStorage.removeItem(k);
						}
					}
				} catch (e) {}
				try {
					const cookies = (D.cookie || '').split(';');
					for (let i = 0; i < cookies.length; i++) {
						const name = cookies[i].split('=')[0].trim();
						if (/^mqc/i.test(name)) {
							D.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + location.hostname;
							D.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;';
						}
					}
				} catch (e) {}
			};
			purgeMqc();
			if (W.Storage && W.Storage.prototype) {
				const origGetItem = W.Storage.prototype.getItem;
				W.Storage.prototype.getItem = function(key) {
					if (typeof key === 'string' && /^mqc/i.test(key)) return null;
					return origGetItem.apply(this, arguments);
				};
				const origSetItem = W.Storage.prototype.setItem;
				W.Storage.prototype.setItem = function(key, val) {
					if (typeof key === 'string' && /^mqc/i.test(key)) return;
					return origSetItem.apply(this, arguments);
				};
			}
		} catch (e) {}

		const spoofAdImageElement = (imgEl, urlStr) => {
			if (!imgEl) return;
			try {
				imgEl.__nvirya_spoof_img = true;
				imgEl.__nvirya_spoof_src = String(urlStr || '');
				imgEl.onerror = null;
				['width', 'height', 'naturalWidth', 'naturalHeight'].forEach((p) => {
					try { Object.defineProperty(imgEl, p, { configurable: true, get: () => 32 }); } catch (e) {}
				});
				try { Object.defineProperty(imgEl, 'complete', { configurable: true, get: () => true }); } catch (e) {}
			} catch (e) {}
			if (!imgEl.__nvirya_img_scheduled) {
				try { imgEl.__nvirya_img_scheduled = true; } catch (e) {}
				setTimeout(() => {
					try {
						const evt = new Event('load');
						if (typeof imgEl.onload === 'function') imgEl.onload(evt);
						if (typeof imgEl.dispatchEvent === 'function') imgEl.dispatchEvent(evt);
					} catch (e) {}
				}, 5);
			}
		};

		try {
			const imgProto = W.HTMLImageElement && W.HTMLImageElement.prototype;
			if (imgProto && !imgProto.__nvirya_img_proto_hooked) {
				const origSrcDesc = Object.getOwnPropertyDescriptor(imgProto, 'src');
				['width', 'height', 'naturalWidth', 'naturalHeight'].forEach((dimProp) => {
					const dDesc = Object.getOwnPropertyDescriptor(imgProto, dimProp);
					if (dDesc && typeof dDesc.get === 'function') {
						const origDimGet = dDesc.get;
						Object.defineProperty(imgProto, dimProp, {
							configurable: true,
							enumerable: dDesc.enumerable,
							get: function() {
								if (this.__nvirya_spoof_img) return 32;
								return origDimGet.call(this);
							},
							set: dDesc.set
						});
					}
				});
				if (origSrcDesc && origSrcDesc.set) {
					const origSet = origSrcDesc.set;
					const origGet = origSrcDesc.get;
					Object.defineProperty(imgProto, 'src', {
						configurable: true,
						enumerable: origSrcDesc.enumerable,
						set: function(val) {
							const sVal = String(val || '');
							if (sVal && !sVal.startsWith('data:') && RE_SHIELD_AD_URL.test(sVal)) {
								spoofAdImageElement(this, sVal);
								return;
							}
							return origSet.call(this, val);
						},
						get: function() {
							if (this.__nvirya_spoof_src) return this.__nvirya_spoof_src;
							return origGet ? origGet.call(this) : '';
						}
					});
				}
				const origImgSetAttr = imgProto.setAttribute;
				if (typeof origImgSetAttr === 'function') {
					imgProto.setAttribute = function(name, val) {
						if (String(name || '').toLowerCase() === 'src') {
							const sVal = String(val || '');
							if (sVal && !sVal.startsWith('data:') && RE_SHIELD_AD_URL.test(sVal)) {
								spoofAdImageElement(this, sVal);
								return;
							}
						}
						return origImgSetAttr.apply(this, arguments);
					};
				}
				try { Object.defineProperty(imgProto, '__nvirya_img_proto_hooked', { value: true }); } catch (e) {}
			}
		} catch (e) {}

		try {
			const makeMainFakeResponse = (urlStr, input, init) => {
				const u = String(urlStr || '');
				let accept = '';
				try {
					const hdrs = (init && init.headers) || (input && typeof input === 'object' && input.headers);
					if (hdrs) {
						if (typeof hdrs.get === 'function') accept = String(hdrs.get('accept') || hdrs.get('Accept') || '');
						else if (typeof hdrs === 'object') {
							for (const k in hdrs)
								if (k.toLowerCase() === 'accept') accept = String(hdrs[k] || '');
						}
					}
				} catch (e) {}
				const isJson = /application\/json|\+json/i.test(accept) || /\.json(?:$|[?#])|[?&](?:format|output|alt)=json\b/i.test(u);
				const isJs = !isJson && (/javascript|ecmascript/i.test(accept) || /\.(?:m?js)(?:$|[?#])|\/(?:adsbygoogle|show_ads|gpt|pubads|pagead\/js|adserver)/i.test(u));
				const jsonObj = { status: 'ok', success: true, data: [] };
				const body = isJson ? JSON.stringify(jsonObj) : (isJs ? '/* Nvirya Stub OK */ window.canRunAds = true;' : '');
				const ct = isJson ? 'application/json' : (isJs ? 'application/javascript' : 'text/plain');
				if (typeof Response === 'function') {
					return new Response(body, { status: 200, statusText: 'OK', headers: { 'Content-Type': ct } });
				}
				return {
					ok: true,
					status: 200,
					statusText: 'OK',
					url: u,
					text: () => Promise.resolve(body),
					json: () => Promise.resolve(jsonObj),
					blob: () => Promise.resolve(typeof Blob === 'function' ? new Blob([body], { type: ct }) : null),
					arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
					clone: function() { return this; }
				};
			};

			if (typeof W.fetch === 'function' && !W.fetch.__nvirya_mw) {
				const origFetch = W.fetch;
				const mwFetch = function(input, init) {
					const urlStr = typeof input === 'string' ? input : (input && input.url) || '';
					if (urlStr && RE_YT_STREAM_SAFE.test(urlStr)) {
						return origFetch.apply(this, arguments);
					}
					if (urlStr && RE_SHIELD_AD_URL.test(urlStr)) {
						ensureVendorGlobalsPopulated();
						return Promise.resolve(makeMainFakeResponse(urlStr, input, init));
					}
					return origFetch.apply(this, arguments).catch((err) => {
						if (urlStr && (RE_SHIELD_AD_URL.test(urlStr) || /(?:doubleclick|googlesyndication|googleadservices|pagead|adservice|adserver|outbrain|taboola|criteo|ads\.|favicon\.ico\?\d+$)/i.test(urlStr))) {
							ensureVendorGlobalsPopulated();
							return makeMainFakeResponse(urlStr, input, init);
						}
						throw err;
					});
				};
				try { Object.defineProperty(mwFetch, '__nvirya_mw', { value: true }); } catch (e) {}
				W.fetch = mwFetch;
			}

			const XHR = W.XMLHttpRequest;
			if (XHR && XHR.prototype && !XHR.prototype.__nvirya_mw_xhr) {
				const origOpen = XHR.prototype.open;
				const origSend = XHR.prototype.send;
				const origSetHdr = XHR.prototype.setRequestHeader;
				if (typeof origSetHdr === 'function') {
					XHR.prototype.setRequestHeader = function(h, v) {
						if (String(h || '').toLowerCase() === 'accept') this.__nvirya_accept = String(v || '');
						if (this.__nvirya_mw_blocked) return;
						return origSetHdr.apply(this, arguments);
					};
				}
				XHR.prototype.open = function(method, url) {
					const uStr = String(url || '');
					this.__nvirya_mw_url = uStr;
					this.__nvirya_mw_blocked = Boolean(uStr && !RE_YT_STREAM_SAFE.test(uStr) && RE_SHIELD_AD_URL.test(uStr));
					if (this.__nvirya_mw_blocked) {
						try { return origOpen.call(this, method || 'GET', 'data:text/plain,'); } catch (e) { return; }
					}
					return origOpen.apply(this, arguments);
				};
				XHR.prototype.send = function() {
					if (this.__nvirya_mw_blocked) {
						const xhr = this;
						ensureVendorGlobalsPopulated();
						const u = xhr.__nvirya_mw_url || '';
						const acc = xhr.__nvirya_accept || '';
						const isJson = xhr.responseType === 'json' || /application\/json|\+json/i.test(acc) || /\.json(?:$|[?#])/i.test(u);
						const isJs = !isJson && (/javascript|ecmascript/i.test(acc) || /\.(?:m?js)(?:$|[?#])|\/(?:adsbygoogle|show_ads|pagead)/i.test(u));
						const jsonObj = { status: 'ok', success: true, data: [] };
						const bodyText = isJson ? JSON.stringify(jsonObj) : (isJs ? '/* Nvirya Stub OK */ window.canRunAds = true;' : '');
						const respVal = xhr.responseType === 'json' ? jsonObj : bodyText;
						try {
							Object.defineProperty(xhr, 'readyState', { configurable: true, get: () => 4 });
							Object.defineProperty(xhr, 'status', { configurable: true, get: () => 200 });
							Object.defineProperty(xhr, 'statusText', { configurable: true, get: () => 'OK' });
							Object.defineProperty(xhr, 'responseText', { configurable: true, get: () => bodyText });
							Object.defineProperty(xhr, 'response', { configurable: true, get: () => respVal });
						} catch (e) {}
						setTimeout(() => {
							try {
								if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange(new Event('readystatechange'));
								xhr.dispatchEvent(new Event('readystatechange'));
								if (typeof xhr.onload === 'function') xhr.onload(new Event('load'));
								xhr.dispatchEvent(new Event('load'));
								if (typeof xhr.onloadend === 'function') xhr.onloadend(new Event('loadend'));
								xhr.dispatchEvent(new Event('loadend'));
							} catch (e) {}
						}, 1);
						return;
					}
					return origSend.apply(this, arguments);
				};
				try { Object.defineProperty(XHR.prototype, '__nvirya_mw_xhr', { value: true }); } catch (e) {}
			}
		} catch (e) {}

		try {
			const RE_MW_BAIT = /ads?[-_]?box|adsbygoogle|banner[-_]?ad|ad[-_]?slot|ad[-_]?unit|ad[-_]?placement/i;
			const isMwBait = (el) => {
				if (!el || el.nodeType !== 1) return false;
				const idc = (el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : '');
				return RE_MW_BAIT.test(idc);
			};
			const htmlProto = W.HTMLElement && W.HTMLElement.prototype;
			if (htmlProto && !htmlProto.__nvirya_mw_dims) {
				const hookMwDim = (prop, fakeVal) => {
					const desc = Object.getOwnPropertyDescriptor(htmlProto, prop);
					if (!desc || typeof desc.get !== 'function') return;
					const origGet = desc.get;
					Object.defineProperty(htmlProto, prop, {
						configurable: true,
						enumerable: desc.enumerable,
						get: function() {
							const val = origGet.call(this);
							if (val === 0 && isMwBait(this)) return fakeVal;
							return val;
						}
					});
				};
				hookMwDim('offsetHeight', 250);
				hookMwDim('offsetWidth', 300);
				hookMwDim('clientHeight', 250);
				hookMwDim('clientWidth', 300);
				try { Object.defineProperty(htmlProto, '__nvirya_mw_dims', { value: true }); } catch (e) {}
			}
			if (typeof W.getComputedStyle === 'function' && !W.getComputedStyle.__nvirya_mw_cs) {
				const origCS = W.getComputedStyle.bind(W);
				const mwCS = function(el, pseudo) {
					const st = origCS(el, pseudo);
					if (!pseudo && el && el.nodeType === 1 && ((el.hasAttribute && el.hasAttribute('data-nvirya-hidden')) || isMwBait(el))) {
						return new Proxy(st, {
							get(target, prop) {
								if (prop === 'display') return 'block';
								if (prop === 'visibility') return 'visible';
								if (prop === 'opacity') return '1';
								if (prop === 'getPropertyValue') {
									return function(name) {
										const n = String(name || '').toLowerCase().trim();
										if (n === 'display') return 'block';
										if (n === 'visibility') return 'visible';
										if (n === 'opacity') return '1';
										return target.getPropertyValue(name);
									};
								}
								const v = target[prop];
								return typeof v === 'function' ? v.bind(target) : v;
							}
						});
					}
					return st;
				};
				try { Object.defineProperty(mwCS, '__nvirya_mw_cs', { value: true }); } catch (e) {}
				W.getComputedStyle = mwCS;
			}
		} catch (e) {}

		try {
			const dummyAt = { key: '', format: '', height: 0, width: 0, params: {} };
			Object.defineProperty(W, 'atOptions', {
				configurable: true,
				enumerable: true,
				get: () => dummyAt,
				set: () => {}
			});
		} catch (e) {
			try { W.atOptions = { key: '', format: '', height: 0, width: 0, params: {} }; } catch (e2) {}
		}

		try {
			W.canRunAds = true;
			W.isAdBlockActive = false;
			W.isAdBlockerActive = false;
			W.adblock = false;
			W.adBlockEnabled = false;
			W.google_jobrunner = {};
			W.google_ad_status = 1;
			W.google_ad_client = W.google_ad_client || 'ca-pub-0000000000000000';
			if (!W.adsbygoogle) {
				W.adsbygoogle = [];
			}
			W.adsbygoogle.loaded = true;
			if (typeof W.adsbygoogle.push !== 'function') {
				W.adsbygoogle.push = function() { return this.length || 0; };
			}
			const defuseGlobalProp = (prop, val) => {
				try {
					Object.defineProperty(W, prop, {
						configurable: true,
						enumerable: true,
						get: () => val,
						set: () => {}
					});
				} catch (err) {
					try { W[prop] = val; } catch (e2) {}
				}
			};
			defuseGlobalProp('canRunAds', true);
			defuseGlobalProp('isAdBlockActive', false);
			defuseGlobalProp('isAdBlockerActive', false);
			defuseGlobalProp('adblock', false);
			defuseGlobalProp('adBlockEnabled', false);
			defuseGlobalProp('google_jobrunner', {});
			defuseGlobalProp('google_ad_status', 1);
		} catch (e) {}

		try {
			const origOpen = W.open;

			let lastClickTarget = null;
			let lastClickTime = 0;

			const trackClick = (e) => {
				if (e.isTrusted) {
					lastClickTarget = e.target;
					lastClickTime = Date.now();
				}
			};
			['click', 'pointerdown', 'touchstart', 'mousedown'].forEach(evt => {
				D.addEventListener(evt, trackClick, true);
			});

			const triggerAdvance = () => {
				try {
					let active = D.activeElement;
					if (!active || active === D.body || active === D.documentElement) {
						if (Date.now() - lastClickTime < 1500 && lastClickTarget) active = lastClickTarget;
					}
					if (!active) return;
					const target = active.closest ? active.closest('button, a, input[type="submit"], input[type="button"]') : active;
					if (!target || target.__nvirya_retrying) return;
					target.__nvirya_retrying = true;
					setTimeout(() => {
						try {
							target.__nvirya_retrying = false;
							target.click();
						} catch (e) {}
					}, 60);
				} catch (e) {}
			};

			const makeDummy = () => ({
				closed: true,
				location: { href: 'about:blank', assign: () => {}, replace: () => {} },
				close: () => {},
				focus: () => {},
				blur: () => {},
				postMessage: () => {}
			});

			W.open = function(url, name, features) {
				if (W.__NVIRYA_PICKER_ACTIVE__) {
					return makeDummy();
				}
				const urlStr = String(url || '');
				if (RE_SHIELD_AD_URL.test(urlStr)) {
					triggerAdvance();
					return makeDummy();
				}
				return origOpen.apply(this, arguments);
			};
			if (W.Window && W.Window.prototype) {
				W.Window.prototype.open = W.open;
			}
		} catch (e) {}
	}

	function injectMainWorldShield() {
		try {
			const code = `(${mainWorldShield.toString()})();`;
			const doInject = () => {
				try {
					const container = D.documentElement || D.head || D.body;
					if (!container) return false;
					const script = D.createElement('script');
					script.textContent = code;
					container.insertBefore(script, container.firstChild);
					script.remove();
					return true;
				} catch (e) {
					return false;
				}
			};

			if (!doInject()) {
				const obs = new MutationObserver(() => {
					if (doInject()) obs.disconnect();
				});
				obs.observe(D, { childList: true });
			}
		} catch (e) {}
	}

	function isEarlyPageLoad(thresholdMs) {
		return (Date.now() - SCRIPT_START_TIME) < (thresholdMs || 6000);
	}

	const RE_CF_CHALLENGE_TITLE = /^(?:Just a moment|Attention Required|Checking your browser|Security Verification|DDoS-Guard|One moment, please|Chỉ một chút|Đang kiểm tra trình duyệt|请稍候|安全验证|しばらくお待ちください|Un momento|Veuillez patienter|Один момент|Nur einen Moment)/i;

	function isFullSecurityChallengePage() {
		try {
			const h = String((W.location && W.location.hostname) || '').toLowerCase().replace(/\.$/, '');
			if (RE_SECURITY_CHALLENGE_HOST.test(h)) return true;
			if (RE_SECURITY_CHALLENGE.test(location.href || '')) return true;
			if (W._cf_chl_opt || W.__cf$cv$params) return true;
			if (D.title && RE_CF_CHALLENGE_TITLE.test(D.title.trim())) return true;
			if (D.querySelector && D.querySelector('#challenge-running, #challenge-stage, #challenge-form, #cf-wrapper, #cf-please-wait, .cf-error-details, script[src*="/cdn-cgi/challenge-platform/"]')) return true;
		} catch (e) {}
		return false;
	}

	function isSecurityVerificationPage() {
		try {
			if (isFullSecurityChallengePage()) return true;
			if (W.__nvirya_has_security_challenge) return true;
			if (D.querySelector && D.querySelector('.cf-turnstile, [data-nvirya-safe="captcha"], input[name="cf-turnstile-response"], iframe[src*="challenges.cloudflare.com"], script[src*="challenges.cloudflare.com/turnstile"]')) return true;
		} catch (e) {}
		return false;
	}

	function isCaptchaOrTurnstileElement(el) {
		if (!el || el.nodeType !== 1) return false;
		try {
			let cur = el, depth = 0;
			while (cur && cur.nodeType === 1 && depth < 6) {
				if (attr(cur, 'data-nvirya-safe') === 'captcha') return true;
				const idc = ((cur.id || '') + ' ' + classString(cur)).toLowerCase();
				if (/(?:cf-turnstile|g-recaptcha|h-captcha|challenge-running|challenge-stage|challenge-form|cf-wrapper|turnstile|arkoselabs|funcaptcha|geetest)/i.test(idc)) return true;
				if (attr(cur, 'data-sitekey') !== null) return true;
				const src = attr(cur, 'src') || '';
				if (src && RE_SECURITY_CHALLENGE.test(src)) return true;
				cur = cur.parentElement;
				depth++;
			}
			if (el.querySelector && el.querySelector('.cf-turnstile, .g-recaptcha, .h-captcha, [data-sitekey], [data-nvirya-safe="captcha"], input[name="cf-turnstile-response"], input[name="g-recaptcha-response"], input[name="h-captcha-response"], iframe[src*="challenges.cloudflare.com"], iframe[src*="recaptcha"], iframe[src*="hcaptcha.com"], script[src*="challenges.cloudflare.com"]')) {
				return true;
			}
		} catch (e) {}
		return false;
	}

	function isMaliciousMetaRefresh(metaEl) {
		if (!metaEl || metaEl.nodeType !== 1) return false;
		if (isSecurityVerificationPage()) return false;
		try {
			if (metaEl.closest && metaEl.closest('noscript')) return false;
		} catch (e) {}
		const content = String(attr(metaEl, 'content') || metaEl.content || '').trim();
		if (!content) return false;
		const urlMatch = content.match(/;\s*url\s*=\s*['"]?([^'"]+?)['"]?\s*$/i);
		if (!urlMatch || !urlMatch[1]) {
			return false;
		}
		const rawTarget = urlMatch[1].trim();
		if (!rawTarget || RE_SECURITY_CHALLENGE.test(rawTarget)) return false;
		const u = safeUrl(rawTarget);
		if (!u) return false;
		if (isAdUrl(u)) return true;
		if (!sameRootDomain(u.hostname, hostname) && !isTrustedPopupHost(u.hostname)) return true;
		return false;
	}

	function neutralizeMetaRefresh(node) {
		if (!node || isSecurityVerificationPage()) return;
		try {
			const isMeta = node.nodeType === 1 && String(node.tagName || '').toLowerCase() === 'meta';
			const metas = isMeta ? [node] : (node.querySelectorAll ? node.querySelectorAll('meta[http-equiv]') : []);
			for (let i = 0; i < metas.length; i++) {
				const m = metas[i];
				const equiv = (attr(m, 'http-equiv') || m.httpEquiv || '').trim().toLowerCase();
				if (equiv === 'refresh' && isMaliciousMetaRefresh(m)) {
					const c = attr(m, 'content') || '';
					m.removeAttribute('http-equiv');
					m.setAttribute('content', '');
					if (m.parentNode) {
						try { m.parentNode.removeChild(m); } catch (err) {}
					}
					recordBlocked('redirect', 'meta-refresh', c || 'neutralized');
				}
			}
		} catch (e) {}
	}

	function installEarlyMetaRefreshGuard() {
		if (D.documentElement && !isSecurityVerificationPage()) neutralizeMetaRefresh(D.documentElement);
	}

	function installDocWriteGuard() {
		if (isFullSecurityChallengePage()) return;
		try {
			const origWrite = D.write;
			const origWriteln = D.writeln;
			if (typeof origWrite !== 'function') return;
			const sanitizeHTML = function(str) {
				if (typeof str !== 'string' || isSecurityVerificationPage()) return str;
				if (/<meta[^>]+http-equiv\s*=\s*["']?refresh/i.test(str) && !/cdn-cgi|challenge-platform|cf_chl/i.test(str)) {
					log('BLOCK', 'doc-write', 'Blocked meta-refresh in document.write');
					return str.replace(/<meta[^>]+http-equiv\s*=\s*["']?refresh[^>]*>/gi, '');
				}
				if (/<script[^>]+src\s*=\s*["'][^"']*(?:doubleclick|googlesyndication|popads|propellerads|adsterra|exoclick|monetag|onclickmax)/i.test(str)) {
					log('BLOCK', 'doc-write', 'Blocked ad script in document.write');
					return '';
				}
				return str;
			};
			D.write = function() {
				const args = Array.prototype.map.call(arguments, sanitizeHTML);
				return origWrite.apply(this, args);
			};
			D.writeln = function() {
				const args = Array.prototype.map.call(arguments, sanitizeHTML);
				return origWriteln.apply(this, args);
			};
		} catch (e) {}
	}

	function installScriptletDefusers() {
		try {
			const adsQueue = [];
			adsQueue.loaded = true;
			adsQueue.push = function() { return this.length; };
			try {
				Object.defineProperty(W, 'adsbygoogle', {
					configurable: true,
					enumerable: true,
					get: function() { return adsQueue; },
					set: function(value) {
						if (Array.isArray(value) && value !== adsQueue) {
							try { Array.prototype.push.apply(adsQueue, value); } catch (e) {}
						}
						adsQueue.loaded = true;
					}
				});
			} catch (e) {
				try { W.adsbygoogle = adsQueue; } catch (e2) {}
			}
			try {
				W.adsbygoogle.loaded = true;
				W.adsbygoogle.push = function() { return this.length || 0; };
				W.google_jobrunner = {};
			} catch (e) {}

			try {
				let _atOptions = {};
				Object.defineProperty(W, 'atOptions', {
					configurable: true,
					enumerable: true,
					get: () => _atOptions,
					set: (v) => { _atOptions = v || {}; }
				});
			} catch (e) {}

			try {
				const origFunction = W.Function;
				const patchedFunction = function() {
					if (arguments.length >= 1 && arguments[0] === '_vrx') {
						log('BLOCK', 'adsterra', 'Defused _vrx Adsterra steganography loader');
						return function() {};
					}
					return origFunction.apply(this, arguments);
				};
				patchedFunction.prototype = origFunction.prototype;
				W.Function = patchedFunction;
			} catch (e) {}

			const makeDefuser = function() {
				const api = function() {};
				api.prototype.setOption = function() { return this; };
				api.prototype.check = function() { return this; };
				api.prototype.clearEvent = function() { return this; };
				api.prototype.emitEvent = function() { return this; };
				api.prototype.on = function() { return this; };
				api.prototype.onDetected = function() { return this; };
				api.prototype.onNotDetected = function() { return this; };
				api.prototype.onDetectedOnce = function() { return this; };
				api.prototype.onNotDetectedOnce = function() { return this; };
				api.prototype.checkOnLoad = function() { return this; };
				api.prototype.isDetected = function() { return false; };
				api.prototype.detected = false;
				api.prototype.blocked = false;
				api.prototype.version = '3.0.0';
				return api;
			};
			['BlockAdBlock', 'FuckAdBlock', 'FairBlock', 'BabasBml'].forEach(function(name) {
				const stub = makeDefuser();
				try {
					Object.defineProperty(W, name, {
						configurable: true,
						enumerable: true,
						get: function() { return stub; },
						set: function() {}
					});
				} catch (e) { try { W[name] = stub; } catch (e2) {} }
			});

			try {
				W.canRunAds = true;
				W.isAdBlockActive = false;
				W.isAdBlockerActive = false;
				W.adblock = false;
				W.adBlockEnabled = false;
				W.google_ad_status = 1;
				W.google_ad_client = W.google_ad_client || 'ca-pub-0000000000000000';
				const lockGlobalVar = function(prop, val) {
					try {
						Object.defineProperty(W, prop, {
							configurable: true,
							enumerable: true,
							get: function() { return val; },
							set: function() {}
						});
					} catch (err) {
						try { W[prop] = val; } catch (e2) {}
					}
				};
				lockGlobalVar('canRunAds', true);
				lockGlobalVar('isAdBlockActive', false);
				lockGlobalVar('isAdBlockerActive', false);
				lockGlobalVar('adblock', false);
				lockGlobalVar('adBlockEnabled', false);
				lockGlobalVar('google_ad_status', 1);
			} catch (e) {}

			try {
				if (typeof unsafeWindow !== 'undefined' && unsafeWindow && unsafeWindow !== window) {
					mainWorldShield(unsafeWindow);
				}
			} catch (e) {}

			installBaitDimensionSpoofing();
		} catch (e) {}
	}

	function cleanTrackingQuery() {
		try {
			if (isSecurityVerificationPage() || isSearchEngineDomain()) return;
			if (/(?:^|\.)(?:youtube\.com|youtu\.be)$/i.test(W.location.hostname || '')) return;
			const url = new URL(W.location.href);
			if (RE_SECURITY_CHALLENGE.test(url.href)) return;
			const exact = /^(?:fbclid|gclid|dclid|gbraid|wbraid|msclkid|twclid|igshid|yclid|mc_cid|mc_eid|ref_src|ref_url|ref_id|si|feature|spm|vero_id|oly_anon_id|oly_enc_id|_hsenc|_hsmi|mkt_tok|s_cid|ef_id|cmpid|campaign_id|camp_id|ad_id|banner_id|zone_id|click_id|clk_id|aff_id|aff_sub|sub_id|s2s_id|trk|trac_id)$/i;
			const remove = [];
			url.searchParams.forEach(function(_, key) {
				if (/^utm_/i.test(key) || exact.test(key)) remove.push(key);
			});
			if (remove.length) {
				remove.forEach(function(key) { url.searchParams.delete(key); });
				W.history.replaceState(W.history.state, '', url.pathname + (url.search ? url.search : '') + url.hash);
			}
		} catch (e) {}
	}

	const isAppleDevice = () => {
		const ua = navigator.userAgent || '';
		const isIOS = /iPad|iPhone|iPod/i.test(ua);
		const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
		return isIOS || isIPadOS;
	};

	const CONFIG_VERSION = 6;
	const K_CFG = 'nvirya_x_config';
	const K_WL = 'nvirya_x_whitelist';
	const K_SR = 'nvirya_x_site_rules';
	const K_BLOCKED = 'nvirya_x_custom_blocked';
	const K_USER_ALLOWED_NET = 'nvirya_x_user_allowed_net';
	const K_USER_BLOCKED_NET = 'nvirya_x_user_blocked_net';
	const K_TRACKER_MAP = 'nvirya_tracker_map';
	const K_LEARNED_TRACKERS = 'nvirya_learned_trackers';
	const K_SYNC_URL = 'nvirya_x_sync_url';
	const K_SYNC_TIME = 'nvirya_x_sync_time';
	const SYNC_INTERVAL_MS = 86400000;
	const K_ST = 'nvirya_x_stats';
	const K_SESS = 'nvirya_x_session';
	const K_WEEKLY = 'nvirya_x_weekly_history';
	const K_LAST_REP = 'nvirya_x_last_report';
	const UPDATE_URL = 'https://update.greasyfork.org/scripts/599226/Nvirya%20AdGuard.user.js';
	const STAY_INSTALL_URL = 'stay://x-callback-url/install?scriptURL=' + encodeURIComponent(UPDATE_URL);
	const INSTALL_URL = isAppleDevice() ? STAY_INSTALL_URL : UPDATE_URL;
	const K_UPD_LAST = 'nvirya_x_last_update_check';
	const K_UPD_REMOTE = 'nvirya_x_update_remote';
	const K_UPD_CHANGELOG = 'nvirya_x_update_changelog';
	const K_UPD_SNOOZE = 'nvirya_x_update_snooze';

	const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;
	const UPDATE_RETRY_AFTER = 10 * 60 * 1000;
	const UPDATE_SNOOZE_MS = 2 * 60 * 60 * 1000;
	const UPDATE_START_DELAY = 1500;
	const UPDATE_TIMEOUT = 5000;
	const WEBHOOK_PAYLOAD = "https://reporter.nvirya.com";

	const DEFAULT_CONFIG = {
		version: CONFIG_VERSION,
		enabled: true,
		popupProtection: true,
		redirectProtection: true,
		cosmeticFiltering: true,
		playerProtection: true,
		antiAdblock: true,
		strictMode: false,
		smartTrackerProtection: true,
		elementPicker: true,
		showFloatingButton: true,
		edgeHandle: true,
		theme: 'auto', // 'auto' | 'light' | 'dark'
		lang: 'auto', // 'auto' | 'en' | 'vi' | 'zh-CN' | 'ja' | 'ru'
		debug: false
	};

	const TRANSLATIONS = {
		en: {
			s_stats: 'Protection Summary',
			s_week: 'Weekly Activity',
			s_act: 'Quick Actions',
			s_set: 'Appearance & Language',
			s_bak: 'Backup & Sync',
			s_data: 'Storage & Updates',
			s_dbg: 'Diagnostics',
			this_page: 'This Page',
			all_time: 'All Time',
			ads_rem: 'Ads',
			ads_rem_s: 'Cleaned',
			el_hid: 'Hidden Elements',
			pop_blk: 'Pop-ups Blocked',
			req_blk: 'Trackers Blocked',
			all_pre: 'All Time: ',
			page_pre: 'This Page: ',
			today: 'Today',
			ads_u: 'ads',
			days: 'Mon|Tue|Wed|Thu|Fri|Sat|Sun',
			wl_add: 'Allow This Site',
			wl_add_s: 'Pause filtering on the current domain',
			wl_rem: 'Resume Protection on This Site',
			wl_rem_s: 'Re-enable ad filtering on this domain',
			td_off: 'Pause for This Session',
			td_off_s: 'Disable filtering until this tab is closed',
			td_on: 'Resume Session Protection',
			td_on_s: 'Turn filtering back on immediately',
			pick: 'Hide Page Element',
			pick_s: 'Tap or swipe any unwanted element to hide it',
			clean: 'Clean Leftover Frames',
			clean_s: 'Collapse empty ad placeholders immediately',
			rep: 'Report an Issue',
			rep_s: 'Report missed ads or broken page layout',
			undo: 'Undo (Ctrl+Z)',
			undo_s: 'Restore the most recently hidden element',
			rules: 'Site Filter Rules',
			rules_s: 'Manage custom hidden elements on this site',
			peek: 'Preview Original Page (3s)',
			peek_s: 'Temporarily reveal hidden elements for 3 seconds',
			unlock: 'Unlock Page Scroll',
			unlock_s: 'Restore scrolling locked by hidden overlays',
			t_auto: 'Auto',
			t_light: 'Light',
			t_dark: 'Dark',
			shield: 'Smart Shield',
			shield_s: 'Block pop-ups, redirects & invisible traps',
			media: 'Media Guard',
			media_s: 'Optimize video players & auto-skip ads',
			strict: 'Deep Network Filter',
			strict_s: 'Strictly block tracking & analytics domains',
			fab: 'Quick Action Button',
			fab_s: 'Automatically dock to the screen edge',
			exp: 'Export Filter Rules',
			exp_s: 'Copy custom site rules to clipboard',
			imp: 'Import Filter Rules',
			imp_s: 'Merge rules from JSON or Base64 text',
			upd: 'Check for Updates',
			upd_cur: 'Current version v{ver}',
			upd_new: 'Update available v{remote} (installed v{ver})',
			upd_chk: 'Checking for updates...',
			rst_cfg: 'Reset All Settings',
			rst_cfg_s: 'Restore default protection preferences',
			clr_st: 'Clear Statistics',
			clr_st_s: 'Reset all protection counters to zero',
			rst_rl: 'Clear Site Rules',
			rst_rl_s: 'Restore all manually hidden elements on this site',
			dbg_cp: 'Copy Diagnostics',
			dbg_cp_s: 'Copy system & filter logs to clipboard',
			ub_ttl: 'Update Available',
			ub_dsc: 'A newer version with improved filter rules is ready.',
			ub_ltr: 'Later',
			ub_now: 'Update Now',
			ub_whats_new: "What's New in v{ver}:",
			ub_def_1: 'Fixed Cloudflare Turnstile & Under Attack infinite reload loops.',
			ub_def_2: 'Fixed Google Search results disappearing when scrolling to the bottom.',
			ub_def_3: 'Hardened inline script regex, whitelist enforcement & tracker allowlist.',
			tabHome: 'Overview',
			tabConfig: 'Settings',
			tabAbout: 'About',
			badgeSupported: 'supported',
			badgeUnsupported: 'unsupported',
			subBypassSupported: 'Neutralize anti-adblock walls on news sites',
			subBypassUnsupported: 'Unavailable due to iOS WebKit sandbox limits',
			systemStatus: 'System Capabilities',
			contactAuthor: 'Community & Support',
			systemCompatibility: 'System Capabilities',
			featureBypass: 'Anti-Adblock Bypass',
			featurePopup: 'Pop-up Shield',
			featureOverlay: 'Stealth Overlay Guard',
			featureNetwork: 'Deep Network Filter',
			featureClipboard: 'Clipboard & Focus Guard',
			statusSupported: 'supported',
			statusUnsupported: 'unsupported',
			statusLimited: 'limited (iOS)',
			compatLimitedNote: 'Limited on iOS WebKit due to sandbox isolation',
			aboutContact: 'Direct Contact',
			aboutDesc: 'A lightweight ad-blocking & navigation-guard engine built for mobile browsers.',
			sysPlatform: 'Platform',
			sysPlatformIOS: 'iOS Safari (Stay)',
			sysPlatformStd: 'Android (XBrowser) / Desktop',
			reportBtnShort: 'Feedback',
			rp_ttl: 'Send Feedback',
			rp_rsn: 'Category:',
			rp_m1: 'Missed ad',
			rp_m2: 'Broken page layout',
			rp_m3: 'Video playback issue',
			rp_m4: 'Feature suggestion',
			rp_m5: 'Other',
			rp_nt: 'Details (optional):',
			rp_ph: 'Describe where the ad appeared or what broke...',
			cancel: 'Cancel',
			rp_send: 'Submit',
			rl_empty: 'No custom filter rules for this site yet',
			p_depth: 'Level {current}/{total}',
			p_par: 'Expand',
			p_chd: 'Narrow',
			p_blk: 'Hide Element',
			p_all: 'Hide All ({count})',
			ts_pick: 'Tap an element to select it, or swipe to hide it',
			ts_pclose: 'Element picker closed',
			tossedElement: 'Element hidden',
			ts_gone: 'Element is no longer on the page',
			ts_nosel: 'Could not generate a selector for this element',
			ts_ball: 'Hidden all matching elements',
			ts_bone: 'Element hidden',
			ts_wla: 'Site added to allowlist',
			ts_wlr: 'Protection resumed on this site',
			ts_tdo: 'Protection resumed for this session',
			ts_tdf: 'Protection paused for this session',
			ts_cln: 'Cleaned leftover frames',
			ts_rst: 'Settings restored to defaults',
			ts_clr: 'Statistics cleared',
			ts_rlc: 'Cleared custom rules for this site',
			ts_dbg: 'Diagnostics copied to clipboard',
			ts_con: 'Diagnostics written to console',
			ts_ulk: 'Page scrolling unlocked',
			ts_pkon: 'Previewing original page (3s)...',
			ts_pkoff: 'Filters restored',
			ts_rm: 'Removed rule: {sel}',
			ts_udo: 'Restored: {sel}',
			ts_udn: 'Element restored',
			ts_ud0: 'Nothing to undo',
			ts_ufail: 'Could not check for updates',
			ts_ulat: 'You are up to date',
			ts_wait: 'Please wait {sec}s before sending more feedback',
			ts_nohk: 'Feedback endpoint is not configured',
			ts_rpok: 'Feedback sent. Thank you!',
			ts_rperr: 'Could not send feedback: {msg}',
			ts_noexp: 'No custom rules to export yet',
			ts_exp: 'Copied {count} rules to clipboard',
			ts_ibad: 'Invalid rule format',
			ts_imp: 'Imported {count} new rule(s)',
			pr_json: 'Copy JSON rules:',
			pr_imp: 'Paste rules (JSON or Base64):',
			cf_rst: 'Restore all settings to their defaults?',
			cf_clr: 'Reset all protection statistics to zero?',
			cf_rl: 'Remove all custom rules for this site?',
			cf_plr: 'This element is part of a video player. Hiding it may interrupt playback. Continue?',
			cf_ball: 'Hide all matching elements ({sel})?',
			cf_bone: 'Hide this element?\n\n{sel}',
			networkRequests: 'Connection Log',
			networkRequestsSub: 'Inspect and manage domain permissions',
			blockDomain: 'Block',
			unblockDomain: 'Allow',
			blockedBadge: 'Blocked',
			allowedBadge: 'Allowed',
			badgeBlocked: 'BLOCKED',
			badgeAllowed: 'ALLOWED',
			badgeUnlocked: 'UNLOCKED',
			sourceBuiltin: 'Built-in Filter',
			sourceTracker: '3-Strike Tracker',
			sourceCustom: 'Custom Block',
			sourceUserAllowed: 'Unlocked by User',
			searchDomainPlaceholder: 'Filter domains...',
			noRequestsYet: 'No third-party connections recorded yet',
			toastDomainBlocked: 'Blocked {domain}',
			toastDomainUnblocked: 'Allowed {domain}',
			toastDomainAllowed: 'Allowed {domain}. Reload page to apply fully.',
			toastReload: 'Reload',
			netFilterAll: 'All',
			netFilterBlocked: 'Blocked',
			netFilterUnlocked: 'Unlocked',
			netClearLog: 'Clear Session Log',
			smartTrackerTitle: 'Smart Tracker Shield (3-Strike)',
			smartTrackerSub: 'Automatically block third-party domains tracking you across 3+ websites ({count} learned)',
			factoryResetTitle: 'Factory Reset',
			factoryResetSub: 'Erase all data, rules, whitelist and restore initial script state',
			factoryResetConfirm: 'Are you sure you want to factory reset? All configurations, custom rules, whitelist, and statistics will be completely erased.',
			factoryResetConfirmShort: 'Confirm erase all data & settings?',
			factoryResetDeleteAll: 'Erase All',
			factoryResetSuccess: 'Factory reset successful! Reloading page...',
			cancel: 'Cancel',
			helpCenterTitle: 'Help Center & Known Issues',
			helpCenterSub: 'adguard.nvirya.help',
			helpCenterSection: 'Help & Documentation',
			helpCenterUnsupportedTooltip: 'Tap to view technical limitations on adguard.nvirya.help',
			reportPreNoticeText: 'ℹ️ Note: YouTube 1–2s ad fast-forwarding and WebView battery usage are technical boundaries, not bugs.',
			reportPreNoticeLink: 'Read Known Limitations ↗',
			rep_feat_lbl: 'Suggestion:',
			placeholderFeature: "Describe the feature or improvement you'd like to see...",
			placeholderBug: 'Describe where the ad appeared or what went wrong...',
			toastEmptyNote: 'Please enter a brief description first',
			syncRemoteRules: 'Sync from Remote URL',
			syncRemoteRulesSub: 'Import blocked domains from a raw host list',
			promptSyncUrl: 'Enter raw list URL (.txt or .json):',
			toastSyncSuccess: 'Synced {count} new domains',
			systemBlocked: 'Built-in'
		},
		vi: {
			s_stats: 'Thống kê bảo vệ',
			s_week: 'Hoạt động tuần này',
			s_act: 'Thao tác nhanh',
			s_set: 'Giao diện & ngôn ngữ',
			s_bak: 'Sao lưu & đồng bộ',
			s_data: 'Dữ liệu & cập nhật',
			s_dbg: 'Chẩn đoán',
			this_page: 'Trang này',
			all_time: 'Tất cả',
			ads_rem: 'Quảng cáo',
			ads_rem_s: 'Đã dọn',
			el_hid: 'Phần tử đã ẩn',
			pop_blk: 'Pop-up đã chặn',
			req_blk: 'Trình theo dõi đã chặn',
			all_pre: 'Tất cả: ',
			page_pre: 'Trang này: ',
			today: 'Hôm nay',
			ads_u: 'quảng cáo',
			days: 'T2|T3|T4|T5|T6|T7|CN',
			wl_add: 'Cho phép trang này',
			wl_add_s: 'Tạm dừng lọc trên tên miền hiện tại',
			wl_rem: 'Bật lại bảo vệ cho trang này',
			wl_rem_s: 'Bật lại chặn quảng cáo trên tên miền này',
			td_off: 'Tạm dừng phiên này',
			td_off_s: 'Tắt bộ lọc đến khi đóng tab',
			td_on: 'Tiếp tục bảo vệ phiên này',
			td_on_s: 'Bật lại bộ lọc ngay',
			pick: 'Ẩn phần tử trên trang',
			pick_s: 'Chạm hoặc vuốt để ẩn phần tử bất kỳ',
			clean: 'Dọn khung trống',
			clean_s: 'Thu gọn ngay các khung quảng cáo còn sót',
			rep: 'Báo lỗi',
			rep_s: 'Báo quảng cáo bị sót hoặc lỗi bố cục trang',
			undo: 'Hoàn tác (Ctrl+Z)',
			undo_s: 'Khôi phục phần tử vừa ẩn',
			rules: 'Quy tắc lọc của trang',
			rules_s: 'Quản lý các phần tử đã ẩn thủ công trên trang này',
			peek: 'Xem trang gốc (3 giây)',
			peek_s: 'Hiện tạm thời các phần tử đã ẩn trong 3 giây',
			unlock: 'Mở khóa cuộn trang',
			unlock_s: 'Khôi phục cuộn trang bị lớp phủ ẩn khóa',
			t_auto: 'Tự động',
			t_light: 'Sáng',
			t_dark: 'Tối',
			shield: 'Lá chắn thông minh',
			shield_s: 'Chặn pop-up, chuyển hướng và bẫy ẩn',
			media: 'Bảo vệ video',
			media_s: 'Tối ưu trình phát video và tự động bỏ qua quảng cáo',
			strict: 'Lọc kết nối sâu',
			strict_s: 'Chặn triệt để các tên miền theo dõi và phân tích',
			fab: 'Nút thao tác nhanh',
			fab_s: 'Tự động thu vào cạnh màn hình',
			exp: 'Xuất quy tắc lọc',
			exp_s: 'Sao chép quy tắc tùy chỉnh vào bộ nhớ tạm',
			imp: 'Nhập quy tắc lọc',
			imp_s: 'Gộp quy tắc từ JSON hoặc Base64',
			upd: 'Kiểm tra cập nhật',
			upd_cur: 'Phiên bản hiện tại v{ver}',
			upd_new: 'Có bản cập nhật v{remote} (đang dùng v{ver})',
			upd_chk: 'Đang kiểm tra cập nhật...',
			rst_cfg: 'Đặt lại mọi cài đặt',
			rst_cfg_s: 'Khôi phục cài đặt bảo vệ mặc định',
			clr_st: 'Xóa thống kê',
			clr_st_s: 'Đặt lại mọi bộ đếm về 0',
			rst_rl: 'Xóa quy tắc của trang',
			rst_rl_s: 'Khôi phục mọi phần tử đã ẩn thủ công trên trang này',
			dbg_cp: 'Sao chép nhật ký chẩn đoán',
			dbg_cp_s: 'Sao chép nhật ký hệ thống và bộ lọc vào bộ nhớ tạm',
			ub_ttl: 'Có bản cập nhật',
			ub_dsc: 'Đã có phiên bản mới với quy tắc lọc được cải thiện.',
			ub_ltr: 'Để sau',
			ub_now: 'Cập nhật ngay',
			ub_whats_new: 'Có gì mới ở v{ver}:',
			ub_def_1: 'Khắc phục triệt để lỗi kẹt xác minh Cloudflare Turnstile & Under Attack reload liên tục.',
			ub_def_2: 'Sửa lỗi mất kết quả trên Google Search khi cuộn xuống cuối trang.',
			ub_def_3: 'Tối ưu bộ lọc regex, tôn trọng Whitelist ở Main World và mở rộng danh sách CDN an toàn.',
			tabHome: 'Tổng quan',
			tabConfig: 'Cài đặt',
			tabAbout: 'Giới thiệu',
			badgeSupported: 'hỗ trợ',
			badgeUnsupported: 'không hỗ trợ',
			subBypassSupported: 'Vô hiệu hóa tường chặn adblock trên trang tin tức',
			subBypassUnsupported: 'Không khả dụng do giới hạn sandbox của iOS WebKit',
			systemStatus: 'Khả năng hỗ trợ',
			contactAuthor: 'Cộng đồng & hỗ trợ',
			systemCompatibility: 'Khả năng hỗ trợ',
			featureBypass: 'Vượt chặn anti-adblock',
			featurePopup: 'Chặn pop-up',
			featureOverlay: 'Chặn lớp phủ ẩn',
			featureNetwork: 'Lọc kết nối sâu',
			featureClipboard: 'Bảo vệ bộ nhớ tạm & tiêu điểm',
			statusSupported: 'hỗ trợ',
			statusUnsupported: 'không hỗ trợ',
			statusLimited: 'giới hạn (iOS)',
			compatLimitedNote: 'Bị giới hạn trên iOS WebKit do cơ chế cô lập sandbox',
			aboutContact: 'Liên hệ trực tiếp',
			aboutDesc: 'Trình chặn quảng cáo và bảo vệ điều hướng gọn nhẹ dành cho trình duyệt di động.',
			sysPlatform: 'Nền tảng',
			sysPlatformIOS: 'iOS Safari (Stay)',
			sysPlatformStd: 'Android (XBrowser) / Desktop',
			reportBtnShort: 'Góp ý',
			rp_ttl: 'Gửi phản hồi',
			rp_rsn: 'Loại:',
			rp_m1: 'Quảng cáo bị sót',
			rp_m2: 'Lỗi bố cục trang',
			rp_m3: 'Lỗi phát video',
			rp_m4: 'Đề xuất tính năng',
			rp_m5: 'Khác',
			rp_nt: 'Chi tiết (tùy chọn):',
			rp_ph: 'Mô tả vị trí quảng cáo hoặc lỗi gặp phải...',
			cancel: 'Hủy',
			rp_send: 'Gửi',
			rl_empty: 'Trang này chưa có quy tắc tùy chỉnh',
			p_depth: 'Cấp {current}/{total}',
			p_par: 'Mở rộng',
			p_chd: 'Thu hẹp',
			p_blk: 'Ẩn phần tử',
			p_all: 'Ẩn tất cả ({count})',
			ts_pick: 'Chạm để chọn phần tử hoặc vuốt để ẩn',
			ts_pclose: 'Đã đóng bộ chọn phần tử',
			tossedElement: 'Đã ẩn phần tử',
			ts_gone: 'Phần tử không còn trên trang',
			ts_nosel: 'Không thể tạo bộ chọn cho phần tử này',
			ts_ball: 'Đã ẩn tất cả phần tử khớp',
			ts_bone: 'Đã ẩn phần tử',
			ts_wla: 'Đã thêm trang vào danh sách cho phép',
			ts_wlr: 'Đã bật lại bảo vệ cho trang này',
			ts_tdo: 'Đã tiếp tục bảo vệ phiên này',
			ts_tdf: 'Đã tạm dừng bảo vệ phiên này',
			ts_cln: 'Đã dọn các khung trống',
			ts_rst: 'Đã khôi phục cài đặt mặc định',
			ts_clr: 'Đã xóa thống kê',
			ts_rlc: 'Đã xóa quy tắc của trang này',
			ts_dbg: 'Đã sao chép nhật ký chẩn đoán',
			ts_con: 'Đã ghi nhật ký chẩn đoán ra console',
			ts_ulk: 'Đã mở khóa cuộn trang',
			ts_pkon: 'Đang xem trang gốc (3 giây)...',
			ts_pkoff: 'Đã bật lại bộ lọc',
			ts_rm: 'Đã xóa quy tắc: {sel}',
			ts_udo: 'Đã khôi phục: {sel}',
			ts_udn: 'Đã khôi phục phần tử',
			ts_ud0: 'Không có gì để hoàn tác',
			ts_ufail: 'Không thể kiểm tra cập nhật',
			ts_ulat: 'Bạn đang dùng phiên bản mới nhất',
			ts_wait: 'Vui lòng đợi {sec} giây trước khi gửi tiếp',
			ts_nohk: 'Chưa cấu hình điểm nhận phản hồi',
			ts_rpok: 'Đã gửi phản hồi. Cảm ơn bạn!',
			ts_rperr: 'Không thể gửi phản hồi: {msg}',
			ts_noexp: 'Chưa có quy tắc tùy chỉnh để xuất',
			ts_exp: 'Đã sao chép {count} quy tắc vào bộ nhớ tạm',
			ts_ibad: 'Định dạng quy tắc không hợp lệ',
			ts_imp: 'Đã nhập {count} quy tắc mới',
			pr_json: 'Sao chép quy tắc JSON:',
			pr_imp: 'Dán quy tắc (JSON hoặc Base64):',
			cf_rst: 'Khôi phục mọi cài đặt về mặc định?',
			cf_clr: 'Đặt lại mọi thống kê về 0?',
			cf_rl: 'Xóa mọi quy tắc tùy chỉnh của trang này?',
			cf_plr: 'Phần tử này thuộc trình phát video. Ẩn nó có thể làm gián đoạn phát. Tiếp tục?',
			cf_ball: 'Ẩn tất cả phần tử khớp ({sel})?',
			cf_bone: 'Ẩn phần tử này?\n\n{sel}',
			networkRequests: 'Nhật ký kết nối',
			networkRequestsSub: 'Xem và quản lý quyền truy cập tên miền',
			blockDomain: 'Chặn',
			unblockDomain: 'Bỏ chặn',
			blockedBadge: 'Đã chặn',
			allowedBadge: 'Cho phép',
			badgeBlocked: 'ĐÃ CHẶN',
			badgeAllowed: 'CHO PHÉP',
			badgeUnlocked: 'ĐÃ MỞ KHÓA',
			sourceBuiltin: 'Bộ lọc gốc',
			sourceTracker: 'Chặn theo dõi 3-Strike',
			sourceCustom: 'Tùy chỉnh',
			sourceUserAllowed: 'Đã mở khóa bởi bạn',
			searchDomainPlaceholder: 'Lọc tên miền...',
			noRequestsYet: 'Chưa ghi nhận kết nối bên thứ ba nào',
			toastDomainBlocked: 'Đã chặn {domain}',
			toastDomainUnblocked: 'Đã cho phép {domain}',
			toastDomainAllowed: 'Đã cho phép {domain}. Tải lại trang để áp dụng hoàn toàn.',
			toastReload: 'Tải lại',
			netFilterAll: 'Tất cả',
			netFilterBlocked: 'Đã chặn',
			netFilterUnlocked: 'Đã mở khóa',
			netClearLog: 'Xóa nhật ký phiên',
			smartTrackerTitle: 'Chống theo dõi thông minh (3-Strike)',
			smartTrackerSub: 'Tự động phát hiện và chặn tên miền theo dõi bạn qua 3 trang web khác nhau (Đã chặn: {count} trackers)',
			factoryResetTitle: 'Khôi phục cài đặt gốc (Factory Reset)',
			factoryResetSub: 'Xóa toàn bộ dữ liệu, whitelist, quy tắc và đưa script về trạng thái mới cài đặt',
			factoryResetConfirm: 'Xác nhận khôi phục cài đặt gốc? Toàn bộ cấu hình, quy tắc tự tạo, whitelist và thống kê sẽ bị xóa hoàn toàn.',
			factoryResetConfirmShort: 'Xác nhận xóa toàn bộ dữ liệu & cài đặt?',
			factoryResetDeleteAll: 'Xóa tất cả',
			factoryResetSuccess: 'Đã khôi phục cài đặt gốc thành công! Đang tải lại trang...',
			cancel: 'Hủy',
			helpCenterTitle: 'Trung tâm trợ giúp & FAQ',
			helpCenterSub: 'adguard.nvirya.help',
			helpCenterSection: 'Trợ giúp & Tài liệu',
			helpCenterUnsupportedTooltip: 'Chạm để xem giải thích giới hạn kỹ thuật trên adguard.nvirya.help',
			reportPreNoticeText: 'ℹ️ Lưu ý: Việc tua nhanh quảng cáo YouTube sau 1–2s là cơ chế bảo vệ luồng phát, không phải lỗi.',
			reportPreNoticeLink: 'Xem giải đáp & giới hạn kỹ thuật ↗',
			rep_feat_lbl: 'Đề xuất:',
			placeholderFeature: 'Mô tả tính năng hoặc cải tiến bạn muốn...',
			placeholderBug: 'Mô tả vị trí quảng cáo hoặc lỗi gặp phải...',
			toastEmptyNote: 'Vui lòng nhập mô tả ngắn trước',
			syncRemoteRules: 'Đồng bộ từ URL',
			syncRemoteRulesSub: 'Nhập tên miền chặn từ danh sách host thô',
			promptSyncUrl: 'Nhập URL danh sách thô (.txt hoặc .json):',
			toastSyncSuccess: 'Đã đồng bộ {count} tên miền mới',
			systemBlocked: 'Tích hợp sẵn'
		},
		'zh-CN': {
			s_stats: '防护统计',
			s_week: '本周活动',
			s_act: '快捷操作',
			s_set: '外观与语言',
			s_bak: '备份与同步',
			s_data: '存储与更新',
			s_dbg: '诊断',
			this_page: '本页',
			all_time: '累计',
			ads_rem: '广告',
			ads_rem_s: '已清理',
			el_hid: '已隐藏元素',
			pop_blk: '已拦截弹窗',
			req_blk: '已拦截跟踪器',
			all_pre: '累计：',
			page_pre: '本页：',
			today: '今天',
			ads_u: '条广告',
			days: '一|二|三|四|五|六|日',
			wl_add: '允许此网站',
			wl_add_s: '暂停对当前域名的过滤',
			wl_rem: '恢复此网站的防护',
			wl_rem_s: '重新启用此域名的广告过滤',
			td_off: '本次会话暂停',
			td_off_s: '关闭标签页前停用过滤',
			td_on: '恢复本次会话防护',
			td_on_s: '立即重新启用过滤',
			pick: '隐藏页面元素',
			pick_s: '点按或滑动即可隐藏任意元素',
			clean: '清理残留框架',
			clean_s: '立即折叠空白广告占位',
			rep: '反馈问题',
			rep_s: '反馈漏拦广告或页面布局异常',
			undo: '撤销 (Ctrl+Z)',
			undo_s: '恢复最近隐藏的元素',
			rules: '本站过滤规则',
			rules_s: '管理此网站的自定义隐藏元素',
			peek: '预览原始页面（3 秒）',
			peek_s: '临时显示被隐藏的元素 3 秒',
			unlock: '解除页面滚动锁定',
			unlock_s: '恢复被隐藏遮罩锁定的滚动',
			t_auto: '自动',
			t_light: '浅色',
			t_dark: '深色',
			shield: '智能护盾',
			shield_s: '拦截弹窗、跳转和隐形陷阱',
			media: '视频保护',
			media_s: '优化视频播放器并自动跳过广告',
			strict: '深度网络过滤',
			strict_s: '严格拦截跟踪和统计域名',
			fab: '快捷悬浮按钮',
			fab_s: '自动吸附到屏幕边缘',
			exp: '导出过滤规则',
			exp_s: '复制自定义规则到剪贴板',
			imp: '导入过滤规则',
			imp_s: '从 JSON 或 Base64 合并规则',
			upd: '检查更新',
			upd_cur: '当前版本 v{ver}',
			upd_new: '发现新版本 v{remote}（当前 v{ver}）',
			upd_chk: '正在检查更新...',
			rst_cfg: '重置所有设置',
			rst_cfg_s: '恢复默认防护设置',
			clr_st: '清除统计',
			clr_st_s: '将所有计数归零',
			rst_rl: '清除本站规则',
			rst_rl_s: '恢复此网站上所有手动隐藏的元素',
			dbg_cp: '复制诊断信息',
			dbg_cp_s: '复制系统和过滤日志到剪贴板',
			ub_ttl: '发现新版本',
			ub_dsc: '新版本带来了改进的过滤规则。',
			ub_ltr: '稍后',
			ub_now: '立即更新',
			ub_whats_new: 'v{ver} 更新内容：',
			ub_def_1: '彻底修复 Cloudflare Turnstile 验证拦截与 Under Attack 无限刷新问题。',
			ub_def_2: '修复 Google 搜索滚动到底部时搜索结果消失的问题。',
			ub_def_3: '优化内联脚本正则匹配、严格执行白名单并扩展安全 CDN 列表。',
			tabHome: '概览',
			tabConfig: '设置',
			tabAbout: '关于',
			badgeSupported: '支持',
			badgeUnsupported: '不支持',
			subBypassSupported: '绕过新闻网站的反广告拦截墙',
			subBypassUnsupported: '受 iOS WebKit 沙盒限制，无法使用',
			systemStatus: '系统功能',
			contactAuthor: '社区与支持',
			systemCompatibility: '系统功能',
			featureBypass: '绕过反广告拦截',
			featurePopup: '弹窗护盾',
			featureOverlay: '隐形遮罩防护',
			featureNetwork: '深度网络过滤',
			featureClipboard: '剪贴板与焦点保护',
			statusSupported: '支持',
			statusUnsupported: '不支持',
			statusLimited: '受限 (iOS)',
			compatLimitedNote: '受 iOS WebKit 沙盒隔离影响，功能受限',
			aboutContact: '直接联系',
			aboutDesc: '专为移动浏览器打造的轻量级广告拦截与导航保护引擎。',
			sysPlatform: '平台',
			sysPlatformIOS: 'iOS Safari (Stay)',
			sysPlatformStd: 'Android (XBrowser) / Desktop',
			reportBtnShort: '反馈',
			rp_ttl: '发送反馈',
			rp_rsn: '分类：',
			rp_m1: '漏拦广告',
			rp_m2: '页面布局异常',
			rp_m3: '视频播放问题',
			rp_m4: '功能建议',
			rp_m5: '其他',
			rp_nt: '详情（可选）：',
			rp_ph: '描述广告出现的位置或遇到的问题...',
			cancel: '取消',
			rp_send: '提交',
			rl_empty: '此网站暂无自定义过滤规则',
			p_depth: '层级 {current}/{total}',
			p_par: '扩大',
			p_chd: '缩小',
			p_blk: '隐藏元素',
			p_all: '全部隐藏 ({count})',
			ts_pick: '点按选择元素，或滑动将其隐藏',
			ts_pclose: '已关闭元素选择器',
			tossedElement: '已隐藏元素',
			ts_gone: '该元素已不在页面上',
			ts_nosel: '无法为该元素生成选择器',
			ts_ball: '已隐藏所有匹配元素',
			ts_bone: '已隐藏元素',
			ts_wla: '已将网站加入白名单',
			ts_wlr: '已恢复此网站的防护',
			ts_tdo: '已恢复本次会话防护',
			ts_tdf: '已暂停本次会话防护',
			ts_cln: '已清理残留框架',
			ts_rst: '已恢复默认设置',
			ts_clr: '统计已清除',
			ts_rlc: '已清除此网站的自定义规则',
			ts_dbg: '诊断信息已复制到剪贴板',
			ts_con: '诊断信息已输出到控制台',
			ts_ulk: '已解除页面滚动锁定',
			ts_pkon: '正在预览原始页面（3 秒）...',
			ts_pkoff: '已恢复过滤',
			ts_rm: '已移除规则：{sel}',
			ts_udo: '已恢复：{sel}',
			ts_udn: '已恢复元素',
			ts_ud0: '没有可撤销的操作',
			ts_ufail: '无法检查更新',
			ts_ulat: '已是最新版本',
			ts_wait: '请等待 {sec} 秒后再发送',
			ts_nohk: '未配置反馈接口',
			ts_rpok: '反馈已发送，谢谢！',
			ts_rperr: '发送反馈失败：{msg}',
			ts_noexp: '暂无可导出的自定义规则',
			ts_exp: '已复制 {count} 条规则到剪贴板',
			ts_ibad: '规则格式无效',
			ts_imp: '已导入 {count} 条新规则',
			pr_json: '复制 JSON 规则：',
			pr_imp: '粘贴规则（JSON 或 Base64）：',
			cf_rst: '确定恢复所有默认设置？',
			cf_clr: '确定将所有统计清零？',
			cf_rl: '确定移除此网站的所有自定义规则？',
			cf_plr: '该元素属于视频播放器，隐藏后可能中断播放。是否继续？',
			cf_ball: '隐藏所有匹配元素 ({sel})？',
			cf_bone: '隐藏此元素？\n\n{sel}',
			networkRequests: '连接日志',
			networkRequestsSub: '查看并管理域名连接权限',
			blockDomain: '拦截',
			unblockDomain: '放行',
			blockedBadge: '已拦截',
			allowedBadge: '已允许',
			badgeBlocked: '已拦截',
			badgeAllowed: '允许',
			badgeUnlocked: '已放行',
			sourceBuiltin: '内置规则',
			sourceTracker: '智能防追踪 (3-Strike)',
			sourceCustom: '自定义拦截',
			sourceUserAllowed: '用户已放行',
			searchDomainPlaceholder: '筛选域名...',
			noRequestsYet: '尚未记录第三方连接',
			toastDomainBlocked: '已拦截 {domain}',
			toastDomainUnblocked: '已允许 {domain}',
			toastDomainAllowed: '已放行 {domain}。请刷新页面以完全生效。',
			toastReload: '刷新',
			netFilterAll: '全部',
			netFilterBlocked: '已拦截',
			netFilterUnlocked: '已放行',
			netClearLog: '清除会话日志',
			smartTrackerTitle: '智能防追踪 (3-Strike)',
			smartTrackerSub: '自动发现并拦截跨越3个网站追踪您的域名（已拦截：{count}个）',
			factoryResetTitle: '恢复出厂设置 (Factory Reset)',
			factoryResetSub: '清除所有数据、规则和白名单，恢复脚本初始状态',
			factoryResetConfirm: '确定要恢复出厂设置吗？所有配置、自定义规则、白名单和统计数据将被彻底清空。',
			factoryResetConfirmShort: '确认删除所有数据与设置？',
			factoryResetDeleteAll: '全部删除',
			factoryResetSuccess: '恢复出厂设置成功！正在刷新页面...',
			cancel: '取消',
			helpCenterTitle: '帮助中心与常见问题',
			helpCenterSub: 'adguard.nvirya.help',
			helpCenterSection: '帮助与文档',
			helpCenterUnsupportedTooltip: '点击在 adguard.nvirya.help 查看底层技术限制说明',
			reportPreNoticeText: 'ℹ️ 注意：YouTube 1–2秒快进广告与 WebView 电池消耗属于底层技术边界，并非脚本故障。',
			reportPreNoticeLink: '查看常见限制与解答 ↗',
			rep_feat_lbl: '建议：',
			placeholderFeature: '描述你希望新增或改进的功能...',
			placeholderBug: '描述广告出现的位置或遇到的问题...',
			toastEmptyNote: '请先填写简要说明',
			syncRemoteRules: '从远程 URL 同步',
			syncRemoteRulesSub: '从原始 host 列表导入拦截域名',
			promptSyncUrl: '输入原始列表 URL (.txt 或 .json)：',
			toastSyncSuccess: '已同步 {count} 个新域名',
			systemBlocked: '内置'
		},
		ru: {
			s_stats: 'Сводка защиты',
			s_week: 'Активность за неделю',
			s_act: 'Быстрые действия',
			s_set: 'Внешний вид и язык',
			s_bak: 'Резервное копирование',
			s_data: 'Хранилище и обновления',
			s_dbg: 'Диагностика',
			this_page: 'На этой странице',
			all_time: 'За все время',
			ads_rem: 'Реклама',
			ads_rem_s: 'Очищено',
			el_hid: 'Скрыто элементов',
			pop_blk: 'Заблокировано всплывающих окон',
			req_blk: 'Заблокировано трекеров',
			all_pre: 'Всего: ',
			page_pre: 'На странице: ',
			today: 'Сегодня',
			ads_u: 'рекл.',
			days: 'Пн|Вт|Ср|Чт|Пт|Сб|Вс',
			wl_add: 'Разрешить этот сайт',
			wl_add_s: 'Приостановить фильтрацию на этом домене',
			wl_rem: 'Возобновить защиту сайта',
			wl_rem_s: 'Включить блокировку рекламы на этом домене',
			td_off: 'Приостановить для этой сессии',
			td_off_s: 'Отключить фильтрацию до закрытия вкладки',
			td_on: 'Возобновить сессию защиты',
			td_on_s: 'Немедленно включить фильтрацию обратно',
			pick: 'Скрыть элемент страницы',
			pick_s: 'Нажмите или смахните элемент, чтобы скрыть его',
			clean: 'Очистить пустые блоки',
			clean_s: 'Немедленно свернуть пустые рекламные места',
			rep: 'Сообщить о проблеме',
			rep_s: 'Сообщить о пропущенной рекламе или сбое разметки',
			undo: 'Отменить (Ctrl+Z)',
			undo_s: 'Восстановить последний скрытый элемент',
			rules: 'Правила фильтрации сайта',
			rules_s: 'Управление скрытыми элементами на этом сайте',
			peek: 'Оригинал страницы (3 сек)',
			peek_s: 'Временно показать скрытые элементы на 3 секунды',
			unlock: 'Разблокировать прокрутку',
			unlock_s: 'Восстановить прокрутку, заблокированную оверлеем',
			t_auto: 'Авто',
			t_light: 'Светлая',
			t_dark: 'Темная',
			shield: 'Умный щит',
			shield_s: 'Блокировка всплывающих окон, редиректов и ловушек',
			media: 'Медиа-защита',
			media_s: 'Оптимизация видеоплеера и автопропуск рекламы',
			strict: 'Глубокая сетевая фильтрация',
			strict_s: 'Строгая блокировка доменов аналитики и трекеров',
			fab: 'Кнопка быстрого доступа',
			fab_s: 'Автоматически прижиматься к краю экрана',
			exp: 'Экспорт правил фильтрации',
			exp_s: 'Скопировать пользовательские правила в буфер обмена',
			imp: 'Импорт правил фильтрации',
			imp_s: 'Объединить правила из JSON или Base64',
			upd: 'Проверить обновления',
			upd_cur: 'Текущая версия: v{ver}',
			upd_new: 'Доступно обновление v{remote} (установлена v{ver})',
			upd_chk: 'Проверка обновлений...',
			rst_cfg: 'Сбросить все настройки',
			rst_cfg_s: 'Восстановить параметры защиты по умолчанию',
			clr_st: 'Сбросить статистику',
			clr_st_s: 'Обнулить все счетчики защиты',
			rst_rl: 'Очистить правила сайта',
			rst_rl_s: 'Восстановить все скрытые вручную элементы на этом сайте',
			dbg_cp: 'Копировать диагностику',
			dbg_cp_s: 'Скопировать системные логи и фильтры в буфер обмена',
			ub_ttl: 'Доступно обновление',
			ub_dsc: 'Готова новая версия с улучшенными правилами фильтрации.',
			ub_ltr: 'Позже',
			ub_now: 'Обновить сейчас',
			ub_whats_new: 'Что нового в v{ver}:',
			ub_def_1: 'Исправлена бесконечная перезагрузка Cloudflare Turnstile & Under Attack.',
			ub_def_2: 'Исправлено исчезновение результатов Google Search при прокрутке вниз.',
			ub_def_3: 'Усилены регулярные выражения скриптов, белый список и трекеры.',
			tabHome: 'Обзор',
			tabConfig: 'Настройки',
			tabAbout: 'О скрипте',
			badgeSupported: 'поддерживается',
			badgeUnsupported: 'не поддерживается',
			subBypassSupported: 'Нейтрализация анти-блокировщиков на новостных сайтах',
			subBypassUnsupported: 'Недоступно из-за ограничений песочницы iOS WebKit',
			systemStatus: 'Возможности системы',
			contactAuthor: 'Сообщество и поддержка',
			systemCompatibility: 'Возможности системы',
			featureBypass: 'Обход анти-блокировщиков',
			featurePopup: 'Защита от всплывающих окон',
			featureOverlay: 'Защита от скрытых оверлеев',
			featureNetwork: 'Глубокая сетевая фильтрация',
			featureClipboard: 'Защита буфера и фокуса',
			statusSupported: 'поддерживается',
			statusUnsupported: 'не поддерживается',
			statusLimited: 'ограничено (iOS)',
			compatLimitedNote: 'Ограничено на iOS WebKit из-за изоляции песочницы',
			aboutContact: 'Прямая связь',
			aboutDesc: 'Легковесный движок блокировки рекламы и защиты навигации для мобильных браузеров.',
			sysPlatform: 'Платформа',
			sysPlatformIOS: 'iOS Safari (Stay)',
			sysPlatformStd: 'Android (XBrowser) / ПК',
			reportBtnShort: 'Отзыв',
			rp_ttl: 'Отправить отзыв',
			rp_rsn: 'Категория:',
			rp_m1: 'Пропущенная реклама',
			rp_m2: 'Сломанная разметка сайта',
			rp_m3: 'Проблема с воспроизведением видео',
			rp_m4: 'Предложение функции',
			rp_m5: 'Другое',
			rp_nt: 'Подробности (необязательно):',
			rp_ph: 'Опишите, где появилась реклама или что сломалось...',
			cancel: 'Отмена',
			rp_send: 'Отправить',
			rl_empty: 'Для этого сайта пока нет пользовательских правил',
			p_depth: 'Уровень {current}/{total}',
			p_par: 'Шире',
			p_chd: 'Уже',
			p_blk: 'Скрыть элемент',
			p_all: 'Скрыть все ({count})',
			ts_pick: 'Нажмите для выбора элемента или смахните для скрытия',
			ts_pclose: 'Выбор элементов закрыт',
			tossedElement: 'Элемент скрыт',
			ts_gone: 'Элемент больше не найден на странице',
			ts_nosel: 'Не удалось создать селектор для этого элемента',
			ts_ball: 'Скрыты все совпадающие элементы',
			ts_bone: 'Элемент скрыт',
			ts_wla: 'Сайт добавлен в белый список',
			ts_wlr: 'Защита на этом сайте возобновлена',
			ts_tdo: 'Защита возобновлена для этой сессии',
			ts_tdf: 'Защита приостановлена для этой сессии',
			ts_cln: 'Очищены пустые рамки',
			ts_rst: 'Настройки сброшены по умолчанию',
			ts_clr: 'Статистика очищена',
			ts_rlc: 'Пользовательские правила для этого сайта удалены',
			ts_dbg: 'Диагностика скопирована в буфер обмена',
			ts_con: 'Диагностика выведена в консоль',
			ts_ulk: 'Прокрутка страницы разблокирована',
			ts_pkon: 'Просмотр оригинала страницы (3 сек)...',
			ts_pkoff: 'Фильтры восстановлены',
			ts_rm: 'Удалено правило: {sel}',
			ts_udo: 'Восстановлено: {sel}',
			ts_udn: 'Элемент восстановлен',
			ts_ud0: 'Нечего отменять',
			ts_ufail: 'Не удалось проверить обновления',
			ts_ulat: 'У вас установлена последняя версия',
			ts_wait: 'Пожалуйста, подождите {sec} с перед повторной отправкой',
			ts_nohk: 'Конечная точка для отзывов не настроена',
			ts_rpok: 'Отзыв отправлен. Спасибо!',
			ts_rperr: 'Не удалось отправить отзыв: {msg}',
			ts_noexp: 'Нет правил для экспорта',
			ts_exp: 'Скопировано правил в буфер: {count}',
			ts_ibad: 'Неверный формат правил',
			ts_imp: 'Импортировано правил: {count}',
			pr_json: 'Скопируйте правила JSON:',
			pr_imp: 'Вставьте правила (JSON или Base64):',
			cf_rst: 'Сбросить все настройки по умолчанию?',
			cf_clr: 'Обнулить всю статистику защиты?',
			cf_rl: 'Удалить все пользовательские правила для этого сайта?',
			cf_plr: 'Этот элемент является частью видеоплеера. Скрытие может нарушить воспроизведение. Продолжить?',
			cf_ball: 'Скрыть все совпадающие элементы ({sel})?',
			cf_bone: 'Скрыть этот элемент?\n\n{sel}',
			networkRequests: 'Журнал подключений',
			networkRequestsSub: 'Просмотр и управление разрешениями доменов',
			blockDomain: 'Блокировать',
			unblockDomain: 'Разрешить',
			blockedBadge: 'Заблокировано',
			allowedBadge: 'Разрешено',
			badgeBlocked: 'ЗАБЛОКИРОВАНО',
			badgeAllowed: 'РАЗРЕШЕНО',
			badgeUnlocked: 'РАЗБЛОКИРОВАНО',
			sourceBuiltin: 'Встроенный фильтр',
			sourceTracker: 'Трекер 3-Strike',
			sourceCustom: 'Пользовательский блок',
			sourceUserAllowed: 'Разрешено пользователем',
			searchDomainPlaceholder: 'Фильтр доменов...',
			noRequestsYet: 'Сторонних подключений пока не зафиксировано',
			toastDomainBlocked: 'Домен заблокирован: {domain}',
			toastDomainUnblocked: 'Домен разрешен: {domain}',
			toastDomainAllowed: 'Домен {domain} разрешен. Перезагрузите страницу для применения.',
			toastReload: 'Перезагрузить',
			netFilterAll: 'Все',
			netFilterBlocked: 'Заблокированные',
			netFilterUnlocked: 'Разблокированные',
			netClearLog: 'Очистить журнал сессии',
			smartTrackerTitle: 'Умная защита от трекеров (3-Strike)',
			smartTrackerSub: 'Автоматическая блокировка доменов, отслеживающих вас на 3+ сайтах (Обнаружено: {count})',
			factoryResetTitle: 'Полный сброс (Factory Reset)',
			factoryResetSub: 'Стереть все данные, правила, белый список и вернуть начальное состояние скрипта',
			factoryResetConfirm: 'Вы уверены, что хотите выполнить сброс до заводских настроек? Все конфигурации, правила, белый список и статистика будут удалены безвозвратно.',
			factoryResetConfirmShort: 'Подтвердить удаление всех данных и настроек?',
			factoryResetDeleteAll: 'Удалить все',
			factoryResetSuccess: 'Сброс выполнен успешно! Перезагрузка страницы...',
			cancel: 'Отмена',
			helpCenterTitle: 'Центр помощи и частые вопросы',
			helpCenterSub: 'adguard.nvirya.help',
			helpCenterSection: 'Помощь и документация',
			helpCenterUnsupportedTooltip: 'Нажмите для просмотра технических ограничений на adguard.nvirya.help',
			reportPreNoticeText: 'ℹ️ Примечание: перемотка рекламы на YouTube (1–2 с) и расход батареи WebView обусловлены техническими рамками, а не ошибками.',
			reportPreNoticeLink: 'Известные ограничения ↗',
			rep_feat_lbl: 'Предложение:',
			placeholderFeature: 'Опишите функцию или улучшение, которое вы хотели бы видеть...',
			placeholderBug: 'Опишите, где появилась реклама или что пошло не так...',
			toastEmptyNote: 'Сначала введите краткое описание',
			syncRemoteRules: 'Синхронизация по URL',
			syncRemoteRulesSub: 'Импорт заблокированных доменов из внешнего списка хостов',
			promptSyncUrl: 'Введите URL списка хостов (.txt или .json):',
			toastSyncSuccess: 'Синхронизировано новых доменов: {count}',
			systemBlocked: 'Встроенный'
		},
		ja: {
			s_stats: '保護の概要',
			s_week: '今週のアクティビティ',
			s_act: 'クイックアクション',
			s_set: '外観と言語',
			s_bak: 'バックアップと同期',
			s_data: 'ストレージと更新',
			s_dbg: '診断情報',
			this_page: 'このページ',
			all_time: '累計',
			ads_rem: '広告',
			ads_rem_s: 'クリーンアップ済',
			el_hid: '非表示要素',
			pop_blk: 'ポップアップブロック',
			req_blk: 'トラッカーブロック',
			all_pre: '累計: ',
			page_pre: 'このページ: ',
			today: '今日',
			ads_u: '件',
			days: '月|火|水|木|金|土|日',
			wl_add: 'このサイトを許可',
			wl_add_s: '現在のドメインでのフィルタリングを一時停止',
			wl_rem: 'このサイトの保護を再開',
			wl_rem_s: 'このドメインでの広告フィルタリングを再度有効化',
			td_off: 'このセッションのみ一時停止',
			td_off_s: 'タブを閉じるまでフィルタリングを無効化',
			td_on: 'セッション保護を再開',
			td_on_s: 'フィルタリングを直ちに再度有効化',
			pick: 'ページ要素を非表示',
			pick_s: '不要な要素をタップまたはスワイプして非表示',
			clean: '残存フレームを消去',
			clean_s: '空の広告プレースホルダーを直ちに折りたたむ',
			rep: '問題を報告',
			rep_s: '広告のブロック漏れやレイアウト崩れを報告',
			undo: '元に戻す (Ctrl+Z)',
			undo_s: '直前に非表示にした要素を復元',
			rules: 'サイト別フィルター規則',
			rules_s: 'このサイトの手動非表示要素を管理',
			peek: '元のページをプレビュー (3秒)',
			peek_s: '非表示にした要素を3秒間一時的に表示',
			unlock: 'スクロールロック解除',
			unlock_s: '隠しオーバーレイで固定されたスクロールを復元',
			t_auto: '自動',
			t_light: 'ライト',
			t_dark: 'ダーク',
			shield: 'スマートシールド',
			shield_s: 'ポップアップ・リダイレクト・不可視トラップをブロック',
			media: 'メディアガード',
			media_s: '動画プレイヤーを最適化し広告を自動スキップ',
			strict: 'ディープネットワークフィルター',
			strict_s: 'トラッキングおよび解析ドメインを厳格に遮断',
			fab: 'クイック操作ボタン',
			fab_s: '画面の端に自動吸着',
			exp: 'フィルター規則をエクスポート',
			exp_s: 'カスタム規則をクリップボードにコピー',
			imp: 'フィルター規則をインポート',
			imp_s: 'JSONまたはBase64から規則を統合',
			upd: '更新を確認',
			upd_cur: '現在のバージョン: v{ver}',
			upd_new: '新しいバージョン v{remote} が利用可能です (現在 v{ver})',
			upd_chk: '更新を確認中...',
			rst_cfg: 'すべての設定をリセット',
			rst_cfg_s: '保護設定をデフォルトに戻す',
			clr_st: '統計をリセット',
			clr_st_s: 'すべての保護カウンターをゼロに戻す',
			rst_rl: 'サイト規則を消去',
			rst_rl_s: 'このサイトで手動非表示にした全要素を復元',
			dbg_cp: '診断情報をコピー',
			dbg_cp_s: 'システムログとフィルターログをクリップボードにコピー',
			ub_ttl: 'アップデートが利用可能',
			ub_dsc: 'フィルタールールが改善された新しいバージョンが利用可能です。',
			ub_ltr: '後で',
			ub_now: '今すぐ更新',
			ub_whats_new: 'v{ver} の更新内容:',
			ub_def_1: 'Cloudflare Turnstile と Under Attack の無限リロードループを修正。',
			ub_def_2: 'Google 検索で一番下までスクロールした際に結果が消える問題を修正。',
			ub_def_3: 'インラインスクリプト正規表現、ホワイトリスト適用、トラッカーリストを強化。',
			tabHome: '概要',
			tabConfig: '設定',
			tabAbout: '情報',
			badgeSupported: '対応',
			badgeUnsupported: '非対応',
			subBypassSupported: 'ニュースサイトの広告ブロック検知を回避',
			subBypassUnsupported: 'iOS WebKit のサンドボックス制限により利用不可',
			systemStatus: 'システム機能',
			contactAuthor: 'コミュニティとサポート',
			systemCompatibility: 'システム機能',
			featureBypass: '広告ブロック検知の回避',
			featurePopup: 'ポップアップ保護',
			featureOverlay: '不可視オーバーレイ防御',
			featureNetwork: 'ディープネットワークフィルター',
			featureClipboard: 'クリップボードとフォーカス保護',
			statusSupported: '対応',
			statusUnsupported: '非対応',
			statusLimited: '制限あり (iOS)',
			compatLimitedNote: 'iOS WebKit のサンドボックス隔離により機能制限あり',
			aboutContact: '直接連絡',
			aboutDesc: 'モバイルブラウザ向けに設計された軽量な広告ブロック＆ナビゲーション保護エンジン。',
			sysPlatform: 'プラットフォーム',
			sysPlatformIOS: 'iOS Safari (Stay)',
			sysPlatformStd: 'Android (XBrowser) / デスクトップ',
			reportBtnShort: 'フィードバック',
			rp_ttl: 'フィードバックを送信',
			rp_rsn: 'カテゴリー:',
			rp_m1: '広告のブロック漏れ',
			rp_m2: 'ページレイアウト崩れ',
			rp_m3: '動画再生の不具合',
			rp_m4: '機能リクエスト',
			rp_m5: 'その他',
			rp_nt: '詳細（任意）:',
			rp_ph: '広告が表示された場所や問題の内容を記入してください...',
			cancel: 'キャンセル',
			rp_send: '送信',
			rl_empty: 'このサイトのカスタムルールはまだありません',
			p_depth: '階層 {current}/{total}',
			p_par: '広げる',
			p_chd: '絞り込む',
			p_blk: '要素を非表示',
			p_all: 'すべて非表示 ({count})',
			ts_pick: '要素をタップして選択、またはスワイプで非表示',
			ts_pclose: '要素ピッカーを閉じました',
			tossedElement: '要素を非表示にしました',
			ts_gone: '要素がページ上に見つかりません',
			ts_nosel: 'この要素のセレクターを生成できませんでした',
			ts_ball: '一致するすべての要素を非表示にしました',
			ts_bone: '要素を非表示にしました',
			ts_wla: 'サイトを許可リストに追加しました',
			ts_wlr: 'このサイトでの保護を再開しました',
			ts_tdo: 'このセッションの保護を再開しました',
			ts_tdf: 'このセッションの保護を一時停止しました',
			ts_cln: '残存フレームを消去しました',
			ts_rst: '設定をデフォルトにリセットしました',
			ts_clr: '統計をリセットしました',
			ts_rlc: 'このサイトのカスタムルールを削除しました',
			ts_dbg: '診断情報をクリップボードにコピーしました',
			ts_con: '診断情報をコンソールに出力しました',
			ts_ulk: 'スクロールロックを解除しました',
			ts_pkon: '元のページをプレビュー中 (3秒)...',
			ts_pkoff: 'フィルターを復元しました',
			ts_rm: 'ルールを削除しました: {sel}',
			ts_udo: '復元しました: {sel}',
			ts_udn: '要素を復元しました',
			ts_ud0: '元に戻す操作はありません',
			ts_ufail: '更新の確認に失敗しました',
			ts_ulat: '最新バージョンを使用中です',
			ts_wait: '再送信まで {sec} 秒お待ちください',
			ts_nohk: 'フィードバックのエンドポイントが設定されていません',
			ts_rpok: 'フィードバックを送信しました。ありがとうございます！',
			ts_rperr: '送信に失敗しました: {msg}',
			ts_noexp: 'エクスポートするカスタムルールがありません',
			ts_exp: '{count} 件のルールをクリップボードにコピーしました',
			ts_ibad: '無効なルール形式です',
			ts_imp: '{count} 件の新しいルールをインポートしました',
			pr_json: 'JSON ルールをコピー:',
			pr_imp: 'ルールを貼り付け (JSON または Base64):',
			cf_rst: 'すべての設定をデフォルトに戻しますか？',
			cf_clr: 'すべての保護統計をゼロにリセットしますか？',
			cf_rl: 'このサイトのすべてのカスタムルールを削除しますか？',
			cf_plr: 'この要素は動画プレイヤーの一部です。非表示にすると再生に影響が出る可能性があります。続行しますか？',
			cf_ball: '一致するすべての要素 ({sel}) を非表示にしますか？',
			cf_bone: 'この要素を非表示にしますか？\n\n{sel}',
			networkRequests: '接続ログ',
			networkRequestsSub: 'ドメインのアクセス許可の確認と管理',
			blockDomain: '遮断',
			unblockDomain: '許可',
			blockedBadge: '遮断済',
			allowedBadge: '許可済',
			badgeBlocked: '遮断済',
			badgeAllowed: '許可',
			badgeUnlocked: '許可解除',
			sourceBuiltin: '標準フィルター',
			sourceTracker: '3-Strike トラッカー',
			sourceCustom: '手動ブロック',
			sourceUserAllowed: 'ユーザー許可',
			searchDomainPlaceholder: 'ドメインを絞り込み...',
			noRequestsYet: 'サードパーティ接続はまだ記録されていません',
			toastDomainBlocked: '{domain} をブロックしました',
			toastDomainUnblocked: '{domain} を許可しました',
			toastDomainAllowed: '{domain} を許可しました。完全に適用するには再読み込みしてください。',
			toastReload: '再読み込み',
			netFilterAll: 'すべて',
			netFilterBlocked: '遮断済',
			netFilterUnlocked: '許可解除',
			netClearLog: 'セッションログを消去',
			smartTrackerTitle: 'スマートトラッカー保護 (3-Strike)',
			smartTrackerSub: '3つ以上のサイトを横断追跡するドメインを自動ブロック (検出: {count} 件)',
			factoryResetTitle: '初期状態にリセット (Factory Reset)',
			factoryResetSub: '全データ・ルール・許可リストを消去し初回インストール状態に戻す',
			factoryResetConfirm: '工場出荷時の状態にリセットしますか？すべての設定、カスタムルール、許可リスト、統計データが完全に消去されます。',
			factoryResetConfirmShort: 'すべてのデータと設定を消去しますか？',
			factoryResetDeleteAll: 'すべて削除',
			factoryResetSuccess: 'リセットが完了しました！ページを再読み込み中...',
			cancel: 'キャンセル',
			helpCenterTitle: 'ヘルプセンターとよくある質問',
			helpCenterSub: 'adguard.nvirya.help',
			helpCenterSection: 'ヘルプとドキュメント',
			helpCenterUnsupportedTooltip: 'タップして adguard.nvirya.help で技術的制限を確認',
			reportPreNoticeText: 'ℹ️ お知らせ: YouTube の1〜2秒の早送りや WebView のバッテリー消費は仕様上の制限であり、不具合ではありません。',
			reportPreNoticeLink: '既知の制限事項を見る ↗',
			rep_feat_lbl: 'リクエスト:',
			placeholderFeature: '追加または改善してほしい機能を入力してください...',
			placeholderBug: '広告が表示された場所や問題の内容を入力してください...',
			toastEmptyNote: '簡単な説明を入力してください',
			syncRemoteRules: 'リモート URL から同期',
			syncRemoteRulesSub: '外部ホストリストから遮断ドメインを取り込む',
			promptSyncUrl: 'リストの URL (.txt または .json) を入力:',
			toastSyncSuccess: '{count} 件の新しいドメインを同期しました',
			systemBlocked: '標準'
		}
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
				if (hasGM && typeof GM_deleteValue === 'function') { GM_deleteValue(key); }
				else if (hasGM) { GM_setValue(key, undefined); }
				memStore.delete(key);
				try { W.localStorage.removeItem(key); } catch (e) {}
			} catch (e) {}
		}
	};

	function getWebhookTarget() {
		try {
			if (!WEBHOOK_PAYLOAD) return '';
			if (WEBHOOK_PAYLOAD.startsWith('http')) return WEBHOOK_PAYLOAD;
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

	function getEffectiveLang() {
		const pref = config && config.lang;
		if (pref && pref !== 'auto' && TRANSLATIONS[pref]) return pref;
		const nav = String((W.navigator && W.navigator.language) || 'en').toLowerCase();
		if (nav.startsWith('vi')) return 'vi';
		if (nav.startsWith('zh')) return 'zh-CN';
		if (nav.startsWith('ja')) return 'ja';
		if (nav.startsWith('ru')) return 'ru';
		return 'en';
	}

	function t(key, params) {
		const dict = TRANSLATIONS[getEffectiveLang()] || TRANSLATIONS.en;
		let s = (dict && dict[key] !== undefined) ? dict[key] : (TRANSLATIONS.en[key] !== undefined ? TRANSLATIONS.en[key] : key);
		if (params && typeof s === 'string') {
			for (const k in params) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(params[k]));
		}
		return s;
	}

	const hostname = (location.hostname || '').toLowerCase().replace(/\.$/, '');
	const state = {
		whitelist: store.get(K_WL, []) || [],
		siteRules: store.get(K_SR, {}) || {},
		customBlockedHosts: store.get(K_BLOCKED, []) || [],
		userAllowedDomains: store.get(K_USER_ALLOWED_NET, []) || [],
		userBlockedDomains: store.get(K_USER_BLOCKED_NET, []) || [],
		trackerMap: store.get(K_TRACKER_MAP, {}) || {},
		learnedTrackers: store.get(K_LEARNED_TRACKERS, []) || [],
		sessionDisabled: store.get(K_SESS, {}) || {},
		tempAllowPopupHosts: new Set(),
		manualBlocks: new Map(),
		hiddenNodes: new WeakSet(),
		removedNodes: [],
		pickerActive: false,
		initialized: false
	};

	const customBlockedSet = new Set(
		(Array.isArray(state.customBlockedHosts) ? state.customBlockedHosts : [])
		.concat(Array.isArray(state.userBlockedDomains) ? state.userBlockedDomains : [])
		.map(h => String(h || '').toLowerCase().trim().replace(/\.$/, ''))
		.filter(Boolean)
	);
	const userBlockedSet = customBlockedSet;

	const userAllowedSet = new Set(
		(Array.isArray(state.userAllowedDomains) ? state.userAllowedDomains : [])
		.map(h => String(h || '').toLowerCase().trim().replace(/\.$/, ''))
		.filter(Boolean)
	);

	const trackerMap = (state.trackerMap && typeof state.trackerMap === 'object') ? state.trackerMap : {};
	const learnedTrackersSet = new Set(
		(Array.isArray(state.learnedTrackers) ? state.learnedTrackers : [])
		.map(h => String(h || '').toLowerCase().trim().replace(/\.$/, ''))
		.filter(Boolean)
	);

	const networkRingBuffer = [];
	const MAX_NET_BUFFER = 80;

	function persistWhitelist() { store.set(K_WL, state.whitelist.slice()); }
	function persistSiteRules() { store.set(K_SR, state.siteRules); }
	function persistCustomBlocked() {
		const arr = Array.from(customBlockedSet);
		store.set(K_BLOCKED, arr);
		store.set(K_USER_BLOCKED_NET, arr);
	}
	function persistUserAllowedDomains() { store.set(K_USER_ALLOWED_NET, Array.from(userAllowedSet)); }
	function persistUserBlockedDomains() { persistCustomBlocked(); }
	function persistTrackerMap() { store.set(K_TRACKER_MAP, trackerMap); }
	function persistLearnedTrackers() { store.set(K_LEARNED_TRACKERS, Array.from(learnedTrackersSet)); }
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
		for (const w of state.whitelist)
			if (hostMatches(h, w)) return true;
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

	function isCustomBlockedHost(h) {
		if (!h || !customBlockedSet.size) return false;
		const norm = String(h).toLowerCase().trim().replace(/\.$/, '');
		if (!norm) return false;
		if (customBlockedSet.has(norm)) return true;
		for (const pattern of customBlockedSet) {
			if (hostMatches(norm, pattern)) return true;
		}
		return false;
	}

	function purgeCustomBlockedDom(domain) {
		if (!domain || !D.documentElement) return;
		try {
			const nodes = D.querySelectorAll('script[src], iframe[src], img[src], img[data-src], a[href]');
			for (let i = 0; i < Math.min(nodes.length, 400); i++) {
				const el = nodes[i];
				if (!el || isNviryaNode(el) || isProtectedPlayer(el)) continue;
				const raw = attr(el, 'src') || attr(el, 'data-src') || attr(el, 'href') || '';
				const u = safeUrl(raw);
				if (u && hostMatches(u.hostname, domain)) {
					const tag = String(el.tagName || '').toLowerCase();
					if (tag === 'script' || tag === 'iframe') {
						applyAction(el, 'remove', 'custom-blocked-domain');
					} else {
						applyAction(el, 'hide', 'custom-blocked-domain');
					}
				}
			}
		} catch (e) {}
	}

	function addCustomBlockedHost(h) {
		const norm = String(h || '').toLowerCase().trim().replace(/\.$/, '');
		if (!norm || norm === hostname) return false;
		if (!customBlockedSet.has(norm)) {
			customBlockedSet.add(norm);
			state.customBlockedHosts.push(norm);
			persistCustomBlocked();
		}
		for (let i = 0; i < networkRingBuffer.length; i++) {
			if (hostMatches(networkRingBuffer[i].hostname, norm)) {
				networkRingBuffer[i].blocked = true;
			}
		}
		installCosmeticCSS();
		purgeCustomBlockedDom(norm);
		return true;
	}

	function removeCustomBlockedHost(h) {
		const norm = String(h || '').toLowerCase().trim().replace(/\.$/, '');
		if (!norm) return false;
		customBlockedSet.delete(norm);
		state.customBlockedHosts = state.customBlockedHosts.filter(x => {
			const item = String(x || '').toLowerCase().trim().replace(/\.$/, '');
			if (item === norm || hostMatches(norm, item)) {
				customBlockedSet.delete(item);
				return false;
			}
			return true;
		});
		persistCustomBlocked();
		for (let i = 0; i < networkRingBuffer.length; i++) {
			const entry = networkRingBuffer[i];
			if (hostMatches(entry.hostname, norm)) {
				const u = safeUrl(entry.url);
				entry.blocked = !!(u && isAdUrl(u));
			}
		}
		installCosmeticCSS();
		return true;
	}

	function recordNetworkRequest(u, type, blocked) {
		if (!u || !u.hostname) return;
		if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
		if (u.origin === location.origin) return;
		const reqHost = u.hostname.toLowerCase().replace(/\.$/, '');
		if (!reqHost || reqHost === hostname) return;
		if (typeof checkAndLearnTracker === 'function') {
			checkAndLearnTracker(reqHost, hostname);
		}
		if (networkRingBuffer.length >= MAX_NET_BUFFER) {
			networkRingBuffer.shift();
		}
		networkRingBuffer.push({
			url: u.href,
			hostname: reqHost,
			type: type || 'fetch',
			blocked: !!blocked,
			time: Date.now()
		});
		if (typeof UI !== 'undefined' && UI.refreshNetworkModalIfOpen) {
			UI.refreshNetworkModalIfOpen();
		}
	}

	function scanStaticDomResources() {
		if (!D.documentElement) return;
		try {
			const existingHosts = new Set();
			for (let i = 0; i < networkRingBuffer.length; i++) {
				if (networkRingBuffer[i] && networkRingBuffer[i].hostname) {
					existingHosts.add(networkRingBuffer[i].hostname);
				}
			}
			const nodes = D.querySelectorAll('script[src], iframe[src], img[src], img[data-src]');
			const lim = Math.min(nodes.length, 300);
			for (let i = 0; i < lim; i++) {
				const el = nodes[i];
				if (!el || isNviryaNode(el)) continue;
				const raw = attr(el, 'src') || attr(el, 'data-src') || '';
				if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) continue;
				const u = safeUrl(raw);
				if (!u || (u.protocol !== 'http:' && u.protocol !== 'https:')) continue;
				if (u.origin === location.origin) continue;
				const reqHost = u.hostname.toLowerCase().replace(/\.$/, '');
				if (!reqHost || reqHost === hostname || existingHosts.has(reqHost)) continue;
				existingHosts.add(reqHost);
				const isBlocked = isAdUrl(u) || el.hasAttribute('data-nvirya-hidden');
				if (networkRingBuffer.length >= MAX_NET_BUFFER) {
					networkRingBuffer.shift();
				}
				networkRingBuffer.push({
					url: u.href,
					hostname: reqHost,
					type: 'dom-element',
					blocked: !!isBlocked,
					time: Date.now()
				});
			}
		} catch (e) {}
	}

	const RE_VALID_DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

	function extractDomainCandidate(rawLine) {
		if (!rawLine || typeof rawLine !== 'string') return '';
		let s = rawLine.trim();
		if (!s || s.startsWith('#') || s.startsWith('!') || s.startsWith('//') || s.startsWith('[')) return '';
		if (s.indexOf('##') !== -1 || s.indexOf('#@#') !== -1 || s.indexOf('#?#') !== -1 || s.indexOf('#$#') !== -1) return '';
		const commentIdx = s.search(/\s+(?:#|!|\/\/)/);
		if (commentIdx !== -1) s = s.slice(0, commentIdx).trim();

		const hostsMatch = s.match(/^(?:0\.0\.0\.0|127\.0\.0\.1|::1)\s+([^\s#]+)/);
		if (hostsMatch) s = hostsMatch[1];

		if (s.startsWith('||')) s = s.slice(2);
		else if (s.startsWith('|')) s = s.slice(1);
		s = s.replace(/^https?:\/\//i, '');
		s = s.replace(/^\*\./, '');
		s = s.split(/[\/?^$:|\s]/)[0].trim().toLowerCase().replace(/^\.+|\.+$/g, '');

		if (!s || s === 'localhost' || s === 'broadcasthost' || s === 'local' || s === hostname) return '';
		if (!RE_VALID_DOMAIN.test(s)) return '';
		return s;
	}

	function parseDomainsFromRawText(rawText) {
		const out = new Set();
		if (!rawText || typeof rawText !== 'string') return out;
		const trimmed = rawText.trim();
		if (!trimmed) return out;

		if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
			try {
				const parsed = JSON.parse(trimmed);
				const collect = (val) => {
					if (!val) return;
					if (typeof val === 'string') {
						const d = extractDomainCandidate(val);
						if (d) out.add(d);
					} else if (Array.isArray(val)) {
						for (let i = 0; i < val.length; i++) collect(val[i]);
					} else if (typeof val === 'object') {
						if (typeof val.domain === 'string') collect(val.domain);
						if (typeof val.hostname === 'string') collect(val.hostname);
						for (const k of Object.keys(val)) {
							const kd = extractDomainCandidate(k);
							if (kd) out.add(kd);
							if (Array.isArray(val[k])) collect(val[k]);
						}
					}
				};
				collect(parsed);
				if (out.size > 0) return out;
			} catch (e) {}
		}

		const lines = trimmed.split(/\r?\n/);
		const maxLines = Math.min(lines.length, 15000);
		for (let i = 0; i < maxLines; i++) {
			const d = extractDomainCandidate(lines[i]);
			if (d) out.add(d);
		}
		return out;
	}

	function syncRulesFromRawUrl(rawUrl, silent) {
		const cleanInput = String(rawUrl || '').trim();
		if (!cleanInput) return;
		let u;
		try {
			u = new URL(cleanInput);
			if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Invalid protocol');
		} catch (e) {
			if (!silent && typeof UI !== 'undefined' && UI.toast) UI.toast(t('ts_ibad'));
			return;
		}

		const fetchUrlObj = new URL(u.href);
		fetchUrlObj.searchParams.set('_t', String(Date.now()));
		const fetchUrl = fetchUrlObj.href;

		const handleResponseText = (text) => {
			try {
				const domains = parseDomainsFromRawText(text);
				let addedCount = 0;
				domains.forEach((d) => {
					if (!customBlockedSet.has(d)) {
						customBlockedSet.add(d);
						state.customBlockedHosts.push(d);
						addedCount++;
					}
				});

				if (addedCount > 0) {
					persistCustomBlocked();
					for (let i = 0; i < networkRingBuffer.length; i++) {
						if (isCustomBlockedHost(networkRingBuffer[i].hostname)) {
							networkRingBuffer[i].blocked = true;
						}
					}
				}

				store.set(K_SYNC_URL, u.href);
				store.set(K_SYNC_TIME, Date.now());

				installCosmeticCSS();
				installSiteRulesCSS();
				try {
					const nodes = D.querySelectorAll('script[src], iframe[src], img[src], img[data-src], a[href]');
					for (let i = 0; i < Math.min(nodes.length, 400); i++) {
						const el = nodes[i];
						if (!el || isNviryaNode(el) || isProtectedPlayer(el)) continue;
						const src = attr(el, 'src') || attr(el, 'data-src') || attr(el, 'href') || '';
						const nu = safeUrl(src);
						if (nu && isCustomBlockedHost(nu.hostname)) {
							const tag = String(el.tagName || '').toLowerCase();
							if (tag === 'script' || tag === 'iframe') applyAction(el, 'remove', 'synced-blocked-domain');
							else applyAction(el, 'hide', 'synced-blocked-domain');
						}
					}
				} catch (err) {}

				if (typeof UI !== 'undefined') {
					if (UI.refreshNetworkModalIfOpen) UI.refreshNetworkModalIfOpen();
					if (!silent && UI.toast) UI.toast(t('toastSyncSuccess', { count: addedCount }));
				}
				log('INFO', 'sync', 'Synced remote rules from ' + u.href + ', new domains:', addedCount);
			} catch (err) {
				log('ERROR', 'sync', err && err.message);
				if (!silent && typeof UI !== 'undefined' && UI.toast) UI.toast(t('ts_ibad'));
			}
		};

		const handleError = (err) => {
			log('WARN', 'sync', 'Failed to sync remote rules', err && err.message);
			if (!silent && typeof UI !== 'undefined' && UI.toast) {
				UI.toast(t('ts_rperr', { msg: (err && err.message) || 'Network error' }));
			}
		};

		if (typeof GM_xmlhttpRequest === 'function') {
			try {
				GM_xmlhttpRequest({
					method: 'GET',
					url: fetchUrl,
					headers: { 'Cache-Control': 'no-cache' },
					nocache: true,
					timeout: 10000,
					onload: (res) => {
						if (res.status >= 200 && res.status < 300 && typeof res.responseText === 'string') {
							handleResponseText(res.responseText);
						} else {
							handleError(new Error('HTTP ' + res.status));
						}
					},
					onerror: () => handleError(new Error('CORS / Network error')),
					ontimeout: () => handleError(new Error('Timeout'))
				});
				return;
			} catch (e) {}
		}

		try {
			fetch(fetchUrl, { cache: 'no-store' })
				.then(res => {
					if (!res.ok) throw new Error('HTTP ' + res.status);
					return res.text();
				})
				.then(handleResponseText)
				.catch(handleError);
		} catch (e) {
			handleError(e);
		}
	}

	function isDisabledHere() {
		if (!config.enabled) return true;
		if (state.sessionDisabled[hostname]) return true;
		if (isWhitelisted(hostname)) return true;
		return false;
	}

	const RE_AD_HOST =
		/(?:^|\.)(?:doubleclick|googlesyndication|googleadservices|adservice\.google|adsystem\.amazon|adnxs|appnexus|adsrvr|rubiconproject|pubmatic|openx|criteo|casalemedia|smartadserver|yieldmo|yieldone|360yield|adhese|sharethrough|teads|bidswitch|onetag|zedo|mgid|taboola|outbrain|revcontent|adcash|clickadu|popads|popcash|propellerads|propeller|propu|adsterra|ad-maven|admaven|exoclick|juicyads|onclickmax|hppymel|wingsmob|macly|viirhpfa|werefilledwit|adnium|zorvec|hilltopads|clickaine|admicro|adflex|adpia|adtrue|adpushup|ecomobi|innity|komoona|popin|zucks|geniee|vclick|vietad|yeah1ads|adnow|monetag|galaksion|richads|rollerads|evadav|pushub|coinhive|crypto-loot|adsco\.re|directrev|yllix|bidvertiser|trafficstars|ero-advertising|adxprt|creativecdn|exdynsrv|adkeeper|yektanet|popmyads|adreactor|go2cloud|bkcdn|magsrv|tsyndicate|brazzersnetwork|indexexchange|triplelift|spotx|spotxchange|tremor|telaria|conversant|eqads|gumgum|sovrn|lijit|districtm|fyber|smaato|mopub|inmobi|vungle|applovin|chartboost|unityads|adcolony|vidible|springserve|freewheel|stickyads|adrecover|33across|emxdgt|flashtalking|groundtruth|krux|bluekai|lotame|eyeota|exelator|liveramp|thetradedesk|quantcast|quantserve|scorecardresearch|imrworldwide|moatads|doubleverify|adsafeprotected|serving-sys|atdmt|media\.net|ads\.twitter|ads-twitter|an\.facebook|ads\.tiktok|adx|adsota|masoffer|accesstrade|googletagmanager\.com|highrevenueformat|cloudiniry|p7jeusk9n|effectivegatecpm|profitablegatecpm|highcpmgate|topcpmgate|revenuecpmgate|cpmrevenuegate|al5sm|co5n|optimalcpm|formatcpm|creativecpm|richcpm|484r|bvtpk|genaalkyls|bebangcaromel|casherscamize|nucleindinkly|kirpankinky|rushloiters|urosomeentrec|pucksdopes|ay267|bblaa|405kk|luugy|a-ads|balauplease)(?:\.|$)/i;

	const RE_SUSPECT_TLD = /\.(?:qpon|cfd|sbs|cyou|icu|rest|bar|buzz|monster|cam|hair|skin|quest)$/i;

	const RE_BANNER_NETWORKS = /(?:exoclick|exosrv|juicyads|trafficjunky|adsterra|eroadvertising|tsyndicate|realsrv|histats|mgid|taboola|outbrain|revcontent|adskeeper|propellerads|admaven|popads|popcash|a-ads\.com|bnhtml)/i;

	const SAFE_THIRD_PARTY_CDNS = new Set([
		'googleapis.com', 'gstatic.com', 'cloudflare.com', 'cdnjs.cloudflare.com',
		'jsdelivr.net', 'unpkg.com', 'bootstrapcdn.com', 'jquery.com',
		'fontawesome.com', 'ytimg.com', 'googlevideo.com', 'youtube.com',
		'vimeo.com', 'vimeocdn.com', 'jwpcdn.com', 'jwpsrv.com', 'akamaized.net', 'fastly.net',
		'cloudfront.net', 'github.io', 'githubusercontent.com', 'gitlab.com',
		'recaptcha.net', 'hcaptcha.com', 'challenges.cloudflare.com', 'turnstile.com',
		'arkoselabs.com', 'funcaptcha.com', 'geetest.com', 'ddos-guard.net',
		'stripe.com', 'paypal.com', 'pay.google.com', 'apple.com', 'microsoft.com', 'bing.com',
		'disqus.com', 'disquscdn.com', 'gravatar.com', 'wp.com', 'shopify.com', 'shopifycdn.com',
		'sentry.io', 'auth0.com', 'clerk.com', 'supabase.co', 'firebaseio.com', 'firebaseapp.com',
		'googleusercontent.com', 'ggpht.com'
	]);

	function isSafeThirdPartyCdn(host) {
		if (!host) return false;
		const h = String(host).toLowerCase().replace(/\.$/, '');
		if (SAFE_THIRD_PARTY_CDNS.has(h)) return true;
		for (const cdn of SAFE_THIRD_PARTY_CDNS) {
			if (h === cdn || h.endsWith('.' + cdn)) return true;
		}
		return false;
	}

	function isLearnedTrackerHost(h) {
		if (!h || !learnedTrackersSet.size) return false;
		const norm = String(h).toLowerCase().trim().replace(/\.$/, '');
		if (learnedTrackersSet.has(norm)) return true;
		const root = typeof rootDomain === 'function' ? rootDomain(norm) : '';
		return !!root && learnedTrackersSet.has(root);
	}

	function checkAndLearnTracker(targetHost, pageHost) {
		if (!config.smartTrackerProtection) return;
		if (!targetHost || !pageHost) return;
		const tHost = String(targetHost).toLowerCase().replace(/\.$/, '');
		const pRoot = typeof rootDomain === 'function' ? rootDomain(pageHost) : '';
		const tRoot = typeof rootDomain === 'function' ? rootDomain(tHost) : '';
		if (!pRoot || !tRoot || pRoot === tRoot) return;
		if (isSafeThirdPartyCdn(tHost) || isSafeThirdPartyCdn(tRoot)) return;
		if (userAllowedSet.has(tHost) || userAllowedSet.has(tRoot)) return;
		if (learnedTrackersSet.has(tHost) || learnedTrackersSet.has(tRoot)) return;

		let sites = trackerMap[tHost];
		if (!Array.isArray(sites)) {
			const keys = Object.keys(trackerMap);
			if (keys.length >= 300) {
				delete trackerMap[keys[0]];
			}
			sites = [];
			trackerMap[tHost] = sites;
		}
		if (!sites.includes(pRoot)) {
			sites.push(pRoot);
			if (sites.length >= 3) {
				learnedTrackersSet.add(tHost);
				persistLearnedTrackers();
				log('BLOCK', 'tracker', 'Learned 3-strike cross-site tracker:', tHost);
			}
			persistTrackerMap();
		}
	}

	const RE_INLINE_AD_SCRIPT = /apu\.php\?zoneid|484r\.com|bvtpk\.com|rushloiters|kirpankinky|pucksdopes|bebangcaromel|casherscamize|nucleindinkly|genaalkyls|urosomeentrec|_vrx|atOptions|popunder|(?:[?&]zoneid=\d{5,}|['"]zoneid['"]\s*:\s*['"]?\d{5,})|dataset\.zone\s*=|createElement\(['"]script['"]\)[\s\S]{0,240}?https?:\/\/[a-z0-9.-]+\.(?:cfd|qpon|sbs|cyou|icu|rest|buzz|monster|cam|hair|skin|quest)(?:[\/:'"?#]|$)/i;

	const RE_AD_STACK = /(?:^|[/.])(?:doubleclick|googlesyndication|adnxs|popads|popcash|propellerads|propeller|propu|adsterra|ad-maven|admaven|exoclick|juicyads|onclickmax|wingsmob|hilltopads|monetag|galaksion|richads|rollerads|evadav|highrevenueformat|cloudiniry|p7jeusk9n|effectivegatecpm|profitablegatecpm|highcpmgate|topcpmgate|revenuecpmgate|cpmrevenuegate|al5sm|co5n|484r|bvtpk|genaalkyls|bebangcaromel|casherscamize|nucleindinkly|kirpankinky|rushloiters|urosomeentrec|pucksdopes|ay267|bblaa|405kk|luugy|a-ads|balauplease)\.|https?:\/\/[^/\s]*\.(?:qpon|cfd|sbs|cyou|icu|rest|bar|buzz|monster|cam|hair|skin|quest)(?:[/:?#]|$)/i;

	const RE_GAMBLING_HOST =
		/(?:^|\.)(?:yo88|hitclub|gemwin|zowin|rikvip|sunwin|debet|3bet|five88|sin88|ball88|sv88|bom88|win79|k8cc|j88|fun88|w88|m88|188bet|fb88|ee88|hi88|go88|nohu|bet88|v9bet|kubet|ku11|ku9|jun88|8xbet|new88|789bet|789club|b52|iwin|man88|hbet|f8bet|bk8|vwin|11bet|12bet|138bet|letou|vn88|dafabet|sbobet|cmd368|bong88|123b|mibet|one88|oxbet|red88|sm66|mmwin|78win|win55|fabet|lucky88|vx88|tt88|qq88|kimsa|loto188|shbet|mb66|gk88|okvip|rr88|79king|bj88|king88|69vn|betvisa|thabet|ta88|zbet|mu9|sodo66|qh88|onbet|vz99|k8vina|i9bet|viva88|ok9|go99|hb88|vip52|rik789|dabet|may88|sky88|uk88|bong99|88online|kubet77|kubet88|hi88vip|f8bet0|shbet0|789bet0|jun880|new880)(?:\.|$)/i;

	const RE_AD_PATH =
		/(?:^|\/)(?:adserver|adservice|advert|adunit|adframe|popunder|popads|banner[-_]?ads?|ad[-_]?(?:slot|unit|frame|box|banner|container|zone|loader|delivery|wrapper|rotate)|vast|vpaid|prebid|revive|openx|adclient|adtag|nativeads?|interstitial[-_]?ad|sponsored[-_]?post|adclick|aff[-_]?click|clickserv(?:er)?|cgi-bin\/(?:dl|pop|jump|gate|out|tracker).*\.cgi|(?:\/|^)ad[_-]?(?:gate|jump|direct|click))(?:\/|\.|$)/i;

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

	const RE_TRACKING_PARAM_KEY =
		/^(?:utm_[a-z0-9_]+|click_?id|clk_?id|aff(?:iliate)?(?:_id|_sub)?|camp(?:aign)?_?id|ref_?id|track(?:ing)?_?id|ad_?id|banner_?id|zone_?id|gclid|fbclid|dclid|msclkid|mc_cid|mc_eid|spm|ref_src|ref_url|gbraid|wbraid|si|trk|trac_?id|sub_?id|s2s_?id|twclid|igshid|yclid|vero_id|oly_anon_id|oly_enc_id|_hsenc|_hsmi|mkt_tok|s_cid|ef_id|cmpid)$/i;

	function stripTrackingParams(uOrStr) {
		if (!uOrStr || isSecurityVerificationPage()) return uOrStr;
		let u = null;
		let isStringInput = false;
		if (typeof uOrStr === 'string') {
			isStringInput = true;
			u = safeUrl(uOrStr);
		} else if (uOrStr instanceof URL || (uOrStr && typeof uOrStr.searchParams === 'object')) {
			u = uOrStr;
		}
		if (!u || !u.searchParams) return uOrStr;

		if (u.hostname && (isYouTubeDomain(u.hostname) || RE_YOUTUBE_HOST.test(u.hostname))) {
			return uOrStr;
		}

		let modified = false;
		const toRemove = [];
		try {
			u.searchParams.forEach((val, key) => {
				if (RE_TRACKING_PARAM_KEY.test(key)) {
					toRemove.push(key);
				}
			});
			if (toRemove.length > 0) {
				for (let i = 0; i < toRemove.length; i++) {
					u.searchParams.delete(toRemove[i]);
				}
				modified = true;
			}
		} catch (e) {}

		if (isStringInput) {
			return modified ? u.href : uOrStr;
		}
		return u;
	}

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
		for (const t of TRUSTED_POPUP_HOSTS)
			if (hostMatches(h, t)) return true;
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

	const getTodayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

	function recordWeeklyStat(delta = 1) {
		try {
			const data = store.get(K_WEEKLY, {}) || {};
			const today = getTodayKey();
			data[today] = (data[today] || 0) + delta;

			const keys = Object.keys(data).sort();
			if (keys.length > 14) {
				delete data[keys[0]];
			}
			store.set(K_WEEKLY, data);
		} catch (e) {}
	}

	const stats = {
		session: { ads: 0, popups: 0, redirects: 0, hidden: 0, removed: 0, requests: 0 },
		lifetime: { ads: 0, popups: 0, redirects: 0, hidden: 0, removed: 0, requests: 0 },
		antiAdblock: {
			session: { detections: 0, recoveries: 0, failed: 0, repeated: 0, falsePositives: 0 },
			lifetime: { detections: 0, recoveries: 0, failed: 0, repeated: 0, falsePositives: 0 }
		},

		get ads() { return this.session.ads; },
		set ads(v) {
			const d = v - this.session.ads;
			this.session.ads = v;
			this.lifetime.ads += d;
			this.scheduleSave();
		},
		get popups() { return this.session.popups; },
		set popups(v) {
			const d = v - this.session.popups;
			this.session.popups = v;
			this.lifetime.popups += d;
			this.scheduleSave();
		},
		get redirects() { return this.session.redirects; },
		set redirects(v) {
			const d = v - this.session.redirects;
			this.session.redirects = v;
			this.lifetime.redirects += d;
			this.scheduleSave();
		},
		get hidden() { return this.session.hidden; },
		set hidden(v) {
			const d = v - this.session.hidden;
			this.session.hidden = v;
			this.lifetime.hidden += d;
			this.scheduleSave();
		},
		get removed() { return this.session.removed; },
		set removed(v) {
			const d = v - this.session.removed;
			this.session.removed = v;
			this.lifetime.removed += d;
			this.scheduleSave();
		},
		get requests() { return this.session.requests; },
		set requests(v) {
			const d = v - this.session.requests;
			this.session.requests = v;
			this.lifetime.requests += d;
			this.scheduleSave();
		},

		_loaded: false,
		load() {
			if (this._loaded) return;
			this._loaded = true;
			const s = store.get(K_ST, null) || {};
			this.lifetime.ads = (s.ads | 0) + this.session.ads;
			this.lifetime.popups = (s.popups | 0) + this.session.popups;
			this.lifetime.redirects = (s.redirects | 0) + this.session.redirects;
			this.lifetime.hidden = (s.hidden | 0) + this.session.hidden;
			this.lifetime.removed = (s.removed | 0) + this.session.removed;
			this.lifetime.requests = (s.requests | 0) + this.session.requests;
			const aab = (s.antiAdblock && typeof s.antiAdblock === 'object') ? s.antiAdblock : {};
			this.antiAdblock.lifetime.detections = (aab.detections | 0) + this.antiAdblock.session.detections;
			this.antiAdblock.lifetime.recoveries = (aab.recoveries | 0) + this.antiAdblock.session.recoveries;
			this.antiAdblock.lifetime.failed = (aab.failed | 0) + this.antiAdblock.session.failed;
			this.antiAdblock.lifetime.repeated = (aab.repeated | 0) + this.antiAdblock.session.repeated;
			this.antiAdblock.lifetime.falsePositives = (aab.falsePositives | 0) + this.antiAdblock.session.falsePositives;
		},

		saveImmediate() {
			if (!this._loaded) this.load();
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
				requests: this.lifetime.requests,
				antiAdblock: {
					detections: this.antiAdblock.lifetime.detections,
					recoveries: this.antiAdblock.lifetime.recoveries,
					failed: this.antiAdblock.lifetime.failed,
					repeated: this.antiAdblock.lifetime.repeated,
					falsePositives: this.antiAdblock.lifetime.falsePositives
				}
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
			if (key === 'ads' || key === 'hidden') recordWeeklyStat(delta);
			this.scheduleSave();
			if (typeof UI !== 'undefined' && UI.isMenuOpen && UI.isMenuOpen()) {
				UI.renderStats();
			}
		},

		incAntiAdblock(key, delta = 1) {
			if (this.antiAdblock.session[key] !== undefined) this.antiAdblock.session[key] += delta;
			if (this.antiAdblock.lifetime[key] !== undefined) this.antiAdblock.lifetime.detections !== undefined && (this.antiAdblock.lifetime[key] += delta);
			this.scheduleSave();
		},

		save() { this.saveImmediate(); },

		reset() {
			this.session = { ads: 0, popups: 0, redirects: 0, hidden: 0, removed: 0, requests: 0 };
			this.lifetime = { ads: 0, popups: 0, redirects: 0, hidden: 0, removed: 0, requests: 0 };
			this.antiAdblock.session = { detections: 0, recoveries: 0, failed: 0, repeated: 0, falsePositives: 0 };
			this.antiAdblock.lifetime = { detections: 0, recoveries: 0, failed: 0, repeated: 0, falsePositives: 0 };
			this.saveImmediate();
		}
	};
	const origVisStateDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState') ||
		Object.getOwnPropertyDescriptor(D, 'visibilityState');
	const origHiddenDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden') ||
		Object.getOwnPropertyDescriptor(D, 'hidden');

	function getRealVisibilityState() {
		try {
			if (origVisStateDesc && typeof origVisStateDesc.get === 'function') {
				return origVisStateDesc.get.call(D);
			}
		} catch (e) {}
		return D.visibilityState;
	}

	try {
		const syncFlush = () => { stats.saveImmediate(); };
		W.addEventListener('pagehide', syncFlush, { capture: true });
		W.addEventListener('beforeunload', syncFlush);
		D.addEventListener('visibilitychange', () => {
			if (getRealVisibilityState() === 'hidden') syncFlush();
		}, true);
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
		'ac.uk', 'co.uk', 'gov.uk', 'ltd.uk', 'me.uk', 'net.uk', 'org.uk', 'plc.uk',
		'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'asn.au', 'id.au',
		'co.nz', 'net.nz', 'org.nz', 'govt.nz', 'ac.nz',
		'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
		'co.kr', 'or.kr', 'ne.kr', 'go.kr', 'ac.kr',
		'com.br', 'net.br', 'org.br', 'gov.br', 'edu.br',
		'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
		'com.sg', 'net.sg', 'org.sg', 'gov.sg', 'edu.sg',
		'com.my', 'net.my', 'org.my', 'gov.my', 'edu.my',
		'com.ph', 'net.ph', 'org.ph', 'gov.ph', 'edu.ph',
		'com.vn', 'net.vn', 'org.vn', 'gov.vn', 'edu.vn', 'ac.vn',
		'co.in', 'firm.in', 'net.in', 'org.in', 'gen.in', 'ind.in',
		'com.tr', 'net.tr', 'org.tr', 'gov.tr', 'edu.tr',
		'com.tw', 'net.tw', 'org.tw', 'gov.tw', 'edu.tw',
		'co.id', 'web.id', 'or.id', 'ac.id', 'go.id',
		'co.th', 'in.th', 'or.th', 'ac.th', 'go.th',
		'com.hk', 'net.hk', 'org.hk', 'gov.hk', 'edu.hk',
		'com.pk', 'net.pk', 'org.pk', 'gov.pk', 'edu.pk',
		'com.bd', 'net.bd', 'org.bd', 'gov.bd', 'edu.bd'
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
		const ra = rootDomain(a),
			rb = rootDomain(b);
		return !!ra && !!rb && ra === rb;
	}

	function isAllowedPopupDestination(url) {
		if (!url) return false;
		if (isAdUrl(url)) return false;
		if (url.protocol === 'blob:' && url.origin === location.origin) return true;
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
		return isTrustedPopupHost(url.hostname) || sameRootDomain(url.hostname, hostname);
	}

	function isYouTubeDomain(h = hostname) {
		return RE_YOUTUBE_HOST.test(String(h || '').toLowerCase().replace(/\.$/, ''));
	}

	function isYouTubeWhitelistedRequest(uOrStr) {
		if (!uOrStr) return false;
		const s = typeof uOrStr === 'string' ? uOrStr : String(uOrStr.href || '');
		if (RE_YOUTUBE_AD_ENDPOINT.test(s) || RE_SECURITY_CHALLENGE.test(s)) {
			return RE_SECURITY_CHALLENGE.test(s);
		}
		if (typeof uOrStr === 'object' && uOrStr.hostname) {
			const h = String(uOrStr.hostname).toLowerCase();
			if (/(?:^|\.)(?:googlevideo\.com|ytimg\.com|yt3\.ggpht\.com|youtube-nocookie\.com)$/i.test(h)) {
				return true;
			}
		}
		return RE_YOUTUBE_CDN_WHITELIST.test(s);
	}

	function isGoogleCoreHost(host) {
		if (!host) return false;
		const h = String(host).toLowerCase().replace(/\.$/, '');
		if (/^adservice\./i.test(h)) return false;
		return RE_GOOGLE_CORE_HOST.test(h);
	}

	function isSuspiciousAdDomain(host) {
		if (!host) return false;
		const h = String(host).toLowerCase().replace(/\.$/, '');
		if (!h || isGoogleCoreHost(h) || isYouTubeDomain(h) || sameRootDomain(h, hostname) || isWhitelisted(h) || isTrustedPopupHost(h)) return false;
		return RE_SUSPECT_TLD.test(h);
	}

	function isTranslatorWhitelistedRequest(uOrStr) {
		if (!uOrStr) return false;
		const s = typeof uOrStr === 'string' ? uOrStr : String(uOrStr.href || '');
		if (RE_TRANSLATOR_WHITELIST.test(s)) return true;
		if (RE_TRANSLATOR_WHITELIST.test(location.href || '')) {
			const u = typeof uOrStr === 'object' ? uOrStr : safeUrl(s);
			if (u && (sameRootDomain(u.hostname, hostname) || /(?:google\.[a-z.]+|googleapis\.com|gstatic\.com|bing\.com|microsoft\.com|microsofttranslator\.com)$/i.test(u.hostname))) {
				return true;
			}
		}
		return false;
	}

	function isUserAllowedNetHost(h, pageHost) {
		if (!h || !userAllowedSet.size) return false;
		const norm = String(h).toLowerCase().trim().replace(/\.$/, '');
		if (userAllowedSet.has(norm)) return true;
		for (const allowed of userAllowedSet) {
			if (hostMatches(norm, allowed)) return true;
		}
		return false;
	}

	function isUserBlockedNetHost(h) {
		if (!h || !userBlockedSet.size) return false;
		const norm = String(h).toLowerCase().trim().replace(/\.$/, '');
		if (userBlockedSet.has(norm)) return true;
		for (const b of userBlockedSet) {
			if (hostMatches(norm, b)) return true;
		}
		return false;
	}

	function isAdUrl(u, pageHostname, skipLearnedTracker = false) {
		if (!u) return false;
		let urlObj = u;
		if (typeof u === 'string') {
			urlObj = safeUrl(u);
			if (!urlObj) return false;
		}
		const h = String(urlObj.hostname || '').toLowerCase().replace(/\.$/, '');
		const href = String(urlObj.href || '');
		if (RE_SECURITY_CHALLENGE.test(href) || RE_SECURITY_CHALLENGE_HOST.test(h)) return false;
		const pageHost = String(pageHostname || hostname || '').toLowerCase();

		if (isUserAllowedNetHost(h, pageHost)) return false;

		if (isUserBlockedNetHost(h)) return true;

		if (!skipLearnedTracker && config.smartTrackerProtection && isLearnedTrackerHost(h)) return true;

		if (RE_TRANSLATOR_WHITELIST.test(href) || isTranslatorWhitelistedRequest(urlObj)) return false;
		if (RE_YOUTUBE_AD_ENDPOINT.test(href)) return true;
		if (isYouTubeWhitelistedRequest(urlObj)) return false;
		const p = String(urlObj.pathname || '').toLowerCase();
		if (isYouTubeDomain(h)) return false;
		if (isGoogleCoreHost(h)) return false;
		if (RE_GAMBLING_HOST.test(h)) return true;
		if (RE_AD_HOST.test(h)) return true;
		if (RE_AD_STACK.test(href)) return true;
		if (RE_BANNER_NETWORKS.test(href)) return true;
		if (isSuspiciousAdDomain(h)) return true;
		if (RE_AD_PATH.test(p)) return true;
		return false;
	}

	const PLAYER_TAGS = new Set(['video', 'audio', 'source', 'track']);
	const PLAYER_CLASS_RE = /(?:^|[-_\s])(?:jwplayer|jw[-_]?video|jw[-_]?wrapper|video[-_]?js|vjs[-_]|plyr|plyr__|artplayer|dplayer|videojs|media[-_]?player|video[-_]?player|shaka[-_]?video|hls[-_]?player|dashjs|flowplayer|clappr|afterglow|mediaelement)(?:[-_\s]|$)/i;
	const PLAYER_ID_RE = /^(?:player|video[-_]?player|movie[-_]?player|main[-_]?player|media[-_]?player|jwplayer|vjs_container|artplayer)$/i;
	const PLAYER_CONTROL_RE = /(?:^|[-_\s])(?:play|pause|fullscreen|full[-_]?screen|volume|mute|seek|progress|control|vjs-control|jw-icon|plyr__control)(?:[-_\s]|$)/i;

	function isProtectedPlayer(el) {
		if (!config.playerProtection) return false;
		let cur = el,
			depth = 0;
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
				configurable: false,
				enumerable: true,
				get: () => 'about:blank',
				set: () => {}
			});
		} catch (e) {}
		dummyLocation.assign = function() {};
		dummyLocation.replace = function() {};
		return {
			closed: true,
			opener: null,
			location: dummyLocation,
			close: function() {},
			focus: function() {},
			blur: function() {},
			postMessage: function() {}
		};
	}

	let lastUserTarget = null;
	let lastUserTargetTime = 0;

	function trackUserTarget(target) {
		if (target && target.nodeType === 1) {
			lastUserTarget = target;
			lastUserTargetTime = Date.now();
		}
	}

	function triggerAdInterceptedAction() {
		try {
			let active = D.activeElement;
			if (!active || active === D.body || active === D.documentElement) {
				if (Date.now() - lastUserTargetTime < 1500 && lastUserTarget) {
					active = lastUserTarget;
				}
			}
			if (!active || active.nodeType !== 1) return;

			const interactive = active.closest ? active.closest('button, a, input[type="submit"], input[type="button"]') : null;
			const targetEl = interactive || active;

			if (targetEl.__nvirya_retrying) return;

			const tag = (targetEl.tagName || '').toLowerCase();
			const id = (targetEl.id || '').toLowerCase();
			const cls = classString(targetEl).toLowerCase();
			const text = (targetEl.textContent || '').trim().toLowerCase();
			const type = (attr(targetEl, 'type') || '').toLowerCase();

			const isActionEl = tag === 'button' ||
				(tag === 'input' && (type === 'submit' || type === 'button')) ||
				(tag === 'a' && (/btn|button/i.test(cls) || /btn|button/i.test(id) || /download|continue|tải|xem/i.test(text))) ||
				/download|continue|direct|original|submit|next/i.test(id + ' ' + cls) ||
				/download|continue|tải|xem|tiếp tục/i.test(text);

			if (isActionEl) {
				targetEl.__nvirya_retrying = true;
				setTimeout(() => {
					try {
						targetEl.__nvirya_retrying = false;
						log('INFO', 'ad-gate', 'Auto-advancing intercepted download button:', targetEl.id || targetEl.tagName);
						targetEl.click();
					} catch (e) {}
				}, 60);
			}
		} catch (e) {}
	}

	function popupBlock(source, detail) {
		recordBlocked('popup', source, detail);
		triggerAdInterceptedAction();
		return makeDummyWindow();
	}

	const RE_GUARDED_EVENT_TYPES = /^(?:click|mousedown|mouseup|pointerdown|pointerup|touchstart|touchend|contextmenu|blur|focus|beforeunload)$/i;

	function isAdCallStack() {
		try {
			if (isYouTubeDomain(hostname)) return false;
			const cs = D.currentScript;
			if (cs) {
				const src = cs.src || attr(cs, 'src') || '';
				if (src) {
					if (/eruda|vconsole|chobitsu|challenge-platform|turnstile/i.test(src)) return false;
					return RE_AD_STACK.test(src) || /wingsmob/i.test(src);
				}
			}
			const stack = (new Error().stack) || '';
			if (!stack || /eruda|vconsole|chobitsu|challenge-platform|turnstile|hcaptcha|recaptcha/i.test(stack)) return false;
			return RE_AD_STACK.test(stack) || /wingsmob/i.test(stack);
		} catch (e) {
			return false;
		}
	}

	function installEventListenerGuard() {
		if (isYouTubeDomain(hostname)) return;
		try {
			const origAEL = EventTarget.prototype.addEventListener;
			if (typeof origAEL === 'function' && !origAEL.__nvirya) {
				const guardedAEL = function(type, listener, options) {
					try {
						if (
							config.enabled &&
							!isDisabledHere() &&
							RE_GUARDED_EVENT_TYPES.test(String(type || '')) &&
							isAdCallStack()
						) {
							log('BLOCK', 'event-trap', 'Defused ad listener via stack:', type);
							return;
						}
					} catch (err) {}
					return origAEL.apply(this, arguments);
				};
				try { Object.defineProperty(guardedAEL, '__nvirya', { value: true }); } catch (e) {}
				EventTarget.prototype.addEventListener = guardedAEL;
			}
		} catch (e) {}

		try {
			const origST = W.setTimeout;
			if (typeof origST === 'function' && !origST.__nvirya) {
				const guardedST = function(fn, delay) {
					try {
						if (config.enabled && !isDisabledHere()) {
							if (typeof fn === 'string') {
								if (RE_INLINE_AD_SCRIPT.test(fn)) return 0;
							} else if (D.currentScript && isAdCallStack()) {
								return 0;
							}
						}
					} catch (err) {}
					return origST.apply(this, arguments);
				};
				try { Object.defineProperty(guardedST, '__nvirya', { value: true }); } catch (e) {}
				W.setTimeout = guardedST;
			}
			const origSI = W.setInterval;
			if (typeof origSI === 'function' && !origSI.__nvirya) {
				const guardedSI = function(fn, delay) {
					try {
						if (config.enabled && !isDisabledHere()) {
							if (typeof fn === 'string') {
								if (RE_INLINE_AD_SCRIPT.test(fn)) return 0;
							} else if (D.currentScript && isAdCallStack()) {
								return 0;
							}
						}
					} catch (err) {}
					return origSI.apply(this, arguments);
				};
				try { Object.defineProperty(guardedSI, '__nvirya', { value: true }); } catch (e) {}
				W.setInterval = guardedSI;
			}
		} catch (e) {}
	}

	const RE_CLIPBOARD_ALLOW = /copy|sao chép|clipboard|share|code|mã|link/i;
	const RE_MAINSTREAM_VIDEO_HOST = /(?:^|\.)(?:youtube\.com|youtu\.be|vimeo\.com|twitch\.tv|netflix\.com|bilibili\.com|dailymotion\.com|tiktok\.com|iq\.com|wetv\.vip|fptplay\.vn|vieon\.vn)$/i;

	function isAllowedClipboardNode(node) {
		if (!node || node.nodeType !== 1) return false;
		if (isNviryaNode(node)) return true;
		let cur = node,
			depth = 0;
		while (cur && cur.nodeType === 1 && depth < 6) {
			const tag = String(cur.tagName || '').toLowerCase();
			if (tag === 'body' || tag === 'html') break;
			if (isNviryaNode(cur)) return true;
			if (tag === 'pre' || tag === 'code' || tag === 'input' || tag === 'textarea' || cur.isContentEditable) return true;
			const meta = ((cur.id || '') + ' ' + classString(cur) + ' ' + (attr(cur, 'aria-label') || '') + ' ' + (attr(cur, 'title') || '')).trim();
			const txt = String(cur.textContent || '').trim();
			if (RE_CLIPBOARD_ALLOW.test(meta) || (txt.length <= 160 && RE_CLIPBOARD_ALLOW.test(txt))) return true;
			cur = cur.parentElement;
			depth++;
		}
		return false;
	}

	function isClipboardWriteAllowed() {
		if (!config.enabled || isDisabledHere()) return true;
		const recentTarget = (Date.now() - lastUserTargetTime < 4000) ? lastUserTarget : null;
		if (isAllowedClipboardNode(recentTarget) || isAllowedClipboardNode(D.activeElement)) return true;
		return false;
	}

	function shouldSpoofVisibility() {
		if (!config.enabled || isDisabledHere() || isSecurityVerificationPage()) return false;
		if (RE_MAINSTREAM_VIDEO_HOST.test(hostname) || isSearchEngineDomain(hostname) || TRUSTED_DOCS_DOMAINS.test(hostname) || isTrustedPopupHost(hostname)) return false;
		return stats.session.popups > 0 || stats.session.redirects > 0 || stats.session.ads > 0;
	}

	function installClipboardAndVisibilityGuard() {
		if (W.__nvirya_clip_vis_guard) return;
		try { Object.defineProperty(W, '__nvirya_clip_vis_guard', { value: true }); } catch (e) { W.__nvirya_clip_vis_guard = true; }

		try {
			const clipTargets = [];
			if (W.Clipboard && W.Clipboard.prototype) clipTargets.push(W.Clipboard.prototype);
			if (W.navigator && W.navigator.clipboard && clipTargets.indexOf(W.navigator.clipboard) === -1) {
				clipTargets.push(W.navigator.clipboard);
			}
			clipTargets.forEach((target) => {
				if (!target || typeof target.writeText !== 'function' || target.writeText.__nvirya) return;
				const origWriteText = target.writeText;
				const guardedWriteText = function(text) {
					try {
						if (!isClipboardWriteAllowed()) {
							log('BLOCK', 'clipboard', 'Blocked unauthorized clipboard write');
							return Promise.resolve();
						}
					} catch (err) {}
					return origWriteText.apply(this, arguments);
				};
				try { Object.defineProperty(guardedWriteText, '__nvirya', { value: true }); } catch (e) {}
				try {
					Object.defineProperty(target, 'writeText', {
						configurable: true,
						writable: true,
						value: guardedWriteText
					});
				} catch (e) {
					try { target.writeText = guardedWriteText; } catch (e2) {}
				}
			});
		} catch (e) {}

		try {
			const docProto = (W.Document && W.Document.prototype) || D;
			const origExecCommand = docProto.execCommand || D.execCommand;
			if (typeof origExecCommand === 'function' && !origExecCommand.__nvirya) {
				const guardedExecCommand = function(command) {
					try {
						if (typeof command === 'string' && /^copy$/i.test(command.trim()) && !isClipboardWriteAllowed()) {
							log('BLOCK', 'clipboard', 'Blocked unauthorized clipboard write');
							return false;
						}
					} catch (err) {}
					return origExecCommand.apply(this, arguments);
				};
				try { Object.defineProperty(guardedExecCommand, '__nvirya', { value: true }); } catch (e) {}
				try {
					Object.defineProperty(docProto, 'execCommand', {
						configurable: true,
						writable: true,
						value: guardedExecCommand
					});
				} catch (e) {
					try { D.execCommand = guardedExecCommand; } catch (e2) {}
				}
			}
		} catch (e) {}

		try {
			const docProto = (W.Document && W.Document.prototype) || D;
			Object.defineProperty(docProto, 'visibilityState', {
				configurable: true,
				enumerable: true,
				get: function() {
					if (shouldSpoofVisibility()) return 'visible';
					return origVisStateDesc && origVisStateDesc.get ? origVisStateDesc.get.call(this) : 'visible';
				}
			});
			Object.defineProperty(docProto, 'hidden', {
				configurable: true,
				enumerable: true,
				get: function() {
					if (shouldSpoofVisibility()) return false;
					return origHiddenDesc && origHiddenDesc.get ? origHiddenDesc.get.call(this) : false;
				}
			});
			Object.defineProperty(docProto, 'webkitHidden', {
				configurable: true,
				enumerable: true,
				get: function() {
					if (shouldSpoofVisibility()) return false;
					return origHiddenDesc && origHiddenDesc.get ? origHiddenDesc.get.call(this) : false;
				}
			});
		} catch (e) {}

		try {
			const stopVisEvent = (e) => {
				if (shouldSpoofVisibility()) {
					e.stopImmediatePropagation();
				}
			};
			D.addEventListener('visibilitychange', stopVisEvent, true);
			D.addEventListener('webkitvisibilitychange', stopVisEvent, true);
			W.addEventListener('visibilitychange', stopVisEvent, true);
			W.addEventListener('blur', (e) => {
				if (e.target === W || e.target === D) {
					stopVisEvent(e);
				}
			}, true);
		} catch (e) {}
	}

	function installPopupGuard() {
		const origOpen = W.open;
		if (typeof origOpen !== 'function') return;
		if (origOpen.__nvirya) return;

		const guarded = function(url, name, features) {
			try {
				if (state.pickerActive) {
					log('BLOCK', 'picker-lock', 'Blocked window.open during active Element Picker');
					return makeDummyWindow();
				}
				if (!config.popupProtection || isDisabledHere() || isSearchEngineDomain()) return origOpen.apply(this, arguments);
				const rawStr = url == null ? '' : String(url).trim();

				if (!rawStr || /^about:blank(?:[#?].*)?$/i.test(rawStr)) {
					return popupBlock('empty-or-blank-url', rawStr || '(empty)');
				}

				let u = safeUrl(rawStr);
				if (!u) return popupBlock('unparseable-url', rawStr);
				u = stripTrackingParams(u);
				if (isAdUrl(u)) return popupBlock('ad-url', u.href);

				if (!isAllowedPopupDestination(u)) {
					return popupBlock('untrusted-cross-site', u.href);
				}

				arguments[0] = u.href;
				return origOpen.apply(this, arguments);
			} catch (e) {
				log('ERROR', 'popup', e && e.message);
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

	function shouldBlockRedirectUrl(u, isAutomated) {
		if (!u) return false;
		if (isYouTubeWhitelistedRequest(u) || isYouTubeDomain(u.hostname)) return false;
		if (isAdUrl(u)) return true;
		if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
		if (sameRootDomain(u.hostname, hostname)) return false;
		if (isTrustedPopupHost(u.hostname)) return false;

		const hasGesture = !!(W.navigator.userActivation && W.navigator.userActivation.isActive);
		const isAuto = isAutomated !== undefined ? isAutomated : (!hasGesture && isEarlyPageLoad(6000));
		return isAuto;
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
		while (node) {
			path.push(node);
			node = node.parentNode || node.host || null;
		}
		return path;
	}

	function isExtensionUiPath(path) {
		return path.some(node => node && node.nodeType === 1 &&
			(attr(node, 'data-nvirya-ui') !== null || attr(node, 'data-nvirya-picker') !== null));
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
		try {
			style = W.getComputedStyle(target);
			rect = target.getBoundingClientRect();
		} catch (e) { return false; }
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
		try {
			e.stopPropagation();
			e.stopImmediatePropagation();
		} catch (err) {}
		recordBlocked(kind, source, url);
		return true;
	}

	function installAnchorClickHook() {
		try {
			const proto = W.HTMLAnchorElement && W.HTMLAnchorElement.prototype;
			if (!proto || proto.__nvirya_click) return;
			const originalClick = proto.click;
			if (typeof originalClick !== 'function') return;
			const guardedClick = function() {
				try {
					if (config.redirectProtection && !isDisabledHere()) {
						const hrefAttr = this.href || attr(this, 'href') || '';
						let u = safeUrl(hrefAttr);
						if (u) {
							const cleaned = stripTrackingParams(u);
							if (cleaned && cleaned.href && cleaned.href !== hrefAttr) {
								try { this.href = cleaned.href; } catch (e) {}
								u = cleaned;
							}
						}
						if (!isSearchEngineDomain()) {
							const isAdRedirect = u && (isAdUrl(u) || shouldBlockRedirectUrl(u) || /(?:invoke_layer|zoneid|popunder|arwf\.org)/i.test(u.href));
							if (isAdRedirect) {
								const kind = targetOpensNewContext(this) ? 'popup' : 'redirect';
								recordBlocked(kind, 'anchor.click()', u ? u.href : hrefAttr);
								log('BLOCK', 'redirect', 'Neutralized anchor.click() (silent sinkhole):', u ? u.href : hrefAttr);
								try {
									this.setAttribute('data-nvirya-sinkhole', this.href || '');
									this.href = 'javascript:void(0)';
									this.removeAttribute('target');
								} catch (e) {}
								return;
							}
						}
					}
				} catch (e) { log('ERROR', 'anchor-click', e && e.message); }
				return originalClick.apply(this, arguments);
			};
			try { Object.defineProperty(guardedClick, '__nvirya', { value: true }); } catch (e) {}
			proto.click = guardedClick;
			try { Object.defineProperty(proto, '__nvirya_click', { value: true }); } catch (e) {}
		} catch (e) { log('WARN', 'anchor-click', 'HTMLAnchorElement.click hook unavailable', e && e.message); }
	}

	function isBlacklistedScriptHost(host) {
		if (!host) return false;
		const h = String(host).toLowerCase().replace(/\.$/, '');
		if (RE_AD_HOST.test(h) || isSuspiciousAdDomain(h) || isCustomBlockedHost(h)) return true;
		return /(?:^|\.)(?:googletagmanager\.com|wingsmob\.com|monetag\.com|propu\.com|propellerads\.com|adsterra\.com|exoclick\.com|highrevenueformat\.com|cloudiniry\.net|p7jeusk9n\.shop|484r\.com|bvtpk\.com|genaalkyls|bebangcaromel|casherscamize|nucleindinkly|kirpankinky|rushloiters|urosomeentrec|pucksdopes|ay267|bblaa|405kk|luugy|a-ads)(?:\.|$)/i.test(h);
	}

	function triggerFakeScriptLoad(el, spoofUrl) {
		if (!el) return;
		if (spoofUrl) {
			try { el.__nvirya_spoof_src = String(spoofUrl); } catch (e) {}
		}
		try { el.onerror = null; } catch (e) {}
		if (el.__nvirya_load_spoofed) return;
		try { el.__nvirya_load_spoofed = true; } catch (e) {}
		const dispatchLoad = () => {
			try {
				try { el.readyState = 'complete'; } catch (e) {}
				const evt = new Event('load', { bubbles: false, cancelable: false });
				if (typeof el.onload === 'function') el.onload.call(el, evt);
				if (typeof el.dispatchEvent === 'function') el.dispatchEvent(evt);
			} catch (e) {}
		};
		if (typeof queueMicrotask === 'function') {
			queueMicrotask(() => setTimeout(dispatchLoad, 0));
		} else {
			setTimeout(dispatchLoad, 0);
		}
	}

	function neutralizeScriptNode(node) {
		if (!node || node.nodeType !== 1 || String(node.tagName || '').toLowerCase() !== 'script') return false;
		if (!config.enabled || isDisabledHere() || isYouTubeDomain(hostname) || isFullSecurityChallengePage()) return false;
		const rawSrc = node.src || attr(node, 'src') || '';
		if (rawSrc && (/eruda|vconsole|chobitsu/i.test(rawSrc) || RE_SECURITY_CHALLENGE.test(rawSrc))) {
			if (RE_SECURITY_CHALLENGE.test(rawSrc)) W.__nvirya_has_security_challenge = true;
			return false;
		}
		const hasAdZone = !!(attr(node, 'data-zone') || (node.dataset && node.dataset.zone));
		if (rawSrc || hasAdZone) {
			const u = safeUrl(rawSrc);
			if (hasAdZone || (u && (isAdUrl(u) || isBlacklistedScriptHost(u.hostname)))) {
				if (u) recordNetworkRequest(u, 'script', true);
				try {
					node.type = 'javascript/blocked';
					node.removeAttribute('src');
					node.removeAttribute('data-zone');
					node.textContent = '';
					triggerFakeScriptLoad(node, rawSrc);
				} catch (e) {}
				stats.inc('requests');
				stats.inc('ads');
				log('BLOCK', 'script-kill', 'Killed pre-execution ad script:', u ? u.href : 'data-zone');
				return true;
			}
		} else {
			const codeText = node.textContent || '';
			if (codeText && /_cf_chl_opt|__cf\$cv\$params|challenge-platform|cf-turnstile/i.test(codeText)) {
				W.__nvirya_has_security_challenge = true;
				return false;
			}
			if (codeText && !/eruda|vconsole|chobitsu/i.test(codeText) && RE_INLINE_AD_SCRIPT.test(codeText)) {
				try {
					node.type = 'javascript/blocked';
					node.textContent = '';
					if (node.parentNode) node.parentNode.removeChild(node);
				} catch (e) {}
				stats.inc('ads');
				log('BLOCK', 'script-kill', 'Killed inline adware loader script');
				return true;
			}
		}
		return false;
	}

	function installPreExecutionScriptKiller() {
		if (isYouTubeDomain(hostname)) return;
		if (W.__nvirya_pre_script_killer) return;
		try { Object.defineProperty(W, '__nvirya_pre_script_killer', { value: true }); } catch (e) { W.__nvirya_pre_script_killer = true; }

		try {
			const elProto = W.Element && W.Element.prototype;
			if (elProto && typeof elProto.attachShadow === 'function' && !elProto.attachShadow.__nvirya_us) {
				const origAttach = elProto.attachShadow;
				const guardedAttach = function(init) {
					try {
						if (!isNviryaNode(this)) {
							const st = (new Error().stack) || '';
							if (RE_SECURITY_CHALLENGE.test(st) || isCaptchaOrTurnstileElement(this)) {
								try {
									this.setAttribute('data-nvirya-safe', 'captcha');
									W.__nvirya_has_security_challenge = true;
								} catch (e) {}
								return origAttach.apply(this, arguments);
							}
							if (config.enabled && !isDisabledHere() && !isSecurityVerificationPage() && isAdCallStack()) {
								log('BLOCK', 'shadow-ad', 'Blocked adware attachShadow via stack');
								try {
									this.style.setProperty('display', 'none', 'important');
									this.remove();
								} catch (e) {}
								const dummy = D.createElement('div');
								return origAttach.call(dummy, { mode: 'open' });
							}
						}
					} catch (e) {}
					return origAttach.apply(this, arguments);
				};
				try { Object.defineProperty(guardedAttach, '__nvirya_us', { value: true }); } catch (e) {}
				elProto.attachShadow = guardedAttach;
			}
		} catch (e) {}

		try {
			const scriptProto = W.HTMLScriptElement && W.HTMLScriptElement.prototype;
			if (scriptProto && !scriptProto.__nvirya_src_hooked) {
				const srcDesc = Object.getOwnPropertyDescriptor(scriptProto, 'src');
				if (srcDesc && srcDesc.set) {
					const origSrcSet = srcDesc.set;
					Object.defineProperty(scriptProto, 'src', {
						configurable: true,
						enumerable: srcDesc.enumerable,
						set: function(val) {
							const sVal = String(val || '');
							if (!/eruda|vconsole|chobitsu/i.test(sVal)) {
								const u = safeUrl(sVal);
								const hasZone = !!(attr(this, 'data-zone') || (this.dataset && this.dataset.zone));
								const shouldBlock = config.enabled && !isDisabledHere() && (hasZone || (u && (isAdUrl(u) || isBlacklistedScriptHost(u.hostname))));
								if (u) recordNetworkRequest(u, 'script', shouldBlock);
								if (shouldBlock) {
									this.type = 'javascript/blocked';
									triggerFakeScriptLoad(this, sVal);
									stats.inc('requests');
									stats.inc('ads');
									log('BLOCK', 'script-src', 'Blocked script.src setter (spoofed onload):', u ? u.href : sVal);
									return;
								}
							}
							return origSrcSet.call(this, val);
						},
						get: function() {
							if (this.__nvirya_spoof_src) return this.__nvirya_spoof_src;
							return srcDesc.get ? srcDesc.get.call(this) : '';
						}
					});
				}
				const origSetAttr = scriptProto.setAttribute;
				if (typeof origSetAttr === 'function') {
					scriptProto.setAttribute = function(name, val) {
						const n = String(name || '').toLowerCase();
						const sVal = String(val || '');
						if ((n === 'src' || n === 'data-zone') && config.enabled && !isDisabledHere() && !/eruda|vconsole|chobitsu/i.test(sVal)) {
							if (n === 'data-zone') {
								this.type = 'javascript/blocked';
								triggerFakeScriptLoad(this, sVal);
								return;
							}
							const u = safeUrl(sVal);
							if (u) {
								const shouldBlock = isAdUrl(u) || isBlacklistedScriptHost(u.hostname);
								recordNetworkRequest(u, 'script', shouldBlock);
								if (shouldBlock) {
									this.type = 'javascript/blocked';
									triggerFakeScriptLoad(this, sVal);
									stats.inc('requests');
									stats.inc('ads');
									log('BLOCK', 'script-src', 'Blocked script.setAttribute(src) (spoofed onload):', u.href);
									return;
								}
							}
						}
						return origSetAttr.apply(this, arguments);
					};
				}
				scriptProto.__nvirya_src_hooked = true;
			}
		} catch (e) {}

		try {
			if (W.navigator && W.navigator.serviceWorker && typeof W.navigator.serviceWorker.register === 'function' && !W.navigator.serviceWorker.register.__nvirya) {
				const origRegister = W.navigator.serviceWorker.register;
				const guardedRegister = function(scriptURL, options) {
					try {
						if (config.enabled && !isDisabledHere()) {
							const sUrl = String(scriptURL || '').trim();
							if (sUrl.startsWith('/') && !sUrl.startsWith('//')) {
								return origRegister.apply(this, arguments);
							}
							const u = safeUrl(sUrl);
							if (u && u.origin === location.origin) {
								return origRegister.apply(this, arguments);
							}
							if (u && isAdUrl(u)) {
								log('BLOCK', 'sw', 'Blocked external ad ServiceWorker registration:', sUrl);
								stats.inc('requests');
								return Promise.reject(new DOMException('Blocked by Nvirya AdGuard', 'SecurityError'));
							}
						}
					} catch (err) {}
					return origRegister.apply(this, arguments);
				};
				try { Object.defineProperty(guardedRegister, '__nvirya', { value: true }); } catch (e) {}
				W.navigator.serviceWorker.register = guardedRegister;
			}
		} catch (e) {}

		try {
			D.addEventListener('beforescriptexecute', function(e) {
				if (neutralizeScriptNode(e.target)) {
					e.preventDefault();
					e.stopPropagation();
				}
			}, true);
		} catch (e) {}

		try {
			const existing = D.querySelectorAll ? D.querySelectorAll('script') : [];
			for (let i = 0; i < existing.length; i++) neutralizeScriptNode(existing[i]);
		} catch (e) {}

		try {
			const nodeProto = W.Node && W.Node.prototype;
			if (nodeProto && !nodeProto.__nvirya_dom_hook) {
				const origAppend = nodeProto.appendChild;
				const origInsert = nodeProto.insertBefore;
				const shouldBlockNodeInsert = (child) => {
					if (!child || child.nodeType !== 1 || !config.enabled || isDisabledHere()) return false;
					if (isNviryaNode(child)) return false;
					const tag = String(child.tagName || '').toLowerCase();
					if (tag === 'script' && neutralizeScriptNode(child)) return true;
					if (isAdCallStack() && (tag === 'div' || tag === 'iframe' || tag === 'script' || tag === 'a' || tag === 'aside' || tag === 'section' || tag.includes('-'))) {
						log('BLOCK', 'dom-insert', 'Blocked adware DOM insertion via stack:', tag);
						stats.inc('ads');
						return true;
					}
					return false;
				};
				nodeProto.appendChild = function(child) {
					if (shouldBlockNodeInsert(child)) return child;
					return origAppend.apply(this, arguments);
				};
				nodeProto.insertBefore = function(child, ref) {
					if (shouldBlockNodeInsert(child)) return child;
					return origInsert.apply(this, arguments);
				};
				nodeProto.__nvirya_dom_hook = true;
			}
		} catch (e) {}
	}

	function isBaitElement(el) {
		if (!el || el.nodeType !== 1 || isNviryaNode(el)) return false;
		const id = el.id || '';
		const cls = classString(el);
		return RE_BAIT_ELEMENT.test(id + ' ' + cls);
	}

	function isBaitOrHiddenByNvirya(el, currentDim) {
		if (!el || el.nodeType !== 1 || !config.enabled || isDisabledHere()) return false;
		if (el.hasAttribute && el.hasAttribute('data-nvirya-hidden')) {
			return isBaitElement(el);
		}
		if (isBaitElement(el)) {
			if (currentDim === 0 || (state && state.hiddenNodes && state.hiddenNodes.has(el))) return true;
		}
		return false;
	}

	function installBaitDimensionSpoofing() {
		if (W.__nvirya_bait_spoof_installed) return;
		try { Object.defineProperty(W, '__nvirya_bait_spoof_installed', { value: true }); } catch (e) { W.__nvirya_bait_spoof_installed = true; }

		try {
			const htmlProto = W.HTMLElement && W.HTMLElement.prototype;
			if (htmlProto && !htmlProto.__nvirya_bait_dims) {
				const hookDimProp = (prop, fakeVal) => {
					const desc = Object.getOwnPropertyDescriptor(htmlProto, prop);
					if (!desc || typeof desc.get !== 'function') return;
					const origGet = desc.get;
					Object.defineProperty(htmlProto, prop, {
						configurable: true,
						enumerable: desc.enumerable,
						get: function() {
							const val = origGet.call(this);
							try {
								if (val === 0 && isBaitOrHiddenByNvirya(this, val)) {
									return fakeVal;
								}
							} catch (err) {}
							return val;
						}
					});
				};
				hookDimProp('offsetHeight', 250);
				hookDimProp('offsetWidth', 300);
				hookDimProp('clientHeight', 250);
				hookDimProp('clientWidth', 300);
				try { Object.defineProperty(htmlProto, '__nvirya_bait_dims', { value: true }); } catch (e) {}
			}
		} catch (e) {}

		try {
			if (typeof W.getComputedStyle === 'function' && !W.getComputedStyle.__nvirya_bait_style) {
				const origGetComputedStyle = W.getComputedStyle.bind(W);
				const patchedGetComputedStyle = function(el, pseudoElt) {
					const style = origGetComputedStyle(el, pseudoElt);
					try {
						if (
							!pseudoElt &&
							el &&
							el.nodeType === 1 &&
							config.enabled &&
							!isDisabledHere() &&
							((el.hasAttribute && el.hasAttribute('data-nvirya-hidden')) || isBaitElement(el))
						) {
							return new Proxy(style, {
								get(target, prop) {
									if (prop === 'display') return 'block';
									if (prop === 'visibility') return 'visible';
									if (prop === 'opacity') return '1';
									if (prop === 'getPropertyValue') {
										return function(name) {
											const n = String(name || '').toLowerCase().trim();
											if (n === 'display') return 'block';
											if (n === 'visibility') return 'visible';
											if (n === 'opacity') return '1';
											return target.getPropertyValue(name);
										};
									}
									const val = target[prop];
									return typeof val === 'function' ? val.bind(target) : val;
								}
							});
						}
					} catch (err) {}
					return style;
				};
				try { Object.defineProperty(patchedGetComputedStyle, '__nvirya_bait_style', { value: true }); } catch (e) {}
				W.getComputedStyle = patchedGetComputedStyle;
			}
		} catch (e) {}
	}

	function checkBypassSupport() {
		try {
			if (isAppleDevice()) {
				return typeof window.__NVIRYA_MAIN_SHIELD__ !== 'undefined';
			}
			return true;
		} catch (e) {
			return false;
		}
	}

	function installScriptElementGuard() {
		installPreExecutionScriptKiller();
		installBaitDimensionSpoofing();
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
			const formProto = W.HTMLFormElement && W.HTMLFormElement.prototype;
			if (formProto && !formProto.__nvirya_submit) {
				const origSubmit = formProto.submit;
				formProto.submit = function() {
					try {
						if (config.redirectProtection && !isDisabledHere()) {
							const action = this.action || attr(this, 'action') || '';
							const u = safeUrl(action);
							if (u && (isAdUrl(u) || shouldBlockRedirectUrl(u, true))) {
								recordBlocked('redirect', 'form.submit()', u.href);
								log('BLOCK', 'redirect', 'Blocked form.submit auto-redirect:', u.href);
								return;
							}
						}
					} catch (err) {}
					return origSubmit.apply(this, arguments);
				};
				try { Object.defineProperty(formProto, '__nvirya_submit', { value: true }); } catch (e) {}
			}
		} catch (e) {}

		try {
			const origDispatch = EventTarget.prototype.dispatchEvent;
			if (!EventTarget.prototype.__nvirya_dispatch) {
				EventTarget.prototype.dispatchEvent = function(event) {
					try {
						if (config.redirectProtection && !isDisabledHere() && event && /^(?:click|submit)$/i.test(event.type)) {
							const isSynthetic = !event.isTrusted || event.__synthetic || event.isTrusted === false;
							const target = this;
							if (target && target.nodeType === 1) {
								const tag = (target.tagName || '').toLowerCase();
								if (tag === 'a') {
									const hrefAttr = target.href || attr(target, 'href') || '';
									let u = safeUrl(hrefAttr);
									if (u) {
										const cleaned = stripTrackingParams(u);
										if (cleaned && cleaned.href && cleaned.href !== hrefAttr) {
											try { target.href = cleaned.href; } catch (e) {}
											u = cleaned;
										}
									}
									if (!isSearchEngineDomain()) {
										const isAdRedirect = u && (isAdUrl(u) || shouldBlockRedirectUrl(u, true) || /(?:invoke_layer|zoneid|popunder|arwf\.org)/i.test(u.href));
										if (isAdRedirect) {
											recordBlocked('redirect', 'synthetic.dispatchEvent(click)', u ? u.href : hrefAttr);
											log('BLOCK', 'redirect', 'Neutralized synthetic anchor click (silent sinkhole):', u ? u.href : hrefAttr);
											try {
												target.setAttribute('data-nvirya-sinkhole', target.href || '');
												target.href = 'javascript:void(0)';
												target.removeAttribute('target');
											} catch (e) {}
											if (isSynthetic) {
												try { if (typeof event.stopPropagation === 'function') event.stopPropagation(); } catch (e) {}
												try { if (typeof event.preventDefault === 'function') event.preventDefault(); } catch (e) {}
												return true;
											}
											return false;
										}
									}
								} else if (tag === 'form') {
									if (!isSearchEngineDomain()) {
										const actionAttr = target.action || attr(target, 'action') || '';
										const u = safeUrl(actionAttr);
										if (u && (isAdUrl(u) || shouldBlockRedirectUrl(u, true))) {
											recordBlocked('redirect', 'synthetic.dispatchEvent(submit)', u.href);
											log('BLOCK', 'redirect', 'Neutralized synthetic form submit:', u.href);
											try {
												target.action = 'javascript:void(0)';
												target.removeAttribute('target');
											} catch (e) {}
											if (isSynthetic) {
												try { if (typeof event.preventDefault === 'function') event.preventDefault(); } catch (e) {}
												return true;
											}
											return false;
										}
									}
								}
							}
						}
					} catch (err) {}
					return origDispatch.apply(this, arguments);
				};
				try { Object.defineProperty(EventTarget.prototype, '__nvirya_dispatch', { value: true }); } catch (e) {}
			}
		} catch (e) {}

		try {
			if (typeof W.navigation === 'object' && W.navigation && typeof W.navigation.addEventListener === 'function' && !W.navigation.__nvirya_guard) {
				W.navigation.addEventListener('navigate', function(event) {
					if (!config.redirectProtection || isDisabledHere()) return;
					try {
						const destUrl = event.destination ? event.destination.url : '';
						if (!destUrl) return;
						const u = safeUrl(destUrl);
						if (!u) return;
						const hasGesture = event.userInitiated || !!(W.navigator.userActivation && W.navigator.userActivation.isActive);
						const isAd = isAdUrl(u);
						const isCross = isUntrustedCrossSiteUrl(u);
						const early = isEarlyPageLoad(6000);

						if (isAd || (!hasGesture && early && isCross && !isTrustedPopupHost(u.hostname))) {
							if (event.canIntercept || typeof event.preventDefault === 'function') {
								event.preventDefault();
								recordBlocked('redirect', 'navigation.navigate', destUrl);
								log('BLOCK', 'redirect', 'Blocked auto navigation.navigate:', destUrl);
							}
						}
					} catch (err) {}
				});
				W.navigation.__nvirya_guard = true;
			}
		} catch (e) {}

		const RE_REDIRECT_PATH = /redirect|out|goto|jump|leave|link|external|away|exit/i;
		const RE_REDIRECT_WRAPPER_HOST = /(?:^|\.)(?:l\.facebook\.com|lm\.facebook\.com|l\.instagram\.com|t\.umblr\.com|away\.vk\.com|out\.reddit\.com|steamcommunity\.com)$/i;
		const REDIRECT_PARAM_KEYS = ['url', 'to', 'target', 'dest', 'destination', 'u', 'link', 'go', 'redirect', 'redirect_url', 'href'];

		function extractUnwrappedRedirectUrl(u) {
			if (!u || !u.searchParams) return null;
			if (!RE_REDIRECT_PATH.test(u.pathname) && !RE_REDIRECT_WRAPPER_HOST.test(u.hostname)) return null;
			for (let i = 0; i < REDIRECT_PARAM_KEYS.length; i++) {
				const raw = u.searchParams.get(REDIRECT_PARAM_KEYS[i]);
				if (!raw) continue;
				let candidate = raw.trim();
				try { candidate = decodeURIComponent(candidate); } catch (err) {}
				if (/^aHR0c/i.test(candidate)) {
					try {
						const b64 = candidate.replace(/-/g, '+').replace(/_/g, '/');
						candidate = atob(b64).trim();
						try { candidate = decodeURIComponent(candidate); } catch (e2) {}
					} catch (err) {}
				}
				if (!/^https?:\/\//i.test(candidate)) continue;
				let targetUrl = safeUrl(candidate);
				if (targetUrl && (targetUrl.protocol === 'http:' || targetUrl.protocol === 'https:') && !isAdUrl(targetUrl)) {
					targetUrl = stripTrackingParams(targetUrl);
					return targetUrl;
				}
			}
			return null;
		}

		try {
			D.addEventListener('click', function(e) {
				if (e.isTrusted) trackUserTarget(e.target);
				if (!config.redirectProtection || isDisabledHere()) return;
				const path = eventPath(e);
				if (isExtensionUiPath(path)) return;
				const isSearch = isSearchEngineDomain(hostname);
				if (isSearch && e.isTrusted) {
					for (let i = 0; i < Math.min(path.length, 8); i++) {
						const n = path[i];
						if (n && n.nodeType === 1 && (attr(n, 'jsaction') !== null || attr(n, 'data-ved') !== null || attr(n, 'jscontroller') !== null)) {
							const aNode = findAnchorInPath(path);
							const au = aNode ? safeUrl(aNode.href || attr(aNode, 'href')) : null;
							if (!au || !isAdUrl(au)) return;
						}
					}
				}
				const anchor = findAnchorInPath(path);
				if (!anchor) return;
				if (!isSearch && anchor.hasAttribute('ping')) {
					anchor.removeAttribute('ping');
				}
				let u = safeUrl(anchor.href || attr(anchor, 'href'));
				if (!u) return;
				if (e.isTrusted === true && !isSearch) {
					const targetUrl = extractUnwrappedRedirectUrl(u);
					if (targetUrl) {
						anchor.href = targetUrl.href;
						u = targetUrl;
						stats.inc('redirects');
						log('INFO', 'unwrap', 'Unwrapped redirect link to:', targetUrl.href);
						if (!isSuspiciousPlayerOverlayClick(e.target, path)) return;
					}
				}
				const adLink = isAdUrl(u);
				const crossRoot = isUntrustedCrossSiteUrl(u);
				const opensNew = targetOpensNewContext(anchor);
				const syntheticExternal = e.isTrusted === false && crossRoot;
				const hijack = !isSearch && crossRoot && isSuspiciousPlayerOverlayClick(e.target, path);
				const blockedNewContext = opensNew && !isAllowedPopupDestination(u) && (!isSearch || e.isTrusted === false);

				if (adLink || blockedNewContext || syntheticExternal || hijack) {
					const kind = opensNew ? 'popup' : 'redirect';
					const reason = adLink ? 'ad-anchor-click' :
						blockedNewContext ? 'untrusted-target-blank' :
						syntheticExternal ? 'synthetic-cross-site-click' :
						'player-overlay-cross-site-click';
					blockNavigationEvent(e, kind, reason, u.href);
				}
			}, true);
		} catch (e) { log('WARN', 'redirect', 'capture click hook unavailable', e && e.message); }

		try {
			const LocProto = W.Location && W.Location.prototype;
			if (LocProto) {
				const hrefDesc = Object.getOwnPropertyDescriptor(LocProto, 'href');
				if (hrefDesc && hrefDesc.configurable && typeof hrefDesc.set === 'function') {
					const originalSet = hrefDesc.set;
					try {
						Object.defineProperty(LocProto, 'href', {
							configurable: true,
							enumerable: hrefDesc.enumerable,
							get: hrefDesc.get,
							set: function(value) {
								try {
									const base = this.href || location.href;
									let u = new URL(String(value), base);
									const origHref = u ? u.href : '';
									const cleaned = stripTrackingParams(u);
									if (cleaned && cleaned.href && cleaned.href !== origHref) {
										u = cleaned;
										value = cleaned.href;
									}
									if (config.redirectProtection && !isDisabledHere() && !isSearchEngineDomain() && shouldBlockRedirectUrl(u)) {
										recordBlocked('redirect', 'location.href', u.href);
										return;
									}
								} catch (e) { log('ERROR', 'redirect', 'href parse', e && e.message); }
								return originalSet.call(this, value);
							}
						});
					} catch (e) { log('WARN', 'redirect', 'Location.href setter is not patchable'); }
				}

				['assign', 'replace'].forEach(prop => {
					const desc = Object.getOwnPropertyDescriptor(LocProto, prop);
					if (desc && !desc.configurable) return;
					const orig = LocProto[prop];
					if (typeof orig !== 'function') return;
					try {
						Object.defineProperty(LocProto, prop, {
							configurable: true,
							writable: true,
							enumerable: desc ? desc.enumerable : false,
							value: function(value) {
								try {
									const base = this.href || location.href;
									let u = new URL(String(value), base);
									const origHref = u ? u.href : '';
									const cleaned = stripTrackingParams(u);
									if (cleaned && cleaned.href && cleaned.href !== origHref) {
										u = cleaned;
										value = cleaned.href;
									}
									if (config.redirectProtection && !isDisabledHere() && !isSearchEngineDomain() && shouldBlockRedirectUrl(u)) {
										recordBlocked('redirect', 'location.' + prop, u.href);
										return;
									}
								} catch (e) { log('ERROR', 'redirect', prop + ' parse', e && e.message); }
								return orig.call(this, value);
							}
						});
					} catch (e) { log('WARN', 'redirect', 'Location.' + prop + ' is not patchable'); }
				});
			}
		} catch (e) { log('WARN', 'redirect', 'Location prototype unavailable', e && e.message); }

		try {
			const winLoc = Object.getOwnPropertyDescriptor(W, 'location');
			if (winLoc && winLoc.configurable && typeof winLoc.set === 'function') {
				const originalWindowLocationSet = winLoc.set;
				Object.defineProperty(W, 'location', {
					configurable: true,
					enumerable: winLoc.enumerable,
					get: winLoc.get,
					set: function(value) {
						try {
							let u = new URL(String(value), location.href);
							const origHref = u ? u.href : '';
							const cleaned = stripTrackingParams(u);
							if (cleaned && cleaned.href && cleaned.href !== origHref) {
								u = cleaned;
								value = cleaned.href;
							}
							if (config.redirectProtection && !isDisabledHere() && !isSearchEngineDomain() && shouldBlockRedirectUrl(u)) {
								recordBlocked('redirect', 'window.location', u.href);
								return;
							}
						} catch (e) {}
						return originalWindowLocationSet.call(this, value);
					}
				});
			}
		} catch (e) { log('WARN', 'redirect', 'window.location descriptor unavailable'); }
	}

	function extractAcceptHeader(input, init, customAccept) {
		try {
			if (customAccept) return String(customAccept);
			const readHdr = (hdrs) => {
				if (!hdrs) return '';
				if (typeof hdrs.get === 'function') return String(hdrs.get('accept') || hdrs.get('Accept') || '');
				if (Array.isArray(hdrs)) {
					for (let i = 0; i < hdrs.length; i++) {
						if (hdrs[i] && String(hdrs[i][0] || '').toLowerCase() === 'accept') return String(hdrs[i][1] || '');
					}
					return '';
				}
				if (typeof hdrs === 'object') {
					for (const k in hdrs) {
						if (k.toLowerCase() === 'accept') return String(hdrs[k] || '');
					}
				}
				return '';
			};
			return readHdr(init && init.headers) || readHdr(input && typeof input === 'object' && input.headers) || '';
		} catch (e) {
			return '';
		}
	}

	function detectMockResponseKind(urlStr, input, init, customAccept) {
		const u = String(urlStr || '');
		const accept = extractAcceptHeader(input, init, customAccept);
		if (/application\/json|\+json/i.test(accept) || /\.json(?:$|[?#])|[?&](?:format|output|alt)=json\b/i.test(u)) {
			return 'json';
		}
		if (
			/javascript|ecmascript/i.test(accept) ||
			/\.(?:m?js)(?:$|[?#])|\/(?:adsbygoogle|show_ads|gpt|pubads|pagead\/js|adserver)/i.test(u)
		) {
			return 'js';
		}
		return 'text';
	}

	function createFakeFetchResponse(urlStr, input, init) {
		const kind = detectMockResponseKind(urlStr, input, init, '');
		const jsonPayload = { status: 'ok', success: true, data: [] };
		const body = kind === 'json' ?
			JSON.stringify(jsonPayload) :
			(kind === 'js' ? '/* Nvirya Stub OK */ window.canRunAds = true;' : '');
		const contentType = kind === 'json' ?
			'application/json' :
			(kind === 'js' ? 'application/javascript' : 'text/plain');
		try {
			if (typeof Response === 'function') {
				return new Response(body, {
					status: 200,
					statusText: 'OK',
					headers: { 'Content-Type': contentType }
				});
			}
		} catch (e) {}
		return {
			ok: true,
			status: 200,
			statusText: 'OK',
			url: String(urlStr || ''),
			text: () => Promise.resolve(body),
			json: () => Promise.resolve(jsonPayload),
			blob: () => Promise.resolve(typeof Blob === 'function' ? new Blob([body], { type: contentType }) : null),
			arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
			clone: function() { return this; }
		};
	}

	function cleanYoutubeJSON(jsonObj) {
		if (!jsonObj || typeof jsonObj !== 'object') return { altered: false, jsonObj };
		let altered = false;
		const stripKeys = (target) => {
			if (!target || typeof target !== 'object') return;
			if (Array.isArray(target.adPlacements) && target.adPlacements.length > 0) {
				target.adPlacements = [];
				altered = true;
			}
			if (Array.isArray(target.playerAds) && target.playerAds.length > 0) {
				target.playerAds = [];
				altered = true;
			}
			if (Array.isArray(target.adSlots) && target.adSlots.length > 0) {
				target.adSlots = [];
				altered = true;
			}
			if ('adBreakHeartbeatParams' in target) {
				delete target.adBreakHeartbeatParams;
				altered = true;
			}
			if ('adBreakRenderer' in target) {
				delete target.adBreakRenderer;
				altered = true;
			}
		};
		stripKeys(jsonObj);
		if (jsonObj.playerResponse && typeof jsonObj.playerResponse === 'object') {
			stripKeys(jsonObj.playerResponse);
		}
		if (Array.isArray(jsonObj.onResponseReceivedEndpoints)) {
			for (let i = 0; i < jsonObj.onResponseReceivedEndpoints.length; i++) {
				const ep = jsonObj.onResponseReceivedEndpoints[i];
				if (ep && typeof ep === 'object') stripKeys(ep);
			}
		}
		return { altered, jsonObj };
	}

	function installYouTubeJsonPruner() {
		if (!isYouTubeDomain(hostname) || W.__nvirya_yt_pruner_installed) return;
		try { Object.defineProperty(W, '__nvirya_yt_pruner_installed', { value: true }); } catch (e) { W.__nvirya_yt_pruner_installed = true; }

		const YT_PLAYER_RE = /youtubei\/v1\/(?:player|watch|next)(?:[/?#]|$)/i;
		const YT_AD_KEYS_RE = /"(?:adPlacements|playerAds|adSlots|adBreakHeartbeatParams|adBreakRenderer)"/;

		try {
			let _ytInitialPlayerResponse = W.ytInitialPlayerResponse;
			if (_ytInitialPlayerResponse && typeof _ytInitialPlayerResponse === 'object') {
				if (cleanYoutubeJSON(_ytInitialPlayerResponse).altered) stats.inc('ads');
			}
			Object.defineProperty(W, 'ytInitialPlayerResponse', {
				configurable: true,
				get: () => _ytInitialPlayerResponse,
				set: (value) => {
					if (value && typeof value === 'object' && config.enabled && !isDisabledHere()) {
						const res = cleanYoutubeJSON(value);
						if (res.altered) stats.inc('ads');
						_ytInitialPlayerResponse = res.jsonObj;
					} else {
						_ytInitialPlayerResponse = value;
					}
				}
			});
		} catch (e) {}

		try {
			const rProto = W.Response && W.Response.prototype;
			if (rProto && !rProto.__nvirya_yt_resp) {
				const origJson = rProto.json;
				const origText = rProto.text;
				if (typeof origJson === 'function') {
					rProto.json = function() {
						const p = origJson.call(this);
						if ((!this.__nvirya_yt_target && !YT_PLAYER_RE.test(this.url || '')) || !config.enabled || isDisabledHere()) return p;
						return p.then((d) => {
							try {
								if (cleanYoutubeJSON(d).altered) stats.inc('ads');
							} catch (e) {}
							return d;
						});
					};
				}
				if (typeof origText === 'function') {
					rProto.text = function() {
						const p = origText.call(this);
						if ((!this.__nvirya_yt_target && !YT_PLAYER_RE.test(this.url || '')) || !config.enabled || isDisabledHere()) return p;
						return p.then((tStr) => {
							if (typeof tStr !== 'string' || !YT_AD_KEYS_RE.test(tStr)) return tStr;
							try {
								const o = JSON.parse(tStr);
								const res = cleanYoutubeJSON(o);
								if (res.altered) {
									stats.inc('ads');
									return JSON.stringify(res.jsonObj);
								}
							} catch (e) {}
							return tStr;
						});
					};
				}
				try { Object.defineProperty(rProto, '__nvirya_yt_resp', { value: true }); } catch (e) {}
			}
		} catch (e) {}

		try {
			const XHRProto = W.XMLHttpRequest && W.XMLHttpRequest.prototype;
			if (XHRProto && !XHRProto.__nvirya_yt_xhr_proto) {
				const origOpen = XHRProto.open;
				const origRespTextDesc = Object.getOwnPropertyDescriptor(XHRProto, 'responseText');
				const origRespDesc = Object.getOwnPropertyDescriptor(XHRProto, 'response');

				XHRProto.open = function(method, url) {
					this.__nvirya_yt_url = typeof url === 'string' ? url : String(url || '');
					this.__nvirya_yt_cache = null;
					return origOpen.apply(this, arguments);
				};

				const pruneRawText = (xhr, rawText) => {
					if (
						typeof rawText !== 'string' ||
						!xhr.__nvirya_yt_url ||
						!config.enabled ||
						isDisabledHere() ||
						!YT_PLAYER_RE.test(xhr.__nvirya_yt_url) ||
						!YT_AD_KEYS_RE.test(rawText)
					) {
						return rawText;
					}
					if (xhr.__nvirya_yt_cache && xhr.__nvirya_yt_cache.raw === rawText) {
						return xhr.__nvirya_yt_cache.out;
					}
					try {
						const obj = JSON.parse(rawText);
						const result = cleanYoutubeJSON(obj);
						const out = result.altered ? JSON.stringify(result.jsonObj) : rawText;
						if (result.altered) stats.inc('ads');
						xhr.__nvirya_yt_cache = { raw: rawText, out };
						return out;
					} catch (e) {
						return rawText;
					}
				};

				if (origRespTextDesc && typeof origRespTextDesc.get === 'function') {
					Object.defineProperty(XHRProto, 'responseText', {
						configurable: true,
						enumerable: origRespTextDesc.enumerable,
						get: function() {
							if (this.__nvirya_blocked || this.__nvirya_yt_ad_blocked) return '{}';
							const raw = origRespTextDesc.get.call(this);
							if (this.responseType && this.responseType !== '' && this.responseType !== 'text') return raw;
							return pruneRawText(this, raw);
						}
					});
				}

				if (origRespDesc && typeof origRespDesc.get === 'function') {
					Object.defineProperty(XHRProto, 'response', {
						configurable: true,
						enumerable: origRespDesc.enumerable,
						get: function() {
							if (this.__nvirya_blocked || this.__nvirya_yt_ad_blocked) return this.responseType === 'json' ? {} : '{}';
							const res = origRespDesc.get.call(this);
							if (!this.__nvirya_yt_url || !YT_PLAYER_RE.test(this.__nvirya_yt_url)) return res;
							if (typeof res === 'string') return pruneRawText(this, res);
							if (res && typeof res === 'object' && this.responseType === 'json' && config.enabled && !isDisabledHere()) {
								try {
									if (cleanYoutubeJSON(res).altered) stats.inc('ads');
								} catch (e) {}
							}
							return res;
						}
					});
				}

				try { Object.defineProperty(XHRProto, '__nvirya_yt_xhr_proto', { value: true }); } catch (e) {}
			}
		} catch (e) {}
	}

	function installNetworkGuard() {
		if (isYouTubeDomain(hostname)) {
			installYouTubeJsonPruner();
		}

		try {
			const imgProto = W.HTMLImageElement && W.HTMLImageElement.prototype;
			if (imgProto && !imgProto.__nvirya_img_proto_hooked) {
				const spoofImg = (imgEl, urlStr) => {
					if (!imgEl) return;
					try {
						imgEl.__nvirya_spoof_img = true;
						imgEl.__nvirya_spoof_src = String(urlStr || '');
						imgEl.onerror = null;
						['width', 'height', 'naturalWidth', 'naturalHeight'].forEach((p) => {
							try { Object.defineProperty(imgEl, p, { configurable: true, get: () => 32 }); } catch (e) {}
						});
						try { Object.defineProperty(imgEl, 'complete', { configurable: true, get: () => true }); } catch (e) {}
					} catch (e) {}
					if (!imgEl.__nvirya_img_scheduled) {
						try { imgEl.__nvirya_img_scheduled = true; } catch (e) {}
						setTimeout(() => {
							try {
								const evt = new Event('load');
								if (typeof imgEl.onload === 'function') imgEl.onload(evt);
								if (typeof imgEl.dispatchEvent === 'function') imgEl.dispatchEvent(evt);
							} catch (e) {}
						}, 5);
					}
				};
				const origSrcDesc = Object.getOwnPropertyDescriptor(imgProto, 'src');
				['width', 'height', 'naturalWidth', 'naturalHeight'].forEach((dimProp) => {
					const dDesc = Object.getOwnPropertyDescriptor(imgProto, dimProp);
					if (dDesc && typeof dDesc.get === 'function') {
						const origDimGet = dDesc.get;
						Object.defineProperty(imgProto, dimProp, {
							configurable: true,
							enumerable: dDesc.enumerable,
							get: function() {
								if (this.__nvirya_spoof_img) return 32;
								return origDimGet.call(this);
							},
							set: dDesc.set
						});
					}
				});
				if (origSrcDesc && origSrcDesc.set) {
					const origSet = origSrcDesc.set;
					const origGet = origSrcDesc.get;
					Object.defineProperty(imgProto, 'src', {
						configurable: true,
						enumerable: origSrcDesc.enumerable,
						set: function(val) {
							try {
								const sVal = String(val || '');
								if (sVal && !sVal.startsWith('data:') && !isYouTubeWhitelistedRequest(sVal) && config.enabled && !isDisabledHere()) {
									const u = safeUrl(sVal);
									if (u && isAdUrl(u)) {
										recordNetworkRequest(u, 'img', true);
										stats.inc('requests');
										spoofImg(this, u.href);
										return;
									}
								}
							} catch (e) {}
							return origSet.call(this, val);
						},
						get: function() {
							if (this.__nvirya_spoof_src) return this.__nvirya_spoof_src;
							return origGet ? origGet.call(this) : '';
						}
					});
				}
				try { Object.defineProperty(imgProto, '__nvirya_img_proto_hooked', { value: true }); } catch (e) {}
			}
		} catch (e) {}

		try {
			if (typeof W.fetch === 'function' && !W.fetch.__nvirya) {
				const origFetch = W.fetch;
				const patched = function(input, init) {
					const url = typeof input === 'string' ? input : (input && input.url) || '';
					try {
						if (RE_TRANSLATOR_WHITELIST.test(url) || isTranslatorWhitelistedRequest(url)) {
							return origFetch.apply(this, arguments);
						}
						if (isYouTubeWhitelistedRequest(url)) {
							const p = origFetch.apply(this, arguments);
							if (isYouTubeDomain(hostname) && /youtubei\/v1\/(?:player|watch|next)/i.test(url)) {
								return p.then((resp) => { try { if (resp) resp.__nvirya_yt_target = true; } catch (e) {} return resp; });
							}
							return p;
						}
						const u = safeUrl(url);
						if (u) {
							if (RE_TRANSLATOR_WHITELIST.test(u.href) || isTranslatorWhitelistedRequest(u)) {
								return origFetch.apply(this, arguments);
							}
							if (isYouTubeWhitelistedRequest(u)) {
								const p = origFetch.apply(this, arguments);
								if (isYouTubeDomain(hostname) && /youtubei\/v1\/(?:player|watch|next)/i.test(u.href)) {
									return p.then((resp) => { try { if (resp) resp.__nvirya_yt_target = true; } catch (e) {} return resp; });
								}
								return p;
							}
							const active = config.enabled && !isDisabledHere();
							const shouldBlock = active && (isAdUrl(u) || (config.strictMode && RE_TRACKER.test(u.hostname)));
							recordNetworkRequest(u, 'fetch', shouldBlock);
							if (shouldBlock) {
								stats.inc('requests');
								log('BLOCK', 'network', 'fetch (smart spoofed 200 OK)', u.href);
								return Promise.resolve(createFakeFetchResponse(u.href, input, init));
							}
						}
					} catch (e) { log('ERROR', 'fetch', e && e.message); }
					return origFetch.apply(this, arguments).catch((err) => {
						if (url && !RE_TRANSLATOR_WHITELIST.test(url) && !isTranslatorWhitelistedRequest(url) && !isYouTubeWhitelistedRequest(url) && /(?:doubleclick|googlesyndication|googleadservices|pagead|adservice|adserver|outbrain|taboola|criteo|ads\.|favicon\.ico\?\d+$)/i.test(url)) {
							return createFakeFetchResponse(url, input, init);
						}
						throw err;
					});
				};
				try { Object.defineProperty(patched, '__nvirya', { value: true }); } catch (e) {}
				W.fetch = patched;
			}
		} catch (e) {}

		try {
			const XHR = W.XMLHttpRequest;
			if (XHR && XHR.prototype && !XHR.prototype.__nvirya_open) {
				const origOpen = XHR.prototype.open;
				const origSetRequestHeader = XHR.prototype.setRequestHeader;
				if (typeof origSetRequestHeader === 'function') {
					XHR.prototype.setRequestHeader = function(header, value) {
						try {
							if (String(header || '').toLowerCase() === 'accept') {
								this.__nvirya_accept = String(value || '');
							}
						} catch (e) {}
						if (this.__nvirya_blocked) return;
						return origSetRequestHeader.apply(this, arguments);
					};
				}
				XHR.prototype.open = function(method, url) {
					this.__nvirya_blocked = false;
					this.__nvirya_url = '';
					this.__nvirya_accept = '';
					try {
						const urlStr = String(url || '');
						if (!RE_TRANSLATOR_WHITELIST.test(urlStr) && !isTranslatorWhitelistedRequest(urlStr) && !isYouTubeWhitelistedRequest(urlStr)) {
							const u = safeUrl(urlStr);
							if (u && !RE_TRANSLATOR_WHITELIST.test(u.href) && !isTranslatorWhitelistedRequest(u) && !isYouTubeWhitelistedRequest(u)) {
								this.__nvirya_url = u.href;
								const active = config.enabled && !isDisabledHere();
								const shouldBlock = active && (isAdUrl(u) || (config.strictMode && RE_TRACKER.test(u.hostname)));
								recordNetworkRequest(u, 'xhr', shouldBlock);
								if (shouldBlock) {
									stats.inc('requests');
									log('BLOCK', 'network', 'xhr (smart spoofed 200 OK)', u.href);
									this.__nvirya_blocked = true;
								}
							}
						}
					} catch (e) { log('ERROR', 'xhr', e && e.message); }
					if (this.__nvirya_blocked) {
						try { return origOpen.call(this, method || 'GET', 'data:text/plain,'); } catch (e) { return; }
					}
					return origOpen.apply(this, arguments);
				};
				try { Object.defineProperty(XHR.prototype, '__nvirya_open', { value: true }); } catch (e) {}
				const origSend = XHR.prototype.send;
				XHR.prototype.send = function() {
					if (this.__nvirya_blocked) {
						const xhr = this;
						const kind = (xhr.responseType === 'json') ?
							'json' :
							detectMockResponseKind(xhr.__nvirya_url || '', null, null, xhr.__nvirya_accept || '');
						const jsonObj = { status: 'ok', success: true, data: [] };
						const bodyText = kind === 'json' ?
							JSON.stringify(jsonObj) :
							(kind === 'js' ? '/* Nvirya Stub OK */ window.canRunAds = true;' : '');
						const respVal = xhr.responseType === 'json' ? jsonObj : bodyText;
						try {
							Object.defineProperty(xhr, 'readyState', { configurable: true, get: () => 4 });
							Object.defineProperty(xhr, 'status', { configurable: true, get: () => 200 });
							Object.defineProperty(xhr, 'statusText', { configurable: true, get: () => 'OK' });
							Object.defineProperty(xhr, 'responseText', { configurable: true, get: () => bodyText });
							Object.defineProperty(xhr, 'response', { configurable: true, get: () => respVal });
						} catch (e) {}
						setTimeout(() => {
							try {
								if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange(new Event('readystatechange'));
								xhr.dispatchEvent(new Event('readystatechange'));
								if (typeof xhr.onload === 'function') xhr.onload(new Event('load'));
								xhr.dispatchEvent(new Event('load'));
								if (typeof xhr.onloadend === 'function') xhr.onloadend(new Event('loadend'));
								xhr.dispatchEvent(new Event('loadend'));
							} catch (err) {}
						}, 1);
						return;
					}
					return origSend.apply(this, arguments);
				};
			}
		} catch (e) {}

		try {
			if (typeof W.navigator.sendBeacon === 'function' && !W.navigator.sendBeacon.__nvirya) {
				const orig = W.navigator.sendBeacon;
				const patched = function(url, data) {
					try {
						const u = safeUrl(url);
						if (u && !RE_TRANSLATOR_WHITELIST.test(u.href) && !isTranslatorWhitelistedRequest(u) && !isYouTubeDomain(hostname) && !isYouTubeWhitelistedRequest(u)) {
							const active = config.enabled && !isDisabledHere();
							const shouldBlock = active && (isAdUrl(u) || (config.strictMode && RE_TRACKER.test(u.hostname)));
							recordNetworkRequest(u, 'beacon', shouldBlock);
							if (shouldBlock) {
								stats.inc('requests');
								log('BLOCK', 'beacon', u.href);
								return true;
							}
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
		'img', 'iframe', 'a', 'div', 'section', 'dialog', 'aside', 'ins', 'embed', 'object', 'script', 'span',
		'picture', 'source', 'figure'
	]);
	const NEVER_REMOVE_TAGS = new Set([
		'html', 'head', 'body', 'main', 'video', 'audio', 'form', 'input', 'button', 'nav', 'header', 'footer', 'script'
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

	const RE_NEWS_ARTICLE_CONTEXT = /also[-_]?read|related|thumb|article|news|story|entry/i;

	function isNewsThumbnailContext(el) {
		let cur = el;
		let depth = 0;
		while (cur && cur.nodeType === 1 && depth < 6) {
			const tag = String(cur.tagName || '').toLowerCase();
			if (tag === 'article') return true;
			const idc = ((cur.id || '') + ' ' + classString(cur)).trim();
			if (idc && RE_NEWS_ARTICLE_CONTEXT.test(idc)) return true;
			cur = cur.parentElement;
			depth++;
		}
		return false;
	}

	function isMatchingAdBannerSize(el) {
		if (!el || el.nodeType !== 1) return false;
		if (isNewsThumbnailContext(el)) return false;

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
		if (isProtectedPlayer(el) || isLegitimateMediaPreview(el) || isCaptchaOrTurnstileElement(el)) return { action: 'ignore' };

		if (el.__nvirya_spoof_img) return { action: 'ignore' };
		const isGooglePage = isGoogleCoreHost(hostname);
		if (tag === 'img' || tag === 'picture' || tag === 'source') {
			if (isGooglePage) return { action: 'ignore' };
			const mediaSrc = attr(el, 'src') || attr(el, 'data-src') || attr(el, 'srcset') || '';
			if (mediaSrc && /(?:gstatic\.com|googleusercontent\.com|google\.[a-z.]+)/i.test(mediaSrc)) {
				return { action: 'ignore' };
			}
		}
		if (isGooglePage && (attr(el, 'data-ved') !== null || attr(el, 'jsaction') !== null || attr(el, 'jscontroller') !== null || attr(el, 'jsname') !== null)) {
			return { action: 'ignore' };
		}

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
		const rawSrc = attr(el, 'src') || '';
		const lazySrc = attr(el, 'data-src') || attr(el, 'data-original') || attr(el, 'data-lazy-src') || attr(el, 'data-src-retina') || '';
		const src = rawSrc || lazySrc;
		const href = attr(el, 'href') || '';
		const style = attr(el, 'style') || '';

		if (src && !src.startsWith('data:')) {
			const u = safeUrl(src);
			if (u && isAdUrl(u)) return { action: 'remove', reason: 'ad-url' };
		}
		if (href) {
			const u = safeUrl(href);
			if (u && isAdUrl(u)) return { action: 'remove', reason: 'ad-href' };
		}
		if (tag === 'iframe') {
			const sb = attr(el, 'sandbox') || '';
			const hasEscape = /allow-popups-to-escape-sandbox|allow-top-navigation(?:-to-custom-protocols)?/i.test(sb);
			const hasSameOrigin = /allow-same-origin/i.test(sb);
			if (hasEscape && !hasSameOrigin) return { action: 'remove', reason: 'sandbox-escape' };
		}

		if (tag === 'img') {
			if (lazySrc) {
				const realUrl = safeUrl(lazySrc);
				if (realUrl) {
					if (isAdUrl(realUrl)) return { action: 'remove', reason: 'ad-lazy-src' };
					return { action: 'ignore' };
				}
			}

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

			let anchor = el.parentElement;
			let depth = 0;
			while (anchor && anchor.nodeType === 1 && depth < 4) {
				if (anchor.tagName && anchor.tagName.toLowerCase() === 'a') break;
				anchor = anchor.parentElement;
				depth++;
			}
			if (anchor && anchor.tagName && anchor.tagName.toLowerCase() === 'a') {
				const aHref = anchor.href || attr(anchor, 'href') || '';
				const u = safeUrl(aHref);
				if (u) {
					if (sameRootDomain(u.hostname, hostname) && !isAdUrl(u)) {
						return { action: 'ignore' };
					}
					if (rawSrc && rawSrc.startsWith('data:image/') && !sameRootDomain(u.hostname, hostname)) {
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

			if (isNewsThumbnailContext(el)) {
				return { action: 'ignore' };
			}
		}

		if ((tag === 'div' || tag === 'section' || tag === 'aside' || tag === 'figure' || tag === 'a' || tag === 'ins') && isResponsiveAdContainer(el)) {
			return { action: 'remove', reason: 'responsive-ad-container' };
		}

		let signals = 0;
		let reason = '';
		if (idc && RE_AD_TOKEN.test(idc)) {
			signals++;
			reason = reason || 'ad-token';
		}
		if (RE_SIZING.test(src) || RE_SIZING.test(idc) || RE_SIZING.test(style)) {
			signals++;
			reason = reason || 'ad-sizing';
		}

		if (tag === 'img') {
			const w = el.naturalWidth || el.width || 0;
			const h = el.naturalHeight || el.height || 0;
			if (w === 1 && h === 1) {
				signals++;
				reason = reason || 'tracking-pixel';
			}
		}

		if (signals >= 2) return { action: 'remove', reason };
		if (signals === 1 && !config.strictMode && tag === 'iframe') return { action: 'hide', reason };
		if (signals >= 1 && config.strictMode) return { action: 'hide', reason };
		return { action: 'ignore' };
	}

	function isSuspiciousOverlay(el) {
		return isInvisibleTrap(el);
	}

	const RE_DEVTOOLS_NODE = /(?:^|[\s_-])(?:eruda|eruda-[a-z0-9_-]+|__chobitsu-hide__|vconsole|vc-[a-z0-9_-]+)(?:$|[\s_-])/i;

	function hasNviryaAncestor(el) {
		if (!el) return false;
		let cur = el,
			depth = 0;
		while (cur && depth < 20) {
			if (cur.nodeType === 1) {
				if (attr(cur, 'data-nvirya-ui') !== null || attr(cur, 'data-nvirya-picker') !== null) return true;
				const idc = ((cur.id || '') + ' ' + classString(cur)).trim();
				if (idc && RE_DEVTOOLS_NODE.test(idc)) return true;
			}
			if (cur.host && cur.host.nodeType === 1) {
				cur = cur.host;
			} else {
				cur = cur.parentElement || cur.parentNode;
			}
			depth++;
		}
		return false;
	}

	function isNviryaNode(el) {
		if (!el || el.nodeType !== 1) return false;
		const tag = String(el.tagName || '').toLowerCase();
		if (tag === 'html' || tag === 'body' || tag === 'head') return false;
		if (hasNviryaAncestor(el)) return true;
		try {
			const rootNode = el.getRootNode && el.getRootNode();
			if (rootNode && rootNode.host && attr(rootNode.host, 'data-nvirya-ui') !== null) return true;
		} catch (e) {}
		try {
			return !!(el.querySelector && el.querySelector('[data-nvirya-ui],[data-nvirya-picker]'));
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
		const tag = String(el.tagName || '').toLowerCase();
		if (tag === 'iframe') return false;

		const safeTags = /^(?:nav|header|footer|main|dialog|video|audio|canvas|svg|form|input|select|textarea|button)$/i;
		let cur = el,
			depth = 0;
		while (cur && cur.nodeType === 1 && depth++ < 10) {
			const curTag = String(cur.tagName || '').toLowerCase();
			if ((cur === el || !/^(?:html|body)$/i.test(curTag)) && safeTags.test(curTag)) return true;
			if (attr(cur, 'data-nvirya-safe') !== null || attr(cur, 'data-nvirya-ui') !== null ||
				attr(cur, 'data-nvirya-picker') !== null) return true;
			const role = (attr(cur, 'role') || '').toLowerCase();
			if (/^(?:dialog|alertdialog|menu|menubar|navigation|button|link|listbox|combobox|search)$/.test(role)) {
				if (!isAdEvidence(cur)) return true;
			}
			if (isGoogleCoreHost(hostname) && (attr(cur, 'jsaction') !== null || attr(cur, 'jscontroller') !== null || attr(cur, 'jsname') !== null || attr(cur, 'data-ved') !== null)) return true;
			const mark = ((cur.id || '') + ' ' + classString(cur)).toLowerCase();
			if (/(?:^|[\s_-])(?:navbar|navigation|nav-menu|drawer|sidebar|menu|cookie-consent|login|signin|auth)(?:$|[\s_-])/.test(mark)) return true;
			cur = cur.parentElement;
		}
		return false;
	}

	function isAdEvidence(el) {
		if (!el || el.nodeType !== 1) return false;
		const mark = ((el.id || '') + ' ' + classString(el)).trim();
		if (RE_AD_TOKEN.test(mark)) return true;
		const src = attr(el, 'src') || attr(el, 'data-src') || '';
		if (src && isAdUrl(safeUrl(src))) return true;
		const href = attr(el, 'href') || '';
		if (href && isAdUrl(safeUrl(href))) return true;
		return false;
	}

	const RE_SAFE_TEXT_TAGS = /^(?:p|span|h1|h2|h3|h4|h5|h6|li|td|tr|b|strong|i|em|code|pre|small|sub|sup)$/i;
	const SAFE_CONTENT_CONTAINER_SELECTOR = 'article, main, #content, .mw-parser-output, .entry-content, .post-content, #wiki-content';
	const HIGH_RISK_TRAP_SELECTOR = 'iframe, div[style*="fixed" i], div[style*="absolute" i], div[style*="z-index" i], a[target="_blank" i]';

	function isHighRiskTrapElement(el, tag) {
		if (!el || el.nodeType !== 1) return false;
		const t = tag || String(el.tagName || '').toLowerCase();
		if (t === 'iframe') return true;
		if (t === 'a') {
			return String(attr(el, 'target') || '').trim().toLowerCase() === '_blank';
		}
		if (t === 'div' || t === 'section' || t === 'aside' || t === 'ins') {
			const styleAttr = String(attr(el, 'style') || '');
			if (/(?:fixed|absolute|z-index)/i.test(styleAttr)) return true;
		}
		return false;
	}

	const RE_PREVIEW_KEYWORDS = /(?:preview|trailer|thumb|hover|preload|mediabook|videopreview|stream-preview|snapshot)/i;
	const RE_CARD_CONTAINER = /(?:^|[\s_-])(?:video[-_]?box|thumb[-_]?block|videoblock|cam[-_]?item|room[-_]?card|video[-_]?card|item[-_]?video|thumb[-_]?container|media[-_]?card)(?:$|[\s_-])/i;

	function isLegitimateMediaPreview(node) {
		if (!node || node.nodeType !== 1) return false;
		if (node.hasAttribute && node.getAttribute('data-nvirya-safe-preview') === '1') return true;

		if (isYouTubeDomain(hostname)) {
			if (node.id === 'video-preview' || (node.closest && node.closest('ytd-thumbnail, ytm-thumbnail-cover, ytd-rich-item-renderer, ytm-media-item, ytd-video-preview, #video-preview, .ytp-inline-preview-ui, ytm-reel-item-renderer'))) {
				try { node.setAttribute('data-nvirya-safe-preview', '1'); } catch (e) {}
				return true;
			}
		}

		const tag = String(node.tagName || '').toLowerCase();
		const isMediaEl = tag === 'video' || tag === 'canvas' || tag === 'img';
		const videoEl = tag === 'video' ? node : (node.querySelector ? node.querySelector('video') : null);

		if (isMediaEl || videoEl) {
			const targetVideo = videoEl || (tag === 'video' ? node : null);
			if (targetVideo) {
				const isMuted = targetVideo.muted === true || targetVideo.hasAttribute('muted') || targetVideo.hasAttribute('loop') || targetVideo.hasAttribute('playsinline');
				let isSmallCard = false;
				try {
					const r = targetVideo.getBoundingClientRect();
					const vw = W.innerWidth || D.documentElement.clientWidth || 800;
					const vh = W.innerHeight || D.documentElement.clientHeight || 600;
					if (r.width > 0 && r.height > 0 && r.width < vw * 0.6 && r.height < vh * 0.6) {
						isSmallCard = true;
					}
				} catch (e) {}

				if (isMuted && isSmallCard) {
					try {
						node.setAttribute('data-nvirya-safe-preview', '1');
						if (targetVideo !== node) targetVideo.setAttribute('data-nvirya-safe-preview', '1');
					} catch (e) {}
					return true;
				}
			}

			const idc = ((node.id || '') + ' ' + classString(node)).trim();
			const src = (node.getAttribute && (node.getAttribute('src') || node.getAttribute('data-src'))) || '';
			if (RE_PREVIEW_KEYWORDS.test(idc) || RE_PREVIEW_KEYWORDS.test(src)) {
				try { node.setAttribute('data-nvirya-safe-preview', '1'); } catch (e) {}
				return true;
			}

			try {
				const card = node.closest && node.closest('li, article, .video-box, .thumb-block, .videoblock, .cam-item, .room-card, [data-video-id], [data-id]');
				if (card) {
					const idcCard = ((card.id || '') + ' ' + classString(card)).trim();
					if (RE_CARD_CONTAINER.test(idcCard) || card.hasAttribute('data-video-id') || card.hasAttribute('data-id')) {
						try { node.setAttribute('data-nvirya-safe-preview', '1'); } catch (e) {}
						return true;
					}
				}
			} catch (e) {}
		}

		try {
			const anchor = node.closest && node.closest('a');
			if (anchor) {
				const hasThumbnail = anchor.querySelector('img, video, canvas');
				if (hasThumbnail && (isLegitimateMediaPreview(hasThumbnail) || isNewsThumbnailContext(anchor))) {
					const idcNode = ((node.id || '') + ' ' + classString(node)).trim();
					if (RE_PREVIEW_KEYWORDS.test(idcNode)) {
						try { node.setAttribute('data-nvirya-safe-preview', '1'); } catch (e) {}
						return true;
					}
				}
			}
		} catch (e) {}

		return false;
	}

	const RE_AD_LABEL_ONLY = /^(?:advertisement|sponsored|quảng cáo|ad|ads|tài trợ|advertisements|promoted)$/i;
	const RE_AD_WRAPPER_IDENTIFIER = /(?:^|[-_])(?:ad|ads|adv|ad[-_]?banner|ad[-_]?wrapper|ad[-_]?slot|ad[-_]?box|ad[-_]?container|ad[-_]?unit|sponsor|dfp|gpt[-_]?ad)(?:$|[-_])/i;
	const RE_MAIN_CONTENT_TAGS = /^(?:p|h1|h2|h3|h4|h5|h6|article|main|form|input|select|textarea|table)$/i;

	function collapseEmptyAdAncestors(adNode) {
		if (!adNode || !adNode.parentElement || isSearchEngineDomain(hostname)) return;
		let parent = adNode.parentElement;
		let depth = 0;
		while (parent && depth < 4) {
			const tag = String(parent.tagName || '').toLowerCase();
			if (tag === 'body' || tag === 'html' || tag === 'main' || tag === 'article' || parent.id === 'content' || parent.id === 'app' || parent.id === '__next' || parent.id === 'root' || parent.id === 'rso' || parent.id === 'botstuff' || parent.id === 'search' || parent.id === 'center_col') break;
			if (isNviryaNode(parent) || isProtectedPlayer(parent) || isLegitimateMediaPreview(parent) || isCaptchaOrTurnstileElement(parent)) break;

			const hasLegitVideo = parent.querySelector && parent.querySelector('video') && !isAdUrl(safeUrl(parent.querySelector('video').src));
			if (hasLegitVideo) break;

			const txt = String(parent.innerText || parent.textContent || '').trim();
			const isShortText = txt.length < 25;
			const isAdLabelOnly = RE_AD_LABEL_ONLY.test(txt);
			if (!isShortText && !isAdLabelOnly) break;

			let hasMainTags = false;
			if (parent.querySelector && parent.querySelector('p, h1, h2, h3, h4, h5, h6, article, main, form, input:not([type="hidden"]), select, textarea, table')) {
				hasMainTags = true;
			}
			if (hasMainTags) break;

			const idc = ((parent.id || '') + ' ' + classString(parent)).trim();
			const isAdWrap = RE_AD_WRAPPER_IDENTIFIER.test(idc);

			if (isAdLabelOnly || (isShortText && isAdWrap)) {
				try {
					parent.style.setProperty('display', 'none', 'important');
					parent.style.setProperty('height', '0px', 'important');
					parent.style.setProperty('min-height', '0px', 'important');
					parent.style.setProperty('max-height', '0px', 'important');
					parent.style.setProperty('margin', '0px', 'important');
					parent.style.setProperty('padding', '0px', 'important');
					parent.style.setProperty('border', 'none', 'important');
					parent.style.setProperty('visibility', 'hidden', 'important');
					parent.setAttribute('data-nvirya-collapsed', '1');
				} catch (e) {}
			}
			parent = parent.parentElement;
			depth++;
		}
	}

	function sweepFixedBanners(root) {
		if (isDisabledHere() || isYouTubeDomain(hostname) || isSearchEngineDomain(hostname)) return;
		const candidates = (root && root.querySelectorAll) ? root.querySelectorAll('div, aside, section, ins') : D.querySelectorAll('div, aside, section, ins');
		const lim = Math.min(candidates.length, 120);
		const vh = W.innerHeight || D.documentElement.clientHeight || 800;
		for (let i = 0; i < lim; i++) {
			const el = candidates[i];
			if (!el || isNviryaNode(el) || isProtectedPlayer(el) || isLegitimateMediaPreview(el) || el.hasAttribute('data-nvirya-collapsed')) continue;
			let style, rect;
			try {
				style = W.getComputedStyle(el);
				if (!style || (style.position !== 'fixed' && style.position !== 'sticky')) continue;
				rect = el.getBoundingClientRect();
			} catch (e) { continue; }
			if (!rect || rect.height <= 0 || rect.height > 180) continue;
			const isNearTopOrBottom = rect.top <= 10 || (vh - rect.bottom) <= 15;
			if (!isNearTopOrBottom) continue;

			const hasAdIframe = el.querySelector && el.querySelector('iframe[src*="ad"], ins.adsbygoogle, ins.eas6a97888e, [id^="ad_position_"], [id^="div-gpt-ad"]');
			const hasBannerSize = isMatchingAdBannerSize(el) || (el.firstElementChild && isMatchingAdBannerSize(el.firstElementChild));
			if (hasAdIframe || hasBannerSize) {
				const txt = meaningfulText(el);
				if (txt.length < 30) {
					try {
						el.style.setProperty('display', 'none', 'important');
						el.style.setProperty('height', '0px', 'important');
						el.style.setProperty('min-height', '0px', 'important');
						el.style.setProperty('pointer-events', 'none', 'important');
						el.setAttribute('data-nvirya-collapsed', '1');
						stats.inc('hidden');
						stats.inc('ads');
						log('BLOCK', 'dom', 'sweep-fixed-banner', el.tagName);
					} catch (e) {}
				}
			}
		}
	}

	const RE_BACKDROP_IDENTIFIER = /(?:backdrop|modal[-_]?bg|overlay[-_]?bg|dimmer|mask|popup[-_]?overlay|fancybox[-_]?bg|swal2[-_]?container|mfp[-_]?bg|black[-_]?layer)/i;

	function hasActiveLegitimateDialogOrModal() {
		if (!D.body) return false;
		try {
			const openDialogs = D.querySelectorAll('dialog[open], [role="dialog"]:not([data-nvirya-hidden]), .modal.show:not([data-nvirya-hidden]), .modal.in:not([data-nvirya-hidden]), [aria-modal="true"]:not([data-nvirya-hidden])');
			for (let i = 0; i < openDialogs.length; i++) {
				const d = openDialogs[i];
				if (isNviryaNode(d)) continue;
				const style = W.getComputedStyle(d);
				if (style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0.05) {
					const rect = d.getBoundingClientRect();
					if (rect.width > 50 && rect.height > 50 && meaningfulText(d).length >= 5) {
						return true;
					}
				}
			}
		} catch (e) {}
		return false;
	}

	function sweepOrphanedBackdrops() {
		if (isDisabledHere() || isSecurityVerificationPage() || isSearchEngineDomain(hostname)) return;
		if (hasActiveLegitimateDialogOrModal()) return;

		const vw = W.innerWidth || D.documentElement.clientWidth || 0;
		const vh = W.innerHeight || D.documentElement.clientHeight || 0;
		if (!vw || !vh) return;

		const candidates = [];
		try {
			const bodyChildren = D.body ? D.body.children : [];
			for (let i = 0; i < bodyChildren.length; i++) candidates.push(bodyChildren[i]);
			const matching = D.querySelectorAll('.modal-backdrop, [class*="backdrop" i], [class*="dimmer" i], [class*="overlay-bg" i], [class*="black-layer" i], .modal, [class*="modal" i]');
			for (let i = 0; i < matching.length; i++) {
				if (!candidates.includes(matching[i])) candidates.push(matching[i]);
			}
		} catch (e) { return; }

		let sweptCount = 0;
		for (let i = 0; i < candidates.length; i++) {
			const el = candidates[i];
			if (!el || el.nodeType !== 1 || isNviryaNode(el) || isProtectedPlayer(el) || isLegitimateMediaPreview(el) || isCaptchaOrTurnstileElement(el)) continue;

			let style, rect;
			try {
				style = W.getComputedStyle(el);
				if (!style || (style.position !== 'fixed' && style.position !== 'absolute')) continue;
				if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') continue;
				rect = el.getBoundingClientRect();
			} catch (e) { continue; }

			if (!rect || rect.width < vw * 0.8 || rect.height < vh * 0.8) continue;

			const idc = ((el.id || '') + ' ' + classString(el)).trim();
			const isNamedBackdrop = RE_BACKDROP_IDENTIFIER.test(idc) || (el.classList && el.classList.contains('modal-backdrop'));
			const isModalContainer = (el.classList && el.classList.contains('modal')) || /(?:^|\s)modal(?:\s|$)/i.test(el.className || '');

			let isEmptyModal = false;
			if (isModalContainer && !isNamedBackdrop) {
				const hasControls = el.querySelector && el.querySelector('input:not([type="hidden"]), textarea, select, video, audio');
				if (!hasControls && !isCaptchaOrTurnstileElement(el)) {
					const txt = meaningfulText(el);
					const hasSubstantiveContent = txt.length >= 25 || (el.querySelector && el.querySelector('img:not([data-nvirya-collapsed]), iframe:not([data-nvirya-collapsed])'));
					if (!hasSubstantiveContent || isEmptyOrCloseOnly(el, 0)) {
						isEmptyModal = true;
					}
				}
			}

			const bg = String(style.backgroundColor || '').replace(/\s+/g, '').toLowerCase();
			const opacity = parseFloat(style.opacity || '1');

			let isDarkOverlay = false;
			const rgbaMatch = bg.match(/^rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)$/);
			if (rgbaMatch) {
				const r = parseInt(rgbaMatch[1], 10);
				const g = parseInt(rgbaMatch[2], 10);
				const b = parseInt(rgbaMatch[3], 10);
				const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
				if (r <= 40 && g <= 40 && b <= 40 && ((a >= 0.1 && a <= 0.98) || (opacity < 1 && opacity >= 0.1))) {
					isDarkOverlay = true;
				}
			}

			const isZeroContent = el.children.length === 0 && meaningfulText(el).length === 0;

			if (isNamedBackdrop || (isZeroContent && isDarkOverlay) || isEmptyModal) {
				try {
					el.style.setProperty('display', 'none', 'important');
					el.style.setProperty('pointer-events', 'none', 'important');
					el.style.setProperty('opacity', '0', 'important');
					el.style.setProperty('visibility', 'hidden', 'important');
					el.setAttribute('data-nvirya-collapsed', '1');
					el.setAttribute('data-nvirya-hidden', isEmptyModal ? 'empty-modal' : 'orphaned-backdrop');
					sweptCount++;
					log('BLOCK', 'dom', isEmptyModal ? 'swept-empty-modal' : 'swept-orphaned-backdrop', el.tagName);
				} catch (e) {}
			}
		}

		if (sweptCount > 0 || !hasVisibleLegitimateModal()) {
			[D.documentElement, D.body].forEach(root => {
				if (!root) return;
				try {
					['modal-open', 'no-scroll', 'overflow-hidden', 'fixed-body', 'has-modal', 'noscroll'].forEach(cls => {
						if (root.classList.contains(cls)) root.classList.remove(cls);
					});
				} catch (e) {}
			});
		}
	}

	function isInvisibleTrap(el) {
		if (isYouTubeDomain(hostname) || isSearchEngineDomain(hostname) || TRUSTED_DOCS_DOMAINS.test(hostname) || isSecurityVerificationPage()) return false;
		if (isLegitimateMediaPreview(el) || isCaptchaOrTurnstileElement(el)) return false;
		if (!el || el.nodeType !== 1 || !el.isConnected) return false;

		const tag = String(el.tagName || '').toLowerCase();
		if (RE_SAFE_TEXT_TAGS.test(tag)) return false;
		try {
			if (el.closest && el.closest(SAFE_CONTENT_CONTAINER_SELECTOR)) return false;
		} catch (e) {}
		if (!isHighRiskTrapElement(el, tag)) return false;

		if (isNviryaNode(el) || isProtectedPlayer(el)) return false;
		if (isProtectedTrapSurface(el)) return false;

		if (tag === 'iframe') {
			const iSrc = attr(el, 'src') || '';
			if (iSrc && RE_SECURITY_CHALLENGE.test(iSrc)) return false;
			const iu = safeUrl(iSrc);
			if (iu && (isSafeThirdPartyCdn(iu.hostname) || sameRootDomain(iu.hostname, hostname)) && !isAdUrl(iu)) return false;
		}

		let style, rect;
		try {
			style = W.getComputedStyle(el);
			if (!style || (style.position !== 'fixed' && style.position !== 'absolute')) return false;
			if (style.pointerEvents === 'none') return false;

			const z = parseInt(style.zIndex, 10);
			const hasZ = isFinite(z) ? z >= 8 : (style.position === 'fixed');
			if (!hasZ) return false;

			const opacity = parseFloat(style.opacity);
			const bg = String(style.backgroundColor || '').replace(/\s+/g, '').toLowerCase();
			const transparentBg = bg === 'transparent' || /^rgba\(\d{1,3},\d{1,3},\d{1,3},0(?:\.0+)?\)$/.test(bg);
			const isFilterZero = /opacity\(\s*0(?:\.0+)?\s*\)/i.test(style.filter || '');
			const isLowOpacity = (isFinite(opacity) && opacity <= 0.08) || isFilterZero;
			const isTransparent = tag === 'iframe' ? (isLowOpacity || (transparentBg && (!attr(el, 'src') || /^about:blank/i.test(attr(el, 'src')) || isAdUrl(safeUrl(attr(el, 'src')))))) : (isLowOpacity || transparentBg);
			if (!isTransparent) return false;

			const image = String(style.backgroundImage || 'none').trim().toLowerCase();
			if (image && image !== 'none') return false;

			rect = el.getBoundingClientRect();
		} catch (e) { return false; }

		const vw = W.innerWidth || D.documentElement.clientWidth || 0;
		const vh = W.innerHeight || D.documentElement.clientHeight || 0;
		if (!vw || !vh || !rect || rect.width <= 2 || rect.height <= 2) return false;

		const width = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0));
		const height = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
		const coveredArea = width * height;
		const viewportArea = vw * vh;

		const isLargeOverlay = coveredArea >= viewportArea * 0.25;

		let coversPlayer = false;
		if (!isLargeOverlay) {
			try {
				const videos = D.querySelectorAll('video, audio');
				for (let i = 0; i < Math.min(videos.length, 6); i++) {
					const v = videos[i];
					const vr = v.getBoundingClientRect();
					if (vr.width > 60 && vr.height > 60) {
						const iw = Math.max(0, Math.min(rect.right, vr.right) - Math.max(rect.left, vr.left));
						const ih = Math.max(0, Math.min(rect.bottom, vr.bottom) - Math.max(rect.top, vr.top));
						if (iw * ih >= vr.width * vr.height * 0.45) {
							coversPlayer = true;
							break;
						}
					}
				}
			} catch (e) {}
		}

		if (!isLargeOverlay && !coversPlayer) return false;

		if (meaningfulText(el).length > 12) return false;

		try {
			if (el.querySelector('input:not([type="hidden"]),textarea,select,button:not([class*="close" i])')) return false;
		} catch (e) {}

		if (tag === 'iframe') return true;

		const links = el.querySelectorAll ? el.querySelectorAll('a[href]') : (tag === 'a' ? [el] : []);
		if (links.length > 0) {
			for (let i = 0; i < Math.min(links.length, 5); i++) {
				const u = safeUrl(links[i].href || attr(links[i], 'href'));
				if (u && (isAdUrl(u) || isUntrustedCrossSiteUrl(u))) return true;
			}
		}

		return true;
	}

	function installInvisibleTrapInterception() {
		const interceptTrap = function(e) {
			try {
				if (!config.enabled || isDisabledHere()) return;
				if (e.composedPath) {
					const path = e.composedPath();
					for (let i = 0; i < path.length; i++) {
						if (isNviryaNode(path[i])) return;
					}
				}
				const target = e.target;
				if (!target || target.nodeType !== 1 || isNviryaNode(target)) return;
				if (e.isTrusted) trackUserTarget(target);

				if (isInvisibleTrap(target)) {
					e.preventDefault();
					e.stopPropagation();
					e.stopImmediatePropagation();
					log('BLOCK', 'invisible-trap', 'Neutralized tap on invisible trap:', target.tagName);
					applyAction(target, 'remove', 'invisible-click-trap');
					scheduleUnlockPageScroll();
					return;
				}

				let cur = target.parentElement,
					depth = 0;
				while (cur && cur.nodeType === 1 && depth++ < 5) {
					if (isInvisibleTrap(cur)) {
						e.preventDefault();
						e.stopPropagation();
						e.stopImmediatePropagation();
						log('BLOCK', 'invisible-trap', 'Neutralized tap inside invisible trap ancestor:', cur.tagName);
						applyAction(cur, 'remove', 'invisible-click-trap');
						scheduleUnlockPageScroll();
						return;
					}
					cur = cur.parentElement;
				}
			} catch (err) {}
		};

		try {
			['pointerdown', 'touchstart', 'mousedown', 'click'].forEach(function(evt) {
				D.addEventListener(evt, interceptTrap, true);
			});
		} catch (e) {}
	}

	function captureScrollBaseline(el) {
		if (!el || el.nodeType !== 1 || scrollBaseline.has(el)) return;
		const props = ['overflow', 'overflow-x', 'overflow-y', 'position', 'top', 'right', 'bottom', 'left', 'width', 'margin-right', 'touch-action'];
		const snapshot = { computed: {}, inline: {}, priority: {} };
		try {
			const computed = W.getComputedStyle(el);
			for (const prop of props) {
				const camel = prop.replace(/-([a-z])/g, function(_, c) { return c.toUpperCase(); });
				snapshot.computed[prop] = computed ? computed[camel] || computed.getPropertyValue(prop) : '';
				snapshot.inline[prop] = el.style.getPropertyValue(prop);
				snapshot.priority[prop] = el.style.getPropertyPriority(prop);
			}
			scrollBaseline.set(el, snapshot);
		} catch (e) {}
	}

	const RE_PAYWALL_OR_CMP_MODAL = /(?:paywall|subscri(?:be|ption)|piano|tp-modal|fc-ab-root|fc-dialog|cmp|consent|quantcast|sp_message|onesignal|adblock|wall|gate|overlay-lock)/i;

	function hasVisibleLegitimateModal() {
		try {
			const nodes = D.querySelectorAll('dialog[open],[role="dialog"],[role="alertdialog"],[aria-modal="true"]');
			for (let i = 0; i < Math.min(nodes.length, 40); i++) {
				const el = nodes[i];
				if (el.hasAttribute('data-nvirya-hidden') || el.hasAttribute('data-nvirya-disarmed') || isNviryaNode(el)) continue;
				const idc = ((el.id || '') + ' ' + classString(el)).trim();
				if (RE_ANTIADB.test(idc) || RE_PAYWALL_OR_CMP_MODAL.test(idc) || isAdEvidence(el)) continue;
				const style = W.getComputedStyle(el);
				const rect = el.getBoundingClientRect();
				if (!style || style.display === 'none' || style.visibility === 'hidden' ||
					parseFloat(style.opacity) === 0 || rect.width < 2 || rect.height < 2) continue;
				if (isFloatingAdModal(el) || isFakeBotVerificationModal(el) || isInvisibleTrap(el)) continue;
				if (el.querySelector('input:not([type="hidden"]),textarea,select,video,audio')) {
					releasePageScrollOverrides();
					return true;
				}
			}
		} catch (e) {}
		return false;
	}

	function rememberScrollOverride(el, prop) {
		let saved = scrollOverrideStyles.get(el);
		if (!saved) {
			saved = {};
			scrollOverrideStyles.set(el, saved);
		}
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

	function unlockPageScroll(forceManual = false) {
		if (!forceManual && (isSearchEngineDomain(hostname) || isSecurityVerificationPage())) return false;
		if (hasVisibleLegitimateModal()) return false;
		sweepOrphanedBackdrops();
		const roots = [D.documentElement, D.body];
		let changed = false;
		const overflowProps = ['overflow', 'overflow-y'];
		for (const el of roots) {
			if (!el) continue;
			try {
				['modal-open', 'no-scroll', 'overflow-hidden', 'fixed-body', 'has-modal', 'noscroll'].forEach(cls => {
					if (el.classList.contains(cls)) {
						el.classList.remove(cls);
						changed = true;
					}
				});
			} catch (e) {}
			captureScrollBaseline(el);
			const base = scrollBaseline.get(el);
			if (!base) continue;
			let cs;
			try { cs = W.getComputedStyle(el); } catch (e) { continue; }
			if (!cs) continue;
			for (const prop of overflowProps) {
				const camel = prop.replace(/-([a-z])/g, function(_, c) { return c.toUpperCase(); });
				const current = String(cs[camel] || cs.getPropertyValue(prop) || '').toLowerCase();
				if (current === 'hidden' || current === 'clip') {
					rememberScrollOverride(el, 'overflow-y');
					try {
						el.style.setProperty('overflow-y', 'auto', 'important');
						if (prop === 'overflow' && String(el.style.getPropertyValue('overflow') || '').toLowerCase() === 'hidden') {
							rememberScrollOverride(el, 'overflow');
							el.style.setProperty('overflow', ' visible auto', 'important');
						}
						changed = true;
					} catch (e) {}
				}
			}
			const position = String(cs.position || '').toLowerCase();
			if (position === 'fixed' && String(base.computed.position || '').toLowerCase() !== 'fixed') {
				try {
					const topOffset = parseInt(el.style.top || cs.top || '0', 10);
					rememberScrollOverride(el, 'position');
					el.style.setProperty('position', base.inline.position || base.computed.position || 'static', base.priority.position || 'important');
					['top', 'right', 'bottom', 'left', 'width', 'margin-right'].forEach(function(prop) {
						rememberScrollOverride(el, prop);
						const val = base.inline[prop];
						if (val) el.style.setProperty(prop, val, base.priority[prop] || '');
						else el.style.removeProperty(prop);
					});
					if (topOffset < 0 && W.scrollY === 0) {
						try { W.scrollTo(0, Math.abs(topOffset)); } catch (e) {}
					}
					changed = true;
				} catch (e) {}
			}
		}
		if (changed) log('INFO', 'scroll', 'restored page scrolling after overlay cleanup');
		return changed;
	}

	function scheduleUnlockPageScroll() {
		if (scrollUnlockTimers.length) return;
		[0, 120, 420, 900].forEach(function(delay) {
			scrollUnlockTimers.push(setTimeout(function() {
				unlockPageScroll();
				if (delay === 900) scrollUnlockTimers = [];
			}, delay));
		});
	}

	const TARGETED_CANDIDATE_SELECTOR = 'iframe, ins.adsbygoogle, [id^="aswift_"], [id^="google_ads_"], .aads-sticky, aside.ads, .ads_single_top, .ads_single_center, .ads_header, div[class*="banner" i], div[id*="banner" i], a[target="_blank"]';
	const TARGETED_TRAP_SELECTOR = HIGH_RISK_TRAP_SELECTOR;
	let trapChunkRunning = false;

	function queueTrapNode(node, includeDescendants) {
		if (isYouTubeDomain(hostname) || TRUSTED_DOCS_DOMAINS.test(hostname)) return;
		if (isLegitimateMediaPreview(node)) return;
		if (!node || node.nodeType !== 1 || hasNviryaAncestor(node) ||
			attr(node, 'data-nvirya-ui') !== null || attr(node, 'data-nvirya-picker') !== null) return;
		const push = function(el) {
			if (!el || el.nodeType !== 1 || trapQueued.has(el)) return;
			const tag = String(el.tagName || '').toLowerCase();
			if (RE_SAFE_TEXT_TAGS.test(tag) || !isHighRiskTrapElement(el, tag)) return;
			try {
				if (el.closest && el.closest(SAFE_CONTENT_CONTAINER_SELECTOR)) return;
			} catch (e) {}
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
				const descendants = node.querySelectorAll(TARGETED_TRAP_SELECTOR);
				for (let i = 0; i < Math.min(descendants.length, 60); i++) push(descendants[i]);
			} catch (e) {}
		}
		if (trapQueue.length > 0) scheduleTrapFlush();
	}

	function scheduleTrapFlush() {
		if (trapFlushScheduled || trapChunkRunning || !trapQueue.length) return;
		trapFlushScheduled = true;
		const run = function() {
			trapFlushScheduled = false;
			if (trapChunkRunning || !trapQueue.length) return;
			trapChunkRunning = true;
			const batch = trapQueue.splice(0, trapQueue.length);
			processInChunks(batch, function(el) {
				if (!el) return;
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
							scheduleUnlockPageScroll();
							log('BLOCK', 'dom', 'Disarmed invisible click-trap in-place');
						}
					} catch (e) {}
				}
			}, 8, function() {
				trapChunkRunning = false;
				if (trapQueue.length > 0) scheduleTrapFlush();
			});
		};
		if (typeof W.requestAnimationFrame === 'function') W.requestAnimationFrame(run);
		else setTimeout(run, 16);
	}

	function startInvisibleTrapObserver() {
		startObserver();
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
		let out = '',
			visited = 0;
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
		try { return !!el.querySelector('form,input,select,textarea,[contenteditable="true"]'); } catch (e) { return false; }
	}

	function hasProtectedPlayerContent(el) {
		if (!el || el.nodeType !== 1) return false;
		if (isProtectedPlayer(el)) return true;
		let media = [];
		try { media = el.querySelectorAll('video,audio'); } catch (e) {}
		const limit = Math.min(media.length, 12);
		for (let i = 0; i < limit; i++)
			if (isProtectedPlayer(media[i])) return true;
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
		for (let i = 0; i < limit; i++)
			if (isCloseControl(nodes[i])) return true;
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
		return style.position === 'fixed' || style.position === 'sticky' || style.position === 'absolute' || (isFinite(z) && z >= 10);
	}

	function isFloatingAdModal(el) {
		if (!el || el.nodeType !== 1 || isSecurityVerificationPage()) return false;
		const tag = String(el.tagName || '').toLowerCase();
		if (tag !== 'div' && tag !== 'section' && tag !== 'dialog' && tag !== 'aside') return false;

		let style, rect;
		try {
			style = W.getComputedStyle(el);
			if (!style || (style.position !== 'fixed' && style.position !== 'sticky' && style.position !== 'absolute')) return false;
			if (style.display === 'none' || style.visibility === 'hidden') return false;
			const z = parseInt(style.zIndex, 10);
			if ((!isFinite(z) || z < 20) && style.position !== 'fixed' && style.position !== 'sticky') return false;
			rect = el.getBoundingClientRect();
		} catch (e) { return false; }

		const vw = W.innerWidth || D.documentElement.clientWidth || 0;
		const vh = W.innerHeight || D.documentElement.clientHeight || 0;
		if (!vw || !vh || rect.width <= 120 || rect.height <= 42) return false;
		const isStickyBar = (style.position === 'fixed' || style.position === 'sticky') && rect.width >= vw * 0.65 && rect.height >= 44 && rect.height <= 180;
		if (!isStickyBar && (rect.width <= 150 || rect.height <= 120)) return false;

		if (hasProtectedCleanupContent(el)) return false;
		const text = meaningfulText(el);
		if (text.length >= 60) return false;

		const marked = ((el.id || '') + ' ' + classString(el)).trim();
		let adEvidence = !!(marked && RE_AD_TOKEN.test(marked)) || !!el.hasAttribute('data-nvirya-ad-child');

		let links = [],
			media = [];
		try {
			links = el.querySelectorAll('a[href]');
			media = el.querySelectorAll('img,iframe,object,embed,ins');
		} catch (e) {}

		if (!adEvidence && links.length + media.length === 0) return false;
		if (links.length > 4 || media.length > 4) return false;

		let untrustedExternalLink = false,
			trustedIdentityLink = false;
		for (let i = 0; i < Math.min(links.length, 4); i++) {
			const link = links[i];
			const u = safeUrl(link.href || attr(link, 'href'));
			const marker = ((link.id || '') + ' ' + classString(link)).trim();
			if (RE_AD_TOKEN.test(marker) || (u && isAdUrl(u))) adEvidence = true;
			if (u && isUntrustedCrossSiteUrl(u)) untrustedExternalLink = true;
			if (u && isTrustedPopupHost(u.hostname)) trustedIdentityLink = true;
		}
		for (let i = 0; i < Math.min(media.length, 4); i++) {
			const item = media[i];
			const u = safeUrl(attr(item, 'src') || attr(item, 'data-src') || '');
			const marker = ((item.id || '') + ' ' + classString(item)).trim();
			if (RE_AD_TOKEN.test(marker) || (u && isAdUrl(u))) adEvidence = true;
			if (u && isUntrustedCrossSiteUrl(u)) untrustedExternalLink = true;
			if (u && isTrustedPopupHost(u.hostname)) trustedIdentityLink = true;
		}

		const sparseImageDialog = !isStickyBar && media.length > 0 && text.length < 15 && containsCloseControl(el);
		if (trustedIdentityLink && !adEvidence) return false;
		return adEvidence || (media.length > 0 && untrustedExternalLink && containsCloseControl(el)) || sparseImageDialog;
	}

	function isBackdropFor(backdrop, modal) {
		if (!backdrop || !modal || backdrop === modal || backdrop.nodeType !== 1) return false;
		const tag = String(backdrop.tagName || '').toLowerCase();
		if (tag !== 'div' && tag !== 'section') return false;
		if (hasProtectedCleanupContent(backdrop) || meaningfulText(backdrop).length > 2) return false;
		let bs, ms, br, mr;
		try {
			bs = W.getComputedStyle(backdrop);
			ms = W.getComputedStyle(modal);
			br = backdrop.getBoundingClientRect();
			mr = modal.getBoundingClientRect();
		} catch (e) { return false; }
		if (!bs || !ms || (bs.position !== 'fixed' && bs.position !== 'absolute')) return false;
		const bz = parseInt(bs.zIndex, 10),
			mz = parseInt(ms.zIndex, 10);
		if (!isFinite(bz) || !isFinite(mz) || mz < 10 || bz > mz || (mz - bz) > 35) return false;
		const vw = W.innerWidth || D.documentElement.clientWidth || 0;
		const vh = W.innerHeight || D.documentElement.clientHeight || 0;
		return !!vw && !!vh && br.width >= vw * 0.95 && br.height >= vh * 0.95 &&
			br.width * br.height >= mr.width * mr.height;
	}

	function adjacentBackdropNodes(el) {
		if (!el || !el.parentElement) return [];
		const out = [];
		const seen = new Set();
		let prev = el.previousElementSibling;
		let count = 0;
		while (prev && count < 15) {
			if (!seen.has(prev) && isBackdropFor(prev, el)) {
				out.push(prev);
				seen.add(prev);
			}
			prev = prev.previousElementSibling;
			count++;
		}
		let next = el.nextElementSibling;
		count = 0;
		while (next && count < 15) {
			if (!seen.has(next) && isBackdropFor(next, el)) {
				out.push(next);
				seen.add(next);
			}
			next = next.nextElementSibling;
			count++;
		}
		const root = el.parentElement || (D && D.body);
		if (root && (root === D.body || root === D.documentElement)) {
			const bChildren = root.children;
			const limit = Math.min(bChildren.length, 30);
			for (let i = bChildren.length - 1; i >= Math.max(0, bChildren.length - limit); i--) {
				const cand = bChildren[i];
				if (cand && cand !== el && !seen.has(cand) && isBackdropFor(cand, el)) {
					out.push(cand);
					seen.add(cand);
				}
			}
		}
		return out;
	}

	function removeTrackedAdNode(el, reason) {
		if (!el || !el.parentNode) return false;
		if (isLegitimateMediaPreview(el)) return false;
		if (isBaitElement(el)) {
			try {
				el.setAttribute('data-nvirya-bait-heal', '1');
				el.style.setProperty('clip', 'rect(0,0,0,0)', 'important');
				el.style.setProperty('clip-path', 'inset(50%)', 'important');
				el.style.setProperty('opacity', '0', 'important');
				el.style.setProperty('pointer-events', 'none', 'important');
				el.style.setProperty('position', 'absolute', 'important');
			} catch (e) {}
			return false;
		}
		try {
			if (state.removedNodes.length > 200) state.removedNodes.shift();
			const parent = el.parentNode,
				next = el.nextSibling;
			state.removedNodes.push({ el, parent, next });
			parent.removeChild(el);
			stats.inc('removed');
			stats.inc('ads');
			log('BLOCK', 'dom', reason || 'remove', el.tagName);
			return true;
		} catch (e) { log('ERROR', 'apply', e && e.message); return false; }
	}

	function removePairedBackdrops(el) {
		const backdrops = adjacentBackdropNodes(el);
		for (const backdrop of backdrops) removeTrackedAdNode(backdrop, 'backdrop-removed');
		if (el && el.nodeType === 1 && (el.classList.contains('modal') || /\bmodal\b/i.test(el.className))) {
			try {
				const orphaned = D.querySelectorAll('.modal-backdrop, [class*="backdrop" i]');
				for (let i = 0; i < orphaned.length; i++) {
					const ob = orphaned[i];
					if (isBackdropFor(ob, el)) removeTrackedAdNode(ob, 'backdrop-removed');
				}
			} catch (e) {}
		}
	}

	function pruneAdAncestors(start) {
		let current = start;
		for (let depth = 0; current && depth < 5; depth++) {
			const tag = String(current.tagName || '').toLowerCase();
			if (tag === 'body' || tag === 'html' || tag === 'main' || tag === 'article' || tag === 'header' || tag === 'nav') break;
			const next = current.parentElement;
			try { current.setAttribute('data-nvirya-ad-child', '1'); } catch (e) {}
			if (!hasProtectedCleanupContent(current)) {
				const idc = ((current.id || '') + ' ' + classString(current)).trim();
				const isAdWrap = RE_AD_TOKEN.test(idc) || /ad[-_]?overlay|ad[-_]?modal|ad[-_]?stack|sticky[-_]?ad/i.test(idc);
				const isFloat = isFloatingContainer(current);
				if ((isFloat && (isEmptyOrCloseOnly(current, 0) || meaningfulText(current).length <= 24)) || (isAdWrap && meaningfulText(current).length <= 24)) {
					removePairedBackdrops(current);
					if (removeTrackedAdNode(current, 'parent-pruned')) {
						current = next;
						continue;
					}
				}
			}
			current = next;
		}
	}

	function applyAction(el, action, reason) {
		if (!el || !el.parentNode) return;
		try {
			if (isLegitimateMediaPreview(el)) return;
			if (isBaitElement(el)) {
				try {
					el.setAttribute('data-nvirya-bait-heal', '1');
					el.style.setProperty('clip', 'rect(0,0,0,0)', 'important');
					el.style.setProperty('clip-path', 'inset(50%)', 'important');
					el.style.setProperty('opacity', '0', 'important');
					el.style.setProperty('pointer-events', 'none', 'important');
					el.style.setProperty('position', 'absolute', 'important');
					stats.inc('hidden');
					stats.inc('ads');
					log('BLOCK', 'dom', 'bait-auto-heal', el.tagName);
				} catch (e) {}
				return;
			}
			collapseEmptyAdAncestors(el);
			const shouldUnlock = /invisible-click-trap|anti-adblock|floating-ad-modal|suspicious-overlay|max-zindex-ad-overlay|fake-bot-overlay|shadow-dom-ad-host|backdrop-removed|parent-pruned/i.test(reason || '');
			if (action === 'remove') {
				const parent = el.parentNode;
				removePairedBackdrops(el);
				if (removeTrackedAdNode(el, reason || 'remove')) {
					pruneAdAncestors(parent);
					if (shouldUnlock) {
						sweepOrphanedBackdrops();
						scheduleUnlockPageScroll();
					}
				}
			} else if (action === 'hide') {
				if (state.hiddenNodes.has(el)) return;
				state.hiddenNodes.add(el);
				el.setAttribute('data-nvirya-hidden', reason || '1');
				stats.inc('hidden');
				if (shouldUnlock) {
					sweepOrphanedBackdrops();
					scheduleUnlockPageScroll();
				}
			}
		} catch (e) { log('ERROR', 'apply', e && e.message); }
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
		try {
			style = W.getComputedStyle(el);
			rect = el.getBoundingClientRect();
		} catch (e) { return false; }
		if (!style || (style.position !== 'fixed' && style.position !== 'absolute')) return false;
		const z = parseInt(style.zIndex, 10);
		if (!isFinite(z) || z < 50) return false;
		if (hasNearbyMeaningfulContent(el, rect)) return false;
		const parentTag = String(parent.tagName || '').toLowerCase();
		return parentTag === 'body' || parentTag === 'html' || !hasNonClosePayload(parent, el);
	}

	const checkedCleanModals = new WeakSet();
	const checkedCleanCloseBtns = new WeakSet();

	function cleanupOrphanCloseButtons(root) {
		if (isDisabledHere() || isSecurityVerificationPage()) return;
		let nodes = [];
		const query = '[class*="close" i],[id*="close" i],[aria-label*="close" i],[aria-label*="dismiss" i],button,[role="button"]';
		try {
			if (root && root.nodeType === 1 && root.matches && root.matches(query)) nodes.push(root);
			const found = root && root.querySelectorAll ? root.querySelectorAll(query) : D.querySelectorAll(query);
			for (let i = 0; i < found.length; i++) nodes.push(found[i]);
		} catch (e) { return; }
		const limit = Math.min(nodes.length, 200);
		for (let i = 0; i < limit; i++) {
			const el = nodes[i];
			if (!el || !el.parentNode || checkedCleanCloseBtns.has(el)) continue;
			if (!isOrphanCloseButton(el)) {
				checkedCleanCloseBtns.add(el);
				continue;
			}
			const parent = el.parentElement;
			removePairedBackdrops(el);
			if (removeTrackedAdNode(el, 'orphan-close-removed')) pruneAdAncestors(parent);
		}
	}

	function cleanupFloatingAdModals(root) {
		if (isDisabledHere() || isSecurityVerificationPage()) return;
		scanShadowRoots(root || D.documentElement);
		let nodes = [];
		const query = 'dialog,aside,div[style],section[style],div[class*="modal" i],div[class*="overlay" i],div[class*="popup" i],div[class*="sticky" i],div[class*="ad" i],div[id*="ad" i],[data-nvirya-ad-child]';
		try {
			if (root && root.nodeType === 1 && root.matches && root.matches(query)) nodes.push(root);
			const found = root && root.querySelectorAll ? root.querySelectorAll(query) : D.querySelectorAll(query);
			for (let i = 0; i < found.length; i++) nodes.push(found[i]);
		} catch (e) { return; }
		const limit = Math.min(nodes.length, 300);
		for (let i = 0; i < limit; i++) {
			const el = nodes[i];
			if (!el || !el.parentNode) continue;
			if (checkedCleanModals.has(el) && !el.hasAttribute('data-nvirya-ad-child')) continue;
			if (isFloatingAdModal(el)) {
				applyAction(el, 'remove', 'floating-ad-modal');
			} else {
				checkedCleanModals.add(el);
			}
		}
	}

	let overlayCleanupScheduled = false;
	let lastOverlayCleanupTs = 0;
	const overlayCleanupRoots = new Set();

	function scheduleOverlayCleanup(root) {
		if (isYouTubeDomain(hostname) || isSearchEngineDomain(hostname)) return;
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
		const delay = (typeof isActivelyScrolling !== 'undefined' && isActivelyScrolling) ? 280 : Math.max(60, 350 - (Date.now() - lastOverlayCleanupTs));
		setTimeout(() => {
			overlayCleanupScheduled = false;
			lastOverlayCleanupTs = Date.now();
			if (isDisabledHere() || isSearchEngineDomain(hostname)) return;
			const runCleanup = () => {
				try {
					const roots = Array.from(overlayCleanupRoots);
					overlayCleanupRoots.clear();
					if (!roots.length && D.documentElement) roots.push(D.documentElement);
					for (const scope of roots) {
						cleanupFloatingAdModals(scope);
						cleanupOrphanCloseButtons(scope);
						sweepFixedBanners(scope);
					}
				} catch (e) { log('ERROR', 'overlay-cleanup', e && e.message); }
			};
			if (typeof isActivelyScrolling !== 'undefined' && isActivelyScrolling) {
				runIdleTask(() => {
					if (!isActivelyScrolling) runCleanup();
				});
			} else {
				runCleanup();
			}
		}, delay);
	}

	let cosmeticStyleEl = null;

	function installCosmeticCSS() {
		if (!config.cosmeticFiltering) return;
		const customHostRules = [];
		customBlockedSet.forEach(domain => {
			const clean = String(domain || '').replace(/["\\]/g, '');
			if (clean) {
				customHostRules.push(`iframe[src*="${clean}"], img[src*="${clean}"], a[href*="//${clean}"]`);
			}
		});
		const extraSel = customHostRules.length ? ',\n    ' + customHostRules.join(',\n    ') : '';
		const css = `
    [id^="google_ads_"], [id^="aswift_"], [id^="div-gpt-ad"], ins[data-google-query-id], div[id^="google_ads_"][data-google-query-id], div[id^="div-gpt-ad"][data-google-query-id],
    ins.adsbygoogle, .aads-sticky, #aads-close, iframe[data-aa],
    aside.ads, .ads_single_top, .ads_single_center, .ads_header,
    .ads_download_1, .ads_download_2, .ads_download_u_1, .ads_download_u_2, .ads_download_u_3,
    .ad-stack, .pure-u-custom-ad, [data-ad-placeholder],
    .ytp-ad-overlay-container, .ytp-ad-overlay-slot, .ytp-ad-image-overlay,
    #player-ads, #masthead-ad, ytm-companion-slot, ytm-promoted-sparkles-web-renderer,
    [data-ad-slot], [data-ad-client], [data-ad-unit],
    iframe[src*="googlesyndication"], iframe[src*="doubleclick"],
    iframe[src*="adservice.google"], iframe[src*="amazon-adsystem"],
    iframe[src*="a-ads.com"],
    [data-nvirya-hidden]${extraSel} {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    /* Ẩn khối quảng cáo tài trợ trên Google Search */
    div[data-text-ad], #tads, #taw, #bottomads,
    div[aria-label="Ads"], div[aria-label="Sponsored"], div[aria-label="Quảng cáo"],
    .uEierd, .mnr-c[data-hveid] > div > div[data-text-ad] {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      pointer-events: none !important;
    }
    /* Anti-adblock bait auto-heal: maintain dimensions while hidden from user */
    [data-nvirya-bait-heal] {
      clip: rect(0,0,0,0) !important;
      clip-path: inset(50%) !important;
      opacity: 0 !important;
      pointer-events: none !important;
      position: absolute !important;
    }
  `;
		try {
			let style = D.querySelector('style[data-nvirya-cosmetic]');
			if (!style) {
				style = D.createElement('style');
				style.setAttribute('data-nvirya-cosmetic', '');
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
				style.setAttribute('data-nvirya-site-rules', '');
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
		if (isYouTubeDomain(hostname)) {
			const ytPlayer = (video && video.closest && video.closest('#movie_player, .html5-video-player')) ||
				D.querySelector('#movie_player, .html5-video-player');
			return !!(ytPlayer && ytPlayer.classList && (ytPlayer.classList.contains('ad-showing') || ytPlayer.classList.contains('ad-interrupting')));
		}
		let cur = video,
			depth = 0;
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
				playbackRate: Number(video.playbackRate) || 1
			});
			stats.inc('ads');
		}
		try { video.muted = true; } catch (e) {}
		try { video.volume = 0; } catch (e) {}
		try { video.playbackRate = 16; } catch (e) {}
		const duration = Number(video.duration);
		if (isFinite(duration) && duration > 0.5 && video.currentTime < duration - 0.1) {
			const targetTime = Math.max(0, duration - 0.05);
			try { video.currentTime = targetTime; } catch (e) {
				try { if (typeof video.fastSeek === 'function') video.fastSeek(targetTime); } catch (e2) {}
			}
		}
		return true;
	}

	function scheduleVideoAdScan() {
		if (videoScanScheduled || isDisabledHere()) return;
		videoScanScheduled = true;
		const run = function() {
			videoScanScheduled = false;
			if (isDisabledHere() || !D.body) return;
			const now = Date.now();
			if (now - lastVideoScan < 150) {
				if (!videoScanTimer) videoScanTimer = setTimeout(function() {
					videoScanTimer = null;
					scheduleVideoAdScan();
				}, 150);
				return;
			}
			lastVideoScan = now;
			let hasActiveAd = false;
			try {
				const skip = D.querySelectorAll('.ytp-skip-ad-button,.ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-ad-SkipButton,ytm-skip-ad-renderer button,.ytp-ad-overlay-close-button,.videoAdUiSkipButton,[class*="skip-ad" i],[class*="ad-skip" i],[aria-label*="skip ad" i],[data-testid*="skip-ad" i],.jw-skip,.vjs-ad-skip-button,.dplayer-ad-skip,.artplayer-ad-skip');
				for (let i = 0; i < Math.min(skip.length, 30); i++) {
					const button = skip[i];
					if (clickedSkipButtons.has(button) || isNviryaNode(button)) continue;
					const rect = button.getBoundingClientRect();
					const style = W.getComputedStyle(button);
					if (!style || style.display === 'none' || style.visibility === 'hidden' || rect.width < 2 || rect.height < 2) continue;
					if (button.disabled || attr(button, 'aria-disabled') === 'true') continue;
					clickedSkipButtons.add(button);
					try {
						button.click();
						log('INFO', 'video-ad', 'clicked skip-ad control');
					} catch (e) {}
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
				videoScanTimer = setTimeout(function() {
					videoScanTimer = null;
					scheduleVideoAdScan();
				}, 500);
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
			if (!isMaliciousMetaRefresh(meta)) continue;
			const content = attr(meta, 'content') || '';
			try {
				if (!meta.parentNode) continue;
				meta.parentNode.removeChild(meta);
				recordBlocked('redirect', 'meta-refresh', content);
			} catch (e) { log('ERROR', 'meta-refresh', e && e.message); }
		}
	}

	let queueChunkRunning = false;

	function scheduleProcess() {
		if (scheduled || queueChunkRunning) return;
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
		if (queueChunkRunning || pendingQueue.length === 0) return;
		queueChunkRunning = true;
		const batch = pendingQueue.splice(0, pendingQueue.length);
		processInChunks(batch, (el) => {
			if (!el) return;
			pendingSet.delete(el);
			try { inspectAndAct(el); } catch (e) { log('ERROR', 'scan', e && e.message); }
		}, 8, () => {
			queueChunkRunning = false;
			if (pendingQueue.length > 0) scheduleProcess();
		});
	}

	const RE_FAKE_BOT_TEXT = /(?:xác minh bạn không phải|không phải là bot|hãy xác minh|nhấn tiếp tục|bấm tiếp tục|verify you are (?:not a )?(?:bot|human)|human verification|robot check|click allow|nhấn cho phép|press continue|tap continue|robot verification|chú ý\s*:.*tiếp tục)/i;
	const LEGIT_CAPTCHA_SELECTOR = 'iframe[src*="challenges.cloudflare.com"], iframe[src*="google.com/recaptcha"], iframe[src*="recaptcha.net"], iframe[src*="hcaptcha.com"], .cf-turnstile, .g-recaptcha, .h-captcha, [data-sitekey], [data-nvirya-safe="captcha"], input[name="cf-turnstile-response"], input[name="g-recaptcha-response"], input[name="h-captcha-response"], #challenge-running, #challenge-stage, #challenge-form, #cf-wrapper';

	function hasLegitCaptchaIframe(rootNode) {
		if (!rootNode) return false;
		if (isSecurityVerificationPage() || isCaptchaOrTurnstileElement(rootNode)) return true;
		if (!rootNode.querySelector) return false;
		try {
			return !!rootNode.querySelector(LEGIT_CAPTCHA_SELECTOR);
		} catch (e) {
			return false;
		}
	}

	function isFakeBotVerificationModal(el) {
		if (!el || el.nodeType !== 1 || isNviryaNode(el) || isProtectedPlayer(el)) return false;
		const tag = String(el.tagName || '').toLowerCase();
		if (tag === 'html' || tag === 'body' || tag === 'main') return false;
		let cs;
		try { cs = W.getComputedStyle(el); } catch (e) { return false; }
		if (!cs || (cs.position !== 'fixed' && cs.position !== 'absolute')) return false;
		const z = parseInt(cs.zIndex, 10);
		if (!isFinite(z) || z <= 999) return false;
		if (hasLegitCaptchaIframe(el)) return false;

		const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
		if (text && text.length <= 600 && RE_FAKE_BOT_TEXT.test(text)) {
			return true;
		}
		const sr = el.shadowRoot || el.__nvirya_sr;
		if (sr && !hasLegitCaptchaIframe(sr)) {
			const shadowText = String(sr.textContent || '').replace(/\s+/g, ' ').trim();
			if (shadowText && shadowText.length <= 600 && RE_FAKE_BOT_TEXT.test(shadowText)) {
				return true;
			}
		}
		return false;
	}

	function isShadowDomAdHost(el) {
		if (!el || el.nodeType !== 1 || isNviryaNode(el)) return false;
		const sr = el.shadowRoot || el.__nvirya_sr;
		if (!sr) return false;
		if (attr(el, 'data-nvirya-ui') !== null || isProtectedPlayer(el)) return false;
		if (hasLegitCaptchaIframe(sr)) return false;
		try {
			const srText = String(sr.textContent || '').replace(/\s+/g, ' ').trim();
			if (srText && srText.length <= 600 && RE_FAKE_BOT_TEXT.test(srText)) return true;

			const links = sr.querySelectorAll ? sr.querySelectorAll('a[href], iframe[src], script[src]') : [];
			for (let i = 0; i < Math.min(links.length, 15); i++) {
				const raw = attr(links[i], 'href') || attr(links[i], 'src') || '';
				const u = safeUrl(raw);
				if (u && isAdUrl(u)) return true;
			}

			const styles = sr.querySelectorAll ? sr.querySelectorAll('style') : [];
			for (let i = 0; i < styles.length; i++) {
				const cssText = styles[i].textContent || '';
				if (/position\s*:\s*fixed/i.test(cssText) && /z-index\s*:\s*214748\d{4}/i.test(cssText) && srText.length < 300) {
					return true;
				}
			}
		} catch (e) {}
		return false;
	}

	function scanShadowRoots(root) {
		if (!root || isDisabledHere()) return;
		try {
			if (root.nodeType === 1 && root.shadowRoot && isShadowDomAdHost(root)) {
				applyAction(root, 'remove', 'shadow-dom-ad-host');
				return;
			}
			const candidates = root.querySelectorAll ? root.querySelectorAll('div, section, aside, body > *') : [];
			const lim = Math.min(candidates.length, 150);
			for (let i = 0; i < lim; i++) {
				const el = candidates[i];
				if (!el || isNviryaNode(el)) continue;
				if (el.shadowRoot && isShadowDomAdHost(el)) {
					applyAction(el, 'remove', 'shadow-dom-ad-host');
				} else if (isFakeBotVerificationModal(el)) {
					applyAction(el, 'remove', 'fake-bot-overlay');
				}
			}
		} catch (e) {}
	}

	function guardMaxZIndexNode(el) {
		if (!el || el.nodeType !== 1 || isNviryaNode(el) || isProtectedPlayer(el) || isLegitimateMediaPreview(el)) return;
		const tag = String(el.tagName || '').toLowerCase();
		if (tag === 'html' || tag === 'body' || tag === 'head' || tag === 'script' || tag === 'style') return;
		try {
			if (isFakeBotVerificationModal(el) || isShadowDomAdHost(el)) {
				applyAction(el, 'remove', 'max-zindex-ad-overlay');
				return;
			}
			if (isFloatingAdModal(el) || isInvisibleTrap(el)) {
				const idc = ((el.id || '') + ' ' + classString(el)).trim();
				const hasAdLink = el.querySelector && (el.querySelector('iframe[src*="ad"], ins.adsbygoogle, a[href*="click.php"]') || isResponsiveAdContainer(el));
				const isCrossAd = el.querySelector && el.querySelector('a[href]') && isAdUrl(safeUrl(el.querySelector('a[href]').href));
				if (RE_AD_TOKEN.test(idc) || hasAdLink || isCrossAd || isInvisibleTrap(el)) {
					applyAction(el, 'remove', 'max-zindex-ad-overlay');
					sweepOrphanedBackdrops();
					return;
				}
			}
			const cs = W.getComputedStyle(el);
			const z = cs ? parseInt(cs.zIndex, 10) : NaN;
			if (isFinite(z) && z >= 2147483000) {
				el.style.setProperty('z-index', '2147482000', 'important');
			}
		} catch (e) {}
	}

	function ensureNviryaHostLast() {
		try {
			const uiHost = D.querySelector('[data-nvirya-ui]');
			if (!uiHost) return;
			const parent = D.documentElement || D.body;
			if (parent && uiHost.parentNode === parent && parent.lastElementChild !== uiHost) {
				parent.appendChild(uiHost);
			}
		} catch (e) {}
	}

	function inspectAndAct(el) {
		if (!el || el.nodeType !== 1) return;
		if (isDisabledHere() || isYouTubeDomain(hostname)) return;
		if (isNviryaNode(el)) return;
		if (el.hasAttribute && el.hasAttribute('data-nvirya-hidden')) return;

		const tag = (el.tagName || '').toLowerCase();
		if (tag === 'script') {
			neutralizeScriptNode(el);
			return;
		}

		if (el.shadowRoot && isShadowDomAdHost(el)) {
			applyAction(el, 'remove', 'shadow-dom-ad-host');
			return;
		}

		if (isFakeBotVerificationModal(el)) {
			applyAction(el, 'remove', 'fake-bot-overlay');
			return;
		}

		if (config.antiAdblock && AntiAdblockEngine.inspectCandidate(el)) {
			return;
		}

		guardMaxZIndexNode(el);

		if (!CANDIDATE_TAGS.has(tag) && !tag.includes('-')) return;

		if ((tag === 'div' || tag === 'section' || tag === 'dialog' || tag === 'aside') && isFloatingAdModal(el)) {
			applyAction(el, 'remove', 'floating-ad-modal');
			return;
		}

		const decision = inspectNode(el);
		if (decision.action !== 'ignore') {
			applyAction(el, decision.action, decision.reason);
			return;
		}

		if (tag === 'div' || tag === 'section' || tag === 'aside' || tag === 'iframe') {
			if (isSuspiciousOverlay(el)) applyAction(el, 'remove', 'suspicious-overlay');
		}
	}

	const batchedEnqueueSet = new Set();
	let batchEnqueueScheduled = false;
	let searchEnqueueTimer = null;
	const isSearchEngineHost = isSearchEngineDomain(hostname);

	let isActivelyScrolling = false;
	let lastScrollTop = 0;
	let lastScrollTs = 0;
	let scrollVelocity = 0;
	let scrollIdleTimer = null;

	function onGlobalScroll() {
		if (typeof runIdleTask !== 'function') {
			const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : null));
			if (g) g.runIdleTask = (fn, timeout = 2000) => (typeof W.requestIdleCallback === 'function' ? W.requestIdleCallback(fn, { timeout: timeout || 2500 }) : setTimeout(fn, timeout));
		}
		const now = Date.now();
		const currentY = W.pageYOffset || (D.documentElement && D.documentElement.scrollTop) || (D.body && D.body.scrollTop) || 0;
		const dt = now - lastScrollTs;
		if (dt > 0 && lastScrollTs > 0) {
			scrollVelocity = Math.abs(currentY - lastScrollTop) / dt;
		}
		lastScrollTop = currentY;
		lastScrollTs = now;
		isActivelyScrolling = true;

		if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
		scrollIdleTimer = setTimeout(() => {
			isActivelyScrolling = false;
			scrollVelocity = 0;
			runIdleTask(() => {
				if (!isActivelyScrolling && pendingQueue.length > 0) {
					scheduleProcess();
				}
			}, 300);
		}, 180);
	}
	try {
		W.addEventListener('scroll', onGlobalScroll, { passive: true, capture: true });
	} catch (e) {}

	function flushBatchedEnqueue() {
		batchEnqueueScheduled = false;
		searchEnqueueTimer = null;
		if (!batchedEnqueueSet.size) return;
		batchedEnqueueSet.forEach((el) => {
			if (!el || el.nodeType !== 1 || pendingSet.has(el)) return;
			if (pendingQueue.length >= MAX_QUEUE) pendingQueue.shift();
			pendingSet.add(el);
			pendingQueue.push(el);
		});
		batchedEnqueueSet.clear();
		scheduleProcess();
	}

	function enqueue(el) {
		if (!el || el.nodeType !== 1 || pendingSet.has(el)) return;
		if (isSearchEngineHost && (attr(el, 'jsaction') !== null || attr(el, 'data-ved') !== null || attr(el, 'jscontroller') !== null)) {
			return;
		}
		batchedEnqueueSet.add(el);
		if (isSearchEngineHost) {
			if (searchEnqueueTimer) clearTimeout(searchEnqueueTimer);
			searchEnqueueTimer = setTimeout(flushBatchedEnqueue, 150);
			return;
		}
		if (isActivelyScrolling) {
			if (!batchEnqueueScheduled) {
				batchEnqueueScheduled = true;
				runIdleTask(() => {
					batchEnqueueScheduled = false;
					flushBatchedEnqueue();
				});
			}
			return;
		}
		if (!batchEnqueueScheduled) {
			batchEnqueueScheduled = true;
			if (typeof W.requestAnimationFrame === 'function') W.requestAnimationFrame(flushBatchedEnqueue);
			else setTimeout(flushBatchedEnqueue, 16);
		}
	}

	function startObserver() {
		if (observer) return;
		const target = D.documentElement || D;
		if (!target) return;
		const isYT = isYouTubeDomain(hostname);
		const pendingMutationRecords = [];
		let mutationBatchScheduled = false;
		let searchMutationDebounceTimer = null;

		const processMutationBatch = () => {
			mutationBatchScheduled = false;
			searchMutationDebounceTimer = null;
			if (isDisabledHere() || !pendingMutationRecords.length) {
				pendingMutationRecords.length = 0;
				return;
			}
			const mutations = pendingMutationRecords.splice(0, pendingMutationRecords.length);

			if (isYT) {
				let shouldScanVideo = false;
				for (let i = 0; i < mutations.length; i++) {
					const m = mutations[i];
					if (m.type === 'attributes') {
						const tNode = m.target;
						if (tNode && tNode.classList && (tNode.classList.contains('ad-showing') || tNode.classList.contains('ad-interrupting') || tNode.id === 'movie_player')) {
							shouldScanVideo = true;
							break;
						}
					} else if (m.addedNodes && m.addedNodes.length) {
						for (let j = 0; j < m.addedNodes.length; j++) {
							const n = m.addedNodes[j];
							if (n && n.nodeType === 1) {
								const tag = String(n.tagName || '').toLowerCase();
								if (tag === 'video' || tag.indexOf('ad') !== -1 || tag.indexOf('skip') !== -1 || (n.classList && n.classList.contains('ytp-ad-module'))) {
									shouldScanVideo = true;
									break;
								}
							}
						}
						if (shouldScanVideo) break;
					}
				}
				if (shouldScanVideo) scheduleVideoAdScan();
				return;
			}

			if (isSecurityVerificationPage()) return;

			let hasMutations = false;
			let rootChildAdded = false;
			for (let i = 0; i < mutations.length; i++) {
				const m = mutations[i];
				if (m.type === 'childList') {
					for (let j = 0; j < m.addedNodes.length; j++) {
						const n = m.addedNodes[j];
						if (n.nodeType === 1) {
							if (n.namespaceURI === 'http://www.w3.org/2000/svg' || isNviryaNode(n)) continue;
							if (isSearchEngineHost && (attr(n, 'jsaction') !== null || attr(n, 'data-ved') !== null || attr(n, 'jscontroller') !== null)) {
								continue;
							}
							const nTag = String(n.tagName || '').toLowerCase();
							if (nTag === 'script') {
								if (neutralizeScriptNode(n)) continue;
							}
							if (nTag === 'html' || nTag === 'body') captureScrollBaseline(n);
							if (m.target === D.documentElement || m.target === D.body) {
								rootChildAdded = true;
								guardMaxZIndexNode(n);
							}
							if (nTag === 'meta' || n.firstElementChild) {
								neutralizeMetaRefresh(n);
							}
							queueTrapNode(n, false);
							enqueue(n);
							if (n.firstElementChild && n.querySelectorAll) {
								try {
									scanShadowRoots(n);
									const scripts = n.querySelectorAll('script');
									for (let s = 0; s < scripts.length; s++) neutralizeScriptNode(scripts[s]);
									const candidates = n.querySelectorAll(TARGETED_CANDIDATE_SELECTOR);
									const lim = Math.min(candidates.length, 24);
									for (let k = 0; k < lim; k++) enqueue(candidates[k]);
								} catch (err) {}
							}
							hasMutations = true;
						}
					}
				} else if (m.type === 'attributes') {
					const targetNode = m.target;
					if (targetNode && targetNode.nodeType === 1 && targetNode.namespaceURI !== 'http://www.w3.org/2000/svg' && !isNviryaNode(targetNode)) {
						if (isSearchEngineHost && (attr(targetNode, 'jsaction') !== null || attr(targetNode, 'data-ved') !== null || attr(targetNode, 'jscontroller') !== null)) {
							continue;
						}
						checkedCleanModals.delete(targetNode);
						if (!isSearchEngineHost && !isSecurityVerificationPage() && (stats.session.hidden > 0 || stats.session.removed > 0 || stats.antiAdblock.session.recoveries > 0) && (targetNode === D.documentElement || targetNode === D.body) && (m.attributeName === 'style' || m.attributeName === 'class')) {
							try {
								const cs = W.getComputedStyle(targetNode);
								if (cs && (cs.overflow === 'hidden' || cs.overflowY === 'hidden' || cs.overflow === 'clip' || cs.overflowY === 'clip' || cs.position === 'fixed')) {
									unlockPageScroll();
									scheduleUnlockPageScroll();
								}
							} catch (err) {}
						}
						guardMaxZIndexNode(targetNode);
						queueTrapNode(targetNode, false);
						enqueue(targetNode);
						hasMutations = true;
					}
				}
			}
			if (rootChildAdded) ensureNviryaHostLast();
			if (hasMutations) {
				scheduleOverlayCleanup();
				scheduleVideoAdScan();
			}
		};

		try {
			observer = new MutationObserver((mutations) => {
				if (isDisabledHere()) return;
				for (let i = 0; i < mutations.length; i++) {
					if (pendingMutationRecords.length < 1200) {
						pendingMutationRecords.push(mutations[i]);
					}
				}
				if (isSearchEngineHost) {
					if (searchMutationDebounceTimer) clearTimeout(searchMutationDebounceTimer);
					searchMutationDebounceTimer = setTimeout(processMutationBatch, 150);
				} else if (isActivelyScrolling) {
					if (!mutationBatchScheduled) {
						mutationBatchScheduled = true;
						runIdleTask(() => {
							mutationBatchScheduled = false;
							processMutationBatch();
						});
					}
				} else if (!mutationBatchScheduled) {
					mutationBatchScheduled = true;
					if (typeof W.requestAnimationFrame === 'function') {
						W.requestAnimationFrame(processMutationBatch);
					} else {
						setTimeout(processMutationBatch, 16);
					}
				}
			});
			observer.observe(target, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: isYT ? ['class', 'src'] : ['src', 'href', 'style', 'class', 'id', 'data-src', 'data-srcset']
			});
			if (D.documentElement) {
				captureScrollBaseline(D.documentElement);
				neutralizeMetaRefresh(D.documentElement);
				queueTrapNode(D.documentElement, true);
			}
			if (D.body) captureScrollBaseline(D.body);
		} catch (e) {
			observer = null;
		}
	}

	function initialScan() {
		const root = D.body || D.documentElement;
		if (!root || isDisabledHere()) return;
		removeMetaRefresh(root);
		scheduleOverlayCleanup(root);
		queueTrapNode(root, true);
		scheduleVideoAdScan();
		let candidates = [];
		try {
			candidates = root.querySelectorAll ? Array.from(root.querySelectorAll(TARGETED_CANDIDATE_SELECTOR)) : [];
		} catch (e) {}
		if (candidates.length > 0) {
			processInChunks(candidates, (el) => {
				if (!el || !el.isConnected) return;
				queueTrapNode(el, false);
				enqueue(el);
			}, 8);
		}
	}

	function installSPAHooks() {
		try {
			const h = W.history;
			if (h && !h.__nvirya) {
				['pushState', 'replaceState'].forEach(k => {
					const orig = h[k];
					if (typeof orig !== 'function') return;
					h[k] = function() {
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

	const AntiAdblockEngine = (() => {
		const CONFIDENCE_THRESHOLD = 65;
		const MAX_RETRIES_PER_SIG = 5;
		const RETRY_WINDOW_MS = 30000;
		const RETRY_DELAYS = [140, 320, 750, 1600, 3000];

		const RE_STRONG_ADB_TEXT = /(?:ad[-\s]?blocker\s+detected|adblock(?:er)?\s+detected|disable\s+(?:your\s+)?ad[-\s]?blocker|turn\s+off\s+(?:your\s+)?ad[-\s]?blocker|allow\s+ads\s+on\s+this\s+site|whitelist\s+(?:us|this\s+site)|it\s+looks\s+like\s+you(?:'re|\s+are)\s+using\s+an?\s+ad[-\s]?blocker|we\s+noticed\s+you(?:'re|\s+are)\s+using\s+an?\s+ad[-\s]?blocker|please\s+disable\s+(?:your\s+)?ad[-\s]?blocker|ad[-\s]?blocker\s+is\s+(?:enabled|active|on)|continue\s+without\s+disabling|vui\s+lòng\s+tắt\s+trình\s+chặn\s+quảng\s+cáo|phát\s+hiện\s+trình\s+chặn\s+quảng\s+cáo)/i;
		const RE_ACTION_CTA_TEXT = /(?:i(?:'ve|\s+have)\s+disabled\s+(?:my\s+)?ad[-\s]?blocker|allowlist\s+us|refresh\s+page|reload\s+page|verify\s+you\s+disabled|tiếp\s+tục|tôi\s+đã\s+tắt)/i;
		const RE_KNOWN_ADB_MARKER = /(?:^|[^a-z0-9])(?:fc-ab-root|fc-dialog-container|fc-whitelist-dialog|adblock[-_]?(?:modal|overlay|wrapper|popup|notice|wall|warning|detect|detector|mask|root|box|gate)|anti[-_]?adblock|admiral[-_]?modal|blockadblock|fuckadblock|ab-iam-root|adb[-_]?modal|adblocker[-_]?modal)(?=[^a-z0-9]|$)/i;
		const RE_WRAPPER_HINT = /(?:modal|overlay|backdrop|popup|dialog|adblock|fc-ab|tp-modal|portal|wrapper|mask|curtain|scrim|fixed|layer|wall|gate)/i;
		const RE_COOKIE_CMP = /(?:\bcookie(?:s)?\b|\bgdpr\b|\bccpa\b|\bconsent\b|onetrust|cookiebot|trustarc|didomi|accept\s+all\s+cookies|manage\s+(?:cookie\s+)?preferences|privacy\s+preferences|we\s+use\s+cookies)/i;
		const RE_AUTH_PAYWALL = /(?:\bsign\s*in\b|\blog\s*in\b|create\s+an?\s+account|forgot\s+password|enter\s+your\s+(?:email|password)|subscription\s+required|subscribe\s+to\s+continue|already\s+a\s+subscriber)/i;
		const SCROLL_LOCK_CLASSES = ['no-scroll', 'noscroll', 'modal-open', 'overflow-hidden', 'lock-scroll', 'adblock-modal-open', 'fc-ab-lock', 'body-lock'];

		const recoveredSet = new WeakSet();
		const inspectedSignatureByNode = new WeakMap();
		const signatureHistory = new Map(); // sig -> { count, retryCount, firstSeen, lastSeen, timerId }
		const recoveryRecords = []; // { target, wrapper, backdrops, hiddenAttr, inlineSnapshot, reason, category, score }
		const cssStyleSnapshots = new Map(); // el -> { props: { [prop]: { val, pri } }, removedClasses: [] }
		let debounceTimer = null;
		let pendingScanNodes = new Set();
		let fallbackTimers = [];

		const SITE_ADAPTERS = [{
				name: 'business-standard',
				matchHost: (h) => /(?:^|\.)business-standard\.com$/i.test(h),
				confidenceThreshold: 55,
				detector: (doc) => {
					const found = [];
					const candidates = doc.querySelectorAll(
						'[class*="adblock" i],[id*="adblock" i],[class*="modal" i],[class*="overlay" i],div[style*="fixed"]'
					);
					for (let i = 0; i < Math.min(candidates.length, 40); i++) {
						const n = candidates[i];
						const txt = normalizeText(n);
						if (RE_STRONG_ADB_TEXT.test(txt)) found.push(n);
					}
					return found;
				},
				maxRetries: 5
			},
			{
				name: 'google-funding-choices',
				matchHost: () => true,
				confidenceThreshold: 60,
				detector: (doc) => {
					const found = [];
					const fcNodes = doc.querySelectorAll('.fc-ab-root, .fc-dialog-container, .fc-whitelist-dialog');
					for (let i = 0; i < fcNodes.length; i++) found.push(fcNodes[i]);
					return found;
				},
				maxRetries: 4
			}
		];

		function isEngineActive() {
			return Boolean(config && config.enabled && config.antiAdblock && !isDisabledHere());
		}

		function normalizeText(el) {
			if (!el) return '';
			try {
				return String(el.textContent || '').replace(/\s+/g, ' ').trim();
			} catch (e) {
				return '';
			}
		}

		function computeNodeSignature(el, normTxt) {
			if (!el || el.nodeType !== 1) return 'unknown';
			const tag = String(el.tagName || '').toLowerCase();
			const id = el.id || '';
			const cls = classString(el).split(/\s+/).filter(Boolean).slice(0, 3).join('.');
			const snippet = String(normTxt || '').slice(0, 80).toLowerCase();
			return `${tag}#${id}.${cls}:${snippet}`;
		}

		function isPrimaryContentContainer(el) {
			if (!el || el.nodeType !== 1) return true;
			const tag = String(el.tagName || '').toLowerCase();
			if (/^(?:html|body|main|article|header|footer|nav|script|style|noscript|video|audio)$/.test(tag)) return true;
			const id = (el.id || '').toLowerCase();
			if (id === '__next' || id === 'root' || id === 'app' || id === '___gatsby' || id === 'main' || id === 'content') return true;
			try {
				if (el.querySelector && el.querySelector('main, article')) return true;
			} catch (e) {}
			return false;
		}

		function getOverlayPositioning(el) {
			let cur = el;
			let depth = 0;
			const vw = W.innerWidth || (D.documentElement && D.documentElement.clientWidth) || 1024;
			const vh = W.innerHeight || (D.documentElement && D.documentElement.clientHeight) || 768;
			let best = { positioned: false, position: 'static', zIndex: 0, coversViewport: false, isCenteredModal: false, rect: null };

			while (cur && cur.nodeType === 1 && depth < 5) {
				const tag = String(cur.tagName || '').toLowerCase();
				if (tag === 'body' || tag === 'html') break;
				try {
					const cs = W.getComputedStyle(cur);
					const rect = cur.getBoundingClientRect ? cur.getBoundingClientRect() : { width: 0, height: 0, left: 0, top: 0 };
					if (depth === 0) best.rect = rect;
					if (cs && (cs.position === 'fixed' || cs.position === 'absolute' || tag === 'dialog' || attr(cur, 'role') === 'dialog' || attr(cur, 'aria-modal') === 'true')) {
						const z = parseInt(cs.zIndex, 10);
						const zVal = isFinite(z) ? z : 0;
						const w = Number(rect.width) || cur.offsetWidth || 0;
						const h = Number(rect.height) || cur.offsetHeight || 0;
						const areaRatio = (vw > 0 && vh > 0) ? ((w * h) / (vw * vh)) : 0;
						const covers = areaRatio >= 0.22 || (w >= vw * 0.85 && h >= vh * 0.85);
						const centered = w >= 220 && h >= 100 && w <= vw * 1.05;
						best.positioned = true;
						best.position = cs.position;
						if (zVal > best.zIndex) best.zIndex = zVal;
						if (covers) best.coversViewport = true;
						if (centered) best.isCenteredModal = true;
					}
				} catch (e) {}
				cur = cur.parentElement;
				depth++;
			}
			return best;
		}

		function hasPageScrollLockIndicator() {
			try {
				for (const rootNode of [D.documentElement, D.body]) {
					if (!rootNode) continue;
					const cs = W.getComputedStyle(rootNode);
					if (cs && (cs.overflow === 'hidden' || cs.overflowY === 'hidden' || cs.overflow === 'clip' || cs.overflowY === 'clip' || cs.position === 'fixed')) {
						return true;
					}
					if (rootNode.classList) {
						for (let i = 0; i < SCROLL_LOCK_CLASSES.length; i++) {
							if (rootNode.classList.contains(SCROLL_LOCK_CLASSES[i])) return true;
						}
					}
				}
			} catch (e) {}
			return false;
		}

		function classifyNode(el) {
			const result = { confirmed: false, score: 0, category: 'none', reasons: [], signals: {} };
			if (!el || el.nodeType !== 1 || !el.isConnected) return result;
			if (isNviryaNode(el) || isProtectedPlayer(el) || hasProtectedPlayerContent(el)) {
				result.category = 'protected';
				return result;
			}
			if (isPrimaryContentContainer(el)) {
				result.category = 'page-content';
				return result;
			}

			let cs;
			try {
				cs = W.getComputedStyle(el);
				if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return result;
			} catch (e) { return result; }

			const idc = ((el.id || '') + ' ' + classString(el) + ' ' + (attr(el, 'data-testid') || '')).trim();
			const normTxt = normalizeText(el);
			if (normTxt.length > 2200) {
				result.category = 'page-content';
				return result;
			}

			const hasStrongAdbText = normTxt.length >= 12 && RE_STRONG_ADB_TEXT.test(normTxt);
			const hasActionCta = normTxt.length >= 12 && RE_ACTION_CTA_TEXT.test(normTxt);
			const hasKnownMarker = Boolean(idc && (RE_KNOWN_ADB_MARKER.test(idc) || RE_ANTIADB.test(idc)));

			if (!hasStrongAdbText && !hasKnownMarker && (RE_COOKIE_CMP.test(idc) || RE_COOKIE_CMP.test(normTxt))) {
				result.category = 'cookie-consent';
				result.reasons.push('cmp-cookie-consent');
				return result;
			}

			if (hasFormControls(el) || (!hasStrongAdbText && RE_AUTH_PAYWALL.test(normTxt))) {
				result.category = 'auth-or-paywall';
				result.reasons.push('form-or-auth-paywall');
				return result;
			}

			const posInfo = getOverlayPositioning(el);
			let score = 0;

			if (hasStrongAdbText) {
				score += 45;
				result.reasons.push('explicit-anti-adblock-text');
			}
			if (hasActionCta && (hasStrongAdbText || hasKnownMarker)) {
				score += 15;
				result.reasons.push('anti-adblock-cta');
			}
			if (hasKnownMarker) {
				score += 35;
				result.reasons.push('known-anti-adblock-marker');
			}
			if (posInfo.positioned) {
				score += 20;
				result.reasons.push('overlay-positioned');
			}
			if (posInfo.zIndex >= 99) {
				score += 15;
				result.reasons.push('high-z-index');
			}
			if (posInfo.coversViewport || posInfo.isCenteredModal) {
				score += 15;
				result.reasons.push('modal-geometry');
			}
			if (hasPageScrollLockIndicator() && (hasStrongAdbText || hasKnownMarker)) {
				score += 15;
				result.reasons.push('scroll-lock-correlated');
			}

			result.score = score;
			result.signals = { hasStrongAdbText, hasKnownMarker, posInfo };

			const hasAntiAdbIndicator = hasStrongAdbText || hasKnownMarker;
			const hasObstructionIndicator = posInfo.positioned || hasKnownMarker;

			if (hasAntiAdbIndicator && hasObstructionIndicator && score >= CONFIDENCE_THRESHOLD) {
				result.confirmed = true;
				result.category = hasKnownMarker && !hasStrongAdbText ? 'marker-overlay' : 'anti-adblock-modal';
			} else {
				result.category = hasAntiAdbIndicator ? 'inline-mention-only' : 'ordinary-ui';
			}

			return result;
		}

		function resolveObstructionRoot(modalEl) {
			let bestRoot = modalEl;
			let cur = modalEl && modalEl.parentElement;
			let depth = 0;
			const vw = W.innerWidth || (D.documentElement && D.documentElement.clientWidth) || 1024;
			const vh = W.innerHeight || (D.documentElement && D.documentElement.clientHeight) || 768;

			while (cur && cur.nodeType === 1 && depth < 6) {
				if (isPrimaryContentContainer(cur) || isNviryaNode(cur) || hasFormControls(cur) || hasProtectedPlayerContent(cur)) {
					break;
				}
				const outsideText = meaningfulText(cur, bestRoot);
				if (outsideText.length > 35) {
					break;
				}

				let isWrapperCandidate = false;
				try {
					const cs = W.getComputedStyle(cur);
					const idc = ((cur.id || '') + ' ' + classString(cur) + ' ' + (attr(cur, 'role') || '')).trim();
					const rect = cur.getBoundingClientRect ? cur.getBoundingClientRect() : { width: 0, height: 0 };
					const w = Number(rect.width) || cur.offsetWidth || 0;
					const h = Number(rect.height) || cur.offsetHeight || 0;

					if (cs && (cs.position === 'fixed' || cs.position === 'absolute')) {
						isWrapperCandidate = true;
					} else if (RE_WRAPPER_HINT.test(idc)) {
						isWrapperCandidate = true;
					} else if (cur.parentElement === D.body && outsideText.length === 0) {
						isWrapperCandidate = true;
					} else if (w >= vw * 0.8 && h >= vh * 0.8 && outsideText.length === 0) {
						isWrapperCandidate = true;
					}
				} catch (e) {}

				if (isWrapperCandidate) {
					bestRoot = cur;
					cur = cur.parentElement;
					depth++;
				} else {
					break;
				}
			}
			return bestRoot;
		}

		function findAssociatedBackdrops(rootObstruction, innerModal) {
			const backdrops = [];
			const seen = new Set([rootObstruction, innerModal]);
			const addIfBackdrop = (node) => {
				if (!node || node.nodeType !== 1 || seen.has(node) || isNviryaNode(node) || isPrimaryContentContainer(node)) return;
				if (hasFormControls(node) || hasProtectedPlayerContent(node)) return;
				if (meaningfulText(node).length > 8) return;
				if (isBackdropFor(node, rootObstruction) || isBackdropFor(node, innerModal)) {
					seen.add(node);
					backdrops.push(node);
					return;
				}
				const idc = ((node.id || '') + ' ' + classString(node)).trim();
				if (/(?:^|[^a-z])(?:modal[-_]?backdrop|tp[-_]?backdrop|fc[-_]?dialog[-_]?overlay|adblock[-_]?backdrop|overlay[-_]?backdrop|scrim)(?:[^a-z]|$)/i.test(idc)) {
					try {
						const cs = W.getComputedStyle(node);
						if (cs && (cs.position === 'fixed' || cs.position === 'absolute')) {
							seen.add(node);
							backdrops.push(node);
						}
					} catch (e) {}
				}
			};

			if (rootObstruction && rootObstruction.parentElement) {
				const siblings = rootObstruction.parentElement.children || [];
				for (let i = 0; i < siblings.length; i++) addIfBackdrop(siblings[i]);
			}
			if (D.body && D.body.children) {
				for (let i = 0; i < D.body.children.length; i++) addIfBackdrop(D.body.children[i]);
			}
			return backdrops;
		}

		function saveStylePropSnapshot(el, prop) {
			if (!el || !el.style) return;
			let rec = cssStyleSnapshots.get(el);
			if (!rec) {
				rec = { props: {}, removedClasses: [] };
				cssStyleSnapshots.set(el, rec);
			}
			if (!Object.prototype.hasOwnProperty.call(rec.props, prop)) {
				rec.props[prop] = {
					val: el.style.getPropertyValue(prop),
					pri: el.style.getPropertyPriority(prop)
				};
			}
		}

		function applyScopedStyleFix(el, prop, val, pri = 'important') {
			if (!el || !el.style) return;
			saveStylePropSnapshot(el, prop);
			try { el.style.setProperty(prop, val, pri); } catch (e) {}
		}

		function recoverPageInteractionRestrictions() {
			if (hasVisibleLegitimateModal()) return;
			for (const rootNode of [D.documentElement, D.body]) {
				if (!rootNode) continue;
				try {
					const cs = W.getComputedStyle(rootNode);
					if (cs) {
						if (cs.overflow === 'hidden' || cs.overflow === 'clip') {
							applyScopedStyleFix(rootNode, 'overflow', 'auto');
						}
						if (cs.overflowY === 'hidden' || cs.overflowY === 'clip') {
							applyScopedStyleFix(rootNode, 'overflow-y', 'auto');
						}
						if (cs.position === 'fixed') {
							applyScopedStyleFix(rootNode, 'position', 'static');
						}
						if (cs.pointerEvents === 'none') {
							applyScopedStyleFix(rootNode, 'pointer-events', 'auto');
						}
					}
					if (rootNode.classList) {
						let rec = cssStyleSnapshots.get(rootNode);
						if (!rec) {
							rec = { props: {}, removedClasses: [] };
							cssStyleSnapshots.set(rootNode, rec);
						}
						for (let i = 0; i < SCROLL_LOCK_CLASSES.length; i++) {
							const cls = SCROLL_LOCK_CLASSES[i];
							if (rootNode.classList.contains(cls)) {
								rootNode.classList.remove(cls);
								if (rec.removedClasses.indexOf(cls) === -1) rec.removedClasses.push(cls);
							}
						}
					}
				} catch (e) {}
			}

			try {
				const contentContainers = D.querySelectorAll('main, article, #__next, #root, #app, body > div:not([data-nvirya-ui]):not([data-nvirya-hidden])');
				for (let i = 0; i < Math.min(contentContainers.length, 16); i++) {
					const c = contentContainers[i];
					if (!c || c.hasAttribute('data-nvirya-hidden')) continue;
					const cs = W.getComputedStyle(c);
					if (!cs) continue;
					if (/blur\(/i.test(cs.filter || '') || /blur\(/i.test(c.style.filter || '')) {
						applyScopedStyleFix(c, 'filter', 'none');
					}
					if (cs.pointerEvents === 'none' && meaningfulText(c).length > 200) {
						applyScopedStyleFix(c, 'pointer-events', 'auto');
					}
					if (cs.userSelect === 'none' && meaningfulText(c).length > 200) {
						applyScopedStyleFix(c, 'user-select', 'auto');
					}
				}
			} catch (e) {}

			scheduleUnlockPageScroll();
		}

		function hideObstructionNodeReversibly(node, reason) {
			if (!node || node.nodeType !== 1) return null;
			const snap = {
				node,
				prevHiddenAttr: node.getAttribute('data-nvirya-hidden'),
				prevDisplay: node.style ? node.style.getPropertyValue('display') : '',
				prevDisplayPri: node.style ? node.style.getPropertyPriority('display') : '',
				prevVis: node.style ? node.style.getPropertyValue('visibility') : '',
				prevVisPri: node.style ? node.style.getPropertyPriority('visibility') : '',
				prevPe: node.style ? node.style.getPropertyValue('pointer-events') : '',
				prevPePri: node.style ? node.style.getPropertyPriority('pointer-events') : ''
			};
			try {
				node.setAttribute('data-nvirya-hidden', reason || 'anti-adblock');
				if (node.style) {
					node.style.setProperty('display', 'none', 'important');
					node.style.setProperty('visibility', 'hidden', 'important');
					node.style.setProperty('pointer-events', 'none', 'important');
				}
				state.hiddenNodes.add(node);
			} catch (e) {}
			return snap;
		}

		function hasRecoveredAncestor(node) {
			let cur = node && node.parentElement;
			while (cur && cur.nodeType === 1) {
				if (recoveredSet.has(cur) || cur.hasAttribute('data-nvirya-hidden')) return true;
				cur = cur.parentElement;
			}
			return false;
		}

		function resolveInnerModal(el, normTxt) {
			let cur = el;
			let depth = 0;
			while (cur && cur.children && cur.children.length === 1 && depth < 4) {
				const child = cur.children[0];
				if (!child || child.nodeType !== 1) break;
				const childTag = String(child.tagName || '').toLowerCase();
				if (!/^(?:div|section|dialog|aside)$/.test(childTag)) break;
				if (normalizeText(child) !== normTxt) break;
				cur = child;
				depth++;
			}
			return cur;
		}

		function recoverObstruction(el, classification) {
			if (!el || !isEngineActive()) return false;
			if (recoveredSet.has(el) || hasRecoveredAncestor(el)) return false;

			const normTxt = normalizeText(el);
			const rootObstruction = resolveObstructionRoot(el);
			const modalNode = (el === rootObstruction) ? resolveInnerModal(el, normTxt) : el;
			if (recoveredSet.has(rootObstruction) || recoveredSet.has(modalNode)) return false;

			const sig = computeNodeSignature(modalNode, normTxt);
			const now = Date.now();

			let sigEntry = signatureHistory.get(sig);
			if (sigEntry && (now - sigEntry.firstSeen <= RETRY_WINDOW_MS)) {
				if (sigEntry.retryCount >= MAX_RETRIES_PER_SIG) {
					return false;
				}
				sigEntry.retryCount++;
				sigEntry.lastSeen = now;
				stats.incAntiAdblock('repeated');
			} else {
				sigEntry = { count: 1, retryCount: 0, firstSeen: now, lastSeen: now, timerId: null };
				signatureHistory.set(sig, sigEntry);
			}

			stats.incAntiAdblock('detections');

			try {
				const backdrops = findAssociatedBackdrops(rootObstruction, modalNode);

				recoveredSet.add(el);
				recoveredSet.add(modalNode);
				recoveredSet.add(rootObstruction);

				const snapshots = [];
				if (rootObstruction !== modalNode) {
					const sRoot = hideObstructionNodeReversibly(rootObstruction, 'anti-adblock-wrapper');
					if (sRoot) snapshots.push(sRoot);
				}
				const sEl = hideObstructionNodeReversibly(modalNode, 'anti-adblock');
				if (sEl) snapshots.push(sEl);

				for (let i = 0; i < backdrops.length; i++) {
					recoveredSet.add(backdrops[i]);
					const sb = hideObstructionNodeReversibly(backdrops[i], 'anti-adblock-backdrop');
					if (sb) snapshots.push(sb);
				}

				recoveryRecords.push({
					target: el,
					wrapper: rootObstruction,
					backdrops,
					snapshots,
					signature: sig,
					reason: (classification && classification.reasons && classification.reasons.join(',')) || 'anti-adblock',
					category: (classification && classification.category) || 'anti-adblock-modal',
					score: (classification && classification.score) || CONFIDENCE_THRESHOLD,
					time: now
				});
				if (recoveryRecords.length > 60) recoveryRecords.shift();

				recoverPageInteractionRestrictions();
				stats.incAntiAdblock('recoveries');
				log('BLOCK', 'anti-adblock', `Recovered obstruction (${rootObstruction.tagName}${rootObstruction.id ? '#' + rootObstruction.id : ''}) score=${classification && classification.score}`);

				if (sigEntry.retryCount < MAX_RETRIES_PER_SIG) {
					const delay = RETRY_DELAYS[Math.min(sigEntry.retryCount, RETRY_DELAYS.length - 1)];
					if (sigEntry.timerId) clearTimeout(sigEntry.timerId);
					sigEntry.timerId = setTimeout(() => {
						sigEntry.timerId = null;
						if (isEngineActive()) scanRoot(D.body || D.documentElement);
					}, delay);
				}
				return true;
			} catch (err) {
				stats.incAntiAdblock('failed');
				log('WARN', 'anti-adblock', 'Recovery failed:', err && err.message);
				return false;
			}
		}

		function inspectCandidate(el) {
			if (!el || el.nodeType !== 1 || !isEngineActive()) return false;
			if (recoveredSet.has(el) || el.hasAttribute('data-nvirya-hidden') || hasRecoveredAncestor(el)) return false;
			const clsRes = classifyNode(el);
			if (clsRes.confirmed) {
				return recoverObstruction(el, clsRes);
			}
			return false;
		}

		function scanRoot(rootScope) {
			if (!isEngineActive()) return 0;
			let recoveredCount = 0;
			try {
				for (let i = 0; i < SITE_ADAPTERS.length; i++) {
					const adapter = SITE_ADAPTERS[i];
					try {
						if (adapter.matchHost(hostname)) {
							const targets = adapter.detector(D, W) || [];
							for (let j = 0; j < targets.length; j++) {
								const tNode = targets[j];
								if (!tNode || recoveredSet.has(tNode) || tNode.hasAttribute('data-nvirya-hidden')) continue;
								const c = classifyNode(tNode);
								if (c.confirmed || c.score >= (adapter.confidenceThreshold || 55)) {
									c.confirmed = true;
									if (recoverObstruction(tNode, c)) recoveredCount++;
								}
							}
						}
					} catch (adapterErr) {
						log('WARN', 'adapter', adapter.name + ' error:', adapterErr && adapterErr.message);
					}
				}

				const scope = (rootScope && rootScope.querySelectorAll) ? rootScope : D;
				if (!scope || !scope.querySelectorAll) return recoveredCount;
				const candidates = scope.querySelectorAll(
					'[class*="adblock" i],[id*="adblock" i],[class*="adblocker" i],.fc-ab-root,.fc-dialog-container,.tp-modal,[role="dialog"],[aria-modal="true"],dialog[open],div[style*="fixed"],div[class*="modal" i],div[class*="overlay" i],div[class*="popup" i]'
				);
				const lim = Math.min(candidates.length, 70);
				for (let i = 0; i < lim; i++) {
					if (inspectCandidate(candidates[i])) recoveredCount++;
				}
			} catch (e) {}
			return recoveredCount;
		}

		function queueMutationNode(node) {
			if (!node || node.nodeType !== 1 || !isEngineActive() || isNviryaNode(node)) return;
			pendingScanNodes.add(node);
			if (debounceTimer) return;
			debounceTimer = setTimeout(() => {
				debounceTimer = null;
				if (!isEngineActive()) {
					pendingScanNodes.clear();
					return;
				}
				const batch = Array.from(pendingScanNodes);
				pendingScanNodes.clear();
				for (let i = 0; i < Math.min(batch.length, 40); i++) {
					const n = batch[i];
					if (!n || !n.isConnected) continue;
					if (!inspectCandidate(n) && n.querySelectorAll) {
						scanRoot(n);
					}
				}
			}, 60);
		}

		function scheduleBoundedFallbackScans() {
			clearFallbackTimers();
			if (!isEngineActive()) return;
			[600, 1800, 4200].forEach((delay) => {
				const tid = setTimeout(() => {
					if (isEngineActive()) scanRoot(D.body || D.documentElement);
				}, delay);
				fallbackTimers.push(tid);
			});
		}

		function clearFallbackTimers() {
			for (let i = 0; i < fallbackTimers.length; i++) clearTimeout(fallbackTimers[i]);
			fallbackTimers = [];
			if (debounceTimer) {
				clearTimeout(debounceTimer);
				debounceTimer = null;
			}
			pendingScanNodes.clear();
			signatureHistory.forEach((entry) => {
				if (entry && entry.timerId) clearTimeout(entry.timerId);
			});
		}

		function revertAll() {
			clearFallbackTimers();
			while (recoveryRecords.length > 0) {
				const rec = recoveryRecords.pop();
				if (!rec || !Array.isArray(rec.snapshots)) continue;
				for (let i = 0; i < rec.snapshots.length; i++) {
					const s = rec.snapshots[i];
					if (!s || !s.node) continue;
					try {
						if (s.prevHiddenAttr == null) s.node.removeAttribute('data-nvirya-hidden');
						else s.node.setAttribute('data-nvirya-hidden', s.prevHiddenAttr);
						if (s.node.style) {
							if (s.prevDisplay) s.node.style.setProperty('display', s.prevDisplay, s.prevDisplayPri);
							else s.node.style.removeProperty('display');
							if (s.prevVis) s.node.style.setProperty('visibility', s.prevVis, s.prevVisPri);
							else s.node.style.removeProperty('visibility');
							if (s.prevPe) s.node.style.setProperty('pointer-events', s.prevPe, s.prevPePri);
							else s.node.style.removeProperty('pointer-events');
						}
						state.hiddenNodes.delete(s.node);
						recoveredSet.delete(s.node);
					} catch (e) {}
				}
			}
			cssStyleSnapshots.forEach((rec, elNode) => {
				if (!elNode) return;
				try {
					if (rec.props && elNode.style) {
						for (const prop of Object.keys(rec.props)) {
							const orig = rec.props[prop];
							if (orig && orig.val) elNode.style.setProperty(prop, orig.val, orig.pri);
							else elNode.style.removeProperty(prop);
						}
					}
					if (Array.isArray(rec.removedClasses) && elNode.classList) {
						for (let i = 0; i < rec.removedClasses.length; i++) {
							elNode.classList.add(rec.removedClasses[i]);
						}
					}
				} catch (e) {}
			});
			cssStyleSnapshots.clear();
			signatureHistory.clear();
		}

		function onRouteCleanup() {
			clearFallbackTimers();
			signatureHistory.clear();
			if (isEngineActive()) {
				scheduleBoundedFallbackScans();
			}
		}

		return {
			classifyNode,
			resolveObstructionRoot,
			recoverObstruction,
			inspectCandidate,
			scanRoot,
			queueMutationNode,
			scheduleBoundedFallbackScans,
			clearFallbackTimers,
			revertAll,
			onRouteCleanup,
			getDiagnostics: () => ({
				active: isEngineActive(),
				stats: stats.antiAdblock,
				recentRecoveries: recoveryRecords.slice(-5).map((r) => ({
					category: r.category,
					score: r.score,
					reason: r.reason,
					wrapperTag: r.wrapper && r.wrapper.tagName
				}))
			})
		};
	})();

	try { W.__NVIRYA_ANTI_ADBLOCK_ENGINE__ = AntiAdblockEngine; } catch (e) {}

	function isAntiAdblockModalNode(el) {
		return AntiAdblockEngine.classifyNode(el).confirmed;
	}

	function handleAntiAdblock(rootScope) {
		if (!config.antiAdblock || isDisabledHere()) return;
		AntiAdblockEngine.scanRoot(rootScope);
	}

	function onLocationChange() {
		if (location.href === lastHref) return;
		lastHref = location.href;
		AntiAdblockEngine.onRouteCleanup();
		if (isDisabledHere()) {
			if (observer) { try { observer.disconnect(); } catch (e) {} observer = null; }
		} else {
			if (!observer) startObserver();
			installSiteRulesCSS();
			initialScan();
		}
		if (typeof UI !== 'undefined' && UI.updateUIStatus) UI.updateUIStatus();
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
		const pa = parse(a),
			pb = parse(b);
		const len = Math.max(pa.length, pb.length);
		for (let i = 0; i < len; i++) {
			const x = pa[i] || 0,
				y = pb[i] || 0;
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
			const ver = typeof remote === 'object' && remote.version ? String(remote.version) : String(remote);
			if (compareVersions(VERSION, ver) < 0) return ver;
			store.del(K_UPD_REMOTE);
			store.del(K_UPD_CHANGELOG);
			return null;
		}

		function getChangelog() {
			const list = store.get(K_UPD_CHANGELOG, []);
			return Array.isArray(list) ? list : [];
		}

		function isSnoozed() {
			const until = Number(store.get(K_UPD_SNOOZE, 0)) || 0;
			const now = Date.now();
			return until > now && until - now <= UPDATE_SNOOZE_MS + 1000;
		}

		function snooze() { store.set(K_UPD_SNOOZE, Date.now() + UPDATE_SNOOZE_MS); }

		function parseRemoteChangelog(head) {
			const parsedChangelogArray = [];
			const cleanChangelogLine = (raw) => String(raw || '')
				.replace(/^\s*(?:\/\/|\*+)?\s*/, '')
				.replace(/^[-•*+]\s*/, '')
				.replace(/^\[Task\s*\d+\]\s*/i, '')
				.trim();
			try {
				const blockMatch = head.match(/==Changelog==([\s\S]*?)==\/Changelog==/i);
				if (blockMatch && blockMatch[1]) {
					const lines = blockMatch[1].split(/\r?\n/);
					for (let i = 0; i < lines.length; i++) {
						const cleaned = cleanChangelogLine(lines[i]);
						if (cleaned && !/^==/.test(cleaned) && !/^v\d+\.\d+.*:$/i.test(cleaned)) {
							parsedChangelogArray.push(cleaned);
						}
					}
				}
				if (!parsedChangelogArray.length) {
					const tagRe = /\/\/\s*@changelog\s+(.+)/gi;
					let tm;
					while ((tm = tagRe.exec(head)) !== null) {
						const item = cleanChangelogLine(tm[1]);
						if (item && !/^v\d+\.\d+.*:$/i.test(item)) parsedChangelogArray.push(item);
					}
				}
			} catch (e) {}
			return parsedChangelogArray;
		}

		function fetchRemoteVersion(done) {
			let finished = false;
			const finish = (err, payload) => {
				if (finished) return;
				finished = true;
				done(err, payload);
			};
			const parse = (text) => {
				const head = String(text || '').slice(0, 12288);
				const m = head.match(/\/\/\s*@version\s+([0-9.]+)/i);
				const remoteVer = m && m[1].replace(/^\.+|\.+$/g, '');
				if (remoteVer && /\d/.test(remoteVer)) {
					const parsedChangelogArray = parseRemoteChangelog(head);
					finish(null, { version: remoteVer, changelog: parsedChangelogArray });
				} else {
					finish(new Error('no @version in remote file'));
				}
			};

			if (typeof GM_xmlhttpRequest === 'function') {
				try {
					GM_xmlhttpRequest({
						method: 'GET',
						url: UPDATE_URL,
						headers: { 'Range': 'bytes=0-8191', 'Cache-Control': 'no-cache' },
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
					.then(text => {
						clearTimeout(timer);
						parse(text);
					})
					.catch(err => {
						clearTimeout(timer);
						finish(err || new Error('network error'));
					});
			} catch (e) { finish(e); }
		}

		function check(manual) {
			if (checking) { if (manual) UI.toast(t('upd_chk')); return; }
			const now = Date.now();
			const last = Number(store.get(K_UPD_LAST, 0)) || 0;
			if (!manual && last <= now && now - last < UPDATE_CHECK_INTERVAL) return;

			checking = true;
			store.set(K_UPD_LAST, now);
			UI.setUpdateChecking(true);
			if (manual) UI.toast(t('upd_chk'));

			fetchRemoteVersion((err, remoteInfo) => {
				checking = false;
				UI.setUpdateChecking(false);
				try {
					if (err || !remoteInfo) {
						log('WARN', 'update', 'check failed', err && err.message);
						store.set(K_UPD_LAST, Date.now() - UPDATE_CHECK_INTERVAL + UPDATE_RETRY_AFTER);
						if (manual) UI.toast(t('ts_ufail'));
						return;
					}
					const remoteVer = typeof remoteInfo === 'object' ? String(remoteInfo.version || '') : String(remoteInfo || '');
					const changelog = (typeof remoteInfo === 'object' && Array.isArray(remoteInfo.changelog)) ? remoteInfo.changelog : [];
					if (compareVersions(VERSION, remoteVer) < 0) {
						const prevRemote = store.get(K_UPD_REMOTE, null);

						if (prevRemote !== remoteVer || manual) {
							store.del(K_UPD_SNOOZE);
						}

						store.set(K_UPD_REMOTE, remoteVer);
						store.set(K_UPD_CHANGELOG, changelog);
						UI.setUpdateAvailable(remoteVer, changelog);

						if (manual || !isSnoozed()) UI.showUpdateBanner({ version: remoteVer, changelog });
						log('INFO', 'update', 'new version available', remoteVer);
					} else {
						store.del(K_UPD_REMOTE);
						store.del(K_UPD_CHANGELOG);
						store.del(K_UPD_SNOOZE);
						UI.setUpdateAvailable(null, []);
						UI.hideUpdateBanner();
						if (manual) UI.toast(t('ts_ulat'));
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
					if (avail && !isSnoozed()) {
						UI.showUpdateBanner({ version: avail, changelog: getChangelog() });
					}
					check(false);
				} catch (e) { log('ERROR', 'update', e && e.message); }
			};
			setTimeout(() => {
				if (typeof W.requestIdleCallback === 'function') W.requestIdleCallback(run, { timeout: 3000 });
				else run();
			}, UPDATE_START_DELAY);
		}

		return { check, schedule, getAvailable, getChangelog, isSnoozed, snooze };
	})();

	const UI = (() => {
		const K_FAB = 'nvirya_x_fab';
		const THEMES = ['auto', 'light', 'dark'];
		const LANGS = ['auto', 'en', 'vi', 'zh-CN', 'ja', 'ru'];
		const SVG_NS = 'http://www.w3.org/2000/svg';
		const FAB_SIZE = 46,
			FAB_MARGIN = 10;

		let host = null,
			root = null;
		let menuOpen = false;
		let handleEl = null,
			backdropEl = null,
			sheetEl = null,
			grabEl = null,
			bodyEl = null;
		let themeBtn = null,
			segBtns = [],
			langBtns = [];
		let statsEl = null,
			toastEl = null;
		let reportModalEl = null,
			reportReasonSelect = null,
			reportPreNoticeEl = null,
			reportNoteLblEl = null,
			reportNoteInput = null;
		let pickerEl = null,
			pickerLabelEl = null,
			pickerBarEl = null,
			pickerActive = false;
		let pickerHover = null,
			pickerTarget = null,
			lastPickerTouchAt = 0;
		let toastTimer = null;
		let lastToast = '';
		let statsTimer = null;
		let fab = { side: 'r', y: 0.7 };
		let statsMode = 'session'; // 'session' | 'lifetime'
		let segSessionBtn = null,
			segLifetimeBtn = null;
		let updateEl = null,
			ubTitleEl = null,
			ubCurVerEl = null,
			ubNewVerEl = null,
			ubWhatsNewEl = null,
			ubListEl = null,
			ubLaterBtn = null,
			ubGoBtn = null,
			newBadgeEl = null;
		let updateAvailable = null,
			updateChangelog = [],
			updateChecking = false;
		let navBarWrapEl = null,
			activeTab = 'home',
			tabViews = {},
			tabBtns = {};
		let uiReady = false,
			sheetBuilt = false;

		function el(tag, props, ...children) {
			const e = document.createElement(tag);
			if (props)
				for (const k in props) {
					if (k === 'style' && typeof props[k] === 'object') Object.assign(e.style, props[k]);
					else if (k === 'class') e.className = props[k];
					else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), props[k]);
					else if (k === 'text') e.textContent = props[k];
					else e.setAttribute(k, props[k]);
				}
			for (const c of children)
				if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
			return e;
		}

		function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }

		const ICONS = {
			shield: [
				'M13.19 8.72c.62 0 1.24.01 1.86.01-.87 1.33-1.74 2.66-2.62 3.98-.04-.03-.13-.13-.15-.17a.64.64 0 0 1-.03-.23.47.47 0 0 0-.07-.07c-.03-.05-.06-.11-.1-.17-.03-.04-.06-.09-.09-.13-.02-.02-.05-.03-.06-.05a.8.8 0 0 1-.03-.22c-.03-.04-.05-.09-.09-.13-.01-.01-.03-.02-.04-.04a1.86 1.86 0 0 0-.17-.23.47.47 0 0 0-.06-.08c-.04-.06-.07-.13-.11-.19-.02-.02-.04-.04-.06-.06-.02-.03-.02-.06-.04-.08a.33.33 0 0 0-.06-.05c-.01-.03-.01-.06-.03-.08-.31-.5-.64-.99-.96-1.48-.1-.16-.2-.33-.31-.49-.1-.15-.17-.33-.3-.46-1.03 1.97-2.07 3.95-3.1 5.92-.57 0-1.14 0-1.71 0 .03-.17.27-.52.36-.69.23-.42.46-.83.69-1.25.78-1.42 1.56-2.83 2.35-4.25.27-.48.54-.97.81-1.46.08-.15.17-.3.25-.46.04-.07.08-.18.15-.22.82 1.33 1.64 2.66 2.47 4 .1-.1.17-.24.25-.35.19-.27.37-.55.56-.82.07-.1.2-.36.3-.41zm-3.66 2.92c.07.04.09.13.14.2.01.02.04.03.05.05.01.02.01.05.02.07.02.03.05.04.07.07.01.02.01.05.02.07.03.06.08.11.12.16.1.16.19.3.28.46.11.17.23.33.34.5.08.11.14.23.22.35.2.3.41.6.61.9.14.22.28.44.42.66.05.08.1.17.17.24.11-.09.17-.27.23-.39.07-.13.15-.26.23-.39.14-.22.25-.45.37-.68.1-.18.21-.37.31-.55.04-.07.09-.14.13-.21.1-.2.21-.41.34-.6.03-.05.05-.11.08-.17.1-.16.18-.32.27-.48.1-.18.21-.35.3-.53.05-.1.1-.2.16-.29.08-.12.16-.24.22-.37.03-.06.05-.12.08-.17.01-.03.04-.05.05-.08.05-.09.12-.19.16-.28a.48.48 0 0 0 .03-.12c.04-.09.09-.17.14-.25.03-.04.04-.09.06-.13.04-.05.09-.12.12-.18.01-.01 0-.03.01-.04.05-.1.14-.18.15-.29.19-.32.38-.64.57-.96-.23 0-.46 0-.69-.01-.14-.03-.31-.01-.46-.01-.28 0-.56 0-.84 0-.11 0-.42.03-.5-.02.05-.13.15-.24.23-.35.16-.24.33-.47.49-.71.05-.08.2-.34.26-.38.08-.04.23-.02.32-.02.26 0 .52 0 .78 0 .78 0 1.56 0 2.33 0 .23 0 .46 0 .69 0 .11 0 .24-.02.33.02-2.35 3.67-4.7 7.35-7.04 11.02-.97-1.73-1.93-3.46-2.9-5.19.16-.3.31-.59.47-.89z',
				'M13.58 8.13c.08.05.39.02.5-.02.28 0 .56 0 .84 0 .15 0 .32-.02.46.01 0 .08-.05.14-.09.21-.08.12-.15.26-.24.37-.62 0-1.24-.01-1.86-.01.04-.13.29-.49.39-.56zm-1.15 4.58c-.04.09-.1.17-.15.25-.08.12-.14.28-.26.36-.73-1.15-1.45-2.3-2.18-3.45-.1.08-.16.27-.22.39-.12.24-.26.49-.38.73-.32.64-.67 1.27-.99 1.91-.12.23-.21.47-.35.69-.06.1-.11.21-.16.32-.07.15-.15.3-.23.44-.05.09-.09.2-.16.27-.21 0-.42 0-.63 0 1.03-1.97 2.07-3.95 3.1-5.92.13.13.2.31.3.46.11.16.21.33.31.49.32.49.65.98.96 1.48.02.02.02.05.03.08.02.02.02.05.06.05.02.02.02.05.04.08.02.02.04.04.06.06.04.06.07.13.11.19.01.03.03.05.06.08.06.08.11.16.17.23.01.02.03.03.04.04.04.04.06.09.09.13.01.08.01.16.03.22.01.02.04.03.06.05.03.04.06.09.09.13.04.06.07.12.1.17.01.02.04.05.07.07.01.07.01.15.03.23.02.04.11.14.15.17zm3.07-3.59c-.01.11-.1.19-.15.29-.01.01 0 .03-.01.04-.03.06-.08.13-.12.18-.02.04-.03.09-.06.13-.05.08-.1.16-.14.25a.48.48 0 0 1-.03.12c-.04.09-.11.19-.16.28-.01.03-.04.05-.05.08-.03.05-.05.11-.08.17-.06.13-.14.25-.22.37-.06.09-.11.19-.16.29-.09.18-.2.35-.3.53-.09.16-.17.32-.27.48-.03.06-.05.12-.08.17-.13.19-.24.4-.34.6-.04.07-.09.14-.13.21-.1.18-.21.37-.31.55-.12.23-.23.46-.37.68-.08.13-.16.26-.23.39-.06.12-.12.3-.23.39-.07-.07-.12-.16-.17-.24-.14-.22-.28-.44-.42-.66-.2-.3-.41-.6-.61-.9-.08-.12-.14-.24-.22-.35-.11-.17-.23-.33-.34-.5-.09-.16-.18-.3-.28-.46-.04-.05-.09-.1-.12-.16-.01-.02-.01-.05-.02-.07-.02-.03-.05-.04-.07-.07-.01-.02-.01-.05-.02-.07-.01-.02-.04-.03-.05-.05-.05-.07-.07-.16-.14-.2.04-.11.1-.22.16-.32.06-.12.1-.24.19-.34.71 1.12 1.42 2.24 2.13 3.36.11-.07.18-.24.25-.34.2-.3.39-.6.59-.9.61-.95 1.24-1.92 1.88-2.83.07-.1.12-.2.18-.3.1-.16.23-.32.33-.48.03-.05.19-.31.22-.33.01-.01.03 0 .04-.01z'
			],

			sun: [
				['c', 12, 12, 4],
				'M12 2v2',
				'M12 20v2',
				'm4.93 4.93 1.41 1.41',
				'm17.66 17.66 1.41 1.41',
				'M2 12h2',
				'M20 12h2',
				'm6.34 17.66-1.41 1.41',
				'm19.07 4.93-1.41 1.41'
			],

			moon: [
				'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z',
				'M19 3v4',
				'M21 5h-4'
			],

			close: [
				'M17 7 7 17',
				'm7 7 10 10'
			],

			chevron: [
				'm9 18 6-6-6-6'
			],

			allow: [
				['c', 12, 12, 10],
				'm9 12 2 2 4-4'
			],

			pause: [
				['c', 12, 12, 10],
				'M10 15V9',
				'M14 15V9'
			],

			target: [
				['c', 12, 12, 7],
				['c', 12, 12, 1],
				'M12 2v3',
				'M12 19v3',
				'M2 12h3',
				'M19 12h3'
			],

			wand: [
				'm21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z',
				'm14 7 3 3',
				'M5 6v4',
				'M19 14v4',
				'M10 2v2',
				'M7 8H3',
				'M21 16h-4',
				'M11 3H9'
			],

			undo: [
				'M9 14 4 9l5-5',
				'M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11'
			],

			copy: [
				['r', 8, 8, 14, 14, 2],
				'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'
			],

			flag: [
				'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z',
				'M4 22V4'
			],

			download: [
				'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
				'm7 10 5 5 5-5',
				'M12 15V3'
			],

			globe: [
				['c', 12, 12, 10],
				'M2 12h20',
				'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20'
			],

			telegram: [
				'm15 10-4 4 6 6 4-16-18 7 4 2 2 6 3-4'
			],

			discord: [
				['c', 9, 12, 1],
				['c', 15, 12, 1],
				'M7.5 7.5c3.5-1 5.5-1 9 0',
				'M7 16.5c3.5 1 6.5 1 10 0',
				'M15.5 17c0 1 1.5 3 2 3 1.5 0 2.833-1.667 3.5-3 .667-1.667.5-5.833-1.5-11.5-1.457-1.015-3-1.34-4.5-1.5l-.972 1.923a11.913 11.913 0 0 0-4.053 0L9 4c-1.5.16-3.043.485-4.5 1.5-2 5.667-2.167 9.833-1.5 11.5.667 1.333 2 3 3.5 3 .5 0 2-2 2-3'
			],

			github: [
				'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4',
				'M9 18c-4.51 2-5-2-7-2'
			]
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
					n.setAttribute('cx', part[1]);
					n.setAttribute('cy', part[2]);
					n.setAttribute('r', part[3]);
				} else {
					n = document.createElementNS(SVG_NS, 'rect');
					n.setAttribute('x', part[1]);
					n.setAttribute('y', part[2]);
					n.setAttribute('width', part[3]);
					n.setAttribute('height', part[4]);
					n.setAttribute('rx', part[5]);
				}
				s.appendChild(n);
			}
			return s;
		}

		function fmt(n) { try { return Number(n || 0).toLocaleString(); } catch (e) { return String(n); } }

		const LIGHT_VARS = `
      --cs: light;
      --sheet: #ffffff;
      --card: #f4f4f6;
      --card-hover: #eaeaea;
      --text: #18181b;
      --muted: #71717a;
      --border: rgba(0,0,0,.08);
      --accent: #3b82f6;
      --danger: #dc2626;
      --pill: rgba(0,0,0,.18);
      --ring: #ffffff;
      --backdrop: rgba(15,15,20,.42);
      --switch-off: #d4d4d8;
      --seg-bg: rgba(0,0,0,.06);
      --seg-on: #ffffff;
      --toast-bg: #f4f4f6;
      --toast-fg: #18181b;
      --shadow: 0 -8px 30px rgba(0,0,0,.15);
      --fab-shadow: 0 4px 16px rgba(0,0,0,.2);
  `;
		const DARK_VARS = `
      --cs: dark;
      --sheet: #141417;
      --card: #1c1c21;
      --card-hover: #25252b;
      --text: #f4f4f5;
      --muted: #a1a1aa;
      --border: rgba(255,255,255,.08);
      --accent: #3b82f6;
      --danger: #f87171;
      --pill: rgba(255,255,255,.22);
      --ring: #121215;
      --backdrop: rgba(0,0,0,.58);
      --switch-off: #3f3f46;
      --seg-bg: rgba(255,255,255,.08);
      --seg-on: #3a3a41;
      --toast-bg: #232328;
      --toast-fg: #f4f4f5;
      --shadow: 0 -8px 30px rgba(0,0,0,.48);
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
    button { font: inherit; color: inherit; margin: 0; pointer-events: auto; }
    input, select, textarea, label, a { pointer-events: auto; }
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
      pointer-events: auto !important;
      z-index: 2147483647 !important;
      transition: left .28s cubic-bezier(.32,.72,0,1), top .28s cubic-bezier(.32,.72,0,1), opacity .24s ease, transform .28s cubic-bezier(.32,.72,0,1);
    }
    .handle svg { width: 22px; height: 22px; }
    .handle:hover, .handle:focus-visible { opacity: 1; }
    .handle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .handle.hidden { display: none !important; }
    .handle.idle[data-side="l"] { transform: translateX(-58%) scale(0.92); opacity: 0.42; }
    .handle.idle[data-side="r"] { transform: translateX(58%) scale(0.92); opacity: 0.42; }
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
      opacity: 0;
      touch-action: none;
      pointer-events: none;
      transition: opacity .2s ease;
      will-change: opacity;
      z-index: 2147483000;
    }
    .backdrop.open { opacity: 1; pointer-events: auto; }

    .sheet {
      position: fixed; left: 0; right: 0; bottom: 0;
      height: 76vh; height: 76dvh;
      max-height: 85vh; max-height: 85dvh;
      background: var(--sheet);
      color: var(--text);
      color-scheme: var(--cs);
      font-size: 14px; line-height: 1.4;
      border: 1px solid var(--border); border-bottom: none;
      border-radius: 24px 24px 0 0;
      box-shadow: var(--shadow);
      overflow: hidden;
      contain: layout paint style;
      flex-direction: column;
      transform: translateY(120%);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      display: none;
      transition: transform .28s cubic-bezier(.22, 1, .36, 1), opacity .2s ease, visibility .28s ease;
      will-change: transform, opacity;
      z-index: 2147483001;
    }
    .sheet.open {
      display: flex;
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: translateY(0);
    }
    .sheet:focus { outline: none; }

    @media (min-width: 641px) {
      .sheet {
        left: 50%; right: auto; top: 50%; bottom: auto;
        width: 420px; max-width: min(420px, calc(100vw - 32px));
        height: 620px; max-height: 82vh; max-height: 82dvh;
        border: 1px solid var(--border);
        border-radius: 20px;
        box-shadow: 0 24px 70px rgba(0,0,0,.35);
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        display: none;
        transform: translate3d(-50%, -46%, 0) scale(.96);
      }
      .sheet.open {
        display: flex;
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transform: translate3d(-50%, -50%, 0) scale(1);
      }
      .pill { display: none; }
    }

    .grab {
      flex: none; padding-top: 8px; touch-action: none;
      border-bottom: 1px solid var(--border);
    }
    .pill { width: 36px; height: 5px; border-radius: 3px; background: var(--pill); margin: 0 auto 8px; }
    .head {
      display: flex; align-items: center; gap: 10px;
      padding: 4px 16px 10px;
    }
    .nav-tabs-wrap {
      padding: 0 16px 12px;
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
      pointer-events: auto;
      transition: background .15s ease, color .15s ease;
    }
    .icon-btn svg { width: 16px; height: 16px; }
    .icon-btn:active { background: var(--card-hover); color: var(--text); }
    .icon-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    @media (hover: hover) { .icon-btn:hover { background: var(--card-hover); color: var(--text); } }

    .body {
      flex: 1 1 auto; min-height: 0;
      overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
      padding: 14px 16px calc(20px + env(safe-area-inset-bottom, 0px));
      pointer-events: auto;
    }
    .body::-webkit-scrollbar { width: 6px; }
    .body::-webkit-scrollbar-track { background: transparent; }
    .body::-webkit-scrollbar-thumb { background: var(--pill); border-radius: 999px; }
    .body::-webkit-scrollbar-thumb:hover { background: var(--muted); }
    .sec-title { margin: 20px 4px 8px; font-size: 13px; font-weight: 600; color: var(--muted); }

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
      border: 1px solid var(--border);
      padding: 9px 14px; border-radius: 999px;
      font-size: 13px; font-weight: 500;
      box-shadow: 0 6px 24px rgba(0,0,0,.15);
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

    .sheet {
      height: 76vh; height: 76dvh;
    }
    @media (min-width: 641px) {
      .sheet {
        height: 620px; max-height: 82vh; max-height: 82dvh;
      }
    }

    .nav-tabs {
      display: flex; gap: 4px; padding: 3.5px;
      background: var(--seg-bg);
      border-radius: 11px;
    }
    .nav-tab-btn {
      flex: 1; padding: 7px 6px;
      border: none; border-radius: 8px;
      background: none; color: var(--muted);
      font-size: 13px; font-weight: 600;
      cursor: pointer;
      transition: background .18s ease, color .18s ease, box-shadow .18s ease;
    }
    .nav-tab-btn[aria-selected="true"] {
      background: var(--seg-on);
      color: var(--text);
      box-shadow: 0 1px 4px rgba(0,0,0,0.12);
    }
    .nav-tab-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

    .tab-view { display: none; }
    .tab-view.active { display: block; animation: tabFadeIn .16s ease; }
    .tab-view > .sec-title:first-child { margin-top: 2px; }
    @keyframes tabFadeIn {
      from { opacity: 0; transform: translateY(3px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .item.disabled {
      opacity: .46; cursor: not-allowed;
    }
    .item.disabled .lbl, .item.disabled .sub { color: var(--muted); }
    .item.disabled input { cursor: not-allowed; pointer-events: none; }

    .update-banner {
			-webkit-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
      position: fixed; left: 50%; top: calc(12px + env(safe-area-inset-top, 0px));
      width: min(92vw, 390px);
      padding: 16px;
      background: var(--sheet); color: var(--text);
      border: 1px solid var(--border); border-radius: 18px;
      box-shadow: 0 16px 44px rgba(0,0,0,.26), 0 2px 10px rgba(0,0,0,.1);
      -webkit-backdrop-filter: blur(24px) saturate(1.5);
      backdrop-filter: blur(24px) saturate(1.5);
      font-size: 14px; line-height: 1.45;
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
    .ub-row { display: flex; align-items: center; gap: 12px; }
    .ub-icon {
      width: 40px; height: 40px; border-radius: 12px;
      box-shadow: 0 4px 12px rgba(59,130,246,.32);
    }
    .ub-icon svg { width: 20px; height: 20px; }
    .ub-txt { flex: 1; min-width: 0; }
    .ub-title { font-size: 15.5px; font-weight: 700; letter-spacing: -.01em; color: var(--text); }
    .ub-ver-row {
      display: inline-flex; align-items: center; gap: 6px;
      margin-top: 5px; flex-wrap: wrap;
    }
    .ub-ver-badge {
      display: inline-flex; align-items: center;
      padding: 2px 8px; border-radius: 999px;
      font-size: 11.5px; font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: -.01em;
    }
    .ub-ver-badge.cur {
      background: var(--card); color: var(--muted);
      border: 1px solid var(--border);
    }
    .ub-ver-badge.next {
      background: rgba(59,130,246,.14); color: var(--accent);
      border: 1px solid rgba(59,130,246,.3);
    }
    .ub-ver-arrow { font-size: 11.5px; color: var(--muted); font-weight: 700; }
    .ub-close { width: 28px; height: 28px; margin: -4px -4px 0 0; align-self: flex-start; }
    .ub-body {
      margin-top: 12px; padding: 10px 12px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      max-height: 150px;
      overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
      pointer-events: auto;
    }
    .ub-body::-webkit-scrollbar { width: 5px; }
    .ub-body::-webkit-scrollbar-thumb { background: var(--pill); border-radius: 999px; }
    .ub-whats-new {
      font-size: 12px; font-weight: 600; color: var(--muted);
      margin-bottom: 6px;
    }
    .ub-changelog {
      margin: 0; padding-left: 16px;
      font-size: 12.5px; line-height: 1.48; color: var(--text);
    }
    .ub-changelog li { margin-bottom: 4px; }
    .ub-changelog li:last-child { margin-bottom: 0; }
    .ub-changelog li::marker { color: var(--accent); }
    .ub-actions { display: flex; gap: 8px; margin-top: 12px; }
    .ub-btn {
      flex: 1; display: flex; align-items: center; justify-content: center;
      min-height: 40px; padding: 0 12px;
      border: none; border-radius: 12px;
      font-size: 14px; font-weight: 600;
      cursor: pointer; text-decoration: none;
      transition: opacity .15s ease, transform .12s ease;
    }
    .ub-btn:active { opacity: .82; transform: scale(.98); }
    .ub-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .ub-btn.later { background: var(--card); color: var(--text); border: 1px solid var(--border); }
    .ub-btn.go { background: var(--accent); color: #fff; box-shadow: 0 4px 12px rgba(59,130,246,.28); }

    .compat-group {
      background: var(--card); border: 1px solid var(--border);
      border-radius: 14px; overflow: hidden;
    }
    .compat-row {
      position: relative;
      display: flex; align-items: center; justify-content: space-between;
      gap: 10px; padding: 10px 14px;
      font-size: 12px; line-height: 1.35;
    }
    .compat-row + .compat-row::before {
      content: ''; position: absolute; top: 0; left: 14px; right: 0;
      height: 1px; background: var(--border);
    }
    .compat-info { flex: 1; min-width: 0; }
    .compat-name { display: block; font-size: 13px; font-weight: 600; color: var(--text); }
    .compat-note { display: block; margin-top: 2px; font-size: 11px; color: var(--muted); }
    .compat-badge {
      flex: none; display: inline-flex; align-items: center;
      padding: 2.5px 9px; border-radius: 999px;
      font-size: 11px; font-weight: 700; letter-spacing: .01em;
      white-space: nowrap;
    }
    .compat-badge.supported {
      background: rgba(34,197,94,.14); color: #22c55e;
      border: 1px solid rgba(34,197,94,.28);
    }
    .compat-badge.limited {
      background: rgba(245,158,11,.14); color: #f59e0b;
      border: 1px solid rgba(245,158,11,.3);
    }
    .compat-badge.unsupported {
      background: rgba(113,113,122,.16); color: var(--muted);
      border: 1px solid var(--border);
    }
    .compat-badge.neutral {
      background: var(--sheet); color: var(--text);
      border: 1px solid var(--border);
    }

    .about-card {
      margin-top: 8px; padding: 12px 14px;
      background: var(--card); border: 1px solid var(--border);
      border-radius: 14px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .about-head {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
    }
    .about-title { font-size: 14px; font-weight: 700; color: var(--text); letter-spacing: -.01em; }
    .about-ver {
      padding: 2px 8px; border-radius: 999px;
      background: rgba(59,130,246,.14); color: var(--accent);
      font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums;
    }
    .about-desc { font-size: 12px; color: var(--muted); line-height: 1.4; }
    .about-links {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 2px;
    }
    .about-link {
      flex: 1 1 0; min-width: 88px;
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 8px 10px; border-radius: 10px;
      background: var(--sheet); color: var(--text);
      border: 1px solid var(--border);
      font-size: 12px; font-weight: 600; text-decoration: none;
      cursor: pointer;
      transition: background .15s ease, transform .1s ease;
    }
    .about-link svg { width: 14px; height: 14px; color: var(--accent); flex: none; }
    .about-link:active { transform: scale(.97); background: var(--card-hover); }
    @media (hover: hover) {
      .about-link:hover { background: var(--card-hover); }
    }

    .report-modal {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: var(--backdrop);
      -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      padding: 16px; opacity: 0; visibility: hidden;
      pointer-events: none;
      transition: opacity .25s ease, visibility 0s linear .25s;
      z-index: 2147483010;
    }
    .report-modal.open { opacity: 1; visibility: visible; pointer-events: auto; transition-delay: 0s; }
    .report-prenotice {
      padding: 9px 12px; border-radius: 10px;
      font-size: 12px; line-height: 1.45;
      background: var(--seg-bg, rgba(120, 120, 128, 0.08));
      border: 1px solid var(--border);
      color: var(--muted);
      transition: all .2s ease;
      box-sizing: border-box;
    }
    .report-prenotice.highlighted {
      background: rgba(245, 158, 11, 0.12);
      border-color: rgba(245, 158, 11, 0.45);
      color: #d97706;
    }
    .report-prenotice a {
      color: var(--accent); font-weight: 600;
      text-decoration: underline; text-underline-offset: 2px;
    }
    .compat-badge.unsupported {
      cursor: pointer; text-decoration: none;
      transition: opacity .15s ease;
    }
    .compat-badge.unsupported:active { opacity: .75; }
    .help-icon-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 17px; height: 17px; border-radius: 50%;
      background: rgba(120, 120, 128, 0.16); color: var(--muted);
      font-size: 11px; font-weight: 700; margin-left: 6px;
      text-decoration: none; vertical-align: middle; cursor: pointer;
    }
    .help-icon-btn:hover, .help-icon-btn:active { background: var(--accent); color: #fff; }

    .report-card {
      background: var(--sheet); color: var(--text);
      width: 100%; max-width: 360px;
      border: 1px solid var(--border); border-radius: 20px;
      padding: 18px; box-shadow: var(--shadow);
      display: flex; flex-direction: column; gap: 10px;
      box-sizing: border-box;
      pointer-events: auto;
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
    .net-row {
      display: flex; align-items: center; justify-content: space-between;
      background: var(--card); border: 1px solid var(--border);
      border-radius: 11px; padding: 9px 11px; gap: 8px;
    }
    .net-info { flex: 1; min-width: 0; }
    .net-host-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .net-host {
      font-weight: 600; font-size: 12.5px; color: var(--text);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
    }
    .net-cnt { font-size: 11.5px; font-weight: 600; color: var(--muted); }
    .net-meta { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .net-badge {
      display: inline-block; padding: 1.5px 6px; border-radius: 999px;
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em;
    }
    .net-badge.blocked { background: rgba(220,38,38,.14); color: var(--danger); }
    .net-badge.allowed { background: rgba(34,197,94,.14); color: #22c55e; }
    .net-badge.unlocked { background: rgba(59,130,246,.16); color: #3b82f6; }
    .net-act-btn {
      flex: none; padding: 5px 10px; border-radius: 8px;
      font-size: 12px; font-weight: 600; cursor: pointer;
      border: 1px solid var(--border); background: var(--sheet); color: var(--text);
      transition: opacity .15s ease, transform .1s ease;
    }
    .net-act-btn.block { border-color: rgba(220,38,38,.35); color: var(--danger); }
    .net-act-btn.unblock { border-color: rgba(34,197,94,.35); color: #22c55e; }
    .net-act-btn:active:not(:disabled) { transform: scale(.96); opacity: .85; }
    .toast-act-btn:active { transform: scale(.95); opacity: .9; }
    .factory-reset-btn:active { transform: scale(.98); }

    @media (prefers-reduced-motion: reduce) {
      .update-banner { transition: none !important; }
      .handle, .backdrop, .sheet, .toast, .track, .track::after, .item, .seg button, .report-modal { transition: none !important; }
    }
    .chart-card {
      grid-column: 1 / -1;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 12px 14px;
      margin-top: 4px;
    }
    .chart-head {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 10px;
    }
    .chart-title { font-size: 12px; font-weight: 600; color: var(--muted); }
    .chart-detail { font-size: 11.5px; font-weight: 600; color: var(--accent); }
    .chart-bars {
      display: flex; align-items: flex-end; justify-content: space-between;
      height: 80px; gap: 6px;
    }
    .chart-col {
      flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px;
      height: 100%; justify-content: flex-end; cursor: pointer;
    }
    .chart-bar-bg {
      width: 100%; max-width: 26px; height: 100%;
      background: var(--seg-bg); border-radius: 6px;
      display: flex; align-items: flex-end; overflow: hidden;
    }
    .chart-bar-fill {
      width: 100%; background: var(--accent); opacity: .38;
      border-radius: 6px; transition: height .25s ease, opacity .2s ease;
    }
    .chart-col.active .chart-bar-fill {
      background: var(--accent); opacity: 1;
    }
    .chart-col.future {
      opacity: .25; cursor: default; pointer-events: none;
    }
    .chart-day { font-size: 10.5px; font-weight: 600; color: var(--muted); }
    .chart-col.active .chart-day { color: var(--text); font-weight: 700; }
  `;

		function themeSetting() { return THEMES.indexOf(config.theme) !== -1 ? config.theme : 'auto'; }

		function effectiveTheme() {
			const t = themeSetting();
			if (t !== 'auto') return t;
			try { return W.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { return 'light'; }
		}

		let lastRenderedEffTheme = '';

		function updateThemeUI() {
			const eff = effectiveTheme();
			if (themeBtn && lastRenderedEffTheme !== eff) {
				lastRenderedEffTheme = eff;
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

		let fabIdleTimer = null;
		let lastFabWakeFromIdleAt = 0;

		function clearFabIdleTimer() {
			if (fabIdleTimer) {
				clearTimeout(fabIdleTimer);
				fabIdleTimer = null;
			}
		}

		function resetFabIdle(schedule = true) {
			if (!handleEl) return;
			if (handleEl.classList.contains('idle')) {
				lastFabWakeFromIdleAt = Date.now();
				handleEl.classList.remove('idle');
			}
			clearFabIdleTimer();
			if (schedule && !menuOpen && !handleEl.classList.contains('dragging') && !handleEl.classList.contains('hidden')) {
				fabIdleTimer = setTimeout(() => {
					fabIdleTimer = null;
					if (handleEl && !menuOpen && !handleEl.classList.contains('dragging') && !handleEl.classList.contains('hidden')) {
						handleEl.classList.add('idle');
					}
				}, 3000);
			}
		}

		function applyFab() {
			if (!handleEl) return;
			if (host && !host.isConnected) {
				const container = D.documentElement || D.body;
				if (container) {
					try { container.appendChild(host); } catch (e) {}
				}
			}
			const vw = W.innerWidth || D.documentElement.clientWidth || 360;
			const vh = W.innerHeight || D.documentElement.clientHeight || 640;
			const maxLeft = Math.max(FAB_MARGIN, vw - FAB_SIZE - FAB_MARGIN);
			const maxTop = Math.max(FAB_MARGIN, vh - FAB_SIZE - FAB_MARGIN);
			const side = fab.side === 'l' ? 'l' : 'r';
			const targetLeft = side === 'l' ? FAB_MARGIN : maxLeft;
			const left = Math.max(FAB_MARGIN, Math.min(maxLeft, targetLeft));
			const top = Math.max(FAB_MARGIN, Math.min(maxTop, Math.round(fab.y * vh)));
			handleEl.setAttribute('data-side', side);
			handleEl.style.left = left + 'px';
			handleEl.style.top = top + 'px';
			resetFabIdle(!menuOpen);
		}

		function langSetting() { return LANGS.indexOf(config.lang) !== -1 ? config.lang : 'auto'; }

		function setLang(val) {
			config.lang = LANGS.indexOf(val) !== -1 ? val : 'auto';
			saveConfig();
			refreshLanguageUI();
		}

		function refreshLanguageUI() {
			if (sheetBuilt && bodyEl) buildBody();
			if (ubTitleEl) ubTitleEl.textContent = t('ub_ttl');

			const curRemoteVer = String(updateAvailable || VERSION).replace(/^v/i, '');
			if (ubWhatsNewEl) ubWhatsNewEl.textContent = t('ub_whats_new', { ver: curRemoteVer });
			if (ubLaterBtn) ubLaterBtn.textContent = t('ub_ltr');
			if (ubGoBtn) ubGoBtn.textContent = t('ub_now');
			renderUpdateChangelog(updateChangelog);

			if (reportModalEl) {
				const wasOpen = reportModalEl.classList.contains('open');
				reportModalEl.remove();
				reportModalEl = null;
				if (wasOpen) openReportModal();
			}
			if (rulesModalEl) {
				const wasOpen = rulesModalEl.classList.contains('open');
				rulesModalEl.remove();
				rulesModalEl = null;
				if (wasOpen) openRulesModal();
			}
			if (networkModalEl) {
				const wasOpen = networkModalEl.classList.contains('open');
				networkModalEl.remove();
				networkModalEl = null;
				if (wasOpen) openNetworkModal();
			}
			if (pickerEl && !pickerActive) {
				pickerEl.remove();
				if (pickerLabelEl) pickerLabelEl.remove();
				if (pickerBarEl) pickerBarEl.remove();
				pickerEl = pickerLabelEl = pickerBarEl = pickerSliderEl = pickerDepthValEl = pickerSegStepsEl = null;
			}
		}

		function ensureSheetBuilt() {
			if (sheetBuilt && sheetEl) return;
			if (!root) return;

			backdropEl = el('div', { class: 'backdrop' });
			backdropEl.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				setMenu(false);
			});
			root.insertBefore(backdropEl, toastEl);

			sheetEl = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Nvirya AdGuard', 'aria-hidden': 'true', tabindex: '-1', style: { display: 'none' } });
			themeBtn = el('button', {
				class: 'icon-btn',
				type: 'button',
				onclick: (e) => {
					if (e) e.stopPropagation();
					setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark');
				}
			});
			const closeBtn = el('button', {
				class: 'icon-btn',
				type: 'button',
				'aria-label': 'Close',
				onclick: (e) => {
					if (e) {
						e.preventDefault();
						e.stopPropagation();
					}
					setMenu(false);
				}
			}, icon('close'));
			const head = el('div', { class: 'head' },
				el('div', { class: 'titles' },
					el('h1', null, 'Nvirya AdGuard',
						newBadgeEl = el('span', { class: 'new-badge', 'aria-label': 'NEW' }, 'NEW')),
					el('div', { class: 'badge' }, hostname || '(unknown)')
				),
				el('div', { class: 'head-btns' }, themeBtn, closeBtn)
			);
			navBarWrapEl = el('div', { class: 'nav-tabs-wrap' });
			grabEl = el('div', { class: 'grab' }, el('div', { class: 'pill' }), head, navBarWrapEl);
			bodyEl = el('div', { class: 'body' });
			sheetEl.appendChild(grabEl);
			sheetEl.appendChild(bodyEl);
			root.insertBefore(sheetEl, toastEl);

			sheetBuilt = true;
			buildBody();
			applyUpdateBadge();
			wireSheet();
		}

		function build() {
			if (uiReady && host && host.isConnected) return;
			host = document.createElement('div');
			host.setAttribute('data-nvirya-ui', '');
			host.style.cssText = 'all:initial; display:block; position:fixed !important; z-index:2147483647 !important; pointer-events:none !important; top:0; left:0; width:0; height:0; isolation:isolate !important;';
			root = host.attachShadow({ mode: 'open' });
			const style = document.createElement('style');
			style.textContent = CSS;
			root.appendChild(style);

			handleEl = el('div', {
				class: 'handle',
				role: 'button',
				tabindex: '0',
				'aria-label': 'nvirya AdGuard',
				'aria-haspopup': 'dialog',
				'aria-expanded': 'false',
				'data-state': 'ok'
			}, icon('shield'), el('span', { class: 'fab-dot' }));
			root.appendChild(handleEl);

			toastEl = el('div', { class: 'toast', role: 'status' });
			root.appendChild(toastEl);

			updateEl = el('div', { class: 'update-banner', role: 'alert', 'aria-hidden': 'true' },
				el('div', { class: 'ub-row' },
					el('span', { class: 'tile t-blue ub-icon' }, icon('download')),
					el('div', { class: 'ub-txt' },
						ubTitleEl = el('div', { class: 'ub-title' }, t('ub_ttl')),
						el('div', { class: 'ub-ver-row' },
							ubCurVerEl = el('span', { class: 'ub-ver-badge cur' }, 'v' + VERSION),
							el('span', { class: 'ub-ver-arrow', 'aria-hidden': 'true' }, '➔'),
							ubNewVerEl = el('span', { class: 'ub-ver-badge next' }, 'v' + VERSION)
						)
					),
					el('button', { class: 'icon-btn ub-close', type: 'button', 'aria-label': t('ub_ltr'), onclick: () => dismissUpdateBanner() }, icon('close'))
				),
				el('div', { class: 'ub-body' },
					ubWhatsNewEl = el('div', { class: 'ub-whats-new' }, t('ub_whats_new', { ver: String(updateAvailable || VERSION).replace(/^v/i, '') })),
					ubListEl = el('ul', { class: 'ub-changelog' })
				),
				el('div', { class: 'ub-actions' },
					ubLaterBtn = el('button', { class: 'ub-btn later', type: 'button', onclick: () => dismissUpdateBanner() }, t('ub_ltr')),
					ubGoBtn = el('a', {
						class: 'ub-btn go',
						href: INSTALL_URL,
						target: isAppleDevice() ? '_self' : '_blank',
						onclick: () => {
							Updater.snooze();
							hideUpdateBanner();
						}
					}, t('ub_now'))
				)
			);
			root.appendChild(updateEl);
			renderUpdateChangelog([]);

			(D.documentElement || D.body).appendChild(host);

			loadFab();
			updateAvailable = Updater.getAvailable();
			updateChangelog = Updater.getChangelog ? Updater.getChangelog() : [];
			applyTheme();
			applyFab();
			renderStatus();

			if (!config.showFloatingButton) handleEl.classList.add('hidden');

			wireHandle();

			setTimeout(() => {
				if (typeof W.requestIdleCallback === 'function') {
					W.requestIdleCallback(() => ensureSheetBuilt(), { timeout: 2000 });
				} else {
					ensureSheetBuilt();
				}
			}, 3000);

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

		function sectionTitle(txt) { return el('div', { class: 'sec-title' }, txt); }

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

		function switchTab(tabId) {
			const target = (tabId === 'config' || tabId === 'about') ? tabId : 'home';
			activeTab = target;
			for (const id of ['home', 'config', 'about']) {
				if (tabViews[id]) {
					tabViews[id].classList.toggle('active', id === target);
				}
				if (tabBtns[id]) {
					tabBtns[id].setAttribute('aria-selected', String(id === target));
				}
			}
			if (bodyEl) {
				try { bodyEl.scrollTop = 0; } catch (e) {}
			}
		}

		function buildBody() {
			if (!bodyEl) return;
			lastRenderedEffTheme = '';
			statDomCache = null;
			clear(bodyEl);
			if (navBarWrapEl) clear(navBarWrapEl);

			const navBar = el('div', { class: 'nav-tabs', role: 'tablist', 'aria-label': 'Control Panel Navigation' });
			tabBtns = {};
			tabViews = {};

			for (const [id, labelKey] of [
					['home', 'tabHome'],
					['config', 'tabConfig'],
					['about', 'tabAbout']
				]) {
				const btn = el('button', {
					type: 'button',
					class: 'nav-tab-btn',
					role: 'tab',
					'aria-selected': String(activeTab === id),
					onclick: () => switchTab(id)
				}, t(labelKey));
				tabBtns[id] = btn;
				navBar.appendChild(btn);

				tabViews[id] = el('div', {
					class: 'tab-view' + (activeTab === id ? ' active' : ''),
					role: 'tabpanel'
				});
			}
			if (navBarWrapEl) navBarWrapEl.appendChild(navBar);
			else bodyEl.appendChild(navBar);

			const homeView = tabViews.home;
			homeView.appendChild(sectionTitle(t('s_stats')));
			const statSeg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Stats Mode', style: { marginBottom: '8px' } });
			segSessionBtn = el('button', { type: 'button', 'aria-pressed': String(statsMode === 'session'), onclick: () => setStatsMode('session') }, t('this_page'));
			segLifetimeBtn = el('button', { type: 'button', 'aria-pressed': String(statsMode === 'lifetime'), onclick: () => setStatsMode('lifetime') }, t('all_time'));
			statSeg.appendChild(segSessionBtn);
			statSeg.appendChild(segLifetimeBtn);
			homeView.appendChild(statSeg);

			statsEl = el('div', { class: 'stats' });
			homeView.appendChild(statsEl);

			homeView.appendChild(sectionTitle(t('s_act')));
			const actions = el('div', { class: 'group icons' });

			actions.appendChild(item({
				role: 'wl',
				tone: 'green',
				icon: 'allow',
				chevron: true,
				onclick: () => {
					if (isWhitelisted(hostname)) {
						removeWhitelist(hostname);
						toast(t('ts_wlr'));
					} else {
						addWhitelist(hostname);
						toast(t('ts_wla'));
					}
					renderStatus();
					refreshProtection();
				}
			}));
			actions.appendChild(item({
				role: 'td',
				tone: 'orange',
				icon: 'pause',
				chevron: true,
				onclick: () => {
					if (state.sessionDisabled[hostname]) {
						delete state.sessionDisabled[hostname];
						persistSession();
						toast(t('ts_tdo'));
					} else {
						state.sessionDisabled[hostname] = true;
						persistSession();
						toast(t('ts_tdf'));
					}
					renderStatus();
					refreshProtection();
				}
			}));
			actions.appendChild(item({
				label: t('pick'),
				sub: t('pick_s'),
				tone: 'blue',
				icon: 'target',
				chevron: true,
				onclick: () => {
					setMenu(false);
					enterPicker();
				}
			}));
			actions.appendChild(item({
				label: t('rules'),
				sub: t('rules_s'),
				tone: 'blue',
				icon: 'copy',
				chevron: true,
				onclick: () => openRulesModal()
			}));
			actions.appendChild(item({
				label: t('networkRequests'),
				sub: t('networkRequestsSub'),
				tone: 'purple',
				icon: 'globe',
				chevron: true,
				onclick: () => openNetworkModal()
			}));
			actions.appendChild(item({
				label: t('clean'),
				sub: t('clean_s'),
				tone: 'purple',
				icon: 'wand',
				chevron: true,
				onclick: () => {
					cleanPage();
					toast(t('ts_cln'));
				}
			}));
			actions.appendChild(item({
				label: t('peek'),
				sub: t('peek_s'),
				tone: 'orange',
				icon: 'wand',
				chevron: true,
				onclick: () => peekOriginal()
			}));
			actions.appendChild(item({
				label: t('unlock'),
				sub: t('unlock_s'),
				tone: 'green',
				icon: 'undo',
				chevron: true,
				onclick: () => forceUnlockScroll()
			}));
			actions.appendChild(item({
				label: t('undo'),
				sub: t('undo_s'),
				tone: 'gray',
				icon: 'undo',
				chevron: true,
				onclick: () => undoLast()
			}));
			homeView.appendChild(actions);

			const configView = tabViews.config;
			configView.appendChild(sectionTitle(t('s_set')));
			const themeGroup = el('div', { class: 'group pad' });
			const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Theme' });
			segBtns = [];
			for (const [val, label] of [
					['auto', t('t_auto')],
					['light', t('t_light')],
					['dark', t('t_dark')]
				]) {
				const b = el('button', { type: 'button', onclick: () => setTheme(val) }, label);
				b.dataset.val = val;
				segBtns.push(b);
				seg.appendChild(b);
			}
			themeGroup.appendChild(seg);
			configView.appendChild(themeGroup);

			const langGroup = el('div', { class: 'group pad' });
			const langSeg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Language' });
			langBtns = [];
			const curLang = langSetting();
			for (const [val, label] of [
					['auto', t('t_auto')],
					['en', 'EN'],
					['vi', 'VI'],
					['zh-CN', '中文'],
					['ja', 'JP'],
					['ru', 'RU']
				]) {
				const b = el('button', {
					type: 'button',
					'aria-pressed': String(curLang === val),
					onclick: () => setLang(val)
				}, label);
				b.dataset.val = val;
				langBtns.push(b);
				langSeg.appendChild(b);
			}
			langGroup.appendChild(langSeg);
			configView.appendChild(langGroup);

			const swGroup = el('div', { class: 'group', style: { marginTop: '10px' } });

			const createToggleRow = (title, subtitle, isChecked, onChange, opts) => {
				const disabled = !!(opts && opts.disabled);
				const row = el('label', { class: 'item' + (disabled ? ' disabled' : '') });
				const lblEl = el('span', { class: 'lbl' }, title);
				if (opts && opts.helpUrl) {
					const qBtn = el('a', {
						class: 'help-icon-btn',
						href: opts.helpUrl,
						target: '_blank',
						rel: 'noopener noreferrer',
						title: t('helpCenterUnsupportedTooltip') || 'FAQ & Limitations',
						onclick: (e) => e.stopPropagation()
					}, '?');
					lblEl.appendChild(qBtn);
				}
				const txt = el('span', { class: 'txt' },
					lblEl,
					el('span', { class: 'sub' }, subtitle)
				);
				row.appendChild(txt);

				const inp = el('input', { type: 'checkbox', role: 'switch' });
				inp.checked = disabled ? false : isChecked;
				if (disabled) inp.disabled = true;
				inp.addEventListener('change', () => {
					if (disabled) return;
					onChange(inp.checked);
				});

				row.appendChild(el('span', { class: 'switch' }, inp, el('span', { class: 'track' })));
				return row;
			};

			const isSmartShieldActive = config.enabled && config.popupProtection && config.redirectProtection && config.cosmeticFiltering;
			swGroup.appendChild(createToggleRow(
				t('shield'),
				t('shield_s'),
				isSmartShieldActive,
				(val) => {
					config.enabled = val;
					config.popupProtection = val;
					config.redirectProtection = val;
					config.cosmeticFiltering = val;
					saveConfig();
					refreshProtection();
					renderStatus();
					renderStats();
				}
			));

			swGroup.appendChild(createToggleRow(
				t('media'),
				t('media_s'),
				!!config.playerProtection,
				(val) => {
					config.playerProtection = val;
					saveConfig();
				},
				{ helpUrl: 'https://adguard.nvirya.help#limitations' }
			));

			swGroup.appendChild(createToggleRow(
				t('strict'),
				t('strict_s'),
				!!config.strictMode,
				(val) => {
					config.strictMode = val;
					saveConfig();
				}
			));

			swGroup.appendChild(createToggleRow(
				t('smartTrackerTitle'),
				t('smartTrackerSub', { count: learnedTrackersSet.size }),
				!!config.smartTrackerProtection,
				(val) => {
					config.smartTrackerProtection = val;
					saveConfig();
				}
			));

			swGroup.appendChild(createToggleRow(
				t('fab'),
				t('fab_s'),
				!!config.showFloatingButton,
				(val) => {
					config.showFloatingButton = val;
					config.edgeHandle = val;
					if (handleEl) handleEl.classList.toggle('hidden', !val);
					saveConfig();
				}
			));

			const bypassSupported = checkBypassSupport();
			swGroup.appendChild(createToggleRow(
				t('featureBypass'),
				bypassSupported ? t('subBypassSupported') : t('subBypassUnsupported'),
				bypassSupported && !!config.antiAdblock,
				(val) => {
					config.antiAdblock = val;
					saveConfig();
					refreshProtection();
				}, { disabled: !bypassSupported }
			));

			configView.appendChild(swGroup);

			const aboutView = tabViews.about;
			aboutView.appendChild(sectionTitle(t('systemStatus')));
			const compatGroup = el('div', { class: 'compat-group' });
			const createSysRow = (label, valText, toneClass) => {
				const isUnsupported = toneClass === 'unsupported';
				const badgeEl = el(isUnsupported ? 'a' : 'span', {
					class: 'compat-badge ' + (toneClass || 'supported'),
					href: isUnsupported ? 'https://adguard.nvirya.help#limitations' : undefined,
					target: isUnsupported ? '_blank' : undefined,
					rel: isUnsupported ? 'noopener noreferrer' : undefined,
					title: isUnsupported ? t('helpCenterUnsupportedTooltip') : undefined
				}, valText + (isUnsupported ? ' ↗' : ''));
				return el('div', { class: 'compat-row' },
					el('div', { class: 'compat-info' }, el('span', { class: 'compat-name' }, label)),
					badgeEl
				);
			};
			compatGroup.append(
				createSysRow(
					t('sysPlatform'),
					isAppleDevice() ? t('sysPlatformIOS') : t('sysPlatformStd'),
					'neutral'
				),
				createSysRow(
					t('featureBypass'),
					bypassSupported ? t('statusSupported') : t('statusUnsupported'),
					bypassSupported ? 'supported' : 'unsupported'
				),
				createSysRow(
					t('featureNetwork'),
					t('statusSupported'),
					'supported'
				),
				createSysRow(
					t('featurePopup'),
					t('statusSupported'),
					'supported'
				),
				createSysRow(
					t('featureOverlay'),
					t('statusSupported'),
					'supported'
				)
			);
			aboutView.appendChild(compatGroup);

			aboutView.appendChild(sectionTitle(t('s_bak')));
			const shareGroup = el('div', { class: 'group icons' });
			shareGroup.appendChild(item({
				label: t('exp'),
				sub: t('exp_s'),
				tone: 'blue',
				icon: 'copy',
				chevron: true,
				onclick: () => exportSiteRules()
			}));
			shareGroup.appendChild(item({
				label: t('imp'),
				sub: t('imp_s'),
				tone: 'purple',
				icon: 'download',
				chevron: true,
				onclick: () => importSiteRules()
			}));
			shareGroup.appendChild(item({
				label: t('syncRemoteRules'),
				sub: t('syncRemoteRulesSub'),
				tone: 'green',
				icon: 'download',
				chevron: true,
				onclick: () => {
					const prevUrl = store.get(K_SYNC_URL, '') || '';
					const inputUrl = prompt(t('promptSyncUrl'), prevUrl);
					if (inputUrl && inputUrl.trim()) {
						syncRulesFromRawUrl(inputUrl.trim(), false);
					}
				}
			}));
			aboutView.appendChild(shareGroup);

			aboutView.appendChild(sectionTitle(t('s_data')));
			const data = el('div', { class: 'group' });
			data.appendChild(item({
				role: 'upd',
				label: t('upd'),
				sub: t('upd_cur', { ver: VERSION }),
				onclick: () => Updater.check(true)
			}));
			data.appendChild(item({
				label: t('rst_cfg'),
				sub: t('rst_cfg_s'),
				danger: true,
				onclick: () => {
					if (!confirm(t('cf_rst'))) return;
					config = Object.assign({}, DEFAULT_CONFIG);
					saveConfig();
					refreshLanguageUI();
					applyTheme();
					if (handleEl) handleEl.classList.toggle('hidden', !config.showFloatingButton);
					refreshProtection();
					toast(t('ts_rst'));
				}
			}));
			data.appendChild(item({
				label: t('clr_st'),
				sub: t('clr_st_s'),
				danger: true,
				onclick: () => {
					if (!confirm(t('cf_clr'))) return;
					stats.reset();
					renderStats();
					toast(t('ts_clr'));
				}
			}));
			data.appendChild(item({
				label: t('rst_rl'),
				sub: t('rst_rl_s'),
				danger: true,
				onclick: () => {
					if (!confirm(t('cf_rl'))) return;
					delete state.siteRules[hostname];
					persistSiteRules();
					toast(t('ts_rlc'));
					onLocationChange();
				}
			}));
			aboutView.appendChild(data);

			const factoryResetWrap = el('div', { style: { marginTop: '10px' } });
			const factoryResetBtn = el('button', {
				type: 'button',
				class: 'factory-reset-btn',
				style: {
					width: '100%',
					padding: '13px 16px',
					background: 'rgba(255, 59, 48, 0.12)',
					color: '#ff3b30',
					border: '1px solid rgba(255, 59, 48, 0.28)',
					borderRadius: '12px',
					fontSize: '13.5px',
					fontWeight: '600',
					cursor: 'pointer',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					gap: '3px',
					textAlign: 'center',
					transition: 'all .2s ease'
				}
			});

			let resetConfirmState = false;
			let resetTimer = null;

			const renderResetBtn = () => {
				clear(factoryResetBtn);
				if (!resetConfirmState) {
					factoryResetBtn.append(
						el('span', { style: { fontSize: '13.5px', fontWeight: '700' } }, t('factoryResetTitle')),
						el('span', { style: { fontSize: '11px', opacity: '0.8', fontWeight: '400' } }, t('factoryResetSub'))
					);
					factoryResetBtn.style.background = 'rgba(255, 59, 48, 0.12)';
					factoryResetBtn.style.borderColor = 'rgba(255, 59, 48, 0.28)';
				} else {
					factoryResetBtn.style.background = 'rgba(255, 59, 48, 0.22)';
					factoryResetBtn.style.borderColor = '#ff3b30';
					const confirmTxt = el('span', { style: { fontSize: '12.5px', fontWeight: '700', marginBottom: '6px' } }, t('factoryResetConfirmShort'));
					const btnRow = el('div', { style: { display: 'flex', gap: '8px', width: '100%', justifyContent: 'center' } },
						el('button', {
							type: 'button',
							style: {
								flex: '1',
								padding: '7px 12px',
								background: '#ff3b30',
								color: '#fff',
								border: 'none',
								borderRadius: '8px',
								fontWeight: '700',
								fontSize: '12.5px',
								cursor: 'pointer'
							},
							onclick: (e) => {
								e.stopPropagation();
								performFactoryReset();
							}
						}, t('factoryResetDeleteAll')),
						el('button', {
							type: 'button',
							style: {
								flex: '1',
								padding: '7px 12px',
								background: 'var(--card-bg, #fff)',
								color: 'var(--fg, #000)',
								border: '1px solid var(--border)',
								borderRadius: '8px',
								fontWeight: '600',
								fontSize: '12.5px',
								cursor: 'pointer'
							},
							onclick: (e) => {
								e.stopPropagation();
								resetConfirmState = false;
								if (resetTimer) clearTimeout(resetTimer);
								renderResetBtn();
							}
						}, t('cancel'))
					);
					factoryResetBtn.append(confirmTxt, btnRow);
				}
			};

			factoryResetBtn.onclick = () => {
				if (!resetConfirmState) {
					resetConfirmState = true;
					renderResetBtn();
					resetTimer = setTimeout(() => {
						resetConfirmState = false;
						renderResetBtn();
					}, 6000);
				}
			};
			renderResetBtn();
			factoryResetWrap.appendChild(factoryResetBtn);
			aboutView.appendChild(factoryResetWrap);

			aboutView.appendChild(sectionTitle(t('helpCenterSection')));
			const helpGroup = el('div', { class: 'group icons' });
			helpGroup.appendChild(item({
				label: t('helpCenterTitle'),
				sub: t('helpCenterSub'),
				tone: 'blue',
				icon: 'globe',
				chevron: true,
				onclick: () => {
					try { W.open('https://adguard.nvirya.help', '_blank', 'noopener,noreferrer'); } catch (e) { location.href = 'https://adguard.nvirya.help'; }
				}
			}));
			aboutView.appendChild(helpGroup);

			aboutView.appendChild(sectionTitle(t('s_dbg')));
			const dbg = el('div', { class: 'group icons' });
			dbg.appendChild(item({
				label: t('dbg_cp'),
				sub: t('dbg_cp_s'),
				tone: 'gray',
				icon: 'copy',
				onclick: () => {
					const info = collectDebugInfo();
					try {
						navigator.clipboard.writeText(info);
						toast(t('ts_dbg'));
					} catch (e) {
						console.log(info);
						toast(t('ts_con'));
					}
				}
			}));
			aboutView.appendChild(dbg);

			aboutView.appendChild(sectionTitle(t('contactAuthor')));
			const aboutCard = el('div', { class: 'about-card' },
				el('div', { class: 'about-head' },
					el('span', { class: 'about-title' }, 'Nvirya AdGuard'),
					el('span', { class: 'about-ver' }, 'v' + VERSION)
				),
				el('div', { class: 'about-desc' }, t('aboutDesc')),
				el('div', { class: 'about-links' },
					el('a', {
						class: 'about-link',
						href: 'https://t.me/nvirya',
						target: '_blank',
						rel: 'noopener noreferrer'
					}, icon('telegram'), 'Telegram'),
					el('a', {
						class: 'about-link',
						href: 'https://discord.com/users/572814019929571328',
						target: '_blank',
						rel: 'noopener noreferrer'
					}, icon('discord'), 'Discord'),
					el('a', {
						class: 'about-link',
						href: 'https://adguard.nvirya.help',
						target: '_blank',
						rel: 'noopener noreferrer'
					}, icon('globe'), 'FAQ & Help'),
					el('button', {
						type: 'button',
						class: 'about-link',
						onclick: () => openReportModal()
					}, icon('flag'), t('reportBtnShort'))
				)
			);
			aboutView.appendChild(aboutCard);
			aboutView.appendChild(el('div', { class: 'footer' }, 'Nvirya AdGuard v' + VERSION));

			bodyEl.append(homeView, configView, aboutView);

			updateThemeUI();
			renderStatus();
			renderStats();
			renderUpdateItem();
		}

		function renderUpdateItem() {
			if (!bodyEl) return;
			const b = bodyEl.querySelector('[data-role="upd"]');
			if (!b) return;
			const s = b.querySelector('.sub');
			if (!s) return;
			if (updateChecking) s.textContent = t('upd_chk');
			else if (updateAvailable) s.textContent = t('upd_new', { remote: updateAvailable, ver: VERSION });
			else s.textContent = t('upd_cur', { ver: VERSION });
		}

		function applyUpdateBadge() {
			if (newBadgeEl) newBadgeEl.classList.toggle('show', !!updateAvailable);
		}

		function renderUpdateChangelog(list) {
			if (!ubListEl) return;
			clear(ubListEl);
			const lang = getEffectiveLang();
			const hasLocalDefs = Boolean(TRANSLATIONS[lang] && TRANSLATIONS[lang].ub_def_1);
			let items;
			if (lang !== 'en' && hasLocalDefs) {
				items = [t('ub_def_1'), t('ub_def_2'), t('ub_def_3')].filter(Boolean);
			} else if (Array.isArray(list) && list.length) {
				items = list;
			} else {
				items = [t('ub_def_1'), t('ub_def_2'), t('ub_def_3')].filter(Boolean);
			}
			for (let i = 0; i < items.length; i++) {
				const text = String(items[i] || '').replace(/^\[Task\s*\d+\]\s*/i, '').trim();
				if (!text || /^v\d+\.\d+.*:$/i.test(text)) continue;
				ubListEl.appendChild(el('li', {}, text));
			}
		}

		function setUpdateAvailable(ver, changelog) {
			if (ver && typeof ver === 'object') {
				updateAvailable = ver.version || null;
				if (Array.isArray(ver.changelog)) updateChangelog = ver.changelog;
			} else {
				updateAvailable = ver || null;
				if (Array.isArray(changelog)) updateChangelog = changelog;
			}
			applyUpdateBadge();
			renderUpdateItem();
		}

		function setUpdateChecking(on) {
			updateChecking = !!on;
			renderUpdateItem();
		}

		function showUpdateBanner(verOrPayload, optionalChangelog) {
			if (!updateEl) return;
			if (verOrPayload) {
				if (typeof verOrPayload === 'object') {
					setUpdateAvailable(verOrPayload.version, verOrPayload.changelog);
				} else {
					setUpdateAvailable(verOrPayload, optionalChangelog);
				}
			}
			if (!updateAvailable) return;
			const cleanRemoteVer = String(updateAvailable).replace(/^v/i, '');
			if (ubTitleEl) ubTitleEl.textContent = t('ub_ttl');
			if (ubCurVerEl) ubCurVerEl.textContent = 'v' + VERSION;
			if (ubNewVerEl) ubNewVerEl.textContent = 'v' + cleanRemoteVer;
			if (ubWhatsNewEl) ubWhatsNewEl.textContent = t('ub_whats_new', { ver: cleanRemoteVer });
			renderUpdateChangelog(updateChangelog);
			if (ubLaterBtn) ubLaterBtn.textContent = t('ub_ltr');
			if (ubGoBtn) ubGoBtn.textContent = t('ub_now');
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
			let tone = 'ok';
			if (!config.enabled) {
				tone = 'off';
			} else if (state.sessionDisabled[hostname]) {
				tone = 'warn';
			} else if (isWhitelisted(hostname)) {
				tone = 'warn';
			}

			if (handleEl) handleEl.setAttribute('data-state', tone);
			if (!bodyEl) return;

			const setItem = (role, label2, sub2) => {
				const b = bodyEl.querySelector('[data-role="' + role + '"]');
				if (!b) return;
				const l = b.querySelector('.lbl'),
					s = b.querySelector('.sub');
				if (l) l.textContent = label2;
				if (s) s.textContent = sub2;
			};
			const wl = isWhitelisted(hostname);
			setItem('wl', wl ? t('wl_rem') : t('wl_add'),
				wl ? t('wl_rem_s') : t('wl_add_s'));
			const sd = !!state.sessionDisabled[hostname];
			setItem('td', sd ? t('td_on') : t('td_off'),
				sd ? t('td_on_s') : t('td_off_s'));
		}

		let selectedChartDay = null;
		let statDomCache = null;

		function ensureStatsDomBuilt() {
			if (!statsEl) return null;
			if (statDomCache && statDomCache.root === statsEl && statsEl.firstChild) {
				return statDomCache;
			}
			clear(statsEl);
			const cards = [];
			for (let i = 0; i < 4; i++) {
				const bEl = el('b', null, '0');
				const titleEl = el('span', null, '');
				const subEl = el('small', { class: 'stat-sub' }, '');
				const statCard = el('div', { class: 'stat' }, bEl, titleEl, subEl);
				statsEl.appendChild(statCard);
				cards.push({ bEl, titleEl, subEl });
			}

			const chartTitleEl = el('span', { class: 'chart-title' }, t('s_week'));
			const detailTextEl = el('span', { class: 'chart-detail' }, '');
			const chartHead = el('div', { class: 'chart-head' }, chartTitleEl, detailTextEl);
			const barsContainer = el('div', { class: 'chart-bars' });
			const cols = [];

			for (let i = 0; i < 7; i++) {
				const fill = el('div', { class: 'chart-bar-fill', style: { height: '0%' } });
				const barBg = el('div', { class: 'chart-bar-bg' }, fill);
				const dayLabel = el('span', { class: 'chart-day' }, '');
				const colObj = { col: null, fill, dayLabel, key: '', isFuture: false };
				const col = el('div', {
					class: 'chart-col',
					onclick: (e) => {
						if (colObj.isFuture || !colObj.key) return;
						e.stopPropagation();
						selectedChartDay = colObj.key;
						renderStats();
					}
				}, barBg, dayLabel);
				colObj.col = col;
				cols.push(colObj);
				barsContainer.appendChild(col);
			}

			const chartCard = el('div', { class: 'chart-card' }, chartHead, barsContainer);
			statsEl.appendChild(chartCard);

			statDomCache = { root: statsEl, cards, chartTitleEl, detailTextEl, cols };
			return statDomCache;
		}

		function renderStats() {
			if (!stats._loaded) stats.load();
			if (!statsEl) return;
			const cache = ensureStatsDomBuilt();
			if (!cache) return;

			const currentData = statsMode === 'session' ? stats.session : stats.lifetime;
			const secondaryData = statsMode === 'session' ? stats.lifetime : stats.session;
			const secLabel = statsMode === 'session' ? t('all_pre') : t('page_pre');

			const rows = [
				[t('ads_rem'), currentData.ads, secondaryData.ads, t('ads_rem_s')],
				[t('el_hid'), currentData.hidden, secondaryData.hidden, ''],
				[t('pop_blk'), currentData.popups, secondaryData.popups, ''],
				[t('req_blk'), currentData.requests, secondaryData.requests, ''],
			];

			for (let i = 0; i < 4; i++) {
				const r = rows[i];
				const c = cache.cards[i];
				const subPrefix = r[3] ? (r[3] + ' · ') : '';
				const valStr = fmt(r[1]);
				const subStr = subPrefix + secLabel + fmt(r[2]);
				if (c.bEl.textContent !== valStr) c.bEl.textContent = valStr;
				if (c.titleEl.textContent !== r[0]) c.titleEl.textContent = r[0];
				if (c.subEl.textContent !== subStr) c.subEl.textContent = subStr;
			}

			const weeklyData = store.get(K_WEEKLY, {}) || {};
			const now = new Date();
			const todayKey = getTodayKey(now);

			const dayOfWeek = now.getDay();
			const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
			const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);

			const dayNames = String(t('days')).split('|');
			const weekDays = [];
			let maxVal = 10;

			for (let i = 0; i < 7; i++) {
				const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
				const key = getTodayKey(d);
				const count = weeklyData[key] || 0;
				const isToday = key === todayKey;
				const isFuture = d.getTime() > now.getTime() && !isToday;

				if (count > maxVal) maxVal = count;
				weekDays.push({ key, label: dayNames[i] || '', count, isToday, isFuture });
			}

			const activeKey = selectedChartDay || todayKey;
			const activeDayObj = weekDays.find(d => d.key === activeKey) || weekDays.find(d => d.isToday) || weekDays[0];
			const activePrefix = activeDayObj.isToday ? t('today') : `${activeDayObj.label} (${activeDayObj.key.slice(5)})`;

			const weekTitle = t('s_week');
			const detailStr = `${activePrefix}: ${fmt(activeDayObj.count)} ${t('ads_u')}`;
			if (cache.chartTitleEl.textContent !== weekTitle) cache.chartTitleEl.textContent = weekTitle;
			if (cache.detailTextEl.textContent !== detailStr) cache.detailTextEl.textContent = detailStr;

			for (let i = 0; i < 7; i++) {
				const day = weekDays[i];
				const colObj = cache.cols[i];
				const pct = day.count > 0 ? Math.max(16, Math.round((day.count / maxVal) * 100)) : 0;
				colObj.key = day.key;
				colObj.isFuture = day.isFuture;
				const hStr = pct + '%';
				if (colObj.fill.style.height !== hStr) colObj.fill.style.height = hStr;
				if (colObj.dayLabel.textContent !== day.label) colObj.dayLabel.textContent = day.label;
				let colClass = 'chart-col';
				if (day.key === activeDayObj.key) colClass += ' active';
				if (day.isFuture) colClass += ' future';
				if (colObj.col.className !== colClass) colObj.col.className = colClass;
			}
		}

		let sheetCloseTimer = null;
		let sheetTransitionEndHandler = null;

		function setMenu(open) {
			if (open) ensureSheetBuilt();
			if (!sheetEl || !backdropEl) return;
			menuOpen = !!open;

			if (sheetCloseTimer) {
				clearTimeout(sheetCloseTimer);
				sheetCloseTimer = null;
			}
			if (sheetTransitionEndHandler) {
				sheetEl.removeEventListener('transitionend', sheetTransitionEndHandler);
				sheetTransitionEndHandler = null;
			}

			if (host) {
				host.style.pointerEvents = menuOpen ? 'auto' : 'none';
			}
			if (handleEl) {
				handleEl.classList.toggle('away', menuOpen);
				handleEl.setAttribute('aria-expanded', String(menuOpen));
				resetFabIdle(!menuOpen);
			}
			sheetEl.setAttribute('aria-hidden', String(!menuOpen));

			if (statsTimer) {
				clearInterval(statsTimer);
				statsTimer = null;
			}

			if (menuOpen) {
				sheetEl.style.display = 'flex';
				void sheetEl.offsetHeight;
				requestAnimationFrame(() => {
					if (!menuOpen) return;
					sheetEl.classList.add('open');
					backdropEl.classList.add('open');
					renderStatus();
					renderStats();
					updateThemeUI();
				});
				statsTimer = setInterval(renderStats, 1000);
			} else {
				sheetEl.classList.remove('open');
				backdropEl.classList.remove('open');
				const onFinishClose = (ev) => {
					if (ev && ev.target !== sheetEl) return;
					if (sheetTransitionEndHandler) {
						sheetEl.removeEventListener('transitionend', sheetTransitionEndHandler);
						sheetTransitionEndHandler = null;
					}
					if (sheetCloseTimer) {
						clearTimeout(sheetCloseTimer);
						sheetCloseTimer = null;
					}
					if (!menuOpen && sheetEl) {
						sheetEl.style.display = 'none';
					}
				};
				sheetTransitionEndHandler = onFinishClose;
				sheetEl.addEventListener('transitionend', onFinishClose);
				sheetCloseTimer = setTimeout(() => onFinishClose(null), 350);
			}
		}

		function wireHandle() {
			let drag = null;
			let lastPageScrollAt = 0;

			const markPageScroll = () => {
				lastPageScrollAt = Date.now();
				if (drag) {
					drag.isScrollingOrDragging = true;
				}
			};
			try {
				W.addEventListener('scroll', markPageScroll, { passive: true, capture: true });
				D.addEventListener('touchmove', (e) => {
					if (!drag) lastPageScrollAt = Date.now();
				}, { passive: true, capture: true });

				// FAB sits at max z-index inside Shadow DOM; never delete underlying page elements on tap
			} catch (e) {}

			handleEl.addEventListener('mouseenter', (e) => {
				if (e.pointerType === 'touch') return;
				resetFabIdle(true);
			});
			handleEl.addEventListener('mouseleave', () => resetFabIdle(true));
			handleEl.addEventListener('blur', () => resetFabIdle(true));

			handleEl.addEventListener('pointerdown', (e) => {
				if (e.pointerType === 'mouse' && e.button !== 0) return;
				const wasIdle = handleEl.classList.contains('idle') || (e.pointerType !== 'mouse' && (Date.now() - lastFabWakeFromIdleAt < 120));
				const r = handleEl.getBoundingClientRect();
				drag = {
					sx: e.clientX,
					sy: e.clientY,
					ox: r.left,
					oy: r.top,
					startTime: Date.now(),
					wasIdle,
					isScrollingOrDragging: (Date.now() - lastPageScrollAt) < 160,
					moved: false
				};
				clearFabIdleTimer();
				try { handleEl.setPointerCapture(e.pointerId); } catch (er) {}
			});

			handleEl.addEventListener('pointermove', (e) => {
				if (!drag) return;
				const dx = e.clientX - drag.sx,
					dy = e.clientY - drag.sy;
				const dist = Math.hypot(dx, dy);
				if (!drag.moved) {
					if (dist <= 8) return;
					drag.isScrollingOrDragging = true;
					drag.moved = true;
					handleEl.classList.remove('idle');
					handleEl.classList.add('dragging');
					resetFabIdle(false);
				}
				const vw = D.documentElement.clientWidth || W.innerWidth;
				const vh = W.innerHeight;
				handleEl.style.left = Math.max(4, Math.min(vw - FAB_SIZE - 4, drag.ox + dx)) + 'px';
				handleEl.style.top = Math.max(4, Math.min(vh - FAB_SIZE - 4, drag.oy + dy)) + 'px';
			});

			const endDrag = (e, cancelled) => {
				if (!drag) return;
				const d = drag;
				drag = null;
				handleEl.classList.remove('dragging');
				try { handleEl.releasePointerCapture(e.pointerId); } catch (er) {}

				if (d.moved) {
					const r = handleEl.getBoundingClientRect();
					const vw = D.documentElement.clientWidth || W.innerWidth;
					const vh = W.innerHeight || 1;
					fab = { side: (r.left + r.width / 2) < vw / 2 ? 'l' : 'r', y: Math.max(0, Math.min(1, r.top / vh)) };
					store.set(K_FAB, fab);
					applyFab();
					return;
				}

				if (cancelled || d.isScrollingOrDragging || (Date.now() - lastPageScrollAt) < 160) {
					resetFabIdle(!menuOpen);
					return;
				}

				if (d.wasIdle || handleEl.classList.contains('idle')) {
					resetFabIdle(true);
					return;
				}

				setMenu(!menuOpen);
			};

			handleEl.addEventListener('pointerup', (e) => endDrag(e, false));
			handleEl.addEventListener('pointercancel', (e) => endDrag(e, true));
			handleEl.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					if (handleEl.classList.contains('idle')) {
						resetFabIdle(true);
					} else {
						setMenu(!menuOpen);
					}
				}
			});

			D.addEventListener('keydown', (e) => {
				const activeTag = (D.activeElement && D.activeElement.tagName) || '';
				const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || (D.activeElement && D.activeElement.isContentEditable);

				if (e.key === 'Escape') {
					if (pickerActive) exitPicker(true);
					else if (networkModalEl && networkModalEl.classList.contains('open')) closeNetworkModal();
					else if (rulesModalEl && rulesModalEl.classList.contains('open')) closeRulesModal();
					else if (reportModalEl && reportModalEl.classList.contains('open')) closeReportModal();
					else if (menuOpen) setMenu(false);
				} else if (e.altKey && (e.key === 'a' || e.key === 'A' || e.code === 'KeyA')) {
					e.preventDefault();
					setMenu(!menuOpen);
				} else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !menuOpen && !pickerActive && !isTyping) {
					e.preventDefault();
					undoLast();
				}
			}, true);
		}

		function isSheetMode() {
			try { return !W.matchMedia('(min-width: 641px)').matches; } catch (e) { return (W.innerWidth || 0) <= 640; }
		}

		function wireSheet() {
			let tracking = false,
				dragging = false,
				fromGrab = false;
			let x0 = 0,
				y0 = 0,
				t0 = 0,
				dy = 0;

			const reset = () => {
				sheetEl.style.transition = '';
				sheetEl.style.transform = '';
				backdropEl.style.transition = '';
				backdropEl.style.opacity = '';
			};

			sheetEl.addEventListener('touchstart', (e) => {
				if (!menuOpen || !isSheetMode() || !e.touches || e.touches.length !== 1) { tracking = false; return; }
				tracking = true;
				dragging = false;
				dy = 0;
				x0 = e.touches[0].clientX;
				y0 = e.touches[0].clientY;
				t0 = Date.now();
				fromGrab = !!(grabEl && grabEl.contains(e.target));
			}, { passive: true });

			sheetEl.addEventListener('touchmove', (e) => {
				if (!tracking || !e.touches || !e.touches.length) return;
				const x = e.touches[0].clientX,
					y = e.touches[0].clientY;
				const rawY = y - y0,
					rawX = x - x0;
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

		function toast(msg, actionOpts) {
			if (!toastEl) return;
			if (msg === lastToast && toastTimer && !actionOpts) return;
			lastToast = msg;
			clear(toastEl);
			toastEl.classList.toggle('top', menuOpen);
			toastEl.style.top = (menuOpen && updateEl && updateEl.classList.contains('show')) ?
				'calc(' + (updateEl.offsetHeight + 22) + 'px + env(safe-area-inset-top, 0px))' : '';

			const txtNode = el('span', null, msg);
			toastEl.appendChild(txtNode);

			if (actionOpts && actionOpts.actionText && typeof actionOpts.onAction === 'function') {
				const actBtn = el('button', {
					type: 'button',
					class: 'toast-act-btn',
					style: {
						marginLeft: '10px',
						padding: '3px 10px',
						borderRadius: '999px',
						background: 'var(--accent)',
						color: '#fff',
						border: 'none',
						fontWeight: '600',
						fontSize: '12px',
						cursor: 'pointer'
					},
					onclick: (e) => {
						e.stopPropagation();
						actionOpts.onAction();
					}
				}, actionOpts.actionText);
				toastEl.appendChild(actBtn);
				toastEl.style.pointerEvents = 'auto';
			} else {
				toastEl.style.pointerEvents = 'none';
			}

			toastEl.classList.add('show');
			if (toastTimer) clearTimeout(toastTimer);
			toastTimer = setTimeout(() => {
				toastEl.classList.remove('show');
				toastEl.style.pointerEvents = 'none';
				toastTimer = null;
				lastToast = '';
			}, actionOpts ? 4200 : 2200);
		}

		function performFactoryReset() {
			const allKeys = [
				K_CFG, K_WL, K_SR, K_BLOCKED, K_USER_ALLOWED_NET, K_USER_BLOCKED_NET,
				K_TRACKER_MAP, K_LEARNED_TRACKERS, K_SYNC_URL, K_SYNC_TIME,
				K_ST, K_SESS, K_WEEKLY, K_LAST_REP,
				K_UPD_LAST, K_UPD_REMOTE, K_UPD_CHANGELOG, K_UPD_SNOOZE
			];
			allKeys.forEach(k => {
				try {
					if (typeof GM_deleteValue === 'function') GM_deleteValue(k);
				} catch (e) {}
				store.del(k);
			});
			try {
				const ls = W.localStorage;
				if (ls) {
					const toRemove = [];
					for (let i = 0; i < ls.length; i++) {
						const k = ls.key(i);
						if (k && (k.startsWith('nvirya_') || k.startsWith('adguard_'))) {
							toRemove.push(k);
						}
					}
					toRemove.forEach(k => { try { ls.removeItem(k); } catch (e) {} });
				}
			} catch (e) {}
			try {
				const ss = W.sessionStorage;
				if (ss) {
					const toRemove = [];
					for (let i = 0; i < ss.length; i++) {
						const k = ss.key(i);
						if (k && (k.startsWith('nvirya_') || k.startsWith('adguard_'))) {
							toRemove.push(k);
						}
					}
					toRemove.forEach(k => { try { ss.removeItem(k); } catch (e) {} });
				}
			} catch (e) {}

			toast(t('factoryResetSuccess'));
			setTimeout(() => {
				try { location.reload(); } catch (e) { location.href = location.href; }
			}, 800);
		}

		function updateUIStatus() {
			renderStatus();
			renderStats();
		}

		function syncReportFormMode() {
			if (!reportReasonSelect || !reportNoteInput) return;
			const isFeature = reportReasonSelect.value === 'Feature request';
			reportNoteInput.placeholder = isFeature ? t('placeholderFeature') : t('placeholderBug');
			if (reportNoteLblEl) {
				reportNoteLblEl.textContent = isFeature ? t('rep_feat_lbl') : t('rp_nt');
			}
		}

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
					el('h2', null, t('rp_ttl')),
					el('div', { class: 'badge', style: { marginTop: '2px' } }, hostname || '(unknown)')
				),
				closeBtn
			);

			reportReasonSelect = el('select', {
					class: 'report-select',
					onchange: () => syncReportFormMode()
				},
				el('option', { value: 'Missed ad' }, t('rp_m1')),
				el('option', { value: 'Broken layout' }, t('rp_m2')),
				el('option', { value: 'Player issue' }, t('rp_m3')),
				el('option', { value: 'Feature request' }, t('rp_m4')),
				el('option', { value: 'Other' }, t('rp_m5'))
			);

			const isYt = isYouTubeDomain(hostname);
			reportPreNoticeEl = el('div', {
				class: 'report-prenotice' + (isYt ? ' highlighted' : '')
			},
				el('span', null, t('reportPreNoticeText') + ' '),
				el('a', {
					href: 'https://adguard.nvirya.help',
					target: '_blank',
					rel: 'noopener noreferrer'
				}, t('reportPreNoticeLink'))
			);

			reportNoteLblEl = el('div', { class: 'report-lbl' }, t('rp_nt'));

			reportNoteInput = el('textarea', {
				class: 'report-textarea',
				placeholder: t('placeholderBug'),
				rows: '3'
			});

			const cancelBtn = el('button', {
				class: 'report-btn cancel',
				type: 'button',
				onclick: () => closeReportModal()
			}, t('cancel'));

			const submitBtn = el('button', {
				class: 'report-btn submit',
				type: 'button',
				onclick: () => submitReport()
			}, t('rp_send'));

			const actions = el('div', { class: 'report-actions' }, cancelBtn, submitBtn);

			const card = el('div', { class: 'report-card' },
				head,
				el('div', { class: 'report-lbl' }, t('rp_rsn')),
				reportReasonSelect,
				reportPreNoticeEl,
				reportNoteLblEl,
				reportNoteInput,
				actions
			);

			reportModalEl = el('div', { class: 'report-modal' }, card);
			root.appendChild(reportModalEl);
		}

		function openReportModal() {
			if (!reportModalEl) buildReportModal();
			if (reportNoteInput) reportNoteInput.value = '';
			syncReportFormMode();
			if (reportPreNoticeEl) {
				const isYt = isYouTubeDomain(hostname);
				reportPreNoticeEl.classList.toggle('highlighted', isYt);
			}
			reportModalEl.classList.add('open');
			if (host) host.style.pointerEvents = 'auto';
		}

		function closeReportModal() {
			if (reportModalEl) reportModalEl.classList.remove('open');
			if (host && !menuOpen) host.style.pointerEvents = 'none';
		}

		function submitReport() {
			const reason = (reportReasonSelect && reportReasonSelect.value) || 'Missed ad';
			const note = (reportNoteInput && reportNoteInput.value.trim()) || '';
			const isFeatureRequest = reason === 'Feature request';

			if (isFeatureRequest && !note) {
				toast(t('toastEmptyNote'));
				if (reportNoteInput) {
					try { reportNoteInput.focus(); } catch (e) {}
				}
				return;
			}

			const lastMap = store.get(K_LAST_REP, {}) || {};
			const lastTime = lastMap[hostname] || 0;
			const elapsed = Date.now() - lastTime;
			if (elapsed < 30000) {
				const waitSec = Math.ceil((30000 - elapsed) / 1000);
				toast(t('ts_wait', { sec: waitSec }));
				return;
			}

			const webhookUrl = getWebhookTarget();
			if (!webhookUrl) {
				toast(t('ts_nohk'));
				closeReportModal();
				return;
			}

			let payload;
			if (isFeatureRequest) {
				payload = {
					username: 'Nvirya AdGuard Feedback',
					avatar_url: 'https://raw.nvirya.com/assets/icon.png',
					embeds: [{
						title: 'Đề xuất tính năng mới',
						color: 3447003,
						fields: [
							{ name: 'Nội dung đề xuất', value: (note || '(Không có nội dung)').slice(0, 1000) },
							{ name: 'Phiên bản đang dùng', value: 'v' + VERSION, inline: true },
							{ name: 'Nền tảng / Thiết bị', value: isAppleDevice() ? 'iOS / iPadOS' : 'Android / Desktop', inline: true }
						],
						footer: { text: 'Nvirya AdGuard Idea Box' },
						timestamp: new Date().toISOString()
					}]
				};
			} else {
				const cleanUrl = getSanitizedUrl().slice(0, 1000);
				const recentLogs = (logRing.slice(-4).map(e => `[${e.level}] ${e.type}: ${e.msg} ${e.extra || ''}`).join('\n') || 'No logs').slice(0, 900);
				const embedColor = reason === 'Missed ad' ? 15158332 :
					(reason === 'Broken layout' || reason === 'Player issue') ? 16107018 : 10181046;

				payload = {
					username: 'Nvirya AdGuard Reporter',
					avatar_url: 'https://raw.nvirya.com/assets/icon.png',
					embeds: [{
						title: 'Báo cáo sự cố: ' + reason,
						color: embedColor,
						fields: [
							{ name: 'Domain', value: hostname || 'unknown', inline: true },
							{ name: 'Phiên bản', value: 'v' + VERSION, inline: true },
							{ name: 'Lý do', value: reason, inline: true },
							{ name: 'URL (Sanitized)', value: cleanUrl || 'unknown' },
							{ name: 'Ghi chú', value: (note || '(Không có)').slice(0, 1000) },
							{
								name: 'Thống kê chặn',
								value: `• **Session:** ${stats.session.ads} ads, ${stats.session.hidden} hidden, ${stats.session.popups} popups\n• **Lifetime:** ${stats.lifetime.ads} ads, ${stats.lifetime.hidden} hidden`
							},
							{ name: 'Logs gần nhất', value: '```text\n' + recentLogs + '\n```' },
							{ name: 'User Agent', value: '```\n' + (navigator.userAgent || 'unknown').slice(0, 200) + '\n```' }
						],
						footer: { text: 'Nvirya AdGuard Security Report' },
						timestamp: new Date().toISOString()
					}]
				};
			}

			const onSuccess = () => {
				lastMap[hostname] = Date.now();
				store.set(K_LAST_REP, lastMap);
				toast(t('ts_rpok'));
				closeReportModal();
			};

			const onError = (msg) => {
				toast(t('ts_rperr', { msg: msg || 'Connection error' }));
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
			for (const h in rules) {
				if (Array.isArray(rules[h])) totalRules += rules[h].length;
			}
			if (totalRules === 0) {
				toast(t('ts_noexp'));
				return;
			}
			const jsonStr = JSON.stringify(rules, null, 2);

			const fallback = () => prompt(t('pr_json'), jsonStr);
			try {
				if (navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(jsonStr).then(() => {
						toast(t('ts_exp', { count: totalRules }));
					}).catch(fallback);
				} else {
					fallback();
				}
			} catch (e) {
				fallback();
			}
		}

		function importSiteRules() {
			const input = prompt(t('pr_imp'));
			if (!input || !input.trim()) return;
			const raw = input.trim();
			let parsed = null;

			try {
				parsed = JSON.parse(raw);
			} catch (e) {
				try {
					const decoded = decodeURIComponent(escape(atob(raw)));
					parsed = JSON.parse(decoded);
				} catch (e2) {}
			}

			if (Array.isArray(parsed)) {
				const currentHost = hostname.toLowerCase();
				const formattedList = parsed.map(item => {
					if (typeof item === 'string') return { selector: item, action: 'hide', created: Date.now() };
					return item;
				}).filter(item => item && item.selector);
				parsed = {
					[currentHost]: formattedList
				};
			}

			if (!parsed || typeof parsed !== 'object') {
				toast(t('ts_ibad'));
				return;
			}

			let mergedCount = 0;
			if (!state.siteRules) state.siteRules = {};

			for (const hostKey of Object.keys(parsed)) {
				const hostRules = parsed[hostKey];
				if (!Array.isArray(hostRules)) continue;
				const normHost = hostKey.toLowerCase().trim();
				if (!state.siteRules[normHost]) state.siteRules[normHost] = [];

				const existingSelectors = new Set(state.siteRules[normHost].map(r => r.selector));
				for (const rule of hostRules) {
					const sel = typeof rule === 'string' ? rule : (rule && rule.selector);
					if (sel && !existingSelectors.has(sel)) {
						state.siteRules[normHost].push({
							selector: sel,
							action: (rule && rule.action) || 'hide',
							created: (rule && rule.created) || Date.now()
						});
						existingSelectors.add(sel);
						mergedCount++;
					}
				}
			}

			persistSiteRules();
			installSiteRulesCSS();
			initialScan();
			toast(t('ts_imp', { count: mergedCount }));
		}

		let blockBtn = null,
			blockAllBtn = null,
			pickerSliderEl = null,
			pickerDepthValEl = null,
			pickerSegStepsEl = null,
			pickerChain = [];

		function buildPickerChain(startEl) {
			const chain = [];
			let cur = startEl;
			while (cur && cur.nodeType === 1 && chain.length <= 6) {
				const tag = String(cur.tagName || '').toLowerCase();
				if (tag === 'body' || tag === 'html') break;
				if (isNviryaNode(cur)) break;
				chain.push(cur);
				cur = cur.parentElement;
			}
			return chain;
		}

		function syncPickerSliderVisual(idx, maxIdx) {
			const total = Math.max(1, maxIdx + 1);
			const ratio = maxIdx > 0 ? (idx / maxIdx) : 0;
			if (pickerSliderEl) {
				pickerSliderEl.style.setProperty('--p-ratio', String(ratio));
			}
			if (pickerDepthValEl) {
				pickerDepthValEl.textContent = t('p_depth', { current: idx + 1, total });
				pickerDepthValEl.style.setProperty('--p-ratio', String(ratio));
			}
			if (pickerSegStepsEl) {
				if (pickerSegStepsEl.childNodes.length !== total) {
					clear(pickerSegStepsEl);
					for (let i = 0; i < total; i++) {
						pickerSegStepsEl.appendChild(el('span', { class: 'p-seg-step' }, String(i + 1)));
					}
				}
				for (let i = 0; i < pickerSegStepsEl.childNodes.length; i++) {
					const node = pickerSegStepsEl.childNodes[i];
					if (node && node.classList) node.classList.toggle('active', i === idx);
				}
			}
		}

		function handlePickerSliderInput(e) {
			if (e) e.stopPropagation();
			if (!pickerSliderEl) return;
			const idx = parseInt(pickerSliderEl.value, 10) || 0;
			const maxIdx = Math.max(0, pickerChain.length - 1);
			syncPickerSliderVisual(idx, maxIdx);
			if (pickerChain[idx]) {
				showPickerTarget(pickerChain[idx], true);
			}
		}

		function buildPicker() {
			if (pickerEl) return;

			pickerEl = document.createElement('div');
			pickerEl.setAttribute('data-nvirya-picker', '');
			pickerEl.style.cssText = 'position:fixed; z-index:2147483003; pointer-events:none; border:2px solid var(--accent); background:rgba(59,130,246,.15); border-radius:6px; transition:all .06s ease; box-sizing:border-box; box-shadow:0 0 0 1px rgba(255,255,255,.2);';

			pickerLabelEl = document.createElement('div');
			pickerLabelEl.setAttribute('data-nvirya-picker', '');
			pickerLabelEl.style.cssText = 'position:fixed; z-index:2147483004; pointer-events:none; background:var(--card); color:var(--text); font:600 11.5px/1.4 -apple-system,BlinkMacSystemFont,system-ui,sans-serif; padding:3px 9px; border-radius:6px; border:1px solid var(--border); box-shadow:0 4px 12px rgba(0,0,0,.15); white-space:nowrap; -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px);';

			pickerBarEl = document.createElement('div');
			pickerBarEl.setAttribute('data-nvirya-picker', '');
			pickerBarEl.setAttribute('role', 'toolbar');
			pickerBarEl.setAttribute('aria-label', 'Element picker navigation');
			pickerBarEl.style.cssText = 'position:fixed; bottom:calc(16px + env(safe-area-inset-bottom, 0px)); left:50%; transform:translateX(-50%); width:min(90vw, 340px); display:none; flex-direction:column; align-items:stretch; gap:8px; padding:10px; z-index:2147483005; pointer-events:auto; background:var(--sheet); color:var(--text); border:1px solid var(--border); border-radius:18px; box-shadow:0 10px 32px rgba(0,0,0,.22); -webkit-backdrop-filter:blur(24px) saturate(1.6); backdrop-filter:blur(24px) saturate(1.6); font-size:12.5px; white-space:nowrap; user-select:none; touch-action:manipulation;';

			const pickerStyle = document.createElement('style');
			pickerStyle.textContent = `
				.p-seg-wrap {
					position: relative;
					width: 100%;
					height: 32px;
					border-radius: 999px;
					background: var(--seg-bg);
					border: 1px solid var(--border);
					box-sizing: border-box;
					display: flex;
					align-items: center;
					overflow: hidden;
				}
				.p-seg-steps {
					position: absolute;
					top: 0;
					left: 3px;
					right: 3px;
					bottom: 0;
					display: flex;
					align-items: center;
					justify-content: space-between;
					pointer-events: none;
					z-index: 1;
				}
				.p-seg-step {
					flex: 1;
					text-align: center;
					font: 600 10.5px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
					color: var(--muted);
					opacity: 0.55;
					position: relative;
				}
				.p-seg-step + .p-seg-step::before {
					content: '';
					position: absolute;
					left: 0;
					top: 50%;
					transform: translateY(-50%);
					width: 1px;
					height: 10px;
					background: var(--border);
				}
				.p-seg-step.active {
					opacity: 0;
				}
				.p-slider {
					--p-ratio: 0;
					-webkit-appearance: none;
					appearance: none;
					position: relative;
					z-index: 2;
					width: 100%;
					height: 32px;
					padding: 0 3px;
					margin: 0;
					border-radius: 999px;
					background: transparent;
					border: none;
					outline: none;
					cursor: pointer;
					touch-action: pan-x;
					box-sizing: border-box;
				}
				.p-slider:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}
				.p-slider::-webkit-slider-runnable-track {
					width: 100%;
					height: 26px;
					border-radius: 999px;
					background: transparent;
					border: none;
				}
				.p-slider::-webkit-slider-thumb {
					-webkit-appearance: none;
					appearance: none;
					width: 92px;
					height: 26px;
					border-radius: 999px;
					background: var(--seg-on);
					border: 1px solid var(--border);
					box-shadow: 0 2px 6px rgba(0,0,0,.18);
					transition: transform .12s cubic-bezier(.32,.72,0,1);
				}
				.p-slider:active:not(:disabled)::-webkit-slider-thumb {
					transform: scale(0.97);
				}
				.p-slider::-moz-range-track {
					width: 100%;
					height: 26px;
					border-radius: 999px;
					background: transparent;
					border: none;
				}
				.p-slider::-moz-range-thumb {
					width: 92px;
					height: 26px;
					border-radius: 999px;
					background: var(--seg-on);
					border: 1px solid var(--border);
					box-shadow: 0 2px 6px rgba(0,0,0,.18);
				}
				.p-thumb-lbl {
					--p-ratio: 0;
					position: absolute;
					top: 50%;
					left: calc(3px + var(--p-ratio) * (100% - 60px));
					width: 92px;
					height: 26px;
					transform: translateY(-50%);
					display: flex;
					align-items: center;
					justify-content: center;
					font: 700 11.5px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
					color: var(--text);
					font-variant-numeric: tabular-nums;
					pointer-events: none;
					z-index: 3;
				}
				.p-row {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 6px;
					width: 100%;
				}
				.p-btn {
					flex: 1 1 0;
					min-width: 0;
					height: 32px;
					min-height: 32px;
					display: inline-flex;
					align-items: center;
					justify-content: center;
					border: 1px solid var(--border);
					border-radius: 8px;
					padding: 0 8px;
					background: var(--card);
					color: var(--text);
					font: 600 12.5px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
					cursor: pointer;
					touch-action: manipulation;
					overflow: hidden;
					text-overflow: ellipsis;
					transition: background .15s ease, opacity .15s ease, transform .1s ease;
				}
				.p-btn:active:not(:disabled) { transform: scale(0.96); }
				.p-btn:disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
				.p-btn-action { background: var(--accent); color: #ffffff; border-color: transparent; }
				.p-btn-action:active:not(:disabled) { opacity: 0.85; }
				.p-btn-cancel { background: transparent; border-color: var(--border); color: var(--muted); }
				@media (hover: hover) {
					.p-btn:hover:not(:disabled) { background: var(--card-hover); }
					.p-btn-action:hover:not(:disabled) { opacity: 0.92; }
					.p-btn-cancel:hover:not(:disabled) { background: var(--card); color: var(--text); }
				}
			`;

			pickerSegStepsEl = el('div', { class: 'p-seg-steps' });
			pickerDepthValEl = el('span', { class: 'p-thumb-lbl' }, '1/1');
			pickerSliderEl = el('input', {
				type: 'range',
				class: 'p-slider',
				min: '0',
				max: '0',
				value: '0',
				step: '1',
				'aria-label': 'DOM Depth',
				oninput: handlePickerSliderInput
			});
			const sliderRow = el('div', { class: 'p-seg-wrap' },
				pickerSegStepsEl,
				pickerSliderEl,
				pickerDepthValEl
			);

			const parentBtn = el('button', { type: 'button', class: 'p-btn', onclick: () => traversePicker(-1) }, t('p_par'));
			const childBtn = el('button', { type: 'button', class: 'p-btn', onclick: () => traversePicker(1) }, t('p_chd'));
			blockBtn = el('button', { type: 'button', class: 'p-btn p-btn-action', onclick: () => confirmPickerSelection(false) }, t('p_blk'));
			blockAllBtn = el('button', { type: 'button', class: 'p-btn p-btn-action', style: { background: '#8b5cf6' }, onclick: () => confirmPickerSelection(true) }, t('p_all'));
			const cancelBtn = el('button', { type: 'button', class: 'p-btn p-btn-cancel', onclick: () => exitPicker(false) }, t('cancel'));
			const btnRow = el('div', { class: 'p-row' }, parentBtn, childBtn, blockBtn, blockAllBtn, cancelBtn);

			pickerBarEl.append(pickerStyle, sliderRow, btnRow);

			const targetRoot = root || D.body || D.documentElement;
			targetRoot.appendChild(pickerEl);
			targetRoot.appendChild(pickerLabelEl);
			targetRoot.appendChild(pickerBarEl);
		}

		const PICKER_LOCK_EVENTS = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'pointerdown', 'pointerup'];
		let savedWindowOpen = null;
		let touchstartX = 0,
			touchstartY = 0,
			touchstartTime = 0,
			touchStartedOnTarget = false,
			touchMovedDuringGesture = false,
			pickerFlinging = false,
			boundFlingTarget = null,
			pickerScrollRaf = 0;

		function isPickerToolbarEvent(e) {
			if (!e) return false;
			if (typeof e.composedPath === 'function') {
				const path = e.composedPath();
				for (let i = 0; i < path.length; i++) {
					const n = path[i];
					if (n === pickerBarEl || n === host) return true;
					if (n && n.nodeType === 1 && (attr(n, 'data-nvirya-picker') !== null || attr(n, 'data-nvirya-ui') !== null)) {
						return true;
					}
				}
			}
			const tNode = e.target;
			if (tNode && tNode.nodeType === 1) {
				if (tNode === host || (pickerBarEl && pickerBarEl.contains(tNode)) || hasNviryaAncestor(tNode)) return true;
			}
			return false;
		}

		function isPointOnPickerTarget(clientX, clientY, touchedNode) {
			if (!pickerTarget || !pickerTarget.isConnected) return false;
			if (touchedNode && (touchedNode === pickerTarget || (pickerTarget.contains && pickerTarget.contains(touchedNode)))) {
				return true;
			}
			try {
				const r = pickerTarget.getBoundingClientRect();
				return clientX >= r.left - 8 && clientX <= r.right + 8 &&
					clientY >= r.top - 8 && clientY <= r.bottom + 8;
			} catch (e) {
				return false;
			}
		}

		function updatePickerOverlayPosition() {
			pickerScrollRaf = 0;
			if (!pickerActive || pickerFlinging) return;
			const activeEl = pickerTarget || pickerHover;
			if (!activeEl || !activeEl.isConnected) {
				if (pickerEl) pickerEl.style.display = 'none';
				if (pickerLabelEl) pickerLabelEl.style.display = 'none';
				return;
			}
			let rect;
			try {
				rect = activeEl.getBoundingClientRect();
			} catch (e) {
				return;
			}
			if (!rect || (rect.width <= 0 && rect.height <= 0)) {
				if (pickerEl) pickerEl.style.display = 'none';
				if (pickerLabelEl) pickerLabelEl.style.display = 'none';
				return;
			}
			if (pickerEl) {
				pickerEl.style.display = 'block';
				pickerEl.style.left = rect.left + 'px';
				pickerEl.style.top = rect.top + 'px';
				pickerEl.style.width = rect.width + 'px';
				pickerEl.style.height = rect.height + 'px';
			}
			if (pickerLabelEl) {
				pickerLabelEl.style.display = 'block';
				pickerLabelEl.textContent = describe(activeEl);
				const vw = W.innerWidth || D.documentElement.clientWidth || 360;
				const vh = W.innerHeight || D.documentElement.clientHeight || 640;
				const labelTop = rect.top >= 26 ? (rect.top - 22) : Math.min(vh - 26, Math.max(4, rect.bottom + 4));
				pickerLabelEl.style.left = Math.max(4, Math.min(vw - 160, rect.left)) + 'px';
				pickerLabelEl.style.top = labelTop + 'px';
			}
		}

		function onPickerViewportChange() {
			if (!pickerActive || pickerFlinging) return;
			if (pickerEl) pickerEl.style.transition = 'none';
			updatePickerOverlayPosition();
			if (!pickerScrollRaf) {
				pickerScrollRaf = requestAnimationFrame(updatePickerOverlayPosition);
			}
		}

		function onTargetFlingStart(e) {
			if (!pickerActive || pickerFlinging || !e.touches || e.touches.length !== 1) return;
			const touch = e.touches[0];
			touchstartX = touch.clientX;
			touchstartY = touch.clientY;
			touchstartTime = Date.now();
			touchMovedDuringGesture = false;
			const startNode = D.elementFromPoint(touch.clientX, touch.clientY) || e.target;
			touchStartedOnTarget = isPointOnPickerTarget(touch.clientX, touch.clientY, startNode);
		}

		function onTargetFlingEnd(e) {
			if (!pickerActive || pickerFlinging || !e.changedTouches || !e.changedTouches.length) return false;
			const touch = e.changedTouches[0];
			const endX = touch.clientX;
			const endY = touch.clientY;
			const dx = endX - touchstartX;
			const dy = endY - touchstartY;
			const distance = Math.hypot(dx, dy);
			const time = Math.max(1, Date.now() - touchstartTime);
			const velocity = distance / time;

			if (pickerTarget && touchStartedOnTarget && (distance > 60 || velocity > 0.4)) {
				touchStartedOnTarget = false;
				triggerPickerFling(pickerTarget, dx, dy);
				return true;
			}
			touchStartedOnTarget = false;
			return false;
		}

		function bindPickerTargetFling(el) {
			if (boundFlingTarget && boundFlingTarget !== el) {
				try {
					boundFlingTarget.removeEventListener('touchstart', onTargetFlingStart, true);
					boundFlingTarget.removeEventListener('touchend', onTargetFlingEnd, true);
				} catch (e) {}
				boundFlingTarget = null;
			}
			if (el && el.nodeType === 1) {
				boundFlingTarget = el;
				try {
					el.addEventListener('touchstart', onTargetFlingStart, { capture: true, passive: false });
					el.addEventListener('touchend', onTargetFlingEnd, { capture: true, passive: false });
				} catch (e) {}
			}
		}

		function triggerPickerFling(targetEl, dx, dy) {
			if (!targetEl || pickerFlinging) return;
			if (isProtectedPlayer(targetEl) && !confirm(t('cf_plr'))) {
				exitPicker(true);
				return;
			}
			pickerFlinging = true;

			if (pickerEl) pickerEl.style.display = 'none';
			if (pickerLabelEl) pickerLabelEl.style.display = 'none';
			if (pickerBarEl) pickerBarEl.style.display = 'none';

			targetEl.style.transition = 'transform .35s cubic-bezier(.2,.8,.2,1), opacity .35s ease';
			targetEl.style.transform = `translate(${dx * 2.5}px, ${dy * 2.5}px) rotate(${dx > 0 ? 25 : -25}deg)`;
			targetEl.style.opacity = '0';
			targetEl.style.pointerEvents = 'none';

			try {
				if (navigator.vibrate) navigator.vibrate([30, 40]);
			} catch (e) {}

			toast(t('tossedElement') || 'Đã ẩn khối được chọn');

			let completed = false;
			const finishFling = () => {
				if (completed) return;
				completed = true;
				targetEl.removeEventListener('transitionend', onTransitionEnd);
				confirmPickerSelection(false);
				try {
					targetEl.style.transition = '';
					targetEl.style.transform = '';
					targetEl.style.opacity = '';
					targetEl.style.pointerEvents = '';
				} catch (e) {}
			};
			const onTransitionEnd = (ev) => {
				if (ev && ev.target !== targetEl) return;
				finishFling();
			};
			targetEl.addEventListener('transitionend', onTransitionEnd);
			setTimeout(finishFling, 380);
		}

		function pickerLockdownHandler(e) {
			if (!pickerActive) return;
			if (isPickerToolbarEvent(e)) return;

			const type = e.type;
			if (!pickerFlinging) {
				if (type === 'touchstart') {
					onTargetFlingStart(e);
				} else if (type === 'touchend') {
					lastPickerTouchAt = Date.now();
					const flung = onTargetFlingEnd(e);
					if (!flung && !touchMovedDuringGesture && e.changedTouches && e.changedTouches.length > 0) {
						const tTouch = e.changedTouches[0];
						const elAtPoint = D.elementFromPoint(tTouch.clientX, tTouch.clientY);
						if (elAtPoint && !isNviryaNode(elAtPoint)) {
							selectElement(elAtPoint);
						}
					}
					touchMovedDuringGesture = false;
				} else if (type === 'click') {
					if (Date.now() - lastPickerTouchAt >= 650) {
						const elAtPoint = D.elementFromPoint(e.clientX, e.clientY);
						if (elAtPoint && !isNviryaNode(elAtPoint)) {
							selectElement(elAtPoint);
						}
					}
				}
			}

			try {
				const allowScrollStart = (type === 'touchstart' || type === 'pointerdown') && !touchStartedOnTarget;
				if (!allowScrollStart && e.cancelable !== false) {
					e.preventDefault();
				}
				e.stopPropagation();
				e.stopImmediatePropagation();
			} catch (err) {}
		}

		function resetPickerBarEmptyState() {
			if (!pickerBarEl) return;
			if (pickerSliderEl) {
				pickerSliderEl.min = '0';
				pickerSliderEl.max = '0';
				pickerSliderEl.value = '0';
				pickerSliderEl.disabled = true;
			}
			syncPickerSliderVisual(0, 0);
			const buttons = pickerBarEl.querySelectorAll('button');
			if (buttons.length >= 2) {
				buttons[0].disabled = true;
				buttons[1].disabled = true;
			}
			if (blockBtn) blockBtn.disabled = true;
			if (blockAllBtn) {
				blockAllBtn.disabled = true;
				blockAllBtn.style.display = 'none';
			}
			pickerBarEl.style.display = 'flex';
		}

		function enterPicker() {
			if (!config.elementPicker) return;
			buildPicker();
			pickerActive = true;
			state.pickerActive = true;
			pickerFlinging = false;
			touchStartedOnTarget = false;
			touchMovedDuringGesture = false;
			try { W.__NVIRYA_PICKER_ACTIVE__ = true; } catch (e) {}

			if (!savedWindowOpen) {
				savedWindowOpen = W.open;
			}
			const blockedOpen = function() {
				log('BLOCK', 'picker-lock', 'Blocked popup while Element Picker is active');
				return makeDummyWindow();
			};
			try { W.open = blockedOpen; } catch (e) {}
			try { if (typeof window !== 'undefined' && window !== W) window.open = blockedOpen; } catch (e) {}

			pickerChain = [];
			pickerTarget = null;
			pickerHover = null;
			if (pickerEl) pickerEl.style.display = 'none';
			if (pickerLabelEl) pickerLabelEl.style.display = 'none';
			resetPickerBarEmptyState();

			PICKER_LOCK_EVENTS.forEach((evt) => {
				W.addEventListener(evt, pickerLockdownHandler, { capture: true, passive: false });
				D.addEventListener(evt, pickerLockdownHandler, { capture: true, passive: false });
			});
			D.addEventListener('mousemove', pickerMove, true);
			D.addEventListener('touchmove', pickerTouchMove, { capture: true, passive: false });
			W.addEventListener('scroll', onPickerViewportChange, { capture: true, passive: true });
			D.addEventListener('scroll', onPickerViewportChange, { capture: true, passive: true });
			W.addEventListener('resize', onPickerViewportChange, { capture: true, passive: true });
			try {
				if (W.visualViewport) {
					W.visualViewport.addEventListener('scroll', onPickerViewportChange, { passive: true });
					W.visualViewport.addEventListener('resize', onPickerViewportChange, { passive: true });
				}
			} catch (e) {}
			toast(t('ts_pick'));
		}

		function exitPicker(silent) {
			pickerActive = false;
			state.pickerActive = false;
			pickerFlinging = false;
			touchStartedOnTarget = false;
			touchMovedDuringGesture = false;
			if (pickerScrollRaf) {
				cancelAnimationFrame(pickerScrollRaf);
				pickerScrollRaf = 0;
			}
			bindPickerTargetFling(null);
			try { W.__NVIRYA_PICKER_ACTIVE__ = false; } catch (e) {}

			if (savedWindowOpen) {
				try { W.open = savedWindowOpen; } catch (e) {}
				try { if (typeof window !== 'undefined' && window !== W) window.open = savedWindowOpen; } catch (e) {}
				savedWindowOpen = null;
			}

			pickerChain = [];
			if (pickerSliderEl) {
				pickerSliderEl.min = '0';
				pickerSliderEl.max = '0';
				pickerSliderEl.value = '0';
				syncPickerSliderVisual(0, 0);
			}
			if (pickerEl) pickerEl.style.display = 'none';
			if (pickerLabelEl) pickerLabelEl.style.display = 'none';
			if (pickerBarEl) pickerBarEl.style.display = 'none';
			pickerTarget = null;
			pickerHover = null;

			PICKER_LOCK_EVENTS.forEach((evt) => {
				W.removeEventListener(evt, pickerLockdownHandler, true);
				D.removeEventListener(evt, pickerLockdownHandler, true);
			});
			D.removeEventListener('mousemove', pickerMove, true);
			D.removeEventListener('touchmove', pickerTouchMove, true);
			W.removeEventListener('scroll', onPickerViewportChange, true);
			D.removeEventListener('scroll', onPickerViewportChange, true);
			W.removeEventListener('resize', onPickerViewportChange, true);
			try {
				if (W.visualViewport) {
					W.visualViewport.removeEventListener('scroll', onPickerViewportChange);
					W.visualViewport.removeEventListener('resize', onPickerViewportChange);
				}
			} catch (e) {}
			if (!silent) toast(t('ts_pclose'));
		}

		function describe(el) {
			if (!el) return '';
			const tag = (el.tagName || '').toLowerCase();
			const id = el.id && isStableToken(el.id) ? '#' + el.id : '';
			const stable = classString(el).split(/\s+/).filter(isStableClassToken).slice(0, 1);
			const cls = stable.length ? '.' + stable[0] : '';
			return tag + id + cls;
		}

		function showPickerTarget(el, fromChain) {
			if (!el || el.nodeType !== 1 || isNviryaNode(el)) return;
			if (!fromChain || !pickerChain.length || pickerChain.indexOf(el) === -1) {
				pickerChain = buildPickerChain(el);
			}
			pickerTarget = el;
			pickerHover = el;
			bindPickerTargetFling(el);
			const chainIdx = Math.max(0, pickerChain.indexOf(el));
			const maxIdx = Math.max(0, pickerChain.length - 1);
			if (pickerSliderEl) {
				pickerSliderEl.min = '0';
				pickerSliderEl.max = String(maxIdx);
				pickerSliderEl.value = String(chainIdx);
				pickerSliderEl.disabled = maxIdx === 0;
			}
			syncPickerSliderVisual(chainIdx, maxIdx);

			if (pickerEl) pickerEl.style.transition = 'all .06s ease';
			updatePickerOverlayPosition();

			const buttons = pickerBarEl ? pickerBarEl.querySelectorAll('button') : [];
			if (buttons.length >= 2) {
				const canGoParent = chainIdx < maxIdx || (!!el.parentElement && !/^(?:body|html)$/i.test(String(el.parentElement.tagName || '')));
				const canGoChild = chainIdx > 0 || !!el.firstElementChild;
				buttons[0].disabled = !canGoParent;
				buttons[1].disabled = !canGoChild;
			}
			if (blockBtn) blockBtn.disabled = false;

			const simSel = makeSimilarSelector(el);
			let simCount = 1;
			if (simSel) {
				try { simCount = D.querySelectorAll(simSel).length; } catch (e) {}
			}
			if (blockAllBtn) {
				blockAllBtn.disabled = simCount <= 1;
				const allTxt = t('p_all', { count: simCount });
				blockAllBtn.textContent = simCount > 1 ?
					(allTxt.indexOf(String(simCount)) !== -1 ? allTxt : `${allTxt} (${simCount})`) :
					allTxt.replace(/\s*\(\{?count\}?\)/g, '');
				blockAllBtn.style.display = simCount > 1 ? 'inline-flex' : 'none';
			}

			if (pickerBarEl) {
				pickerBarEl.style.display = 'flex';
			}
		}

		function pickerMove(e) {
			if (!pickerActive || pickerFlinging) return;
			if (pickerTarget) return;
			if (isPickerToolbarEvent(e)) return;
			const el = D.elementFromPoint(e.clientX, e.clientY);
			if (!el || el === pickerEl || el === pickerLabelEl || isNviryaNode(el)) return;
			pickerHover = el;
			if (pickerEl) pickerEl.style.transition = 'all .06s ease';
			updatePickerOverlayPosition();
		}

		function pickerTouchMove(e) {
			if (!pickerActive || pickerFlinging) return;
			if (isPickerToolbarEvent(e)) return;
			if (!e.touches || e.touches.length !== 1) return;
			const touch = e.touches[0];
			const dist = Math.hypot(touch.clientX - touchstartX, touch.clientY - touchstartY);
			if (dist > 10) {
				touchMovedDuringGesture = true;
			}
			if (pickerTarget && touchStartedOnTarget) {
				if (e.cancelable !== false) e.preventDefault();
				return;
			}
			onPickerViewportChange();
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
			const unique = function(selector) {
				try { return D.querySelectorAll(selector).length === 1; } catch (e) { return false; }
			};
			const quote = function(value) { return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); };
			const identity = [];
			if (el.id && isStableToken(el.id)) identity.push('#' + (W.CSS && W.CSS.escape ? W.CSS.escape(el.id) : el.id));
			for (const name of ['data-testid', 'data-test', 'data-qa', 'data-cy', 'data-id', 'role', 'aria-label', 'name', 'title']) {
				const value = el.getAttribute(name);
				if (value && value.length <= 100) identity.push(tag + '[' + name + '="' + quote(value) + '"]');
			}
			for (const selector of identity)
				if (unique(selector)) return selector;
			const stableClasses = classString(el).split(/\s+/).filter(isStableClassToken).slice(0, 2);
			for (let count = stableClasses.length; count > 0; count--) {
				const selector = tag + stableClasses.slice(0, count).map(function(token) {
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

		function makeSimilarSelector(el) {
			if (!el || el.nodeType !== 1) return null;
			const tag = String(el.tagName || '').toLowerCase();
			if (/^(?:html|body)$/.test(tag)) return null;

			const stableClasses = classString(el).split(/\s+/).filter(isStableClassToken);
			if (stableClasses.length > 0) {
				return tag + stableClasses.map(c => '.' + (W.CSS && W.CSS.escape ? W.CSS.escape(c) : c.replace(/[^a-zA-Z0-9_-]/g, '\\$&'))).join('');
			}

			const parent = el.parentElement;
			if (parent && !/^(?:html|body)$/i.test(String(parent.tagName || ''))) {
				const pSel = makeSimilarSelector(parent);
				if (pSel) return pSel + ' > ' + tag;
			}
			return tag;
		}

		function selectElement(el) {
			if (!el || el.nodeType !== 1 || isNviryaNode(el)) return;
			pickerChain = buildPickerChain(el);
			showPickerTarget(el, true);
		}

		function traversePicker(direction) {
			if (!pickerTarget) return;
			const idx = pickerChain.indexOf(pickerTarget);
			let next = null;
			if (direction < 0) {
				if (idx !== -1 && idx + 1 < pickerChain.length) {
					next = pickerChain[idx + 1];
				} else {
					const p = pickerTarget.parentElement;
					if (p && !/^(?:body|html)$/i.test(String(p.tagName || '')) && !isNviryaNode(p)) {
						if (pickerChain.length <= 6 && pickerChain.indexOf(p) === -1) pickerChain.push(p);
						next = p;
					}
				}
			} else {
				if (idx > 0) {
					next = pickerChain[idx - 1];
				} else if (pickerTarget.firstElementChild && !isNviryaNode(pickerTarget.firstElementChild)) {
					next = pickerTarget.firstElementChild;
					pickerChain = buildPickerChain(next);
				}
			}
			if (!next || /^(?:body|html)$/i.test(String(next.tagName || '')) || isNviryaNode(next)) return;
			showPickerTarget(next, true);
		}

		function confirmPickerSelection(isAll) {
			const selected = pickerTarget;
			const wasFlinging = pickerFlinging;
			if (!selected || !selected.isConnected) {
				exitPicker(true);
				toast(t('ts_gone'));
				return;
			}
			if (!wasFlinging && isProtectedPlayer(selected) && !confirm(t('cf_plr'))) {
				exitPicker(true);
				return;
			}

			const sel = isAll ? makeSimilarSelector(selected) : makeSelector(selected);
			if (!sel) {
				toast(t('ts_nosel'));
				exitPicker(true);
				return;
			}

			if (!wasFlinging) {
				const promptMsg = isAll ? t('cf_ball', { sel }) : t('cf_bone', { sel });
				if (!confirm(promptMsg)) { exitPicker(true); return; }
			}

			if (!state.siteRules[hostname]) state.siteRules[hostname] = [];
			state.siteRules[hostname].push({ selector: sel, action: 'hide', created: Date.now() });
			persistSiteRules();

			try {
				const targets = isAll ? D.querySelectorAll(sel) : [selected];
				targets.forEach(node => {
					node.setAttribute('data-nvirya-hidden', 'manual');
					state.hiddenNodes.add(node);
					stats.inc('hidden');
				});
			} catch (e) {}

			installSiteRulesCSS();
			scheduleUnlockPageScroll();
			if (!wasFlinging) {
				toast(isAll ? t('ts_ball') : t('ts_bone'));
			}
			exitPicker(true);
		}

		function collectDebugInfo() {
			const lines = [];
			lines.push('Nvirya AdGuard v' + VERSION);
			lines.push('Host: ' + hostname);
			lines.push('URL: ' + location.href.split('?')[0]);
			lines.push('Enabled: ' + config.enabled);
			lines.push('Lang: ' + config.lang + ' (' + getEffectiveLang() + ')');
			lines.push('Whitelisted: ' + isWhitelisted(hostname));
			lines.push('Session-disabled: ' + !!state.sessionDisabled[hostname]);
			lines.push('Strict mode: ' + config.strictMode);
			lines.push('Observer: ' + (observer ? 'active' : 'inactive'));
			lines.push('Queue length: ' + pendingQueue.length);
			lines.push('Stats (Session): ' + JSON.stringify(stats.session));
			lines.push('Stats (Lifetime): ' + JSON.stringify(stats.lifetime));
			lines.push('Anti-Adblock Diagnostics: ' + JSON.stringify(AntiAdblockEngine.getDiagnostics()));
			lines.push('Recent events:');
			const tail = logRing.slice(-15);
			for (const e of tail) lines.push('  ' + e.level + ' ' + e.type + ' ' + e.msg + (e.extra ? ' ' + e.extra : ''));
			return lines.join('\n');
		}

		function forceUnlockScroll() {
			unlockPageScroll(true);
			try {
				[D.documentElement, D.body].forEach(elNode => {
					if (!elNode) return;
					elNode.style.setProperty('overflow', 'auto', 'important');
					elNode.style.setProperty('overflow-y', 'auto', 'important');
					if (W.getComputedStyle(elNode).position === 'fixed') {
						elNode.style.setProperty('position', 'static', 'important');
					}
				});
			} catch (e) {}
			toast(t('ts_ulk'));
		}

		let peekTimer = null;

		function peekOriginal() {
			if (peekTimer) return;
			const siteStyle = D.querySelector('style[data-nvirya-site-rules]');
			if (siteStyle) siteStyle.disabled = true;
			if (cosmeticStyleEl) cosmeticStyleEl.disabled = true;

			setMenu(false);
			toast(t('ts_pkon'));

			peekTimer = setTimeout(() => {
				if (siteStyle) siteStyle.disabled = false;
				if (cosmeticStyleEl) cosmeticStyleEl.disabled = false;
				peekTimer = null;
				toast(t('ts_pkoff'));
			}, 3000);
		}

		let rulesModalEl = null;

		function buildRulesModal() {
			if (rulesModalEl) return;
			const card = el('div', { class: 'report-card', style: { maxHeight: '80vh', display: 'flex', flexDirection: 'column' } });
			const head = el('div', { class: 'report-head' },
				el('div', { class: 'titles' },
					el('h2', null, t('rules')),
					el('div', { class: 'badge', style: { marginTop: '2px' } }, hostname || '(unknown)')
				),
				el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => closeRulesModal() }, icon('close'))
			);
			const listContainer = el('div', { class: 'rules-list', style: { overflowY: 'auto', flex: '1 1 auto', margin: '10px 0', display: 'flex', flexDirection: 'column', gap: '6px' } });
			card.append(head, listContainer);
			rulesModalEl = el('div', { class: 'report-modal' }, card);
			root.appendChild(rulesModalEl);
		}

		function openRulesModal() {
			buildRulesModal();
			renderRulesList();
			rulesModalEl.classList.add('open');
			if (host) host.style.pointerEvents = 'auto';
		}

		function closeRulesModal() {
			if (rulesModalEl) rulesModalEl.classList.remove('open');
			if (host && !menuOpen) host.style.pointerEvents = 'none';
		}

		function removeSingleRule(selector) {
			const list = state.siteRules[hostname] || [];
			state.siteRules[hostname] = list.filter(r => r.selector !== selector);
			if (state.siteRules[hostname].length === 0) delete state.siteRules[hostname];
			persistSiteRules();

			installSiteRulesCSS();
			try {
				D.querySelectorAll(selector).forEach(elNode => {
					elNode.removeAttribute('data-nvirya-hidden');
					state.hiddenNodes.delete(elNode);
				});
			} catch (e) {}

			renderRulesList();
			toast(t('ts_rm', { sel: selector }));
		}

		function renderRulesList() {
			if (!rulesModalEl) return;
			const listContainer = rulesModalEl.querySelector('.rules-list');
			clear(listContainer);
			const rules = state.siteRules[hostname] || [];

			if (rules.length === 0) {
				listContainer.appendChild(el('div', { style: { textAlign: 'center', padding: '16px', color: 'var(--muted)', fontSize: '13px' } }, t('rl_empty')));
				return;
			}

			rules.forEach(r => {
				const row = el('div', {
					style: {
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						background: 'var(--card)',
						border: '1px solid var(--border)',
						borderRadius: '10px',
						padding: '8px 12px',
						gap: '8px'
					}
				});
				const code = el('code', {
					style: {
						fontFamily: 'monospace',
						fontSize: '12px',
						flex: '1',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap'
					}
				}, r.selector);

				const delBtn = el('button', {
					class: 'icon-btn',
					type: 'button',
					style: { width: '26px', height: '26px', flex: 'none', color: 'var(--danger)' },
					onclick: () => removeSingleRule(r.selector)
				}, icon('close'));

				row.append(code, delBtn);
				listContainer.appendChild(row);
			});
		}

		let networkModalEl = null,
			netSearchInput = null,
			netListContainer = null,
			netTabAllBtn = null,
			netTabBlockedBtn = null,
			netFilterMode = 'all',
			netSearchQuery = '';

		function setNetFilterMode(mode) {
			netFilterMode = mode === 'blocked' ? 'blocked' : 'all';
			if (netTabAllBtn) netTabAllBtn.setAttribute('aria-pressed', String(netFilterMode === 'all'));
			if (netTabBlockedBtn) netTabBlockedBtn.setAttribute('aria-pressed', String(netFilterMode === 'blocked'));
			renderNetworkList();
		}

		function buildNetworkModal() {
			if (networkModalEl) return;
			const card = el('div', {
				class: 'report-card',
				style: { maxWidth: '400px', maxHeight: '82vh', display: 'flex', flexDirection: 'column', gap: '8px' }
			});
			const head = el('div', { class: 'report-head' },
				el('div', { class: 'titles' },
					el('h2', null, t('networkRequests')),
					el('div', { class: 'badge', style: { marginTop: '2px' } }, hostname || '(unknown)')
				),
				el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => closeNetworkModal() }, icon('close'))
			);

			netSearchInput = el('input', {
				type: 'search',
				class: 'report-select',
				placeholder: t('searchDomainPlaceholder'),
				value: netSearchQuery,
				oninput: () => {
					netSearchQuery = String(netSearchInput.value || '').trim().toLowerCase();
					renderNetworkList();
				}
			});

			let netTabUnlockedBtn;
			const filterSeg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Filter' });
			netTabAllBtn = el('button', {
				type: 'button',
				'aria-pressed': String(netFilterMode === 'all'),
				onclick: () => setNetFilterMode('all')
			}, t('netFilterAll'));
			netTabBlockedBtn = el('button', {
				type: 'button',
				'aria-pressed': String(netFilterMode === 'blocked'),
				onclick: () => setNetFilterMode('blocked')
			}, t('netFilterBlocked'));
			netTabUnlockedBtn = el('button', {
				type: 'button',
				'aria-pressed': String(netFilterMode === 'unlocked'),
				onclick: () => setNetFilterMode('unlocked')
			}, t('netFilterUnlocked'));
			filterSeg.append(netTabAllBtn, netTabBlockedBtn, netTabUnlockedBtn);

			function setNetFilterMode(mode) {
				netFilterMode = mode;
				if (netTabAllBtn) netTabAllBtn.setAttribute('aria-pressed', String(mode === 'all'));
				if (netTabBlockedBtn) netTabBlockedBtn.setAttribute('aria-pressed', String(mode === 'blocked'));
				if (netTabUnlockedBtn) netTabUnlockedBtn.setAttribute('aria-pressed', String(mode === 'unlocked'));
				renderNetworkList();
			}

			netListContainer = el('div', {
				class: 'rules-list',
				style: { overflowY: 'auto', flex: '1 1 auto', minHeight: '140px', maxHeight: '48vh', margin: '4px 0', display: 'flex', flexDirection: 'column', gap: '6px' }
			});

			const clearBtn = el('button', {
				class: 'report-btn cancel',
				type: 'button',
				style: { marginTop: '2px', padding: '8px 0', fontSize: '12.5px' },
				onclick: () => {
					networkRingBuffer.length = 0;
					renderNetworkList();
				}
			}, t('netClearLog'));

			card.append(head, netSearchInput, filterSeg, netListContainer, clearBtn);
			networkModalEl = el('div', { class: 'report-modal' }, card);
			networkModalEl.addEventListener('click', (e) => {
				if (e.target === networkModalEl) closeNetworkModal();
			});
			root.appendChild(networkModalEl);
		}

		function getNetworkHostStatus(host, sampleUrl) {
			if (!host) return { status: 'allowed', source: 'allowed' };
			const h = String(host).toLowerCase().replace(/\.$/, '');

			if (userAllowedSet.has(h) || (typeof isUserAllowedNetHost === 'function' && isUserAllowedNetHost(h, hostname))) {
				return { status: 'unlocked', source: 'user_allowed' };
			}

			if (userBlockedSet.has(h) || (typeof isUserBlockedNetHost === 'function' && isUserBlockedNetHost(h))) {
				return { status: 'blocked', source: 'custom' };
			}

			if (config.smartTrackerProtection && typeof isLearnedTrackerHost === 'function' && isLearnedTrackerHost(h)) {
				return { status: 'blocked', source: 'tracker' };
			}

			const sample = sampleUrl ? String(sampleUrl) : '';
			const isBuiltin = RE_AD_HOST.test(h) || RE_GAMBLING_HOST.test(h) || isSuspiciousAdDomain(h) || (sample && (RE_BANNER_NETWORKS.test(sample) || RE_AD_STACK.test(sample) || RE_YOUTUBE_AD_ENDPOINT.test(sample)));
			if (isBuiltin) {
				return { status: 'blocked', source: 'builtin' };
			}

			return { status: 'allowed', source: 'allowed' };
		}

		function openNetworkModal() {
			buildNetworkModal();
			scanStaticDomResources();
			renderNetworkList();
			networkModalEl.classList.add('open');
			if (host) host.style.pointerEvents = 'auto';
		}

		function closeNetworkModal() {
			if (networkModalEl) networkModalEl.classList.remove('open');
			if (host && !menuOpen) host.style.pointerEvents = 'none';
		}

		function renderNetworkList() {
			if (!networkModalEl || !netListContainer) return;
			scanStaticDomResources();
			clear(netListContainer);

			const domainMap = new Map();
			for (let i = 0; i < networkRingBuffer.length; i++) {
				const item = networkRingBuffer[i];
				if (!item || !item.hostname) continue;
				const d = String(item.hostname).toLowerCase().trim().replace(/\.$/, '');
				let group = domainMap.get(d);
				if (!group) {
					group = {
						hostname: d,
						count: 0,
						blocked: false,
						types: new Set(),
						lastTime: 0,
						sampleUrl: item.url || ''
					};
					domainMap.set(d, group);
				}
				group.count++;
				if (item.blocked) group.blocked = true;
				if (item.type) group.types.add(item.type);
				if (item.time > group.lastTime) {
					group.lastTime = item.time;
					group.sampleUrl = item.url || group.sampleUrl;
				}
			}

			userBlockedSet.forEach(d => {
				const norm = String(d).toLowerCase().trim().replace(/\.$/, '');
				if (!domainMap.has(norm)) {
					domainMap.set(norm, {
						hostname: norm,
						count: 0,
						blocked: true,
						types: new Set(['custom']),
						lastTime: 0,
						sampleUrl: 'https://' + norm
					});
				}
			});

			userAllowedSet.forEach(d => {
				const norm = String(d).toLowerCase().trim().replace(/\.$/, '');
				if (!domainMap.has(norm)) {
					domainMap.set(norm, {
						hostname: norm,
						count: 0,
						blocked: false,
						types: new Set(['allowed']),
						lastTime: 0,
						sampleUrl: 'https://' + norm
					});
				}
			});

			const groups = Array.from(domainMap.values()).map(g => {
				const hostStatus = getNetworkHostStatus(g.hostname, g.sampleUrl);
				return {
					...g,
					status: hostStatus.status,
					source: hostStatus.source
				};
			}).filter(g => {
				if (netFilterMode === 'blocked' && g.status !== 'blocked') return false;
				if (netFilterMode === 'unlocked' && g.status !== 'unlocked') return false;
				if (netSearchQuery) {
					const matchHost = g.hostname.indexOf(netSearchQuery) !== -1;
					const matchUrl = String(g.sampleUrl || '').toLowerCase().indexOf(netSearchQuery) !== -1;
					if (!matchHost && !matchUrl) return false;
				}
				return true;
			}).sort((a, b) => (b.lastTime - a.lastTime) || (b.count - a.count));

			if (groups.length === 0) {
				netListContainer.appendChild(
					el('div', { style: { textAlign: 'center', padding: '20px 12px', color: 'var(--muted)', fontSize: '13px' } }, t('noRequestsYet'))
				);
				return;
			}

			groups.forEach(g => {
				const isUnlocked = g.status === 'unlocked';
				const isBlocked = g.status === 'blocked';

				let badgeClass = 'allowed';
				let badgeText = t('badgeAllowed');
				if (isUnlocked) {
					badgeClass = 'unlocked';
					badgeText = t('badgeUnlocked');
				} else if (isBlocked) {
					badgeClass = 'blocked';
					badgeText = t('badgeBlocked');
				}

				const badge = el('span', {
					class: 'net-badge ' + badgeClass
				}, badgeText);

				const countText = g.count > 0 ? ` (${g.count})` : '';
				const hostLine = el('div', { class: 'net-host-row' },
					el('span', { class: 'net-host', title: g.sampleUrl || g.hostname }, g.hostname + countText),
					badge
				);

				let sourceText = '';
				let sourceColor = 'var(--muted)';
				if (g.source === 'user_allowed') {
					sourceText = t('sourceUserAllowed');
					sourceColor = '#3b82f6';
				} else if (g.source === 'tracker') {
					sourceText = t('sourceTracker');
					sourceColor = '#8b5cf6';
				} else if (g.source === 'custom') {
					sourceText = t('sourceCustom');
					sourceColor = 'var(--danger)';
				} else if (g.source === 'builtin') {
					sourceText = t('sourceBuiltin');
					sourceColor = 'var(--muted)';
				}

				const typeList = Array.from(g.types).join(', ');
				const metaLine = el('div', { class: 'net-meta' },
					typeList ? el('span', null, typeList) : null,
					(typeList && sourceText) ? el('span', { style: { margin: '0 4px', opacity: '0.5' } }, '•') : null,
					sourceText ? el('span', { style: { color: sourceColor, fontWeight: '500' } }, sourceText) : null
				);

				const info = el('div', { class: 'net-info' }, hostLine, metaLine);

				let actionBtn;
				if (isBlocked) {
					actionBtn = el('button', {
						type: 'button',
						class: 'net-act-btn unblock',
						onclick: () => {
							userBlockedSet.delete(g.hostname);
							customBlockedSet.delete(g.hostname);
							userAllowedSet.add(g.hostname);
							persistUserAllowedDomains();
							persistUserBlockedDomains();
							renderNetworkList();
							toast(t('toastDomainAllowed', { domain: g.hostname }), {
								actionText: t('toastReload'),
								onAction: () => location.reload()
							});
						}
					}, t('unblockDomain'));
				} else {
					actionBtn = el('button', {
						type: 'button',
						class: 'net-act-btn block',
						onclick: () => {
							userAllowedSet.delete(g.hostname);
							userBlockedSet.add(g.hostname);
							customBlockedSet.add(g.hostname);
							persistUserAllowedDomains();
							persistUserBlockedDomains();
							renderNetworkList();
							toast(t('toastDomainBlocked', { domain: g.hostname }), {
								actionText: t('toastReload'),
								onAction: () => location.reload()
							});
						}
					}, t('blockDomain'));
				}

				const row = el('div', { class: 'net-row' }, info, actionBtn);
				netListContainer.appendChild(row);
			});
		}

		function refreshNetworkModalIfOpen() {
			if (networkModalEl && networkModalEl.classList.contains('open')) {
				renderNetworkList();
			}
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
			refreshNetworkModalIfOpen,
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
					el.setAttribute('data-nvirya-hidden', 'clean');
					state.hiddenNodes.add(el);
					stats.inc('hidden');
				}
			}
			handleAntiAdblock();
		} catch (e) { log('ERROR', 'clean', e && e.message); }
	}

	function undoLast() {
		const rules = state.siteRules[hostname];
		if (rules && rules.length > 0) {
			const popped = rules.pop();
			if (rules.length === 0) delete state.siteRules[hostname];
			persistSiteRules();
			installSiteRulesCSS();
			try {
				const hiddenEls = D.querySelectorAll(popped.selector);
				hiddenEls.forEach(el => {
					el.removeAttribute('data-nvirya-hidden');
					state.hiddenNodes.delete(el);
				});
			} catch (e) {}

			UI.toast(t('ts_udo', { sel: popped.selector }));
			return;
		}

		const lastNode = state.removedNodes.pop();
		if (lastNode && lastNode.parent) {
			try {
				if (lastNode.next && lastNode.next.parentNode === lastNode.parent) {
					lastNode.parent.insertBefore(lastNode.el, lastNode.next);
				} else {
					lastNode.parent.appendChild(lastNode.el);
				}
				UI.toast(t('ts_udn'));
				return;
			} catch (e) {}
		}

		UI.toast(t('ts_ud0'));
	}


	function refreshProtection() {
		if (isDisabledHere()) {
			AntiAdblockEngine.revertAll();
			if (observer) { try { observer.disconnect(); } catch (e) {} observer = null; }
			if (cosmeticStyleEl) cosmeticStyleEl.disabled = true;
		} else {
			if (!config.antiAdblock) AntiAdblockEngine.revertAll();
			else AntiAdblockEngine.scheduleBoundedFallbackScans();
			if (cosmeticStyleEl) cosmeticStyleEl.disabled = false;
			if (!observer) startObserver();
			initialScan();
		}
		UI.updateUIStatus();
	}

	function registerMenuCommands() {
		if (typeof GM_registerMenuCommand !== 'function') return;
		try {
			GM_registerMenuCommand('Open Control Panel (Alt+A)', () => UI.setMenu(true));
			GM_registerMenuCommand('Select the element to block (Picker)', () => UI.enterPicker());
			GM_registerMenuCommand('Turn off on this page (Temporarily)', () => {
				state.sessionDisabled[hostname] = true;
				persistSession();
				refreshProtection();
				UI.toast(t('ts_tdf'));
			});
			GM_registerMenuCommand('Turn it back on this page', () => {
				delete state.sessionDisabled[hostname];
				persistSession();
				refreshProtection();
				UI.toast(t('ts_tdo'));
			});
			GM_registerMenuCommand('Check for updates', () => Updater.check(true));
			GM_registerMenuCommand('Turn On/Off Debug', () => {
				config.debug = !config.debug;
				saveConfig();
				UI.toast('Debug ' + (config.debug ? 'on' : 'off'));
			});
		} catch (e) {}
	}

	function init() {
		if (isFullSecurityChallengePage()) {
			log('INFO', 'init', 'Security challenge page detected; standing down');
			return;
		}
		if (!state.phase1Done) {
			state.phase1Done = true;
			if (!isDisabledHere()) {
				if (!isSearchEngineDomain(hostname)) {
					injectMainWorldShield();
				}
				installNetworkGuard();
				installEarlyMetaRefreshGuard();
				installDocWriteGuard();
				installScriptletDefusers();
				installPreExecutionScriptKiller();
				installEventListenerGuard();
				installClipboardAndVisibilityGuard();
				installPopupGuard();
				installRedirectGuard();
				installInvisibleTrapInterception();
				cleanTrackingQuery();
			}
		}

		if (!isDisabledHere() && (D.documentElement || D.head)) {
			installCosmeticCSS();
			installSiteRulesCSS();
		}

		if (!D.documentElement) {
			const docElObs = new MutationObserver(() => {
				if (D.documentElement) {
					docElObs.disconnect();
					init();
				}
			});
			docElObs.observe(D, { childList: true });
			return;
		}

		if (state.initialized) return;
		state.initialized = true;

		if (!isDisabledHere() && !isFullSecurityChallengePage()) {
			installScriptElementGuard();
			installIframePopupGuard();
			if (!isSearchEngineDomain(hostname)) {
				defuseGoogleTagManager();
			}
		}

		const isTop = (function() {
			try { return W.self === W.top; } catch (e) { return false; }
		})();

		const runPhase2DeferredDOM = () => {
			if (isFullSecurityChallengePage()) return;
			if (!isDisabledHere()) {
				installCosmeticCSS();
				installSiteRulesCSS();
			}

			if (isTop) {
				try { UI.build(); } catch (e) { log('ERROR', 'ui', e && e.message); }

				if (!config.showFloatingButton) {
					const h = D.querySelector('[data-nvirya-ui]');
					if (h && h.shadowRoot) {
						const handle = h.shadowRoot.querySelector('.handle');
						if (handle) handle.classList.add('hidden');
					}
				}

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

			startObserver();
			initialScan();
			scheduleVideoAdScan();
			installSPAHooks();

			runIdleTask(() => {
				try {
					stats.load();
					void store.get(K_WEEKLY, {});
					void TRANSLATIONS[getEffectiveLang()];
					AntiAdblockEngine.scheduleBoundedFallbackScans();

					if (isTop) {
						registerMenuCommands();
						try { Updater.schedule(); } catch (e) { log('ERROR', 'update', e && e.message); }

						try {
							const savedSyncUrl = store.get(K_SYNC_URL, '');
							const lastSyncTime = Number(store.get(K_SYNC_TIME, 0)) || 0;
							if (savedSyncUrl && (Date.now() - lastSyncTime > SYNC_INTERVAL_MS)) {
								syncRulesFromRawUrl(savedSyncUrl, true);
							}
						} catch (e) {}
					}
					log('INFO', 'init', 'ready v' + VERSION);
				} catch (e) {}
			});
		};

		if (D.body) {
			runPhase2DeferredDOM();
		} else {
			let started = false;
			const triggerPhase2 = () => {
				if (started) return;
				started = true;
				if (bodyObserver) {
					try { bodyObserver.disconnect(); } catch (e) {}
				}
				runPhase2DeferredDOM();
			};

			let bodyObserver = null;
			try {
				bodyObserver = new MutationObserver(() => {
					if (D.body) triggerPhase2();
				});
				bodyObserver.observe(D.documentElement, { childList: true });
			} catch (e) {}

			D.addEventListener('DOMContentLoaded', triggerPhase2, { once: true });
			setTimeout(triggerPhase2, 1500);
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
		try { console.error('[Nvirya AdGuard] init failed', e); } catch (e2) {}
	}
})();
