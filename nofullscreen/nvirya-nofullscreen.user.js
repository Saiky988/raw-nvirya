// ==UserScript==
// @name         Nvirya NoFullscreen
// @namespace    https://nvirya.com/
// @version      1.2.1
// @description 
// @author       Nvirya
// @icon         https://raw.nvirya.com/assets/icon.png
// @updateURL    https://raw.nvirya.com/nofullscreen/nvirya-nofullscreen.user.js
// @downloadURL  https://raw.nvirya.com/nofullscreen/nvirya-nofullscreen.user.js
// @match        *://*/*
// @run-at       document-start
// @all-frames   true
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const blockFullscreen = () => Promise.reject(new DOMException('Fullscreen blocked', 'NotAllowedError'));
  const noop = () => Promise.resolve();

  ['requestFullscreen', 'webkitRequestFullscreen', 'webkitRequestFullScreen'].forEach(m => { if (Element.prototype[m]) Element.prototype[m] = blockFullscreen; });
  ['webkitEnterFullscreen', 'webkitEnterFullScreen'].forEach(m => { if (HTMLVideoElement.prototype[m]) HTMLVideoElement.prototype[m] = noop; });

  const handledVideos = new WeakSet();
  function enforceInline(v) {
    if (!v || !(v instanceof HTMLMediaElement)) return;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.playsInline = true;
    v.webkitEnterFullscreen = noop;
    v.webkitEnterFullScreen = noop;
    if (!handledVideos.has(v)) {
      handledVideos.add(v);
      try { Object.defineProperty(v, 'playsInline', { configurable: true, get: () => true, set: () => {} }); } catch (e) {}
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.tagName === 'VIDEO') enforceInline(n);
        else if (n.firstElementChild) n.querySelectorAll('video').forEach(enforceInline);
      }
    }
  });

  const startObs = () => { if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true }); };
  if (document.documentElement) startObs();
  else document.addEventListener('DOMContentLoaded', startObs, { once: true });

  document.addEventListener('play', (e) => { if (e.target && e.target.tagName === 'VIDEO') enforceInline(e.target); }, true);
  document.querySelectorAll('video').forEach(enforceInline);
})();
