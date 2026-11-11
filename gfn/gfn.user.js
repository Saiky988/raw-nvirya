// ==UserScript==
// @name         Nvirya GeForce NOW iOS
// @namespace    https://nvirya.com/gfn
// @version      3.4
// @author       Nvirya
// @description  iOS PWA bypass, UI Scale (100%–250%) + GFN Native Scroll Fix, 24 Studio Game Filters, Ultra-Crisp 2K GPU Screenshot + Unsharp & Filter Baker, 1h Session Countdown, 3-Graph Telemetry HUD, Zero-Freeze Hybrid Input & Pro Macro Suite.
// @icon         https://www.google.com/s2/favicons?sz=64&domain=play.geforcenow.com
// @match        https://play.geforcenow.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

/*
 * v3.4 Release Notes
 * 1. UI Scale Engine (100% – 250%) & GFN Native Settings Scroll Unlocker:
 *    - Added `uiScale` (80% – 250% slider + 1-tap `100% | 150% | 200%` quick cycle button right in the Panel Header and General tab) with automatic inverse-viewport compensation (`calc((100% - 16px) / var(--sx-ui-scale))`) so even if you zoom Safari/PWA down to 50%, you can scale the script UI to 150% or 200% without a single pixel clipping off screen!
 *    - Also added `btnGlobalScale` (80% – 220%) to scale all floating Macro / Screenshot / Quick-Ball buttons together.
 *    - Added `fixGfnScroll` (ON by default): unlocks vertical touch scrolling (`overflow-y: auto !important; -webkit-overflow-scrolling: touch !important`) on GFN's native Lobby Settings and In-Stream `⋮` dropdown menu so GFN settings are never cut off!
 * 2. Remade & Expanded Studio Filter Library (24 Game & Cinema Presets + 14 Color Tints + Quick Visual Chip Gallery):
 *    - Hand-tuned 24 presets for Genshin Impact, Wuthering Waves, Honkai: Star Rail, Black Myth: Wukong, Cyberpunk, FPS Spotter, OLED Pop, RTX Vibrance, Kodak Gold, Fujifilm Velvia, Studio Ghibli, etc., with a 1-tap scrollable Preset Chip Gallery in the Picture tab.
 * 3. Ultra-Crisp 2K HD Screenshot Engine (Dual-Radius 9-Tap Unsharp Mask + Local Clarity + Filter Baker):
 *    - Fixes blurry WebRTC video captures on iOS WebKit by staging `#remote-video` onto a 1:1 2D frame buffer first (eliminating WebKit MediaStream WebGL texture bugs), then running a high-precision WebGL 2.0x Super-Resolution shader with 8-neighbor Fine Edge Unsharp Mask + Medium-Radius Local Clarity (removes H.264 cloud compression haze) + full Picture Filter & Tint baking, plus a CPU convolution fallback.
 *    - Added a dedicated "Photo Sharpness & Clarity Boost" slider (0% – 250%, default 145% Ultra-Crisp) in the Screenshot tab.
 */

(function () {
  'use strict';

  const FLAG = Symbol.for('nvirya.gfn.v2');
  if (window.top !== window || window[FLAG]) return;
  try { Object.defineProperty(window, FLAG, { value: true }); } catch (_) {}

  /* ================= helpers ================= */
  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const cl = (v, a, b) => Math.min(b, Math.max(a, v));
  const nv = (v, d) => { if (v == null || v === '') return d; v = +v; return isFinite(v) ? v : d; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const nextFrame = () => new Promise(r => requestAnimationFrame(r));
  const guard = (fn, name) => { try { return fn(); } catch (e) { console.warn('[GFN-X]', name || '', e); } };
  const vid = () => document.getElementById('remote-video');
  const streaming = () => { const v = vid(); return !!(v && v.srcObject && v.videoWidth > 0); };
  const newId = (prefix = 'm') => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const NS = 'http://www.w3.org/2000/svg';

  /* ================= 1. IMMEDIATE iOS PWA BYPASS (document-start) ================= */
  guard(() => Object.defineProperty(navigator, 'standalone', { get: () => true, configurable: true }), 'standalone');
  guard(() => {
    if (typeof Navigator !== 'undefined' && Navigator.prototype) {
      Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true, configurable: true });
    }
  }, 'navProtoStandalone');

  /* ---- High-Precision rAF Wait ---- */
  async function waitExact(ms, st) {
    if (!ms || ms <= 0) return;
    const target = performance.now() + ms;
    if (ms > 18) {
      await sleep(Math.max(1, ms - 12));
    }
    while (!(st && st.stop)) {
      const rem = target - performance.now();
      if (rem <= 0.8) break;
      await nextFrame();
    }
  }

  /* ---- Human Jitter Helpers ---- */
  const randRange = (min, max) => min + Math.random() * (max - min);
  const jitterCoord = (pxVal, amp = 2.0) => pxVal + randRange(-amp, amp);

  const jitterTime = (ms, isRecorded) => {
    if (!ms || ms <= 0) return 0;
    if (isRecorded) return Math.max(1, ms + randRange(-0.5, 0.5));
    if (ms <= 30) return cl(Math.round(ms + randRange(-1.5, 1.5)), 8, 34);
    const mag = randRange(0.06, 0.12);
    const sign = Math.random() < 0.5 ? -1 : 1;
    return Math.max(10, Math.round(ms * (1 + sign * mag)));
  };

  const jitterHold = (holdMs, isRecorded) => {
    const base = nv(holdMs, 20);
    if (isRecorded) return Math.max(10, base + randRange(-1, 1));
    if (base <= 30) return cl(Math.round(base + randRange(-2, 2)), 10, 34);
    if (base > 30 && base <= 60) return Math.round(randRange(36, 54));
    return jitterTime(base, false);
  };

  /* ---- SVG icons (24x24 viewBox, stroke-width 1.8) ---- */
  const IC = {
    close: 'M18 6 6 18M6 6l12 12',
    camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    sliders: 'M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4',
    gauge: 'M12 14l4-4M3.34 19a10 10 0 1 1 17.32 0',
    stop: 'M7 7h10v10H7z',
    play: 'M8 5v14l11-7z',
    pointer: 'M5 3l14 8-6.5 1.8L10.5 19z',
    zap: 'M13 2 3 14h9l-1 8 10-12h-9z',
    plus: 'M12 5v14M5 12h14',
    trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6',
    edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
    undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
    up: 'm6 15 6-6 6 6',
    down: 'm6 9 6 6 6-6',
    copy: 'M8 8h12v12H8zM4 16V4h12',
    download: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
    upload: 'M12 20V9m0 0-4 4m4-4 4 4M5 4h14',
    tap: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3v3M12 18v3M3 12h3M18 12h3',
    zone: 'M4 4h16v16H4zM4 12h16M12 4v16',
    swipe: 'M3 12h14m0 0-5-5m5 5-5 5M21 5v14',
    elastic: 'M4 12h13m0 0-4-4m4 4-4 4M8 8l-4 4 4 4',
    arrowr: 'M5 12h14m0 0-6-6m6 6-6 6',
    wait: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    check: 'm5 12 5 5 9-10',
    save: 'M6 4h12v16l-6-4-6 4z',
    reset: 'M4 12a8 8 0 1 0 3-6.3L4 8M4 3v5h5',
    rec: 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    folder: 'M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    leaf: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.4 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z',
    aim: 'M12 2v4M12 18v4M2 12h4M18 12h4M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    multi: 'M7 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    circle: 'M12 21a9 9 0 1 1 6.36-2.64M18 14v5h-5',
    burst: 'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    pip: 'M19 7h-8v6h8V7zm2-4H3C1.9 3 1 3.9 1 5v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z',
    move: 'M12 2v20M2 12h20M12 2 9 5M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3',
    zoom: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
    bar: 'M4 6h16M4 12h16M4 18h16',
    random: 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
    volume: 'M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14',
  };
  function ico(name, size) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size || 18);
    s.setAttribute('height', size || 18);
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.8');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('focusable', 'false');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'sx-ic');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', IC[name] || IC.tap);
    s.append(p);
    return s;
  }
  function btn(text, icon, cls) {
    const b = h('button', 'sx-btn ' + (cls || ''));
    b.type = 'button';
    if (icon) b.append(ico(icon, 15));
    if (text) b.append(document.createTextNode(text));
    return b;
  }

  /* ================= 24 STUDIO-GRADE FILTER PRESETS & 14 COLOR TINTS ================= */
  const TINTS = {
    warm: [255, 175, 95],
    cool: [95, 160, 255],
    rose: [255, 115, 165],
    mint: [85, 235, 190],
    violet: [165, 115, 255],
    gold: [255, 200, 85],
    amber: [255, 150, 60],
    sakura: [255, 145, 195],
    aqua: [70, 215, 255],
    ice: [165, 225, 255],
    cyber: [190, 90, 255],
    emerald: [70, 205, 135],
    teal: [55, 185, 205],
    crimson: [245, 70, 85]
  };
  const FX0 = { c: 1, s: 1, b: 1, hue: 0, sep: 0, gray: 0, tint: 'none', ta: 0.12, vig: 0 };
  const fxo = o => Object.assign({}, FX0, o);
  const PRESET_LIST = [
    ['off', 'Off (Original)'],
    ['genshin_vivid', 'Anime Vivid Pro (Genshin/HSR)'],
    ['wuwa_crisp', 'Wuthering Crisp HDR (WuWa)'],
    ['rtx_hdr', 'NVIDIA RTX Vibrance HDR'],
    ['oled_pop', 'OLED Super Pop (Deep Black)'],
    ['golden_hour', 'Golden Hour Sunset'],
    ['sakura_bloom', 'Inazuma Sakura Bloom'],
    ['fontaine_aqua', 'Fontaine Crystal Aqua'],
    ['cyber_edgerunner', 'Cyberpunk Neon (Teal/Pink)'],
    ['wukong_myth', 'Dark Myth Cinema (Wukong)'],
    ['fps_compet', 'FPS Spotter (Shadow Boost)'],
    ['night_vision', 'Night Cave Explorer'],
    ['kodak_gold', 'Kodak Gold 200 Film'],
    ['fuji_velvia', 'Fujifilm Velvia 50 (Lush)'],
    ['cinema_imax', 'IMAX Teal & Orange'],
    ['ghibli_warm', 'Studio Ghibli Painterly'],
    ['pastel_dream', 'Soft Pastel Dream'],
    ['arctic_frost', 'Dragonspine Frost'],
    ['blood_moon', 'Crimson Abyss'],
    ['eye_comfort', 'Eye Comfort (Warm Night)'],
    ['manga_ink', 'High-Contrast Manga Ink'],
    ['noir_detective', 'Classic Silver Noir'],
    ['retro_crt', '90s Retro Arcade'],
    ['vivid', 'Balanced Everyday Vivid']
  ];
  const PRESETS = {
    off: fxo({}),
    genshin_vivid: fxo({ c: 1.14, s: 1.38, b: 1.05, hue: -2, tint: 'amber', ta: 0.05, vig: 0.08 }),
    wuwa_crisp: fxo({ c: 1.24, s: 1.26, b: 1.03, hue: -4, tint: 'ice', ta: 0.06, vig: 0.14 }),
    rtx_hdr: fxo({ c: 1.20, s: 1.42, b: 1.04, tint: 'none', ta: 0, vig: 0.10 }),
    oled_pop: fxo({ c: 1.28, s: 1.48, b: 0.99, tint: 'none', ta: 0, vig: 0.15 }),
    golden_hour: fxo({ c: 1.10, s: 1.28, b: 1.04, hue: -5, tint: 'gold', ta: 0.14, vig: 0.15 }),
    sakura_bloom: fxo({ c: 1.06, s: 1.24, b: 1.06, hue: 6, tint: 'sakura', ta: 0.13, vig: 0.12 }),
    fontaine_aqua: fxo({ c: 1.12, s: 1.30, b: 1.05, hue: -6, tint: 'aqua', ta: 0.10, vig: 0.08 }),
    cyber_edgerunner: fxo({ c: 1.25, s: 1.52, b: 1.02, hue: 8, tint: 'cyber', ta: 0.12, vig: 0.22 }),
    wukong_myth: fxo({ c: 1.26, s: 0.92, b: 0.98, sep: 0.12, tint: 'emerald', ta: 0.08, vig: 0.28 }),
    fps_compet: fxo({ c: 1.16, s: 1.36, b: 1.18, tint: 'none', ta: 0, vig: 0 }),
    night_vision: fxo({ c: 0.94, s: 1.12, b: 1.28, tint: 'ice', ta: 0.06, vig: 0 }),
    kodak_gold: fxo({ c: 1.08, s: 1.18, b: 1.03, sep: 0.14, tint: 'gold', ta: 0.10, vig: 0.18 }),
    fuji_velvia: fxo({ c: 1.18, s: 1.50, b: 1.01, hue: -2, tint: 'none', ta: 0, vig: 0.12 }),
    cinema_imax: fxo({ c: 1.22, s: 1.08, b: 1.00, hue: -4, tint: 'teal', ta: 0.10, vig: 0.26 }),
    ghibli_warm: fxo({ c: 1.04, s: 1.32, b: 1.06, sep: 0.06, tint: 'warm', ta: 0.09, vig: 0.05 }),
    pastel_dream: fxo({ c: 0.88, s: 0.94, b: 1.10, tint: 'sakura', ta: 0.10, vig: 0.06 }),
    arctic_frost: fxo({ c: 1.16, s: 1.10, b: 1.06, hue: 4, tint: 'ice', ta: 0.12, vig: 0.10 }),
    blood_moon: fxo({ c: 1.24, s: 1.20, b: 0.97, hue: -8, tint: 'crimson', ta: 0.14, vig: 0.30 }),
    eye_comfort: fxo({ c: 0.96, s: 0.95, b: 0.98, sep: 0.12, tint: 'warm', ta: 0.14, vig: 0 }),
    manga_ink: fxo({ c: 1.38, s: 0, b: 1.04, gray: 1, vig: 0.25 }),
    noir_detective: fxo({ c: 1.22, s: 0, b: 0.98, sep: 0.08, gray: 1, vig: 0.35 }),
    retro_crt: fxo({ c: 1.12, s: 1.15, b: 1.02, sep: 0.25, tint: 'violet', ta: 0.08, vig: 0.22 }),
    vivid: fxo({ c: 1.12, s: 1.24, b: 1.03 }),
    // Legacy compatibility aliases
    punchy: fxo({ c: 1.2, s: 1.3, b: 1.02 }),
    crisp: fxo({ c: 1.15, s: 1.08 }),
    soft: fxo({ c: 0.96, s: 1.05, b: 1.04 }),
    pastel: fxo({ c: 0.9, s: 0.85, b: 1.08 }),
    bright: fxo({ c: 1.04, s: 1.05, b: 1.16 }),
    night: fxo({ c: 0.95, s: 1.05, b: 1.22, tint: 'cool', ta: 0.06 }),
    warm: fxo({ s: 1.05, tint: 'warm', ta: 0.12 }),
    cool: fxo({ s: 1.03, tint: 'cool', ta: 0.12 }),
    dream: fxo({ c: 0.92, s: 1.1, b: 1.06, tint: 'rose', ta: 0.1, vig: 0.15 }),
    cinematic: fxo({ c: 1.12, s: 0.95, b: 0.98, tint: 'cool', ta: 0.06, vig: 0.3 }),
    retro: fxo({ c: 1.05, s: 0.9, sep: 0.35, vig: 0.2 }),
    noir: fxo({ c: 1.2, b: 0.95, gray: 1, vig: 0.35 })
  };

  const TPL = {
    loot20: { label: 'Turbo Loot 20ms (hold)', name: 'Loot', mode: 'hold', interval: 20, steps: [
      { t: 'burst', x: 66, y: 55, cnt: 4, hold: 14, spread: 1.5, wait: 4 },
      { t: 'zone', x: 62, y: 42, w: 18, h: 26, rows: 3, cols: 1, hold: 14, wait: 4 }] },
    pick: { label: 'Single Pick 20ms (hold)', name: 'Pick', mode: 'hold', interval: 20, steps: [
      { t: 'tap', x: 66, y: 55, hold: 16, wait: 4 }] },
    skip: { label: 'Fast Skip Dialogue', name: 'Skip', mode: 'toggle', interval: 55, steps: [
      { t: 'tap', x: 50, y: 60, hold: 18, wait: 18 },
      { t: 'zone', x: 62, y: 34, w: 30, h: 26, rows: 3, hold: 18, wait: 18 }] },
    walk: { label: 'Auto-Walk Forward (Toggle)', name: 'Walk', mode: 'toggle', interval: 30, steps: [
      { t: 'swipe', x: 18, y: 72, x2: 18, y2: 42, dur: 2500, wait: 10 }] },
    dash: { label: 'Elastic Dodge / Dash Flick', name: 'Dash', mode: 'once', interval: 30, steps: [
      { t: 'elastic', x: 18, y: 72, x2: 18, y2: 44, dur: 95, hold: 35, wait: 15 }] },
    spin360: { label: 'Circle Spin 360° (Joystick/Attack)', name: 'Spin', mode: 'toggle', interval: 40, steps: [
      { t: 'circle', x: 18, y: 72, rad: 9, dur: 750, wait: 10 }] },
    jumpatk: { label: 'Jump + Attack (Multi-Touch)', name: 'J-Atk', mode: 'once', interval: 40, steps: [
      { t: 'multi', x: 84, y: 74, x2: 91, y2: 58, hold: 45, wait: 20 }] },
    rapid: { label: 'Rapid Burst 20ms (hold)', name: 'Burst', mode: 'hold', interval: 20, steps: [
      { t: 'burst', x: 84, y: 74, cnt: 5, hold: 14, spread: 2, wait: 4 }] },
    combo: { label: 'Skill Combo (4 points)', name: 'Combo', mode: 'once', steps: [
      { t: 'tap', x: 70, y: 78, hold: 28, wait: 65 },
      { t: 'tap', x: 80, y: 70, hold: 28, wait: 65 },
      { t: 'tap', x: 88, y: 60, hold: 28, wait: 65 },
      { t: 'tap', x: 92, y: 46, hold: 28, wait: 0 }] },
    charge: { label: 'Charged Attack (Hold)', name: 'Charge', mode: 'once', steps: [
      { t: 'tap', x: 84, y: 74, hold: 1100, wait: 0 }] },
    swipe: { label: 'Camera 180° Flick', name: 'Flick', mode: 'once', interval: 200, steps: [
      { t: 'swipe', x: 75, y: 50, x2: 20, y2: 50, dur: 95, wait: 0 }] }
  };

  /* ================= macro & template model + Anti-Overlap Button Slot Engine ================= */
  let cfg = null;

  function normStep(s) {
    s = s || {};
    const validTypes = ['tap', 'zone', 'swipe', 'wait', 'multi', 'circle', 'burst', 'elastic', 'bar'];
    const t = validTypes.includes(s.t) ? s.t : 'tap';
    const o = { t };
    if (s.rec) o.rec = true;
    if (t === 'wait') { o.wait = cl(nv(s.wait, 100), 0, 30000); return o; }
    o.wait = cl(nv(s.wait, 0), 0, 30000);
    o.rep = cl(Math.round(nv(s.rep, 1)), 1, 50);
    o.x = cl(nv(s.x, 50), 0, 100);
    o.y = cl(nv(s.y, 50), 0, 100);
    if (t === 'tap' || t === 'zone') o.hold = cl(nv(s.hold, 20), 10, 30000);
    if (t === 'multi') {
      o.x2 = cl(nv(s.x2, 75), 0, 100);
      o.y2 = cl(nv(s.y2, 60), 0, 100);
      o.hold = cl(nv(s.hold, 35), 10, 30000);
    }
    if (t === 'circle') {
      o.rad = cl(nv(s.rad, 8), 1, 40);
      o.dur = cl(nv(s.dur, 700), 60, 30000);
    }
    if (t === 'burst') {
      o.cnt = cl(Math.round(nv(s.cnt, 5)), 2, 40);
      o.hold = cl(nv(s.hold, 15), 10, 1000);
      o.spread = cl(nv(s.spread, 1.5), 0, 20);
    }
    if (t === 'elastic') {
      o.x2 = cl(nv(s.x2, 18), 0, 100);
      o.y2 = cl(nv(s.y2, 44), 0, 100);
      o.dur = cl(nv(s.dur, 95), 15, 10000);
      o.hold = cl(nv(s.hold, 35), 0, 5000);
    }
    if (t === 'bar') {
      o.h = cl(nv(s.h, 24), 4, 100);
      o.opts = cl(Math.round(nv(s.opts, 3)), 2, 8);
      o.pick = ['rand', 'seq', 'all'].includes(s.pick) ? s.pick : 'rand';
      o.hold = cl(nv(s.hold, 18), 10, 30000);
    }
    if (t === 'swipe') {
      o.x2 = cl(nv(s.x2, 70), 0, 100);
      o.y2 = cl(nv(s.y2, 50), 0, 100);
      o.dur = cl(nv(s.dur, 180), 10, 30000);
      if (Array.isArray(s.pts) && s.pts.length >= 2) {
        o.pts = s.pts.slice(0, 400).map(pt => [
          cl(nv(pt[0], o.x), 0, 100),
          cl(nv(pt[1], o.y), 0, 100),
          cl(nv(pt[2], 0), 0, 30000)
        ]);
      }
    }
    if (t === 'zone') {
      o.w = cl(nv(s.w, 30), 2, 100);
      o.h = cl(nv(s.h, 30), 2, 100);
      o.rows = cl(Math.round(nv(s.rows, 3)), 1, 12);
      o.cols = cl(Math.round(nv(s.cols, 1)), 1, 12);
    }
    return o;
  }

  function normRawEv(ev) {
    if (!Array.isArray(ev)) return null;
    const cleaned = [];
    const lastMoveBySlot = new Map();
    for (let i = 0; i < ev.length && cleaned.length < 3500; i++) {
      const e = ev[i];
      if (!Array.isArray(e) || e.length < 5) continue;
      const t = cl(nv(e[0], 0), 0, 120000);
      const type = cl(Math.round(nv(e[1], 0)), 0, 2);
      const slot = cl(Math.round(nv(e[2], 0)), 0, 9);
      const x = +(cl(nv(e[3], 50), 0, 100)).toFixed(2);
      const y = +(cl(nv(e[4], 50), 0, 100)).toFixed(2);
      const mx = +(nv(e[5], 0)).toFixed(2);
      const my = +(nv(e[6], 0)).toFixed(2);

      if (type === 1) {
        const prev = lastMoveBySlot.get(slot);
        if (prev && (t - prev[0] < 8) && Math.hypot(x - prev[3], y - prev[4]) < 0.2) {
          continue;
        }
        const entry = [t, type, slot, x, y, mx, my];
        lastMoveBySlot.set(slot, entry);
        cleaned.push(entry);
      } else {
        lastMoveBySlot.delete(slot);
        cleaned.push([t, type, slot, x, y, mx, my]);
      }
    }
    return cleaned;
  }

  function normMacro(m) {
    m = m || {};
    const out = {
      id: m.id || newId('m'),
      name: String(m.name || 'Macro').slice(0, 16),
      on: !!m.on,
      mode: ['toggle', 'hold', 'once'].includes(m.mode) ? m.mode : 'toggle',
      interval: cl(nv(m.interval, 20), 20, 10000),
      loops: cl(Math.round(nv(m.loops, 0)), 0, 999),
      delay: cl(nv(m.delay, 0), 0, 5000),
      speed: cl(nv(m.speed, 1), 0.5, 2.5),
      chainId: m.chainId ? String(m.chainId) : '',
      size: cl(nv(m.size, 1), 0.6, 1.8),
      opacity: cl(nv(m.opacity, 0.94), 0.2, 1),
      label: m.label !== false,
      steps: (Array.isArray(m.steps) ? m.steps : []).slice(0, 300).map(normStep),
      btn: { x: cl(nv(m.btn && m.btn.x, 94), 3, 97), y: cl(nv(m.btn && m.btn.y, 22), 5, 95) }
    };
    if (m.tplId) out.tplId = String(m.tplId);
    if (Array.isArray(m.ev) && m.ev.length) out.ev = normRawEv(m.ev);
    return out;
  }

  function normTemplate(tp) {
    tp = tp || {};
    const out = {
      id: tp.id || newId('tpl_'),
      name: String(tp.name || tp.label || 'Recorded').slice(0, 20),
      mode: ['toggle', 'hold', 'once'].includes(tp.mode) ? tp.mode : 'once',
      interval: cl(nv(tp.interval, 20), 20, 10000),
      loops: cl(Math.round(nv(tp.loops, 1)), 0, 999),
      delay: cl(nv(tp.delay, 0), 0, 5000),
      speed: cl(nv(tp.speed, 1), 0.5, 2.5),
      steps: (Array.isArray(tp.steps) ? tp.steps : []).slice(0, 300).map(normStep),
      createdAt: nv(tp.createdAt, Date.now())
    };
    if (Array.isArray(tp.ev) && tp.ev.length) out.ev = normRawEv(tp.ev);
    return out;
  }

  function isSlotOccupied(x, y, excludeId, list) {
    const arr = list || (cfg && cfg.macros ? cfg.macros : []);
    if (cfg && cfg.shotBtn && cfg.shotBtnPos) {
      if (Math.abs(cfg.shotBtnPos.x - x) < 7 && Math.abs(cfg.shotBtnPos.y - y) < 10) return true;
    }
    if (cfg && cfg.quickBall && cfg.quickBallPos) {
      if (Math.abs(cfg.quickBallPos.x - x) < 7 && Math.abs(cfg.quickBallPos.y - y) < 10) return true;
    }
    for (const m of arr) {
      if (excludeId && m.id === excludeId) continue;
      if (!m.btn) continue;
      if (Math.abs(m.btn.x - x) < 7 && Math.abs(m.btn.y - y) < 10.5) return true;
    }
    return false;
  }

  function findFreeBtnSlot(excludeId, list) {
    const arr = list || (cfg && cfg.macros ? cfg.macros : []);
    const cols = [94, 85, 76, 6, 15];
    const rows = [20, 33, 46, 59, 72, 85];
    for (const cx of cols) {
      for (const ry of rows) {
        if (!isSlotOccupied(cx, ry, excludeId, arr)) {
          return { x: cx, y: ry };
        }
      }
    }
    return { x: 85, y: cl(20 + (arr.length * 11) % 70, 12, 88) };
  }

  function cleanAndSeparateMacros(list, templates) {
    const out = [];
    const seenIds = new Set();
    const seenTplIds = new Set();
    const seenNames = new Map();

    for (const m of list) {
      if (seenIds.has(m.id)) continue;
      seenIds.add(m.id);

      if (!m.tplId && Array.isArray(templates)) {
        const matchTpl = templates.find(t => t.name.slice(0, 16).toLowerCase() === m.name.toLowerCase());
        if (matchTpl) m.tplId = matchTpl.id;
      }

      if (m.tplId) {
        if (seenTplIds.has(m.tplId)) continue;
        seenTplIds.add(m.tplId);
      }

      const normName = m.name.trim().toLowerCase();
      if (seenNames.has(normName)) {
        const prev = seenNames.get(normName);
        if (m.tplId || prev.tplId || JSON.stringify(prev.steps) === JSON.stringify(m.steps)) {
          const idx = out.indexOf(prev);
          if (idx !== -1) out.splice(idx, 1);
        }
      }
      seenNames.set(normName, m);
      out.push(m);
    }

    const placed = [];
    for (const m of out) {
      if (isSlotOccupied(m.btn.x, m.btn.y, m.id, placed)) {
        m.btn = findFreeBtnSlot(m.id, placed);
      }
      placed.push(m);
    }
    return out;
  }

  function autoArrangeAllButtons() {
    const placed = [];
    cfg.macros.forEach(m => {
      m.btn = findFreeBtnSlot(m.id, placed);
      placed.push(m);
    });
    commit('macros', true);
    toast('Buttons arranged into a clean non-overlapping column');
  }

  function getTplOptions() {
    const builtIn = Object.keys(TPL).map(k => [k, TPL[k].label]);
    const custom = (cfg && Array.isArray(cfg.customTemplates) ? cfg.customTemplates : [])
      .map(t => ['ct:' + t.id, t.name + ' (Recorded)']);
    return builtIn.concat(custom);
  }
  function resolveTpl(key) {
    if (String(key).startsWith('ct:') && cfg && Array.isArray(cfg.customTemplates)) {
      const id = String(key).slice(3);
      const found = cfg.customTemplates.find(t => t.id === id);
      if (found) return Object.assign(JSON.parse(JSON.stringify(found)), { tplId: found.id });
    }
    return JSON.parse(JSON.stringify(TPL[key] || TPL.loot20));
  }
  function fromTpl(key, y) {
    const t = resolveTpl(key);
    const pos = y != null ? { x: 94, y } : findFreeBtnSlot(null, cfg ? cfg.macros : []);
    return normMacro(Object.assign({}, t, { id: newId('m'), on: true, btn: pos }));
  }
  const defaultMacros = () => {
    const a = fromTpl('skip', 20), b = fromTpl('loot20', 33);
    a.on = false; b.on = false;
    return [a, b];
  };

  /* ================= config ================= */
  const CFG_KEY = 'sx_gfn_cfg_v2';
  const OLD_SILENT_KEY = 'gfn_silent_stream_enabled';
  const DEF = {
    uiScale: 1,
    btnGlobalScale: 1,
    fixGfnScroll: true,
    silent: false,
    audioBoost: 1,
    batterySaver: false,
    afkGuard: false,
    inputGuard: true,
    sessionTimer: true,
    sessionLimitMin: 60,
    quickBall: false,
    quickHideBtns: false,
    freeDragBtns: true,
    oledDim: 0,
    gyroAim: false,
    gyroSens: 1.2, gyroDeadzone: 0.15, gyroSmoothing: 0.72, gyroInvert: false,
    crosshair: 'off', crosshairColor: '#007aff', crosshairSize: 14, crosshairX: 50, crosshairY: 50,
    hudOn: false, hudDetail: 'graphs', hudPos: 'tr', hudOpacity: 0.94,
    fxPreset: 'off', fxContrast: 1, fxSaturate: 1, fxBrightness: 1, fxHue: 0, fxSepia: 0, fxGray: 0,
    fxTint: 'none', fxTintA: 0.12, fxVig: 0, sharpen: 0, sharpenEco: false,
    viewX: 0, viewY: 0, viewZoom: 1,
    shotBtn: false, shotFormat: 'png', shotScale: '2', shotSharpness: 1.45, shotApplyFx: true, shotSharpen: true, shotShare: true,
    macroEnabled: false, macroPauseMode: 'never', macroPauseRadius: 70, macroPauseMs: 350,
    macroMaxMin: 15, macroInput: 'both', macroSmartPace: true, macroRipple: true,
    recCountdown: true, recAutoBtn: true,
    v33Migrated: true
  };
  function loadCfg() {
    let o = {};
    try { o = JSON.parse(localStorage.getItem(CFG_KEY) || '{}') || {}; } catch (_) {}
    delete o.vres; delete o.vresW; delete o.vresH;
    delete o.tcHide; delete o.tcOpacity; delete o.tcScale; delete o.tcIconScale; delete o.tcX; delete o.tcY;
    delete o.macroPause;
    if (!o.v33Migrated) {
      if (o.macroInput === 'pointer') o.macroInput = 'both';
      if (o.shotScale === '1.5' || !o.shotScale) o.shotScale = '2';
      o.v33Migrated = true;
    }
    const c = Object.assign({}, DEF, o);
    c.uiScale = cl(nv(c.uiScale, 1), 0.8, 2.5);
    c.btnGlobalScale = cl(nv(c.btnGlobalScale, 1), 0.7, 2.2);
    c.shotSharpness = cl(nv(c.shotSharpness, 1.45), 0, 2.5);
    c.shotBtnPos = Object.assign({ x: 94, y: 8 }, o.shotBtnPos);
    c.quickBallPos = Object.assign({ x: 4, y: 50 }, o.quickBallPos);
    c.hudCustomPos = o.hudCustomPos || null;
    c.customTemplates = (Array.isArray(o.customTemplates) ? o.customTemplates : []).slice(0, 40).map(normTemplate);
    const rawMacros = (Array.isArray(o.macros) ? o.macros : defaultMacros()).map(normMacro);
    c.macros = cleanAndSeparateMacros(rawMacros, c.customTemplates);
    c.userPresets = (Array.isArray(o.userPresets) ? o.userPresets : [])
      .filter(p => p && typeof p.name === 'string' && p.v && typeof p.v === 'object')
      .slice(0, 30).map(p => ({ name: p.name.slice(0, 16), v: Object.assign({}, FX0, p.v) }));
    if (!('silent' in o)) {
      try { c.silent = localStorage.getItem(OLD_SILENT_KEY) === 'true'; } catch (_) {}
    }
    return c;
  }
  cfg = loadCfg();
  let saveT = 0;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try {
        localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
      } catch (e) {
        try {
          if (cfg.customTemplates && cfg.customTemplates.length > 1) {
            cfg.customTemplates[cfg.customTemplates.length - 1].ev = null;
            localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
          }
        } catch (_) {}
      }
    }, 200);
  }

  /* ================= early hooks (document-start) ================= */
  const activeStreams = new Set();
  const audioContexts = new Set();
  const pcs = new Set();
  const realDpr = window.devicePixelRatio || 1;
  let boostCtx = null, boostGain = null;
  const boostedElements = new WeakSet();

  // Track WebKit AudioContext instances
  guard(() => {
    ['AudioContext', 'webkitAudioContext'].forEach(k => {
      const OrigAC = window[k];
      if (typeof OrigAC !== 'function') return;
      const Wrapped = function (...args) {
        const ctx = new OrigAC(...args);
        audioContexts.add(ctx);
        return ctx;
      };
      Wrapped.prototype = OrigAC.prototype;
      Object.setPrototypeOf(Wrapped, OrigAC);
      window[k] = Wrapped;
    });
  }, 'audioContextHook');

  // Audio streams (Silent Mode)
  guard(() => {
    const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject');
    if (!d) return;
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      configurable: true, enumerable: d.enumerable,
      get() { return d.get.call(this); },
      set(s) {
        if (s && s.getAudioTracks) {
          activeStreams.add(s);
          if (cfg.silent) s.getAudioTracks().forEach(t => { t.enabled = false; });
        }
        return d.set.call(this, s);
      }
    });
  }, 'srcObject');

  guard(() => {
    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (cfg.silent) { this.muted = true; this.volume = 0; }
      return origPlay.apply(this, arguments);
    };
    const origPause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = function () {
      if (this.id === 'remote-video') return;
      return origPause.apply(this, arguments);
    };
  }, 'play/pause');

  // Background PiP Keepalive (Only block visibilitychange/pagehide; never block blur!)
  guard(() => {
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    Object.defineProperty(document, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
  }, 'visibility');
  guard(() => Object.defineProperty(document, 'onvisibilitychange', { set: () => {}, get: () => null }), 'onvis');
  guard(() => {
    const blocked = ['visibilitychange', 'webkitvisibilitychange', 'pagehide'];
    const wrap = orig => function (type, l, o) { return blocked.includes(type) ? undefined : orig.call(this, type, l, o); };
    Document.prototype.addEventListener = wrap(Document.prototype.addEventListener);
    Window.prototype.addEventListener = wrap(Window.prototype.addEventListener);
  }, 'blockEvents');

  // Capture RTCPeerConnection instances without replacing the constructor
  guard(() => {
    const P = (window.RTCPeerConnection || window.webkitRTCPeerConnection || {}).prototype;
    if (!P) return;
    const reg = pc => {
      if (pcs.has(pc)) return;
      pcs.add(pc);
      pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'closed') pcs.delete(pc); });
    };
    ['setRemoteDescription', 'setLocalDescription'].forEach(n => {
      const o = P[n];
      if (typeof o !== 'function') return;
      P[n] = function () { reg(this); return o.apply(this, arguments); };
    });
  }, 'rtc');

  /* ================= state / commit ================= */
  const REBUILD = new Set(['macroPauseMode', 'crosshair', 'sessionTimer', 'gyroAim']);
  let applyQ = 0;
  function set(k, v) { cfg[k] = v; commit(k, REBUILD.has(k)); }
  function commit(k, rebuild) {
    save();
    if (k === 'silent' || k === 'audioBoost') applySilent();
    if (k === 'gyroAim') updateGyro();
    if (k === 'batterySaver') {
      toast(cfg.batterySaver ? 'Battery Saver ON (Reduced GPU & CPU load)' : 'Battery Saver OFF');
    }
    cancelAnimationFrame(applyQ);
    applyQ = requestAnimationFrame(applyAll);
    if (rebuild) rebuildUI();
    refreshControls();
  }
  function applyAll() {
    guard(applyDyn, 'dyn');
    guard(updateSharpen, 'sharpen');
    guard(updateOverlay, 'overlay');
  }

  /* ---- Silent Mode, WebAudio Volume Booster & iOS WebKit Audio Auto-Resume ---- */
  let unlockPending = false;
  function applyAudioBoost() {
    if (cfg.silent || cfg.audioBoost <= 1.02) {
      if (boostGain) boostGain.gain.value = 1;
      return;
    }
    guard(() => {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!boostCtx) {
        boostCtx = new AC();
        boostGain = boostCtx.createGain();
        boostGain.connect(boostCtx.destination);
      }
      if (boostCtx.state === 'suspended') boostCtx.resume().catch(() => {});
      boostGain.gain.value = cl(nv(cfg.audioBoost, 1), 1, 2.5);
      document.querySelectorAll('audio').forEach(el => {
        if (boostedElements.has(el)) return;
        if (el.srcObject && el.srcObject.getAudioTracks && el.srcObject.getAudioTracks().length > 0) {
          try {
            const src = boostCtx.createMediaStreamSource(el.srcObject);
            src.connect(boostGain);
            boostedElements.add(el);
          } catch (_) {}
        }
      });
    }, 'audioBoost');
  }

  function wakeAudioOnce() {
    unlockPending = false;
    if (cfg.silent) return;
    guard(() => {
      activeStreams.forEach(s => {
        if (s && s.getAudioTracks) s.getAudioTracks().forEach(t => { t.enabled = true; });
      });
      audioContexts.forEach(ctx => {
        if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
          ctx.resume().catch(() => {});
        }
      });
      document.querySelectorAll('audio, video').forEach(m => {
        const isSilentVideo = m.id === 'remote-video' && (!m.srcObject || !m.srcObject.getAudioTracks || m.srcObject.getAudioTracks().length === 0);
        m.muted = isSilentVideo;
        m.volume = 1;
        const p = m.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      });
      applyAudioBoost();
    }, 'wakeAudioOnce');
  }

  function applySilent() {
    const val = !!cfg.silent;
    activeStreams.forEach(s => {
      if (s && s.getAudioTracks) s.getAudioTracks().forEach(t => { t.enabled = !val; });
    });
    document.querySelectorAll('audio, video').forEach(m => {
      const hasAudio = m.tagName === 'AUDIO' || (m.srcObject && m.srcObject.getAudioTracks && m.srcObject.getAudioTracks().length > 0);
      m.muted = val || !hasAudio;
      m.volume = val ? 0 : 1;
    });
    if (!val) {
      wakeAudioOnce();
      if (!unlockPending) {
        unlockPending = true;
        window.addEventListener('pointerdown', wakeAudioOnce, { once: true, capture: true, passive: true });
      }
    }
  }

  /* ---- 1-Tap Picture-in-Picture (PiP) ---- */
  async function togglePiP() {
    const v = vid();
    if (!v || !v.videoWidth) { toast('Start a game stream first'); return; }
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (v.requestPictureInPicture) {
        await v.requestPictureInPicture();
      } else if (v.webkitSetPresentationMode) {
        const nextMode = v.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture';
        v.webkitSetPresentationMode(nextMode);
      } else {
        toast('PiP is not supported on this browser');
      }
    } catch (e) {
      toast('Could not toggle PiP: ' + (e.message || 'blocked'));
    }
  }

  /* ---- Butter-Smooth Ultra-Responsive Gyro Motion Aim Engine ---- */
  let gyroActive = false, gyroPid = 248, gyroAnchorX = 0, gyroAnchorY = 0, gyroCurX = 0, gyroCurY = 0;
  let filtDx = 0, filtDy = 0, lastBeta = null, lastGamma = null, gyroReleaseT = 0, gyroLoopRaf = 0;

  function runGyroFrame() {
    if (!gyroActive || !cfg.gyroAim || !streaming()) return;
    const speed = Math.hypot(filtDx, filtDy);
    if (speed > 0.05) {
      const prevX = gyroCurX, prevY = gyroCurY;
      const nx = gyroCurX + filtDx;
      const ny = gyroCurY + filtDy;
      const minX = window.innerWidth * 0.40, maxX = window.innerWidth * 0.96;
      const minY = window.innerHeight * 0.12, maxY = window.innerHeight * 0.88;

      // Soft re-centering: when approaching screen boundary, seamlessly re-anchor without causing camera snap
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) {
        inject('up', gyroCurX, gyroCurY, gyroPid, prevX, prevY);
        gyroAnchorX = Math.round(window.innerWidth * 0.72);
        gyroAnchorY = Math.round(window.innerHeight * 0.50);
        gyroCurX = gyroAnchorX;
        gyroCurY = gyroAnchorY;
        inject('down', gyroCurX, gyroCurY, gyroPid);
      } else {
        gyroCurX = nx;
        gyroCurY = ny;
        inject('move', gyroCurX, gyroCurY, gyroPid, prevX, prevY);
      }
      filtDx *= 0.70;
      filtDy *= 0.70;
    }
    gyroLoopRaf = requestAnimationFrame(runGyroFrame);
  }

  function onDeviceOrientation(e) {
    if (!cfg.gyroAim || !streaming() || editing || recState.on || (panel && panel.classList.contains('open'))) return;
    if (e.beta == null || e.gamma == null) return;
    if (lastBeta === null) {
      lastBeta = e.beta;
      lastGamma = e.gamma;
      return;
    }
    let dBeta = e.beta - lastBeta;
    let dGamma = e.gamma - lastGamma;
    lastBeta = e.beta;
    lastGamma = e.gamma;

    // Handle gimbal wrap
    if (dBeta > 180) dBeta -= 360; else if (dBeta < -180) dBeta += 360;
    if (dGamma > 180) dGamma -= 360; else if (dGamma < -180) dGamma += 360;

    const deadzone = nv(cfg.gyroDeadzone, 0.15);
    const mag = Math.hypot(dBeta, dGamma);
    if (mag < deadzone) return;

    const sens = cl(nv(cfg.gyroSens, 1.2), 0.3, 5.0) * 4.2;
    const invert = cfg.gyroInvert ? -1 : 1;
    const isLandscapeRight = window.orientation === -90;
    const rawDx = (isLandscapeRight ? -dBeta : dBeta) * sens;
    const rawDy = (isLandscapeRight ? dGamma : -dGamma) * sens * invert;

    const alpha = cl(1 - nv(cfg.gyroSmoothing, 0.72), 0.15, 0.95);
    filtDx = filtDx * (1 - alpha) + rawDx * alpha;
    filtDy = filtDy * (1 - alpha) + rawDy * alpha;

    if (!gyroActive) {
      gyroAnchorX = Math.round(window.innerWidth * 0.72);
      gyroAnchorY = Math.round(window.innerHeight * 0.50);
      gyroCurX = gyroAnchorX;
      gyroCurY = gyroAnchorY;
      inject('down', gyroCurX, gyroCurY, gyroPid);
      gyroActive = true;
      cancelAnimationFrame(gyroLoopRaf);
      gyroLoopRaf = requestAnimationFrame(runGyroFrame);
    }

    clearTimeout(gyroReleaseT);
    gyroReleaseT = setTimeout(() => {
      if (gyroActive) {
        cancelAnimationFrame(gyroLoopRaf);
        inject('up', gyroCurX, gyroCurY, gyroPid, gyroCurX, gyroCurY);
        gyroActive = false;
        filtDx = 0;
        filtDy = 0;
        lastBeta = null;
        lastGamma = null;
      }
    }, 180);
  }

  async function updateGyro() {
    if (!cfg.gyroAim) {
      window.removeEventListener('deviceorientation', onDeviceOrientation);
      if (gyroActive) {
        inject('up', gyroX, gyroY, gyroPid, gyroX, gyroY);
        cancelAnimationFrame(gyroLoopRaf);
        gyroActive = false;
      }
      lastBeta = null;
      return;
    }
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') {
          cfg.gyroAim = false;
          save();
          refreshControls();
          toast('Gyroscope permission denied');
          return;
        }
      }
      lastBeta = null;
      window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
      toast('Gyro Aim ON — Tilt iPhone/iPad to fine-aim');
    } catch (_) {
      toast('Tap Gyro Aim inside game to grant iOS motion access');
    }
  }

  /* ================= styles (Complete Native iOS 18 Light Mode + UI Scale 100%-250%) ================= */
  const CSS = `
:root{
  --sx-bg:rgba(242,242,247,0.95);
  --sx-s1:#ffffff;
  --sx-s2:#eef0f6;
  --sx-s3:#d8dbe4;
  --sx-line:rgba(60,60,67,0.10);
  --sx-line2:rgba(60,60,67,0.20);
  --sx-tx:#1c1c1e;
  --sx-mu:#6c6c70;
  --sx-nv:#248a3d;
  --sx-gn:#34c759;
  --sx-bl:#007aff;
  --sx-in:#5856d6;
  --sx-am:#ff9500;
  --sx-ac:var(--sx-bl);
  --sx-acx:#ffffff;
  --sx-red:#ff3b30;
  --sx-ui-scale:1;
  --sx-btn-scale:1;
  --sx-font:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display",system-ui,sans-serif;
}
#sx-root{position:fixed;inset:0;z-index:2147483000;pointer-events:none;font:400 13px/1.38 var(--sx-font);color:var(--sx-tx);-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-font-smoothing:antialiased}
#sx-root *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
#sx-fx{position:fixed;inset:0;z-index:2147482000;pointer-events:none;display:none}
.sx-ic{display:block;flex:none}

/* Native iOS Light Mode Telemetry HUD + 3 Real-Time Graphs (Supports UI Scale!) */
#sx-hud{position:absolute;display:none;flex-direction:column;gap:5px;padding:7px 11px;border-radius:14px;background:rgba(255,255,255,0.90);backdrop-filter:saturate(180%) blur(18px);-webkit-backdrop-filter:saturate(180%) blur(18px);border:1px solid rgba(255,255,255,0.75);box-shadow:0 6px 22px rgba(0,0,0,0.14),0 0 0 0.5px rgba(0,0,0,0.08);font:600 11px/1.35 var(--sx-font);font-variant-numeric:tabular-nums;color:var(--sx-tx);pointer-events:auto;touch-action:none;cursor:grab;transform:scale(var(--sx-ui-scale,1));transform-origin:top right}
#sx-root.eco #sx-hud,#sx-root.eco #sx-panel,#sx-root.eco .sx-mbtn,#sx-root.eco .sx-shot,#sx-root.eco #sx-qball,#sx-root.eco #sx-rec-bar,#sx-root.eco #sx-cd,#sx-root.eco #sx-bar{backdrop-filter:none !important;-webkit-backdrop-filter:none !important}
#sx-hud[data-pos=tl]{top:max(8px,env(safe-area-inset-top));left:max(10px,env(safe-area-inset-left));transform-origin:top left}
#sx-hud[data-pos=tr]{top:max(8px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right));transform-origin:top right}
#sx-hud[data-pos=bl]{bottom:max(8px,env(safe-area-inset-bottom));left:max(10px,env(safe-area-inset-left));transform-origin:bottom left}
#sx-hud[data-pos=br]{bottom:max(8px,env(safe-area-inset-bottom));right:max(10px,env(safe-area-inset-right));transform-origin:bottom right}
.sx-hud-top{display:flex;align-items:center;gap:6px;white-space:nowrap}
.sx-hud-sub{font:500 10px/1.25 var(--sx-font);color:var(--sx-mu);white-space:nowrap}
.sx-hud-timer{display:inline-flex;align-items:center;gap:3px;padding:1.5px 6px;border-radius:6px;background:rgba(52,199,89,0.14);color:#1d7a32;font:700 10.5px/1.2 var(--sx-font)}
.sx-hud-timer.warn{background:rgba(255,149,0,0.16);color:#c96e00}
.sx-hud-timer.crit{background:rgba(255,59,48,0.16);color:#d70015;animation:sxrec 1s infinite}
#sx-hud-charts{display:none;gap:6px;margin-top:2px;padding-top:5px;border-top:1px solid var(--sx-line)}
#sx-hud-charts.on{display:flex}
.sx-gbox{display:flex;flex-direction:column;gap:2px;width:78px}
.sx-glbl{display:flex;justify-content:space-between;align-items:baseline;font:600 9.5px/1 var(--sx-font);color:var(--sx-mu)}
.sx-glbl b{font:700 10.5px/1 var(--sx-font);color:var(--sx-tx)}
.sx-gcv{width:78px;height:28px;border-radius:5px;background:rgba(118,118,128,0.08);display:block}

#sx-xhair{position:absolute;z-index:1;display:none;transform:translate(-50%,-50%);pointer-events:none}

#sx-edit{position:absolute;inset:0;z-index:1;display:none;background:rgba(240,242,248,0.28);pointer-events:auto;touch-action:none}
#sx-edit.on{display:block}
#sx-rec{position:absolute;inset:0;z-index:5;display:none;border:2.5px solid var(--sx-red);pointer-events:none}
#sx-rec.on{display:block}
#sx-rec.prep{border-color:var(--sx-bl)}
#sx-rec-bar{position:absolute;top:max(10px,env(safe-area-inset-top));left:50%;transform:translateX(-50%) scale(var(--sx-ui-scale,1));transform-origin:top center;display:flex;align-items:center;gap:10px;height:40px;padding:0 12px 0 14px;border-radius:20px;background:rgba(255,255,255,0.95);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,59,48,0.35);box-shadow:0 8px 24px rgba(0,0,0,0.18);pointer-events:auto;color:var(--sx-tx)}
.sx-rec-dot{width:8px;height:8px;border-radius:50%;background:var(--sx-red);animation:sxrec 1.1s ease-in-out infinite}
@keyframes sxrec{0%,100%{opacity:1}50%{opacity:0.25}}
.sx-rec-time{font:600 13px/1 var(--sx-font);font-variant-numeric:tabular-nums;color:var(--sx-tx);min-width:44px}
.sx-rec-cnt{font:500 11.5px/1 var(--sx-font);color:var(--sx-mu);padding-right:4px}
#sx-cd{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(var(--sx-ui-scale,1));display:none;flex-direction:column;align-items:center;justify-content:center;gap:6px;width:128px;height:128px;border-radius:28px;background:rgba(255,255,255,0.96);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid var(--sx-line2);box-shadow:0 16px 40px rgba(0,0,0,0.22);pointer-events:none}
#sx-cd.on{display:flex}
#sx-cd b{font:700 48px/1 var(--sx-font);color:var(--sx-bl);font-variant-numeric:tabular-nums}
#sx-cd span{font:500 12px/1.2 var(--sx-font);color:var(--sx-mu)}

#sx-m{position:absolute;inset:0;z-index:2;pointer-events:none}
.sx-lines{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.sx-lines line,.sx-lines polyline,.sx-lines circle{stroke:var(--sx-bl);stroke-width:2.2;stroke-dasharray:5 4;fill:none;vector-effect:non-scaling-stroke}

#sx-bar{position:absolute;z-index:3;top:max(8px,env(safe-area-inset-top));left:50%;transform:translateX(-50%) scale(var(--sx-ui-scale,1));transform-origin:top center;display:none;gap:3px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:calc((100% - 16px) / var(--sx-ui-scale,1));padding:5px 7px;border-radius:16px;background:rgba(255,255,255,0.95);backdrop-filter:saturate(180%) blur(18px);-webkit-backdrop-filter:saturate(180%) blur(18px);border:1px solid var(--sx-line2);box-shadow:0 10px 28px rgba(0,0,0,0.18);pointer-events:auto}
#sx-bar.on{display:flex}
#sx-bar .sx-sel{height:30px;padding-top:0;padding-bottom:0;margin-right:2px}
.sx-tb{display:flex;align-items:center;gap:4px;height:30px;padding:0 8px;border:0;border-radius:9px;background:transparent;color:var(--sx-tx);font:500 11.5px var(--sx-font)}
.sx-tb:active{background:var(--sx-s2)}
.sx-tb.pri{background:var(--sx-bl);color:#ffffff;font-weight:600}
#sx-stop{position:absolute;z-index:3;top:max(8px,env(safe-area-inset-top));left:50%;transform:translateX(-50%) scale(var(--sx-ui-scale,1));transform-origin:top center;display:none;align-items:center;gap:8px;height:36px;padding:0 15px;border:0;border-radius:18px;background:var(--sx-red);color:#fff;font:600 12.5px var(--sx-font);box-shadow:0 6px 20px rgba(255,59,48,0.35);pointer-events:auto}
#sx-stop.on{display:flex}

/* Complete Native iOS 18 Sheet Panel with Inverse Viewport Scale Compensation (Never Clips at 150%/200%!) */
#sx-panel{position:absolute;z-index:4;top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));height:calc((100% - max(16px, env(safe-area-inset-top) + env(safe-area-inset-bottom))) / var(--sx-ui-scale,1));width:min(426px,calc((100% - 16px) / var(--sx-ui-scale,1)));transform:scale(var(--sx-ui-scale,1));transform-origin:top right;display:none;flex-direction:column;background:var(--sx-bg);backdrop-filter:saturate(180%) blur(26px);-webkit-backdrop-filter:saturate(180%) blur(26px);border:1px solid rgba(255,255,255,0.8);border-radius:22px;box-shadow:0 20px 55px rgba(0,0,0,0.22),0 0 0 0.5px rgba(0,0,0,0.1);overflow:hidden;pointer-events:auto;transition:opacity .15s;color:var(--sx-tx)}
#sx-panel.open{display:flex}
#sx-panel.peek{opacity:.14}
.sx-ph{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:11px 12px 8px 15px;background:rgba(255,255,255,0.78);border-bottom:0.5px solid var(--sx-line)}
.sx-pt-wrap{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}
.sx-pt{font-size:15px;font-weight:700;letter-spacing:-0.02em;color:var(--sx-tx);white-space:nowrap}
.sx-pv{padding:2px 6px;border-radius:6px;background:rgba(0,122,255,0.12);color:var(--sx-bl);font-size:10.5px;font-weight:700}
.sx-pscale{display:inline-flex;align-items:center;gap:3px;padding:3px 7px;border-radius:8px;background:rgba(88,86,214,0.13);color:var(--sx-in);font:700 10.5px/1 var(--sx-font);border:0;cursor:pointer}
.sx-pscale:active{background:rgba(88,86,214,0.24)}
.sx-ptimer{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:8px;background:rgba(52,199,89,0.14);color:#1d7a32;font:600 11px/1 var(--sx-font);font-variant-numeric:tabular-nums;border:0;cursor:pointer}
.sx-ptimer.warn{background:rgba(255,149,0,0.16);color:#c96e00}
.sx-ptimer.crit{background:rgba(255,59,48,0.16);color:#d70015}
.sx-ib{width:30px;height:30px;display:grid;place-items:center;flex:none;border:0;border-radius:15px;background:rgba(118,118,128,0.12);color:var(--sx-mu);padding:0;cursor:pointer}
.sx-ib:active{background:var(--sx-s3);color:var(--sx-tx)}
.sx-ib.danger:active{color:var(--sx-red)}

/* Segmented Pill Scroll Tabs */
.sx-tabs{display:flex;gap:4px;overflow-x:auto;padding:7px 12px;border-bottom:0.5px solid var(--sx-line);background:rgba(255,255,255,0.6);scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-behavior:auto}
.sx-tabs::-webkit-scrollbar{display:none}
.sx-tab{flex:0 0 auto;position:relative;border:0;border-radius:9px;background:transparent;color:var(--sx-mu);padding:6px 11px;font:600 12px var(--sx-font);white-space:nowrap;transition:all .14s;cursor:pointer}
.sx-tab.on{background:#ffffff;color:var(--sx-bl);box-shadow:0 2px 6px rgba(0,0,0,0.08),0 0 0 0.5px rgba(0,0,0,0.06)}

.sx-pb{overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;overscroll-behavior:contain;padding:8px 0 18px;scrollbar-width:thin;scrollbar-color:var(--sx-s3) transparent}
.sx-pb::-webkit-scrollbar{width:4px}
.sx-pb::-webkit-scrollbar-track{background:transparent}
.sx-pb::-webkit-scrollbar-thumb{background:var(--sx-s3);border-radius:2px}

/* Quick Filter Preset Chips Gallery */
.sx-fchips{display:flex;gap:6px;overflow-x:auto;margin:2px 12px 8px;padding:4px 2px 6px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.sx-fchips::-webkit-scrollbar{display:none}
.sx-fchip{flex:0 0 auto;padding:6px 11px;border-radius:10px;border:1px solid var(--sx-line);background:var(--sx-s1);color:var(--sx-tx);font:600 11.5px/1.2 var(--sx-font);white-space:nowrap;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.04)}
.sx-fchip.on{background:var(--sx-bl);color:#ffffff;border-color:transparent;box-shadow:0 3px 10px rgba(0,122,255,0.3)}

/* Native iOS Grouped Inset Rows */
.sx-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 12px;margin:0 12px;padding:11px 14px;background:var(--sx-s1);border-bottom:0.5px solid var(--sx-line)}
.sx-pb>.sx-row:first-of-type{border-top-left-radius:13px;border-top-right-radius:13px}
.sx-pb>.sx-row:last-of-type{border-bottom-left-radius:13px;border-bottom-right-radius:13px;border-bottom:0}
.sx-rl{flex:1 1 145px;min-width:0}
.sx-rt{font-size:13.5px;font-weight:500;letter-spacing:-0.01em;color:var(--sx-tx)}
.sx-rd{color:var(--sx-mu);font-size:11.5px;line-height:1.38;margin-top:2px}
.sx-rc{flex:0 0 auto;display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:flex-end}
.sx-row.rng .sx-rc{flex:1 1 100%;margin-top:3px}

.sx-step,.sx-tcard{margin:8px 12px 0;padding:11px 13px;border:0.5px solid var(--sx-line2);border-radius:14px;background:var(--sx-s1);box-shadow:0 2px 8px rgba(0,0,0,0.04)}
.sx-sh{display:flex;align-items:center;gap:4px;margin-bottom:8px}
.sx-sn{flex:1;display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:var(--sx-tx);min-width:0}
.sx-sn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sx-sn svg{color:var(--sx-bl)}
.sx-sg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.sx-nf{display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--sx-mu);min-width:0}
.sx-nf input,.sx-nf select{width:100%;min-width:0;-webkit-appearance:none;appearance:none;background:var(--sx-s2);border:1px solid var(--sx-line);border-radius:8px;color:var(--sx-tx);padding:6px 8px;font:500 12.5px var(--sx-font);-webkit-user-select:text;user-select:text}
.sx-nf input:focus,.sx-nf select:focus{outline:none;border-color:var(--sx-bl);background:#fff}
.sx-tmeta{color:var(--sx-mu);font-size:11.5px;margin-bottom:8px;font-variant-numeric:tabular-nums}
.sx-tacts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.sx-badge{display:inline-block;padding:1px 6px;margin-left:6px;border-radius:5px;background:rgba(0,122,255,0.12);color:var(--sx-bl);font:600 10px/1.4 var(--sx-font);flex:none}
.sx-badge.rec{background:rgba(52,199,89,0.15);color:var(--sx-nv)}

/* Frosted Glass Floating Macro Buttons, Screenshot & Quick Ball (Supports Global Button Scale!) */
.sx-mbtn,.sx-shot,#sx-qball{position:absolute;transform:translate(-50%,-50%) scale(calc(var(--sz,1) * var(--sx-btn-scale,1)));width:46px;height:46px;padding:0;border-radius:15px;border:1px solid rgba(255,255,255,0.75);background:rgba(255,255,255,0.88);backdrop-filter:saturate(180%) blur(14px);-webkit-backdrop-filter:saturate(180%) blur(14px);color:#1c1c1e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;pointer-events:auto;touch-action:none;opacity:var(--op,0.94);font:600 9.5px/1 var(--sx-font);box-shadow:0 4px 14px rgba(0,0,0,0.16),0 0 0 0.5px rgba(0,0,0,0.1);cursor:pointer}
.sx-mbtn.is-rec{border-color:rgba(0,122,255,0.45);color:#0055b3}
.sx-mbtn span{max-width:42px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sx-mbtn.run{background:var(--sx-bl);color:#ffffff;border-color:rgba(255,255,255,0.4);box-shadow:0 4px 18px rgba(0,122,255,0.48)}
.sx-mbtn.off{border-style:dashed;opacity:.55}
.sx-mbtn.edit-ring,.sx-shot.edit-ring{outline:2px dashed var(--sx-bl);outline-offset:2px}
.sx-shot{display:none}
#sx-qball{display:none;width:38px;height:38px;border-radius:19px;border:1.5px solid rgba(0,122,255,0.38);color:var(--sx-bl)}
#sx-qball.eco-on{border-color:rgba(52,199,89,0.55);color:var(--sx-nv)}

.sx-mk{position:absolute;width:32px;height:32px;border-radius:50%;transform:translate(-50%,-50%) scale(var(--sx-btn-scale,1));background:var(--sx-bl);color:#fff;font:600 12.5px var(--sx-font);display:flex;align-items:center;justify-content:center;border:2px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.25);touch-action:none;pointer-events:auto}
.sx-mk.end{width:26px;height:26px;background:#ffffff;color:var(--sx-bl);border:2px solid var(--sx-bl)}
.sx-zn{position:absolute;border:1.5px dashed var(--sx-bl);background:rgba(0,122,255,0.14);border-radius:10px;touch-action:none;pointer-events:auto}
.sx-zn b{position:absolute;left:8px;top:6px;font-size:11px;font-weight:600;color:#004085;background:rgba(255,255,255,0.88);padding:1px 5px;border-radius:4px}
.sx-zh{position:absolute;right:-1px;bottom:-1px;width:26px;height:26px;border-radius:8px 0 8px 0;background:var(--sx-bl);touch-action:none}
.sx-dot{position:absolute;width:7px;height:7px;border-radius:50%;background:var(--sx-bl);transform:translate(-50%,-50%);pointer-events:none}
.sx-rip{position:absolute;width:32px;height:32px;margin:-16px 0 0 -16px;border-radius:50%;border:2px solid var(--sx-bl);background:rgba(255,255,255,0.25);pointer-events:none;animation:sxr .38s ease-out forwards}
@keyframes sxr{from{transform:scale(.4);opacity:.95}to{transform:scale(1.35);opacity:0}}
#sx-flash{position:absolute;z-index:7;inset:0;background:#fff;opacity:0;pointer-events:none}
#sx-flash.go{animation:sxf .22s ease-out}
@keyframes sxf{from{opacity:.75}to{opacity:0}}
#sx-toast{position:absolute;z-index:8;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%) scale(var(--sx-ui-scale,1));transform-origin:bottom center;max-width:calc(84% / var(--sx-ui-scale,1));padding:9px 16px;border-radius:14px;background:rgba(255,255,255,0.96);border:1px solid var(--sx-line2);color:var(--sx-tx);font-size:12.5px;font-weight:600;opacity:0;transition:opacity .18s;pointer-events:none;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,0.18)}
#sx-toast.on{opacity:1}
#sx-preview{position:absolute;z-index:6;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:14px;background:rgba(242,242,247,0.96);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);color:var(--sx-tx);pointer-events:auto}
#sx-preview.on{display:flex}
#sx-preview img{max-width:100%;max-height:calc(100% - 115px);object-fit:contain;border-radius:12px;border:1px solid var(--sx-line2);box-shadow:0 10px 30px rgba(0,0,0,0.15);-webkit-user-select:auto;user-select:auto;-webkit-touch-callout:default}
.sx-prev-bar{display:flex;gap:8px;align-items:center;transform:scale(var(--sx-ui-scale,1));transform-origin:bottom center}

/* Authentic iOS UISwitch & Controls */
.sx-sw{width:46px;height:28px;border-radius:14px;border:0;background:#e5e5ea;position:relative;transition:background .18s cubic-bezier(.4,0,.2,1);flex:none;padding:0;cursor:pointer}
.sx-sw::after{content:"";position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,0.22),0 0 0 0.5px rgba(0,0,0,0.04);transition:transform .18s cubic-bezier(.4,0,.2,1)}
.sx-sw[aria-checked=true]{background:var(--sx-gn)}
.sx-sw[aria-checked=true]::after{transform:translateX(18px)}

.sx-sel{-webkit-appearance:none;appearance:none;background:var(--sx-s2) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23007aff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 9px center/13px;color:var(--sx-tx);border:1px solid var(--sx-line);border-radius:9px;padding:6px 28px 6px 10px;font:500 12.5px var(--sx-font);max-width:52vw}
.sx-rw{display:flex;align-items:center;gap:10px;width:100%}
.sx-rw input{-webkit-appearance:none;appearance:none;flex:1;min-width:90px;height:24px;margin:0;background:transparent}
.sx-rw input::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:linear-gradient(to right,var(--sx-bl) var(--p,0%),#e0e2e9 var(--p,0%))}
.sx-rw input::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;margin-top:-8px;border-radius:50%;background:#fff;border:0.5px solid rgba(0,0,0,0.08);box-shadow:0 2px 6px rgba(0,0,0,0.22)}
.sx-rv{min-width:54px;text-align:right;font-size:12px;font-weight:500;font-variant-numeric:tabular-nums;color:var(--sx-mu)}

.sx-btn{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 11px;border-radius:9px;border:1px solid transparent;background:var(--sx-bl);color:#ffffff;font:600 12px var(--sx-font);text-decoration:none;white-space:nowrap;cursor:pointer}
.sx-btn:active{opacity:.82}
.sx-btn.alt{background:var(--sx-s2);color:var(--sx-tx);border-color:var(--sx-line)}
.sx-btn.blue{background:var(--sx-bl);color:#fff;border-color:transparent}
.sx-btn.danger{background:rgba(255,59,48,0.10);color:var(--sx-red);border-color:rgba(255,59,48,0.25)}

.sx-ghead{grid-column:1/-1;padding:18px 24px 6px;font-size:14px;font-weight:600;color:#ededf0}
#sx-section .sx-sel,#sx-section .sx-btn.alt{background:#22252b;color:#ededf0;border-color:rgba(255,255,255,0.14)}
#sx-section .sx-rv{color:#9297a0}
.sx-trail{display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:min(46vw,260px)}
[data-sx-host]{position:relative}
#sx-gl{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:1}
@media (prefers-reduced-motion:reduce){#sx-root *{transition:none !important;animation:none !important}}
`;

  function mkSheet() {
    const st = document.createElement('style');
    st.dataset.sx = 'css';
    let sh = null;
    return {
      set(css) {
        st.textContent = css;
        if (!st.isConnected && (document.head || document.documentElement)) {
          (document.head || document.documentElement).append(st);
        }
        if (!st.sheet && 'adoptedStyleSheets' in document) {
          try {
            sh = sh || new CSSStyleSheet();
            sh.replaceSync(css);
            if (!document.adoptedStyleSheets.includes(sh)) document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh];
          } catch (_) {}
        }
      }
    };
  }
  const baseSheet = mkSheet();
  const dyn = mkSheet();

  function applyDyn() {
    if (root) {
      root.classList.toggle('eco', !!cfg.batterySaver);
      root.style.setProperty('--sx-ui-scale', cl(nv(cfg.uiScale, 1), 0.8, 2.5));
      root.style.setProperty('--sx-btn-scale', cl(nv(cfg.btnGlobalScale, 1), 0.7, 2.2));
    }
    const f = [];
    if (cfg.fxContrast !== 1) f.push('contrast(' + cfg.fxContrast + ')');
    if (cfg.fxSaturate !== 1) f.push('saturate(' + cfg.fxSaturate + ')');
    if (cfg.fxBrightness !== 1) f.push('brightness(' + cfg.fxBrightness + ')');
    if (cfg.fxHue) f.push('hue-rotate(' + cfg.fxHue + 'deg)');
    if (cfg.fxSepia > 0) f.push('sepia(' + cfg.fxSepia + ')');
    if (cfg.fxGray > 0) f.push('grayscale(' + cfg.fxGray + ')');
    let css = '';
    // Unlock GFN Native Settings & In-Stream Dropdown Menu Scrolling so settings are never cut off on iOS PWA!
    if (cfg.fixGfnScroll) {
      css += `
        nv-settings,.settings-container,.settings-content,.mat-drawer-content,.main-content{overflow-y:auto !important;-webkit-overflow-scrolling:touch !important;touch-action:pan-y !important}
        .streamer-osc-drop-down-panel,.mat-mdc-menu-panel{max-height:84dvh !important;overflow-y:auto !important;-webkit-overflow-scrolling:touch !important;touch-action:pan-y !important}
      `;
    }
    if (streaming()) {
      css += '#remote-video,[data-sx-host],.streamer-container{touch-action:none !important;-webkit-touch-callout:none !important;-webkit-user-select:none !important;user-select:none !important;-webkit-user-drag:none !important;overscroll-behavior:none !important}';
    }
    const tr = ((cfg.viewX || cfg.viewY) ? 'translate:' + cfg.viewX + '% ' + cfg.viewY + '%;' : '') + (cfg.viewZoom !== 1 ? 'scale:' + cfg.viewZoom + ';' : '');
    if (tr) css += '#remote-video,#sx-gl{' + tr + '}';
    if (GL.on) css += '#remote-video{opacity:0 !important}';
    if (f.length) css += (GL.on ? '#sx-gl' : '#remote-video') + '{filter:' + f.join(' ') + ' !important}';
    dyn.set(css);
    updateFxOverlay();
    updateCrosshair();
  }

  function updateFxOverlay() {
    if (!fxEl) return;
    const layers = [];
    if (cfg.oledDim > 0) {
      const a = cl(cfg.oledDim, 0, 0.75).toFixed(2);
      layers.push('linear-gradient(rgba(0,0,0,' + a + '),rgba(0,0,0,' + a + '))');
    }
    const rgb = TINTS[cfg.fxTint];
    if (rgb && cfg.fxTintA > 0) {
      const c = 'rgba(' + rgb.join(',') + ',' + cfg.fxTintA + ')';
      layers.push('linear-gradient(' + c + ',' + c + ')');
    }
    if (cfg.fxVig > 0) {
      layers.push('radial-gradient(ellipse at center,rgba(0,0,0,0) ' + Math.round(72 - cfg.fxVig * 32) + '%,rgba(0,0,0,' + (cfg.fxVig * 0.9).toFixed(2) + ') 100%)');
    }
    fxEl.style.background = layers.join(',');
    fxEl.style.display = layers.length && streaming() ? 'block' : 'none';
  }

  function updateCrosshair() {
    if (!xhairEl) return;
    const show = cfg.crosshair !== 'off' && streaming();
    xhairEl.style.display = show ? 'block' : 'none';
    if (!show) return;
    xhairEl.style.left = cfg.crosshairX + '%';
    xhairEl.style.top = cfg.crosshairY + '%';
    const sz = cl(nv(cfg.crosshairSize, 14), 6, 36);
    const col = cfg.crosshairColor || '#007aff';
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 32 32');
    s.setAttribute('width', sz * 2);
    s.setAttribute('height', sz * 2);
    s.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.65))';
    let inner = '';
    if (cfg.crosshair === 'dot') {
      inner = '<circle cx="16" cy="16" r="3" fill="' + col + '"/>';
    } else if (cfg.crosshair === 'cross') {
      inner = '<path d="M16 6v7M16 19v7M6 16h7M19 16h7" stroke="' + col + '" stroke-width="2.2" stroke-linecap="round"/>';
    } else if (cfg.crosshair === 'circle') {
      inner = '<circle cx="16" cy="16" r="7" fill="none" stroke="' + col + '" stroke-width="1.8"/><circle cx="16" cy="16" r="2" fill="' + col + '"/>';
    } else if (cfg.crosshair === 'tcross') {
      inner = '<path d="M16 19v7M6 16h7M19 16h7" stroke="' + col + '" stroke-width="2.2" stroke-linecap="round"/><circle cx="16" cy="16" r="1.8" fill="' + col + '"/>';
    }
    s.innerHTML = inner;
    xhairEl.replaceChildren(s);
  }

  /* ================= sharpening (WebGL CAS, zero GPU stall + Battery Saver Eco Mode) ================= */
  const GL = { on: false, fail: false, c: null, gl: null, tex: null, u: {}, host: null, video: null, ro: null, vfc: 0, raf: 0, cw: 0, ch: 0, tr: '', skipFrame: false };
  const VS = 'attribute vec2 p;uniform vec2 f;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p*f,0.,1.);}';
  const FS = 'precision mediump float;varying vec2 v;uniform sampler2D t;uniform vec2 px;uniform float a;' +
    'void main(){' +
    'vec3 c=texture2D(t,v).rgb;' +
    'vec3 n=texture2D(t,v+vec2(0.,-px.y)).rgb;' +
    'vec3 s=texture2D(t,v+vec2(0.,px.y)).rgb;' +
    'vec3 w=texture2D(t,v+vec2(-px.x,0.)).rgb;' +
    'vec3 e=texture2D(t,v+vec2(px.x,0.)).rgb;' +
    'vec3 mn=min(min(min(n,s),min(w,e)),c);' +
    'vec3 mx=max(max(max(n,s),max(w,e)),c);' +
    'vec3 amp=sqrt(clamp(min(mn,1.-mx)/(mx+.0001),0.,1.));' +
    'float peak=-1./mix(8.,5.,a);' +
    'vec3 wg=amp*peak;' +
    'vec3 o=(wg*(n+s+w+e)+c)/(1.+4.*wg);' +
    'gl_FragColor=vec4(mix(c,o,clamp(a*1.6,0.,1.)),1.);}';

  function glInit() {
    const c = document.createElement('canvas');
    c.id = 'sx-gl';
    const gl = c.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: cfg.batterySaver ? 'low-power' : 'high-performance'
    });
    if (!gl) return false;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    GL.tex = tex;
    GL.u = {
      f: gl.getUniformLocation(prog, 'f'),
      px: gl.getUniformLocation(prog, 'px'),
      a: gl.getUniformLocation(prog, 'a'),
      t: gl.getUniformLocation(prog, 't')
    };
    gl.uniform1i(GL.u.t, 0);
    gl.clearColor(0, 0, 0, 1);
    c.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      glStop();
      GL.gl = null;
      GL.c = null;
      GL.tex = null;
    });
    GL.c = c;
    GL.gl = gl;
    return true;
  }
  function glMeasure() {
    if (!GL.host) return;
    const r = GL.host.getBoundingClientRect();
    GL.cw = r.width;
    GL.ch = r.height;
  }
  function glStart() {
    if (GL.on && GL.video === vid()) return;
    glStop();
    const v = vid();
    if (!v || !v.parentElement) return;
    try {
      if (!GL.gl && !glInit()) throw new Error('webgl unavailable');
    } catch (e) {
      console.warn('[GFN-X] sharpen', e);
      GL.fail = true;
      GL.gl = null;
      GL.c = null;
      GL.tex = null;
      toast('Sharpening is not available on this device');
      return;
    }
    GL.host = v.parentElement;
    GL.host.setAttribute('data-sx-host', '');
    GL.host.appendChild(GL.c);
    GL.video = v;
    GL.on = true;
    GL.tr = '';
    GL.ro = new ResizeObserver(glMeasure);
    GL.ro.observe(GL.host);
    glMeasure();
    applyDyn();
    glSchedule();
  }
  function glStop() {
    const was = GL.on;
    GL.on = false;
    if (GL.vfc && GL.video && GL.video.cancelVideoFrameCallback) {
      try { GL.video.cancelVideoFrameCallback(GL.vfc); } catch (_) {}
    }
    GL.vfc = 0;
    cancelAnimationFrame(GL.raf);
    if (GL.ro) { GL.ro.disconnect(); GL.ro = null; }
    if (GL.c && GL.c.parentNode) GL.c.remove();
    GL.video = null;
    if (was) applyDyn();
  }
  function glSchedule() {
    if (!GL.on || !GL.video) return;
    if (GL.video.requestVideoFrameCallback) GL.vfc = GL.video.requestVideoFrameCallback(glFrame);
    else GL.raf = requestAnimationFrame(glFrame);
  }
  function glFrame() {
    if (!GL.on) return;
    if (cfg.sharpenEco || cfg.batterySaver) {
      GL.skipFrame = !GL.skipFrame;
      if (GL.skipFrame) { glSchedule(); return; }
    }
    try {
      glDraw();
    } catch (e) {
      console.warn('[GFN-X] sharpen draw', e);
      GL.fail = true;
      glStop();
      toast('Sharpening turned off after a render error');
      return;
    }
    glSchedule();
  }
  function glDraw() {
    const v = GL.video, gl = GL.gl, c = GL.c;
    if (!v || !v.videoWidth || !GL.cw || !GL.ch || !GL.tex) return;
    const isEco = cfg.sharpenEco || cfg.batterySaver;
    let s = isEco ? Math.min(realDpr, 1.35) : realDpr;
    const maxPx = isEco ? 1500000 : 3000000;
    if (GL.cw * GL.ch * s * s > maxPx) s = Math.sqrt(maxPx / (GL.cw * GL.ch));
    const W = Math.max(2, Math.round(GL.cw * s)), H = Math.max(2, Math.round(GL.ch * s));
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
      gl.viewport(0, 0, W, H);
    }
    const va = v.videoWidth / v.videoHeight, ca = W / H;
    let fw = 1, fh = 1;
    if (va > ca) fh = ca / va; else fw = va / ca;
    gl.uniform2f(GL.u.f, fw, fh);
    gl.uniform2f(GL.u.px, 1 / (W * fw), 1 / (H * fh));
    gl.uniform1f(GL.u.a, cl(+cfg.sharpen || 0, 0, 1));
    const tr = v.style.transform;
    if (tr !== GL.tr) { c.style.transform = tr; GL.tr = tr; }
    gl.bindTexture(gl.TEXTURE_2D, GL.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function updateSharpen() {
    const want = cfg.sharpen > 0 && streaming() && !GL.fail;
    if (want) { if (!GL.on || GL.video !== vid()) glStart(); }
    else if (GL.on) glStop();
  }

  /* ================= 1-HOUR SESSION COUNTDOWN + 3-GRAPH TELEMETRY HUD ================= */
  let hud, hudPing, hudRest, hudSub, hudTimerEl, panelTimerEl, panelScaleBtn, hudChartsWrap;
  let cvFps, cvPing, cvLag, lblFpsVal, lblPingVal, lblLagVal;
  const histFps = [], histPing = [], histLag = [];
  const MAX_HIST = 36;
  let prevStat = null, lastSt = null, lastUserAct = Date.now(), lastAfkPulse = Date.now(), tickCount = 0;
  let sessionStartAt = 0, warned10 = false, warned5 = false, warned1 = false;
  let lastTouchDispMs = 1.8, curDecodeMs = 2.5, curInputLagMs = 12;

  function resetSessionTimer(notify) {
    sessionStartAt = Date.now();
    warned10 = false;
    warned5 = false;
    warned1 = false;
    updateSessionTimerUI();
    if (notify) toast('1-Hour Session Timer reset to ' + cfg.sessionLimitMin + ':00');
  }

  function fmtCountdown(remMs) {
    const totalSec = Math.max(0, Math.ceil(remMs / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function updateSessionTimerUI() {
    if (!sessionStartAt) sessionStartAt = Date.now();
    const limitMs = cl(nv(cfg.sessionLimitMin, 60), 15, 600) * 60000;
    const elapsed = Date.now() - sessionStartAt;
    const remMs = Math.max(0, limitMs - elapsed);
    const remMin = remMs / 60000;
    const txt = '' + fmtCountdown(remMs);
    const cls = remMin <= 3 ? 'crit' : remMin <= 10 ? 'warn' : '';

    if (hudTimerEl) {
      hudTimerEl.style.display = cfg.sessionTimer ? 'inline-flex' : 'none';
      hudTimerEl.textContent = txt;
      hudTimerEl.className = 'sx-hud-timer' + (cls ? ' ' + cls : '');
    }
    if (panelTimerEl) {
      panelTimerEl.style.display = cfg.sessionTimer ? 'inline-flex' : 'none';
      panelTimerEl.textContent = txt;
      panelTimerEl.className = 'sx-ptimer' + (cls ? ' ' + cls : '');
    }

    if (streaming() && cfg.sessionTimer) {
      if (remMin <= 10 && remMin > 9.5 && !warned10) {
        warned10 = true;
        toast('Còn 10 phút phiên chơi (' + cfg.sessionLimitMin + 'm) — Chuẩn bị lưu game!', 4000);
      } else if (remMin <= 5 && remMin > 4.5 && !warned5) {
        warned5 = true;
        toast('Cảnh báo: Còn 5 phút phiên chơi! Hãy tới điểm dịch chuyển / lưu game.', 4500);
      } else if (remMin <= 1 && remMin > 0.2 && !warned1) {
        warned1 = true;
        toast('Khẩn cấp: Còn dưới 1 phút phiên chơi! Sắp hết giờ session!', 5500);
      }
    }
  }

  function drawMiniGraph(cv, arr, color, minV, maxV) {
    if (!cv || !arr.length) return;
    const dpr = Math.min(realDpr, 2);
    const W = 78 * dpr, H = 28 * dpr;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    let hi = maxV;
    for (let i = 0; i < arr.length; i++) if (arr[i] > hi) hi = arr[i] * 1.1;
    const span = Math.max(1, hi - minV);

    ctx.beginPath();
    const stepX = W / Math.max(1, MAX_HIST - 1);
    const startIdx = Math.max(0, MAX_HIST - arr.length);
    for (let i = 0; i < arr.length; i++) {
      const x = (startIdx + i) * stepX;
      const norm = cl((arr[i] - minV) / span, 0, 1);
      const y = H - 3 * dpr - norm * (H - 6 * dpr);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6 * dpr;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    const lastX = (startIdx + arr.length - 1) * stepX;
    const firstX = startIdx * stepX;
    ctx.lineTo(lastX, H);
    ctx.lineTo(firstX, H);
    ctx.closePath();
    ctx.fillStyle = color + '24';
    ctx.fill();
  }

  async function tick() {
    tickCount++;
    const st = streaming();
    if (st !== lastSt) {
      lastSt = st;
      prevStat = null;
      if (st) resetSessionTimer(false);
      updateSharpen();
      applyDyn();
      if (root) updateOverlay();
    }
    if (GL.on && GL.c && !GL.c.isConnected) { glStop(); updateSharpen(); }

    updateSessionTimerUI();

    const now = Date.now();
    if (cfg.inputGuard && runners.size === 0 && (activeMacroPointers.size > 0 || activeMacroTouches.size > 0)) {
      unstickStreamInput(true);
    }

    if (st && cfg.afkGuard && !runners.size && !recState.on && now - lastUserAct > 210000 && now - lastAfkPulse > 180000) {
      lastAfkPulse = now;
      guard(() => {
        const pid = nextPid();
        const x = Math.round(window.innerWidth * 0.5 + randRange(-8, 8));
        const y = Math.round(window.innerHeight * 0.5 + randRange(-8, 8));
        inject('down', x, y, pid);
        setTimeout(() => inject('up', x, y, pid), 16);
      }, 'afkGuard');
    }

    if (!root) return;
    const show = cfg.hudOn && st;
    hud.style.display = show ? 'flex' : 'none';
    if (!show) { prevStat = null; return; }
    if (!cfg.hudCustomPos) {
      hud.style.left = '';
      hud.style.top = '';
      hud.style.right = '';
      hud.style.bottom = '';
      hud.dataset.pos = cfg.hudPos;
    } else {
      hud.removeAttribute('data-pos');
      hud.style.left = cfg.hudCustomPos.x + '%';
      hud.style.top = cfg.hudCustomPos.y + '%';
    }
    hud.style.opacity = cfg.hudOpacity;
    if (cfg.batterySaver && (tickCount % 2 !== 0)) return;
    if (!pcs.size) return;
    const reps = await Promise.all([...pcs].map(p => p.getStats().catch(() => null)));
    let vin = null, pair = null;
    for (const rep of reps) {
      if (!rep) continue;
      let rv = null, rp = null, tr = null;
      rep.forEach(r => {
        if (r.type === 'inbound-rtp' && (r.kind || r.mediaType) === 'video') rv = r;
        else if (r.type === 'candidate-pair' && r.state === 'succeeded' && (r.nominated || r.selected) && typeof r.currentRoundTripTime === 'number') rp = r;
        else if (r.type === 'transport') tr = r;
      });
      if (!rp && tr && tr.selectedCandidatePairId) rp = rep.get(tr.selectedCandidatePairId) || null;
      if (rv) { vin = rv; pair = rp; break; }
    }
    if (!vin) return;
    const cur = {
      t: vin.timestamp,
      bytes: vin.bytesReceived || 0,
      frames: vin.framesDecoded || 0,
      lost: Math.max(0, vin.packetsLost || 0),
      recv: vin.packetsReceived || 0,
      drop: vin.framesDropped || 0,
      dec: vin.totalDecodeTime || 0
    };
    let mbps = 0, fps = 0, loss = 0, dec = 0;
    if (prevStat && cur.t > prevStat.t) {
      const dt = (cur.t - prevStat.t) / 1000;
      mbps = (cur.bytes - prevStat.bytes) * 8 / dt / 1e6;
      const df = cur.frames - prevStat.frames;
      fps = df / dt;
      const dl = cur.lost - prevStat.lost, dr = cur.recv - prevStat.recv;
      loss = dl + dr > 0 ? dl / (dl + dr) * 100 : 0;
      dec = df > 0 ? (cur.dec - prevStat.dec) / df * 1000 : 0;
    }
    prevStat = cur;
    curDecodeMs = dec;
    const rtt = pair && typeof pair.currentRoundTripTime === 'number' ? pair.currentRoundTripTime * 1000 : null;
    const jitMs = Math.round((vin.jitter || 0) * 1000);
    const frameIntervalMs = fps > 5 ? (1000 / fps) * 0.5 : 8.3;
    const totalInputLatency = Math.round(lastTouchDispMs + dec + frameIntervalMs + (rtt != null ? rtt * 0.5 : 10));
    curInputLagMs = totalInputLatency;

    const rttVal = rtt == null ? 0 : Math.round(rtt);
    const fpsVal = Math.round(fps);
    histFps.push(fpsVal); if (histFps.length > MAX_HIST) histFps.shift();
    histPing.push(rttVal); if (histPing.length > MAX_HIST) histPing.shift();
    histLag.push(totalInputLatency); if (histLag.length > MAX_HIST) histLag.shift();

    hudPing.textContent = (rtt == null ? '--' : rttVal) + 'ms';
    hudPing.style.color = rtt == null ? '#6c6c70' : rttVal < 45 ? '#248a3d' : rttVal < 85 ? '#d97706' : '#ff3b30';
    hudRest.nodeValue = ' · ' + fpsVal + ' fps · ' + mbps.toFixed(1) + ' Mbps · Lag ' + totalInputLatency + 'ms' + (cfg.batterySaver ? ' · ECO' : '');

    const showSub = cfg.hudDetail === 'full' || cfg.hudDetail === 'graphs';
    if (hudSub) {
      hudSub.style.display = showSub ? 'block' : 'none';
      if (showSub) {
        hudSub.textContent = (vin.frameWidth || 0) + '×' + (vin.frameHeight || 0) + ' · loss ' + loss.toFixed(1) + '% · jit ' + jitMs + 'ms · dec ' + dec.toFixed(1) + 'ms · touch ' + lastTouchDispMs.toFixed(1) + 'ms';
      }
    }

    const showGraphs = cfg.hudDetail === 'graphs';
    if (hudChartsWrap) {
      hudChartsWrap.classList.toggle('on', showGraphs);
      if (showGraphs) {
        if (lblFpsVal) lblFpsVal.textContent = fpsVal + '';
        if (lblPingVal) lblPingVal.textContent = (rtt == null ? '--' : rttVal) + 'ms';
        if (lblLagVal) lblLagVal.textContent = totalInputLatency + 'ms';
        drawMiniGraph(cvFps, histFps, '#34c759', 0, 65);
        drawMiniGraph(cvPing, histPing, rttVal > 80 ? '#ff9500' : '#007aff', 0, 100);
        drawMiniGraph(cvLag, histLag, '#5856d6', 0, 90);
      }
    }
  }

  /* ================= ULTRA-CRISP 2K HD SCREENSHOT + 9-TAP UNSHARP & FILTER BAKER ================= */
  function flash() { flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go'); }

  // CPU Fallback for Unsharp + Color Filter Baking (if WebGL is ever blocked)
  function applyCpuSharpenAndFilters(ctx, W, H, sharpBoost, applyFx) {
    guard(() => {
      const imgData = ctx.getImageData(0, 0, W, H);
      const d = imgData.data;
      const src = new Uint8ClampedArray(d);
      const con = applyFx ? cfg.fxContrast : 1;
      const sat = applyFx ? cfg.fxSaturate : 1;
      const bri = applyFx ? cfg.fxBrightness : 1;
      const sep = applyFx ? cfg.fxSepia : 0;
      const gray = applyFx ? cfg.fxGray : 0;
      const tintRgb = (applyFx && TINTS[cfg.fxTint]) ? TINTS[cfg.fxTint] : null;
      const tintA = tintRgb ? cfg.fxTintA : 0;
      const k = sharpBoost * 0.65;
      const row = W * 4;

      for (let y = 1; y < H - 1; y++) {
        const yOff = y * row;
        for (let x = 1; x < W - 1; x++) {
          const i = yOff + x * 4;
          for (let ch = 0; ch < 3; ch++) {
            const c = src[i + ch];
            let val = c;
            if (k > 0.02) {
              const avg = (src[i - row + ch] + src[i + row + ch] + src[i - 4 + ch] + src[i + 4 + ch]) * 0.25;
              const diff = cl(c - avg, -48, 48);
              val = c + diff * k * 1.6;
            }
            val = val * bri;
            val = (val - 128) * con + 128;
            d[i + ch] = cl(val, 0, 255);
          }
          if (sat !== 1 || sep > 0 || gray > 0 || tintA > 0) {
            let r = d[i], g = d[i + 1], b = d[i + 2];
            const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            r = luma + (r - luma) * sat;
            g = luma + (g - luma) * sat;
            b = luma + (b - luma) * sat;
            if (sep > 0) {
              const sr = r * 0.393 + g * 0.769 + b * 0.189;
              const sg = r * 0.349 + g * 0.686 + b * 0.168;
              const sb = r * 0.272 + g * 0.534 + b * 0.131;
              r = r + (sr - r) * sep;
              g = g + (sg - g) * sep;
              b = b + (sb - b) * sep;
            }
            if (gray > 0) {
              const gl2 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
              r = r + (gl2 - r) * gray;
              g = g + (gl2 - g) * gray;
              b = b + (gl2 - b) * gray;
            }
            if (tintA > 0) {
              r = r + (tintRgb[0] - r) * tintA;
              g = g + (tintRgb[1] - g) * tintA;
              b = b + (tintRgb[2] - b) * tintA;
            }
            d[i] = cl(r, 0, 255);
            d[i + 1] = cl(g, 0, 255);
            d[i + 2] = cl(b, 0, 255);
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }, 'cpuShotFallback');
  }

  // Stage 1: Capture exact 1:1 hardware video frame onto a 2D Staging Canvas (bypasses iOS WebKit MediaStream WebGL bug!)
  // Stage 2: Run WebGL 2.0x Super-Resolution + 9-Tap Dual-Radius Unsharp Mask & Local Clarity + Full Color Filter Shader!
  function renderHDScreenshotCanvas(v) {
    const vw = v.videoWidth, vh = v.videoHeight;
    const stageCv = document.createElement('canvas');
    stageCv.width = vw;
    stageCv.height = vh;
    const sCtx = stageCv.getContext('2d');
    sCtx.imageSmoothingEnabled = false;
    sCtx.drawImage(v, 0, 0, vw, vh);

    const scale = cl(parseFloat(cfg.shotScale) || 2, 1, 2.25);
    const maxW = 2560;
    const actualScale = (vw * scale > maxW) ? (maxW / vw) : scale;
    const W = Math.round(vw * actualScale);
    const H = Math.round(vh * actualScale);

    const outCv = document.createElement('canvas');
    outCv.width = W;
    outCv.height = H;

    const applyFx = !!cfg.shotApplyFx;
    const userSharpBoost = cl(nv(cfg.shotSharpness, 1.45), 0, 2.5);
    const sharpAmt = cfg.shotSharpen ? Math.max(userSharpBoost, (+cfg.sharpen || 0) * 1.6) : (applyFx ? (+cfg.sharpen || 0) * 1.4 : 0);

    const renderedByWebGL = guard(() => {
      const glCv = document.createElement('canvas');
      glCv.width = W;
      glCv.height = H;
      const gl = glCv.getContext('webgl', { alpha: false, antialias: true, preserveDrawingBuffer: true });
      if (!gl) return false;

      const vsSrc = 'attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
      // 9-Tap Dual-Radius Unsharp Mask + Local Micro-Contrast (Clarity) + Full Color Grading Shader
      const fsSrc = `
        precision highp float;
        varying vec2 v;
        uniform sampler2D t;
        uniform vec2 px;
        uniform float uSharp, uCon, uSat, uBri, uHue, uSep, uGray, uVig, uTintA;
        uniform vec3 uTint;

        vec3 hueRotate(vec3 c, float deg) {
          float a = deg * 0.0174532925;
          float cosA = cos(a), sinA = sin(a);
          mat3 m = mat3(
            0.213 + cosA*0.787 - sinA*0.213, 0.213 - cosA*0.213 + sinA*0.143, 0.213 - cosA*0.213 - sinA*0.787,
            0.715 - cosA*0.715 - sinA*0.715, 0.715 + cosA*0.285 + sinA*0.140, 0.715 - cosA*0.715 + sinA*0.715,
            0.072 - cosA*0.072 + sinA*0.928, 0.072 - cosA*0.072 - sinA*0.283, 0.072 + cosA*0.928 + sinA*0.072
          );
          return clamp(m * c, 0.0, 1.0);
        }

        void main() {
          vec3 c = texture2D(t, v).rgb;
          if (uSharp > 0.01) {
            // Fine 8-neighbor ring (radius 0.85 source texel) for razor-sharp edge reconstruction
            vec2 r1 = px * 0.85;
            vec3 n  = texture2D(t, v + vec2(0.0, -r1.y)).rgb;
            vec3 s  = texture2D(t, v + vec2(0.0,  r1.y)).rgb;
            vec3 w  = texture2D(t, v + vec2(-r1.x, 0.0)).rgb;
            vec3 e  = texture2D(t, v + vec2( r1.x, 0.0)).rgb;
            vec3 nw = texture2D(t, v + vec2(-r1.x, -r1.y)).rgb;
            vec3 ne = texture2D(t, v + vec2( r1.x, -r1.y)).rgb;
            vec3 sw = texture2D(t, v + vec2(-r1.x,  r1.y)).rgb;
            vec3 se = texture2D(t, v + vec2( r1.x,  r1.y)).rgb;

            vec3 blurFine = (n + s + e + w) * 0.15 + (nw + ne + sw + se) * 0.10;
            vec3 detailFine = clamp(c - blurFine, -0.22, 0.22);

            // Medium 4-neighbor ring (radius 1.85 source texel) for de-hazing H.264 stream compression blur
            vec2 r2 = px * 1.85;
            vec3 n2 = texture2D(t, v + vec2(0.0, -r2.y)).rgb;
            vec3 s2 = texture2D(t, v + vec2(0.0,  r2.y)).rgb;
            vec3 w2 = texture2D(t, v + vec2(-r2.x, 0.0)).rgb;
            vec3 e2 = texture2D(t, v + vec2( r2.x, 0.0)).rgb;
            vec3 blurMed = (n2 + s2 + w2 + e2) * 0.25;
            vec3 detailMed = clamp(c - blurMed, -0.16, 0.16);

            // CAS local contrast protection weight
            vec3 mn = min(min(min(n, s), min(w, e)), c);
            vec3 mx = max(max(max(n, s), max(w, e)), c);
            vec3 casGuard = sqrt(clamp(min(mn, 1.0 - mx) / (mx + 0.001), 0.25, 1.0));

            c = clamp(c + (detailFine * 1.65 + detailMed * 0.55) * uSharp * casGuard, 0.0, 1.0);
          }
          // Brightness & Contrast
          c = c * uBri;
          c = (c - 0.5) * uCon + 0.5;
          // Saturation
          float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(vec3(luma), c, uSat);
          // Hue
          if (abs(uHue) > 0.5) c = hueRotate(c, uHue);
          // Sepia
          if (uSep > 0.001) {
            vec3 sp = vec3(
              dot(c, vec3(0.393, 0.769, 0.189)),
              dot(c, vec3(0.349, 0.686, 0.168)),
              dot(c, vec3(0.272, 0.534, 0.131))
            );
            c = mix(c, sp, uSep);
          }
          // Grayscale
          if (uGray > 0.001) {
            float g = dot(c, vec3(0.2126, 0.7152, 0.0722));
            c = mix(c, vec3(g), uGray);
          }
          // Tint overlay
          if (uTintA > 0.001) {
            c = mix(c, uTint, uTintA);
          }
          // Vignette
          if (uVig > 0.001) {
            float dist = length((v - vec2(0.5)) * vec2(1.35, 1.35));
            float edge0 = 0.72 - uVig * 0.32;
            float vf = smoothstep(edge0, 1.0, dist) * (uVig * 0.9);
            c = c * (1.0 - vf);
          }
          gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
        }
      `;
      const mkSh = (tp, src) => {
        const s = gl.createShader(tp);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, mkSh(gl.VERTEX_SHADER, vsSrc));
      gl.attachShader(prog, mkSh(gl.FRAGMENT_SHADER, fsSrc));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // Upload from `stageCv` (2D Canvas) so WebKit NEVER fails on MediaStream texture upload!
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, stageCv);

      gl.viewport(0, 0, W, H);
      gl.uniform1i(gl.getUniformLocation(prog, 't'), 0);
      gl.uniform2f(gl.getUniformLocation(prog, 'px'), 1 / vw, 1 / vh);
      gl.uniform1f(gl.getUniformLocation(prog, 'uSharp'), sharpAmt);
      gl.uniform1f(gl.getUniformLocation(prog, 'uCon'), applyFx ? cfg.fxContrast : 1);
      gl.uniform1f(gl.getUniformLocation(prog, 'uSat'), applyFx ? cfg.fxSaturate : 1);
      gl.uniform1f(gl.getUniformLocation(prog, 'uBri'), applyFx ? cfg.fxBrightness : 1);
      gl.uniform1f(gl.getUniformLocation(prog, 'uHue'), applyFx ? cfg.fxHue : 0);
      gl.uniform1f(gl.getUniformLocation(prog, 'uSep'), applyFx ? cfg.fxSepia : 0);
      gl.uniform1f(gl.getUniformLocation(prog, 'uGray'), applyFx ? cfg.fxGray : 0);
      gl.uniform1f(gl.getUniformLocation(prog, 'uVig'), applyFx ? cfg.fxVig : 0);
      const tintRgb = applyFx && TINTS[cfg.fxTint] ? TINTS[cfg.fxTint] : null;
      gl.uniform1f(gl.getUniformLocation(prog, 'uTintA'), tintRgb ? cfg.fxTintA : 0);
      gl.uniform3f(gl.getUniformLocation(prog, 'uTint'), tintRgb ? tintRgb[0] / 255 : 0, tintRgb ? tintRgb[1] / 255 : 0, tintRgb ? tintRgb[2] / 255 : 0);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.finish();
      const ctx2d = outCv.getContext('2d');
      ctx2d.drawImage(glCv, 0, 0);
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      return true;
    }, 'webglShot');

    if (!renderedByWebGL) {
      const ctx = outCv.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(stageCv, 0, 0, W, H);
      applyCpuSharpenAndFilters(ctx, W, H, sharpAmt, applyFx);
    }
    return outCv;
  }

  async function screenshot() {
    const v = vid();
    if (!v || !v.videoWidth) { toast('No active stream'); return; }
    try {
      const c = renderHDScreenshotCanvas(v);
      const jpeg = cfg.shotFormat === 'jpeg';
      const type = jpeg ? 'image/jpeg' : 'image/png';
      const blob = await new Promise(res => c.toBlob(res, type, 0.98));
      if (!blob) throw new Error('empty blob');
      flash();
      const d = new Date(), p = n => String(n).padStart(2, '0');
      const name = 'GFN_2K_' + c.width + 'x' + c.height + '_' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + (jpeg ? '.jpg' : '.png');
      if (cfg.shotShare && navigator.canShare && navigator.share) {
        try {
          const f = new File([blob], name, { type });
          if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return; }
        } catch (e) { if (e && e.name === 'AbortError') return; }
      }
      showPreview(URL.createObjectURL(blob), name, c.width + '×' + c.height);
    } catch (e) {
      console.warn('[GFN-X] screenshot', e);
      toast('Screenshot failed');
    }
  }
  function showPreview(url, name, resText) {
    preview.replaceChildren();
    const img = h('img');
    img.src = url;
    img.alt = name;
    const row = h('div', 'sx-prev-bar');
    const a = h('a', 'sx-btn');
    a.append(ico('download', 16), document.createTextNode('Download Ultra HD (' + (resText || '') + ')'));
    a.href = url;
    a.download = name;
    const c = btn('Close', 'close', 'alt');
    c.onclick = () => {
      preview.classList.remove('on');
      preview.replaceChildren();
      URL.revokeObjectURL(url);
    };
    row.append(a, c);
    preview.append(h('div', null, 'Ultra-Crisp HD (' + (resText || '') + ') · Long-press image → Save to Photos'), img, row);
    preview.classList.add('on');
  }

  /* ================= ZERO-FREEZE STREAM INPUT & MACRO ENGINE ================= */
  const runners = new Map();
  const activeMacroPointers = new Map();
  const activeMacroTouches = new Map();
  const targetCache = new Map();
  const realPointers = new Map();
  const holdIds = new Map();
  const activeHoldBtnMacros = new Set();
  let primaryMacroPid = null;
  let pauseUntil = 0, pidSeq = 0, editing = false, realTouches = [];
  const nextPid = () => 100 + (pidSeq++ % 120);

  const isOverlayNode = el => !!(el && (el === root || (root && root.contains(el)) || el === fxEl || el.id === 'sx-gl'));

  function unstickStreamInput(silent) {
    guard(() => {
      const streamTgt = pickTarget(window.innerWidth * 0.5, window.innerHeight * 0.5);
      activeMacroPointers.forEach((info, pid) => {
        const tgt = (info.target && info.target.isConnected) ? info.target : streamTgt;
        try {
          tgt.dispatchEvent(new PointerEvent('pointerup', {
            bubbles: true, cancelable: true, composed: true, view: window,
            pointerId: pid, pointerType: 'touch', isPrimary: pid === primaryMacroPid,
            clientX: info.x, clientY: info.y, screenX: info.x, screenY: info.y,
            pressure: 0, button: 0, buttons: 0
          }));
        } catch (_) {}
      });
      activeMacroTouches.forEach((t) => {
        const tgt = (t.target && t.target.isConnected) ? t.target : streamTgt;
        try {
          tgt.dispatchEvent(new TouchEvent('touchend', {
            bubbles: true, cancelable: true, composed: true, view: window,
            touches: realTouches,
            targetTouches: realTouches.filter(q => q.target === tgt),
            changedTouches: [t]
          }));
        } catch (_) {}
      });
      if (realTouches.length === 0 && streamTgt) {
        try {
          const dummyTouch = mkTouch(streamTgt, Math.round(window.innerWidth * 0.5), Math.round(window.innerHeight * 0.5), 99);
          if (dummyTouch) {
            streamTgt.dispatchEvent(new TouchEvent('touchcancel', {
              bubbles: true, cancelable: true, composed: true, view: window,
              touches: [], targetTouches: [], changedTouches: [dummyTouch]
            }));
          }
        } catch (_) {}
      }
      activeMacroPointers.clear();
      activeMacroTouches.clear();
      targetCache.clear();
      primaryMacroPid = null;
      holdIds.clear();
      if (document.activeElement && root && root.contains(document.activeElement)) {
        try { document.activeElement.blur(); } catch (_) {}
      }
      if (!silent) toast('Stream input unlocked & refreshed');
    }, 'unstickStreamInput');
  }

  function actionsOf(m) {
    const out = [];
    m.steps.forEach(s => {
      const reps = s.rep || 1;
      for (let r = 0; r < reps; r++) {
        if (s.t === 'wait') out.push({ k: 'wait', ms: s.wait, rec: !!s.rec });
        else if (s.t === 'tap') out.push({ k: 'tap', x: s.x, y: s.y, hold: s.hold, wait: s.wait, rec: !!s.rec });
        else if (s.t === 'multi') out.push({ k: 'multi', x: s.x, y: s.y, x2: s.x2, y2: s.y2, hold: s.hold, wait: s.wait });
        else if (s.t === 'circle') out.push({ k: 'circle', x: s.x, y: s.y, rad: s.rad, dur: s.dur, wait: s.wait });
        else if (s.t === 'burst') out.push({ k: 'burst', x: s.x, y: s.y, cnt: s.cnt, hold: s.hold, spread: s.spread, wait: s.wait });
        else if (s.t === 'elastic') out.push({ k: 'elastic', x: s.x, y: s.y, x2: s.x2, y2: s.y2, dur: s.dur, hold: s.hold, wait: s.wait });
        else if (s.t === 'bar') out.push({ k: 'bar', x: s.x, y: s.y, h: s.h, opts: s.opts, pick: s.pick, hold: s.hold, wait: s.wait });
        else if (s.t === 'swipe') out.push({ k: 'swipe', x: s.x, y: s.y, x2: s.x2, y2: s.y2, dur: s.dur, wait: s.wait, pts: s.pts || null, rec: !!s.rec });
        else {
          const rows = s.rows || 1, cols = s.cols || 1;
          for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
              out.push({
                k: 'tap',
                x: s.x + s.w * (j + 0.5) / cols,
                y: s.y + s.h * (i + 0.5) / rows,
                hold: s.hold,
                wait: s.wait,
                rec: false
              });
            }
          }
        }
      }
    });
    return out;
  }

  function pickTarget(x, y) {
    const list = document.elementsFromPoint(x, y);
    return list.find(el => !isOverlayNode(el)) || vid() || document.body;
  }
  function mkTouch(target, x, y, id) {
    try {
      return new Touch({
        identifier: id,
        target,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        pageX: x,
        pageY: y,
        radiusX: 2.5,
        radiusY: 2.5,
        force: 0.65
      });
    } catch (_) {}
    try { return document.createTouch(window, target, id, x, y, x, y); } catch (_) {}
    return null;
  }

  function inject(phase, x, y, pid, prevX, prevY) {
    const cx = cl(x, 1, Math.max(2, window.innerWidth - 1));
    const cy = cl(y, 1, Math.max(2, window.innerHeight - 1));
    let target = targetCache.get(pid);
    if (phase === 'down' || !target || !target.isConnected) {
      target = pickTarget(cx, cy);
      if (target && phase === 'down') targetCache.set(pid, target);
    }
    if (phase === 'up') {
      targetCache.delete(pid);
      activeMacroPointers.delete(pid);
      if (primaryMacroPid === pid) primaryMacroPid = null;
    } else {
      activeMacroPointers.set(pid, { target, x: cx, y: cy, t: Date.now() });
      if (primaryMacroPid === null && realPointers.size === 0) primaryMacroPid = pid;
    }
    if (!target) return;

    const mode = cfg.macroInput, down = phase !== 'up';
    const isPrim = (realPointers.size === 0) && (primaryMacroPid === pid || primaryMacroPid === null);
    const movX = (phase === 'move' && prevX != null) ? (cx - prevX) : 0;
    const movY = (phase === 'move' && prevY != null) ? (cy - prevY) : 0;
    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: cx,
      clientY: cy,
      screenX: cx,
      screenY: cy,
      movementX: Math.round(movX),
      movementY: Math.round(movY)
    };
    if (mode === 'pointer' || mode === 'both') {
      guard(() => {
        const type = { down: 'pointerdown', move: 'pointermove', up: 'pointerup' }[phase];
        target.dispatchEvent(new PointerEvent(type, Object.assign({}, base, {
          pointerId: pid,
          pointerType: 'touch',
          isPrimary: isPrim,
          width: 2.5,
          height: 2.5,
          pressure: down ? 0.65 : 0,
          button: phase === 'move' ? -1 : 0,
          buttons: down ? 1 : 0
        })));
      }, 'pointer');
    }
    if (mode === 'touch' || mode === 'both') {
      guard(() => {
        const t = mkTouch(target, cx, cy, pid);
        if (!t) return;
        if (down) activeMacroTouches.set(pid, t);
        else activeMacroTouches.delete(pid);
        const macroList = Array.from(activeMacroTouches.values());
        const cleanReal = realTouches.filter(rt => !isOverlayNode(rt.target));
        const all = cleanReal.concat(macroList);
        const mine = all.filter(q => q.target === target);
        const type = { down: 'touchstart', move: 'touchmove', up: 'touchend' }[phase];
        target.dispatchEvent(new TouchEvent(type, Object.assign({}, base, {
          touches: all,
          targetTouches: mine,
          changedTouches: [t]
        })));
      }, 'touch');
    }
    if (mode === 'mouse') {
      guard(() => {
        const type = { down: 'mousedown', move: 'mousemove', up: 'mouseup' }[phase];
        target.dispatchEvent(new MouseEvent(type, Object.assign({}, base, {
          button: 0,
          buttons: down ? 1 : 0
        })));
        if (phase === 'up') target.dispatchEvent(new MouseEvent('click', Object.assign({}, base, { button: 0 })));
      }, 'mouse');
    }
  }

  function ripple(x, y) {
    if (!root || cfg.batterySaver || !cfg.macroRipple) return;
    const r = h('div', 'sx-rip');
    r.style.left = x + 'px';
    r.style.top = y + 'px';
    root.append(r);
    setTimeout(() => r.remove(), 380);
  }

  const px = (xp, yp) => [xp / 100 * window.innerWidth, yp / 100 * window.innerHeight];

  async function tapAt(a, st, speed = 1) {
    const [bx, by] = px(a.x, a.y);
    const amp = (a.hold <= 25) ? 1.5 : 2.5;
    const x = jitterCoord(bx, amp), y = jitterCoord(by, amp);
    const actualHold = Math.max(8, jitterHold(a.hold, a.rec) / speed);
    ripple(x, y);
    inject('down', x, y, st.pid);
    try {
      if (actualHold <= 45) {
        await waitExact(actualHold, st);
      } else {
        const tEnd = performance.now() + actualHold;
        let lastBeat = performance.now();
        let curX = x, curY = y;
        while (!st.stop) {
          const now = performance.now();
          const rem = tEnd - now;
          if (rem <= 0.8) break;
          if (now - lastBeat >= 30) {
            const nx = x + randRange(-0.35, 0.35);
            const ny = y + randRange(-0.35, 0.35);
            inject('move', nx, ny, st.pid, curX, curY);
            curX = nx; curY = ny;
            lastBeat = now;
          }
          await nextFrame();
        }
      }
    } finally {
      inject('up', x, y, st.pid, x, y);
    }
  }

  async function multiTapAt(a, st, speed = 1) {
    const [bx1, by1] = px(a.x, a.y);
    const [bx2, by2] = px(a.x2, a.y2);
    const x1 = jitterCoord(bx1, 2), y1 = jitterCoord(by1, 2);
    const x2 = jitterCoord(bx2, 2), y2 = jitterCoord(by2, 2);
    const pid1 = st.pid, pid2 = nextPid();
    const actualHold = Math.max(10, jitterHold(a.hold || 35, false) / speed);
    ripple(x1, y1);
    ripple(x2, y2);
    inject('down', x1, y1, pid1);
    inject('down', x2, y2, pid2);
    try {
      await waitExact(actualHold, st);
    } finally {
      inject('up', x2, y2, pid2, x2, y2);
      inject('up', x1, y1, pid1, x1, y1);
    }
  }

  async function circleAt(a, st, speed = 1) {
    const [cx, cy] = px(a.x, a.y);
    const radPx = (cl(nv(a.rad, 8), 1, 40) / 100) * Math.min(window.innerWidth, window.innerHeight);
    const totalDur = Math.max(40, jitterTime(a.dur || 700, false) / speed);
    let curX = cx + radPx, curY = cy;
    let prevX = curX, prevY = curY;
    ripple(cx, cy);
    inject('down', curX, curY, st.pid);
    try {
      const tStart = performance.now();
      while (!st.stop) {
        await nextFrame();
        if (st.stop) break;
        const elapsed = performance.now() - tStart;
        const prog = cl(elapsed / totalDur, 0, 1);
        const angle = prog * Math.PI * 2;
        curX = cx + Math.cos(angle) * radPx + randRange(-0.5, 0.5);
        curY = cy + Math.sin(angle) * radPx + randRange(-0.5, 0.5);
        inject('move', curX, curY, st.pid, prevX, prevY);
        prevX = curX; prevY = curY;
        if (prog >= 1) break;
      }
    } finally {
      inject('up', curX, curY, st.pid, prevX, prevY);
    }
  }

  async function burstAt(a, st, speed = 1) {
    const cnt = cl(Math.round(nv(a.cnt, 5)), 2, 40);
    const spreadPct = cl(nv(a.spread, 1.5), 0, 20);
    for (let i = 0; i < cnt && !st.stop; i++) {
      const ox = cl(a.x + randRange(-spreadPct, spreadPct), 1, 99);
      const oy = cl(a.y + randRange(-spreadPct, spreadPct), 1, 99);
      await tapAt({ x: ox, y: oy, hold: a.hold || 14, rec: false }, st, speed);
      if (i < cnt - 1 && !st.stop) {
        await waitExact(Math.max(4, jitterTime(10, false) / speed), st);
      }
    }
  }

  async function elasticAt(a, st, speed = 1) {
    const [bx1, by1] = px(a.x, a.y);
    const [bx2, by2] = px(a.x2, a.y2);
    const jx = randRange(-1.5, 1.5), jy = randRange(-1.5, 1.5);
    const x0 = bx1 + jx, y0 = by1 + jy;
    const x1 = bx2 + jx, y1 = by2 + jy;
    const halfDur = Math.max(12, jitterTime(a.dur || 95, false) / speed);
    const apexHold = Math.max(0, jitterTime(a.hold || 35, false) / speed);
    let curX = x0, curY = y0, prevX = x0, prevY = y0;
    ripple(x0, y0);
    inject('down', curX, curY, st.pid);
    try {
      const tStart = performance.now();
      while (!st.stop) {
        await nextFrame();
        if (st.stop) break;
        const t = cl((performance.now() - tStart) / halfDur, 0, 1);
        curX = x0 + (x1 - x0) * t;
        curY = y0 + (y1 - y0) * t;
        inject('move', curX, curY, st.pid, prevX, prevY);
        prevX = curX; prevY = curY;
        if (t >= 1) break;
      }
      if (apexHold > 0 && !st.stop) await waitExact(apexHold, st);
      const tBack = performance.now();
      while (!st.stop) {
        await nextFrame();
        if (st.stop) break;
        const t = cl((performance.now() - tBack) / (halfDur * 0.75), 0, 1);
        curX = x1 + (x0 - x1) * t;
        curY = y1 + (y0 - y1) * t;
        inject('move', curX, curY, st.pid, prevX, prevY);
        prevX = curX; prevY = curY;
        if (t >= 1) break;
      }
    } finally {
      inject('up', curX, curY, st.pid, prevX, prevY);
    }
  }

  async function swipeAt(a, st, speed = 1) {
    const jx = randRange(-2, 2), jy = randRange(-2, 2);
    const hasPts = Array.isArray(a.pts) && a.pts.length >= 2;
    const rawDur = Math.max(12, jitterTime(a.dur || 180, a.rec));
    const totalDur = Math.max(10, rawDur / speed);

    const [bx1, by1] = px(a.x, a.y);
    const [bx2, by2] = px(a.x2, a.y2);
    let curX = bx1 + jx, curY = by1 + jy;
    let prevX = curX, prevY = curY;

    ripple(curX, curY);
    inject('down', curX, curY, st.pid);

    try {
      const tStart = performance.now();
      if (hasPts) {
        const pts = a.pts;
        const origDur = Math.max(1, pts[pts.length - 1][2] || a.dur || 100);
        const timeScale = totalDur / origDur;
        let idx = 0;
        while (!st.stop) {
          await nextFrame();
          if (st.stop) break;
          const elapsed = (performance.now() - tStart) / timeScale;
          while (idx < pts.length - 2 && pts[idx + 1][2] <= elapsed) idx++;
          const p0 = pts[idx];
          const p1 = pts[Math.min(pts.length - 1, idx + 1)];
          const dtSeg = Math.max(0.5, p1[2] - p0[2]);
          const alpha = cl((elapsed - p0[2]) / dtSeg, 0, 1);
          const xp = p0[0] + (p1[0] - p0[0]) * alpha;
          const yp = p0[1] + (p1[1] - p0[1]) * alpha;
          const [rx, ry] = px(xp, yp);
          curX = rx + jx + randRange(-0.2, 0.2);
          curY = ry + jy + randRange(-0.2, 0.2);
          inject('move', curX, curY, st.pid, prevX, prevY);
          prevX = curX;
          prevY = curY;
          if (elapsed >= origDur) break;
        }
      } else {
        const xEnd = bx2 + jx, yEnd = by2 + jy;
        while (!st.stop) {
          await nextFrame();
          if (st.stop) break;
          const elapsed = performance.now() - tStart;
          const t = cl(elapsed / totalDur, 0, 1);
          curX = (bx1 + jx) + (xEnd - (bx1 + jx)) * t;
          curY = (by1 + jy) + (yEnd - (by1 + jy)) * t;
          inject('move', curX, curY, st.pid, prevX, prevY);
          prevX = curX;
          prevY = curY;
          if (t >= 1) break;
        }
      }
    } finally {
      inject('up', curX, curY, st.pid, prevX, prevY);
    }
  }

  async function playRawTimeline(evList, st, speed = 1) {
    if (!evList || !evList.length) return;
    const slotPids = new Map();
    const slotLastPos = new Map();
    const slotLastBeat = new Map();
    const slotJitter = new Map();
    const getSlotPid = slot => {
      if (!slotPids.has(slot)) slotPids.set(slot, nextPid());
      return slotPids.get(slot);
    };

    const pumpHeldSlots = now => {
      slotPids.forEach((pid, slot) => {
        const lastB = slotLastBeat.get(slot) || 0;
        if (now - lastB >= 30) {
          const pos = slotLastPos.get(slot);
          if (pos) {
            const nx = pos[0] + randRange(-0.3, 0.3);
            const ny = pos[1] + randRange(-0.3, 0.3);
            inject('move', nx, ny, pid, pos[0], pos[1]);
            slotLastBeat.set(slot, now);
          }
        }
      });
    };

    try {
      let t0 = performance.now();
      let idx = 0;
      const n = evList.length;
      while (idx < n && !st.stop) {
        if (!streaming()) { st.stop = true; break; }
        while (isPaused() && !st.stop) {
          const pStart = performance.now();
          pumpHeldSlots(pStart);
          await sleep(20);
          t0 += (performance.now() - pStart);
        }
        if (st.stop) break;

        const now = performance.now();
        const nowElapsed = (now - t0) * speed;
        const nextT = evList[idx][0];

        pumpHeldSlots(now);

        if (nowElapsed < nextT) {
          const waitMs = (nextT - nowElapsed) / speed;
          if (waitMs > 34 && slotPids.size === 0) await sleep(Math.min(20, waitMs - 12));
          else await nextFrame();
          continue;
        }

        while (idx < n && !st.stop && evList[idx][0] <= (performance.now() - t0) * speed + 1.2) {
          const e = evList[idx++];
          const type = e[1];
          const slot = e[2];
          const [bx, by] = px(e[3], e[4]);
          let j = slotJitter.get(slot);
          if (type === 0 || !j) {
            j = [randRange(-1.5, 1.5), randRange(-1.5, 1.5)];
            slotJitter.set(slot, j);
          }
          const x = bx + j[0], y = by + j[1];
          const pid = getSlotPid(slot);
          const prev = slotLastPos.get(slot) || [x, y];
          const curNow = performance.now();

          if (type === 0) {
            ripple(x, y);
            inject('down', x, y, pid);
            slotLastPos.set(slot, [x, y]);
            slotLastBeat.set(slot, curNow);
          } else if (type === 1) {
            inject('move', x, y, pid, prev[0], prev[1]);
            slotLastPos.set(slot, [x, y]);
            slotLastBeat.set(slot, curNow);
          } else {
            inject('up', x, y, pid, prev[0], prev[1]);
            slotLastPos.delete(slot);
            slotLastBeat.delete(slot);
            slotPids.delete(slot);
            slotJitter.delete(slot);
          }
        }
      }
    } finally {
      slotPids.forEach((pid, slot) => {
        const pos = slotLastPos.get(slot) || [window.innerWidth / 2, window.innerHeight / 2];
        inject('up', pos[0], pos[1], pid, pos[0], pos[1]);
        activeMacroTouches.delete(pid);
        targetCache.delete(pid);
      });
    }
  }

  function isPaused() {
    if (cfg.macroPauseMode === 'never') return false;
    const now = Date.now();
    holdIds.forEach((t, id) => { if (now - t > 4000) holdIds.delete(id); });
    return holdIds.size > 0 || now < pauseUntil;
  }

  let barSeqCounters = new Map();
  async function barTapAt(a, st, speed = 1) {
    const opts = cl(Math.round(nv(a.opts, 3)), 2, 8);
    const totalH = cl(nv(a.h, 24), 4, 100);
    const stepH = totalH / opts;
    const startY = a.y - (totalH * 0.5) + (stepH * 0.5);

    let chosenIndices = [];
    if (a.pick === 'all') {
      for (let i = 0; i < opts; i++) chosenIndices.push(i);
    } else if (a.pick === 'seq') {
      const cnt = barSeqCounters.get(st.pid) || 0;
      chosenIndices.push(cnt % opts);
      barSeqCounters.set(st.pid, cnt + 1);
    } else {
      chosenIndices.push(Math.floor(Math.random() * opts));
    }

    for (const idx of chosenIndices) {
      if (st.stop) break;
      const targetY = cl(startY + idx * stepH, 0, 100);
      const targetX = a.x;
      await tapAt({ x: targetX, y: targetY, hold: a.hold || 18, rec: false }, st, speed);
      if (chosenIndices.length > 1 && !st.stop) {
        await waitExact(Math.max(4, jitterTime(10, false) / speed), st);
      }
    }
  }

  async function perform(a, st, speed = 1) {
    if (a.k === 'wait') {
      await waitExact(jitterTime(a.ms, a.rec) / speed, st);
      return;
    }
    if (a.k === 'tap') await tapAt(a, st, speed);
    else if (a.k === 'multi') await multiTapAt(a, st, speed);
    else if (a.k === 'circle') await circleAt(a, st, speed);
    else if (a.k === 'burst') await burstAt(a, st, speed);
    else if (a.k === 'elastic') await elasticAt(a, st, speed);
    else if (a.k === 'bar') await barTapAt(a, st, speed);
    else await swipeAt(a, st, speed);
    if (!st.stop && a.wait > 0) {
      await waitExact(jitterTime(a.wait, a.rec) / speed, st);
    }
  }

  async function runMacro(m, once) {
    if (runners.has(m.id)) return;
    const st = { stop: false, t0: Date.now(), pid: nextPid() };
    runners.set(m.id, st);
    markRunning();
    let completedNaturally = false;
    try {
      const hasRawEv = Array.isArray(m.ev) && m.ev.length > 0;
      const actions = actionsOf(m);
      if (!hasRawEv && !actions.length) return;
      const baseSpeed = cl(nv(m.speed, 1), 0.5, 2.5);
      const isRecMacro = hasRawEv || m.steps.some(s => s.rec);

      if (m.delay > 0) await waitExact(jitterTime(m.delay, isRecMacro), st);
      const maxLoops = (once || m.mode === 'once') ? 1 : (m.loops | 0);
      let n = 0;
      while (!st.stop) {
        const paceFactor = (cfg.macroSmartPace && curDecodeMs > 18) ? 0.85 : 1.0;
        const speed = baseSpeed * paceFactor;
        if (hasRawEv) {
          await playRawTimeline(m.ev, st, speed);
        } else {
          for (const a of actions) {
            if (st.stop || !streaming()) { st.stop = true; break; }
            while (isPaused() && !st.stop) await sleep(20);
            if (st.stop) break;
            await perform(a, st, speed);
          }
        }
        n++;
        if (st.stop) break;
        if (maxLoops && n >= maxLoops) { completedNaturally = true; break; }
        if (Date.now() - st.t0 > cfg.macroMaxMin * 60000) {
          toast('Macro stopped: time limit reached');
          break;
        }
        await waitExact(jitterTime(Math.max(10, m.interval), isRecMacro), st);
      }
    } finally {
      activeMacroPointers.delete(st.pid);
      activeMacroTouches.delete(st.pid);
      targetCache.delete(st.pid);
      if (primaryMacroPid === st.pid) primaryMacroPid = null;
      runners.delete(m.id);
      activeHoldBtnMacros.delete(m.id);
      markRunning();
      if (completedNaturally && m.chainId && m.chainId !== m.id && streaming()) {
        const nextM = cfg.macros.find(x => x.id === m.chainId);
        if (nextM) setTimeout(() => runMacro(nextM, true), 25);
      }
    }
  }
  function stopMacro(id) {
    activeHoldBtnMacros.delete(id);
    const r = runners.get(id);
    if (r) r.stop = true;
  }
  function stopAll() {
    activeHoldBtnMacros.clear();
    runners.forEach(r => { r.stop = true; });
    setTimeout(() => unstickStreamInput(true), 40);
  }
  function toggleMacro(m) { if (runners.has(m.id)) stopMacro(m.id); else runMacro(m); }
  function markRunning() {
    if (mLayer) mLayer.querySelectorAll('.sx-mbtn').forEach(b => b.classList.toggle('run', runners.has(b.dataset.id)));
    if (stopBtn) stopBtn.classList.toggle('on', runners.size > 0 && !editing && !recState.on && !recState.countingDown);
  }

  function nearTarget(x, y) {
    const r = cfg.macroPauseRadius;
    for (const id of runners.keys()) {
      const m = cfg.macros.find(q => q.id === id);
      if (!m) continue;
      for (const a of actionsOf(m)) {
        if (a.k === 'wait') continue;
        const pts = [[a.x, a.y]];
        if (a.k === 'swipe' || a.k === 'multi' || a.k === 'elastic') pts.push([a.x2, a.y2], [(a.x + a.x2) / 2, (a.y + a.y2) / 2]);
        for (const p of pts) {
          const q = px(p[0], p[1]);
          if (Math.hypot(q[0] - x, q[1] - y) <= r) return true;
        }
      }
    }
    return false;
  }

  document.addEventListener('pointerdown', e => {
    if (!e.isTrusted) return;
    lastUserAct = Date.now();
    if (typeof e.timeStamp === 'number' && e.timeStamp > 0) {
      const d = performance.now() - e.timeStamp;
      if (d >= 0 && d < 150) lastTouchDispMs = lastTouchDispMs * 0.7 + d * 0.3;
    }
    if (!isOverlayNode(e.target)) {
      realPointers.set(e.pointerId, Date.now());
    }
    if (!runners.size || cfg.macroPauseMode === 'never') return;
    if (isOverlayNode(e.target)) return;
    if (cfg.macroPauseMode === 'near' && !nearTarget(e.clientX, e.clientY)) return;
    holdIds.set(e.pointerId, Date.now());
  }, { capture: true, passive: true });

  ['pointerup', 'pointercancel'].forEach(t => {
    document.addEventListener(t, e => {
      if (!e.isTrusted) return;
      lastUserAct = Date.now();
      realPointers.delete(e.pointerId);
      if (holdIds.delete(e.pointerId)) pauseUntil = Date.now() + cfg.macroPauseMs;
      if (activeHoldBtnMacros.size > 0 && realTouches.length === 0) {
        activeHoldBtnMacros.forEach(id => stopMacro(id));
      }
    }, { capture: true, passive: true });
  });

  ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(t => {
    document.addEventListener(t, e => {
      if (!e.isTrusted) return;
      if (typeof e.timeStamp === 'number' && e.timeStamp > 0 && t === 'touchmove') {
        const d = performance.now() - e.timeStamp;
        if (d >= 0 && d < 120) lastTouchDispMs = lastTouchDispMs * 0.8 + d * 0.2;
      }
      realTouches = Array.from(e.touches).filter(touch => !isOverlayNode(touch.target));
      if (e.touches.length === 0) {
        realPointers.clear();
        holdIds.clear();
        if (activeHoldBtnMacros.size > 0) {
          activeHoldBtnMacros.forEach(id => stopMacro(id));
        }
      }
    }, { capture: true, passive: true });
  });

  /* ================= Macro Recorder Engine ================= */
  const recState = {
    countingDown: false,
    cdTimer: 0,
    on: false,
    t0: 0,
    firstActionT: 0,
    lastEventEndTime: 0,
    timerId: 0,
    nextSlot: 0,
    ptrs: new Map(),
    steps: [],
    rawEv: []
  };

  function fmtRecTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    const d = Math.floor((ms % 1000) / 100);
    return m + ':' + s + '.' + d;
  }

  function updateRecUI() {
    if (!recEl) return;
    const active = recState.on || recState.countingDown;
    recEl.classList.toggle('on', active);
    recEl.classList.toggle('prep', recState.countingDown);
    if (!recState.on) return;
    const elapsed = Math.max(0, performance.now() - recState.t0);
    if (recTimeEl) recTimeEl.textContent = fmtRecTime(elapsed);
    const holdingCount = recState.ptrs.size;
    if (recCntEl) {
      recCntEl.textContent = recState.steps.length + ' act' + (holdingCount ? ' · HOLDING (' + holdingCount + ')' : '');
      recCntEl.style.color = holdingCount ? '#248a3d' : '';
    }
  }

  function startRecording() {
    ensureRoot();
    if (recState.on || recState.countingDown) return;
    if (!streaming()) {
      toast('Start a game stream first to record touch actions');
      return;
    }
    stopAll();
    if (editing) exitEdit();
    closePanel();

    const beginCapture = () => {
      recState.countingDown = false;
      if (cdEl) cdEl.classList.remove('on');
      recState.on = true;
      recState.t0 = performance.now();
      recState.firstActionT = 0;
      recState.lastEventEndTime = 0;
      recState.nextSlot = 0;
      recState.ptrs.clear();
      recState.steps = [];
      recState.rawEv = [];
      if (recTimeEl) recTimeEl.textContent = '00:00.0';
      if (recCntEl) { recCntEl.textContent = '0 act'; recCntEl.style.color = ''; }
      clearInterval(recState.timerId);
      recState.timerId = setInterval(updateRecUI, 80);
      updateRecUI();
      markRunning();
      toast('Recording LIVE — taps, long holds & swipes are captured 1:1');
    };

    if (!cfg.recCountdown) {
      beginCapture();
      return;
    }

    recState.countingDown = true;
    let rem = 3;
    updateRecUI();
    markRunning();
    if (cdEl && cdNumEl) {
      cdNumEl.textContent = String(rem);
      cdEl.classList.add('on');
    }
    if (recTimeEl) recTimeEl.textContent = 'Ready...';
    if (recCntEl) recCntEl.textContent = 'Starting in 3s';
    clearInterval(recState.cdTimer);
    recState.cdTimer = setInterval(() => {
      rem--;
      if (rem > 0) {
        if (cdNumEl) cdNumEl.textContent = String(rem);
        if (recCntEl) recCntEl.textContent = 'Starting in ' + rem + 's';
      } else {
        clearInterval(recState.cdTimer);
        beginCapture();
      }
    }, 1000);
  }

  function finalizeRecordedPointer(p, endX, endY, now) {
    recState.lastEventEndTime = now;
    const dur = Math.max(12, Math.round(now - p.tDown));
    const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight);
    const xp0 = +(cl(p.x0 / W * 100, 0, 100)).toFixed(2);
    const yp0 = +(cl(p.y0 / H * 100, 0, 100)).toFixed(2);
    const xp1 = +(cl(endX / W * 100, 0, 100)).toFixed(2);
    const yp1 = +(cl(endY / H * 100, 0, 100)).toFixed(2);
    const tGlobal = Math.max(0, +(now - recState.firstActionT).toFixed(1));

    if (recState.rawEv.length < 4000) {
      recState.rawEv.push([tGlobal, 2, p.slot, xp1, yp1, 0, 0]);
    }

    const isStationaryHold = (dur >= 180 && p.maxDist <= 12) || (p.maxDist <= 6);
    if (!isStationaryHold) {
      const lastPt = p.pts[p.pts.length - 1];
      if (!lastPt || lastPt[0] !== xp1 || lastPt[1] !== yp1 || Math.abs(lastPt[2] - dur) > 15) {
        p.pts.push([xp1, yp1, dur]);
      } else {
        lastPt[2] = dur;
      }
      recState.steps.push(normStep({
        t: 'swipe',
        x: xp0,
        y: yp0,
        x2: xp1,
        y2: yp1,
        dur: cl(dur, 12, 30000),
        pts: p.pts,
        wait: 0,
        rec: true
      }));
    } else {
      recState.steps.push(normStep({
        t: 'tap',
        x: xp0,
        y: yp0,
        hold: cl(dur, 12, 30000),
        wait: 0,
        rec: true
      }));
    }
  }

  function stopAndSaveRecording() {
    if (recState.countingDown) {
      cancelRecording();
      return;
    }
    if (!recState.on) return;
    const now = performance.now();
    recState.ptrs.forEach(p => {
      finalizeRecordedPointer(p, p.xLast, p.yLast, now);
    });
    recState.on = false;
    recState.ptrs.clear();
    clearInterval(recState.timerId);
    updateRecUI();
    markRunning();

    if (!recState.steps.length && !recState.rawEv.length) {
      toast('No touch actions recorded');
      openPanel('rec');
      return;
    }

    let idx = cfg.customTemplates.length + 1;
    let defName = 'Rec ' + idx;
    while (cfg.customTemplates.some(t => t.name.toLowerCase() === defName.toLowerCase())) {
      idx++;
      defName = 'Rec ' + idx;
    }

    const rawName = prompt('Name this Recorded Macro Template (Tip: enter an existing name to overwrite it):', defName);
    if (rawName === null) {
      toast('Recording discarded');
      openPanel('rec');
      return;
    }
    const name = (rawName.trim() || defName).slice(0, 20);

    let tpl = cfg.customTemplates.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (tpl) {
      tpl.steps = recState.steps.map(normStep);
      tpl.ev = normRawEv(recState.rawEv);
      tpl.createdAt = Date.now();
    } else {
      tpl = normTemplate({
        id: newId('tpl_'),
        name,
        mode: 'once',
        interval: 20,
        loops: 1,
        delay: 0,
        speed: 1,
        steps: recState.steps,
        ev: recState.rawEv
      });
      cfg.customTemplates.unshift(tpl);
    }

    if (cfg.recAutoBtn) {
      cfg.macroEnabled = true;
      syncTemplateToMacro(tpl, true);
    } else {
      commit('customTemplates', true);
    }
    toast('Saved "' + name + '" (' + tpl.steps.length + ' actions)');
    openPanel('rec');
  }

  function cancelRecording() {
    if (!recState.on && !recState.countingDown) return;
    recState.countingDown = false;
    recState.on = false;
    recState.ptrs.clear();
    recState.steps = [];
    recState.rawEv = [];
    clearInterval(recState.cdTimer);
    clearInterval(recState.timerId);
    if (cdEl) cdEl.classList.remove('on');
    updateRecUI();
    markRunning();
    toast('Recording cancelled');
    openPanel('rec');
  }

  document.addEventListener('pointerdown', e => {
    if (!recState.on || !e.isTrusted) return;
    if (isOverlayNode(e.target)) return;
    const now = performance.now();
    if (!recState.firstActionT) recState.firstActionT = now;

    if (recState.steps.length > 0 && recState.lastEventEndTime > 0 && recState.ptrs.size === 0) {
      const gap = Math.round(now - recState.lastEventEndTime);
      if (gap >= 8) {
        const prev = recState.steps[recState.steps.length - 1];
        if (prev && prev.t !== 'wait') {
          prev.wait = cl(gap, 0, 30000);
        } else {
          recState.steps.push(normStep({ t: 'wait', wait: cl(gap, 0, 30000), rec: true }));
        }
      }
    }

    const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight);
    const xp0 = +(cl(e.clientX / W * 100, 0, 100)).toFixed(2);
    const yp0 = +(cl(e.clientY / H * 100, 0, 100)).toFixed(2);
    const slot = recState.nextSlot++ % 10;
    const tOff = Math.max(0, +(now - recState.firstActionT).toFixed(1));

    if (recState.rawEv.length < 4000) {
      recState.rawEv.push([tOff, 0, slot, xp0, yp0, 0, 0]);
    }

    recState.ptrs.set(e.pointerId, {
      id: e.pointerId,
      slot,
      x0: e.clientX,
      y0: e.clientY,
      xLast: e.clientX,
      yLast: e.clientY,
      tDown: now,
      maxDist: 0,
      pts: [[xp0, yp0, 0]],
      lastSampleT: now
    });
    updateRecUI();
  }, { capture: true, passive: true });

  document.addEventListener('pointermove', e => {
    if (!recState.on || !e.isTrusted) return;
    const p = recState.ptrs.get(e.pointerId);
    if (!p) return;

    const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight);
    const events = (typeof e.getCoalescedEvents === 'function') ? e.getCoalescedEvents() : [e];
    const list = (events && events.length) ? events : [e];

    for (const ev of list) {
      const now = performance.now();
      const dx = ev.clientX - p.xLast, dy = ev.clientY - p.yLast;
      const stepDist = Math.hypot(dx, dy);
      if (stepDist < 1.5 && now - p.lastSampleT < 35) continue;

      p.xLast = ev.clientX;
      p.yLast = ev.clientY;
      const distFromStart = Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0);
      if (distFromStart > p.maxDist) p.maxDist = distFromStart;

      const xp = +(cl(ev.clientX / W * 100, 0, 100)).toFixed(2);
      const yp = +(cl(ev.clientY / H * 100, 0, 100)).toFixed(2);
      const tOff = Math.max(0.5, +(now - p.tDown).toFixed(1));
      const tGlobal = Math.max(0, +(now - recState.firstActionT).toFixed(1));

      if (p.pts.length < 400) {
        p.pts.push([xp, yp, tOff]);
      }
      if (recState.rawEv.length < 4000) {
        recState.rawEv.push([tGlobal, 1, p.slot, xp, yp, +(dx / W * 100).toFixed(2), +(dy / H * 100).toFixed(2)]);
      }
      p.lastSampleT = now;
    }
  }, { capture: true, passive: true });

  document.addEventListener('pointerup', e => {
    if (!recState.on || !e.isTrusted) return;
    const p = recState.ptrs.get(e.pointerId);
    if (!p) return;
    recState.ptrs.delete(e.pointerId);
    const endX = (typeof e.clientX === 'number' && e.clientX > 0) ? e.clientX : p.xLast;
    const endY = (typeof e.clientY === 'number' && e.clientY > 0) ? e.clientY : p.yLast;
    finalizeRecordedPointer(p, endX, endY, performance.now());
    updateRecUI();
  }, { capture: true, passive: true });

  document.addEventListener('pointercancel', e => {
    if (!recState.on || !e.isTrusted) return;
    const p = recState.ptrs.get(e.pointerId);
    if (!p) return;
    if (realTouches.length > 0) {
      p.cancelledPointer = true;
      return;
    }
    recState.ptrs.delete(e.pointerId);
    finalizeRecordedPointer(p, p.xLast, p.yLast, performance.now());
    updateRecUI();
  }, { capture: true, passive: true });

  document.addEventListener('touchend', e => {
    if (!recState.on || !e.isTrusted) return;
    if (e.touches.length === 0 && recState.ptrs.size > 0) {
      const now = performance.now();
      recState.ptrs.forEach((p, key) => {
        if (p.cancelledPointer) {
          recState.ptrs.delete(key);
          finalizeRecordedPointer(p, p.xLast, p.yLast, now);
        }
      });
      updateRecUI();
    }
  }, { capture: true, passive: true });

  /* ---- Template Management ---- */
  function testTemplate(tpl) {
    if (!streaming()) { toast('Start a game stream first to test'); return; }
    const tempMacro = normMacro(Object.assign({}, tpl, { id: 'test_' + tpl.id, mode: 'once' }));
    runMacro(tempMacro, true);
    toast('Testing "' + tpl.name + '" (' + (tpl.speed || 1) + '×)');
  }

  function syncTemplateToMacro(tpl, silentToast) {
    let existing = cfg.macros.find(m => m.tplId === tpl.id || m.name.toLowerCase() === tpl.name.slice(0, 16).toLowerCase());
    if (existing) {
      existing.tplId = tpl.id;
      existing.name = tpl.name.slice(0, 16);
      existing.mode = tpl.mode;
      existing.interval = tpl.interval;
      existing.loops = tpl.loops;
      existing.delay = tpl.delay;
      existing.speed = tpl.speed || 1;
      existing.steps = JSON.parse(JSON.stringify(tpl.steps));
      if (Array.isArray(tpl.ev) && tpl.ev.length) existing.ev = JSON.parse(JSON.stringify(tpl.ev));
      else delete existing.ev;
      existing.on = true;
      if (isSlotOccupied(existing.btn.x, existing.btn.y, existing.id, cfg.macros)) {
        existing.btn = findFreeBtnSlot(existing.id, cfg.macros);
      }
      macroSel = existing.id;
      commit('macros', true);
      if (!silentToast) toast('Updated "' + existing.name + '" button on screen');
    } else {
      const freeSlot = findFreeBtnSlot(null, cfg.macros);
      const m = normMacro({
        id: newId('m'),
        tplId: tpl.id,
        name: tpl.name.slice(0, 16),
        on: true,
        mode: tpl.mode,
        interval: tpl.interval,
        loops: tpl.loops,
        delay: tpl.delay,
        speed: tpl.speed || 1,
        steps: JSON.parse(JSON.stringify(tpl.steps)),
        ev: Array.isArray(tpl.ev) ? JSON.parse(JSON.stringify(tpl.ev)) : undefined,
        btn: freeSlot
      });
      cfg.macros.push(m);
      macroSel = m.id;
      commit('macros', true);
      if (!silentToast) toast('Placed "' + m.name + '" at free slot on screen');
    }
  }

  function toggleTemplateScreenBtn(tpl) {
    const existing = cfg.macros.find(m => m.tplId === tpl.id || m.name.toLowerCase() === tpl.name.slice(0, 16).toLowerCase());
    if (existing && existing.on) {
      stopMacro(existing.id);
      cfg.macros = cfg.macros.filter(m => m.id !== existing.id);
      if (macroSel === existing.id) macroSel = cfg.macros[0] ? cfg.macros[0].id : null;
      commit('macros', true);
      toast('Removed "' + tpl.name + '" button from screen');
    } else {
      cfg.macroEnabled = true;
      syncTemplateToMacro(tpl, false);
    }
  }

  function dupTemplate(tpl) {
    const copy = normTemplate(Object.assign(JSON.parse(JSON.stringify(tpl)), {
      id: newId('tpl_'),
      name: (tpl.name + ' Copy').slice(0, 20),
      createdAt: Date.now()
    }));
    cfg.customTemplates.unshift(copy);
    commit('customTemplates', true);
    toast('Template duplicated');
  }

  function delTemplate(id) {
    if (!confirm('Delete this recorded template and its screen button?')) return;
    const tpl = cfg.customTemplates.find(t => t.id === id);
    cfg.customTemplates = cfg.customTemplates.filter(t => t.id !== id);
    cfg.macros = cfg.macros.filter(m => m.tplId !== id && !(tpl && m.name.toLowerCase() === tpl.name.slice(0, 16).toLowerCase()));
    if (!cfg.macros.find(m => m.id === macroSel)) macroSel = cfg.macros[0] ? cfg.macros[0].id : null;
    commit('customTemplates', true);
  }

  async function exportTemplates(singleTpl) {
    const payload = singleTpl
      ? { sxTpl: 3.3, templates: [singleTpl] }
      : { sxTpl: 3.3, templates: cfg.customTemplates };
    const txt = JSON.stringify(payload);
    try {
      await navigator.clipboard.writeText(txt);
      toast('Template JSON copied to clipboard');
    } catch (_) {
      prompt('Copy Template JSON:', txt);
    }
  }
  function importTemplates() {
    const raw = prompt('Paste Recorded Template JSON:');
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      const list = Array.isArray(d) ? d : (d.templates || d.macros || (d.steps ? [d] : []));
      if (!Array.isArray(list) || !list.length) throw new Error('empty');
      let count = 0;
      list.slice(0, 30).forEach(item => {
        if (item && Array.isArray(item.steps)) {
          cfg.customTemplates.unshift(normTemplate(Object.assign({}, item, { id: newId('tpl_') })));
          count++;
        }
      });
      if (!count) throw new Error('no valid templates');
      commit('customTemplates', true);
      toast('Imported ' + count + ' template(s)');
    } catch (_) {
      toast('Invalid template JSON');
    }
  }

  /* ---- macro management ---- */
  let macroSel = null, tplSel = 'loot20';
  function curMacro() {
    let m = cfg.macros.find(x => x.id === macroSel);
    if (!m) { m = cfg.macros[0] || null; macroSel = m ? m.id : null; }
    return m;
  }
  function addMacro(key) {
    if (String(key).startsWith('ct:')) {
      const id = String(key).slice(3);
      const found = (cfg.customTemplates || []).find(t => t.id === id);
      if (found) { syncTemplateToMacro(found, false); return; }
    }
    const freeSlot = findFreeBtnSlot(null, cfg.macros);
    const m = fromTpl(key, null);
    m.btn = freeSlot;
    m.name = (m.name + ' ' + (cfg.macros.length + 1)).slice(0, 16);
    cfg.macros.push(m);
    macroSel = m.id;
    commit('macros', true);
    toast('Added "' + m.name + '" at free slot');
  }
  function dupMacro(m) {
    const copy = JSON.parse(JSON.stringify(m));
    delete copy.tplId;
    const freeSlot = findFreeBtnSlot(null, cfg.macros);
    const c = normMacro(Object.assign(copy, {
      id: newId('m'),
      name: (m.name + ' 2').slice(0, 16),
      btn: freeSlot
    }));
    cfg.macros.push(c);
    macroSel = c.id;
    commit('macros', true);
  }
  function delMacro(id) {
    if (!confirm('Delete this macro button?')) return;
    stopMacro(id);
    cfg.macros = cfg.macros.filter(m => m.id !== id);
    macroSel = null;
    commit('macros', true);
    if (editing) renderEdit();
  }
  function renameMacro(m) {
    const n = prompt('Macro name', m.name);
    if (n && n.trim()) {
      m.name = n.trim().slice(0, 16);
      commit('macros', true);
    }
  }
  async function exportMacros() {
    const txt = JSON.stringify({ sx: 3.3, macros: cfg.macros });
    try { await navigator.clipboard.writeText(txt); toast('Macros copied to clipboard'); }
    catch (_) { prompt('Copy your macros', txt); }
  }
  function importMacros() {
    const t = prompt('Paste exported macros');
    if (!t) return;
    try {
      const d = JSON.parse(t);
      const list = Array.isArray(d) ? d : d.macros;
      if (!Array.isArray(list) || !list.length) throw new Error('empty');
      list.slice(0, 20).forEach(x => {
        const freeSlot = findFreeBtnSlot(null, cfg.macros);
        cfg.macros.push(normMacro(Object.assign({}, x, { id: newId('m'), btn: freeSlot })));
      });
      macroSel = cfg.macros[cfg.macros.length - 1].id;
      commit('macros', true);
      toast('Imported ' + Math.min(list.length, 20) + ' macro(s)');
    } catch (_) { toast('That is not valid macro data'); }
  }
  function addStepTo(m, type) {
    delete m.ev;
    const wait = (m.steps.length && m.steps[m.steps.length - 1].wait) || 20;
    const base = {
      tap: { x: 50, y: 50, hold: 20 },
      burst: { x: 66, y: 55, cnt: 5, hold: 14, spread: 1.5 },
      multi: { x: 84, y: 74, x2: 91, y2: 58, hold: 40 },
      circle: { x: 18, y: 72, rad: 8, dur: 700 },
      elastic: { x: 18, y: 72, x2: 18, y2: 44, dur: 95, hold: 35 },
      zone: { x: 60, y: 35, w: 30, h: 30, rows: 3, hold: 20 },
      swipe: { x: 60, y: 50, x2: 40, y2: 50, dur: 160 },
      wait: {}
    }[type];
    m.steps.push(normStep(Object.assign({ t: type, wait: type === 'wait' ? 100 : wait }, base)));
    stepsChanged();
  }
  function stepsChanged() { save(); if (editing) renderEdit(); rebuildUI(); }
  function moveStep(m, i, d) {
    const j = i + d;
    if (j < 0 || j >= m.steps.length) return;
    delete m.ev;
    const t = m.steps[i];
    m.steps[i] = m.steps[j];
    m.steps[j] = t;
    stepsChanged();
  }
  function dupStep(m, i) { delete m.ev; m.steps.splice(i + 1, 0, JSON.parse(JSON.stringify(m.steps[i]))); stepsChanged(); }
  function delStep(m, i) { delete m.ev; m.steps.splice(i, 1); stepsChanged(); }

  /* ================= controls (shared by lobby + in-game panel) ================= */
  const getv = it => (it.get ? it.get() : cfg[it.k]);
  const setv = (it, v) => { if (it.set) it.set(v); else set(it.k, v); };
  function refreshControls() { document.querySelectorAll('[data-sx]').forEach(e => { if (e._sxSync) e._sxSync(); }); }

  function mkSwitch(it) {
    const b = h('button', 'sx-sw');
    b.type = 'button';
    b.setAttribute('role', 'switch');
    b.dataset.sx = '1';
    b.setAttribute('aria-label', it.label);
    b._sxSync = () => b.setAttribute('aria-checked', String(!!getv(it)));
    b.addEventListener('click', e => { e.stopPropagation(); setv(it, !getv(it)); });
    b._sxSync();
    return b;
  }
  function mkSelect(it) {
    const s = h('select', 'sx-sel');
    s.dataset.sx = '1';
    s.setAttribute('aria-label', it.label);
    (typeof it.opts === 'function' ? it.opts() : it.opts).forEach(([v, t]) => {
      const o = h('option', null, t);
      o.value = v;
      s.append(o);
    });
    s._sxSync = () => { s.value = String(getv(it)); };
    s.addEventListener('change', () => setv(it, s.value));
    s._sxSync();
    return s;
  }
  function mkRange(it) {
    const w = h('div', 'sx-rw');
    w.dataset.sx = '1';
    const r = h('input');
    r.type = 'range';
    r.min = it.min;
    r.max = it.max;
    r.step = it.step;
    r.setAttribute('aria-label', it.label);
    const o = h('span', 'sx-rv');
    const fmt = it.fmt || String;
    const fill = () => r.style.setProperty('--p', ((+r.value - it.min) / (it.max - it.min) * 100) + '%');
    w._sxSync = () => {
      const v = +getv(it);
      r.value = v;
      o.textContent = fmt(v);
      fill();
    };
    r.addEventListener('input', () => {
      const v = +r.value;
      o.textContent = fmt(v);
      fill();
      setv(it, v);
      peek();
    });
    w.append(r, o);
    w._sxSync();
    return w;
  }
  function mkButtons(list) {
    const w = h('div', 'sx-rc');
    list.forEach(([text, fn, cls, icon]) => {
      const b = btn(text, icon, cls);
      b.addEventListener('click', e => { e.stopPropagation(); fn(); });
      w.append(b);
    });
    return w;
  }
  function ctlFor(it) {
    if (it.type === 'switch') return mkSwitch(it);
    if (it.type === 'select') return mkSelect(it);
    if (it.type === 'range') return mkRange(it);
    if (it.type === 'buttons') return mkButtons(it.btns);
    return mkButtons([[it.btn || it.label, it.run, it.cls || '', it.icon]]);
  }

  function mkStep(m, i) {
    const s = m.steps[i];
    const card = h('div', 'sx-step');
    const head = h('div', 'sx-sh');
    const isLongHold = s.t === 'tap' && s.hold >= 180;
    const TN = {
      tap: isLongHold ? 'Tap & Hold' : 'Tap',
      burst: 'Rapid Burst (' + (s.cnt || 5) + '×)',
      multi: 'Multi-Touch (2 Fingers)',
      circle: 'Circle Spin 360°',
      elastic: 'Elastic Dodge / Flick Back',
      bar: 'Dialogue / Option Bar',
      zone: 'Zone Grid',
      swipe: s.pts ? 'Swipe (1:1 Curve)' : 'Swipe',
      wait: 'Wait'
    };
    const name = h('div', 'sx-sn');
    name.append(ico(s.t, 16), h('span', null, (i + 1) + ' · ' + (TN[s.t] || s.t)));
    const ib = (icon, title, fn, cls) => {
      const b = h('button', 'sx-ib ' + (cls || ''));
      b.type = 'button';
      b.title = title;
      b.setAttribute('aria-label', title);
      b.append(ico(icon, 16));
      b.addEventListener('click', e => { e.stopPropagation(); fn(); });
      return b;
    };
    head.append(
      name,
      ib('up', 'Move up', () => moveStep(m, i, -1)),
      ib('down', 'Move down', () => moveStep(m, i, 1)),
      ib('copy', 'Duplicate step', () => dupStep(m, i)),
      ib('trash', 'Delete step', () => delStep(m, i), 'danger')
    );
    const grid = h('div', 'sx-sg');
    const F = (label, key, min, max) => {
      const w = h('label', 'sx-nf');
      w.append(h('span', null, label));
      const inp = h('input');
      inp.type = 'number';
      inp.inputMode = 'decimal';
      inp.step = 'any';
      inp.min = min;
      inp.max = max;
      inp.value = s[key];
      const commitVal = () => {
        if (inp.value === '' || inp.value === '-') return;
        let v = parseFloat(inp.value);
        if (!isFinite(v)) v = s[key];
        v = cl(v, min, max);
        s[key] = v;
        delete m.ev;
        save();
        if (editing) renderEdit();
      };
      inp.addEventListener('input', commitVal);
      inp.addEventListener('change', () => {
        commitVal();
        inp.value = s[key];
      });
      inp.addEventListener('blur', () => {
        commitVal();
        inp.value = s[key];
      });
      w.append(inp);
      grid.append(w);
    };
    if (s.t === 'wait') F('Wait (ms)', 'wait', 0, 30000);
    else {
      F('X (%)', 'x', 0, 100);
      F('Y (%)', 'y', 0, 100);
      if (s.t === 'swipe') {
        F('To X (%)', 'x2', 0, 100);
        F('To Y (%)', 'y2', 0, 100);
        F('Time (ms)', 'dur', 10, 30000);
      } else if (s.t === 'elastic') {
        F('Flick X (%)', 'x2', 0, 100);
        F('Flick Y (%)', 'y2', 0, 100);
        F('Flick (ms)', 'dur', 15, 10000);
        F('Apex Hold', 'hold', 0, 5000);
      } else if (s.t === 'multi') {
        F('2nd X (%)', 'x2', 0, 100);
        F('2nd Y (%)', 'y2', 0, 100);
        F('Hold (ms)', 'hold', 10, 30000);
      } else if (s.t === 'bar') {
        F('Height (%)', 'h', 4, 100);
        F('Options', 'opts', 2, 8);
        const pw = h('label', 'sx-nf');
        pw.append(h('span', null, 'Pick Mode'));
        const ps = h('select');
        [['rand', 'Random'], ['seq', 'Sequential'], ['all', 'All Rapid']].forEach(([v, txt]) => {
          const o = h('option', null, txt);
          o.value = v;
          ps.append(o);
        });
        ps.value = s.pick || 'rand';
        ps.onchange = () => { s.pick = ps.value; delete m.ev; save(); };
        pw.append(ps);
        grid.append(pw);
        F('Hold (ms)', 'hold', 10, 30000);
      } else if (s.t === 'circle') {
        F('Radius (%)', 'rad', 1, 40);
        F('Time (ms)', 'dur', 60, 30000);
      } else if (s.t === 'burst') {
        F('Clicks', 'cnt', 2, 40);
        F('Hold (ms)', 'hold', 10, 1000);
        F('Spread (%)', 'spread', 0, 20);
      } else if (s.t === 'zone') {
        F('Width (%)', 'w', 2, 100);
        F('Height (%)', 'h', 2, 100);
        F('Rows', 'rows', 1, 12);
        F('Columns', 'cols', 1, 12);
        F('Hold (ms)', 'hold', 10, 30000);
      } else {
        F('Hold (ms, min 10)', 'hold', 10, 30000);
      }
      F('Wait after (ms)', 'wait', 0, 30000);
      F('Repeat', 'rep', 1, 50);
    }
    card.append(head, grid);
    return card;
  }

  function mkTplCard(tpl) {
    const card = h('div', 'sx-tcard');
    const head = h('div', 'sx-sh');
    const title = h('div', 'sx-sn');
    title.append(ico('folder', 16), h('span', null, tpl.name));
    if (Array.isArray(tpl.ev) && tpl.ev.length) {
      title.append(h('span', 'sx-badge rec', '1:1 HOLD+RAW'));
    }
    const ib = (icon, label, fn, cls) => {
      const b = h('button', 'sx-ib ' + (cls || ''));
      b.type = 'button';
      b.title = label;
      b.setAttribute('aria-label', label);
      b.append(ico(icon, 16));
      b.addEventListener('click', e => { e.stopPropagation(); fn(); });
      return b;
    };
    head.append(
      title,
      ib('edit', 'Rename', () => {
        const n = prompt('Template name:', tpl.name);
        if (n && n.trim()) {
          tpl.name = n.trim().slice(0, 20);
          const linked = cfg.macros.find(m => m.tplId === tpl.id);
          if (linked) linked.name = tpl.name.slice(0, 16);
          commit('customTemplates', true);
        }
      }),
      ib('copy', 'Duplicate', () => dupTemplate(tpl)),
      ib('download', 'Export JSON', () => exportTemplates(tpl)),
      ib('trash', 'Delete', () => delTemplate(tpl.id), 'danger')
    );

    const counts = { tap: 0, long: 0, swipe: 0, wait: 0 };
    tpl.steps.forEach(s => {
      if (s.t === 'swipe') counts.swipe++;
      else if (s.t === 'wait') counts.wait++;
      else if (s.t === 'tap' && s.hold >= 180) counts.long++;
      else counts.tap++;
    });
    const parts = [];
    if (counts.tap) parts.push(counts.tap + ' tap');
    if (counts.long) parts.push(counts.long + ' hold');
    if (counts.swipe) parts.push(counts.swipe + ' swipe/pan');
    const rawCount = Array.isArray(tpl.ev) ? tpl.ev.length : 0;
    const meta = h('div', 'sx-tmeta', tpl.steps.length + ' actions (' + (parts.join(', ') || 'empty') + (rawCount ? ' · ' + rawCount + ' raw frames' : '') + ')');

    const grid = h('div', 'sx-sg');
    const syncLinked = () => {
      const linked = cfg.macros.find(m => m.tplId === tpl.id || m.name.toLowerCase() === tpl.name.slice(0, 16).toLowerCase());
      if (linked) {
        linked.tplId = tpl.id;
        linked.mode = tpl.mode;
        linked.loops = tpl.loops;
        linked.delay = tpl.delay;
        linked.interval = tpl.interval;
        linked.speed = tpl.speed || 1;
      }
      save();
      renderMacros();
    };

    const modeWrap = h('label', 'sx-nf');
    modeWrap.append(h('span', null, 'Trigger'));
    const modeSel = h('select');
    [['once', 'Once (1 tap)'], ['toggle', 'Toggle (Loop)'], ['hold', 'Hold Button']].forEach(([v, txt]) => {
      const o = h('option', null, txt);
      o.value = v;
      modeSel.append(o);
    });
    modeSel.value = tpl.mode || 'once';
    modeSel.addEventListener('change', () => { tpl.mode = modeSel.value; syncLinked(); });
    modeWrap.append(modeSel);
    grid.append(modeWrap);

    const numField = (label, key, min, max, isFloat) => {
      const w = h('label', 'sx-nf');
      w.append(h('span', null, label));
      const inp = h('input');
      inp.type = 'number';
      inp.inputMode = isFloat ? 'decimal' : 'numeric';
      inp.step = isFloat ? '0.1' : '1';
      inp.min = min;
      inp.max = max;
      inp.value = tpl[key] != null ? tpl[key] : (isFloat ? 1 : 0);
      const commitTpl = () => {
        if (inp.value === '' || inp.value === '-') return;
        let v = isFloat ? parseFloat(inp.value) : parseInt(inp.value, 10);
        if (!isFinite(v)) v = tpl[key];
        v = cl(v, min, max);
        tpl[key] = v;
        syncLinked();
      };
      inp.addEventListener('input', commitTpl);
      inp.addEventListener('change', () => {
        commitTpl();
        inp.value = tpl[key];
      });
      inp.addEventListener('blur', () => {
        commitTpl();
        inp.value = tpl[key];
      });
      w.append(inp);
      grid.append(w);
    };
    numField('Speed (0.5–2.5×)', 'speed', 0.5, 2.5, true);
    numField('Loop (0=∞)', 'loops', 0, 999, false);
    numField('Interval (min 20ms)', 'interval', 20, 10000, false);

    const existingBtn = cfg.macros.find(m => m.tplId === tpl.id || m.name.toLowerCase() === tpl.name.slice(0, 16).toLowerCase());
    const isShowing = !!(existingBtn && existingBtn.on);
    const acts = h('div', 'sx-tacts');
    const bTest = btn('Test', 'play', 'alt');
    bTest.onclick = () => testTemplate(tpl);
    const bToggleBtn = btn(isShowing ? 'Hide from Screen' : 'Show on Screen', isShowing ? 'eye' : 'plus', isShowing ? 'alt' : '');
    bToggleBtn.onclick = () => { toggleTemplateScreenBtn(tpl); renderPanel(); };
    acts.append(bTest, bToggleBtn);

    card.append(head, meta, grid, acts);
    return card;
  }

  /* ================= settings schema ================= */
  const pct = v => Math.round(v * 100) + '%';
  const fxSnap = () => ({
    c: cfg.fxContrast, s: cfg.fxSaturate, b: cfg.fxBrightness, hue: cfg.fxHue,
    sep: cfg.fxSepia, gray: cfg.fxGray, tint: cfg.fxTint, ta: cfg.fxTintA, vig: cfg.fxVig
  });
  function fxApply(v) {
    cfg.fxContrast = v.c; cfg.fxSaturate = v.s; cfg.fxBrightness = v.b; cfg.fxHue = v.hue;
    cfg.fxSepia = v.sep; cfg.fxGray = v.gray; cfg.fxTint = v.tint; cfg.fxTintA = v.ta; cfg.fxVig = v.vig;
  }
  function fxSet(k, v, rebuild) { cfg[k] = v; cfg.fxPreset = 'custom'; commit('fx', !!rebuild); }
  function presetVals(id) {
    if (String(id).startsWith('u:')) {
      const p = cfg.userPresets.find(q => 'u:' + q.name === id);
      return p && p.v;
    }
    return PRESETS[id];
  }
  function setPreset(id) {
    cfg.fxPreset = id;
    const v = presetVals(id);
    if (v) fxApply(v);
    commit('fx', true);
    peek();
  }
  function savePreset() {
    const n = prompt('Preset name');
    if (!n || !n.trim()) return;
    const name = n.trim().slice(0, 16);
    cfg.userPresets = cfg.userPresets.filter(p => p.name !== name);
    cfg.userPresets.push({ name, v: fxSnap() });
    cfg.fxPreset = 'u:' + name;
    commit('fx', true);
    toast('Preset saved');
  }
  function deletePreset() {
    const id = String(cfg.fxPreset);
    if (!id.startsWith('u:')) return;
    cfg.userPresets = cfg.userPresets.filter(p => 'u:' + p.name !== id);
    setPreset('off');
  }
  const presetOpts = () => PRESET_LIST.concat(cfg.userPresets.map(p => ['u:' + p.name, '' + p.name + ' (Mine)']), [['custom', 'Custom']]);
  function resetView() { cfg.viewX = 0; cfg.viewY = 0; cfg.viewZoom = 1; commit('view'); }

  function setUiScaleQuick(s) {
    cfg.uiScale = cl(s, 0.8, 2.5);
    cfg.btnGlobalScale = cl(s >= 1.5 ? Math.min(1.8, s * 0.9) : 1, 0.7, 2.2);
    commit('uiScale', true);
    toast('UI Scale set to ' + Math.round(cfg.uiScale * 100) + '%');
  }

  function cycleUiScale() {
    const steps = [1, 1.25, 1.5, 1.75, 2];
    let idx = steps.findIndex(x => Math.abs(x - cfg.uiScale) < 0.08);
    const next = steps[(idx + 1) % steps.length];
    setUiScaleQuick(next);
  }

  function macroItems() {
    const items = [
      { k: 'macroEnabled', type: 'switch', label: 'Enable macros', desc: 'Master switch. Zero-Freeze Hybrid Touch+Pointer Engine prevents stream input lockups.' },
      { k: 'freeDragBtns', type: 'switch', label: 'Direct Drag on Floating Buttons', desc: 'Drag Macro & Screenshot buttons directly on the game screen at any time without entering Edit mode.' },
      { k: 'quickHideBtns', type: 'switch', label: 'Temp hide floating buttons', desc: 'Quickly hides all macro buttons on screen without deleting them.' },
      { type: 'buttons', label: 'Position & Input Tools', desc: 'Move buttons on screen, auto-arrange into columns, or refresh stream input.', btns: [['Move Buttons', enterEdit, 'blue', 'move'], ['Auto-Arrange', autoArrangeAllButtons, 'alt', 'grid'], ['Unstick Input', () => unstickStreamInput(false), 'alt', 'shield']] },
      { k: 'macroInput', type: 'select', label: 'Input engine', desc: '“Hybrid Touch + Pointer” works on all GFN games & virtual controls without freezing.', opts: [['both', 'Hybrid Touch + Pointer (Recommended)'], ['touch', 'Pure Touch Events (iOS Native)'], ['pointer', 'Pure Pointer Events (Fixed W3C)'], ['mouse', 'Mouse + Click Events']] },
      { k: 'macroSmartPace', type: 'switch', label: 'Smart Adaptive Latency Pacing', desc: 'Automatically adjusts macro cadence if frame decode latency spikes so GFN input queue never overflows.' },
      { k: 'macroPauseMode', type: 'select', label: 'While I play', desc: '“Keep running” lets your joystick/touches and macros run concurrently.', opts: [['never', 'Keep running (Recommended)'], ['near', 'Pause near macro taps'], ['any', 'Pause on any touch']] },
      { k: 'macroPauseRadius', type: 'range', label: 'Pause radius', min: 20, max: 200, step: 5, fmt: v => v + ' px', show: () => cfg.macroPauseMode === 'near' },
      { k: 'macroPauseMs', type: 'range', label: 'Resume delay', min: 0, max: 3000, step: 50, fmt: v => (v / 1000).toFixed(2) + ' s', show: () => cfg.macroPauseMode !== 'never' },
      { k: 'macroMaxMin', type: 'range', label: 'Auto-stop after', min: 1, max: 60, step: 1, fmt: v => v + ' min' },
      { k: 'macroRipple', type: 'switch', label: 'Show tap indicator', desc: 'Subtle ring at every injected coordinate (auto-paused in Battery Saver).' },
      { type: 'select', label: 'Macro', desc: 'Select which active macro button to configure.', opts: () => cfg.macros.map(x => [x.id, x.name + (x.tplId ? ' [Rec]' : '')]), get: () => macroSel, set: v => { macroSel = v; rebuildUI(); if (editing) renderEdit(); } }
    ];
    const m = curMacro();
    if (m) {
      const chainOpts = () => [['', 'None']].concat(cfg.macros.filter(x => x.id !== m.id).map(x => [x.id, '→ ' + x.name]));
      items.push(
        { type: 'switch', label: 'Show button in game', get: () => m.on, set: v => { m.on = v; commit('macros', true); } },
        { type: 'select', label: 'Trigger', opts: [['toggle', 'Tap to start / stop'], ['hold', 'Run while holding'], ['once', 'Run once per tap']], get: () => m.mode, set: v => { m.mode = v; commit('macros', true); } },
        { type: 'select', label: 'Chain next macro', desc: 'Automatically trigger another macro right after this one finishes.', opts: chainOpts, get: () => m.chainId || '', set: v => { m.chainId = v; commit('macro'); } },
        { type: 'range', label: 'Playback speed', desc: '1.0× = exact recorded speed. Increase up to 2.5× for faster combos/looting.', min: 0.5, max: 2.5, step: 0.1, fmt: v => v.toFixed(1) + '×', get: () => m.speed || 1, set: v => { m.speed = v; commit('macro'); } },
        { type: 'range', label: 'Repeat', desc: 'Number of loop cycles (0 = infinite).', min: 0, max: 100, step: 1, fmt: v => (v ? v + '×' : 'Forever'), get: () => m.loops, set: v => { m.loops = v; commit('macro'); }, show: () => m.mode !== 'once' },
        { type: 'range', label: 'Pause between loops (min 20ms)', desc: 'Set to 20ms for maximum speed item looting.', min: 20, max: 2000, step: 5, fmt: v => v + ' ms', get: () => m.interval, set: v => { m.interval = v; commit('macro'); }, show: () => m.mode !== 'once' },
        { type: 'range', label: 'Start delay', min: 0, max: 3000, step: 20, fmt: v => v + ' ms', get: () => m.delay, set: v => { m.delay = v; commit('macro'); } },
        { type: 'range', label: 'Button size', min: 0.6, max: 1.8, step: 0.05, fmt: v => v.toFixed(2) + '×', get: () => m.size, set: v => { m.size = v; commit('macro'); } },
        { type: 'range', label: 'Button opacity', min: 0.2, max: 1, step: 0.05, fmt: pct, get: () => m.opacity, set: v => { m.opacity = v; commit('macro'); } },
        { type: 'switch', label: 'Show name on button', get: () => m.label, set: v => { m.label = v; commit('macro'); } },
        { type: 'buttons', label: 'Manage', btns: [['Rename', () => renameMacro(m), 'alt', 'edit'], ['Duplicate', () => dupMacro(m), 'alt', 'copy'], ['Delete', () => delMacro(m.id), 'danger', 'trash']] },
        { type: 'buttons', only: 'game', label: 'Layout & Test', desc: 'Drag taps, zones, swipes, circles, screenshot & macro buttons on screen.', btns: [['Edit on screen', enterEdit, 'blue', 'move'], ['Test once', () => runMacro(m, true), 'alt', 'play']] },
        { type: 'buttons', only: 'game', label: 'Add Basic Steps', desc: 'Tap/Hold, Rapid Burst, Swipe, or Wait.', btns: [['Tap/Hold', () => addStepTo(m, 'tap'), 'alt', 'plus'], ['Burst', () => addStepTo(m, 'burst'), 'alt', 'burst'], ['Swipe', () => addStepTo(m, 'swipe'), 'alt', 'swipe'], ['Wait', () => addStepTo(m, 'wait'), 'alt', 'wait']] },
        { type: 'buttons', only: 'game', label: 'Add Pro Steps', desc: 'Multi-Touch (2 fingers), 360° Circle, Elastic Dash Flick, or Grid Zone.', btns: [['2-Finger', () => addStepTo(m, 'multi'), 'alt', 'multi'], ['360° Circle', () => addStepTo(m, 'circle'), 'alt', 'circle'], ['Elastic Dash', () => addStepTo(m, 'elastic'), 'alt', 'elastic'], ['Dialog Bar', () => addStepTo(m, 'bar'), 'alt', 'bar'], ['Grid Zone', () => addStepTo(m, 'zone'), 'alt', 'zone']] }
      );
      m.steps.forEach((s, i) => items.push({ type: 'step', only: 'game', m, i }));
    }
    items.push(
      { type: 'select', label: 'New macro from template', opts: getTplOptions, get: () => tplSel, set: v => { tplSel = v; } },
      { type: 'buttons', label: 'Add or share', btns: [['Add', () => addMacro(tplSel), '', 'plus'], ['Export', exportMacros, 'alt', 'download'], ['Import', importMacros, 'alt', 'upload']] }
    );
    return items;
  }

  function recorderItems() {
    const items = [
      {
        k: 'recCountdown',
        type: 'switch',
        label: '3-second countdown before recording',
        desc: 'Gives you 3 seconds to position your fingers on the game screen before capture begins.'
      },
      {
        k: 'recAutoBtn',
        type: 'switch',
        label: 'Auto-place button on screen when saved',
        desc: 'Automatically places the recorded macro in a free non-overlapping slot on screen.'
      },
      {
        type: 'buttons',
        only: 'game',
        label: '1:1 Active-Hold Recorder',
        desc: 'Captures taps, stationary long holds (charged attacks/skills), and multi-finger swipes with 30Hz hold keepalive.',
        btns: [['Start Recording', startRecording, '', 'rec'], ['Arrange Buttons', autoArrangeAllButtons, 'alt', 'grid']]
      },
      {
        type: 'buttons',
        label: 'Template Library',
        desc: cfg.customTemplates.length
          ? cfg.customTemplates.length + ' saved template(s). Use "Show/Hide on Screen" below to control buttons without duplicates.'
          : 'No recorded templates yet. Start a recording in game or import JSON.',
        btns: [
          ['Export All', () => exportTemplates(null), 'alt', 'download'],
          ['Import JSON', importTemplates, 'alt', 'upload']
        ]
      }
    ];
    cfg.customTemplates.forEach(tpl => {
      items.push({ type: 'tplCard', tpl });
    });
    return items;
  }

  function schema() {
    const tintOpts = [
      ['none', 'None'],
      ['amber', 'Warm Amber'],
      ['gold', 'Golden Hour'],
      ['sakura', 'Sakura Rose'],
      ['aqua', 'Crystal Aqua'],
      ['ice', 'Arctic Ice'],
      ['cyber', 'Cyber Neon Violet'],
      ['emerald', 'Mythic Emerald'],
      ['teal', 'Cinema Teal'],
      ['crimson', 'Crimson Abyss'],
      ['warm', 'Warm Classic'],
      ['cool', 'Cool Blue'],
      ['rose', 'Soft Rose'],
      ['mint', 'Fresh Mint'],
      ['violet', 'Deep Violet']
    ];
    return [
      { id: 'gen', title: 'General', items: [
        { type: 'buttons', label: 'Quick UI Scale (For 50% PWA Zoom)', desc: 'Instantly scale Panel, HUD & Toolbars to 100%, 150%, or 200% if you lowered Safari/PWA zoom.', btns: [['100%', () => setUiScaleQuick(1), 'alt', 'zoom'], ['150%', () => setUiScaleQuick(1.5), 'blue', 'zoom'], ['200%', () => setUiScaleQuick(2), 'blue', 'zoom']] },
        { k: 'uiScale', type: 'range', label: 'Panel & HUD Scale (80% – 250%)', desc: 'Scales the menu, HUD, and toolbars while keeping the panel 100% inside the screen bounds.', min: 0.8, max: 2.5, step: 0.05, fmt: pct },
        { k: 'btnGlobalScale', type: 'range', label: 'Floating Buttons Scale (70% – 220%)', desc: 'Scales all floating Macro, Screenshot, and Quick-Ball buttons together.', min: 0.7, max: 2.2, step: 0.05, fmt: pct },
        { k: 'fixGfnScroll', type: 'switch', label: 'Fix GFN Settings & Menu Scroll', desc: 'Unlocks touch scrolling on GFN Lobby Settings & In-Stream ⋮ menu so they never get cut off at 100% scale.' },
        { k: 'sessionTimer', type: 'switch', label: '1-Hour Session Countdown Timer', desc: 'Tracks your GFN session limit from stream start and warns you at 10m, 5m, and 1m left.' },
        { k: 'sessionLimitMin', type: 'select', label: 'Session tier duration', opts: [['30', '30 minutes'], ['60', '1 Hour (Free Tier 60m)'], ['120', '2 Hours (120m)'], ['360', '6 Hours (Priority 360m)']], get: () => String(cfg.sessionLimitMin), set: v => { cfg.sessionLimitMin = +v; commit('sessionTimer'); }, show: () => cfg.sessionTimer },
        { type: 'buttons', label: 'Session & Stream Tools', desc: 'Reset the 1h countdown timer, pop stream into Picture-in-Picture (PiP), or move buttons.', btns: [['Reset 1h Timer', () => resetSessionTimer(true), 'alt', 'reset'], ['Float PiP', togglePiP, 'alt', 'pip'], ['Move Buttons', enterEdit, 'blue', 'move']] },
        { k: 'batterySaver', type: 'switch', label: 'Battery Saver Mode (Eco & Cool)', desc: 'Reduces iOS heat & battery drain: removes GPU blur effects, caps WebGL shader resolution/FPS, and skips DOM ripples.' },
        { k: 'inputGuard', type: 'switch', label: 'Stream Input Watchdog (Zero-Freeze)', desc: 'Prevents ghost touches and flushes stuck pointers automatically.' },
        { k: 'silent', type: 'switch', label: 'Silent mode (Background / PiP)', desc: 'Mutes GFN audio to yield playback rights to YouTube/PiP. Turning off auto-resumes WebKit audio on next touch.' },
        { k: 'audioBoost', type: 'range', label: 'WebAudio Volume Booster', desc: 'Amplifies quiet GFN game stream audio up to 250% via WebKit GainNode.', min: 1, max: 2.5, step: 0.1, fmt: pct },
        { k: 'afkGuard', type: 'switch', label: 'Anti-AFK Guard (Prevent Kick)', desc: 'Automatically sends a subtle micro-input when idle for 3.5+ minutes so GFN does not disconnect your session.' },
        { k: 'quickBall', type: 'switch', label: 'Floating Quick-Menu Ball', desc: 'Draggable Light Mode pill on screen edge (tap to open menu, double-tap to Unstick Input).' },
        { k: 'oledDim', type: 'range', label: 'OLED Night Dimmer (Power Save)', desc: 'Dims the stream below iOS minimum brightness to save OLED battery during AFK farming or night play.', min: 0, max: 0.75, step: 0.05, fmt: v => (v ? pct(v) : 'Off') }
      ] },
      { id: 'hud', title: 'HUD & Aim', items: [
        { k: 'hudOn', type: 'switch', label: 'Real-time Telemetry & Graphs HUD', desc: 'Displays Ping, FPS, Input Latency (ms), 1h Countdown, and 3 live graphs. Drag the HUD box directly on screen!' },
        { k: 'hudDetail', type: 'select', label: 'HUD Mode', opts: [['graphs', '3 Live Graphs (FPS + Ping ms + Input Lag ms)'], ['full', 'Detailed Text Metrics'], ['mini', 'Compact Pill']] },
        { k: 'hudPos', type: 'select', label: 'Corner Snap Position', opts: [['tl', 'Top left'], ['tr', 'Top right'], ['bl', 'Bottom left'], ['br', 'Bottom right']], set: v => { cfg.hudCustomPos = null; set('hudPos', v); } },
        { k: 'hudOpacity', type: 'range', label: 'HUD opacity', min: 0.3, max: 1, step: 0.05, fmt: pct },
        { k: 'gyroAim', type: 'switch', label: 'Gyro Motion Aim (Tilt-to-Aim)', desc: 'Uses iPhone/iPad gyroscope to turn subtle device tilting into smooth camera aiming on the right side of the screen.' },
        { k: 'gyroSens', type: 'range', label: 'Gyro Aim sensitivity', min: 0.4, max: 5.0, step: 0.1, fmt: v => v.toFixed(1) + 'x', show: () => cfg.gyroAim },
        { k: 'gyroSmoothing', type: 'range', label: 'Gyro Aim Smoothing Filter', desc: 'Higher values remove hand micro-jitter and frame stutter for silky smooth aiming.', min: 0.2, max: 0.95, step: 0.05, fmt: pct, show: () => cfg.gyroAim },
        { k: 'gyroDeadzone', type: 'range', label: 'Gyro Aim Deadzone', desc: 'Ignores tiny involuntary hand tremors.', min: 0.05, max: 0.50, step: 0.05, fmt: v => v.toFixed(2) + ' deg', show: () => cfg.gyroAim },
        { k: 'gyroInvert', type: 'switch', label: 'Invert Vertical Pitch (Y-Axis)', show: () => cfg.gyroAim },
        { k: 'crosshair', type: 'select', label: 'Custom Crosshair (Aim)', desc: 'Lightweight SVG reticle for bow/shooter aiming.', opts: [['off', 'Off'], ['dot', 'Center Dot'], ['cross', 'Precision Cross'], ['circle', 'Circle + Dot'], ['tcross', 'Tactical T-Cross']] },
        { k: 'crosshairSize', type: 'range', label: 'Crosshair size', min: 8, max: 32, step: 1, fmt: v => v + ' px', show: () => cfg.crosshair !== 'off' },
        { k: 'crosshairColor', type: 'select', label: 'Crosshair color', opts: [['#007aff', 'iOS Blue'], ['#34c759', 'Vibrant Green'], ['#ff3b30', 'Crimson Red'], ['#ffcc00', 'Amber Gold'], ['#ffffff', 'Pure White']], show: () => cfg.crosshair !== 'off' },
        { k: 'crosshairX', type: 'range', label: 'Crosshair X (%)', min: 30, max: 70, step: 0.5, fmt: v => v + '%', show: () => cfg.crosshair !== 'off' },
        { k: 'crosshairY', type: 'range', label: 'Crosshair Y (%)', min: 30, max: 70, step: 0.5, fmt: v => v + '%', show: () => cfg.crosshair !== 'off' }
      ] },
      { id: 'pic', title: 'Picture', items: [
        { type: 'filterChips', only: 'game' },
        { k: 'fxPreset', type: 'select', label: 'Studio Filter Preset (24 Styles)', desc: 'Hand-tuned presets for Genshin, WuWa, HSR, Wukong, Cyberpunk, OLED & Cinema.', opts: presetOpts, set: setPreset },
        { k: 'sharpen', type: 'range', label: 'Live Stream Sharpening (WebGL CAS)', desc: 'Real-time GPU Contrast Adaptive Sharpening to make the live game stream crystal clear.', min: 0, max: 1, step: 0.05, fmt: v => (v ? pct(v) : 'Off') },
        { k: 'sharpenEco', type: 'switch', label: 'Sharpen Eco Mode (Cooler iPhone)', desc: 'Caps sharpen pass resolution & frame rate to save battery and prevent iOS thermal dimming.', show: () => cfg.sharpen > 0 },
        { k: 'fxContrast', type: 'range', label: 'Contrast', min: 0.7, max: 1.5, step: 0.01, fmt: v => v.toFixed(2), set: v => fxSet('fxContrast', v) },
        { k: 'fxSaturate', type: 'range', label: 'Saturation / Vibrance', min: 0, max: 1.9, step: 0.01, fmt: v => v.toFixed(2), set: v => fxSet('fxSaturate', v) },
        { k: 'fxBrightness', type: 'range', label: 'Brightness / Gamma Lift', min: 0.7, max: 1.4, step: 0.01, fmt: v => v.toFixed(2), set: v => fxSet('fxBrightness', v) },
        { k: 'fxHue', type: 'range', label: 'Hue shift', min: -180, max: 180, step: 1, fmt: v => v + '°', set: v => fxSet('fxHue', v) },
        { k: 'fxTint', type: 'select', label: 'Color Grading Tint (14 Tones)', opts: tintOpts, set: v => fxSet('fxTint', v, true) },
        { k: 'fxTintA', type: 'range', label: 'Tint strength', min: 0.02, max: 0.4, step: 0.01, fmt: v => Math.round(v * 100) + '%', set: v => fxSet('fxTintA', v), show: () => cfg.fxTint !== 'none' },
        { k: 'fxVig', type: 'range', label: 'Cinema Vignette', min: 0, max: 0.8, step: 0.05, fmt: v => (v ? pct(v) : 'Off'), set: v => fxSet('fxVig', v) },
        { k: 'fxSepia', type: 'range', label: 'Vintage Warmth (Sepia)', min: 0, max: 1, step: 0.05, fmt: pct, set: v => fxSet('fxSepia', v) },
        { k: 'fxGray', type: 'range', label: 'Monochrome (Grayscale)', min: 0, max: 1, step: 0.05, fmt: pct, set: v => fxSet('fxGray', v) },
        { type: 'buttons', label: 'Custom Presets', btns: [['Save Current', savePreset, 'alt', 'save'], ['Reset Off', () => setPreset('off'), 'alt', 'reset']] },
        { type: 'button', label: 'Delete this custom preset', btn: 'Delete', icon: 'trash', cls: 'danger', run: deletePreset, show: () => String(cfg.fxPreset).startsWith('u:') }
      ] },
      { id: 'scr', title: 'Screen', items: [
        { k: 'viewZoom', type: 'range', label: 'Stream zoom', desc: 'Native WebKit resolution is preserved for handshake stability.', min: 1, max: 2, step: 0.01, fmt: v => v.toFixed(2) + '×' },
        { k: 'viewX', type: 'range', label: 'Stream offset X', min: -30, max: 30, step: 1, fmt: v => v + '%' },
        { k: 'viewY', type: 'range', label: 'Stream offset Y', min: -30, max: 30, step: 1, fmt: v => v + '%' },
        { type: 'button', label: 'Reset stream position', btn: 'Reset', icon: 'reset', cls: 'alt', run: resetView }
      ] },
      { id: 'shot', title: 'Screenshot', items: [
        { k: 'shotBtn', type: 'switch', label: 'Floating screenshot button', desc: 'Drag the camera button directly anywhere on screen, or tap it to capture.' },
        { k: 'shotScale', type: 'select', label: 'Super-Resolution Upscale (2K)', desc: 'Upscales 720p/1080p stream frames on the GPU up to 2560×1440 2K.', opts: [['1', '1.0× (Native Stream)'], ['1.5', '1.5× (HD+ 1080p/1440p)'], ['2', '2.0× (Ultra-Crisp 2K QHD)']] },
        { k: 'shotSharpness', type: 'range', label: 'Photo Sharpness & Clarity Boost', desc: 'Controls the 9-Tap Dual-Radius Unsharp Mask & H.264 de-blurring strength on captured photos.', min: 0, max: 2.5, step: 0.05, fmt: pct },
        { k: 'shotApplyFx', type: 'switch', label: 'Bake active Picture Filters & Tints', desc: 'Bakes all 24 Studio Filters (Contrast, Saturation, Brightness, Hue, Tint, Vignette) into the photo.' },
        { k: 'shotSharpen', type: 'switch', label: 'Enable 9-Tap GPU Photo Clarifier', desc: 'Reconstructs fine hair, foliage, and UI edges so screenshots never look blurry.' },
        { k: 'shotFormat', type: 'select', label: 'Format', opts: [['png', 'PNG (Lossless Ultra HD)'], ['jpeg', 'JPEG (98% Studio Quality)']] },
        { k: 'shotShare', type: 'switch', label: 'Use iOS share sheet', desc: 'Opens native iOS Share Sheet to Save Image directly to Photos.' },
        { type: 'buttons', only: 'game', label: 'Capture & Button Position', btns: [['Capture 2K HD Now', () => setTimeout(screenshot, 150), 'blue', 'camera'], ['Move Button', enterEdit, 'alt', 'move']] }
      ] },
      { id: 'mac', title: 'Macros', items: macroItems() },
      { id: 'rec', title: 'Recorder', items: recorderItems() }
    ];
  }

  /* ================= lobby: Settings > System ================= */
  function nativeRow(ref, it) {
    const row = ref.cloneNode(true);
    row.removeAttribute('id');
    row.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
    const hl = row.querySelector('.headline');
    if (hl) hl.textContent = it.label;
    const d = row.querySelector('.font-body2');
    if (d) { if (it.desc) d.textContent = it.desc; else (d.closest('ul') || d).remove(); }
    const trail = row.querySelector('.trail-container');
    if (it.type === 'switch') {
      const b = row.querySelector('button[role="switch"]');
      if (b) {
        b.setAttribute('aria-label', it.label);
        b.dataset.sx = '1';
        b._sxSync = () => {
          const on = !!getv(it);
          b.setAttribute('aria-checked', String(on));
          b.className = 'mdc-switch ' + (on ? 'mdc-switch--selected' : 'mdc-switch--unselected');
        };
        b.addEventListener('click', e => { e.stopPropagation(); setv(it, !getv(it)); });
        b._sxSync();
        return row;
      }
    }
    const c = ctlFor(it);
    if (trail) { trail.className = 'trail-container sx-trail'; trail.replaceChildren(c); } else row.append(c);
    return row;
  }

  function findLobbyAnchor() {
    const byId = document.getElementById('settings_network_indicator');
    if (byId) return byId;
    const headlines = document.querySelectorAll('.grid .headline');
    for (const hl of headlines) {
      if (/network connection status/i.test(hl.textContent || '')) {
        return hl.closest('.grid > div') || hl.parentElement;
      }
    }
    return null;
  }

  function injectLobby(ref) {
    if (document.getElementById('sx-section')) return;
    const grid = ref.closest('.grid');
    if (!grid) return;
    const prev = grid.previousElementSibling;
    const divider = prev && prev.classList.contains('grid-divider') ? prev : null;
    const sec = h('div');
    sec.id = 'sx-section';
    schema().forEach(g => {
      const items = g.items.filter(i => i.only !== 'game' && i.type !== 'step' && i.type !== 'tplCard' && i.type !== 'filterChips' && (!i.show || i.show()));
      if (!items.length) return;
      if (divider) sec.append(divider.cloneNode(true));
      const ng = h('div');
      ng.className = grid.className;
      Array.from(grid.attributes).forEach(a => ng.setAttribute(a.name, a.value));
      ng.removeAttribute('id');
      ng.append(h('div', 'sx-ghead', g.id === 'gen' ? 'Nvirya GeForce NOW (v3.4)' : g.title));
      items.forEach(i => ng.append(nativeRow(ref, i)));
      sec.append(ng);
    });
    grid.insertAdjacentElement('afterend', sec);
  }

  function rebuildUI() {
    const old = document.getElementById('sx-section');
    if (old) old.remove();
    if (panel && panel.classList.contains('open')) renderPanel();
    scheduleScan();
  }

  /* ================= in-game: menu entry + panel ================= */
  function closeMenu() {
    const bd = document.querySelector('.cdk-overlay-backdrop');
    if (bd) bd.click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
  }
  function injectMenu() {
    const content = document.querySelector('.streamer-osc-drop-down-panel .mat-mdc-menu-content');
    if (!content || content.querySelector('[data-sx-menu]')) return;
    const btns = Array.from(content.children).filter(e => e.tagName === 'BUTTON');
    const tpl = btns.find(b => /feedback/i.test(b.textContent)) || btns[0];
    if (!tpl) return;
    const quit = btns.find(b => /quit/i.test(b.textContent));
    [
      ['Nvirya GFN (' + Math.round(cfg.uiScale * 100) + '%)', 'sliders', () => openPanel()],
      ['UI Scale: ' + Math.round(cfg.uiScale * 100) + '% (Tap to 150%/200%)', 'zoom', () => cycleUiScale()],
      ['Move / Drag Buttons', 'move', () => enterEdit()],
      ['Macro Recorder', 'rec', () => openPanel('rec')],
      ['Unstick Stream Input', 'shield', () => unstickStreamInput(false)],
      ['Ultra-Crisp 2K Screenshot', 'camera', () => screenshot()],
      [cfg.hudOn ? '3-Graph Stats HUD: ON' : '3-Graph Stats HUD: OFF', 'gauge', () => set('hudOn', !cfg.hudOn)]
    ].forEach(([label, icon, fn]) => {
      const b = tpl.cloneNode(true);
      b.dataset.sxMenu = '1';
      b.removeAttribute('id');
      b.classList.remove('cdk-focused', 'cdk-touch-focused', 'cdk-keyboard-focused');
      const t = b.querySelector('.mat-mdc-menu-item-text > span') || b.querySelector('.mat-mdc-menu-item-text');
      if (t) t.textContent = label;
      const ic = b.querySelector('mat-icon');
      if (ic) ic.replaceChildren(ico(icon, 24));
      b.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        setTimeout(fn, 200);
      });
      if (quit) content.insertBefore(b, quit); else content.append(b);
    });
  }

  let panelTab = 'gen', peekT = 0, savedTabScrollLeft = 0;
  function peek() {
    if (!panel || !panel.classList.contains('open')) return;
    panel.classList.add('peek');
    clearTimeout(peekT);
    peekT = setTimeout(() => panel.classList.remove('peek'), 700);
  }
  function openPanel(tab) {
    ensureRoot();
    if (tab) panelTab = tab;
    renderPanel(true, !!tab);
    panel.classList.add('open');
  }
  function closePanel() { if (panel) panel.classList.remove('open', 'peek'); }

  function mkFilterChipsGallery() {
    const wrap = h('div', 'sx-fchips');
    PRESET_LIST.forEach(([id, label]) => {
      const chip = h('button', 'sx-fchip' + (cfg.fxPreset === id ? ' on' : ''), label);
      chip.type = 'button';
      chip.onclick = () => setPreset(id);
      wrap.append(chip);
    });
    return wrap;
  }

  function renderPanel(resetScroll, scrollActiveIntoView) {
    const S = schema().map(g => Object.assign({}, g, { items: g.items.filter(i => !i.show || i.show()) })).filter(g => g.items.length);
    if (!S.find(g => g.id === panelTab)) panelTab = S[0].id;
    const oldBody = panel.querySelector('.sx-pb');
    const oldTabs = panel.querySelector('.sx-tabs');
    const top = !resetScroll && oldBody ? oldBody.scrollTop : 0;
    if (oldTabs) savedTabScrollLeft = oldTabs.scrollLeft;

    panel.replaceChildren();
    const head = h('div', 'sx-ph');
    const tWrap = h('div', 'sx-pt-wrap');
    tWrap.append(h('div', 'sx-pt', 'Nvirya GFN'), h('span', 'sx-pv', 'v3.4'));

    // 1-Tap UI Scale Cycle Badge right in the Panel Header (100% -> 125% -> 150% -> 175% -> 200%)
    panelScaleBtn = h('button', 'sx-pscale', 'Scale: ' + Math.round(cfg.uiScale * 100) + '%');
    panelScaleBtn.type = 'button';
    panelScaleBtn.title = 'Tap to cycle UI Scale (100% / 125% / 150% / 175% / 200%)';
    panelScaleBtn.onclick = cycleUiScale;
    tWrap.append(panelScaleBtn);

    panelTimerEl = h('button', 'sx-ptimer', '60:00');
    panelTimerEl.type = 'button';
    panelTimerEl.title = 'Tap to reset 1-hour session countdown';
    panelTimerEl.onclick = () => resetSessionTimer(true);
    tWrap.append(panelTimerEl);
    updateSessionTimerUI();

    const x = h('button', 'sx-ib');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    x.append(ico('close', 17));
    x.onclick = closePanel;
    head.append(tWrap, x);

    const tabs = h('div', 'sx-tabs');
    tabs.addEventListener('scroll', () => { savedTabScrollLeft = tabs.scrollLeft; }, { passive: true });
    let activeTabEl = null;
    S.forEach(g => {
      const isAct = g.id === panelTab;
      const b = h('button', 'sx-tab' + (isAct ? ' on' : ''), g.title);
      b.type = 'button';
      if (isAct) activeTabEl = b;
      b.onclick = () => {
        savedTabScrollLeft = tabs.scrollLeft;
        panelTab = g.id;
        renderPanel(true, true);
      };
      tabs.append(b);
    });

    const body = h('div', 'sx-pb');
    S.find(g => g.id === panelTab).items.forEach(it => {
      if (it.type === 'filterChips') { body.append(mkFilterChipsGallery()); return; }
      if (it.type === 'step') { body.append(mkStep(it.m, it.i)); return; }
      if (it.type === 'tplCard') { body.append(mkTplCard(it.tpl)); return; }
      const row = h('div', 'sx-row' + (it.type === 'range' ? ' rng' : ''));
      const l = h('div', 'sx-rl');
      l.append(h('div', 'sx-rt', it.label));
      if (it.desc) l.append(h('div', 'sx-rd', it.desc));
      const c = h('div', 'sx-rc');
      c.append(ctlFor(it));
      row.append(l, c);
      body.append(row);
    });

    panel.append(head, tabs, body);
    body.scrollTop = top;
    tabs.scrollLeft = savedTabScrollLeft;
    if (scrollActiveIntoView && activeTabEl) {
      requestAnimationFrame(() => {
        const s = cl(nv(cfg.uiScale, 1), 0.8, 2.5);
        const tRect = tabs.getBoundingClientRect();
        const bRect = activeTabEl.getBoundingClientRect();
        if (bRect.right > tRect.right) {
          tabs.scrollLeft += (bRect.right - tRect.right) / s + 12;
        } else if (bRect.left < tRect.left) {
          tabs.scrollLeft -= (tRect.left - bRect.left) / s + 12;
        }
        savedTabScrollLeft = tabs.scrollLeft;
      });
    }
  }

  /* ================= overlay root: 3-Graph HUD, macro buttons, edit mode, recorder overlay ================= */
  let root, fxEl, xhairEl, panel, preview, flashEl, toastEl, mLayer, editLayer, barEl, stopBtn, shotEl, qBallEl, recEl, recTimeEl, recCntEl, cdEl, cdNumEl;
  function buildRoot() {
    root = h('div'); root.id = 'sx-root';
    fxEl = h('div'); fxEl.id = 'sx-fx';
    xhairEl = h('div'); xhairEl.id = 'sx-xhair';

    hud = h('div'); hud.id = 'sx-hud';
    const hudTop = h('div', 'sx-hud-top');
    hudTimerEl = h('span', 'sx-hud-timer', '60:00');
    hudPing = h('span', null, '--ms');
    hudRest = document.createTextNode(' · 0 fps · 0.0 Mbps');
    hudTop.append(hudTimerEl, hudPing, hudRest);

    hudSub = h('div', 'sx-hud-sub');
    hudChartsWrap = h('div'); hudChartsWrap.id = 'sx-hud-charts';

    const mkGraphBox = (title) => {
      const box = h('div', 'sx-gbox');
      const lbl = h('div', 'sx-glbl');
      const sp = h('span', null, title);
      const val = h('b', null, '--');
      lbl.append(sp, val);
      const cv = document.createElement('canvas');
      cv.className = 'sx-gcv';
      box.append(lbl, cv);
      return { box, val, cv };
    };
    const g1 = mkGraphBox('FPS');
    const g2 = mkGraphBox('PING');
    const g3 = mkGraphBox('LAG');
    cvFps = g1.cv; lblFpsVal = g1.val;
    cvPing = g2.cv; lblPingVal = g2.val;
    cvLag = g3.cv; lblLagVal = g3.val;
    hudChartsWrap.append(g1.box, g2.box, g3.box);
    hud.append(hudTop, hudSub, hudChartsWrap);

    dragify(
      hud,
      () => {
        const r = hud.getBoundingClientRect();
        return {
          x: cfg.hudCustomPos ? cfg.hudCustomPos.x : (r.left / Math.max(1, window.innerWidth) * 100),
          y: cfg.hudCustomPos ? cfg.hudCustomPos.y : (r.top / Math.max(1, window.innerHeight) * 100)
        };
      },
      (o, dx, dy) => {
        cfg.hudCustomPos = {
          x: cl(o.x + dx, 1, 90),
          y: cl(o.y + dy, 1, 90)
        };
        hud.removeAttribute('data-pos');
        hud.style.left = cfg.hudCustomPos.x + '%';
        hud.style.top = cfg.hudCustomPos.y + '%';
        hud.style.right = '';
        hud.style.bottom = '';
      },
      moved => {
        if (moved) save();
        else {
          const order = ['graphs', 'full', 'mini'];
          const next = order[(order.indexOf(cfg.hudDetail) + 1) % order.length];
          set('hudDetail', next);
        }
      }
    );

    editLayer = h('div'); editLayer.id = 'sx-edit';
    mLayer = h('div'); mLayer.id = 'sx-m';
    barEl = h('div'); barEl.id = 'sx-bar';

    recEl = h('div'); recEl.id = 'sx-rec';
    const recBar = h('div'); recBar.id = 'sx-rec-bar';
    const recDot = h('div', 'sx-rec-dot');
    recTimeEl = h('span', 'sx-rec-time', '00:00.0');
    recCntEl = h('span', 'sx-rec-cnt', '0 act');
    const recSaveBtn = btn('Stop & Save', 'check', '');
    recSaveBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); stopAndSaveRecording(); });
    const recCancelBtn = h('button', 'sx-ib danger');
    recCancelBtn.type = 'button';
    recCancelBtn.title = 'Cancel recording';
    recCancelBtn.append(ico('close', 16));
    recCancelBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); cancelRecording(); });
    recBar.append(recDot, recTimeEl, recCntEl, recSaveBtn, recCancelBtn);

    cdEl = h('div'); cdEl.id = 'sx-cd';
    cdNumEl = h('b', null, '3');
    cdEl.append(cdNumEl, h('span', null, 'Get ready...'));
    recEl.append(recBar, cdEl);

    stopBtn = h('button'); stopBtn.id = 'sx-stop'; stopBtn.type = 'button';
    stopBtn.append(ico('stop', 14), document.createTextNode('Stop macros'));
    stopBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); stopAll(); });

    panel = h('div'); panel.id = 'sx-panel';
    preview = h('div'); preview.id = 'sx-preview';
    flashEl = h('div'); flashEl.id = 'sx-flash';
    toastEl = h('div'); toastEl.id = 'sx-toast';

    shotEl = h('button', 'sx-shot');
    shotEl.type = 'button';
    shotEl.setAttribute('aria-label', 'HD Screenshot (Drag to move)');
    shotEl.append(ico('camera', 22));
    dragify(
      shotEl,
      () => ({ x: cfg.shotBtnPos.x, y: cfg.shotBtnPos.y }),
      (o, dx, dy) => {
        cfg.shotBtnPos.x = cl(o.x + dx, 3, 97);
        cfg.shotBtnPos.y = cl(o.y + dy, 5, 95);
        place(shotEl, cfg.shotBtnPos);
      },
      moved => {
        if (moved) {
          save();
        } else if (!editing) {
          screenshot();
        }
      }
    );

    let lastQbTap = 0;
    qBallEl = h('button');
    qBallEl.id = 'sx-qball';
    qBallEl.type = 'button';
    qBallEl.setAttribute('aria-label', 'Open Nvirya Menu');
    qBallEl.append(ico('sliders', 18));
    dragify(
      qBallEl,
      () => ({ x: cfg.quickBallPos.x, y: cfg.quickBallPos.y }),
      (o, dx, dy) => {
        cfg.quickBallPos.x = cl(o.x + dx, 3, 97);
        cfg.quickBallPos.y = cl(o.y + dy, 5, 95);
        place(qBallEl, cfg.quickBallPos);
      },
      moved => {
        save();
        if (!moved) {
          const now = Date.now();
          if (now - lastQbTap < 320) {
            stopAll();
            unstickStreamInput(false);
            lastQbTap = 0;
          } else {
            lastQbTap = now;
            if (panel.classList.contains('open')) closePanel();
            else openPanel();
          }
        }
      }
    );

    mLayer.append(shotEl, qBallEl);

    root.append(xhairEl, hud, editLayer, mLayer, barEl, stopBtn, recEl, panel, preview, flashEl, toastEl);
    ['pointerdown', 'touchstart', 'mousedown', 'click'].forEach(t => {
      root.addEventListener(t, e => e.stopPropagation());
    });
    guard(applyDyn, 'dyn');
  }

  function ensureRoot() {
    if (!root) buildRoot();
    const host = document.fullscreenElement || document.webkitFullscreenElement || document.body;
    if (host && (root.parentNode !== host || !root.isConnected)) {
      host.appendChild(fxEl);
      host.appendChild(root);
    }
  }
  function toast(msg, ms) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => toastEl.classList.remove('on'), ms || 2200);
  }
  const place = (el, p) => { el.style.left = p.x + '%'; el.style.top = p.y + '%'; };

  function dragify(el, start, move, end) {
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', e => {
      const s = start();
      if (!s) return;
      e.preventDefault();
      e.stopPropagation();
      el.blur();
      const x0 = e.clientX, y0 = e.clientY;
      let moved = false;
      const mv = ev => {
        const dx = ev.clientX - x0, dy = ev.clientY - y0;
        if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
        if (moved) move(s, dx / window.innerWidth * 100, dy / window.innerHeight * 100);
      };
      const up = () => {
        window.removeEventListener('pointermove', mv, true);
        window.removeEventListener('pointerup', up, true);
        window.removeEventListener('pointercancel', up, true);
        if (end) end(moved);
      };
      window.addEventListener('pointermove', mv, true);
      window.addEventListener('pointerup', up, true);
      window.addEventListener('pointercancel', up, true);
    });
  }

  function updateOverlay() {
    if (!root) return;
    const st = streaming();
    const hideAllFloat = cfg.quickHideBtns || recState.on || recState.countingDown;
    shotEl.style.display = st && (cfg.shotBtn || editing) && (!hideAllFloat || editing) ? 'flex' : 'none';
    shotEl.classList.toggle('edit-ring', editing);
    place(shotEl, cfg.shotBtnPos);
    qBallEl.style.display = st && cfg.quickBall && !recState.on && !recState.countingDown ? 'flex' : 'none';
    qBallEl.classList.toggle('eco-on', !!cfg.batterySaver);
    place(qBallEl, cfg.quickBallPos);
    if (!st && editing) { editing = false; renderEdit(); }
    if (!st && (recState.on || recState.countingDown)) cancelRecording();
    if (!cfg.macroEnabled) stopAll();
    updateFxOverlay();
    updateCrosshair();
    renderMacros();
    markRunning();
  }

  function renderMacros() {
    Array.from(mLayer.querySelectorAll('.sx-mbtn')).forEach(b => b.remove());
    if (!streaming() || !(cfg.macroEnabled || editing)) return;
    if ((cfg.quickHideBtns || recState.on || recState.countingDown) && !editing) return;
    cfg.macros.forEach(m => {
      if (!m.on && !editing) return;
      const b = h('button', 'sx-mbtn' + (m.on ? '' : ' off') + (m.tplId ? ' is-rec' : '') + (editing ? ' edit-ring' : ''));
      b.type = 'button';
      b.dataset.id = m.id;
      place(b, m.btn);
      b.setAttribute('aria-label', m.name);
      b.style.setProperty('--sz', m.size);
      b.style.setProperty('--op', editing ? 1 : m.opacity);
      b.append(ico(m.mode === 'hold' ? 'pointer' : m.mode === 'once' ? 'zap' : 'play', m.label ? 18 : 22));
      if (m.label) b.append(h('span', null, m.name));
      if (editing) {
        dragify(
          b,
          () => ({ x: m.btn.x, y: m.btn.y }),
          (o, dx, dy) => {
            m.btn.x = cl(o.x + dx, 3, 97);
            m.btn.y = cl(o.y + dy, 5, 95);
            place(b, m.btn);
          },
          moved => {
            save();
            if (!moved) {
              macroSel = m.id;
              renderEdit();
            }
          }
        );
      } else {
        b.addEventListener('pointerdown', e => {
          e.preventDefault();
          e.stopPropagation();
          b.blur();
          const x0 = e.clientX, y0 = e.clientY;
          const origX = m.btn.x, origY = m.btn.y;
          let dragged = false;

          if (m.mode === 'hold') {
            activeHoldBtnMacros.add(m.id);
            runMacro(m);
          }

          const onMove = ev => {
            if (!cfg.freeDragBtns) return;
            const dx = ev.clientX - x0, dy = ev.clientY - y0;
            if (!dragged && Math.hypot(dx, dy) > 9) {
              dragged = true;
              if (m.mode === 'hold') stopMacro(m.id);
            }
            if (dragged) {
              m.btn.x = cl(origX + dx / window.innerWidth * 100, 3, 97);
              m.btn.y = cl(origY + dy / window.innerHeight * 100, 5, 95);
              place(b, m.btn);
            }
          };

          const onUp = () => {
            window.removeEventListener('pointermove', onMove, true);
            window.removeEventListener('pointerup', onUp, true);
            window.removeEventListener('pointercancel', onUp, true);
            if (dragged) {
              save();
              return;
            }
            if (m.mode === 'hold') {
              stopMacro(m.id);
            } else if (m.mode === 'once') {
              runMacro(m, true);
            } else {
              toggleMacro(m);
            }
          };

          window.addEventListener('pointermove', onMove, true);
          window.addEventListener('pointerup', onUp, true);
          window.addEventListener('pointercancel', onUp, true);
        });
      }
      mLayer.append(b);
    });
  }

  /* ---- edit mode ---- */
  function enterEdit() {
    ensureRoot();
    if (!streaming()) { toast('Start a game first'); return; }
    closePanel();
    stopAll();
    editing = true;
    curMacro();
    updateOverlay();
    renderEdit();
    markRunning();
    toast('Drag any Macro, Screenshot button, or target marker on screen');
  }
  function exitEdit() {
    editing = false;
    renderEdit();
    updateOverlay();
    commit('macros', true);
  }
  function renderEdit() {
    editLayer.replaceChildren();
    barEl.replaceChildren();
    editLayer.classList.toggle('on', editing);
    barEl.classList.toggle('on', editing);
    if (!editing) return;
    const m = curMacro();
    const tb = (icon, text, fn, cls) => {
      const b = h('button', 'sx-tb ' + (cls || ''));
      b.type = 'button';
      b.setAttribute('aria-label', text || icon);
      b.append(ico(icon, 15));
      if (text) b.append(document.createTextNode(text));
      b.addEventListener('click', fn);
      return b;
    };
    const sel = h('select', 'sx-sel');
    cfg.macros.forEach(x => {
      const o = h('option', null, x.name);
      o.value = x.id;
      sel.append(o);
    });
    if (m) sel.value = m.id;
    sel.onchange = () => { macroSel = sel.value; renderEdit(); rebuildUI(); };
    barEl.append(
      sel,
      tb('tap', 'Tap', () => m && addStepTo(m, 'tap')),
      tb('burst', 'Burst', () => m && addStepTo(m, 'burst')),
      tb('multi', '2-Finger', () => m && addStepTo(m, 'multi')),
      tb('circle', 'Circle', () => m && addStepTo(m, 'circle')),
      tb('elastic', 'Dash', () => m && addStepTo(m, 'elastic')),
      tb('bar', 'Dialog Bar', () => m && addStepTo(m, 'bar')),
      tb('zone', 'Zone', () => m && addStepTo(m, 'zone')),
      tb('swipe', 'Swipe', () => m && addStepTo(m, 'swipe')),
      tb('grid', 'Arrange', () => { autoArrangeAllButtons(); renderMacros(); }),
      tb('rec', 'Record', () => startRecording()),
      tb('undo', '', () => { if (m && m.steps.length) { delete m.ev; m.steps.pop(); stepsChanged(); } }),
      tb('play', 'Test', () => { if (m) runMacro(m, true); }),
      tb('sliders', '', () => openPanel('mac')),
      tb('check', 'Done', exitEdit, 'pri')
    );
    if (!m) return;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'sx-lines');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    editLayer.append(svg);
    m.steps.forEach((s, i) => {
      if (s.t === 'wait') return;
      if (s.t === 'zone') {
        const z = h('div', 'sx-zn');
        const setRect = () => {
          z.style.left = s.x + '%';
          z.style.top = s.y + '%';
          z.style.width = s.w + '%';
          z.style.height = s.h + '%';
        };
        setRect();
        z.append(h('b', null, (i + 1) + ' · Zone ' + s.rows + '×' + s.cols));
        for (let r = 0; r < s.rows; r++) {
          for (let c = 0; c < s.cols; c++) {
            const d = h('div', 'sx-dot');
            d.style.top = ((r + 0.5) / s.rows * 100) + '%';
            d.style.left = ((c + 0.5) / s.cols * 100) + '%';
            z.append(d);
          }
        }
        const hd = h('div', 'sx-zh');
        z.append(hd);
        dragify(
          z,
          () => ({ x: s.x, y: s.y }),
          (o, dx, dy) => {
            delete m.ev;
            s.x = cl(o.x + dx, 0, 100 - s.w);
            s.y = cl(o.y + dy, 0, 100 - s.h);
            setRect();
          },
          moved => {
            save();
            if (!moved) { delete m.ev; s.rows = (s.rows % 4) + 1; renderEdit(); rebuildUI(); }
          }
        );
        dragify(
          hd,
          () => ({ w: s.w, h: s.h }),
          (o, dx, dy) => {
            delete m.ev;
            s.w = cl(o.w + dx, 6, 100 - s.x);
            s.h = cl(o.h + dy, 6, 100 - s.y);
            setRect();
          },
          () => { save(); renderEdit(); rebuildUI(); }
        );
        editLayer.append(z);
      } else {
        const p = h('div', 'sx-mk', String(i + 1));
        p.style.left = s.x + '%';
        p.style.top = s.y + '%';
        let line = null, poly = null, circ = null, q = null;
        const upd = () => {
          p.style.left = s.x + '%';
          p.style.top = s.y + '%';
          if (poly && Array.isArray(s.pts) && s.pts.length >= 2) {
            poly.setAttribute('points', s.pts.map(pt => pt[0] + ',' + pt[1]).join(' '));
          } else if (line) {
            if (s.t === 'bar') {
              const hHalf = (s.h || 24) * 0.5;
              line.setAttribute('x1', s.x);
              line.setAttribute('y1', s.y - hHalf);
              line.setAttribute('x2', s.x);
              line.setAttribute('y2', s.y + hHalf);
            } else {
              line.setAttribute('x1', s.x);
              line.setAttribute('y1', s.y);
              line.setAttribute('x2', s.x2);
              line.setAttribute('y2', s.y2);
            }
          }
          if (circ) {
            circ.setAttribute('cx', s.x);
            circ.setAttribute('cy', s.y);
            circ.setAttribute('r', s.rad || 8);
          }
          if (q) {
            q.style.left = s.x2 + '%';
            q.style.top = s.y2 + '%';
          }
        };
        if (s.t === 'bar') {
          line = document.createElementNS(NS, 'line');
          line.setAttribute('stroke-width', '4');
          line.setAttribute('stroke-dasharray', '3 3');
          svg.append(line);
        } else if (s.t === 'circle') {
          circ = document.createElementNS(NS, 'circle');
          svg.append(circ);
        } else if (s.t === 'swipe' || s.t === 'multi' || s.t === 'elastic') {
          if (s.t === 'swipe' && Array.isArray(s.pts) && s.pts.length >= 2) {
            poly = document.createElementNS(NS, 'polyline');
            svg.append(poly);
          } else {
            line = document.createElementNS(NS, 'line');
            svg.append(line);
          }
          q = h('div', 'sx-mk end', s.t === 'multi' ? (i + 1) + 'B' : '');
          if (s.t === 'swipe' || s.t === 'elastic') q.append(ico('arrowr', 14));
          dragify(
            q,
            () => ({ x: s.x2, y: s.y2 }),
            (o, dx, dy) => {
              delete m.ev;
              s.x2 = cl(o.x + dx, 0, 100);
              s.y2 = cl(o.y + dy, 0, 100);
              delete s.pts;
              upd();
            },
            () => { save(); rebuildUI(); }
          );
        }
        dragify(
          p,
          () => ({ x: s.x, y: s.y }),
          (o, dx, dy) => {
            delete m.ev;
            const nx = cl(o.x + dx, 0, 100);
            const ny = cl(o.y + dy, 0, 100);
            if (Array.isArray(s.pts) && s.pts.length >= 2) {
              const dpx = nx - s.x, dpy = ny - s.y;
              s.pts = s.pts.map(pt => [cl(pt[0] + dpx, 0, 100), cl(pt[1] + dpy, 0, 100), pt[2]]);
              s.x2 = cl(s.x2 + dpx, 0, 100);
              s.y2 = cl(s.y2 + dpy, 0, 100);
            }
            s.x = nx;
            s.y = ny;
            upd();
          },
          () => { save(); rebuildUI(); }
        );
        upd();
        editLayer.append(p);
        if (q) editLayer.append(q);
      }
    });
  }

  let scanQ = false;
  function scheduleScan() {
    if (scanQ) return;
    scanQ = true;
    requestAnimationFrame(() => { scanQ = false; guard(scan, 'scan'); });
  }
  function scan() {
    baseSheet.set(CSS);
    ensureRoot();
    const anchor = findLobbyAnchor();
    if (anchor && !document.getElementById('sx-section')) injectLobby(anchor);
    injectMenu();
    updateSharpen();
    if (document.querySelector('.cdk-overlay-container button')) {
      const b = Array.from(document.querySelectorAll('.cdk-overlay-container button')).find(x => x.textContent && x.textContent.includes('BACK TO GAME'));
      if (b) b.click();
    }
  }
  function init() {
    baseSheet.set(CSS);
    applyDyn();
    new MutationObserver(recs => {
      if (root && recs.every(r => root.contains(r.target) || r.target === fxEl)) return;
      scheduleScan();
    }).observe(document.documentElement, { childList: true, subtree: true });
    ['fullscreenchange', 'webkitfullscreenchange', 'DOMContentLoaded', 'load'].forEach(t => window.addEventListener(t, scheduleScan));
    setInterval(() => {
      guard(scan, 'scanPoll');
      tick().catch(() => {});
    }, 1000);
    applySilent();
    scheduleScan();
  }
  if (document.documentElement) init();
  else document.addEventListener('readystatechange', init, { once: true });
})();
