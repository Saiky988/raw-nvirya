(function initLink4m() {
  "use strict";

  if (window.top !== window.self) {
    return;
  }
  if (!/(?:^|\.)link4m\.(?:com|net|org)$/i.test(location.hostname)) {
    return;
  }

  var globalWin = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  if (globalWin.__LINK4M_BYPASS_INITIALIZED__ || document.documentElement.getAttribute("data-l4m-active")) {
    return;
  }
  globalWin.__LINK4M_BYPASS_INITIALIZED__ = true;
  document.documentElement.setAttribute("data-l4m-active", "1");

  function removeLegacyElements() {
    var legacyInit = document.querySelectorAll(
      "#l4m-bypass-host, #l4m-override-styles, #l4m-captcha-layout-fix, #l4m-inline-controls, #l4m-iform, #l4m-url, #l4m-go, #l4m-result, #l4m-status"
    );
    for (var i = 0; i < legacyInit.length; i++) {
      legacyInit[i].remove();
    }
  }
  removeLegacyElements();

  var initialTargetUrl = "";
  var resolvedTargetUrl = "";
  var savedWidgetList = [];
  var requiresGoogleReferer = false;
  var isBypassRunning = false;
  var isOcrRunning = false;
  var obtainedBypassCode = "";
  var lastSubmittedRecaptchaToken = "";
  var statusIntervalId = null;

  var statusMessage = "";
  var statusNoteMessage = "";
  var statusShowRetry = false;
  var statusColor = "#0d47a1";
  var activeCountdowns = {};
  var countdownIdCounter = 0;

  var ui = {
    statusBox: null,
    statusText: null,
    statusNote: null,
    statusActions: null,
    retryBtn: null
  };

  var MULTI_PART_TLDS = {
    "com.vn": true,
    "net.vn": true,
    "edu.vn": true,
    "org.vn": true,
    "gov.vn": true,
    "info.vn": true,
    "pro.vn": true,
    "ac.vn": true,
    "health.vn": true,
    "name.vn": true,
    "co.uk": true,
    "org.uk": true,
    "com.au": true,
    "com.sg": true,
    "com.my": true,
    "com.ph": true,
    "co.jp": true,
    "co.kr": true,
    "co.id": true,
    "co.th": true,
    "com.br": true
  };

  var IGNORED_DOMAIN_REGEX = /^(?:www\.)?(?:google\.[a-z.]+|link4m\.[a-z.]+|gstatic\.com|googleapis\.com|googleusercontent\.com|cloudflare\.com|youtube\.com|youtu\.be|facebook\.com|fb\.com|chrome\.google\.com|android\.com|apple\.com|microsoft\.com|w3\.org|schema\.org|example\.com)$/i;

  function truncateText(text, maxLength) {
    if (!text) return "";
    var str = String(text);
    var limit = maxLength || 80;
    return str.length > limit ? str.slice(0, limit) + "..." : str;
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"]/g, function (ch) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;"
      }[ch];
    });
  }

  async function handleManualRetryClick() {
    if (isBypassRunning || isOcrRunning || obtainedBypassCode) {
      return;
    }
    if (initialTargetUrl) {
      await startBypassWithTargetUrl(initialTargetUrl);
    } else {
      await autoOcrAndStartBypass();
    }
  }

  function ensureStatusBox() {
    if (ui.statusBox && document.body && document.body.contains(ui.statusBox)) {
      return;
    }

    var hostBox =
      document.querySelector(".box-main .box-body .clearfix") ||
      document.querySelector(".box-main .box-body") ||
      document.querySelector(".box-main");

    if (!hostBox) {
      return;
    }

    var existingBoxes = document.querySelectorAll("#l4m-status-box");
    for (var i = 0; i < existingBoxes.length; i++) {
      existingBoxes[i].remove();
    }

    var statusBox = document.createElement("div");
    statusBox.id = "l4m-status-box";
    statusBox.style.cssText =
      "border: 1px dashed #2196F3; padding: 10px 14px; margin-bottom: 15px; border-radius: 6px; background: #f4faff; font-size: 15px; width: 100%; text-align: center; box-sizing: border-box;";
    statusBox.innerHTML =
      '<div id="l4m-status-text" style="color: #0d47a1; font-weight: bold; margin: 0; font-size: 15px;"></div>' +
      '<div id="l4m-status-note" style="display: none; font-size: 13px; color: #555; margin-top: 6px; line-height: 1.4;"></div>' +
      '<div id="l4m-status-actions" style="display: none; margin-top: 8px;">' +
      '<button type="button" id="l4m-retry-btn" style="padding: 5px 18px; font-size: 13px; font-weight: 600; color: #fff; background: #1976d2; border: none; border-radius: 4px; cursor: pointer;">Thử lại</button>' +
      "</div>";

    if (hostBox.firstChild) {
      hostBox.insertBefore(statusBox, hostBox.firstChild);
    } else {
      hostBox.appendChild(statusBox);
    }

    ui.statusBox = statusBox;
    ui.statusText = statusBox.querySelector("#l4m-status-text");
    ui.statusNote = statusBox.querySelector("#l4m-status-note");
    ui.statusActions = statusBox.querySelector("#l4m-status-actions");
    ui.retryBtn = statusBox.querySelector("#l4m-retry-btn");

    if (ui.retryBtn) {
      ui.retryBtn.addEventListener("click", function (e) {
        e.preventDefault();
        handleManualRetryClick();
      });
    }

    if (!statusIntervalId) {
      statusIntervalId = setInterval(renderStatusAndCountdown, 250);
    }
  }

  function setStatus(message, type, noteText, showRetry) {
    ensureStatusBox();
    statusMessage = String(message || "");
    statusNoteMessage = noteText ? String(noteText) : "";
    statusShowRetry = Boolean(showRetry);

    if (type === "err") {
      statusColor = "#c62828";
    } else if (type === "ok") {
      statusColor = "#2e7d32";
    } else if (type === "warn") {
      statusColor = "#e65100";
    } else {
      statusColor = "#0d47a1";
    }

    if (ui.statusBox) {
      if (type === "err") {
        ui.statusBox.style.borderColor = "#f44336";
        ui.statusBox.style.background = "#ffebee";
      } else if (type === "ok") {
        ui.statusBox.style.borderColor = "#4caf50";
        ui.statusBox.style.background = "#e8f5e9";
      } else if (type === "warn") {
        ui.statusBox.style.borderColor = "#ff9800";
        ui.statusBox.style.background = "#fff8e1";
      } else {
        ui.statusBox.style.borderColor = "#2196F3";
        ui.statusBox.style.background = "#f4faff";
      }
    }

    if (ui.retryBtn) {
      if (type === "err") {
        ui.retryBtn.style.background = "#d32f2f";
      } else if (type === "warn") {
        ui.retryBtn.style.background = "#ef6c00";
      } else {
        ui.retryBtn.style.background = "#1976d2";
      }
    }

    renderStatusAndCountdown();
  }

  function renderStatusAndCountdown() {
    if (!ui.statusText) return;

    if (obtainedBypassCode) {
      ui.statusText.style.color = statusColor;
      ui.statusText.textContent = statusMessage;
      if (ui.statusNote) ui.statusNote.style.display = "none";
      if (ui.statusActions) ui.statusActions.style.display = "none";
      return;
    }

    var now = Date.now();
    var earliestCountdown = null;
    var keys = Object.keys(activeCountdowns);

    for (var i = 0; i < keys.length; i++) {
      var item = activeCountdowns[keys[i]];
      if (!earliestCountdown || item.end < earliestCountdown.end) {
        earliestCountdown = item;
      }
    }

    if (earliestCountdown) {
      var remainingSec = Math.max(0, Math.ceil((earliestCountdown.end - now) / 1000));
      var timeFormatted =
        remainingSec >= 60
          ? Math.floor(remainingSec / 60) + ":" + ("0" + (remainingSec % 60)).slice(-2)
          : remainingSec + "s";

      var labelPrefix = earliestCountdown.label ? escapeHtml(earliestCountdown.label) + ": " : "";
      ui.statusText.style.color = "blue";
      ui.statusText.innerHTML =
        labelPrefix + '<strong style="color: red;">' + timeFormatted + "</strong>";
      if (ui.statusNote) ui.statusNote.style.display = "none";
      if (ui.statusActions) ui.statusActions.style.display = "none";
    } else {
      ui.statusText.style.color = statusColor;
      ui.statusText.textContent = statusMessage;
      if (ui.statusNote) {
        if (statusNoteMessage) {
          ui.statusNote.textContent = statusNoteMessage;
          ui.statusNote.style.display = "block";
        } else {
          ui.statusNote.style.display = "none";
        }
      }
      if (ui.statusActions) {
        ui.statusActions.style.display = statusShowRetry ? "block" : "none";
      }
    }
  }

  function stripHtmlTags(html) {
    if (!html) return "";
    var str = String(html);
    if (!/<[a-z][\s\S]*>/i.test(str)) {
      return str.trim();
    }
    var tempDiv = document.createElement("div");
    tempDiv.innerHTML = str;
    return (tempDiv.textContent || "").replace(/\s+/g, " ").trim();
  }

  function sleepWithCountdown(durationMs, label) {
    var cdKey = null;
    if (label && !obtainedBypassCode) {
      ensureStatusBox();
      countdownIdCounter++;
      cdKey = "cd" + countdownIdCounter;
      activeCountdowns[cdKey] = {
        label: label,
        end: Date.now() + durationMs,
        dur: Math.max(1, durationMs)
      };
      renderStatusAndCountdown();
    }

    return new Promise(function (resolve) {
      var endTime = Date.now() + durationMs;
      var finished = false;
      var timerId = null;

      function finishWait() {
        if (finished) return;
        finished = true;
        if (timerId) clearTimeout(timerId);
        document.removeEventListener("visibilitychange", onVisibilityOrFocus);
        window.removeEventListener("focus", onVisibilityOrFocus);
        resolve();
      }

      function checkRemaining() {
        if (finished) return;
        if (obtainedBypassCode && cdKey) {
          finishWait();
          return;
        }
        var remaining = endTime - Date.now();
        if (remaining <= 0) {
          finishWait();
          return;
        }
        timerId = setTimeout(checkRemaining, Math.min(remaining, 250));
      }

      function onVisibilityOrFocus() {
        if (!finished && !document.hidden) {
          if (timerId) {
            clearTimeout(timerId);
            timerId = null;
          }
          checkRemaining();
        }
      }

      document.addEventListener("visibilitychange", onVisibilityOrFocus);
      window.addEventListener("focus", onVisibilityOrFocus);
      checkRemaining();
    }).then(function (res) {
      if (cdKey) {
        delete activeCountdowns[cdKey];
      }
      return res;
    });
  }

  function waitForOnline(timeoutMs) {
    if (navigator.onLine) {
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      var finished = false;
      var timerId = null;

      function onOnline() {
        if (!finished) {
          finished = true;
          window.removeEventListener("online", onOnline);
          clearTimeout(timerId);
          resolve();
        }
      }

      timerId = setTimeout(onOnline, Math.max(1, timeoutMs || 0));
      window.addEventListener("online", onOnline);
    });
  }

  function getTargetOriginSlash() {
    var origin;
    try {
      origin = new URL(resolvedTargetUrl).origin;
    } catch (_) {
      origin = resolvedTargetUrl.replace(/\/.*$/, "");
    }
    return origin + "/";
  }

  function getStandardHeaders() {
    return {
      accept: "*/*",
      "accept-language": "vi,en;q=0.9,en-US;q=0.8",
      "cache-control": "no-cache, no-store, must-revalidate",
      pragma: "no-cache",
      expires: "0",
      referer: getTargetOriginSlash()
    };
  }

  function getFormUrlEncodedHeaders() {
    return {
      accept: "*/*",
      "accept-language": "vi,en;q=0.9,en-US;q=0.8",
      "cache-control": "no-cache, no-store, must-revalidate",
      "content-type": "application/x-www-form-urlencoded",
      pragma: "no-cache",
      expires: "0",
      referer: getTargetOriginSlash()
    };
  }

  function formatHttpError(err) {
    if (err == null) return "";
    if (typeof err === "string") {
      return err === "[object Object]" ? "lỗi không xác định" : err;
    }
    if (typeof err.message === "string" && err.message) {
      return err.message;
    }
    if (typeof err === "object") {
      var parts = [];
      if (err.status && err.status !== 0) {
        parts.push("HTTP " + err.status);
      }
      if (typeof err.error === "string" && err.error && err.error.toLowerCase() !== "error") {
        parts.push(err.error);
      }
      if (err.statusText && String(err.statusText).toLowerCase() !== "error") {
        parts.push(String(err.statusText));
      }
      if (!parts.length && err.status === 0) {
        parts.push("lỗi mạng");
      }
      if (!parts.length && err.responseText) {
        parts.push(truncateText(String(err.responseText), 100));
      }
      if (parts.length) {
        return parts.join(" - ");
      }
    }
    var fallbackStr = String(err);
    return fallbackStr === "[object Object]" ? "lỗi không xác định" : truncateText(fallbackStr, 120);
  }

  function httpRequest(url, options) {
    var reqOpts = Object.assign({}, options);
    if (reqOpts.method) {
      reqOpts.method = String(reqOpts.method).toUpperCase();
    }
    reqOpts.url = url;
    if (reqOpts.withCredentials === undefined) {
      reqOpts.withCredentials = false;
    }
    reqOpts.nocache = true;
    if (reqOpts.timeout === undefined) {
      reqOpts.timeout = 25000;
    }

    function runWithGmTransport(sendFn) {
      return new Promise(function (resolve, reject) {
        sendFn(
          Object.assign({}, reqOpts, {
            onload: resolve,
            onerror: function (err) {
              reject(new Error(formatHttpError(err) || "lỗi mạng"));
            },
            ontimeout: function () {
              reject(new Error("hết thời gian chờ (" + reqOpts.timeout / 1000 + "s)"));
            },
            onabort: function () {
              reject(new Error("request bị hủy"));
            }
          })
        );
      });
    }

    if (typeof GM !== "undefined" && typeof GM.xmlHttpRequest === "function") {
      return runWithGmTransport(function (details) {
        var ret = GM.xmlHttpRequest(details);
        if (ret && typeof ret.catch === "function") {
          ret.catch(function () {});
        }
      });
    }

    if (typeof GM_xmlhttpRequest === "function") {
      return runWithGmTransport(function (details) {
        GM_xmlhttpRequest(details);
      });
    }

    return fetch(reqOpts.url, {
      method: reqOpts.method || "GET",
      headers: reqOpts.headers || {},
      body: reqOpts.data,
      cache: "no-store",
      credentials: reqOpts.withCredentials ? "include" : "omit"
    }).then(function (resp) {
      return resp.text().then(function (text) {
        return {
          status: resp.status,
          responseText: text,
          finalUrl: resp.url || reqOpts.url
        };
      });
    });
  }

  function isIgnoredDomain(domain) {
    if (!domain) return true;
    var clean = String(domain)
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");
    return IGNORED_DOMAIN_REGEX.test(clean) || /link4m|google|gstatic|recaptcha|cloudflare/i.test(clean);
  }

  function isValidDomain(domain) {
    if (!domain) return false;
    var labels = String(domain)
      .toLowerCase()
      .replace(/^\.+|\.+$/g, "")
      .split(".");
    if (labels.length < 2) return false;

    for (var i = 0; i < labels.length; i++) {
      var part = labels[i];
      if (!part || !/^[a-z0-9-]+$/.test(part) || /^-|-$/.test(part)) {
        return false;
      }
    }

    var lastTwo = labels.slice(-2).join(".");
    var tld = labels[labels.length - 1];

    if (MULTI_PART_TLDS[lastTwo]) {
      return labels.length >= 3 && labels[labels.length - 3].length >= 2;
    }

    return /^[a-z]{2,18}$/.test(tld) && labels[labels.length - 2].length >= 2;
  }

  function findCampaignImageUrls(wrapperEl) {
    var root = wrapperEl || document.getElementById("advertise-html-wrapper");
    if (!root) return [];

    var seen = {};
    var candidates = [];

    function addCandidate(rawUrl, priority, imgEl) {
      if (!rawUrl || typeof rawUrl !== "string") return;
      var url = rawUrl.trim();
      if (!url || /^about:|^javascript:|^data:|^blob:/i.test(url)) return;
      if (/^\/\//.test(url)) {
        url = "https:" + url;
      } else if (/^\//.test(url)) {
        url = location.origin + url;
      }
      if (!/^https?:\/\//i.test(url)) return;
      if (
        /google|gstatic|recaptcha|button-lay-ma|icon-copy|logo|icon|avatar|favicon|banner|spinner|loading|\.svg(?:\?|$)/i.test(
          url
        )
      ) {
        return;
      }
      if (seen[url]) {
        if (priority < seen[url].priority) {
          seen[url].priority = priority;
        }
        return;
      }
      var item = { url: url, priority: priority, el: imgEl || null };
      seen[url] = item;
      candidates.push(item);
    }

    var paddedParagraphImgs = root.querySelectorAll(
      'p.text-center[style*="padding-bottom"] img, p[style*="padding-bottom"] img'
    );
    for (var i = 0; i < paddedParagraphImgs.length; i++) {
      var pImg = paddedParagraphImgs[i];
      var pSrc =
        pImg.getAttribute("src") ||
        pImg.currentSrc ||
        pImg.src ||
        pImg.getAttribute("data-src") ||
        "";
      addCandidate(pSrc, 1, pImg);
    }

    var borderedImgs = root.querySelectorAll('img[style*="border"]');
    for (var j = 0; j < borderedImgs.length; j++) {
      var bImg = borderedImgs[j];
      var bSrc =
        bImg.getAttribute("src") ||
        bImg.currentSrc ||
        bImg.src ||
        bImg.getAttribute("data-src") ||
        "";
      addCandidate(bSrc, 2, bImg);
    }

    var allImgs = root.querySelectorAll("img");
    for (var k = 0; k < allImgs.length; k++) {
      var img = allImgs[k];
      var src =
        img.getAttribute("src") ||
        img.currentSrc ||
        img.src ||
        img.getAttribute("data-src") ||
        "";
      if (!src) continue;

      var isTutorialStepImg =
        img.getAttribute("width") === "600" || /\/[46]_(?:\d+_)?\d+\.[a-z]+$/i.test(src);
      if (isTutorialStepImg) continue;

      if (/\/uploads\/advertiser\//i.test(src) || /img\.link4m\./i.test(src)) {
        addCandidate(src, 3 + k, img);
      }
    }

    candidates.sort(function (a, b) {
      return a.priority - b.priority;
    });

    return candidates;
  }

  async function waitForCampaignImages(wrapperEl, timeoutMs) {
    var startTime = Date.now();
    var maxWait = timeoutMs || 5000;
    while (Date.now() - startTime < maxWait) {
      var targetWrapper = document.getElementById("advertise-html-wrapper") || wrapperEl;
      var list = findCampaignImageUrls(targetWrapper);
      if (list.length > 0) {
        return list;
      }
      await sleepWithCountdown(300);
    }
    return findCampaignImageUrls(document.getElementById("advertise-html-wrapper") || wrapperEl);
  }

  async function ocrImageByUrl(imageUrl, apiKey) {
    var key = apiKey || "helloworld";
    var apiUrl =
      "https://api.ocr.space/parse/imageurl?apikey=" +
      encodeURIComponent(key) +
      "&url=" +
      encodeURIComponent(imageUrl);

    var response = await httpRequest(apiUrl, {
      method: "GET",
      timeout: 20000,
      headers: {
        accept: "application/json, text/plain, */*",
        "cache-control": "no-cache, no-store, must-revalidate",
        pragma: "no-cache"
      }
    });

    if (!response || !response.responseText) {
      return "";
    }

    var data = JSON.parse(response.responseText);
    if (!data || data.IsErroredOnProcessing || !Array.isArray(data.ParsedResults)) {
      return "";
    }

    var textParts = [];
    for (var i = 0; i < data.ParsedResults.length; i++) {
      var item = data.ParsedResults[i];
      if (item && item.ParsedText) {
        textParts.push(item.ParsedText);
      }
    }

    return textParts.join("\n").trim();
  }

  function levenshteinDistance(strA, strB) {
    var a = String(strA || "").toLowerCase();
    var b = String(strB || "").toLowerCase();
    var lenA = a.length;
    var lenB = b.length;
    var matrix = [];

    for (var i = 0; i <= lenA; i++) {
      matrix[i] = [i];
      for (var j = 1; j <= lenB; j++) {
        matrix[i][j] = i === 0 ? j : 0;
      }
    }

    for (var r = 1; r <= lenA; r++) {
      for (var c = 1; c <= lenB; c++) {
        if (a[r - 1] === b[c - 1]) {
          matrix[r][c] = matrix[r - 1][c - 1];
        } else {
          matrix[r][c] =
            1 + Math.min(matrix[r - 1][c], matrix[r][c - 1], matrix[r - 1][c - 1]);
        }
      }
    }

    return matrix[lenA][lenB];
  }

  function extractBestDomainFromOcrText(ocrText, hints) {
    if (!ocrText) return null;

    var masks = hints && hints.masks ? hints.masks : [];
    var candidates = {};

    function scoreCandidate(rawDomain, basePoints) {
      if (!rawDomain) return;
      var domain = String(rawDomain)
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/[\/›><"'(),;:\s].*$/, "")
        .replace(/^\.+|\.+$/g, "");

      if (!domain || domain.length < 4) return;
      if (!isValidDomain(domain) || isIgnoredDomain(domain)) return;

      if (!candidates[domain]) {
        candidates[domain] = { domain: domain, score: 0, count: 0 };
      }
      var entry = candidates[domain];
      entry.count += 1;
      entry.score += basePoints || 10;

      for (var i = 0; i < masks.length; i++) {
        var mask = masks[i];
        if (mask.regex && mask.regex.test(domain)) {
          entry.score += 1000;
        } else if (mask.suffix && domain.slice(-mask.suffix.length) === mask.suffix) {
          entry.score += 60;
          if (mask.prefix && domain.indexOf(mask.prefix) === 0) {
            entry.score += 500;
          }
        }
      }
    }

    var normalizedText = String(ocrText)
      .replace(/https?\s*:\s*\/\s*\//gi, "https://")
      .replace(/([a-z0-9])\s*[,\uff0c]\s*([a-z]{2,18})\b/gi, "$1.$2")
      .replace(/([a-z0-9])\s+\.\s+([a-z]{2,18})\b/gi, "$1.$2")
      .replace(/([a-z0-9])\.\s+([a-z]{2,18})\b/gi, "$1.$2")
      .replace(/([a-z0-9])\s+\.([a-z]{2,18})\b/gi, "$1.$2");

    var urlRegex = /https?:\/\/([a-z0-9][a-z0-9.\-]{1,61}\.[a-z]{2,18}(?:\.[a-z]{2,18})?)/gi;
    var urlMatch;
    while ((urlMatch = urlRegex.exec(normalizedText)) !== null) {
      scoreCandidate(urlMatch[1], 60);
    }

    var lines = normalizedText.split(/\r?\n/);
    var domainRegex = /\b((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,18}(?:\.[a-z]{2,18})?)\b/gi;
    for (var lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      var line = lines[lineIdx].trim();
      if (!line) continue;
      var lineWeight = lineIdx === 0 ? 45 : lineIdx < 3 ? 30 : 10;
      domainRegex.lastIndex = 0;
      var domMatch;
      while ((domMatch = domainRegex.exec(line)) !== null) {
        scoreCandidate(domMatch[1], lineWeight);
      }
    }

    for (var mIdx = 0; mIdx < masks.length; mIdx++) {
      var maskItem = masks[mIdx];
      var prefix = maskItem.prefix || "";
      var suffix = maskItem.suffix || "";
      var cleanSuffix = suffix.replace(/^\./, "");
      var existingDomains = Object.keys(candidates);

      for (var dIdx = 0; dIdx < existingDomains.length; dIdx++) {
        var dom = existingDomains[dIdx];
        if (suffix && dom.slice(-suffix.length) === suffix && prefix.length >= 3) {
          var dist = levenshteinDistance(dom.slice(0, prefix.length), prefix);
          if (dist > 0 && dist <= 2) {
            scoreCandidate(prefix + dom.slice(prefix.length), 800);
          }
        }
      }

      if (prefix.length >= 3 && cleanSuffix.length >= 2) {
        var wordRegex = /\b([a-z0-9-]{5,40})\b/gi;
        var wordMatch;
        while ((wordMatch = wordRegex.exec(normalizedText)) !== null) {
          var word = wordMatch[1].toLowerCase();
          if (
            word.length > prefix.length + cleanSuffix.length &&
            word.slice(-cleanSuffix.length) === cleanSuffix
          ) {
            var wordPrefix = word.slice(0, prefix.length);
            if (
              wordPrefix === prefix ||
              (prefix.length >= 4 && levenshteinDistance(wordPrefix, prefix) <= 1)
            ) {
              var middle = word.slice(prefix.length, word.length - cleanSuffix.length);
              if (/^[a-z0-9-]+$/.test(middle)) {
                scoreCandidate(prefix + middle + "." + cleanSuffix, 700);
              }
            }
          }
        }
      }
    }

    var bestEntry = null;
    var allDomains = Object.keys(candidates);
    for (var k = 0; k < allDomains.length; k++) {
      var item = candidates[allDomains[k]];
      if (!bestEntry || item.score > bestEntry.score) {
        bestEntry = item;
      }
    }

    return bestEntry ? bestEntry.domain : null;
  }

  async function resolveDomainFromCampaignImage(imageCandidate, hints) {
    if (!imageCandidate || !imageCandidate.url) return null;

    var apiKeys = ["helloworld", "K89899142388957", "K81724188988957"];
    var combinedText = "";

    for (var i = 0; i < apiKeys.length; i++) {
      try {
        var parsedText = await ocrImageByUrl(imageCandidate.url, apiKeys[i]);
        if (parsedText) {
          combinedText += "\n" + parsedText;
          var domain = extractBestDomainFromOcrText(combinedText, hints);
          if (domain) {
            return domain;
          }
        }
      } catch (_) {}
    }

    return null;
  }

  function extractDirectLinkOrHints(wrapperEl) {
    var result = { directDomains: [], masks: [], directStepElement: null };
    if (!wrapperEl) return result;

    var seenDomains = {};
    var seenMasks = {};

    function addDirectDomain(raw) {
      if (!raw) return;
      var dom = String(raw)
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "");
      if (dom && !seenDomains[dom] && isValidDomain(dom) && !isIgnoredDomain(dom)) {
        seenDomains[dom] = true;
        result.directDomains.push(dom);
      }
    }

    var copyEls = wrapperEl.querySelectorAll('[onclick*="copyTextToClipboard"]');
    for (var c = 0; c < copyEls.length; c++) {
      var onclickAttr = copyEls[c].getAttribute("onclick") || "";
      var copyMatch = onclickAttr.match(/copyTextToClipboard\(\s*['"]([^'"]+)['"]\s*\)/i);
      if (copyMatch && copyMatch[1]) {
        addDirectDomain(copyMatch[1]);
        var parentP = copyEls[c].closest("p");
        if (parentP && !result.directStepElement) {
          result.directStepElement = parentP;
        }
      }
    }

    var paragraphs = wrapperEl.querySelectorAll("p");
    for (var p = 0; p < paragraphs.length; p++) {
      var pText = (paragraphs[p].textContent || "").replace(/\s+/g, " ");
      if (/Bước\s*1\s*:.*Copy\s*link/i.test(pText)) {
        if (!result.directStepElement) {
          result.directStepElement = paragraphs[p];
        }
        var domRegex = /\b((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,18}(?:\.[a-z]{2,18})?)\b/gi;
        var m;
        while ((m = domRegex.exec(pText)) !== null) {
          addDirectDomain(m[1]);
        }
      }
    }

    var fullText = (wrapperEl.innerText || wrapperEl.textContent || "").replace(/\s+/g, " ");
    var step3Match = fullText.match(/Bước\s*3\s*[:.\-]?([\s\S]*?)(?:Bước\s*4|$)/i);
    var segments = [];
    if (step3Match && step3Match[1]) {
      segments.push(step3Match[1]);
    }
    segments.push(fullText);

    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var maskRegex = /(?:https?:\/\/)?([a-z0-9.\-]*\*+[a-z0-9.*\-]*\.[a-z]{2,18}(?:\.[a-z]{2,18})?)/gi;
      var maskMatch;

      while ((maskMatch = maskRegex.exec(seg)) !== null) {
        var rawMask = maskMatch[1].toLowerCase().replace(/^www\./, "").replace(/^\.+|\.+$/g, "");
        if (!seenMasks[rawMask]) {
          seenMasks[rawMask] = true;
          var firstStar = rawMask.indexOf("*");
          var lastStar = rawMask.lastIndexOf("*");
          var prefix = rawMask.slice(0, firstStar);
          var suffix = rawMask.slice(lastStar + 1);
          var pattern =
            "^" +
            rawMask
              .split(/\*+/)
              .map(function (part) {
                return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              })
              .join("[a-z0-9.-]+") +
            "$";
          try {
            result.masks.push({
              raw: rawMask,
              prefix: prefix,
              suffix: suffix,
              regex: new RegExp(pattern, "i")
            });
          } catch (_) {}
        }
      }

      if (i === 0 && result.masks.length === 0 && !/button-lay-ma|kéo xuống cuối bài/i.test(seg)) {
        var directRegex = /(?:https?:\/\/)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,18}(?:\.[a-z]{2,18})?)\b/gi;
        var directMatch;
        while ((directMatch = directRegex.exec(seg)) !== null) {
          addDirectDomain(directMatch[1]);
        }
      }
    }

    return result;
  }

  async function autoOcrAndStartBypass() {
    if (isBypassRunning || isOcrRunning) return;
    isOcrRunning = true;

    try {
      var wrapperEl = document.getElementById("advertise-html-wrapper");
      var hints = extractDirectLinkOrHints(wrapperEl);
      cleanupLink4mDomClutter();

      if (hints.directDomains.length > 0) {
        var directDomain = hints.directDomains[0];
        var directUrl = "https://" + directDomain;
        isOcrRunning = false;
        setStatus("Đã lấy link trực tiếp: " + directDomain, "ok");
        await startBypassWithTargetUrl(directUrl);
        return;
      }

      setStatus("Đang lấy ảnh camp...", "info");
      var imageCandidates = await waitForCampaignImages(wrapperEl, 5000);
      cleanupLink4mDomClutter();

      if (!imageCandidates || imageCandidates.length === 0) {
        setStatus("Không tìm thấy ảnh camp", "warn", "Kiểm tra kết nối rồi bấm Thử lại", true);
        isOcrRunning = false;
        return;
      }

      var detectedDomain = null;
      var maxImagesToTry = Math.min(imageCandidates.length, 2);

      for (var i = 0; i < maxImagesToTry; i++) {
        setStatus("Đang OCR ảnh (" + (i + 1) + "/" + maxImagesToTry + ")...", "info");
        detectedDomain = await resolveDomainFromCampaignImage(imageCandidates[i], hints);
        if (detectedDomain) break;
      }

      if (!detectedDomain) {
        setStatus(
          "Không OCR được domain từ ảnh camp",
          "warn",
          "Nếu mạng chặn OCR hãy bật 1.1.1.1 rồi bấm Thử lại",
          true
        );
        isOcrRunning = false;
        return;
      }

      var targetUrl = "https://" + detectedDomain;
      isOcrRunning = false;
      setStatus("Đã OCR: " + detectedDomain + " - đang lấy mã...", "ok");
      await startBypassWithTargetUrl(targetUrl);
    } catch (_) {
      setStatus("Lỗi tự động OCR", "warn", "Bấm Thử lại để chạy lại", true);
    } finally {
      isOcrRunning = false;
    }
  }

  function decodeHexEscapes(str) {
    if (!str) return str;
    return str.replace(/\\x([0-9A-Fa-f]{2})/g, function (_, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    });
  }

  function extractJsStringVar(scriptText, varName) {
    var match = scriptText.match(new RegExp("var\\s+" + varName + "\\s*=\\s*['\"]([^'\"]+)['\"]"));
    return match ? decodeHexEscapes(match[1]) : null;
  }

  function extractJsNumberVar(scriptText, varName) {
    var match = scriptText.match(
      new RegExp("var\\s+" + varName + "\\s*=\\s*['\"]?(-?[0-9]+(?:\\.[0-9]+)?)['\"]?")
    );
    return match ? match[1] : null;
  }

  function evaluateClientScript(scriptCode, context) {
    if (!scriptCode || !String(scriptCode).trim()) {
      return { ok: true, empty: true, value: undefined, jscd: context.jscd };
    }
    try {
      var keys = Object.keys(context || {});
      var preamble = "";
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        preamble += "var " + k + " = " + JSON.stringify(context[k]) + ";\n";
      }
      var evalResult = Function(
        preamble +
          "window.jscd = jscd;\n" +
          "var __r = eval(" +
          JSON.stringify(scriptCode) +
          ");\nreturn { r: __r, jscd: (typeof jscd !== 'undefined' && jscd ? jscd : window.jscd) };"
      ).call(window);

      return {
        ok: true,
        value: evalResult.r,
        jscd: evalResult.jscd || context.jscd
      };
    } catch (err) {
      return {
        ok: false,
        err: err && err.message ? err.message : String(err),
        jscd: context.jscd
      };
    }
  }

  function generateUuidV4() {
    var timestamp = new Date().getTime();
    if (window.performance && typeof window.performance.now === "function") {
      timestamp += performance.now();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (ch) {
      var rand = (timestamp + Math.random() * 16) % 16 | 0;
      timestamp = Math.floor(timestamp / 16);
      return (ch === "x" ? rand : (rand & 3) | 8).toString(16);
    });
  }

  function buildClientFingerprint() {
    var parsedUrl = new URL(resolvedTargetUrl);
    return {
      screen: screen.width + " x " + screen.height,
      browser: browserInfo.browser,
      browserVersion: browserInfo.browserVersion,
      browserMajorVersion: browserInfo.browserMajorVersion,
      mobile: isMobileDevice,
      os: osInfo.os,
      osVersion: osInfo.osVersion,
      cookies: true,
      flashVersion: "no check",
      lang: "vi",
      client_id: generateUuidV4(),
      pathname: parsedUrl.pathname,
      href: parsedUrl.href,
      hostname: parsedUrl.hostname
    };
  }

  function parseWidgetServiceScript(scriptText, ignoreRefFilter) {
    if (!/var\s+get_code\s*=\s*true\s*;/i.test(scriptText)) {
      return { ok: false, reason: "get_code != true" };
    }

    var refDomains = (function extractRefDomainList(code) {
      var listRegex = /var\s+ref_domain_list\s*=\s*\[([^\]]*)\]/g;
      var domains = [];
      var listMatch;
      while ((listMatch = listRegex.exec(code)) !== null) {
        var itemRegex = /["']([^"']+)["']/g;
        var itemMatch;
        while ((itemMatch = itemRegex.exec(listMatch[1])) !== null) {
          domains.push(itemMatch[1]);
        }
      }
      return domains;
    })(scriptText);

    if (!ignoreRefFilter) {
      var filteredRefs = requiresGoogleReferer
        ? refDomains.filter(function (d) {
            return /google/i.test(d);
          })
        : refDomains.filter(function (d) {
            return !/google/i.test(d);
          });

      if (requiresGoogleReferer && filteredRefs.length === 0) {
        return { ok: false, reason: "không có ref google (" + refDomains.length + ")" };
      }
      if (!requiresGoogleReferer && refDomains.length !== 0) {
        return { ok: false, reason: "có ref (" + refDomains.length + ")" };
      }
    }

    var endpoints = (function extractWidgetEndpoints(code) {
      var epRegex = /(?:get_code\.html|get_quest_code\.html)/g;
      var seen = {};
      var list = [];
      var match;
      while ((match = epRegex.exec(code)) !== null) {
        if (!seen[match[0]]) {
          seen[match[0]] = true;
          list.push(match[0]);
        }
      }
      return list;
    })(scriptText);

    if (endpoints.length === 0) {
      return { ok: false, reason: "không có endpoint" };
    }

    var roles = (function extractTrafficRoles(code) {
      var key = null;
      var codeId = null;
      var session = null;
      var domain = null;
      var uuidName = extractJsStringVar(code, "uuid_name");
      var source = { key: "-", code: "-", session: "-", domain: "-" };

      domain = extractJsStringVar(code, "traffic_domain");
      if (domain) {
        source.domain = "traffic_domain";
      } else {
        var domMatch = code.match(/["']https?:\/\/["']\s*\+\s*([A-Za-z_$][\w$]*)\s*\+\s*["']\/widget\//);
        if (domMatch) {
          domain = extractJsStringVar(code, domMatch[1]);
          if (domain) source.domain = domMatch[1];
        }
      }

      var keyMatch = code.match(/[?&]key=["']\s*\+\s*([A-Za-z_$][\w$]*)/);
      if (keyMatch) {
        key = extractJsStringVar(code, keyMatch[1]);
        if (key) source.key = keyMatch[1];
      }
      if (!key) {
        key = extractJsStringVar(code, "traffic_key");
        if (key) source.key = "traffic_key";
      }

      var codeMatch = code.match(/[?&]code=["']\s*\+\s*([A-Za-z_$][\w$]*)/);
      if (codeMatch) {
        codeId = extractJsStringVar(code, codeMatch[1]);
        if (codeId) source.code = codeMatch[1];
      }
      if (!codeId) {
        codeId = extractJsStringVar(code, "traffic_id");
        if (codeId) source.code = "traffic_id";
      }

      var sessMatch = code.match(/traffic_session=["']\s*\+\s*([A-Za-z_$][\w$]*)/);
      if (sessMatch) {
        session = extractJsStringVar(code, sessMatch[1]);
        if (session) source.session = sessMatch[1];
      }
      if (!session) {
        session = extractJsStringVar(code, "traffic_session");
        if (session) source.session = "traffic_session";
      }
      if (!session) {
        var vMatch = code.match(/var\s+(v[a-f0-9]{5,})\s*=\s*['"]([^'"]+)['"]/i);
        if (vMatch) {
          session = decodeHexEscapes(vMatch[2]);
          source.session = vMatch[1];
        }
      }
      if (!session) {
        var hexMatch = code.match(/var\s+([A-Za-z_$][\w$]*)\s*=\s*['"]([0-9a-f]{24})['"]/i);
        if (hexMatch) {
          session = hexMatch[2];
          source.session = "hex24:" + hexMatch[1];
        }
      }

      return {
        key: key,
        code: codeId,
        session: session,
        domain: domain,
        uuidName: uuidName,
        source: source
      };
    })(scriptText);

    if (!roles.key || !roles.code || !roles.session || !roles.domain) {
      return { ok: false, reason: "thiếu key/code/session/domain" };
    }

    var totalStep = endpoints[0] === "get_quest_code.html" ? "2" : "1";
    return {
      ok: true,
      endpoints: endpoints,
      roles: roles,
      totalStep: totalStep
    };
  }

  async function fetchWidgetScript(widgetInfo) {
    try {
      var resp = await httpRequest(widgetInfo.link, {
        method: "GET",
        headers: getStandardHeaders()
      });
      if (!resp || resp.status < 200 || resp.status >= 400) {
        return null;
      }
      return resp.responseText || "";
    } catch (_) {
      return null;
    }
  }

  async function runWidgetBypassFlow(widgetInfo, initialContext, ignoreRefFilter) {
    var retryCount = 0;
    var questStepId = null;
    var savedJscd = null;
    var totalStep = initialContext.v.totalStep;
    var currentStep = 1;
    var firstStepContext = initialContext;
    var phase = "page";
    var endpointName;
    var roles;
    var activeJscd;
    var queryParams;
    var endpointResp;

    function formatStepProgress() {
      return Math.min(currentStep, parseInt(totalStep, 10)) + "/" + totalStep;
    }

    while (!obtainedBypassCode) {
      try {
        if (phase === "page") {
          var scriptBody;
          var parsedWidget;

          if (firstStepContext) {
            scriptBody = firstStepContext.body;
            parsedWidget = firstStepContext.v;
            firstStepContext = null;
          } else {
            var pageResp = await httpRequest(widgetInfo.link, {
              method: "GET",
              headers: getStandardHeaders()
            });
            if (obtainedBypassCode) return null;
            scriptBody = pageResp.responseText || "";
            parsedWidget = parseWidgetServiceScript(scriptBody, ignoreRefFilter);
            if (!parsedWidget.ok) {
              return null;
            }
          }

          totalStep = parsedWidget.totalStep;
          endpointName = parsedWidget.endpoints[0];
          roles = parsedWidget.roles;

          var waitTimeStep1 = extractJsNumberVar(scriptBody, "traffic_wait_time");
          var waitTimeStep2 =
            totalStep === "2" ? extractJsNumberVar(scriptBody, "traffic_step_2_wait_time") : null;

          var initialJscd = savedJscd
            ? Object.assign({}, savedJscd)
            : buildClientFingerprint();

          var jscdQuery = new URLSearchParams(initialJscd).toString();
          var clientPostBody =
            "traffic_session=" +
            encodeURIComponent(roles.session) +
            "&key=" +
            encodeURIComponent(roles.key) +
            "&" +
            jscdQuery;

          var rawWaitSec = savedJscd ? waitTimeStep2 : waitTimeStep1;
          var waitSeconds = parseFloat(rawWaitSec);
          if (isNaN(waitSeconds) || waitSeconds < 0) {
            waitSeconds = 0;
          }

          var clientJsResp = await httpRequest("https://" + roles.domain + "/widget/client.js", {
            method: "POST",
            data: clientPostBody,
            headers: getFormUrlEncodedHeaders()
          });
          if (obtainedBypassCode) return null;

          retryCount = 0;
          var clientJsCode = clientJsResp.responseText || "";
          activeJscd = evaluateClientScript(clientJsCode, { jscd: initialJscd }).jscd || initialJscd;

          await sleepWithCountdown(
            Math.round(waitSeconds * 1000),
            "Chờ bước (" + formatStepProgress() + ")"
          );
          if (obtainedBypassCode) return null;

          if (currentStep < parseInt(totalStep, 10) && !obtainedBypassCode) {
            setStatus("Qua bước 2...");
          }

          queryParams = new URLSearchParams();
          if (questStepId) {
            queryParams.set("id", questStepId);
          }
          queryParams.set("code", roles.code);
          queryParams.set("traffic_session", roles.session);
          queryParams.set("key", roles.key);

          Object.keys(activeJscd).forEach(function (prop) {
            if (prop !== "id") {
              queryParams.append(prop, activeJscd[prop]);
            }
          });

          phase = "endpoint";
        }

        if (phase === "endpoint") {
          endpointResp = await httpRequest(
            "https://" + roles.domain + "/widget/" + endpointName + "?" + queryParams.toString(),
            {
              method: "GET",
              headers: getStandardHeaders()
            }
          );
          if (obtainedBypassCode) return null;
          retryCount = 0;
          phase = "page";
        }

        var parsedJson;
        var payload;
        try {
          parsedJson = JSON.parse((endpointResp.responseText || "").trim());
          payload = Array.isArray(parsedJson) ? parsedJson[0] : parsedJson;
        } catch (_) {
          return null;
        }

        if (!payload) {
          return null;
        }

        if (!payload.id) {
          var extractedCode = stripHtmlTags(payload.html || "");
          if (extractedCode && !obtainedBypassCode) {
            obtainedBypassCode = extractedCode;
            activeCountdowns = {};
            setStatus("Đã có mã: " + extractedCode, "ok");
          }
          return extractedCode || null;
        }

        questStepId = payload.id;
        savedJscd = activeJscd;
        currentStep = Math.min(currentStep + 1, parseInt(totalStep, 10));
        if (!obtainedBypassCode) {
          setStatus("Qua bước 2...");
        }
      } catch (_) {
        if (obtainedBypassCode || retryCount >= 5) {
          return null;
        }
        retryCount++;
        var backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 16000);
        if (typeof navigator !== "undefined" && !navigator.onLine && !obtainedBypassCode) {
          setStatus(
            "Mất mạng - chờ kết nối lại để tiếp tục bước " + formatStepProgress(),
            "warn"
          );
          await waitForOnline(120000);
        }
        await sleepWithCountdown(backoffMs);
      }
    }
    return null;
  }

  function getFormFieldValue(fieldName) {
    var el =
      document.querySelector('#main-form input[name="' + fieldName + '"]') ||
      document.querySelector('input[name="' + fieldName + '"]') ||
      document.querySelector('textarea[name="' + fieldName + '"]');
    return el && el.value ? String(el.value).trim() : "";
  }

  function getLink4mPostHeaders() {
    return {
      accept: "*/*",
      "accept-language": "vi,en;q=0.9,en-US;q=0.8",
      "cache-control": "no-cache, no-store, must-revalidate",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      pragma: "no-cache",
      expires: "0",
      referer: location.href
    };
  }

  function getRecaptchaToken() {
    var scopedFields = document.querySelectorAll(
      '#captcha-html-wrapper textarea[name="g-recaptcha-response"], #main-form textarea[name="g-recaptcha-response"], #recaptcha textarea.g-recaptcha-response'
    );
    for (var s = scopedFields.length - 1; s >= 0; s--) {
      var sVal = (scopedFields[s].value || "").trim();
      if (sVal) return sVal;
    }

    var allFields = document.querySelectorAll(
      '[name="g-recaptcha-response"], textarea#g-recaptcha-response, textarea.g-recaptcha-response'
    );
    for (var i = allFields.length - 1; i >= 0; i--) {
      var val = (allFields[i].value || "").trim();
      if (val) return val;
    }

    try {
      var grecaptchaObj = globalWin.grecaptcha;
      if (grecaptchaObj && typeof grecaptchaObj.getResponse === "function") {
        for (var widgetId = 3; widgetId >= 0; widgetId--) {
          var token = "";
          try {
            token = (grecaptchaObj.getResponse(widgetId) || "").trim();
          } catch (_) {}
          if (token) return token;
        }
      }
    } catch (_) {}

    return "";
  }

  function syncRecaptchaTokenToFields(token) {
    if (!token) return;
    var fields = document.querySelectorAll(
      '#main-form textarea[name="g-recaptcha-response"], #captcha-html-wrapper textarea[name="g-recaptcha-response"], textarea.g-recaptcha-response'
    );
    for (var i = 0; i < fields.length; i++) {
      if (!fields[i].value) {
        fields[i].value = token;
      }
    }
  }

  function isLinkButtonUnlocked() {
    var btns = document.querySelectorAll("a.get-link, #main-form a.btn-success");
    for (var i = 0; i < btns.length; i++) {
      var btn = btns[i];
      var href = (btn.getAttribute("href") || "").trim();
      if (!btn.classList.contains("disabled") && /^https?:\/\//i.test(href)) {
        return true;
      }
    }
    return false;
  }

  function fillPasswordInputs(code) {
    if (!code) return;
    var passwordInputs = document.querySelectorAll(
      '#main-form input[name="password"], input[name="password"], input.password'
    );
    for (var p = 0; p < passwordInputs.length; p++) {
      var input = passwordInputs[p];
      if (input.value !== code) {
        input.value = code;
      }
    }
  }

  function installCheckPasswordHook() {
    try {
      var currentFn = globalWin.checkPassword;
      if (typeof currentFn === "function" && !currentFn.__l4mHooked) {
        var wrapped = function (argToken) {
          if (obtainedBypassCode) {
            fillPasswordInputs(obtainedBypassCode);
          }
          var pwdVal = getFormFieldValue("password");
          if (!pwdVal) {
            return;
          }
          var token = (typeof argToken === "string" && argToken.trim()) ? argToken.trim() : getRecaptchaToken();
          var hasCaptchaWidget = Boolean(
            document.querySelector('#captcha-html-wrapper .g-recaptcha, #main-form .g-recaptcha, #recaptcha')
          );
          if (hasCaptchaWidget && !token) {
            return;
          }
          if (token && lastSubmittedRecaptchaToken === token) {
            return;
          }
          if (token) {
            lastSubmittedRecaptchaToken = token;
            syncRecaptchaTokenToFields(token);
          }
          return currentFn.call(this, token || argToken);
        };
        wrapped.__l4mHooked = true;
        wrapped.__l4mOrig = currentFn;
        globalWin.checkPassword = wrapped;
      }
    } catch (_) {}
  }

  async function fallbackUnlockDestinationLink(bypassCode, recaptchaToken) {
    var alias = getFormFieldValue("alias");
    var campaignId = getFormFieldValue("campaign_id");
    var displayId = getFormFieldValue("display_id");
    var prefix = getFormFieldValue("prefix") || bypassCode;

    if (!alias || !campaignId || !displayId) {
      return false;
    }

    var apiHost = (function detectLink4mApiHost() {
      try {
        var matches = document.documentElement.innerHTML.match(
          /https:\/\/[a-z0-9-]+\.link4m\.app/gi
        );
        if (matches && matches[0]) {
          return matches[0];
        }
      } catch (_) {}
      return "https://s1.link4m.app";
    })();

    var postData =
      "password=" +
      encodeURIComponent(bypassCode) +
      "&alias=" +
      encodeURIComponent(alias) +
      "&campaign_id=" +
      encodeURIComponent(campaignId) +
      "&display_id=" +
      encodeURIComponent(displayId) +
      "&prefix=" +
      encodeURIComponent(prefix) +
      "&g-recaptcha-response=" +
      encodeURIComponent(recaptchaToken || "");

    try {
      var linkResp = await httpRequest(apiHost + "/links/get-link-info", {
        method: "POST",
        data: postData,
        withCredentials: true,
        timeout: 30000,
        headers: getLink4mPostHeaders()
      });

      var linkJson = JSON.parse((linkResp.responseText || "").trim());
      if (!linkJson || !linkJson.success || !linkJson.url) {
        return false;
      }

      var finalDestinationUrl = linkJson.url;
      var getLinkBtns = document.querySelectorAll("a.get-link, #main-form a.btn-success");
      for (var b = 0; b < getLinkBtns.length; b++) {
        var btn = getLinkBtns[b];
        btn.classList.remove("disabled");
        btn.removeAttribute("disabled");
        btn.href = finalDestinationUrl;
      }

      var clickBody =
        "campaign_id=" +
        encodeURIComponent(campaignId) +
        "&display_id=" +
        encodeURIComponent(displayId) +
        "&code=" +
        encodeURIComponent(prefix);
      httpRequest(apiHost + "/widget/click.html", {
        method: "POST",
        data: clickBody,
        withCredentials: true,
        timeout: 30000,
        headers: getLink4mPostHeaders()
      }).catch(function () {});

      return true;
    } catch (_) {
      return false;
    }
  }

  async function submitBypassCode(bypassCode) {
    obtainedBypassCode = bypassCode;
    activeCountdowns = {};
    installCheckPasswordHook();
    fillPasswordInputs(bypassCode);
    setStatus("Đã có mã: " + bypassCode, "ok");

    var hasRecaptcha = Boolean(
      document.querySelector(
        '#captcha-html-wrapper .g-recaptcha, #main-form .g-recaptcha, #recaptcha, iframe[src*="recaptcha"]'
      )
    );

    if (!hasRecaptcha) {
      try {
        if (typeof globalWin.checkPassword === "function") {
          globalWin.checkPassword("");
        }
      } catch (_) {}
      await sleepWithCountdown(1500);
      if (!isLinkButtonUnlocked()) {
        await fallbackUnlockDestinationLink(bypassCode, "");
      }
      if (isLinkButtonUnlocked()) {
        setStatus("Đã có mã: " + bypassCode + " - Đã mở khóa link đích", "ok");
      }
      return;
    }

    var initialToken = getRecaptchaToken();
    if (initialToken && lastSubmittedRecaptchaToken !== initialToken) {
      try {
        if (typeof globalWin.checkPassword === "function") {
          globalWin.checkPassword(initialToken);
        }
      } catch (_) {}
    }

    var startWait = Date.now();
    var tokenSeenAt = initialToken ? Date.now() : 0;

    while (Date.now() - startWait < 300000) {
      fillPasswordInputs(bypassCode);

      if (isLinkButtonUnlocked()) {
        setStatus("Đã có mã: " + bypassCode + " - Đã mở khóa link đích", "ok");
        return;
      }

      var currentToken = getRecaptchaToken();
      if (currentToken) {
        if (!tokenSeenAt) {
          tokenSeenAt = Date.now();
        }
        if (Date.now() - tokenSeenAt >= 2000 && lastSubmittedRecaptchaToken !== currentToken) {
          if (typeof globalWin.checkPassword === "function") {
            try {
              globalWin.checkPassword(currentToken);
            } catch (_) {}
          } else {
            lastSubmittedRecaptchaToken = currentToken;
            var unlocked = await fallbackUnlockDestinationLink(bypassCode, currentToken);
            if (unlocked || isLinkButtonUnlocked()) {
              setStatus("Đã có mã: " + bypassCode + " - Đã mở khóa link đích", "ok");
              return;
            }
          }
        }
      } else {
        tokenSeenAt = 0;
      }

      await sleepWithCountdown(400);
    }
  }

  function validateTaskUrl(rawUrl) {
    var trimmed = (rawUrl || "").trim();
    if (!trimmed) {
      return { err: "empty" };
    }
    if (!/^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\//.test(trimmed)) {
      trimmed = "https://" + trimmed;
    }
    var parsed;
    try {
      parsed = new URL(trimmed);
    } catch (_) {
      return { err: "invalid" };
    }
    if (parsed.protocol === "http:") {
      parsed.protocol = "https:";
    }
    if (parsed.protocol !== "https:" || !parsed.hostname) {
      return { err: "invalid" };
    }
    if (/^([a-z0-9\-]+\.)*link4m\.(com|net|org)$/i.test(parsed.hostname)) {
      return { err: "link4m" };
    }
    return { url: parsed.href };
  }

  function extractWidgetScriptsFromHtml(html) {
    if (!html) return [];
    var normalizedHtml = String(html).replace(/\\\//g, "/");
    var scriptRegex =
      /(?:https?:)?\/\/([a-z0-9.\-]+)\/widget\/(service(?:-v\d+)?\.js)\?([^"'\s<>\\]+)/gi;
    var widgets = [];
    var seenKeys = {};
    var match;
    while ((match = scriptRegex.exec(normalizedHtml)) !== null) {
      var host = match[1];
      var file = match[2];
      var query = (match[3] || "").replace(/&amp;/gi, "&");
      var keyMatch = /(?:^|&)key=([^&"'\s]+)/.exec(query);
      if (keyMatch && keyMatch[1]) {
        var uniqueId = host.toLowerCase() + "/" + file.toLowerCase() + "?" + keyMatch[1];
        if (!seenKeys[uniqueId]) {
          seenKeys[uniqueId] = true;
          widgets.push({
            host: host,
            key: keyMatch[1],
            file: file,
            link: "https://" + host + "/widget/" + file + "?key=" + keyMatch[1]
          });
        }
      }
    }
    return widgets;
  }

  async function startBypassWithTargetUrl(rawUrl) {
    if (isBypassRunning) return;

    var validation = validateTaskUrl(rawUrl);
    if (validation.err) {
      setStatus("URL nhiệm vụ không hợp lệ", "err");
      return;
    }

    isBypassRunning = true;

    try {
      if (initialTargetUrl !== validation.url) {
        savedWidgetList = [];
      }
      initialTargetUrl = validation.url;
      if (!resolvedTargetUrl) {
        resolvedTargetUrl = validation.url;
      }

      var widgetList = [];

      if (savedWidgetList.length > 0) {
        widgetList = savedWidgetList.slice();
      } else {
        setStatus("Đang tải trang nhiệm vụ...", "info");

        var pageResp = null;
        try {
          pageResp = await httpRequest(initialTargetUrl, {
            method: "GET",
            headers: getStandardHeaders(),
            timeout: 30000
          });
        } catch (_) {}

        if (!pageResp || pageResp.status < 200 || pageResp.status >= 400) {
          setStatus(
            "Không truy cập được trang nhiệm vụ",
            "err",
            "Trang nhiệm vụ bị chặn mạng - hãy bật 1.1.1.1 / VPN rồi bấm Thử lại",
            true
          );
          isBypassRunning = false;
          return;
        }

        var finalUrl = pageResp.finalUrl || pageResp.responseURL;
        if (finalUrl && finalUrl !== initialTargetUrl) {
          resolvedTargetUrl = finalUrl;
        } else {
          resolvedTargetUrl = initialTargetUrl;
        }

        widgetList = extractWidgetScriptsFromHtml(pageResp.responseText || "");
        if (widgetList.length > 0) {
          savedWidgetList = widgetList.slice();
        }
      }

      if (widgetList.length === 0) {
        setStatus(
          "Không tìm thấy widget nào trên trang",
          "err",
          "Trang nhiệm vụ bị chặn mạng - hãy bật 1.1.1.1 / VPN rồi bấm Thử lại",
          true
        );
        isBypassRunning = false;
        return;
      }

      setStatus("Đang kiểm tra widget...", "info");

      var fetchedWidgets = [];
      for (var i = 0; i < widgetList.length; i++) {
        var scriptBody = await fetchWidgetScript(widgetList[i]);
        if (scriptBody) {
          fetchedWidgets.push({ w: widgetList[i], body: scriptBody });
        }
      }

      var validWidgets = [];
      var usedIgnoreRefFallback = false;
      for (var k = 0; k < fetchedWidgets.length; k++) {
        var parsedStrict = parseWidgetServiceScript(fetchedWidgets[k].body, false);
        if (parsedStrict.ok) {
          validWidgets.push({
            w: fetchedWidgets[k].w,
            ctx: { body: fetchedWidgets[k].body, v: parsedStrict }
          });
        }
      }

      if (validWidgets.length === 0) {
        usedIgnoreRefFallback = true;
        for (var m = 0; m < fetchedWidgets.length; m++) {
          var parsedFallback = parseWidgetServiceScript(fetchedWidgets[m].body, true);
          if (parsedFallback.ok) {
            validWidgets.push({
              w: fetchedWidgets[m].w,
              ctx: { body: fetchedWidgets[m].body, v: parsedFallback }
            });
          }
        }
      }

      if (validWidgets.length === 0) {
        setStatus(
          "Không có widget hợp lệ",
          "warn",
          "Link4m chặn VPN - hãy tắt VPN / 1.1.1.1 rồi bấm Thử lại",
          true
        );
        isBypassRunning = false;
        return;
      }

      validWidgets.sort(function (a, b) {
        return parseInt(a.ctx.v.totalStep, 10) - parseInt(b.ctx.v.totalStep, 10);
      });

      setStatus("Đang chạy " + validWidgets.length + " widget...", "info");
      var results = await Promise.all(
        validWidgets.map(function (item) {
          return runWidgetBypassFlow(item.w, item.ctx, usedIgnoreRefFallback);
        })
      );

      var bypassCode = obtainedBypassCode;
      if (!bypassCode) {
        for (var j = 0; j < results.length; j++) {
          if (results[j]) {
            bypassCode = results[j];
            break;
          }
        }
      }

      if (bypassCode) {
        await submitBypassCode(bypassCode);
      } else {
        setStatus(
          "Không lấy được mã từ widget",
          "warn",
          "Nếu đang bật VPN / 1.1.1.1 hãy tắt đi rồi bấm Thử lại",
          true
        );
      }
    } catch (_) {
      setStatus("Có lỗi xảy ra", "err", "Bấm Thử lại để chạy lại", true);
    } finally {
      isBypassRunning = false;
    }
  }

  function isGuidePresentInWrapper(wrapperEl) {
    if (!wrapperEl) return false;
    var h4s = wrapperEl.querySelectorAll("h4");
    for (var i = 0; i < h4s.length; i++) {
      var text = (h4s[i].textContent || "").replace(/\s+/g, " ");
      if (/HƯỚNG\s*DẪN.*LẤY\s*MÃ/i.test(text)) {
        return true;
      }
    }
    if (wrapperEl.querySelector('[onclick*="copyTextToClipboard"]')) {
      return true;
    }
    return false;
  }

  async function waitForGuideReady() {
    while (true) {
      installCheckPasswordHook();
      var wrapperEl = document.getElementById("advertise-html-wrapper");
      if (wrapperEl && isGuidePresentInWrapper(wrapperEl)) {
        var guideHeading = wrapperEl.querySelector("h4");
        var headingText = guideHeading ? guideHeading.textContent || "" : "";
        var links = wrapperEl.querySelectorAll("a[href]");
        var hasGoogleLink = false;
        for (var i = 0; i < links.length; i++) {
          if (/google\.com/i.test(links[i].getAttribute("href") || "")) {
            hasGoogleLink = true;
            break;
          }
        }
        requiresGoogleReferer =
          !/TRỰC\s*TIẾP/i.test(headingText) &&
          (hasGoogleLink || /TÌM\s*KIẾM\s*TỪ\s*KHOÁ/i.test(headingText));

        cleanupLink4mDomClutter();
        return true;
      }
      await sleepWithCountdown(300);
    }
  }

  function cleanupLink4mDomClutter() {
    removeLegacyElements();

    var hideSelectors = [
      "#report-wrapper",
      "#modal-report",
      ".responsive-youtube",
      "iframe.youtube-player",
      ".camp_yoads",
      ".yoads_network_widget",
      "ins.adsbygoogle",
      'div[id*="ad_"]'
    ];
    for (var s = 0; s < hideSelectors.length; s++) {
      var found = document.querySelectorAll(hideSelectors[s]);
      for (var f = 0; f < found.length; f++) {
        found[f].style.display = "none";
      }
    }

    var wrapper = document.getElementById("advertise-html-wrapper");
    if (!wrapper || !isGuidePresentInWrapper(wrapper)) return;

    var campCandidates = findCampaignImageUrls(wrapper);
    var campImgEl = campCandidates.length > 0 ? campCandidates[0].el : null;
    var campContainerP = campImgEl ? campImgEl.closest("p") || campImgEl : null;
    if (campContainerP) {
      campContainerP.setAttribute("data-l4m-keep", "1");
      campContainerP.style.display = "";
    }
    if (campImgEl) {
      campImgEl.setAttribute("data-l4m-keep", "1");
      campImgEl.style.display = "";
    }

    var hints = extractDirectLinkOrHints(wrapper);
    if (hints.directStepElement) {
      hints.directStepElement.setAttribute("data-l4m-keep", "1");
      hints.directStepElement.style.textAlign = "center";
      hints.directStepElement.style.display = "";
    }

    if (!campContainerP && !hints.directStepElement) {
      return;
    }

    var blocks = wrapper.children;
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      if (block.id === "l4m-status-box") continue;

      var keepBlock =
        block.getAttribute("data-l4m-keep") === "1" ||
        Boolean(
          block.querySelector(
            '[data-l4m-keep="1"], .g-recaptcha, iframe[src*="recaptcha"], [data-sitekey], input[name="password"], a.get-link, .cf-turnstile'
          )
        );

      if (!keepBlock) {
        block.style.display = "none";
      }
    }
  }

  var browserInfo = (function detectBrowserInfo() {
    var ua = navigator.userAgent;
    var appVer = navigator.appVersion;
    var browserName = navigator.appName;
    var fullVersion = "" + parseFloat(appVer);
    var majorVersion = parseInt(appVer, 10);
    var idx;

    if ((idx = ua.indexOf("Opera")) !== -1) {
      browserName = "Opera";
      fullVersion = ua.substring(idx + 6);
      if ((idx = ua.indexOf("Version")) !== -1) {
        fullVersion = ua.substring(idx + 8);
      }
    }
    if ((idx = ua.indexOf("OPR")) !== -1) {
      browserName = "Opera";
      fullVersion = ua.substring(idx + 4);
    } else if ((idx = ua.indexOf("MSIE")) !== -1) {
      browserName = "Microsoft Internet Explorer";
      fullVersion = ua.substring(idx + 5);
    } else if ((idx = ua.indexOf("Chrome")) !== -1) {
      browserName = "Chrome";
      fullVersion = ua.substring(idx + 7);
    } else if ((idx = ua.indexOf("Safari")) !== -1) {
      browserName = "Safari";
      fullVersion = ua.substring(idx + 7);
      if ((idx = ua.indexOf("Version")) !== -1) {
        fullVersion = ua.substring(idx + 8);
      }
    } else if ((idx = ua.indexOf("Firefox")) !== -1) {
      browserName = "Firefox";
      fullVersion = ua.substring(idx + 8);
    } else if (ua.indexOf("Trident/") !== -1) {
      browserName = "Microsoft Internet Explorer";
      fullVersion = ua.substring(ua.indexOf("rv:") + 3);
    } else {
      var spaceIdx = ua.lastIndexOf(" ") + 1;
      var slashIdx = ua.lastIndexOf("/");
      if (spaceIdx < slashIdx) {
        browserName = ua.substring(spaceIdx, slashIdx);
        fullVersion = ua.substring(slashIdx + 1);
        if (browserName.toLowerCase() === browserName.toUpperCase()) {
          browserName = navigator.appName;
        }
      }
    }

    var cutIdx;
    if ((cutIdx = fullVersion.indexOf(";")) !== -1) {
      fullVersion = fullVersion.substring(0, cutIdx);
    }
    if ((cutIdx = fullVersion.indexOf(" ")) !== -1) {
      fullVersion = fullVersion.substring(0, cutIdx);
    }
    if ((cutIdx = fullVersion.indexOf(")")) !== -1) {
      fullVersion = fullVersion.substring(0, cutIdx);
    }

    majorVersion = parseInt("" + fullVersion, 10);
    if (isNaN(majorVersion)) {
      fullVersion = "" + parseFloat(appVer);
      majorVersion = parseInt(appVer, 10);
    }

    return {
      browser: browserName,
      browserVersion: fullVersion,
      browserMajorVersion: majorVersion
    };
  })();

  var osInfo = (function detectOsInfo() {
    var ua = navigator.userAgent;
    var osName = "-";
    var osVersion = "-";
    var rules = [
      { s: "Windows 10", r: /(Windows 10.0|Windows NT 10.0)/ },
      { s: "Windows 8.1", r: /(Windows 8.1|Windows NT 6.3)/ },
      { s: "Windows 8", r: /(Windows 8|Windows NT 6.2)/ },
      { s: "Windows 7", r: /(Windows 7|Windows NT 6.1)/ },
      { s: "Windows Vista", r: /Windows NT 6.0/ },
      { s: "Windows Server 2003", r: /Windows NT 5.2/ },
      { s: "Windows XP", r: /(Windows NT 5.1|Windows XP)/ },
      { s: "Windows 2000", r: /(Windows NT 5.0|Windows 2000)/ },
      { s: "Windows ME", r: /(Win 9x 4.90|Windows ME)/ },
      { s: "Windows 98", r: /(Windows 98|Win98)/ },
      { s: "Windows 95", r: /(Windows 95|Win95|Windows_95)/ },
      { s: "Windows NT 4.0", r: /(Windows NT 4.0|WinNT4.0|WinNT|Windows NT)/ },
      { s: "Windows CE", r: /Windows CE/ },
      { s: "Windows 3.11", r: /Win16/ },
      { s: "Android", r: /Android/ },
      { s: "Open BSD", r: /OpenBSD/ },
      { s: "Sun OS", r: /SunOS/ },
      { s: "Linux", r: /(Linux|X11)/ },
      { s: "iOS", r: /(iPhone|iPad|iPod)/ },
      { s: "Mac OS X", r: /Mac OS X/ },
      { s: "Mac OS", r: /(MacPPC|MacIntel|Mac_PowerPC|Macintosh)/ },
      { s: "QNX", r: /QNX/ },
      { s: "UNIX", r: /UNIX/ },
      { s: "BeOS", r: /BeOS/ },
      { s: "OS/2", r: /OS\/2/ },
      {
        s: "Search Bot",
        r: /(nuhk|Googlebot|Yammybot|Openbot|Slurp|MSNBot|Ask Jeeves\/Teoma|ia_archiver)/
      }
    ];

    for (var i = 0; i < rules.length; i++) {
      if (rules[i].r.test(ua)) {
        osName = rules[i].s;
        break;
      }
    }

    if (/Windows/.test(osName)) {
      var winMatch = /Windows (.*)/.exec(osName);
      osVersion = winMatch ? winMatch[1] : "-";
      osName = "Windows";
    }

    if (osName === "Mac OS X") {
      var macMatch = /Mac OS X (10[\.\_\d]+)/.exec(ua);
      osVersion = macMatch ? macMatch[1] : "-";
    } else if (osName === "Android") {
      var androidMatch = /Android ([\.\_\d]+)/.exec(ua);
      osVersion = androidMatch ? androidMatch[1] : "-";
    } else if (osName === "iOS") {
      var iosMatch = /OS (\d+)_(\d+)_?(\d+)?/.exec(navigator.appVersion);
      if (iosMatch) {
        osVersion = iosMatch[1] + "." + iosMatch[2] + "." + (iosMatch[3] | 0);
      }
    }

    return { os: osName, osVersion: osVersion };
  })();

  var isMobileDevice = /Mobile|mini|Fennec|Android|iP(ad|od|hone)/.test(navigator.appVersion);

  (function initLink4mBypass() {
    if (/^\/go\/not-found/.test(location.pathname)) {
      return;
    }
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", initLink4mBypass, { once: true });
      return;
    }

    removeLegacyElements();
    installCheckPasswordHook();

    (async function runStartupFlow() {
      var isReady = await waitForGuideReady();
      if (isReady) {
        await autoOcrAndStartBypass();
      }
    })();
  })();
})();
