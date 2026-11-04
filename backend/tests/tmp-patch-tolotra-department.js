// Script pour changer le department de l'utilisateur tolotra (demandeur)
// afin qu'il matche le nom de direction existant "Direction des Ressources Humaines".
// Le filtre backend extrait le nom de direction depuis user.department et cherche
// nom_direction=$eqi <nom>. Avec "DRH - Service Gestion Personnel", il extrait "DRH"
// qui ne matche aucune direction. Avec "Direction des Ressources Humaines", il matche
// la direction existante (docId o6penoousqcbvhl1cfmg7f3u).
const BASE = 'http://localhost:1337';
const TOLOTRA_USER_ID = 15;

async function j(url, opts = {}) {
  const r = await fetch(url, opts);
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 500); }
  return { status: r.status, body };
}

(async () => {
  // Login admin
  const login = await j(`${BASE}/api/auth/local`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'm.rakoto@ministere.gov.mg', password: 'admin123' }),
  });
  if (login.status !== 200) { console.error('Login admin échoué:', JSON.stringify(login.body)); return; }
  const auth = { Authorization: `Bearer ${login.body.jwt}` };
  console.log('Admin connecté:', login.body.user.username);

  // PATCH utilisateur tolotra (id=15)
  const patch = await j(`${BASE}/api/users/${TOLOTRA_USER_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ data: { department: 'Direction des Ressources Humaines' } }),
  });
  console.log('PATCH department tolotra:', patch.status, JSON.stringify(patch.body?.error ?? patch.body));

  // Vérifier
  const me = await j(`${BASE}/api/users/me`, { headers: auth });
  console.log('Utilisateur connecté (me):', me.status, JSON.stringify(me.body?.data ?? me.body).slice(0, 300));
})();
