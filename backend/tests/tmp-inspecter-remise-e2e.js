// Script d'inspection (temporaire) : état réel des données côté backend
// pour la validation E2E « Remise au détenteur ». Lecture seule.
const BASE = 'http://localhost:1337';

async function j(url, opts = {}) {
  const r = await fetch(url, opts);
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
  return { status: r.status, body };
}

(async () => {
  // 1. Connexion demandeur
  const login = await j(`${BASE}/api/auth/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'tolotra.randria@mtefop.gov.mg', password: 'demandeur123' }),
  });
  console.log('=== LOGIN demandeur ===', login.status);
  if (login.status !== 200) { console.log(login.body); return; }
  const jwt = login.body.jwt;
  const user = login.body.user;
  console.log('user:', user.username, '| id:', user.id, '| department:', user.department);

  const auth = { Authorization: `Bearer ${jwt}` };

  // 2. Rôle réel
  const role = await j(`${BASE}/api/session/role`, { headers: auth });
  console.log('\n=== SESSION ROLE ===', role.status, JSON.stringify(role.body?.data?.role));

  // 3. Toutes les sorties (sans filtre), champs essentiels + relations
  const sorties = await j(
    `${BASE}/api/sorties?pagination[pageSize]=100&sort=date_sortie:desc` +
    `&populate[direction]=true&populate[service]=true` +
    `&populate[lignes][populate][materiel]=true`,
    { headers: auth }
  );
  console.log('\n=== SORTIES ===', sorties.status, 'total =', sorties.body?.meta?.pagination?.total);
  for (const s of sorties.body?.data ?? []) {
    console.log(
      ` - ${s.reference} | docId=${s.documentId} | statut=${s.statut}` +
      ` | dir=${s.direction?.nom_direction ?? '—'} (${s.direction?.documentId ?? '—'})` +
      ` | lignes=${(s.lignes ?? []).length}` +
      ` | mag=${s.magasinier_signed} dep=${s.depositaire_signed} log=${s.logistique_signed}` +
      ` | stock_impacte=${s.stock_impacte}` +
      ` | cloturee=${s.remise_detenteur_cloturee}` +
      ` | date_remise_dt=${s.remise_detenteur_date ?? '—'}`
    );
    for (const l of s.lignes ?? []) {
      console.log(`      · ${l.designation ?? l.materiel?.designation ?? '—'} x${l.quantite} (ligne docId=${l.documentId})`);
    }
  }

  // 4. Réceptions physiques
  const receptions = await j(
    `${BASE}/api/receptions-physiques?pagination[pageSize]=100&populate[sortie][populate][direction]=true`,
    { headers: auth }
  );
  console.log('\n=== RECEPTIONS PHYSIQUES ===', receptions.status, 'total =', receptions.body?.meta?.pagination?.total);
  for (const r of receptions.body?.data ?? []) {
    console.log(
      ` - docId=${r.documentId} | sortie=${r.sortie?.documentId ?? '—'} (${r.sortie?.reference ?? '—'})` +
      ` | statut=${r.statut} | prévue=${r.quantite_prevue} reçue=${r.quantite_recue}` +
      ` | date=${r.date_reception} | dir=${r.sortie?.direction?.nom_direction ?? '—'}`
    );
  }

  // 5. Remises déjà enregistrées
  const remises = await j(
    `${BASE}/api/remises-detenteurs?pagination[pageSize]=100&populate[lignes][populate][sortie_ligne]=true&populate[sortie]=true`,
    { headers: auth }
  );
  console.log('\n=== REMISES DÉTENDEUR ===', remises.status, 'total =', remises.body?.meta?.pagination?.total);
  for (const r of remises.body?.data ?? []) {
    console.log(` - ${r.reference} | docId=${r.documentId} | date=${r.date_remise} | sortie=${r.sortie?.documentId ?? '—'} (${r.sortie?.reference ?? '—'})`);
    for (const l of r.lignes ?? []) {
      console.log(`      · ${l.sortie_ligne?.designation ?? '—'} → ${l.detenteur_nom} (${l.detenteur_fonction})`);
    }
  }

  // 6. Directions de l'utilisateur (pour la règle d'isolation)
  const dirs = await j(`${BASE}/api/directions?pagination[pageSize]=100`, { headers: auth });
  console.log('\n=== DIRECTIONS ===', dirs.status);
  for (const d of dirs.body?.data ?? []) {
    console.log(` - ${d.nom_direction} | abbr=${d.abreviation ?? '—'} | docId=${d.documentId}`);
  }
})();
