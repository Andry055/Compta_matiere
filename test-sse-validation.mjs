import http from 'node:http';

const BASE = 'http://localhost:1337';

// Tokens passés via variables d'environnement (jamais affichés en clair)
const TOKEN_A = process.env.SSE_TOKEN_A || '';
const TOKEN_B = process.env.SSE_TOKEN_B || '';

if (!TOKEN_A || !TOKEN_B) {
  console.error('ERREUR: SSE_TOKEN_A et SSE_TOKEN_B doivent être définis.');
  process.exit(1);
}

let passed = 0;
let failed = 0;

function test(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS: ${name}${detail ? ' - ' + detail : ''}`);
  } else {
    failed++;
    console.log(`  FAIL: ${name}${detail ? ' - ' + detail : ''}`);
  }
}

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Ouvre un flux SSE, collecte les événements, résout au timeout ou à la fermeture.
 * Retourne { status, events: [{type, data}] }.
 */
function getSse(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let resolved = false;
    let status = 0;
    let events = [];
    let buffer = '';
    const req = http.get(url, (res) => {
      status = res.statusCode;
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            events.push({ type: line.slice(7) });
          } else if (line.startsWith('data: ')) {
            const last = events[events.length - 1];
            if (last) last.data = line.slice(6);
          }
        }
      });
      res.on('aborted', () => { if (!resolved) { resolved = true; resolve({ status, events }); } });
      res.on('close', () => { if (!resolved) { resolved = true; resolve({ status, events }); } });
      res.on('end', () => { if (!resolved) { resolved = true; resolve({ status, events }); } });
    });
    req.on('error', () => { if (!resolved) { resolved = true; resolve({ status: 0, events }); } });
    req.setTimeout(timeoutMs, () => {
      try { req.destroy(); } catch {}
      if (!resolved) { resolved = true; resolve({ status, events }); }
    });
  });
}

async function main() {
  console.log('===== VALIDATION SSE - GET /api/sse/stream =====\n');

  // ── Test 1: JWT valide (utilisateur A) ──
  console.log('--- Test 1: SSE avec JWT valide (utilisateur A) ---');
  const encA = encodeURIComponent(TOKEN_A);
  const sseA = await getSse(`${BASE}/api/sse/stream?jwt=${encA}`, 5000);
  test('Code HTTP 200', sseA.status === 200, `status=${sseA.status}`);
  const connectedA = sseA.events.find((e) => e.type === 'connected');
  test('Événement "connected" reçu', !!connectedA, `events=${JSON.stringify(sseA.events.map(e=>e.type))}`);
  if (connectedA) {
    try {
      const data = JSON.parse(connectedA.data || '{}');
      test('userId dans connected = 1 (utilisateur A)', data.userId === 1, `userId=${data.userId}`);
    } catch { test('userId parsable', false); }
  }

  // ── Test 2: JWT absent ──
  console.log('\n--- Test 2: SSE sans JWT ---');
  const sseNoJwt = await getSse(`${BASE}/api/sse/stream`, 5000);
  test('Code HTTP 401', sseNoJwt.status === 401, `status=${sseNoJwt.status}`);

  // ── Test 3: JWT invalide ──
  console.log('\n--- Test 3: SSE avec JWT invalide ---');
  const sseBad = await getSse(`${BASE}/api/sse/stream?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.token`, 5000);
  test('Code HTTP 401', sseBad.status === 401, `status=${sseBad.status}`);

  // ── Test 4: Reconnexion après coupure (utilisateur A) ──
  console.log('\n--- Test 4: Reconnexion après coupure (utilisateur A) ---');
  const sseA1 = await getSse(`${BASE}/api/sse/stream?jwt=${encA}`, 3000);
  test('Première connexion HTTP 200', sseA1.status === 200, `status=${sseA1.status}`);
  const sseA2 = await getSse(`${BASE}/api/sse/stream?jwt=${encA}`, 3000);
  test('Deuxième connexion HTTP 200 (reconnexion)', sseA2.status === 200, `status=${sseA2.status}`);
  const connectedA2 = sseA2.events.find((e) => e.type === 'connected');
  test('Événement "connected" sur reconnexion', !!connectedA2);

  // ── Test 5: Isolation utilisateur (A et B simultanés) ──
  console.log('\n--- Test 5: Isolation utilisateur (SSE A et B simultanés) ---');
  const [sseA3, sseB1] = await Promise.all([
    getSse(`${BASE}/api/sse/stream?jwt=${encA}`, 3000),
    getSse(`${BASE}/api/sse/stream?jwt=${encodeURIComponent(TOKEN_B)}`, 3000),
  ]);
  test('Utilisateur A: HTTP 200', sseA3.status === 200, `status=${sseA3.status}`);
  test('Utilisateur B: HTTP 200', sseB1.status === 200, `status=${sseB1.status}`);
  const connectedA3 = sseA3.events.find((e) => e.type === 'connected');
  const connectedB1 = sseB1.events.find((e) => e.type === 'connected');
  let userIdA = null, userIdB = null;
  if (connectedA3) { try { userIdA = JSON.parse(connectedA3.data || '{}').userId; } catch {} }
  if (connectedB1) { try { userIdB = JSON.parse(connectedB1.data || '{}').userId; } catch {} }
  test('userId A != userId B (isolation)', userIdA !== null && userIdB !== null && userIdA !== userIdB, `A=${userIdA}, B=${userIdB}`);

  // ── Résumé ──
  console.log(`\n===== RÉSUMÉ SSE: ${passed} réussis, ${failed} échoués =====\n`);
  return failed === 0 ? 0 : 1;
}

main().then((code) => process.exit(code)).catch((e) => { console.error('ERREUR:', e.message); process.exit(1); });