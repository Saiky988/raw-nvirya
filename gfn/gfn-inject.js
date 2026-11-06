let headers = $response.headers;
let ct = headers['Content-Type'] || headers['content-type'] || '';

// Chỉ xử lý nếu response trả về là trang HTML, bỏ qua toàn bộ JS/CSS/ảnh/API
if (!ct.includes('text/html')) {
  $done({});
} else {
  // Xóa sạch các rào cản CSP của GeForce NOW
  delete headers['Content-Security-Policy'];
  delete headers['content-security-policy'];
  delete headers['Content-Security-Policy-Report-Only'];
  delete headers['content-security-policy-report-only'];

  let body = $response.body;
  if (body && body.includes('</head>')) {
    const scriptTag = '<script src="https://raw.nvirya.com/gfn/gfn.user.js?t=' + Date.now() + '"></script>';
    body = body.replace('</head>', scriptTag + '</head>');
  }

  $done({ headers, body });
}
