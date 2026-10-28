'use strict';

const http = require('http');

const BASE = 'http://localhost:1337';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // 1. S'authentifier comme magasinier
  const login = await request('POST', '/api/auth/local', {
    identifier: 'fara.andriam@mtefop.gov.mg',
    password: 'magasinier123',
  });
  const jwt = login.body.jwt;
  console.log('Authentifié comme magasinier (id:', login.body.user.id, ')');

  // 2. Récupérer une sortie en_preparation avec magasinier_signed = 1
  const sortie = await request(
    'GET',
    '/api/sorties/nelzmcwpizkvewmjghmusq85?populate=direction',
    null,
    jwt
  );
  console.log('Statut:', sortie.body.data?.statut);
  console.log('magasinier_signed:', sortie.body.data?.magasinier_signed);
  console.log('direction:', JSON.stringify(sortie.body.data?.direction));

  // 3. Récupérer la liste des utilisateurs pour vérifier les directions
  const users = await request('GET', '/api/users?populate=direction,role', null, jwt);
  console.log('\nUtilisateurs:');
  for (const u of users.body.data || []) {
    console.log(
      `  ${u.username} (id=${u.id}, role=${u.role?.name}, dir=${u.direction?.nom_direction || u.direction?.documentId || 'null'})`
    );
  }

  // 4. Vérifier notification_outboxes directement via l'API
  const notifs = await request('GET', '/api/notification-outbox/notifications', null, jwt);
  console.log('\nNotifications outbox pour l utilisateur connecté:');
  console.log('  Nombre:', notifs.body?.data?.length || 0);
  for (const n of notifs.body?.data || []) {
    console.log(`  - eventType=${n.event_type || n.eventType}, status=${n.status}, sortie_id=${n.sortie?.documentId || n.sortie_id}`);
  }
}

main().catch((e) => {
  console.error('ERREUR:', e.message);
  process.exit(1);
});
