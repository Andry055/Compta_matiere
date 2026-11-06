// Script d'inspection (temporaire) : services et matériels disponibles.
const BASE = 'http://localhost:1337';

async function j(url, opts = {}) {
  const r = await fetch(url, opts);
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 400); }
  return { status: r.status, body };
}

(async () => {
  const login = await j(`${BASE}/api/auth/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'm.rakoto@ministere.gov.mg', password: 'admin123' }),
  });
  console.log('=== LOGIN admin ===', login.status);
  if (login.status !== 200) { console.log(JSON.stringify(login.body)); return; }
  const auth = { Authorization: `Bearer ${login.body.jwt}` };

  const services = await j(`${BASE}/api/services?pagination[pageSize]=100&populate[direction]=true`, { headers: auth });
  console.log('\n=== SERVICES ===', services.status, 'total =', services.body?.meta?.pagination?.total);
  for (const s of services.body?.data ?? []) {
    console.log(` - ${s.nom_service} | docId=${s.documentId} | dir=${s.direction?.nom_direction ?? '—'} (${s.direction?.documentId ?? '—'}) | responsable=${s.responsable ?? '—'}`);
  }

  const mats = await j(`${BASE}/api/materials?pagination[pageSize]=100&populate[categorie]=true`, { headers: auth });
  console.log('\n=== MATERIAUX ===', mats.status, 'total =', mats.body?.meta?.pagination?.total);
  for (const m of mats.body?.data ?? []) {
    console.log(` - ${m.designation} | docId=${m.documentId} | stock=${m.quantite_stock} | PU=${m.valeur_unitaire} | cat=${m.categorie?.nom ?? '—'}`);
  }

  const cats = await j(`${BASE}/api/categories?pagination[pageSize]=100`, { headers: auth });
  console.log('\n=== CATEGORIES ===', cats.status, 'total =', cats.body?.meta?.pagination?.total);
  for (const c of cats.body?.data ?? []) {
    console.log(` - ${c.nom} | docId=${c.documentId}`);
  }
})();
