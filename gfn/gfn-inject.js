let headers = $response.headers;
let ct = headers['Content-Type'] || headers['content-type'] || '';

// Chỉ can thiệp vào request HTML
if (!ct.includes('text/html')) {
  $done({});
} else {
  // 1. Xóa toàn bộ CSP Headers
  for (let k in headers) {
    if (/content-security-policy/i.test(k)) {
      delete headers[k];
    }
  }

  let body = $response.body;
  if (body) {
    // 2. Lột sạch thẻ <meta http-equiv="Content-Security-Policy" ...> trong HTML
    body = body.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');

    // 3. Tiêm script trực tiếp
    const injectHtml = `
      <script>
        console.log('[Nvirya] Injecting GFN Toolkit v3.0...');
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
