let headers = $response.headers;
delete headers['Content-Security-Policy'];
delete headers['content-security-policy'];
delete headers['Content-Security-Policy-Report-Only'];
delete headers['content-security-policy-report-only'];

let body = $response.body;
if (body && body.includes('</head>')) {
  const scriptTag = '<script src="https://raw.nvirya.com/gfn/gfn.user.js?t=' + Date.now() + '"></script>';
  body = body.replace('</head>', scriptTag + '</head>');
}

$done({ headers, body });ẻ
