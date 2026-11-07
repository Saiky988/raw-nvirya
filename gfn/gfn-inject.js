let headers = $response.headers;
let ct = headers['Content-Type'] || headers['content-type'] || '';
if (!ct.includes('text/html')) {
  $done({});
} else {
  for (let k in headers) {
    if (/content-security-policy/i.test(k)) {
      delete headers[k];
    }
  }

  let body = $response.body;
  if (body) {
    body = body.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');
    const injectHtml = `
      <script>
        console.log('[Nvirya GeForce NOW] Actived');
        const s = document.createElement('script');
        s.src = 'https://raw.nvirya.com/gfn/gfn.user.js?t=' + Date.now();
        s.crossOrigin = 'anonymous';
        document.head.appendChild(s);
      </script>
    `;

    if (body.includes('</head>')) {
      body = body.replace('</head>', injectHtml + '</head>');
    } else {
      body = injectHtml + body;
    }
  }
  $done({ headers, body });
}
