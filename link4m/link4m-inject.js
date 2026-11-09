/* Nvirya Link4M Remote Injector - Anti-CORS Edition */
if (typeof $response === 'undefined') {
  if (typeof $request !== 'undefined' && $request.headers) {
    let reqHeaders = $request.headers;
    delete reqHeaders['Accept-Encoding'];
    delete reqHeaders['accept-encoding'];
    $done({ headers: reqHeaders });
  } else {
    $done({});
  }
} else {
  let headers = $response.headers || {};
  let ct = headers['Content-Type'] || headers['content-type'] || '';
  let status = $response.status;

  if (status === 301 || status === 302 || status === 304 || !ct.includes('text/html')) {
    $done({});
  } else {
    // 1. Xoá sạch CSP
    for (let k in headers) {
      if (/content-security-policy/i.test(k)) delete headers[k];
    }
    
    // 2. Mở full CORS cho response
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Methods'] = '*';
    headers['Access-Control-Allow-Headers'] = '*';

    let body = $response.body || '';
    if (body) {
      body = body.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');

      const injectTag = `
        <script>
          (function() {
            window.unsafeWindow = window;
            
            // Polyfill GM_xmlhttpRequest hỗ trợ xử lý lỗi chi tiết
            const gmFetch = function(details) {
              const method = (details.method || 'GET').toUpperCase();
              const headers = new Headers(details.headers || {});
              
              const opts = {
                method: method,
                headers: headers,
                mode: 'cors',
                credentials: 'omit'
              };
              
              if (details.data && method !== 'GET' && method !== 'HEAD') {
                opts.body = details.data;
              }

              fetch(details.url, opts)
                .then(async res => {
                  const text = await res.text();
                  if (typeof details.onload === 'function') {
                    details.onload({
                      status: res.status,
                      statusText: res.statusText,
                      responseText: text,
                      responseHeaders: res.headers,
                      finalUrl: res.url,
                      readyState: 4
                    });
                  }
                })
                .catch(err => {
                  console.error('[Nvirya Link4M] Fetch error:', err, 'URL:', details.url);
                  // Thử lại với fallback nếu bị chặn
                  if (typeof details.onerror === 'function') details.onerror(err);
                });
            };

            window.GM_xmlhttpRequest = gmFetch;
            window.GM = window.GM || {};
            window.GM.xmlHttpRequest = gmFetch;

            const s = document.createElement('script');
            s.src = 'https://raw.nvirya.com/link4m/link4m.user.js?t=' + Date.now();
            s.crossOrigin = 'anonymous';
            document.head.appendChild(s);
          })();
        </script>
      `;

      if (/<\/head>/i.test(body)) {
        body = body.replace(/<\/head>/i, injectTag + '</head>');
      } else if (/<body[^>]*>/i.test(body)) {
        body = body.replace(/<body[^>]*>/i, '$&' + injectTag);
      } else {
        body = injectTag + body;
      }
    }

    $done({ headers, body });
  }
}
