const http = require('http');

function request(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/* Ouvre un flux SSE, collecte les donnees, resout au timeout ou a la fermeture. */
function getSse(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let resolved = false;
    let data = '';
    let status = 0;
    const req = http.get(url, (res) => {
      status = res.statusCode;
      res.on('data', (chunk) => (data += chunk));
      res.on('aborted', () => { if (!resolved) { resolved = true; resolve({ status, body: data }); } });
      res.on('close', () => { if (!resolved) { resolved = true; resolve({ status, body: data }); } });
      res.on('end', () => { if (!resolved) { resolved = true; resolve({ status, body: data }); } });
    });
    req.on('error', () => { if (!resolved) { resolved = true; resolve({ status: 0, body: data }); } });
    req.setTimeout(timeoutMs, () => {
      try { req.destroy(); } catch {}
      if (!resolved) { resolved = true; resolve({ status, body: data }); }
    });
  });
}

async function login(email, password) {
  const r = await request(
    { hostname: 'localhost', port: 1337, path: '/api/auth/local', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { identifier: email, password: password }
  );
  const j = JSON.parse(r.body);
  return j.jwt;
}

function get(path, token) {
  const h = token ? { 'Authorization': `Bearer ${token}` } : {};
  return request({ hostname: 'localhost', port: 1337, path, method: 'GET', headers: h }, null);
}

async function main() {
  const tokenA = await login('tolotra.randria@mtefop.gov.mg', 'demandeur123');
  const tokenB = await login('hery.rakoto@mtefop.gov.mg', 'depositaire123');
  const encA = encodeURIComponent(tokenA);
  const encB = encodeURIComponent(tokenB);

  console.log('===== SSE : reconnexion apres coupure (utilisateur A) =====');
  const c1 = await getSse(`http://localhost:1337/api/sse/stream?jwt=${encA}`);
  console.log(`Connexion 1: HTTP ${c1.status} | body: ${JSON.stringify(c1.body).slice(0, 140)}`);
  const c2 = await getSse(`http://localhost:1337/api/sse/stream?jwt=${encA}`);
  console.log(`Connexion 2 (reconnexion): HTTP ${c2.status} | body: ${JSON.stringify(c2.body).slice(0, 140)}`);

  console.log('\n===== Outbox : isolation par utilisateur =====');
  const obA = await get('/api/notification-outbox/notifications', tokenA);
  console.log(`Utilisateur A: HTTP ${obA.status} | ${obA.body.slice(0, 200)}`);
  const obB = await get('/api/notification-outbox/notifications', tokenB);
  console.log(`Utilisateur B: HTTP ${obB.status} | ${obB.body.slice(0, 200)}`);
}

main().catch((e) => { console.error('ERREUR:', e.message); process.exit(1); });
