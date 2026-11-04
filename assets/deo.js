// Bind Tampermonkey / Greasemonkey globals to globalThis if available
(function bindUserscriptGlobals(globalObj) {
  var defineGlobal = function (name, value) {
    try {
      if (globalObj[name] !== value) {
        Object.defineProperty(globalObj, name, {
          value: value,
          writable: true,
          configurable: true
        });
      }
    } catch (_) {}
  };

  if (typeof GM !== "undefined") defineGlobal("GM", GM);
  if (typeof GM_info !== "undefined") defineGlobal("GM_info", GM_info);
  if (typeof unsafeWindow !== "undefined") defineGlobal("unsafeWindow", unsafeWindow);
  if (typeof GM_getValue !== "undefined") defineGlobal("GM_getValue", GM_getValue);
  if (typeof GM_setValue !== "undefined") defineGlobal("GM_setValue", GM_setValue);
  if (typeof GM_deleteValue !== "undefined") defineGlobal("GM_deleteValue", GM_deleteValue);
  if (typeof GM_listValues !== "undefined") defineGlobal("GM_listValues", GM_listValues);
  if (typeof GM_getValues !== "undefined") defineGlobal("GM_getValues", GM_getValues);
  if (typeof GM_setValues !== "undefined") defineGlobal("GM_setValues", GM_setValues);
  if (typeof GM_deleteValues !== "undefined") defineGlobal("GM_deleteValues", GM_deleteValues);
  if (typeof GM_addValueChangeListener !== "undefined") defineGlobal("GM_addValueChangeListener", GM_addValueChangeListener);
  if (typeof GM_removeValueChangeListener !== "undefined") defineGlobal("GM_removeValueChangeListener", GM_removeValueChangeListener);
  if (typeof GM_xmlhttpRequest !== "undefined") defineGlobal("GM_xmlhttpRequest", GM_xmlhttpRequest);
  if (typeof GM_download !== "undefined") defineGlobal("GM_download", GM_download);
  if (typeof GM_openInTab !== "undefined") defineGlobal("GM_openInTab", GM_openInTab);
  if (typeof GM_registerMenuCommand !== "undefined") defineGlobal("GM_registerMenuCommand", GM_registerMenuCommand);
  if (typeof GM_unregisterMenuCommand !== "undefined") defineGlobal("GM_unregisterMenuCommand", GM_unregisterMenuCommand);
  if (typeof GM_notification !== "undefined") defineGlobal("GM_notification", GM_notification);
  if (typeof GM_setClipboard !== "undefined") defineGlobal("GM_setClipboard", GM_setClipboard);
  if (typeof GM_addStyle !== "undefined") defineGlobal("GM_addStyle", GM_addStyle);
  if (typeof GM_addElement !== "undefined") defineGlobal("GM_addElement", GM_addElement);
  if (typeof GM_getResourceText !== "undefined") defineGlobal("GM_getResourceText", GM_getResourceText);
  if (typeof GM_getResourceURL !== "undefined") defineGlobal("GM_getResourceURL", GM_getResourceURL);
  if (typeof GM_log !== "undefined") defineGlobal("GM_log", GM_log);
  if (typeof GM_getTab !== "undefined") defineGlobal("GM_getTab", GM_getTab);
  if (typeof GM_saveTab !== "undefined") defineGlobal("GM_saveTab", GM_saveTab);
  if (typeof GM_getTabs !== "undefined") defineGlobal("GM_getTabs", GM_getTabs);
  if (typeof GM_cookie !== "undefined") defineGlobal("GM_cookie", GM_cookie);
  if (typeof GM_webRequest !== "undefined") defineGlobal("GM_webRequest", GM_webRequest);
  if (typeof cloneInto !== "undefined") defineGlobal("cloneInto", cloneInto);
  if (typeof exportFunction !== "undefined") defineGlobal("exportFunction", exportFunction);
  if (typeof createObjectIn !== "undefined") defineGlobal("createObjectIn", createObjectIn);
})(typeof globalThis !== "undefined" ? globalThis : self);

// Helper runtime registration (__gve_d, __gve_reg, __gve_c)
(function initGveHelpers(globalObj) {
  var alphabet = "t1WlnhRTsjwkyKHfZr4FbPLmSJ72pNYUM+6c0Gagi9D8CBv3deuAxIzXVq5oOQ/E~";
  var paddingChar = alphabet[64];
  var registry = {};

  globalObj.__gve_d = function decodeGveJson(encodedStr) {
    var decodedText = (function decodeCustomBase64(input) {
      var cleanStr = input
        .split("")
        .filter(function (ch) {
          return ch !== paddingChar;
        })
        .join("");
      var bytes = [];
      var idx = 0;
      var len = cleanStr.length;

      while (idx < len) {
        var b0 = alphabet.indexOf(cleanStr[idx]);
        var b1 = alphabet.indexOf(cleanStr[idx + 1]);
        var b2 = cleanStr[idx + 2] !== undefined ? alphabet.indexOf(cleanStr[idx + 2]) : 0;
        var b3 = cleanStr[idx + 3] !== undefined ? alphabet.indexOf(cleanStr[idx + 3]) : 0;
        var combined = (b0 << 18) | (b1 << 12) | (b2 << 6) | b3;

        bytes.push((combined >> 16) & 255);
        if (cleanStr[idx + 2] !== undefined) {
          bytes.push((combined >> 8) & 255);
        }
        if (cleanStr[idx + 3] !== undefined) {
          bytes.push(combined & 255);
        }
        idx += 4;
      }

      return new TextDecoder().decode(new Uint8Array(bytes));
    })(encodedStr);

    return JSON.parse(decodedText);
  };

  globalObj.__gve_reg = function registerGveFn(key, fn) {
    registry[key] = fn;
    return fn;
  };

  globalObj.__gve_c = function callGveFn(key, args) {
    return registry[key].apply(this, args);
  };
})(typeof globalThis !== "undefined" ? globalThis : self);

// Main Link4m Bypass Userscript
(function initLink4mBypassApp() {
  // Application State
  var initialTargetUrl = "";
  var resolvedTargetUrl = "";
  var requiresGoogleReferer = false;
  var isBypassRunning = false;
  var isOcrRunning = false;
  var isPageReady = false;

  var statusMessage = "Đang khởi tạo…";
  var statusType = "info";
  var isSpinnerActive = true;
  var activeCountdowns = {};
  var countdownIdCounter = 0;

  // UI Element References (using native Link4m Bootstrap classes)
  var ui = {
    container: null,
    statusBox: null,
    statusText: null,
    countdownWrap: null,
    countdownFill: null,
    noticeBox: null,
    form: null,
    urlInputWrap: null,
    urlInput: null,
    submitBtn: null,
    resultBox: null,
    resultUrlText: null,
    copyUrlBtn: null,
    openUrlBtn: null
  };

  // Multi-part country TLDs
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
    return str.length > limit ? str.slice(0, limit) + "…" : str;
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

  function getBootstrapAlertClass(type) {
    if (type === "ok") return "alert alert-success";
    if (type === "err") return "alert alert-danger";
    if (type === "warn") return "alert alert-warning";
    return "alert alert-info";
  }

  function setStatus(message, spinning, type) {
    statusMessage = String(message || "");
    statusType = type || "info";
    if (typeof spinning === "boolean") {
      isSpinnerActive = spinning;
    }
    renderStatusAndCountdown();
  }

  function renderStatusAndCountdown() {
    if (!ui.statusText || !ui.statusBox) return;

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

      ui.statusBox.className = "alert alert-info";
      var labelPrefix = earliestCountdown.label ? escapeHtml(earliestCountdown.label) + " " : "";
      var badgeClass = remainingSec <= 10 ? "label label-danger" : "label label-primary";
      var html = labelPrefix + '<span class="' + badgeClass + '">' + timeFormatted + "</span>";

      if (ui.statusText.innerHTML !== html) {
        ui.statusText.innerHTML = html;
      }

      if (ui.countdownWrap && ui.countdownFill) {
        ui.countdownWrap.style.display = "block";
        var pct = earliestCountdown.dur
          ? Math.max(0, Math.min(100, (1 - (earliestCountdown.end - now) / earliestCountdown.dur) * 100))
          : 0;
        ui.countdownFill.style.width = pct + "%";
      }
    } else {
      if (ui.countdownWrap && ui.countdownFill) {
        ui.countdownWrap.style.display = "none";
        ui.countdownFill.style.width = "0%";
      }
      ui.statusBox.className = getBootstrapAlertClass(statusType);
      ui.statusText.textContent = (isSpinnerActive ? "⏳ " : "") + statusMessage;
    }
  }

  function hideCaptchaNotice() {
    if (ui.noticeBox) {
      ui.noticeBox.style.display = "none";
    }
  }

  function setUrlInputVisible(visible) {
    if (ui.form) {
      ui.form.style.display = visible ? "" : "none";
    }
  }

  function updateControlsState() {
    if (ui.urlInput && ui.submitBtn) {
      var isDisabled = isBypassRunning || isOcrRunning || !isPageReady;
      ui.urlInput.disabled = isDisabled;
      ui.submitBtn.disabled = isDisabled;
      ui.submitBtn.textContent = isBypassRunning
        ? "Đang chạy…"
        : isOcrRunning
        ? "Đang OCR…"
        : "Bắt đầu";
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
    if (label) {
      countdownIdCounter++;
      cdKey = "cd" + countdownIdCounter;
      activeCountdowns[cdKey] = {
        label: label,
        end: Date.now() + durationMs,
        dur: Math.max(1, durationMs)
      };
    }

    return new Promise(function (resolve) {
      var endTime = Date.now() + durationMs;
      var finished = false;
      var timerId = null;

      function checkRemaining() {
        if (finished) return;
        var remaining = endTime - Date.now();
        if (remaining <= 0) {
          finished = true;
          if (timerId) clearTimeout(timerId);
          document.removeEventListener("visibilitychange", onVisibilityOrFocus);
          window.removeEventListener("focus", onVisibilityOrFocus);
          resolve();
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
      "cache-control": "no-cache",
      pragma: "no-cache",
      referer: getTargetOriginSlash()
    };
  }

  function getFormUrlEncodedHeaders() {
    return {
      accept: "*/*",
      "accept-language": "vi,en;q=0.9,en-US;q=0.8",
      "cache-control": "no-cache",
      "content-type": "application/x-www-form-urlencoded",
      pragma: "no-cache",
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
      if (!parts.length) {
        try {
          var jsonStr = JSON.stringify(err);
          if (jsonStr && jsonStr.length > 2) {
            parts.push(truncateText(jsonStr, 120));
          }
        } catch (_) {}
      }
      if (parts.length) {
        return parts.join(" · ");
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
      credentials: reqOpts.withCredentials ? "include" : "omit"
    }).then(function (resp) {
      if (reqOpts.responseType === "arraybuffer") {
        return resp.arrayBuffer().then(function (buf) {
          return {
            status: resp.status,
            response: buf,
            finalUrl: resp.url || reqOpts.url
          };
        });
      }
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

  // Locate the campaign target image inside #advertise-html-wrapper
  // Matches: <p class="text-center" style="padding-bottom:30px;text-align: center;"><img src="https://img.link4m.net/uploads/advertiser/..." style="border:1px solid #ccc;"></p>
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
      if (/google|gstatic|recaptcha|button-lay-ma|logo|icon|avatar|favicon|banner|spinner|loading|\.svg(?:\?|$)/i.test(url)) {
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

    // 1. Target <p class="text-center" style="padding-bottom:30px;text-align: center;"> <img>
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

    // 2. Match advertiser images with border style (e.g., style="border:1px solid #ccc;")
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

    // 3. Fallback: other advertiser images inside #advertise-html-wrapper
    var allImgs = root.querySelectorAll("img");
    for (var k = 0; k < allImgs.length; k++) {
      var img = allImgs[k];
      var src =
        img.getAttribute("src") ||
        img.currentSrc ||
        img.src ||
        img.getAttribute("data-src") ||
        img.getAttribute("data-lazy-src") ||
        img.getAttribute("data-original") ||
        "";
      if (!src) continue;

      var prevText = "";
      try {
        var parent = img.parentElement;
        var prevEl = img.previousElementSibling || (parent ? parent.previousElementSibling : null);
        if (prevEl) {
          prevText = prevEl.textContent || "";
        }
      } catch (_) {}

      var isTutorialStep4Or5 =
        /Bước\s*[45]/i.test(prevText) ||
        img.getAttribute("width") === "600" ||
        /\/[46]_\d+\.[a-z]+$/i.test(src);

      var priority = isTutorialStep4Or5 ? 50 + k : 10 + k;
      if (/\/uploads\/advertiser\//i.test(src) || /img\.link4m\./i.test(src)) {
        if (!isTutorialStep4Or5) {
          priority = 3 + k;
        }
      }
      addCandidate(src, priority, img);
    }

    candidates.sort(function (a, b) {
      return a.priority - b.priority;
    });

    return candidates;
  }

  async function waitForCampaignImages(wrapperEl, timeoutMs) {
    var startTime = Date.now();
    var maxWait = timeoutMs || 6000;
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

  // Remake OCR: Call GET https://api.ocr.space/parse/imageurl?apikey=helloworld&url=<imageUrl>
  async function ocrImageByUrl(imageUrl, apiKey) {
    var key = apiKey || "helloworld";
    var apiUrl =
      "https://api.ocr.space/parse/imageurl?apikey=" +
      encodeURIComponent(key) +
      "&url=" +
      imageUrl;

    var response = await httpRequest(apiUrl, {
      method: "GET",
      timeout: 20000,
      headers: {
        accept: "application/json, text/plain, */*"
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

  function extractHintsFromWrapper(wrapperEl) {
    var result = { directDomains: [], masks: [] };
    if (!wrapperEl) return result;

    var fullText = (wrapperEl.innerText || wrapperEl.textContent || "").replace(/\s+/g, " ");
    var step3Match = fullText.match(/Bước\s*3\s*[:.\-]?([\s\S]*?)(?:Bước\s*4|$)/i);
    var segments = [];
    if (step3Match && step3Match[1]) {
      segments.push(step3Match[1]);
    }
    segments.push(fullText);

    var seenMasks = {};
    var seenDomains = {};

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

      if (i === 0 && result.masks.length === 0) {
        var directRegex = /(?:https?:\/\/)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,18}(?:\.[a-z]{2,18})?)\b/gi;
        var directMatch;
        while ((directMatch = directRegex.exec(seg)) !== null) {
          var dom = directMatch[1].toLowerCase().replace(/^www\./, "");
          if (!seenDomains[dom] && isValidDomain(dom) && !isIgnoredDomain(dom)) {
            seenDomains[dom] = true;
            result.directDomains.push(dom);
          }
        }
      }
    }

    return result;
  }

  async function autoOcrAndStartBypass() {
    if (isBypassRunning || isOcrRunning) return;
    isOcrRunning = true;
    updateControlsState();

    try {
      var wrapperEl = document.getElementById("advertise-html-wrapper");
      var hints = extractHintsFromWrapper(wrapperEl);
      cleanupLink4mDomClutter();

      if (hints.directDomains.length > 0) {
        var directDomain = hints.directDomains[0];
        var directUrl = "https://" + directDomain;
        if (ui.urlInput) ui.urlInput.value = directUrl;
        isOcrRunning = false;
        updateControlsState();
        setStatus("✓ Đã lấy domain: " + directDomain, true, "ok");
        await startBypassWithTargetUrl(directUrl);
        return;
      }

      setStatus("Đang lấy ảnh hướng dẫn…", true, "info");
      var imageCandidates = await waitForCampaignImages(wrapperEl, 6000);
      cleanupLink4mDomClutter();

      if (!imageCandidates || imageCandidates.length === 0) {
        setStatus("⊘ Không tìm thấy ảnh camp — hãy nhập URL tay", false, "warn");
        isOcrRunning = false;
        updateControlsState();
        return;
      }

      var detectedDomain = null;
      var maxImagesToTry = Math.min(imageCandidates.length, 2);

      for (var i = 0; i < maxImagesToTry; i++) {
        setStatus("Đang OCR ảnh (" + (i + 1) + "/" + maxImagesToTry + ")…", true, "info");
        detectedDomain = await resolveDomainFromCampaignImage(imageCandidates[i], hints);
        if (detectedDomain) break;
      }

      if (!detectedDomain) {
        setStatus("⊘ Không OCR được domain — hãy xem ảnh camp và nhập tay", false, "warn");
        isOcrRunning = false;
        updateControlsState();
        return;
      }

      var targetUrl = "https://" + detectedDomain;
      if (ui.urlInput) ui.urlInput.value = targetUrl;
      isOcrRunning = false;
      updateControlsState();
      setStatus("✓ Đã OCR: " + detectedDomain + " — bắt đầu giải…", true, "ok");
      await startBypassWithTargetUrl(targetUrl);
    } catch (_) {
      setStatus("⊘ Lỗi tự động OCR — hãy nhập URL tay", false, "warn");
    } finally {
      isOcrRunning = false;
      updateControlsState();
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
          "var __r = eval(" +
          JSON.stringify(scriptCode) +
          ");\nreturn { r: __r, jscd: (typeof jscd !== 'undefined' ? jscd : null) };"
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

  function getOrCreateClientId(uuidName) {
    var storageKey = "_traffic_cid_" + (uuidName || "default");
    try {
      var existing = typeof GM_getValue === "function" ? GM_getValue(storageKey, null) : null;
      if (existing) return existing;
      var generated = generateUuidV4();
      if (typeof GM_setValue === "function") {
        GM_setValue(storageKey, generated);
      }
      return generated;
    } catch (_) {
      return generateUuidV4();
    }
  }

  function buildClientFingerprint(uuidName) {
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
      client_id: getOrCreateClientId(uuidName),
      pathname: parsedUrl.pathname,
      href: parsedUrl.href,
      hostname: parsedUrl.hostname
    };
  }

  function parseWidgetServiceScript(scriptText) {
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

  async function fetchAndValidateWidget(widgetInfo) {
    try {
      var resp = await httpRequest(widgetInfo.link, {
        method: "GET",
        headers: getStandardHeaders()
      });
      if (!resp || resp.status < 200 || resp.status >= 400) {
        return null;
      }
      var body = resp.responseText || "";
      var parsed = parseWidgetServiceScript(body);
      return parsed.ok ? { body: body, v: parsed } : null;
    } catch (_) {
      return null;
    }
  }

  async function runWidgetBypassFlow(widgetInfo, initialContext) {
    var retryCount = 0;
    var questStepId = null;
    var savedJscd = null;
    var totalStep = initialContext.v.totalStep;
    var currentStep = 1;
    var cachedPageContext = initialContext;
    var prefetchPromise = null;
    var phase = "page";
    var endpointName;
    var roles;
    var activeJscd;
    var queryParams;
    var endpointResp;

    function formatStepProgress() {
      return Math.min(currentStep, parseInt(totalStep, 10)) + "/" + totalStep;
    }

    while (true) {
      try {
        if (phase === "page") {
          var scriptBody;
          var parsedWidget;

          if (cachedPageContext) {
            scriptBody = cachedPageContext.body;
            parsedWidget = cachedPageContext.v;
            cachedPageContext = null;
          } else {
            var pageResp = await httpRequest(widgetInfo.link, {
              method: "GET",
              headers: getStandardHeaders()
            });
            scriptBody = pageResp.responseText || "";
            parsedWidget = parseWidgetServiceScript(scriptBody);
            if (!parsedWidget.ok) {
              return;
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
            : buildClientFingerprint(roles.uuidName);

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

          retryCount = 0;
          var clientJsCode = clientJsResp.responseText || "";
          activeJscd = evaluateClientScript(clientJsCode, { jscd: initialJscd }).jscd || initialJscd;

          if (totalStep === "2" && !savedJscd && !prefetchPromise) {
            prefetchPromise = httpRequest(widgetInfo.link, {
              method: "GET",
              headers: getStandardHeaders()
            })
              .then(function (resp) {
                var text = resp.responseText || "";
                var parsed = parseWidgetServiceScript(text);
                return parsed.ok ? { body: text, v: parsed } : null;
              })
              .catch(function () {
                return null;
              });
          }

          await sleepWithCountdown(
            Math.round(waitSeconds * 1000),
            "Chờ bước (" + formatStepProgress() + ")"
          );

          if (currentStep < parseInt(totalStep, 10)) {
            setStatus("Qua bước 2…", true);
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
          retryCount = 0;
          phase = "page";
        }

        var parsedJson;
        var payload;
        try {
          parsedJson = JSON.parse((endpointResp.responseText || "").trim());
          payload = Array.isArray(parsedJson) ? parsedJson[0] : parsedJson;
        } catch (_) {
          return;
        }

        if (!payload) {
          return;
        }

        if (!payload.id) {
          var extractedCode = stripHtmlTags(payload.html || "");
          setStatus("✓ Đã có mã: " + extractedCode, false, "ok");
          return extractedCode || null;
        }

        questStepId = payload.id;
        savedJscd = activeJscd;
        currentStep = Math.min(currentStep + 1, parseInt(totalStep, 10));
        setStatus("Qua bước 2…", true);

        if (prefetchPromise) {
          cachedPageContext = await prefetchPromise;
          prefetchPromise = null;
        }
      } catch (_) {
        if (retryCount >= 5) {
          return;
        }
        retryCount++;
        var backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 16000);
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setStatus(
            "⚠ Mất mạng — chờ kết nối lại để tiếp tục bước " + formatStepProgress(),
            true,
            "warn"
          );
          await waitForOnline(120000);
        }
        await sleepWithCountdown(backoffMs);
      }
    }
  }

  function getFormFieldValue(fieldName) {
    var el =
      document.querySelector('input[name="' + fieldName + '"]') ||
      document.querySelector('textarea[name="' + fieldName + '"]');
    return el && el.value ? String(el.value).trim() : "";
  }

  function getLink4mPostHeaders() {
    return {
      accept: "*/*",
      "accept-language": "vi,en;q=0.9,en-US;q=0.8",
      "cache-control": "no-cache",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      pragma: "no-cache",
      referer: location.href
    };
  }

  function getRecaptchaToken() {
    var fields = document.querySelectorAll(
      '[name="g-recaptcha-response"], textarea#g-recaptcha-response'
    );
    for (var i = 0; i < fields.length; i++) {
      var val = (fields[i].value || "").trim();
      if (val) return val;
    }

    try {
      var grecaptchaObj = window.grecaptcha;
      if (grecaptchaObj && typeof grecaptchaObj.getResponse === "function") {
        for (var widgetId = 0; widgetId < 4; widgetId++) {
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

  async function waitForRecaptchaToken() {
    var cdKey = "recaptcha";
    activeCountdowns[cdKey] = {
      label: "Chờ giải reCaptcha",
      end: Date.now() + 300000,
      dur: 300000
    };
    setStatus("Đang chờ giải reCaptcha…", true);
    var startTime = Date.now();

    try {
      while (Date.now() - startTime < 300000) {
        var token = getRecaptchaToken();
        if (token) {
          delete activeCountdowns[cdKey];
          return token;
        }
        await sleepWithCountdown(500);
      }
    } catch (err) {
      delete activeCountdowns[cdKey];
      throw err;
    }

    delete activeCountdowns[cdKey];
    return null;
  }

  async function submitBypassCode(bypassCode) {
    // Also fill native Link4m password input in #main-form-2 if present
    var nativeCodeInput = document.querySelector(
      '#main-form-2 input[name="password"], input[name="password"]'
    );
    if (nativeCodeInput) {
      nativeCodeInput.value = bypassCode;
    }

    var alias = getFormFieldValue("alias");
    var campaignId = getFormFieldValue("campaign_id");
    var displayId = getFormFieldValue("display_id");
    var prefix = getFormFieldValue("prefix") || bypassCode;

    if (!alias || !campaignId || !displayId) {
      setStatus("⊘ Đã điền mã: " + bypassCode + " (không tìm thấy đủ trường form)", false, "warn");
      return;
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

    var hasRecaptcha = Boolean(
      document.querySelector(
        '[name="g-recaptcha-response"], .g-recaptcha, iframe[src*="recaptcha"], iframe[src*="google.com/recaptcha"]'
      )
    );

    var recaptchaToken = "";
    if (hasRecaptcha) {
      if (ui.noticeBox) ui.noticeBox.style.display = "block";
      try {
        var grecaptchaObj = window.grecaptcha;
        if (grecaptchaObj && typeof grecaptchaObj.execute === "function") {
          var widgetIds = [undefined, 0, 1, 2];
          for (var i = 0; i < widgetIds.length; i++) {
            try {
              var execPromise =
                widgetIds[i] === undefined
                  ? grecaptchaObj.execute()
                  : grecaptchaObj.execute(widgetIds[i]);
              if (execPromise && typeof execPromise.catch === "function") {
                execPromise.catch(function () {});
              }
            } catch (_) {}
          }
        }
      } catch (_) {}

      recaptchaToken = (await waitForRecaptchaToken()) || "";
      hideCaptchaNotice();
      if (!recaptchaToken) {
        setStatus("✗ Chờ reCaptcha quá 5 phút", false, "err");
        return;
      }
    }

    setStatus("Đang lấy URL đích…", true);
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
      encodeURIComponent(recaptchaToken);

    var linkResp;
    try {
      linkResp = await httpRequest(apiHost + "/links/get-link-info", {
        method: "POST",
        data: postData,
        timeout: 30000,
        headers: getLink4mPostHeaders()
      });
    } catch (_) {
      setStatus("✗ Lấy URL thất bại", false, "err");
      return;
    }

    var linkJson = null;
    try {
      linkJson = JSON.parse((linkResp.responseText || "").trim());
    } catch (_) {}

    if (!linkJson || !linkJson.success || !linkJson.url) {
      setStatus("✗ Lấy URL thất bại", false, "err");
      return;
    }

    var finalDestinationUrl = linkJson.url;
    if (ui.resultBox && ui.resultUrlText) {
      ui.resultUrlText.textContent = finalDestinationUrl;
      ui.resultBox.style.display = "block";
    }
    setStatus("✓ Lấy URL thành công", false, "ok");

    try {
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
        timeout: 30000,
        headers: getLink4mPostHeaders()
      }).catch(function () {});
    } catch (_) {}
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
    var scriptRegex =
      /<script[^>]+src=["'](?:https?:)?\/\/([^\/"']+)\/widget\/(service(?:-v\d+)?\.js)\?([^"']*)["']/gi;
    var widgets = [];
    var match;
    while ((match = scriptRegex.exec(html)) !== null) {
      var keyMatch = /(?:^|&)key=([^&"'\s]+)/.exec(match[3] || "");
      if (keyMatch) {
        widgets.push({
          host: match[1],
          key: keyMatch[1],
          file: match[2],
          link: "https://" + match[1] + "/widget/" + match[2] + "?key=" + keyMatch[1]
        });
      }
    }
    return widgets;
  }

  async function startBypassWithTargetUrl(rawUrl) {
    if (isBypassRunning) return;

    var validation = validateTaskUrl(rawUrl);
    if (validation.err === "link4m") {
      setStatus('✗ Đừng nhập URL "Link4m" — hãy nhập URL nhiệm vụ', false, "err");
      return;
    }
    if (validation.err === "empty") {
      setStatus("✗ Chưa nhập URL", false, "err");
      return;
    }
    if (validation.err) {
      setStatus("✗ URL không hợp lệ", false, "err");
      return;
    }

    isBypassRunning = true;
    if (ui.resultBox) ui.resultBox.style.display = "none";
    if (ui.resultUrlText) ui.resultUrlText.textContent = "";
    hideCaptchaNotice();
    updateControlsState();

    try {
      initialTargetUrl = validation.url;
      resolvedTargetUrl = validation.url;
      setStatus("Đang tải trang nhiệm vụ…", true);

      var pageResp = null;
      try {
        pageResp = await httpRequest(initialTargetUrl, {
          method: "GET",
          headers: getStandardHeaders(),
          timeout: 30000
        });
      } catch (_) {}

      if (!pageResp || pageResp.status < 200 || pageResp.status >= 400) {
        setStatus("✗ Không truy cập được trang nhiệm vụ", false, "err");
        isBypassRunning = false;
        updateControlsState();
        return;
      }

      var finalUrl = pageResp.finalUrl || pageResp.responseURL;
      if (finalUrl && finalUrl !== initialTargetUrl) {
        resolvedTargetUrl = finalUrl;
      }

      var widgetList = extractWidgetScriptsFromHtml(pageResp.responseText || "");
      if (widgetList.length === 0) {
        setStatus("✗ Không tìm thấy widget nào trên trang", false, "err");
        isBypassRunning = false;
        updateControlsState();
        return;
      }

      var validWidgets = [];
      for (var i = 0; i < widgetList.length; i++) {
        var ctx = await fetchAndValidateWidget(widgetList[i]);
        if (ctx) {
          validWidgets.push({ w: widgetList[i], ctx: ctx });
        }
      }

      if (validWidgets.length === 0) {
        setStatus("⊘ Không có widget hợp lệ", false, "warn");
        isBypassRunning = false;
        updateControlsState();
        return;
      }

      setStatus("Đang chạy " + validWidgets.length + " widget…", true);
      var results = await Promise.all(
        validWidgets.map(function (item) {
          return runWidgetBypassFlow(item.w, item.ctx);
        })
      );

      var bypassCode = null;
      for (var j = 0; j < results.length; j++) {
        if (results[j]) {
          bypassCode = results[j];
          break;
        }
      }

      if (bypassCode) {
        await submitBypassCode(bypassCode);
      } else {
        setStatus("⊘ Không lấy được mã từ widget", false, "warn");
      }
    } catch (_) {
      setStatus("✗ Có lỗi xảy ra", false, "err");
    } finally {
      isBypassRunning = false;
      updateControlsState();
    }
  }

  function isCloudflareChallengePage() {
    var title = (document.title || "")
      .trim()
      .toLowerCase()
      .replace(/[.…]+/g, "");
    return title === "chờ một chút" || title === "just a moment";
  }

  async function waitForCloudflareChallenge() {
    if (isCloudflareChallengePage()) {
      setStatus("Chờ Cloudflare…", true);
      while (isCloudflareChallengePage()) {
        await sleepWithCountdown(500);
      }
    }
  }

  function hasInitialCaptchaPrompt(rootEl) {
    var headings = (rootEl || document).querySelectorAll("h4");
    for (var i = 0; i < headings.length; i++) {
      var text = (headings[i].textContent || "").replace(/\s+/g, " ");
      if (
        /check captcha để tiếp tục tới trang đích|check the captcha to continue to the landing page/i.test(
          text
        )
      ) {
        return true;
      }
    }
    return false;
  }

  async function waitForAdvertiseContent() {
    var cdKey = "wrapper";
    activeCountdowns[cdKey] = {
      label: "Chờ nội dung trang",
      end: Date.now() + 60000
    };
    setStatus("Chờ nội dung hướng dẫn…", true);

    var startTime = Date.now();
    var wrapperEl = null;
    var needsInitialCaptcha = false;

    try {
      while (Date.now() - startTime < 60000) {
        wrapperEl = document.getElementById("advertise-html-wrapper");
        if (wrapperEl && (wrapperEl.innerHTML || "").trim() !== "") {
          if (hasInitialCaptchaPrompt(wrapperEl)) {
            needsInitialCaptcha = true;
            wrapperEl = null;
          }
          break;
        }
        wrapperEl = null;
        if (hasInitialCaptchaPrompt(document)) {
          needsInitialCaptcha = true;
          break;
        }
        await sleepWithCountdown(300);
      }
    } catch (err) {
      delete activeCountdowns[cdKey];
      throw err;
    }

    delete activeCountdowns[cdKey];

    if (needsInitialCaptcha) {
      setStatus("Hãy giải Captcha để tiếp tục…", false, "warn");
      setUrlInputVisible(false);
      waitForPostCaptchaAdvertiseWrapper();
      return false;
    }

    if (!wrapperEl) {
      setStatus("⛔ Dừng — không có nội dung hướng dẫn", false, "err");
      return false;
    }

    return inspectAdvertiseWrapper(wrapperEl);
  }

  async function inspectAdvertiseWrapper(wrapperEl) {
    setStatus("Đang kiểm tra hướng dẫn…", true);
    var guideHeading = null;
    var startTime = Date.now();

    while (Date.now() - startTime < 10000) {
      var currentWrapper = document.getElementById("advertise-html-wrapper") || wrapperEl;
      var h4 = currentWrapper ? currentWrapper.querySelector("h4") : null;
      if (h4 && /HƯỚNG\s*DẪN\s*LẤY\s*MÃ/i.test(h4.textContent || "")) {
        guideHeading = h4;
        break;
      }
      await sleepWithCountdown(250);
    }

    if (guideHeading) {
      var currentWrapperEl = document.getElementById("advertise-html-wrapper") || wrapperEl;
      var links = currentWrapperEl.querySelectorAll("a[href]");
      var hasGoogleLink = false;
      for (var i = 0; i < links.length; i++) {
        if (/google\.com/i.test(links[i].getAttribute("href") || "")) {
          hasGoogleLink = true;
          break;
        }
      }
      requiresGoogleReferer = hasGoogleLink;
    } else {
      requiresGoogleReferer = false;
    }

    cleanupLink4mDomClutter();
    return true;
  }

  function waitForPostCaptchaAdvertiseWrapper() {
    var pollTimer = setInterval(async function () {
      var wrapperEl = document.getElementById("advertise-html-wrapper");
      if (
        wrapperEl &&
        (wrapperEl.innerHTML || "").trim() !== "" &&
        !hasInitialCaptchaPrompt(wrapperEl)
      ) {
        clearInterval(pollTimer);
        var ok = await inspectAdvertiseWrapper(wrapperEl);
        if (ok) {
          isPageReady = true;
          updateControlsState();
          setUrlInputVisible(true);
          await autoOcrAndStartBypass();
        }
      }
    }, 500);
  }

  function copyTextToClipboard(text) {
    function notifyCopyResult(success) {
      setStatus(success ? "✓ Đã copy URL" : "✗ Copy thất bại", false, success ? "ok" : "err");
    }

    function fallbackCopy() {
      try {
        if (typeof GM_setClipboard === "function") {
          GM_setClipboard(text);
          notifyCopyResult(true);
          return;
        }
        var textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(textarea);
        textarea.select();
        var copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        notifyCopyResult(copied);
      } catch (_) {
        notifyCopyResult(false);
      }
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          notifyCopyResult(true);
        }, fallbackCopy);
        return;
      }
    } catch (_) {}

    fallbackCopy();
  }

  // Hide unnecessary Link4m elements so only Campaign Image, Captcha, and Input/Form remain
  function cleanupLink4mDomClutter() {
    var hideSelectors = [
      "#mainNav",
      "#report-wrapper",
      "#modal-report",
      ".responsive-youtube",
      "iframe.youtube-player"
    ];
    for (var s = 0; s < hideSelectors.length; s++) {
      var found = document.querySelectorAll(hideSelectors[s]);
      for (var f = 0; f < found.length; f++) {
        found[f].style.display = "none";
      }
    }

    var wrapper = document.getElementById("advertise-html-wrapper");
    if (!wrapper) return;

    // Identify campaign image and its <p> wrapper
    var campCandidates = findCampaignImageUrls(wrapper);
    var campImgEl = campCandidates.length > 0 ? campCandidates[0].el : null;
    var campContainerP = campImgEl ? campImgEl.closest("p") || campImgEl : null;

    if (campContainerP) {
      campContainerP.setAttribute("data-l4m-keep", "1");
    }
    if (campImgEl) {
      campImgEl.setAttribute("data-l4m-keep", "1");
    }

    // Identify #main-form-2 and its parent wrapper
    var mainForm = document.getElementById("main-form-2");
    if (mainForm) {
      mainForm.setAttribute("data-l4m-keep", "1");
      if (mainForm.parentElement && mainForm.parentElement !== wrapper) {
        mainForm.parentElement.setAttribute("data-l4m-keep", "1");
      }
    }

    // Hide all other children in #advertise-html-wrapper (instructions, base64 images, Bước 4/5/6, video, report)
    var blocks = wrapper.children;
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      if (block.id === "l4m-inline-controls") continue;

      var hasKeptDescendant =
        block.getAttribute("data-l4m-keep") === "1" ||
        Boolean(
          block.querySelector(
            '[data-l4m-keep="1"], #main-form-2, #l4m-inline-controls, .g-recaptcha, iframe[src*="recaptcha"]'
          )
        );

      if (!hasKeptDescendant) {
        block.style.display = "none";
      } else {
        var children = block.children;
        for (var j = 0; j < children.length; j++) {
          var child = children[j];
          if (child.id === "l4m-inline-controls") continue;

          var keepChild =
            child.getAttribute("data-l4m-keep") === "1" ||
            child === campContainerP ||
            child === campImgEl ||
            child.id === "main-form-2" ||
            Boolean(
              child.querySelector(
                '[data-l4m-keep="1"], #main-form-2, #l4m-inline-controls, .g-recaptcha, iframe[src*="recaptcha"]'
              )
            );

          if (!keepChild) {
            child.style.display = "none";
          }
        }
      }
    }

    // Move inline bypass controls right above #main-form-2 (below campaign image) if #main-form-2 is present
    if (ui.container && mainForm && mainForm.parentElement) {
      var formWrapper = mainForm.parentElement;
      if (formWrapper.parentElement && ui.container.nextSibling !== formWrapper) {
        formWrapper.parentElement.insertBefore(ui.container, formWrapper);
      }
    }
  }

  // Override Link4m UI using Link4m's native Bootstrap classes (no custom CSS)
  function overrideLink4mPageUI() {
    if (ui.container) return;

    var container = document.createElement("div");
    container.id = "l4m-inline-controls";
    container.className = "text-center";
    container.style.marginBottom = "15px";
    container.innerHTML =
      '<div id="l4m-status" class="alert alert-info" style="margin-bottom: 10px;">' +
      '<span id="l4m-statusText">⏳ Đang khởi tạo…</span>' +
      '<div id="l4m-cdwrap" class="progress" style="height: 6px; margin: 8px 0 0 0; display: none;">' +
      '<div id="l4m-cdfill" class="progress-bar progress-bar-info progress-bar-striped active" style="width: 0%;"></div>' +
      "</div>" +
      "</div>" +
      '<div id="l4m-notice" class="alert alert-warning" style="margin-bottom: 10px; display: none;">' +
      "🔓 Hãy giải reCaptcha bên dưới…" +
      "</div>" +
      '<form id="l4m-iform" style="margin-bottom: 10px;" novalidate>' +
      '<div id="l4m-urlwrap" class="input-group">' +
      '<input id="l4m-url" type="url" class="form-control" inputmode="url" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Nhập URL nhiệm vụ (vd: tylekeo.black)" disabled>' +
      '<span class="input-group-btn">' +
      '<button id="l4m-go" type="submit" class="btn btn-primary" disabled>Bắt đầu</button>' +
      "</span>" +
      "</div>" +
      "</form>" +
      '<div id="l4m-result" class="alert alert-success" style="margin-bottom: 10px; display: none;">' +
      '<div id="l4m-rurl" class="well well-sm" style="margin-bottom: 8px; word-break: break-all;"></div>' +
      '<div class="btn-group">' +
      '<button id="l4m-rCopy" type="button" class="btn btn-success btn-sm">Copy URL</button>' +
      '<button id="l4m-rOpen" type="button" class="btn btn-default btn-sm">Mở URL</button>' +
      "</div>" +
      "</div>";

    var hostBox =
      document.querySelector(".box-main .box-body") ||
      document.querySelector(".box-main") ||
      document.body;

    if (hostBox.firstChild) {
      hostBox.insertBefore(container, hostBox.firstChild);
    } else {
      hostBox.appendChild(container);
    }

    ui.container = container;
    ui.statusBox = document.getElementById("l4m-status");
    ui.statusText = document.getElementById("l4m-statusText");
    ui.countdownWrap = document.getElementById("l4m-cdwrap");
    ui.countdownFill = document.getElementById("l4m-cdfill");
    ui.noticeBox = document.getElementById("l4m-notice");
    ui.form = document.getElementById("l4m-iform");
    ui.urlInputWrap = document.getElementById("l4m-urlwrap");
    ui.urlInput = document.getElementById("l4m-url");
    ui.submitBtn = document.getElementById("l4m-go");
    ui.resultBox = document.getElementById("l4m-result");
    ui.resultUrlText = document.getElementById("l4m-rurl");
    ui.copyUrlBtn = document.getElementById("l4m-rCopy");
    ui.openUrlBtn = document.getElementById("l4m-rOpen");

    ui.form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!ui.urlInput.value.trim() && !isBypassRunning && !isOcrRunning) {
        autoOcrAndStartBypass();
      } else {
        startBypassWithTargetUrl(ui.urlInput.value);
      }
    });

    ui.urlInput.addEventListener("keydown", function (ev) {
      if (!ev.isComposing && ev.keyCode !== 229 && (ev.key === "Enter" || ev.keyCode === 13)) {
        ev.preventDefault();
        startBypassWithTargetUrl(ui.urlInput.value);
      }
    });

    ui.copyUrlBtn.addEventListener("click", function () {
      if (ui.resultUrlText.textContent) {
        copyTextToClipboard(ui.resultUrlText.textContent);
      }
    });

    ui.openUrlBtn.addEventListener("click", function () {
      var target = ui.resultUrlText.textContent;
      if (target) {
        try {
          window.open(target, "_blank", "noopener");
        } catch (_) {}
      }
    });

    setInterval(renderStatusAndCountdown, 250);
    updateControlsState();
    cleanupLink4mDomClutter();
  }

  // Detect Browser and OS Info for client fingerprint
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

  // Entry point
  (function initLink4mBypass() {
    if (/^\/go\/not-found/.test(location.pathname)) {
      return;
    }
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", initLink4mBypass, { once: true });
      return;
    }

    overrideLink4mPageUI();

    (async function runStartupFlow() {
      await waitForCloudflareChallenge();
      await new Promise(function (resolve) {
        if (document.readyState === "complete") {
          resolve("already");
          return;
        }
        var done = false;
        var intervalId = setInterval(function () {
          if (document.readyState === "complete") {
            finish("load");
          }
        }, 400);

        function finish(reason) {
          if (!done) {
            done = true;
            clearInterval(intervalId);
            resolve(reason);
          }
        }

        window.addEventListener(
          "load",
          function () {
            finish("load");
          },
          { once: true }
        );
        setTimeout(function () {
          finish("fallback");
        }, 30000);
      });

      var isReady = await waitForAdvertiseContent();
      if (isReady) {
        isPageReady = true;
        updateControlsState();
        setUrlInputVisible(true);
        await autoOcrAndStartBypass();
      }
    })();
  })();
})();
