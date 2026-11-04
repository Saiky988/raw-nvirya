(function (g) {
  var e = function (n, v) {
    try {
      g[n] === v || Object.defineProperty(g, n, { value: v, writable: true, configurable: true });
    } catch (_) {}
  };
  typeof GM > "u" || e("GM", GM);
  typeof GM_info > "u" || e("GM_info", GM_info);
  typeof unsafeWindow > "u" || e("unsafeWindow", unsafeWindow);
  typeof GM_getValue > "u" || e("GM_getValue", GM_getValue);
  typeof GM_setValue > "u" || e("GM_setValue", GM_setValue);
  typeof GM_deleteValue > "u" || e("GM_deleteValue", GM_deleteValue);
  typeof GM_listValues > "u" || e("GM_listValues", GM_listValues);
  typeof GM_getValues > "u" || e("GM_getValues", GM_getValues);
  typeof GM_setValues > "u" || e("GM_setValues", GM_setValues);
  typeof GM_deleteValues > "u" || e("GM_deleteValues", GM_deleteValues);
  typeof GM_addValueChangeListener > "u" || e("GM_addValueChangeListener", GM_addValueChangeListener);
  typeof GM_removeValueChangeListener > "u" || e("GM_removeValueChangeListener", GM_removeValueChangeListener);
  typeof GM_xmlhttpRequest > "u" || e("GM_xmlhttpRequest", GM_xmlhttpRequest);
  typeof GM_download > "u" || e("GM_download", GM_download);
  typeof GM_openInTab > "u" || e("GM_openInTab", GM_openInTab);
  typeof GM_registerMenuCommand > "u" || e("GM_registerMenuCommand", GM_registerMenuCommand);
  typeof GM_unregisterMenuCommand > "u" || e("GM_unregisterMenuCommand", GM_unregisterMenuCommand);
  typeof GM_notification > "u" || e("GM_notification", GM_notification);
  typeof GM_setClipboard > "u" || e("GM_setClipboard", GM_setClipboard);
  typeof GM_addStyle > "u" || e("GM_addStyle", GM_addStyle);
  typeof GM_addElement > "u" || e("GM_addElement", GM_addElement);
  typeof GM_getResourceText > "u" || e("GM_getResourceText", GM_getResourceText);
  typeof GM_getResourceURL > "u" || e("GM_getResourceURL", GM_getResourceURL);
  typeof GM_log > "u" || e("GM_log", GM_log);
  typeof GM_getTab > "u" || e("GM_getTab", GM_getTab);
  typeof GM_saveTab > "u" || e("GM_saveTab", GM_saveTab);
  typeof GM_getTabs > "u" || e("GM_getTabs", GM_getTabs);
  typeof GM_cookie > "u" || e("GM_cookie", GM_cookie);
  typeof GM_webRequest > "u" || e("GM_webRequest", GM_webRequest);
  typeof cloneInto > "u" || e("cloneInto", cloneInto);
  typeof exportFunction > "u" || e("exportFunction", exportFunction);
  typeof createObjectIn > "u" || e("createObjectIn", createObjectIn);
})(typeof globalThis < "u" ? globalThis : self);

(function fn_h$(h$_p0) {
  var h$_v1, h$_v3, h$_v4;
  h$_v4 = "t1WlnhRTsjwkyKHfZr4FbPLmSJ72pNYUM+6c0Gagi9D8CBv3deuAxIzXVq5oOQ/E~";
  h$_v3 = h$_v4[64];
  h$_v1 = {};
  h$_p0.__gve_d = (function fn_vd(vd_p0) {
    return JSON.parse((function fn_B_(B__p0) {
      var B__v1, B__v2, B__v3, B__v5, B__v6, B__v7, B__v12;
      B__v7 = B__p0.split("").filter((function fn_Yd(Yd_p0) {
        return (Yd_p0 !== h$_v3);
      })).join("");
      B__v1 = [];
      B__v2 = 0;
      B__v12 = B__v7.length;
      while ((B__v2 < B__v12)) {
        B__v6 = h$_v4.indexOf(B__v7[B__v2]);
        B__v3 = h$_v4.indexOf(B__v7[(B__v2 + 1)]);
        B__v5 = ((((B__v6 << 18) | (B__v3 << 12)) | (((undefined !== B__v7[(B__v2 + 2)]) ? h$_v4.indexOf(B__v7[(B__v2 + 2)]) : 0) << 6)) | ((undefined !== B__v7[(B__v2 + 3)]) ? h$_v4.indexOf(B__v7[(B__v2 + 3)]) : 0));
        B__v1.push(((B__v5 >> 16) & 255));
        ((undefined !== B__v7[(B__v2 + 2)]) && B__v1.push(((B__v5 >> 8) & 255)));
        ((undefined !== B__v7[(B__v2 + 3)]) && B__v1.push((255 & B__v5)));
        B__v2 = (B__v2 + 4);
      }
      return new TextDecoder().decode(new Uint8Array(B__v1));
    })(vd_p0));
  });
  h$_p0.__gve_reg = (function fn_K_(K__p0, K__p1) {
    h$_v1[K__p0] = K__p1;
    return K__p1;
  });
  h$_p0.__gve_c = (function fn_D$(D$_p0, D$_p1) {
    return h$_v1[D$_p0].apply(this, D$_p1);
  });
  return;
})(typeof globalThis < "u" ? globalThis : self);
(function fn_g$() {
  var g$_v0, g$_v1, g$_v2, g$_v3, g$_v4, g$_v5, g$_v6, g$_v7, g$_v8, g$_v9, g$_v10, g$_v11, g$_v12, g$_v13, g$_v14, g$_v15, g$_v16, g$_v17, g$_v18, g$_v19, g$_v20, g$_v21, g$_v22, g$_v23, g$_v24, g$_v25, g$_v26, g$_v27, g$_v28, g$_v29, g$_v30, g$_v31, g$_v32, g$_v33, g$_v34, g$_v35, g$_v36, g$_v37, g$_v38, g$_v39, g$_v40, g$_v41, g$_v42, g$_v43, g$_v44, g$_v45, g$_v46, g$_v47, g$_v48, g$_v49, g$_v50, g$_v51, g$_v52, g$_v53, g$_v54, g$_v55, g$_v56, g$_v57, g$_v58, g$_v59, g$_v60, g$_v61, g$_v62, g$_v63, g$_v64, g$_v65, g$_v66, g$_v67, g$_v68, g$_v69, g$_v70, g$_v71, g$_v72, g$_v74, g$_v75, g$_v76, g$_v77;
  g$_v10 = (function fn_q$(q$_p0, q$_p1) {
    return (q$_p0 ? (q$_p0 = String(q$_p0), q$_p1 = (q$_p1 || 80), ((q$_p0.length > q$_p1) ? (q$_p0.slice(0, q$_p1) + "…") : q$_p0)) : (""));
  });
  g$_v77 = (function fn_fd(fd_p0) {
    g$_v48.open = (!(!fd_p0));
    (g$_v48.panel && (g$_v48.panel.style.display = (g$_v48.open ? "" : "none")));
    (g$_v48.fab && (g$_v48.fab.style.display = (g$_v48.open ? "none" : "")));
    return;
  });
  g$_v72 = (function fn_Nd(Nd_p0, Nd_p1, Nd_p2) {
    g$_v32 = String((Nd_p0 || ""));
    g$_v63 = (Nd_p2 || "");
    (("boolean" == typeof Nd_p1) && (g$_v50 = Nd_p1));
    g$_v31();
    return;
  });
  g$_v31 = (function fn_A$() {
    var A$_v0, A$_v2, A$_v3, A$_v5, A$_v6, A$_v9, A$_v10, A$_v11, A$_v12, A$_v13;
    if (g$_v48.statusText) {
      (g$_v48.spin && (g$_v48.spin.className = ("spin" + (g$_v50 ? " on" : ""))));
      A$_v2 = Date.now();
      A$_v13 = null;
      A$_v10 = Object.keys(g$_v66);
      A$_v12 = 0;
      while ((A$_v12 < A$_v10.length)) {
        A$_v0 = A$_v10[A$_v12];
        A$_v6 = g$_v66[A$_v0];
        (((!A$_v13) || (A$_v6.end < A$_v13.end)) && (A$_v13 = A$_v6));
        A$_v12 = (A$_v12 + 1);
      }
      if (A$_v13) {
        A$_v11 = Math.max(0, Math.ceil(((A$_v13.end - A$_v2) / 1000)));
        A$_v9 = ((A$_v11 >= 60) ? ((Math.floor((A$_v11 / 60)) + ":") + ("0" + (A$_v11 % 60)).slice((-2))) : (A$_v11 + "s"));
        g$_v48.statusText.className = "";
        A$_v3 = ((((((A$_v13.label ? (String((A$_v5 = A$_v13.label)).replace(/[&<>"]/g, (function fn_Qb(Qb_p0) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[Qb_p0];
          })) + " ") : "") + "<span class=\"cd") + ((A$_v11 <= 10) ? " urgent" : "")) + "\"><i class=\"cddot\"></i>") + A$_v9) + "</span>");
          ((g$_v48.statusText.innerHTML !== A$_v3) && (g$_v48.statusText.innerHTML = A$_v3));
          (g$_v48.cdfill && (g$_v48.cdfill.style.width = ((A$_v13.dur ? Math.max(0, Math.min(100, ((1 - ((A$_v13.end - A$_v2) / A$_v13.dur)) * 100))) : 0) + "%")));
        } else {
          (g$_v48.cdfill && (g$_v48.cdfill.style.width = "0%"));
          g$_v48.statusText.className = ("stx" + (g$_v63 ? (" " + g$_v63) : ""));
          g$_v48.statusText.textContent = g$_v32;
        }
      }
      return;
    });
    g$_v67 = (function fn_Hd() {
      (g$_v48.notice && g$_v48.notice.classList.remove("on"));
      return;
    });
    g$_v13 = (function fn_Hc(Hc_p0) {
      (g$_v48.urlwrap && (g$_v48.urlwrap.style.display = (Hc_p0 ? "" : "none")));
      (g$_v48.go && (g$_v48.go.style.display = (Hc_p0 ? "" : "none")));
      (g$_v48.status && (g$_v48.status.style.borderBottom = ""));
      return;
    });
    g$_v69 = (function fn_Tc() {
      var Tc_v3;
      if ((g$_v48.input && g$_v48.go)) {
        Tc_v3 = ((g$_v23 || g$_v71) || (!g$_v19));
        g$_v48.input.disabled = Tc_v3;
        g$_v48.go.disabled = Tc_v3;
        g$_v48.go.textContent = (g$_v23 ? "Đang chạy…" : (g$_v71 ? "Đang OCR…" : "Bắt đầu"));
      }
      return;
    });
    g$_v64 = (function fn_G(G_p0) {
      var G_v1;
      if ((!G_p0)) {
        return "";
      }
      G_p0 = String(G_p0);
      if (!(/<[a-z][\s\S]*>/i.test(G_p0))) {
        return G_p0.trim();
      }
      G_v1 = document.createElement("div");
      G_v1.innerHTML = G_p0;
      return (G_v1.textContent || "").replace(/\s+/g, " ").trim();
    });
    g$_v43 = (function fn_ha(ha_p0, ha_p1) {
      var ha_v2;
      ha_v2 = null;
      (ha_p1 && (g$_v4++, (g$_v66[(ha_v2 = ("cd" + g$_v4))] = { label: ha_p1, end: (Date.now() + ha_p0), dur: Math.max(1, ha_p0) })));
      return new Promise((function fn_yd(yd_p0) {
        var yd_v3, yd_v4, yd_v5, yd_v6, yd_v7;
        yd_v7 = (function fn_H_() {
          var H__v4;
          if ((!yd_v4)) {
            H__v4 = (yd_v5 - Date.now());
            if ((H__v4 <= 0)) {
              (yd_v4 || (yd_v4 = true, (yd_v6 && clearTimeout(yd_v6)), document.removeEventListener("visibilitychange", yd_v3), window.removeEventListener("focus", yd_v3), yd_p0()));
              return;
            }
            yd_v6 = setTimeout(yd_v7, Math.min(H__v4, 250));
          }
          return;
        });
        yd_v3 = (function fn_K() {
          ((yd_v4 || document.hidden) || ((yd_v6 && (clearTimeout(yd_v6), (yd_v6 = null))), yd_v7()));
          return;
        });
        yd_v5 = (Date.now() + ha_p0);
        yd_v4 = false;
        yd_v6 = null;
        document.addEventListener("visibilitychange", yd_v3);
        window.addEventListener("focus", yd_v3);
        yd_v7();
        return;
      })).then((function fn_ie(ie_p0) {
        (ha_v2 && delete g$_v66[ha_v2]);
        return ie_p0;
      }));
    });
    g$_v7 = (function fn_md(md_p0) {
      return (navigator.onLine ? Promise.resolve() : new Promise((function fn_F$(F$_p0) {
        var F$_v1, F$_v2, F$_v3;
        F$_v2 = (function fn_Ud() {
          (F$_v1 || (F$_v1 = true, window.removeEventListener("online", F$_v2), clearTimeout(F$_v3), F$_p0()));
          return;
        });
        F$_v1 = false;
        F$_v3 = setTimeout(F$_v2, Math.max(1, (md_p0 || 0)));
        window.addEventListener("online", F$_v2);
        return;
      })));
    });
    g$_v47 = (function fn_Cb() {
      return ((function fn_Db() {
        var Db_v0;
        try {
          return new URL(g$_v0).origin;
        } catch (Db_v0) {
          return g$_v0.replace(/\/.*$/, "");
        }
      })() + "/");
    });
    g$_v51 = (function fn_e_() {
      return { accept: "*/*", "accept-language": "vi,en;q=0.9,en-US;q=0.8", "cache-control": "no-cache", pragma: "no-cache", referer: g$_v47() };
    });
    g$_v39 = (function fn_Xc() {
      return { accept: "*/*", "accept-language": "vi,en;q=0.9,en-US;q=0.8", "cache-control": "no-cache", "content-type": "application/x-www-form-urlencoded", pragma: "no-cache", referer: g$_v47() };
    });
    g$_v65 = (function fn_oa(oa_p0, oa_p1) {
      var oa_v3, oa_v4;
      oa_v3 = (function fn_xd(xd_p0) {
        return new Promise((function fn_le(le_p0, le_p1) {
          xd_p0(Object.assign({}, oa_p1, { onload: le_p0, onerror: (function fn_Qc(Qc_p0) {
              le_p1(Error(((function fn_Zf(Zf_p0) {
                var Zf_v2, Zf_v3, Zf_v5, Zf_v6;
                if ((null == Zf_p0)) {
                  return "";
                }
                if (("string" == typeof Zf_p0)) {
                  return (("[object Object]" === Zf_p0) ? "lỗi không xác định" : Zf_p0);
                }
                if ((("string" == typeof Zf_p0.message) && Zf_p0.message)) {
                  return Zf_p0.message;
                }
                if (("object" == typeof Zf_p0)) {
                  Zf_v6 = [];
                  ((Zf_p0.status && (0 !== Zf_p0.status)) && Zf_v6.push(("HTTP " + Zf_p0.status)));
                  (((("string" == typeof Zf_p0.error) && Zf_p0.error) && ("error" !== Zf_p0.error.toLowerCase())) && Zf_v6.push(Zf_p0.error));
                  ((Zf_p0.statusText && ("error" !== String(Zf_p0.statusText).toLowerCase())) && Zf_v6.push(String(Zf_p0.statusText)));
                  ((Zf_v6.length || (0 !== Zf_p0.status)) || Zf_v6.push("lỗi mạng"));
                  (((!Zf_v6.length) && Zf_p0.responseText) && Zf_v6.push(g$_v10(String(Zf_p0.responseText), 100)));
                  if ((!Zf_v6.length)) {
                    try {
                      Zf_v5 = JSON.stringify(Zf_p0);
                      ((Zf_v5 && (Zf_v5.length > 2)) && Zf_v6.push(g$_v10(Zf_v5, 120)));
                    } catch (Zf_v3) {
                    }
                  }
                  if (Zf_v6.length) {
                    return Zf_v6.join(" · ");
                  }
                }
                Zf_v2 = String(Zf_p0);
                return (("[object Object]" === Zf_v2) ? "lỗi không xác định" : g$_v10(Zf_v2, 120));
              })(Qc_p0) || "lỗi mạng")));
              return;
            }), ontimeout: (function fn_Bd() {
              le_p1(Error((("hết thời gian chờ (" + (oa_p1.timeout / 1000)) + "s)")));
              return;
            }), onabort: (function fn_id() {
              le_p1(Error("request bị hủy"));
              return;
            }) }));
          return;
        }));
      });
      ((oa_p1 = Object.assign({}, oa_p1)).method && (oa_p1.method = String(oa_p1.method).toUpperCase()));
      oa_p1.url = oa_p0;
      ((undefined === oa_p1.withCredentials) && (oa_p1.withCredentials = false));
      ((undefined === oa_p1.timeout) && (oa_p1.timeout = 25000));
      return ((("undefined" != typeof GM) && ("function" == typeof GM.xmlHttpRequest)) ? oa_v3((function fn_Wa(Wa_p0) {
        var Wa_v1, Wa_v2;
        try {
          Wa_v2 = GM.xmlHttpRequest(Wa_p0);
          ((Wa_v2 && ("function" == typeof Wa_v2.catch)) && Wa_v2.catch((function fn_ba() {
            return;
          })));
        } catch (Wa_v1) {
          throw Wa_v1;
        }
        return;
      })) : (("function" == typeof GM_xmlhttpRequest) ? oa_v3((function fn_cd(cd_p0) {
        GM_xmlhttpRequest(cd_p0);
        return;
      })) : fetch((oa_v4 = oa_p1).url, { method: (oa_v4.method || "GET"), headers: (oa_v4.headers || {}), body: oa_v4.data, credentials: (oa_v4.withCredentials ? "include" : "omit") }).then((function fn_yf(yf_p0) {
        return (("arraybuffer" === oa_v4.responseType) ? yf_p0.arrayBuffer().then((function fn_C(C_p0) {
          return { status: yf_p0.status, response: C_p0, finalUrl: (yf_p0.url || oa_v4.url) };
        })) : yf_p0.text().then((function fn_b_(b__p0) {
          return { status: yf_p0.status, responseText: b__p0, finalUrl: (yf_p0.url || oa_v4.url) };
        })));
      }))));
    });
    g$_v34 = (function fn__$(_$_p0) {
      var _$_v3;
      return ((!_$_p0) ? (true) : (_$_v3 = String(_$_p0).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""), (!(!(g$_v49.test(_$_v3) || /link4m|google|gstatic|recaptcha|cloudflare/i.test(_$_v3))))));
    });
    g$_v76 = (function fn_uc(uc_p0) {
      var uc_v1, uc_v2, uc_v3, uc_v5, uc_v7;
      if ((!uc_p0)) {
        return false;
      }
      uc_v7 = String(uc_p0).toLowerCase().replace(/^\.+|\.+$/g, "").split(".");
      if ((uc_v7.length < 2)) {
        return false;
      }
      uc_v3 = 0;
      uc_v1 = uc_v7.length;
      while ((uc_v3 < uc_v1)) {
        if ((((!uc_v7[uc_v3]) || (!/^[a-z0-9-]+$/.test(uc_v7[uc_v3]))) || /^-|-$/.test(uc_v7[uc_v3]))) {
          return false;
        }
        uc_v3++;
      }
      uc_v2 = uc_v7.slice((-2)).join(".");
      uc_v5 = uc_v7[(uc_v7.length - 1)];
      return (g$_v40[uc_v2] ? ((uc_v7.length >= 3) && (uc_v7[(uc_v7.length - 3)].length >= 2)) : ((!(!g$_v40[uc_v5])) && (uc_v7[(uc_v7.length - 2)].length >= 2)));
    });
    g$_v33 = (function fn_wc(wc_p0) {
      var wc_v1, wc_v2, wc_v3, wc_v4, wc_v5, wc_v6, wc_v7, wc_v8, wc_v9, wc_v10, wc_v11, wc_v12, wc_v13, wc_v15, wc_v16, wc_v17, wc_v18, wc_v19, wc_v20, wc_v21, wc_v22, wc_v23, wc_v24, wc_v25, wc_v26, wc_v27, wc_v28, wc_v29, wc_v30, wc_v31, wc_v32, wc_v33;
      wc_v22 = (function fn_T$(T$_p0, T$_p1, T$_p2) {
        var T$_v3, T$_v6;
        if ((T$_p0 && ("string" == typeof T$_p0))) {
          T$_v3 = T$_p0.trim();
          if ((!((!T$_v3) || /^about:|^javascript:/i.test(T$_v3)))) {
            (/^\/\//.test(T$_v3) ? (T$_v3 = ("https:" + T$_v3)) : (/^\//.test(T$_v3) && (T$_v3 = (location.origin + T$_v3))));
            if ((/^https?:\/\/|^data:image\/|^blob:/i.test(T$_v3) && (!/google|gstatic|recaptcha|logo|icon|avatar|favicon|banner|spinner|loading|\.svg(?:\?|$)/i.test(T$_v3)))) {
              if (wc_v8[T$_v3]) {
                ((T$_p1 < wc_v8[T$_v3].priority) && (wc_v8[T$_v3].priority = T$_p1));
                return;
              }
              T$_v6 = { url: T$_v3, priority: T$_p1, el: (T$_p2 || null) };
              wc_v8[T$_v3] = T$_v6;
              wc_v25.push(T$_v6);
            }
          }
        }
        return;
      });
      wc_v25 = [];
      wc_v8 = {};
      if (wc_p0) {
        wc_v27 = wc_p0.querySelectorAll("img");
        wc_v18 = 0;
        wc_v2 = wc_v27.length;
        while ((wc_v18 < wc_v2)) {
          wc_v15 = wc_v27[wc_v18];
          wc_v33 = (((((wc_v15.currentSrc || wc_v15.src) || wc_v15.getAttribute("data-src")) || wc_v15.getAttribute("data-lazy-src")) || wc_v15.getAttribute("data-original")) || "");
          if (wc_v33) {
            wc_v6 = (20 + wc_v18);
            ((/\/uploads\/advertiser\//i.test(wc_v33) || /img\.link4m\./i.test(wc_v33)) && (wc_v6 = (/\/1_[^\/]+\.[a-z]+$/i.test(wc_v33) ? 1 : (5 + wc_v18))));
            wc_v4 = "";
            try {
              wc_v3 = wc_v15.parentElement;
              wc_v9 = (wc_v15.previousElementSibling || (wc_v3 ? wc_v3.previousElementSibling : null));
              (wc_v9 && (wc_v4 = (wc_v9.textContent || "")));
            } catch (wc_v1) {
            }
            (/Bước\s*3|website|trang\s*web/i.test(wc_v4) && (wc_v6 = Math.min(wc_v6, 2)));
            wc_v22(wc_v33, wc_v6, wc_v15);
          }
          wc_v18++;
        }
        wc_v12 = wc_p0.querySelectorAll("canvas");
        wc_v32 = 0;
        wc_v16 = wc_v12.length;
        while ((wc_v32 < wc_v16)) {
          try {
            wc_v21 = wc_v12[wc_v32];
            if (((wc_v21.width > 80) && (wc_v21.height > 25))) {
              wc_v24 = wc_v21.toDataURL("image/png");
              ((wc_v24 && (wc_v24.length > 200)) && wc_v22(wc_v24, (3 + wc_v32), null));
            }
          } catch (wc_v30) {
          }
          wc_v32++;
        }
        wc_v13 = wc_p0.querySelectorAll("*");
        wc_v10 = 0;
        wc_v28 = wc_v13.length;
        while ((wc_v10 < wc_v28)) {
          try {
            wc_v23 = (window.getComputedStyle(wc_v13[wc_v10]).backgroundImage || "").match(/url\(["']?([^"')]+)["']?\)/i);
            if ((wc_v23 && wc_v23[1])) {
              wc_v26 = wc_v23[1];
              wc_v31 = (/\/1_[^\/]+\.[a-z]+$/i.test(wc_v26) ? 2 : (15 + wc_v10));
              wc_v22(wc_v26, wc_v31, null);
            }
          } catch (wc_v20) {
          }
          wc_v10++;
        }
      }
      try {
        if ((window.performance && ("function" == typeof performance.getEntriesByType))) {
          wc_v19 = (performance.getEntriesByType("resource") || []);
          wc_v11 = 0;
          wc_v7 = wc_v19.length;
          while ((wc_v11 < wc_v7)) {
            wc_v5 = ((wc_v19[wc_v11] && wc_v19[wc_v11].name) ? String(wc_v19[wc_v11].name) : "");
            if (((wc_v5 && /\/uploads\/advertiser\/|img\.link4m\./i.test(wc_v5)) && /\.(?:jpe?g|png|webp|gif|bmp)(?:\?|$)/i.test(wc_v5))) {
              wc_v29 = (/\/1_[^\/]+\.[a-z]+(?:\?|$)/i.test(wc_v5) ? 1 : (8 + wc_v11));
              wc_v22(wc_v5, wc_v29, null);
            }
            wc_v11++;
          }
        }
      } catch (wc_v17) {
      }
      wc_v25.sort((function fn__f(_f_p0, _f_p1) {
        return (_f_p0.priority - _f_p1.priority);
      }));
      return wc_v25;
    });
    g$_v37 = (async function fn_Ve(Ve_p0, Ve_p1) {
      var Ve_v2, Ve_v3, Ve_v4, Ve_v6;
      Ve_v4 = Date.now();
      Ve_v3 = (Ve_p1 || 6000);
      while (((Date.now() - Ve_v4) < Ve_v3)) {
        Ve_v6 = (document.getElementById("advertise-html-wrapper") || Ve_p0);
        Ve_v2 = g$_v33(Ve_v6);
        if ((Ve_v2.length > 0)) {
          return Ve_v2;
        }
        (await g$_v43(300));
      }
      return g$_v33((document.getElementById("advertise-html-wrapper") || Ve_p0));
    });
    g$_v54 = (async function fn_B(B_p0) {
      var B_v1, B_v2, B_v3, B_v4, B_v5, B_v6, B_v7;
      B_v2 = B_p0.url;
      if (/^data:image\//i.test(B_v2)) {
        return B_v2;
      }
      try {
        B_v6 = (await g$_v65(B_v2, { method: "GET", responseType: "arraybuffer", timeout: 15000, headers: { accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8", referer: location.href } }));
        if (((B_v6 && B_v6.response) && (B_v6.response.byteLength > 100))) {
          B_v7 = "image/jpeg";
          (/\.png(?:\?|$)/i.test(B_v2) ? (B_v7 = "image/png") : (/\.webp(?:\?|$)/i.test(B_v2) && (B_v7 = "image/webp")));
          B_v4 = (function fn_He(He_p0) {
            var He_v1, He_v4, He_v5;
            He_v5 = new Uint8Array(He_p0);
            He_v1 = "";
            He_v4 = 0;
            while ((He_v4 < He_v5.length)) {
              He_v1 = (He_v1 + String.fromCharCode.apply(null, He_v5.subarray(He_v4, (He_v4 + 8192))));
              He_v4 = (He_v4 + 8192);
            }
            return btoa(He_v1);
          })(B_v6.response);
          return ((("data:" + B_v7) + ";base64,") + B_v4);
        }
      } catch (B_v3) {
      }
      if (((B_p0.el && B_p0.el.complete) && (B_p0.el.naturalWidth > 0))) {
        try {
          B_v1 = document.createElement("canvas");
          B_v1.width = B_p0.el.naturalWidth;
          B_v1.height = B_p0.el.naturalHeight;
          B_v1.getContext("2d").drawImage(B_p0.el, 0, 0);
          return B_v1.toDataURL("image/png");
        } catch (B_v5) {
        }
      }
      return null;
    });
    g$_v30 = (async function fn_Rb(Rb_p0, Rb_p1, Rb_p2) {
      var Rb_v3, Rb_v6, Rb_v7, Rb_v8, Rb_v9;
      Rb_v9 = new URLSearchParams();
      Rb_v9.set("base64Image", Rb_p0);
      Rb_v9.set("language", "eng");
      Rb_v9.set("isOverlayRequired", "false");
      Rb_v9.set("scale", "true");
      Rb_v9.set("OCREngine", String((Rb_p1 || 2)));
      Rb_v9.set("detectOrientation", "false");
      Rb_v7 = (await g$_v65("https://api.ocr.space/parse/image", { method: "POST", timeout: 18000, headers: { apikey: (Rb_p2 || "helloworld"), "content-type": "application/x-www-form-urlencoded" }, data: Rb_v9.toString() }));
      if (((!Rb_v7) || (!Rb_v7.responseText))) {
        return "";
      }
      Rb_v6 = JSON.parse(Rb_v7.responseText);
      if (((!Rb_v6) || (!Array.isArray(Rb_v6.ParsedResults)))) {
        return "";
      }
      Rb_v3 = [];
      Rb_v8 = 0;
      while ((Rb_v8 < Rb_v6.ParsedResults.length)) {
        ((Rb_v6.ParsedResults[Rb_v8] && Rb_v6.ParsedResults[Rb_v8].ParsedText) && Rb_v3.push(Rb_v6.ParsedResults[Rb_v8].ParsedText));
        Rb_v8++;
      }
      return Rb_v3.join("\n").trim();
    });
    g$_v12 = (async function fn_tf(tf_p0) {
      var tf_v2, tf_v3, tf_v5;
      try {
        tf_v5 = (await ((undefined !== window.Tesseract) ? Promise.resolve(window.Tesseract) : (g$_v62 || (g$_v62 = new Promise((function fn_pd(pd_p0) {
          var pd_v2;
          pd_v2 = document.createElement("script");
          pd_v2.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
          pd_v2.onload = (function fn_ld() {
            pd_p0((window.Tesseract || null));
            return;
          });
          pd_v2.onerror = (function fn_af() {
            pd_p0(null);
            return;
          });
          (document.head || document.documentElement).appendChild(pd_v2);
          return;
        }))))));
        return (((!tf_v5) || ("function" != typeof tf_v5.recognize)) ? ("") : (tf_v2 = (await tf_v5.recognize(tf_p0, "eng")), (((tf_v2 && tf_v2.data) && tf_v2.data.text) ? String(tf_v2.data.text).trim() : "")));
      } catch (tf_v3) {
        return "";
      }
    });
    g$_v53 = (function fn_pf(pf_p0, pf_p1) {
      var pf_v2, pf_v3, pf_v4, pf_v5, pf_v6, pf_v8, pf_v9;
      pf_p0 = String((pf_p0 || "")).toLowerCase();
      pf_p1 = String((pf_p1 || "")).toLowerCase();
      pf_v4 = pf_p0.length;
      pf_v3 = pf_p1.length;
      pf_v6 = [];
      pf_v8 = 0;
      while ((pf_v8 <= pf_v4)) {
        pf_v6[pf_v8] = [pf_v8];
        pf_v2 = 1;
        while ((pf_v2 <= pf_v3)) {
          pf_v6[pf_v8][pf_v2] = ((0 === pf_v8) ? pf_v2 : 0);
          pf_v2++;
        }
        pf_v8++;
      }
      pf_v9 = 1;
      while ((pf_v9 <= pf_v4)) {
        pf_v5 = 1;
        while ((pf_v5 <= pf_v3)) {
          ((pf_p0[(pf_v9 - 1)] === pf_p1[(pf_v5 - 1)]) ? (pf_v6[pf_v9][pf_v5] = pf_v6[(pf_v9 - 1)][(pf_v5 - 1)]) : (pf_v6[pf_v9][pf_v5] = (1 + Math.min(pf_v6[(pf_v9 - 1)][pf_v5], pf_v6[pf_v9][(pf_v5 - 1)], pf_v6[(pf_v9 - 1)][(pf_v5 - 1)]))));
          pf_v5++;
        }
        pf_v9++;
      }
      return pf_v6[pf_v4][pf_v3];
    });
    g$_v16 = (function fn_me(me_p0, me_p1) {
      var me_v2, me_v3, me_v4, me_v5, me_v6, me_v8, me_v9, me_v10, me_v12, me_v13, me_v14, me_v16, me_v17, me_v18, me_v19, me_v20, me_v21, me_v22, me_v23, me_v24, me_v25, me_v26, me_v27, me_v28, me_v29, me_v30, me_v32, me_v33, me_v34, me_v35, me_v36, me_v37, me_v38;
      me_v38 = (function fn_o$(o$_p0, o$_p1) {
        var o$_v3, o$_v4, o$_v6, o$_v7, o$_v8, o$_v9, o$_v11, o$_v12, o$_v13, o$_v15, o$_v16, o$_v17, o$_v18;
        if (o$_p0) {
          o$_v17 = String(o$_p0).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[\/›><"'(),;:\s].*$/, "").replace(/^\.+|\.+$/g, "");
          if (((o$_v17 && (!(o$_v17.length < 4))) && (!((!g$_v76(o$_v17)) || g$_v34(o$_v17))))) {
            (me_v20[o$_v17] || (me_v20[o$_v17] = { domain: o$_v17, score: 0, count: 0 }));
            o$_v16 = me_v20[o$_v17];
            o$_v8 = (o$_v16.count + 1);
            o$_v16.count = o$_v8;
            o$_v6 = me_v20[o$_v17];
            o$_v18 = (o$_v6.score + (o$_p1 || 10));
            o$_v6.score = o$_v18;
            o$_v15 = 0;
            while ((o$_v15 < me_v19.length)) {
              o$_v7 = me_v19[o$_v15];
              ((o$_v7.regex && o$_v7.regex.test(o$_v17)) ? (o$_v4 = me_v20[o$_v17], o$_v9 = (o$_v4.score + 1000), (o$_v4.score = o$_v9)) : (((o$_v7.suffix && (o$_v17.slice((-o$_v7.suffix.length)) === o$_v7.suffix)) && (o$_v3 = me_v20[o$_v17], o$_v13 = (o$_v3.score + 60), o$_v3.score = o$_v13, ((o$_v7.prefix && (0 === o$_v17.indexOf(o$_v7.prefix))) && (o$_v12 = me_v20[o$_v17], o$_v11 = (o$_v12.score + 500), (o$_v12.score = o$_v11)))))));
              o$_v15++;
            }
          }
        }
        return;
      });
      if ((!me_p0)) {
        return null;
      }
      me_v19 = ((me_p1 && me_p1.masks) ? me_p1.masks : []);
      me_v29 = String(me_p0).replace(/https?\s*:\s*\/\s*\//gi, "https://").replace(/([a-z0-9])\s*[,\uff0c]\s*(com\.vn|net\.vn|edu\.vn|org\.vn|vn|com|net|org|io|info|co|me|xyz|app|dev|top|site|online|store|club|pro|tv|cc|gg|asia|biz)\b/gi, "$1.$2").replace(/([a-z0-9])\s+\.\s+(com\.vn|net\.vn|edu\.vn|org\.vn|vn|com|net|org|io|info|co|me|xyz|app|dev|top|site|online|store|club|pro|tv|cc|gg|asia|biz)\b/gi, "$1.$2").replace(/([a-z0-9])\.\s+(com\.vn|net\.vn|edu\.vn|org\.vn|vn|com|net|org|io|info|co|me|xyz|app|dev|top|site|online|store|club|pro|tv|cc|gg|asia|biz)\b/gi, "$1.$2").replace(/([a-z0-9])\s+\.(com\.vn|net\.vn|edu\.vn|org\.vn|vn|com|net|org|io|info|co|me|xyz|app|dev|top|site|online|store|club|pro|tv|cc|gg|asia|biz)\b/gi, "$1.$2");
      me_v20 = {};
      me_v30 = /https?:\/\/([a-z0-9][a-z0-9.\-]{1,61}\.[a-z]{2,}(?:\.[a-z]{2,})?)/gi;
      while ((null !== (me_v5 = me_v30.exec(me_v29)))) {
        me_v38(me_v5[1], 50);
      }
      me_v17 = me_v29.split(/\r?\n/);
      me_v16 = /\b((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\.[a-z]{2,})?)\b/gi;
      me_v37 = 0;
      me_v8 = me_v17.length;
      while ((me_v37 < me_v8)) {
        me_v6 = me_v17[me_v37];
        me_v36 = ((me_v37 < 3) ? 30 : 15);
        me_v16.lastIndex = 0;
        while ((null !== (me_v34 = me_v16.exec(me_v6)))) {
          me_v38(me_v34[1], me_v36);
        }
        me_v37++;
      }
      me_v21 = 0;
      me_v32 = me_v19.length;
      while ((me_v21 < me_v32)) {
        me_v35 = me_v19[me_v21];
        me_v10 = (me_v35.prefix || "");
        me_v3 = (me_v35.suffix || "");
        me_v28 = me_v3.replace(/^\./, "");
        me_v25 = Object.keys(me_v20);
        me_v33 = 0;
        while ((me_v33 < me_v25.length)) {
          me_v13 = me_v25[me_v33];
          if (((me_v3 && (me_v13.slice((-me_v3.length)) === me_v3)) && (me_v10.length >= 3))) {
            me_v22 = g$_v53(me_v13.slice(0, me_v10.length), me_v10);
            (((me_v22 > 0) && (me_v22 <= 2)) && me_v38((me_v10 + me_v13.slice(me_v10.length)), 800));
          }
          me_v33 = (me_v33 + 1);
        }
        if (((me_v10.length >= 3) && (me_v28.length >= 2))) {
          me_v14 = /\b([a-z0-9-]{5,40})\b/gi;
          while ((null !== (me_v2 = me_v14.exec(me_v29)))) {
            me_v23 = me_v2[1].toLowerCase();
            if (((me_v23.length > (me_v10.length + me_v28.length)) && (me_v23.slice((-me_v28.length)) === me_v28))) {
              me_v12 = me_v23.slice(0, me_v10.length);
              if (((me_v12 === me_v10) || ((me_v10.length >= 4) && (1 >= g$_v53(me_v12, me_v10))))) {
                me_v4 = me_v23.slice(me_v10.length, (me_v23.length - me_v28.length));
                (/^[a-z0-9-]+$/.test(me_v4) && me_v38((((me_v10 + me_v4) + ".") + me_v28), 700));
              }
            }
          }
        }
        me_v21++;
      }
      me_v26 = null;
      me_v18 = Object.keys(me_v20);
      me_v9 = 0;
      while ((me_v9 < me_v18.length)) {
        me_v24 = me_v18[me_v9];
        me_v27 = me_v20[me_v24];
        (((!me_v26) || (me_v27.score > me_v26.score)) && (me_v26 = me_v27));
        me_v9 = (me_v9 + 1);
      }
      return (me_v26 ? me_v26.domain : null);
    });
    g$_v3 = (async function fn_lb(lb_p0, lb_p1) {
      var lb_v3, lb_v4, lb_v5, lb_v6, lb_v7, lb_v8, lb_v9, lb_v13, lb_v14, lb_v16, lb_v18, lb_v19, lb_v20, lb_v21, lb_v22, lb_v23;
      lb_v19 = (await g$_v54(lb_p0));
      if ((!lb_v19)) {
        return null;
      }
      lb_v3 = lb_v19;
      lb_v7 = (await new Promise((function fn_fa(fa_p0) {
        var fa_v2;
        fa_v2 = new Image();
        fa_v2.onload = (function fn_wf() {
          var wf_v0, wf_v1, wf_v3, wf_v5, wf_v8, wf_v9, wf_v10, wf_v11, wf_v12, wf_v13, wf_v14, wf_v15;
          try {
            wf_v12 = ((fa_v2.naturalWidth || fa_v2.width) || 600);
            wf_v13 = ((fa_v2.naturalHeight || fa_v2.height) || 150);
            wf_v8 = [];
            wf_v10 = ((wf_v12 < 900) ? 2 : 1);
            wf_v5 = document.createElement("canvas");
            wf_v5.width = Math.round((wf_v12 * wf_v10));
            wf_v5.height = Math.round((wf_v13 * wf_v10));
            wf_v3 = wf_v5.getContext("2d");
            wf_v3.fillStyle = "#ffffff";
            wf_v3.fillRect(0, 0, wf_v5.width, wf_v5.height);
            wf_v3.imageSmoothingEnabled = true;
            wf_v3.imageSmoothingQuality = "high";
            try {
              wf_v3.filter = "contrast(1.25) brightness(1.02)";
            } catch (wf_v1) {
            }
            wf_v3.drawImage(fa_v2, 0, 0, wf_v5.width, wf_v5.height);
            wf_v8.push(wf_v5.toDataURL("image/jpeg", 0.92));
            if ((wf_v13 >= 70)) {
              wf_v11 = Math.round((0.6 * wf_v13));
              wf_v9 = document.createElement("canvas");
              wf_v9.width = Math.round((2.5 * wf_v12));
              wf_v9.height = Math.round((2.5 * wf_v11));
              wf_v15 = wf_v9.getContext("2d");
              wf_v15.fillStyle = "#ffffff";
              wf_v15.fillRect(0, 0, wf_v9.width, wf_v9.height);
              wf_v15.imageSmoothingEnabled = true;
              wf_v15.imageSmoothingQuality = "high";
              try {
                wf_v15.filter = "contrast(1.35)";
              } catch (wf_v14) {
              }
              wf_v15.drawImage(fa_v2, 0, 0, wf_v12, wf_v11, 0, 0, wf_v9.width, wf_v9.height);
              wf_v8.push(wf_v9.toDataURL("image/jpeg", 0.92));
            }
            wf_v8.push(lb_v3);
            fa_p0(wf_v8);
          } catch (wf_v0) {
            fa_p0([lb_v3]);
          }
          return;
        });
        fa_v2.onerror = (function fn_sd() {
          fa_p0([lb_v3]);
          return;
        });
        fa_v2.src = lb_v3;
        return;
      })));
      lb_v9 = ["helloworld", "K89899142388957", "K81724188988957"];
      lb_v5 = "";
      lb_v23 = 0;
      while ((lb_v23 < Math.min(lb_v7.length, 2))) {
        lb_v18 = 0;
        lb_v21 = lb_v9.length;
        while ((lb_v18 < lb_v21)) {
          try {
            lb_v20 = (await g$_v30(lb_v7[lb_v23], 2, lb_v9[lb_v18]));
            if (lb_v20) {
              lb_v5 = (lb_v5 + ("\n" + lb_v20));
              lb_v14 = g$_v16(lb_v5, lb_p1);
              if (lb_v14) {
                return lb_v14;
              }
              break;
            }
          } catch (lb_v13) {
          }
          lb_v18++;
        }
        lb_v23++;
      }
      try {
        lb_v4 = (await g$_v30(lb_v7[0], 1, lb_v9[0]));
        if (lb_v4) {
          lb_v5 = (lb_v5 + ("\n" + lb_v4));
          lb_v8 = g$_v16(lb_v5, lb_p1);
          if (lb_v8) {
            return lb_v8;
          }
        }
      } catch (lb_v22) {
      }
      g$_v72("Đang OCR dự phòng (Tesseract)…", true, "info");
      lb_v16 = (await g$_v12(lb_v7[0]));
      if (lb_v16) {
        lb_v6 = g$_v16((lb_v5 = (lb_v5 + ("\n" + lb_v16))), lb_p1);
        if (lb_v6) {
          return lb_v6;
        }
      }
      return null;
    });
    g$_v56 = (async function fn_Lc() {
      var Lc_v0, Lc_v1, Lc_v3, Lc_v7, Lc_v8, Lc_v10, Lc_v11, Lc_v15, Lc_v16, Lc_v18, Lc_v20, Lc_v21, Lc_v22, Lc_v24;
      if (((!g$_v23) && (!g$_v71))) {
        g$_v71 = true;
        g$_v69();
        try {
          Lc_v0 = document.getElementById("advertise-html-wrapper");
          Lc_v11 = (function fn_Cd(Cd_p0) {
            var Cd_v1, Cd_v2, Cd_v3, Cd_v4, Cd_v5, Cd_v6, Cd_v7, Cd_v8, Cd_v9, Cd_v10, Cd_v11, Cd_v13, Cd_v14, Cd_v15, Cd_v16, Cd_v18, Cd_v19, Cd_v20, Cd_v23, Cd_v24, Cd_v25;
            Cd_v3 = { directDomains: [], masks: [] };
            if ((!Cd_p0)) {
              return Cd_v3;
            }
            Cd_v19 = ((Cd_p0.innerText || Cd_p0.textContent) || "").replace(/\s+/g, " ");
            Cd_v15 = Cd_v19.match(/Bước\s*3\s*[:.\-]?([\s\S]*?)(?:Bước\s*4|$)/i);
            Cd_v24 = [];
            ((Cd_v15 && Cd_v15[1]) && Cd_v24.push(Cd_v15[1]));
            Cd_v24.push(Cd_v19);
            Cd_v13 = {};
            Cd_v18 = {};
            Cd_v16 = 0;
            Cd_v23 = Cd_v24.length;
            while ((Cd_v16 < Cd_v23)) {
              Cd_v11 = Cd_v24[Cd_v16];
              Cd_v20 = /(?:https?:\/\/)?([a-z0-9.\-]*\*+[a-z0-9.*\-]*\.[a-z]{2,}(?:\.[a-z]{2,})?)/gi;
              while ((null !== (Cd_v1 = Cd_v20.exec(Cd_v11)))) {
                Cd_v5 = Cd_v1[1].toLowerCase().replace(/^www\./, "").replace(/^\.+|\.+$/g, "");
                if ((!Cd_v13[Cd_v5])) {
                  Cd_v13[Cd_v5] = true;
                  Cd_v6 = Cd_v5.indexOf("*");
                  Cd_v10 = Cd_v5.lastIndexOf("*");
                  Cd_v25 = Cd_v5.slice(0, Cd_v6);
                  Cd_v4 = Cd_v5.slice((Cd_v10 + 1));
                  Cd_v7 = (("^" + Cd_v5.split(/\*+/).map((function fn_z(z_p0) {
                    return z_p0.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                  })).join("[a-z0-9.-]+")) + "$");
                  try {
                    Cd_v3.masks.push({ raw: Cd_v5, prefix: Cd_v25, suffix: Cd_v4, regex: RegExp(Cd_v7, "i") });
                  } catch (Cd_v14) {
                  }
                }
              }
              if (((0 === Cd_v16) && (0 === Cd_v3.masks.length))) {
                Cd_v8 = /(?:https?:\/\/)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\.[a-z]{2,})?)\b/gi;
                while ((null !== (Cd_v9 = Cd_v8.exec(Cd_v11)))) {
                  Cd_v2 = Cd_v9[1].toLowerCase().replace(/^www\./, "");
                  ((((!Cd_v18[Cd_v2]) && g$_v76(Cd_v2)) && (!g$_v34(Cd_v2))) && (Cd_v18[Cd_v2] = true, Cd_v3.directDomains.push(Cd_v2)));
                }
              }
              Cd_v16++;
            }
            return Cd_v3;
          })(Lc_v0);
          if ((Lc_v11.directDomains.length > 0)) {
            Lc_v3 = Lc_v11.directDomains[0];
            Lc_v21 = ("https://" + Lc_v3);
            g$_v48.input.value = Lc_v21;
            g$_v71 = false;
            g$_v69();
            g$_v72(("✓ Đã lấy domain: " + Lc_v3), true, "ok");
            (await g$_v35(Lc_v21));
            Lc_v24 = undefined;
            g$_v71 = false;
            g$_v69();
            return Lc_v24;
          }
          g$_v72("Đang lấy ảnh hướng dẫn…", true, "info");
          Lc_v15 = (await g$_v37(Lc_v0, 6000));
          if (((!Lc_v15) || (0 === Lc_v15.length))) {
            g$_v72("⊘ Không tìm thấy ảnh hướng dẫn — hãy nhập URL", false, "warn");
            Lc_v10 = undefined;
            g$_v71 = false;
            g$_v69();
            return Lc_v10;
          }
          Lc_v8 = null;
          Lc_v7 = Math.min(Lc_v15.length, 3);
          Lc_v16 = 0;
          while (((Lc_v16 < Lc_v7) && (g$_v72((((("Đang OCR ảnh (" + (Lc_v16 + 1)) + "/") + Lc_v7) + ")…"), true, "info"), (!(Lc_v8 = (await g$_v3(Lc_v15[Lc_v16], Lc_v11))))))) {
            Lc_v16++;
          }
          if ((!Lc_v8)) {
            g$_v72("⊘ Không OCR được domain — hãy nhập tay", false, "warn");
            Lc_v1 = undefined;
            g$_v71 = false;
            g$_v69();
            return Lc_v1;
          }
          Lc_v22 = ("https://" + Lc_v8);
          g$_v48.input.value = Lc_v22;
          g$_v71 = false;
          g$_v69();
          g$_v72((("✓ Đã OCR: " + Lc_v8) + " — bắt đầu giải…"), true, "ok");
          (await g$_v35(Lc_v22));
        } catch (Lc_v20) {
          try {
            g$_v72("⊘ Lỗi tự động OCR — hãy nhập URL tay", false, "warn");
          } catch (Lc_v18) {
            g$_v71 = false;
            g$_v69();
            throw Lc_v18;
          }
        }
        g$_v71 = false;
        g$_v69();
      }
      return;
    });
    g$_v22 = (function fn_lc(lc_p0) {
      return (lc_p0 ? lc_p0.replace(/\\x([0-9A-Fa-f]{2})/g, (function fn_I(I_p0, I_p1) {
        return String.fromCharCode(parseInt(I_p1, 16));
      })) : lc_p0);
    });
    g$_v70 = (function fn_mb(mb_p0, mb_p1) {
      var mb_v3;
      mb_v3 = mb_p0.match(RegExp((("var\\s+" + mb_p1) + "\\s*=\\s*['\"]([^'\"]+)['\"]")));
      return (mb_v3 ? g$_v22(mb_v3[1]) : null);
    });
    g$_v42 = (function fn_N_(N__p0, N__p1) {
      var N__v3;
      N__v3 = N__p0.match(RegExp((("var\\s+" + N__p1) + "\\s*=\\s*['\"]?(-?[0-9]+(?:\\.[0-9]+)?)['\"]?")));
      return (N__v3 ? N__v3[1] : null);
    });
    g$_v61 = (function fn_R$(R$_p0, R$_p1) {
      var R$_v2, R$_v3, R$_v5, R$_v6, R$_v7, R$_v8;
      if (((!R$_p0) || (!String(R$_p0).trim()))) {
        return { ok: true, empty: true, value: undefined, jscd: R$_p1.jscd };
      }
      try {
        R$_v2 = Object.keys((R$_p1 || {}));
        R$_v7 = "";
        R$_v6 = 0;
        R$_v5 = R$_v2.length;
        while ((R$_v6 < R$_v5)) {
          R$_v7 = (R$_v7 + (((("var " + R$_v2[R$_v6]) + " = ") + JSON.stringify(R$_p1[R$_v2[R$_v6]])) + ";\n"));
          R$_v6++;
        }
        R$_v3 = Function((((R$_v7 + "var __r = eval(") + JSON.stringify(R$_p0)) + ");\nreturn { r: __r, jscd: (typeof jscd !== 'undefined' ? jscd : null) };")).call(window);
        return { ok: true, value: R$_v3.r, jscd: (R$_v3.jscd || R$_p1.jscd) };
      } catch (R$_v8) {
        return { ok: false, err: ((R$_v8 && R$_v8.message) ? R$_v8.message : String(R$_v8)), jscd: R$_p1.jscd };
      }
    });
    g$_v59 = (function fn_Q$() {
      var Q$_v1;
      Q$_v1 = new Date().getTime();
      ((window.performance && ("function" == typeof window.performance.now)) && (Q$_v1 = (Q$_v1 + performance.now())));
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (function fn_Mf(Mf_p0) {
        var Mf_v2;
        Mf_v2 = (((Q$_v1 + (16 * Math.random())) % 16) | 0);
        Q$_v1 = Math.floor((Q$_v1 / 16));
        return (("x" == Mf_p0) ? Mf_v2 : ((3 & Mf_v2) | 8)).toString(16);
      }));
    });
    g$_v14 = (function fn_U$(U$_p0) {
      var U$_v1;
      U$_v1 = new URL(g$_v0);
      return { screen: ((screen.width + " x ") + screen.height), browser: g$_v58.browser, browserVersion: g$_v58.browserVersion, browserMajorVersion: g$_v58.browserMajorVersion, mobile: g$_v25, os: g$_v75.os, osVersion: g$_v75.osVersion, cookies: true, flashVersion: "no check", lang: "vi", client_id: (function fn_Fe(Fe_p0) {
          var Fe_v1, Fe_v2, Fe_v3, Fe_v5;
          Fe_v2 = ("_traffic_cid_" + (Fe_p0 || "default"));
          try {
            Fe_v3 = (GM_getValue ? GM_getValue(Fe_v2, null) : null);
            return (Fe_v3 ? (Fe_v3) : (Fe_v1 = g$_v59(), (GM_setValue && GM_setValue(Fe_v2, Fe_v1)), Fe_v1));
          } catch (Fe_v5) {
            return g$_v59();
          }
        })(U$_p0), pathname: U$_v1.pathname, href: U$_v1.href, hostname: U$_v1.hostname };
    });
    g$_v55 = (function fn_kb(kb_p0) {
      var kb_v1, kb_v2, kb_v3, kb_v5, kb_v6, kb_v7;
      kb_v5 = kb_p0;
      if ((!/var\s+get_code\s*=\s*true\s*;/i.test(kb_v5))) {
        return { ok: false, reason: "get_code != true" };
      }
      kb_v6 = (function fn_Y_(Y__p0) {
        var Y__v1, Y__v2, Y__v3, Y__v4, Y__v6;
        Y__v1 = /var\s+ref_domain_list\s*=\s*\[([^\]]*)\]/g;
        Y__v6 = [];
        while ((null !== (Y__v2 = Y__v1.exec(Y__p0)))) {
          Y__v3 = /["']([^"']+)["']/g;
          while ((null !== (Y__v4 = Y__v3.exec(Y__v2[1])))) {
            Y__v6.push(Y__v4[1]);
          }
        }
        return Y__v6;
      })(kb_p0);
      kb_v7 = (g$_v6 ? kb_v6.filter((function fn_Hb(Hb_p0) {
        return /google/i.test(Hb_p0);
      })) : kb_v6.filter((function fn_r$(r$_p0) {
        return (!/google/i.test(r$_p0));
      })));
      if ((g$_v6 && (0 === kb_v7.length))) {
        return { ok: false, reason: (("không có ref google (" + kb_v6.length) + ")") };
      }
      if (((!g$_v6) && (0 !== kb_v6.length))) {
        return { ok: false, reason: (("có ref (" + kb_v6.length) + ")") };
      }
      kb_v3 = (function fn_s_(s__p0) {
        var s__v1, s__v2, s__v3, s__v6;
        s__v1 = /(?:get_code\.html|get_quest_code\.html)/g;
        s__v2 = {};
        s__v3 = [];
        while ((null !== (s__v6 = s__v1.exec(s__p0)))) {
          (s__v2[s__v6[0]] || (s__v2[s__v6[0]] = true, s__v3.push(s__v6[0])));
        }
        return s__v3;
      })(kb_p0);
      if ((0 === kb_v3.length)) {
        return { ok: false, reason: "không có endpoint" };
      }
      kb_v1 = (function fn_r_(r__p0) {
        var r__v1, r__v3, r__v4, r__v5, r__v6, r__v7, r__v8, r__v9, r__v10, r__v11, r__v12, r__v13;
        r__v5 = null;
        r__v6 = null;
        r__v11 = null;
        r__v13 = null;
        r__v1 = null;
        r__v8 = { key: "-", code: "-", session: "-", domain: "-" };
        r__v1 = g$_v70(r__p0, "uuid_name");
        ((r__v13 = g$_v70(r__p0, "traffic_domain")) && (r__v8.domain = "traffic_domain"));
        if ((!r__v13)) {
          r__v3 = r__p0.match(/["']https?:\/\/["']\s*\+\s*([A-Za-z_$][\w$]*)\s*\+\s*["']\/widget\//);
          ((r__v3 && (r__v13 = g$_v70(r__p0, r__v3[1]))) && (r__v8.domain = r__v3[1]));
        }
        r__v7 = r__p0.match(/[?&]key=["']\s*\+\s*([A-Za-z_$][\w$]*)/);
        ((r__v7 && (r__v5 = g$_v70(r__p0, r__v7[1]))) && (r__v8.key = r__v7[1]));
        (((!r__v5) && (r__v5 = g$_v70(r__p0, "traffic_key"))) && (r__v8.key = "traffic_key"));
        r__v12 = r__p0.match(/[?&]code=["']\s*\+\s*([A-Za-z_$][\w$]*)/);
        ((r__v12 && (r__v6 = g$_v70(r__p0, r__v12[1]))) && (r__v8.code = r__v12[1]));
        (((!r__v6) && (r__v6 = g$_v70(r__p0, "traffic_id"))) && (r__v8.code = "traffic_id"));
        r__v4 = r__p0.match(/traffic_session=["']\s*\+\s*([A-Za-z_$][\w$]*)/);
        ((r__v4 && (r__v11 = g$_v70(r__p0, r__v4[1]))) && (r__v8.session = r__v4[1]));
        (((!r__v11) && (r__v11 = g$_v70(r__p0, "traffic_session"))) && (r__v8.session = "traffic_session"));
        if ((!r__v11)) {
          r__v9 = r__p0.match(/var\s+(v[a-f0-9]{5,})\s*=\s*['"]([^'"]+)['"]/i);
          (r__v9 && (r__v11 = g$_v22(r__v9[2]), (r__v8.session = r__v9[1])));
        }
        if ((!r__v11)) {
          r__v10 = r__p0.match(/var\s+([A-Za-z_$][\w$]*)\s*=\s*['"]([0-9a-f]{24})['"]/i);
          (r__v10 && (r__v11 = r__v10[2], (r__v8.session = ("hex24:" + r__v10[1]))));
        }
        return { key: r__v5, code: r__v6, session: r__v11, domain: r__v13, uuidName: r__v1, source: r__v8 };
      })(kb_p0);
      if (((((!kb_v1.key) || (!kb_v1.code)) || (!kb_v1.session)) || (!kb_v1.domain))) {
        return { ok: false, reason: "thiếu key/code/session/domain" };
      }
      kb_v2 = (("get_quest_code.html" === kb_v3[0]) ? "2" : "1");
      return { ok: true, endpoints: kb_v3, roles: kb_v1, totalStep: kb_v2 };
    });
    g$_v52 = (async function fn_Af(Af_p0) {
      var Af_v1, Af_v2, Af_v5, Af_v6;
      try {
        Af_v5 = (await g$_v65(Af_p0.link, { method: "GET", headers: g$_v51() }));
        return ((((!Af_v5) || (Af_v5.status < 200)) || (Af_v5.status >= 400)) ? (null) : (Af_v2 = (Af_v5.responseText || ""), Af_v1 = g$_v55(Af_v2), ((!Af_v1.ok) ? null : { body: Af_v2, v: Af_v1 })));
      } catch (Af_v6) {
        return null;
      }
    });
    g$_v26 = (async function fn_Ma(Ma_p0, Ma_p1) {
      var Ma_v2, Ma_v4, Ma_v5, Ma_v7, Ma_v8, Ma_v10, Ma_v13, Ma_v15, Ma_v17, Ma_v18, Ma_v19, Ma_v20, Ma_v21, Ma_v22, Ma_v23, Ma_v24, Ma_v26, Ma_v27, Ma_v28, Ma_v29, Ma_v30, Ma_v31, Ma_v32, Ma_v35, Ma_v36, Ma_v37, Ma_v40, Ma_v41, Ma_v42, Ma_v43, Ma_v44;
      Ma_v24 = (function fn_ge() {
        return ((Math.min(Ma_v37, parseInt(Ma_v40, 10)) + "/") + Ma_v40);
      });
      Ma_v31 = 0;
      Ma_v27 = null;
      Ma_v35 = null;
      Ma_v40 = Ma_p1.v.totalStep;
      Ma_v37 = 1;
      Ma_v17 = Ma_p1;
      Ma_v8 = null;
      Ma_v32 = "page";
      while (true) {
        try {
          if (("page" === Ma_v32)) {
            if (Ma_v17) {
              Ma_v2 = Ma_v17.body;
              Ma_v19 = Ma_v17.v;
              Ma_v17 = null;
            } else {
              Ma_v2 = ((await g$_v65(Ma_p0.link, { method: "GET", headers: g$_v51() })).responseText || "");
              if ((!(Ma_v19 = g$_v55(Ma_v2)).ok)) {
                return;
              }
            }
            Ma_v40 = Ma_v19.totalStep;
            Ma_v43 = Ma_v19.endpoints[0];
            Ma_v29 = Ma_v19.roles;
            Ma_v15 = g$_v42(Ma_v2, "traffic_wait_time");
            Ma_v5 = (("2" === Ma_v40) ? g$_v42(Ma_v2, "traffic_step_2_wait_time") : null);
            Ma_v20 = (Ma_v35 ? Object.assign({}, Ma_v35) : g$_v14(Ma_v29.uuidName));
            Ma_v28 = new URLSearchParams(Ma_v20).toString();
            Ma_v4 = ((((("traffic_session=" + encodeURIComponent(Ma_v29.session)) + "&key=") + encodeURIComponent(Ma_v29.key)) + "&") + Ma_v28);
            Ma_v42 = (Ma_v35 ? Ma_v5 : Ma_v15);
            Ma_v41 = parseFloat(Ma_v42);
            ((isNaN(Ma_v41) || (Ma_v41 < 0)) && (Ma_v41 = 0));
            Ma_v36 = (await g$_v65((("https://" + Ma_v29.domain) + "/widget/client.js"), { method: "POST", data: Ma_v4, headers: g$_v39() }));
            Ma_v31 = 0;
            Ma_v10 = (Ma_v36.responseText || "");
            Ma_v21 = (g$_v61(Ma_v10, { jscd: Ma_v20 }).jscd || Ma_v20);
            (((("2" !== Ma_v40) || Ma_v35) || Ma_v8) || (Ma_v8 = g$_v65(Ma_p0.link, { method: "GET", headers: g$_v51() }).then((function fn_Xe(Xe_p0) {
              var Xe_v1, Xe_v3;
              Xe_v3 = (Xe_p0.responseText || "");
              Xe_v1 = g$_v55(Xe_v3);
              return (Xe_v1.ok ? { body: Xe_v3, v: Xe_v1 } : null);
            })).catch((function fn_cg() {
              return null;
            }))));
            (await g$_v43(Math.round((1000 * Ma_v41)), (("Chờ bước (" + Ma_v24()) + ")")));
            ((Ma_v37 < parseInt(Ma_v40, 10)) && g$_v72("Qua bước 2…", true));
            Ma_v44 = new URLSearchParams();
            (Ma_v27 && Ma_v44.set("id", Ma_v27));
            Ma_v44.set("code", Ma_v29.code);
            Ma_v44.set("traffic_session", Ma_v29.session);
            Ma_v44.set("key", Ma_v29.key);
            Object.keys(Ma_v21).forEach((function fn_Kd(Kd_p0) {
              (("id" !== Kd_p0) && Ma_v44.append(Kd_p0, Ma_v21[Kd_p0]));
              return;
            }));
            Ma_v32 = "endpoint";
          }
          if (("endpoint" === Ma_v32)) {
            Ma_v30 = (await g$_v65(((((("https://" + Ma_v29.domain) + "/widget/") + Ma_v43) + "?") + Ma_v44.toString()), { method: "GET", headers: g$_v51() }));
            Ma_v31 = 0;
            Ma_v32 = "page";
          }
          try {
            Ma_v13 = JSON.parse((Ma_v30.responseText || "").trim());
            Ma_v7 = (Array.isArray(Ma_v13) ? Ma_v13[0] : Ma_v13);
          } catch (Ma_v18) {
            return;
          }
          if ((!Ma_v7)) {
            return;
          }
          if (!(Ma_v7.id)) {
            Ma_v22 = g$_v64((Ma_v7.html || ""));
            g$_v72("✓ Đã có mã", false, "ok");
            return (Ma_v22 || null);
          }
          Ma_v27 = Ma_v7.id;
          Ma_v35 = Ma_v21;
          Ma_v37 = Math.min((Ma_v37 + 1), parseInt(Ma_v40, 10));
          g$_v72("Qua bước 2…", true);
          (Ma_v8 && (Ma_v17 = (await Ma_v8), (Ma_v8 = null)));
        } catch (Ma_v26) {
          if ((Ma_v31 >= 5)) {
            return;
          }
          Ma_v31++;
          Ma_v23 = Math.min((1000 * Math.pow(2, (Ma_v31 - 1))), 16000);
          ((("undefined" == typeof navigator) || navigator.onLine) || (g$_v72(("⚠ Mất mạng — chờ kết nối lại để tiếp tục bước " + Ma_v24()), true, "warn"), (await g$_v7(120000))));
          (await g$_v43(Ma_v23));
        }
      }
    });
    g$_v57 = (function fn_Ef(Ef_p0) {
      var Ef_v2;
      Ef_v2 = document.querySelector((("input[name=\"" + Ef_p0) + "\"]"));
      (Ef_v2 || (Ef_v2 = document.querySelector((("textarea[name=\"" + Ef_p0) + "\"]"))));
      return ((Ef_v2 && Ef_v2.value) ? String(Ef_v2.value).trim() : "");
    });
    g$_v21 = (function fn_w$() {
      return { accept: "*/*", "accept-language": "vi,en;q=0.9,en-US;q=0.8", "cache-control": "no-cache", "content-type": "application/x-www-form-urlencoded; charset=UTF-8", pragma: "no-cache", referer: location.href };
    });
    g$_v8 = (function fn_M() {
      var M_v0, M_v1, M_v2, M_v3, M_v4, M_v5, M_v6, M_v7, M_v8;
      M_v1 = document.querySelectorAll("[name=\"g-recaptcha-response\"], textarea#g-recaptcha-response");
      M_v6 = 0;
      M_v5 = M_v1.length;
      while ((M_v6 < M_v5)) {
        M_v4 = (M_v1[M_v6].value || "").trim();
        if (M_v4) {
          return M_v4;
        }
        M_v6++;
      }
      try {
        M_v8 = window.grecaptcha;
        if ((M_v8 && ("function" == typeof M_v8.getResponse))) {
          M_v7 = 0;
          while ((M_v7 < 4)) {
            M_v3 = "";
            try {
              M_v3 = (M_v8.getResponse(M_v7) || "").trim();
            } catch (M_v2) {
            }
            if (M_v3) {
              return M_v3;
            }
            M_v7++;
          }
        }
      } catch (M_v0) {
      }
      return "";
    });
    g$_v24 = (async function fn_Ea() {
      var Ea_v0, Ea_v1, Ea_v2, Ea_v6, Ea_v9;
      Ea_v6 = "recaptcha";
      g$_v66[Ea_v6] = { label: "", end: (Date.now() + 300000), dur: 300000 };
      g$_v72("Đang chờ giải reCaptcha…", true);
      Ea_v9 = Date.now();
      try {
        while (((Date.now() - Ea_v9) < 300000)) {
          Ea_v2 = g$_v8();
          if (Ea_v2) {
            Ea_v0 = Ea_v2;
            delete g$_v66[Ea_v6];
            return Ea_v0;
          }
          (await g$_v43(500));
        }
      } catch (Ea_v1) {
        delete g$_v66[Ea_v6];
        throw Ea_v1;
      }
      delete g$_v66[Ea_v6];
      return null;
    });
    g$_v15 = (async function fn_ja(ja_p0) {
      var ja_v1, ja_v3, ja_v4, ja_v6, ja_v8, ja_v9, ja_v10, ja_v12, ja_v13, ja_v14, ja_v17, ja_v19, ja_v21, ja_v22, ja_v23;
      ja_v23 = g$_v57("alias");
      ja_v6 = g$_v57("campaign_id");
      ja_v9 = g$_v57("display_id");
      ja_v14 = g$_v57("prefix");
      if ((((!ja_v23) || (!ja_v6)) || (!ja_v9))) {
        g$_v72("⊘ Không tìm thấy form lấy mã", false, "warn");
        return;
      }
      (ja_v14 || (ja_v14 = ja_p0));
      ja_v19 = (function fn_hf() {
        var hf_v1, hf_v3;
        try {
          hf_v3 = document.documentElement.innerHTML.match(/https:\/\/[a-z0-9-]+\.link4m\.app/gi);
          if ((hf_v3 && hf_v3[0])) {
            return hf_v3[0];
          }
        } catch (hf_v1) {
        }
        return "https://s1.link4m.app";
      })();
      ja_v13 = (!(!document.querySelector("[name=\"g-recaptcha-response\"], .g-recaptcha, iframe[src*=\"recaptcha\"], iframe[src*=\"google.com/recaptcha\"]")));
      ja_v10 = "";
      if ((ja_v13 && ((g$_v48.notice && g$_v48.notice.classList.add("on")), (function fn_I$() {
        var I$_v0, I$_v1, I$_v2, I$_v3, I$_v4, I$_v5, I$_v8;
        try {
          I$_v5 = window.grecaptcha;
          if ((!I$_v5)) {
            return false;
          }
          if (("function" == typeof I$_v5.execute)) {
            I$_v4 = [undefined, 0, 1, 2];
            I$_v3 = 0;
            I$_v1 = I$_v4.length;
            while ((I$_v3 < I$_v1)) {
              try {
                I$_v0 = ((undefined === I$_v4[I$_v3]) ? I$_v5.execute() : I$_v5.execute(I$_v4[I$_v3]));
                ((I$_v0 && ("function" == typeof I$_v0.catch)) && I$_v0.catch((function fn_Ke() {
                  return;
                })));
              } catch (I$_v8) {
              }
              I$_v3++;
            }
          }
        } catch (I$_v2) {
        }
        return false;
      })(), ja_v10 = ((await g$_v24()) || ""), g$_v67(), (!ja_v10)))) {
        g$_v72("✗ Chờ reCaptcha quá 5 phút", false, "err");
        return;
      }
      g$_v72("Đang lấy URL…", true);
      ja_v8 = ((((((((((("password=" + encodeURIComponent(ja_p0)) + "&alias=") + encodeURIComponent(ja_v23)) + "&campaign_id=") + encodeURIComponent(ja_v6)) + "&display_id=") + encodeURIComponent(ja_v9)) + "&prefix=") + encodeURIComponent(ja_v14)) + "&g-recaptcha-response=") + encodeURIComponent(ja_v10));
      try {
        ja_v4 = (await g$_v65((ja_v19 + "/links/get-link-info"), { method: "POST", data: ja_v8, timeout: 30000, headers: g$_v21() }));
      } catch (ja_v3) {
        g$_v72("✗ Lấy URL thất bại", false, "err");
        return;
      }
      ja_v22 = null;
      try {
        ja_v22 = JSON.parse((ja_v4.responseText || "").trim());
      } catch (ja_v12) {
      }
      if ((!ja_v22)) {
        g$_v72("✗ Lấy URL thất bại", false, "err");
        return;
      }
      if (!((ja_v22.success && ja_v22.url))) {
        g$_v72("✗ Lấy URL thất bại", false, "err");
        return;
      }
      ja_v1 = ja_v22.url;
      ((g$_v48.result && g$_v48.rurl) && (g$_v48.rurl.textContent = ja_v1, g$_v48.result.classList.add("on")));
      g$_v72("✓ Lấy URL thành công", false, "ok");
      try {
        ja_v17 = ((((("campaign_id=" + encodeURIComponent(ja_v6)) + "&display_id=") + encodeURIComponent(ja_v9)) + "&code=") + encodeURIComponent(ja_v14));
        g$_v65((ja_v19 + "/widget/click.html"), { method: "POST", data: ja_v17, timeout: 30000, headers: g$_v21() }).catch((function fn_Vb() {
          return;
        }));
      } catch (ja_v21) {
      }
      return;
    });
    g$_v35 = (async function fn_Jf(Jf_p0) {
      var Jf_v2, Jf_v3, Jf_v4, Jf_v7, Jf_v8, Jf_v9, Jf_v10, Jf_v11, Jf_v15, Jf_v16, Jf_v18, Jf_v19, Jf_v20, Jf_v21, Jf_v23, Jf_v25, Jf_v26, Jf_v30;
      if ((!g$_v23)) {
        Jf_v7 = (function fn_kf(kf_p0) {
          var kf_v3, kf_v4, kf_v5;
          kf_v4 = (kf_p0 || "").trim();
          if ((!kf_v4)) {
            return { err: "empty" };
          }
          (/^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\//.test(kf_v4) || (kf_v4 = ("https://" + kf_v4)));
          try {
            kf_v3 = new URL(kf_v4);
          } catch (kf_v5) {
            return { err: "invalid" };
          }
          (("http:" === kf_v3.protocol) && (kf_v3.protocol = "https:"));
          return ((("https:" === kf_v3.protocol) && kf_v3.hostname) ? (/^([a-z0-9\-]+\.)*link4m\.(com|net|org)$/i.test(kf_v3.hostname) ? { err: "link4m" } : { url: kf_v3.href }) : { err: "invalid" });
        })(Jf_p0);
        if (("link4m" === Jf_v7.err)) {
          g$_v72("✗ Đừng nhập URL \"Link4m\" — hãy nhập URL nhiệm vụ", false, "err");
          return;
        }
        if (("empty" === Jf_v7.err)) {
          g$_v72("✗ Chưa nhập URL", false, "err");
          return;
        }
        if (Jf_v7.err) {
          g$_v72("✗ URL không hợp lệ", false, "err");
          return;
        }
        g$_v23 = true;
        (g$_v48.result && g$_v48.result.classList.remove("on"));
        (g$_v48.rurl && (g$_v48.rurl.textContent = ""));
        g$_v67();
        g$_v69();
        try {
          g$_v0 = (g$_v45 = Jf_v7.url);
          g$_v72("Đang tải trang…", true);
          Jf_v11 = null;
          try {
            Jf_v11 = (await g$_v65(g$_v45, { method: "GET", headers: g$_v51(), timeout: 30000 }));
          } catch (Jf_v16) {
          }
          if ((((!Jf_v11) || (Jf_v11.status < 200)) || (Jf_v11.status >= 400))) {
            g$_v72("✗ Không truy cập được trang", false, "err");
            Jf_v4 = undefined;
            g$_v23 = false;
            g$_v69();
            return Jf_v4;
          }
          Jf_v26 = (Jf_v11.finalUrl || Jf_v11.responseURL);
          ((Jf_v26 && (Jf_v26 !== g$_v45)) && (g$_v0 = Jf_v26));
          Jf_v21 = (function fn_Rc(Rc_p0) {
            var Rc_v1, Rc_v3, Rc_v4, Rc_v5;
            Rc_v3 = /<script[^>]+src=["'](?:https?:)?\/\/([^\/"']+)\/widget\/(service(?:-v\d+)?\.js)\?([^"']*)["']/gi;
            Rc_v1 = [];
            while ((null !== (Rc_v4 = Rc_v3.exec(Rc_p0)))) {
              Rc_v5 = /(?:^|&)key=([^&"'\s]+)/.exec((Rc_v4[3] || ""));
              (Rc_v5 && Rc_v1.push({ host: Rc_v4[1], key: Rc_v5[1], file: Rc_v4[2], link: ((((("https://" + Rc_v4[1]) + "/widget/") + Rc_v4[2]) + "?key=") + Rc_v5[1]) }));
            }
            return Rc_v1;
          })((Jf_v11.responseText || ""));
          if ((0 === Jf_v21.length)) {
            g$_v72("✗ Không tìm thấy widget nào", false, "err");
            Jf_v15 = undefined;
            g$_v23 = false;
            g$_v69();
            return Jf_v15;
          }
          Jf_v10 = [];
          Jf_v23 = 0;
          Jf_v3 = Jf_v21.length;
          while ((Jf_v23 < Jf_v3)) {
            Jf_v2 = (await g$_v52(Jf_v21[Jf_v23]));
            (Jf_v2 && Jf_v10.push({ w: Jf_v21[Jf_v23], ctx: Jf_v2 }));
            Jf_v23++;
          }
          if ((0 === Jf_v10.length)) {
            g$_v72("⊘ Không có widget hợp lệ", false, "warn");
            Jf_v9 = undefined;
            g$_v23 = false;
            g$_v69();
            return Jf_v9;
          }
          g$_v72((("Đang chạy " + Jf_v10.length) + " widget…"), true);
          Jf_v25 = (await Promise.all(Jf_v10.map((function fn_e$(e$_p0) {
            return g$_v26(e$_p0.w, e$_p0.ctx);
          }))));
          Jf_v30 = null;
          Jf_v20 = 0;
          Jf_v18 = Jf_v25.length;
          while ((Jf_v20 < Jf_v18)) {
            if (Jf_v25[Jf_v20]) {
              Jf_v30 = Jf_v25[Jf_v20];
              break;
            }
            Jf_v20++;
          }
          (Jf_v30 ? (await g$_v15(Jf_v30)) : g$_v72("⊘ Không lấy được mã từ widget", false, "warn"));
        } catch (Jf_v19) {
          try {
            g$_v72("✗ Có lỗi xảy ra", false, "err");
          } catch (Jf_v8) {
            g$_v23 = false;
            g$_v69();
            throw Jf_v8;
          }
        }
        g$_v23 = false;
        g$_v69();
      }
      return;
    });
    g$_v11 = (function fn_bd() {
      var bd_v1;
      bd_v1 = (document.title || "").trim().toLowerCase().replace(/[.…]+/g, "");
      return (("chờ một chút" === bd_v1) || ("just a moment" === bd_v1));
    });
    g$_v36 = (async function fn_Ja() {
      if (g$_v11()) {
        g$_v72("⏳ Chờ Cloudflare…", true);
        while (g$_v11()) {
          (await g$_v43(500));
        }
      }
      return;
    });
    g$_v68 = (function fn_Zc(Zc_p0) {
      var Zc_v1, Zc_v3, Zc_v4;
      Zc_v3 = (Zc_p0 || document).querySelectorAll("h4");
      Zc_v1 = 0;
      Zc_v4 = Zc_v3.length;
      while ((Zc_v1 < Zc_v4)) {
        if (/check captcha để tiếp tục tới trang đích|check the captcha to continue to the landing page/i.test((Zc_v3[Zc_v1].textContent || "").replace(/\s+/g, " "))) {
          return true;
        }
        Zc_v1++;
      }
      return false;
    });
    g$_v18 = (async function fn_aa() {
      var aa_v0, aa_v1, aa_v2, aa_v4, aa_v5, aa_v6, aa_v8, aa_v9, aa_v10, aa_v15, aa_v16, aa_v17, aa_v18;
      aa_v17 = "wrapper";
      g$_v66[aa_v17] = { label: "Chờ nội dung trang", end: (Date.now() + 60000) };
      g$_v72("Chờ nội dung hướng dẫn…", true);
      aa_v1 = Date.now();
      aa_v10 = null;
      aa_v9 = false;
      try {
        while (((Date.now() - aa_v1) < 60000)) {
          if (((aa_v10 = document.getElementById("advertise-html-wrapper")) && ("" !== (aa_v10.innerHTML || "").trim()))) {
            (g$_v68(aa_v10) && (aa_v9 = true, (aa_v10 = null)));
            break;
          }
          aa_v10 = null;
          if (g$_v68(document)) {
            aa_v9 = true;
            break;
          }
          (await g$_v43(300));
        }
      } catch (aa_v5) {
        delete g$_v66[aa_v17];
        throw aa_v5;
      }
      delete g$_v66[aa_v17];
      if (aa_v9) {
        g$_v72("Chưa có nhiệm vụ — hãy giải reCaptcha để tiếp tục", false, "warn");
        g$_v13(false);
        return false;
      }
      if ((!aa_v10)) {
        g$_v72("⛔ Dừng — không có nội dung hướng dẫn", false, "err");
        return false;
      }
      g$_v72("Đang kiểm tra hướng dẫn…", true);
      aa_v2 = null;
      aa_v0 = Date.now();
      while (((Date.now() - aa_v0) < 10000)) {
        aa_v18 = (document.getElementById("advertise-html-wrapper") || aa_v10);
        aa_v15 = (aa_v18 ? aa_v18.querySelector("h4") : null);
        if ((aa_v15 && /HƯỚNG\s*DẪN\s*LẤY\s*MÃ/i.test((aa_v15.textContent || "")))) {
          aa_v2 = aa_v15;
          break;
        }
        (await g$_v43(250));
      }
      if (aa_v2) {
        aa_v8 = (document.getElementById("advertise-html-wrapper") || aa_v10).querySelectorAll("a[href]");
        aa_v6 = false;
        aa_v16 = 0;
        aa_v4 = aa_v8.length;
        while ((aa_v16 < aa_v4)) {
          if (/google\.com/i.test((aa_v8[aa_v16].getAttribute("href") || ""))) {
            aa_v6 = true;
            break;
          }
          aa_v16++;
        }
        g$_v6 = aa_v6;
      } else {
        g$_v6 = false;
      }
      return true;
    });
    g$_v41 = "";
    try {
      g$_v60 = (("undefined" != typeof GM_info) ? GM_info : (((("undefined" != typeof GM) && GM) && GM.info) ? GM.info : null));
      g$_v1 = ((g$_v60 && g$_v60.script) ? g$_v60.script.version : "");
      ((("string" == typeof g$_v1) && g$_v1) && (g$_v41 = g$_v1));
    } catch (g$_v46) {
      console.error(("[Link4m] Lỗi đọc @version từ GM_info: " + ((g$_v46 && g$_v46.message) ? g$_v46.message : g$_v46)));
    }
    g$_v45 = "";
    g$_v0 = "";
    g$_v6 = false;
    g$_v23 = false;
    g$_v71 = false;
    g$_v19 = false;
    g$_v48 = { root: null, panel: null, fab: null, status: null, statusText: null, spin: null, input: null, go: null, urlwrap: null, store: null, server: null, open: true, result: null, rurl: null, rCopy: null, rOpen: null };
    g$_v32 = "Đang khởi tạo…";
    g$_v63 = "";
    g$_v50 = true;
    g$_v66 = {};
    g$_v4 = 0;
    g$_v5 = ["com.vn", "net.vn", "edu.vn", "org.vn", "gov.vn", "info.vn", "pro.vn", "ac.vn", "health.vn", "name.vn", "co.uk", "org.uk", "com.au", "com.sg", "com.my", "com.ph", "co.jp", "co.kr", "co.id", "co.th", "com.br", "vn", "com", "net", "org", "io", "info", "co", "me", "xyz", "app", "dev", "top", "site", "online", "store", "club", "pro", "tv", "cc", "gg", "asia", "biz", "us", "uk", "ca", "de", "jp", "kr", "sg", "id", "th", "my", "ph", "lat", "icu", "fun", "space", "tech", "website", "lol", "click", "link", "live", "news", "blog", "shop", "vip", "win", "work", "world", "zone", "ai", "to", "sh", "fm", "ly", "gl", "it", "es", "fr", "ru", "br", "in", "au", "nl", "se", "no", "pl", "cz", "ch", "at", "be", "dk", "fi", "gr", "hk", "tw", "nz", "za", "mx", "ar", "cl", "pe", "ve", "ua", "ro", "hu", "tr", "sa", "ae", "pk", "bd", "lk", "np", "mm", "kh", "la", "bn", "mobi", "name", "page", "life", "today", "cloud", "digital", "media", "network", "systems", "solutions", "services", "games", "game", "apk", "download"];
    g$_v40 = {};
    g$_v2 = 0;
    g$_v38 = g$_v5.length;
    while ((g$_v2 < g$_v38)) {
      g$_v40[g$_v5[g$_v2]] = true;
      g$_v2++;
    }
    g$_v49 = /^(?:www\.)?(?:google\.[a-z.]+|link4m\.[a-z.]+|gstatic\.com|googleapis\.com|googleusercontent\.com|cloudflare\.com|youtube\.com|youtu\.be|facebook\.com|fb\.com|chrome\.google\.com|android\.com|apple\.com|microsoft\.com|w3\.org|schema\.org|example\.com)$/i;
    g$_v62 = null;
    g$_v44 = navigator.userAgent;
    g$_v20 = navigator.appVersion;
    g$_v74 = navigator.appName;
    g$_v9 = ("" + parseFloat(g$_v20));
    g$_v29 = parseInt(g$_v20, 10);
    (((-1) != (g$_v17 = g$_v44.indexOf("Opera"))) && (g$_v74 = "Opera", g$_v9 = g$_v44.substring((g$_v17 + 6)), (((-1) != (g$_v17 = g$_v44.indexOf("Version"))) && (g$_v9 = g$_v44.substring((g$_v17 + 8))))));
    (((-1) != (g$_v17 = g$_v44.indexOf("OPR"))) ? (g$_v74 = "Opera", (g$_v9 = g$_v44.substring((g$_v17 + 4)))) : ((((-1) != (g$_v17 = g$_v44.indexOf("MSIE"))) ? (g$_v74 = "Microsoft Internet Explorer", (g$_v9 = g$_v44.substring((g$_v17 + 5)))) : ((((-1) != (g$_v17 = g$_v44.indexOf("Chrome"))) ? (g$_v74 = "Chrome", (g$_v9 = g$_v44.substring((g$_v17 + 7)))) : ((((-1) != (g$_v17 = g$_v44.indexOf("Safari"))) ? (g$_v74 = "Safari", g$_v9 = g$_v44.substring((g$_v17 + 7)), (((-1) != (g$_v17 = g$_v44.indexOf("Version"))) && (g$_v9 = g$_v44.substring((g$_v17 + 8))))) : ((((-1) != (g$_v17 = g$_v44.indexOf("Firefox"))) ? (g$_v74 = "Firefox", (g$_v9 = g$_v44.substring((g$_v17 + 8)))) : ((((-1) != g$_v44.indexOf("Trident/")) ? (g$_v74 = "Microsoft Internet Explorer", (g$_v9 = g$_v44.substring((g$_v44.indexOf("rv:") + 3)))) : ((((g$_v28 = (g$_v44.lastIndexOf(" ") + 1)) < (g$_v17 = g$_v44.lastIndexOf("/"))) && (g$_v74 = g$_v44.substring(g$_v28, g$_v17), g$_v9 = g$_v44.substring((g$_v17 + 1)), ((g$_v74.toLowerCase() == g$_v74.toUpperCase()) && (g$_v74 = navigator.appName))))))))))))))));
    (((-1) != (g$_v27 = g$_v9.indexOf(";"))) && (g$_v9 = g$_v9.substring(0, g$_v27)));
    (((-1) != (g$_v27 = g$_v9.indexOf(" "))) && (g$_v9 = g$_v9.substring(0, g$_v27)));
    (((-1) != (g$_v27 = g$_v9.indexOf(")"))) && (g$_v9 = g$_v9.substring(0, g$_v27)));
    (isNaN((g$_v29 = parseInt(("" + g$_v9), 10))) && (g$_v9 = ("" + parseFloat(g$_v20)), (g$_v29 = parseInt(g$_v20, 10))));
    g$_v58 = { browser: g$_v74, browserVersion: g$_v9, browserMajorVersion: g$_v29 };
    g$_v75 = (function fn_l$() {
      var l$_v0, l$_v1, l$_v2, l$_v3, l$_v5, l$_v6, l$_v7, l$_v8, l$_v9, l$_v10, l$_v11, l$_v12, l$_v14;
      l$_v5 = navigator.userAgent;
      l$_v9 = "-";
      l$_v11 = "-";
      l$_v3 = [{ s: "Windows 10", r: /(Windows 10.0|Windows NT 10.0)/ }, { s: "Windows 8.1", r: /(Windows 8.1|Windows NT 6.3)/ }, { s: "Windows 8", r: /(Windows 8|Windows NT 6.2)/ }, { s: "Windows 7", r: /(Windows 7|Windows NT 6.1)/ }, { s: "Windows Vista", r: /Windows NT 6.0/ }, { s: "Windows Server 2003", r: /Windows NT 5.2/ }, { s: "Windows XP", r: /(Windows NT 5.1|Windows XP)/ }, { s: "Windows 2000", r: /(Windows NT 5.0|Windows 2000)/ }, { s: "Windows ME", r: /(Win 9x 4.90|Windows ME)/ }, { s: "Windows 98", r: /(Windows 98|Win98)/ }, { s: "Windows 95", r: /(Windows 95|Win95|Windows_95)/ }, { s: "Windows NT 4.0", r: /(Windows NT 4.0|WinNT4.0|WinNT|Windows NT)/ }, { s: "Windows CE", r: /Windows CE/ }, { s: "Windows 3.11", r: /Win16/ }, { s: "Android", r: /Android/ }, { s: "Open BSD", r: /OpenBSD/ }, { s: "Sun OS", r: /SunOS/ }, { s: "Linux", r: /(Linux|X11)/ }, { s: "iOS", r: /(iPhone|iPad|iPod)/ }, { s: "Mac OS X", r: /Mac OS X/ }, { s: "Mac OS", r: /(MacPPC|MacIntel|Mac_PowerPC|Macintosh)/ }, { s: "QNX", r: /QNX/ }, { s: "UNIX", r: /UNIX/ }, { s: "BeOS", r: /BeOS/ }, { s: "OS/2", r: /OS\/2/ }, { s: "Search Bot", r: /(nuhk|Googlebot|Yammybot|Openbot|Slurp|MSNBot|Ask Jeeves\/Teoma|ia_archiver)/ }];
      l$_v8 = Object.keys(l$_v3);
      l$_v10 = 0;
      while ((l$_v10 < l$_v8.length)) {
        l$_v1 = l$_v8[l$_v10];
        l$_v12 = l$_v3[l$_v1];
        if (l$_v12.r.test(l$_v5)) {
          l$_v9 = l$_v12.s;
          break;
        }
        l$_v10 = (l$_v10 + 1);
      }
      if (/Windows/.test(l$_v9)) {
        l$_v6 = /Windows (.*)/.exec(l$_v9);
        l$_v11 = (l$_v6 ? l$_v6[1] : "-");
        l$_v9 = "Windows";
      }
      l$_v0 = l$_v9;
      if ((l$_v0 === "Mac OS X")) {
        l$_v2 = /Mac OS X (10[\.\_\d]+)/.exec(l$_v5);
        l$_v11 = (l$_v2 ? l$_v2[1] : "-");
      } else {
        if ((l$_v0 === "Android")) {
          l$_v7 = /Android ([\.\_\d]+)/.exec(l$_v5);
          l$_v11 = (l$_v7 ? l$_v7[1] : "-");
        } else {
          if ((l$_v0 === "iOS")) {
            l$_v14 = /OS (\d+)_(\d+)_?(\d+)?/.exec(navigator.appVersion);
            (l$_v14 && (l$_v11 = ((((l$_v14[1] + ".") + l$_v14[2]) + ".") + (0 | l$_v14[3]))));
          }
        }
      }
      return { os: l$_v9, osVersion: l$_v11 };
    })();
    g$_v25 = /Mobile|mini|Fennec|Android|iP(ad|od|hone)/.test(navigator.appVersion);
    (!(function fn_Gf() {
      if ((!/^\/go\/not-found/.test(location.pathname))) {
        if ((!document.body)) {
          document.addEventListener("DOMContentLoaded", fn_Gf, { once: true });
          return;
        }
        (function fn_Lf() {
          var Lf_v0, Lf_v1, Lf_v6;
          if ((!g$_v48.root)) {
            Lf_v0 = document.createElement("div");
            Lf_v0.id = "l4m-bypass-host";
            Lf_v0.style.cssText = "position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:2147483647;";
            Lf_v1 = Lf_v0.attachShadow({ mode: "open" });
            Lf_v6 = "\n* { box-sizing: border-box; margin: 0; padding: 0;\n    font-family: system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif; }\n.panel { position: relative; width: min(372px, calc(100vw - 24px)); border-radius: 20px; overflow: hidden;\n  color: #e9f4fa; line-height: 1.5;\n  border: 1px solid transparent;\n  background: linear-gradient(180deg, #0c141d, #05080d 62%) padding-box, linear-gradient(160deg, rgba(125,216,245,.75), rgba(150,235,255,.3) 45%, rgba(125,216,245,.5)) border-box;\n  box-shadow: 0 18px 44px rgba(0,0,0,.55), 0 0 26px rgba(88,196,236,.14), inset 0 1px 0 rgba(255,255,255,.05);\n  animation: l4m-pop .26s cubic-bezier(.2,.85,.3,1.1); }\n.panel::before { content: \"\"; position: absolute; top: -70px; right: -60px; width: 190px; height: 190px; border-radius: 50%;\n  background: radial-gradient(circle, rgba(88,196,236,.32), transparent 68%); pointer-events: none; }\n.panel::after { content: \"\"; position: absolute; bottom: -80px; left: -50px; width: 170px; height: 170px; border-radius: 50%;\n  background: radial-gradient(circle, rgba(140,230,255,.16), transparent 70%); pointer-events: none; }\n.panel > * { position: relative; z-index: 1; }\n.head { display: flex; align-items: center; gap: 10px; padding: 12px 14px;\n  border-bottom: 1px solid rgba(255,255,255,.06); }\n.title { flex: 1; min-width: 0; font-size: 14.5px; font-weight: 800; letter-spacing: .2px; color: #e9f4fa;\n  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.ver { flex: none; font-size: 10px; font-weight: 700; letter-spacing: .5px; color: #8fd4ea;\n  background: rgba(88,196,236,.16); border: 1px solid rgba(150,228,250,.3); padding: 2px 7px; border-radius: 999px; }\n.min { flex: none; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;\n  background: transparent; border: 1px solid transparent; border-radius: 9px; color: #93a0b8; font-size: 17px; cursor: pointer;\n  transition: background .15s, color .15s, border-color .15s; }\n.min:hover { background: rgba(255,255,255,.08); color: #e9f4fa; border-color: rgba(255,255,255,.08); }\n.status { position: relative; display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 11px 14px;\n  font-size: 13.5px; color: #c7dde8; border-bottom: 1px solid rgba(255,255,255,.06); }\n#statusText { flex: 1; min-width: 0; word-break: break-word; line-height: 1.5;\n  font-weight: 600; letter-spacing: .1px; transition: color .18s ease; }\n.stx.ok { color: #83d6a6; } .stx.err { color: #f2837a; } .stx.warn { color: #efc67a; }\n.stx.info { color: #8fd4f0; }\n.spin { display: none; width: 12px; height: 12px; flex: none;\n  border: 2px solid rgba(255,255,255,.12); border-top-color: #6fd8f5; border-radius: 50%;\n  animation: l4m-rot .8s linear infinite; }\n.spin.on { display: inline-block; filter: drop-shadow(0 0 5px rgba(125,216,245,.65)); }\n@keyframes l4m-rot { to { transform: rotate(360deg) } }\n.cdline { position: absolute; left: 0; right: 0; bottom: -1px; height: 3px;\n  background: rgba(255,255,255,.05); pointer-events: none; }\n.cdline i { display: block; height: 100%; width: 0%; background: linear-gradient(90deg, #3fb6dd, #7de8ff);\n  box-shadow: 0 0 9px rgba(125,232,255,.55); transition: width .25s linear; }\n.cd { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; padding: 3px 11px 3px 9px; border-radius: 999px; font-size: 12.5px;\n  background: linear-gradient(135deg, rgba(88,196,236,.24), rgba(150,235,255,.14));\n  border: 1px solid rgba(150,228,250,.45); color: #d8f2fc;\n  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: .4px; }\n.cd .cddot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #6fd8f5;\n  box-shadow: 0 0 6px rgba(125,216,245,.85); animation: l4m-pulse 1.1s ease-in-out infinite; }\n@keyframes l4m-pulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: .55; transform: scale(.8) } }\n.cd.urgent { background: linear-gradient(135deg, rgba(233,106,92,.2), rgba(233,106,92,.1));\n  border-color: rgba(233,106,92,.5); color: #ffc4bd; }\n.cd.urgent .cddot { background: #f07a6b; box-shadow: 0 0 6px rgba(240,122,107,.8); }\n.notice { display: none; margin: 12px 14px 0; padding: 10px 12px; align-items: center; gap: 10px; border-radius: 12px;\n  background: linear-gradient(135deg, rgba(88,196,236,.18), rgba(150,235,255,.09));\n  border: 1px solid rgba(150,228,250,.4); }\n.notice.on { display: flex; animation: l4m-in .22s ease; }\n.nico { flex: none; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;\n  font-size: 14px; border-radius: 8px; background: rgba(88,196,236,.24); }\n.ntx { min-width: 0; font-size: 13px; font-weight: 700; color: #d2f1fc; letter-spacing: .2px; }\n.inputrow { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px 13px; }\n.urlwrap { display: flex; align-items: center; gap: 8px; background: rgba(7,11,20,.75);\n  border: 1px solid rgba(255,255,255,.1); border-radius: 12px; padding: 0 12px;\n  transition: border-color .15s, box-shadow .15s; }\n.urlwrap:focus-within { border-color: #56c8ea; box-shadow: 0 0 0 3px rgba(88,196,236,.18); }\n.uic { flex: none; font-size: 13px; opacity: .6; }\n.url { flex: 1; min-width: 0; background: transparent; border: none; outline: none;\n  color: #e9f4fa; padding: 12px 0; font-size: 14px; }\n.url::placeholder { color: #55607a; }\n.url:disabled { opacity: .5; }\n.go { width: 100%; min-height: 44px; border: none; border-radius: 12px; cursor: pointer;\n  background: linear-gradient(135deg, #7de0ff, #3a9fd8); color: #071120;\n  font-size: 14px; font-weight: 800; letter-spacing: .3px;\n  box-shadow: 0 6px 18px rgba(88,196,236,.32), inset 0 1px 0 rgba(255,255,255,.25);\n  transition: transform .12s, filter .15s, box-shadow .15s, opacity .15s; }\n.go:hover:not(:disabled) { filter: brightness(1.07); box-shadow: 0 8px 22px rgba(88,196,236,.42), inset 0 1px 0 rgba(255,255,255,.25); }\n.go:active:not(:disabled) { transform: scale(.98); }\n.go:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; }\n.links { display: flex; gap: 8px; width: 100%; }\n.lbtn { flex: 1; min-height: 42px; border-radius: 12px; cursor: pointer;\n  display: flex; align-items: center; justify-content: center; gap: 6px;\n  font-size: 13.5px; font-weight: 800; letter-spacing: .25px;\n  box-shadow: 0 4px 14px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.08);\n  transition: transform .12s, filter .15s, background .15s, border-color .15s, box-shadow .15s; }\n.lbtn:active { transform: scale(.97); }\n.lbtn.store { background: linear-gradient(135deg, rgba(88,196,236,.18), rgba(150,235,255,.08));\n  border: 1px solid rgba(150,228,250,.38); color: #d8f2fc; }\n.lbtn.store:hover { background: linear-gradient(135deg, rgba(88,196,236,.28), rgba(150,235,255,.15));\n  border-color: rgba(150,228,250,.65); box-shadow: 0 6px 18px rgba(88,196,236,.22), inset 0 1px 0 rgba(255,255,255,.14); filter: brightness(1.06); }\n.lbtn.server { background: linear-gradient(135deg, rgba(114,137,218,.22), rgba(88,101,242,.1));\n  border: 1px solid rgba(138,156,245,.42); color: #dce2ff; }\n.lbtn.server:hover { background: linear-gradient(135deg, rgba(114,137,218,.32), rgba(88,101,242,.18));\n  border-color: rgba(156,172,255,.7); box-shadow: 0 6px 18px rgba(114,137,218,.24), inset 0 1px 0 rgba(255,255,255,.14); filter: brightness(1.06); }\n.result { margin: 0 14px 13px; display: none; border-radius: 14px; overflow: hidden;\n  background: linear-gradient(165deg, rgba(88,171,125,.16), rgba(88,171,125,.05));\n  border: 1px solid rgba(116,199,149,.32); }\n.result.on { display: block; animation: l4m-in .22s ease; }\n.rtag { padding: 10px 12px 0; font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: #8fd8ac; }\n.rurl { margin: 8px 10px 0; padding: 9px 11px; background: rgba(4,10,7,.55);\n  border: 1px solid rgba(116,199,149,.18); border-radius: 10px;\n  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  font-size: 12px; line-height: 1.55; color: #c4e8d2; word-break: break-all;\n  max-height: 80px; overflow-y: auto;\n  scrollbar-width: thin; scrollbar-color: rgba(116,199,149,.35) transparent; }\n.rbtns { display: flex; gap: 8px; padding: 10px 10px 11px; }\n.rbtn { flex: 1; min-height: 42px; border: none; border-radius: 11px; cursor: pointer;\n  font-size: 13px; font-weight: 800; letter-spacing: .2px;\n  transition: transform .12s, filter .15s, background .15s, box-shadow .15s; }\n.rbtn:active { transform: scale(.97); }\n.rbtn.copy { background: linear-gradient(135deg, #66bd90, #4aa274); color: #05130b; box-shadow: 0 4px 14px rgba(88,171,125,.28); }\n.rbtn.copy:hover { filter: brightness(1.06); }\n.rbtn.open { background: rgba(116,199,149,.1); color: #a4dcbd; border: 1px solid rgba(116,199,149,.32); }\n.rbtn.open:hover { background: rgba(116,199,149,.18); }\n@keyframes l4m-in { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }\n@keyframes l4m-pop { from { opacity: 0; transform: translateY(10px) scale(.97) } to { opacity: 1; transform: none } }\n.fab { width: 54px; height: 54px; border-radius: 17px; cursor: pointer; border: 1px solid rgba(150,228,250,.34);\n  background: linear-gradient(160deg, #0e1c26, #070d13);\n  box-shadow: 0 8px 24px rgba(0,0,0,.5), 0 0 16px rgba(88,196,236,.16), inset 0 1px 0 rgba(255,255,255,.07);\n  animation: l4m-pop .22s ease;\n  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease, filter .16s ease; }\n.fab:hover { border-color: rgba(150,228,250,.65); box-shadow: 0 10px 26px rgba(0,0,0,.55), 0 0 20px rgba(88,196,236,.3), inset 0 1px 0 rgba(255,255,255,.12); filter: brightness(1.12); }\n.fab:active { transform: scale(.93); }\nbutton:focus-visible { outline: 2px solid #6fd8f5; outline-offset: 2px; }\n@media (max-width: 480px) {\n  .panel { width: calc(100vw - 14px); }\n  .head { padding: 11px 12px; gap: 9px; }\n  .title { font-size: 14px; }\n  .ver { display: none; }\n  .status { min-height: 42px; padding: 10px 12px; font-size: 13px; }\n  .inputrow { gap: 9px; padding: 11px 12px 12px; }\n  .urlwrap { padding: 0 11px; }\n  .url { font-size: 16px; padding: 11px 0; }\n  .go { min-height: 46px; font-size: 13.5px; }\n  .lbtn { min-height: 44px; font-size: 13px; }\n  .notice { margin: 10px 12px 0; }\n  .result { margin: 0 12px 11px; }\n  .rbtn { min-height: 44px; }\n}\n@media (pointer: coarse) {\n  .url { font-size: 16px; }\n  .min { width: 34px; height: 34px; }\n  .rbtn, .lbtn { min-height: 44px; }\n}\n@media (prefers-reduced-motion: reduce) {\n  .panel, .fab, .result.on, .notice.on { animation: none; }\n  .spin { animation-duration: 1.6s; }\n  .cd .cddot { animation: none; }\n  .cdline i { transition: none; }\n}";
            Lf_v1.innerHTML = (((((("<style>" + Lf_v6) + "</style><div class=\"panel\" id=\"panel\"><div class=\"head\"><span class=\"title\">Link4m (Bypass)</span><span class=\"ver\"") + (g$_v41 ? "" : " style=\"display:none\"")) + ">v") + g$_v41) + "</span><button class=\"min\" id=\"btnMin\" title=\"Thu nhỏ\">−</button></div><div class=\"status\" id=\"status\"><span class=\"spin on\" id=\"spin\"></span><span id=\"statusText\">Đang khởi tạo…</span><span class=\"cdline\" id=\"cdline\"><i id=\"cdfill\"></i></span></div><div class=\"notice\" id=\"notice\"><span class=\"nico\">🔓</span><span class=\"ntx\">Hãy giải reCaptcha…</span></div><form class=\"inputrow\" id=\"iform\" novalidate><div class=\"urlwrap\" id=\"urlwrap\"><span class=\"uic\">🔗</span><input class=\"url\" id=\"url\" type=\"url\" inputmode=\"url\" autocomplete=\"off\" autocapitalize=\"off\" autocorrect=\"off\" spellcheck=\"false\" placeholder=\"Nhập URL (vd: example.com)\" disabled></div><button class=\"go\" id=\"go\" type=\"submit\" disabled>Bắt đầu</button><div class=\"links\"><button class=\"lbtn store\" id=\"btnStore\" type=\"button\">My Store</button><button class=\"lbtn server\" id=\"btnServer\" type=\"button\">My Server</button></div></form><div class=\"result\" id=\"result\"><div class=\"rtag\">✓ URL của bạn</div><div class=\"rurl\" id=\"rurl\"></div><div class=\"rbtns\"><button class=\"rbtn copy\" id=\"rCopy\">⧉ Copy URL</button><button class=\"rbtn open\" id=\"rOpen\">↗ Mở URL</button></div></div></div><button class=\"fab\" id=\"fab\" title=\"Mở Link4m (Bypass)\" aria-label=\"Mở Link4m (Bypass)\"></button>");
            (document.body || document.documentElement).appendChild(Lf_v0);
            g$_v48.root = Lf_v0;
            g$_v48.panel = Lf_v1.getElementById("panel");
            g$_v48.fab = Lf_v1.getElementById("fab");
            g$_v48.status = Lf_v1.getElementById("status");
            g$_v48.statusText = Lf_v1.getElementById("statusText");
            g$_v48.spin = Lf_v1.getElementById("spin");
            g$_v48.input = Lf_v1.getElementById("url");
            g$_v48.go = Lf_v1.getElementById("go");
            g$_v48.urlwrap = Lf_v1.getElementById("urlwrap");
            g$_v48.store = Lf_v1.getElementById("btnStore");
            g$_v48.server = Lf_v1.getElementById("btnServer");
            g$_v48.result = Lf_v1.getElementById("result");
            g$_v48.cdfill = Lf_v1.getElementById("cdfill");
            g$_v48.notice = Lf_v1.getElementById("notice");
            g$_v48.rurl = Lf_v1.getElementById("rurl");
            g$_v48.rCopy = Lf_v1.getElementById("rCopy");
            g$_v48.rOpen = Lf_v1.getElementById("rOpen");
            g$_v48.iform = Lf_v1.getElementById("iform");
            Lf_v1.getElementById("btnMin").addEventListener("click", (function fn_da() {
              g$_v77(false);
              return;
            }));
            g$_v48.fab.addEventListener("click", (function fn_ag() {
              g$_v77(true);
              return;
            }));
            Lf_v1.getElementById("iform").addEventListener("submit", (function fn_Za(Za_p0) {
              Za_p0.preventDefault();
              return ((((!g$_v48.input.value.trim()) && (!g$_v23)) && (!g$_v71)) ? (g$_v56(), undefined) : (g$_v35(g$_v48.input.value), undefined));
            }));
            g$_v48.input.addEventListener("keydown", (function fn_ca(ca_p0) {
              ((((!ca_p0.isComposing) && (229 !== ca_p0.keyCode)) && (("Enter" === ca_p0.key) || (13 === ca_p0.keyCode))) && (ca_p0.preventDefault(), g$_v35(g$_v48.input.value)));
              return;
            }));
            g$_v48.rCopy.addEventListener("click", (function fn_xb() {
              (g$_v48.rurl.textContent && (function fn_X_(X__p0) {
                var X__v3, X__v5, X__v6;
                X__v3 = (function fn_Fc(Fc_p0) {
                  g$_v72((Fc_p0 ? "✓ Đã copy" : "✗ Copy thất bại"), false, (Fc_p0 ? "ok" : "err"));
                  return;
                });
                X__v6 = (function fn_nc() {
                  var nc_v0, nc_v3, nc_v5;
                  try {
                    if (("function" == typeof GM_setClipboard)) {
                      GM_setClipboard(X__p0);
                      return X__v3(true);
                    }
                    nc_v0 = document.createElement("textarea");
                    nc_v0.value = X__p0;
                    nc_v0.style.cssText = "position:fixed;opacity:0";
                    document.body.appendChild(nc_v0);
                    nc_v0.select();
                    nc_v3 = document.execCommand("copy");
                    document.body.removeChild(nc_v0);
                    X__v3(nc_v3);
                  } catch (nc_v5) {
                    X__v3(false);
                  }
                  return;
                });
                try {
                  if ((navigator.clipboard && navigator.clipboard.writeText)) {
                    navigator.clipboard.writeText(X__p0).then((function fn_k() {
                      X__v3(true);
                      return;
                    }), X__v6);
                    return;
                  }
                } catch (X__v5) {
                }
                X__v6();
                return;
              })(g$_v48.rurl.textContent));
              return;
            }));
            g$_v48.rOpen.addEventListener("click", (function fn_C$() {
              var C$_v0, C$_v1;
              C$_v0 = g$_v48.rurl.textContent;
              if (C$_v0) {
                try {
                  window.open(C$_v0, "_blank", "noopener");
                } catch (C$_v1) {
                }
              }
              return;
            }));
            g$_v48.store.addEventListener("click", (function fn_Pe() {
              var Pe_v1;
              try {
                window.open("https://robuxvien.com/home", "_blank", "noopener");
              } catch (Pe_v1) {
              }
              return;
            }));
            g$_v48.server.addEventListener("click", (function fn_a() {
              var a_v1;
              try {
                window.open("https://discord.gg/rcRBbzTfqB", "_blank", "noopener");
              } catch (a_v1) {
              }
              return;
            }));
            setInterval(g$_v31, 250);
            g$_v77(true);
            g$_v69();
          }
          return;
        })();
        (async function fn_R() {
          (await g$_v36());
          (await new Promise((function fn_yc(yc_p0) {
            var yc_v2, yc_v3, yc_v4;
            yc_v3 = (function fn_vb(vb_p0) {
              (yc_v2 || (yc_v2 = true, clearInterval(yc_v4), yc_p0(vb_p0)));
              return;
            });
            return (("complete" === document.readyState) ? (yc_p0("already")) : (yc_v2 = false, yc_v4 = setInterval((function fn_Bb() {
              (("complete" === document.readyState) && yc_v3("load"));
              return;
            }), 400), window.addEventListener("load", (function fn_Xd() {
              yc_v3("load");
              return;
            }), { once: true }), setTimeout((function fn_a_() {
              yc_v3("fallback");
              return;
            }), 30000), undefined));
          })));
          ((await g$_v18()) && (g$_v19 = true, g$_v69(), g$_v13(true), (await g$_v56())));
          return;
        })();
      }
      return;
    })());
    return;
  })();
