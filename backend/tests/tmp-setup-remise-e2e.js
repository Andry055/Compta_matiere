// Script de création de données de test contrôlées pour l'E2E "Remise au détenteur".
// Crée des matériaux dédiés (préfixé "E2E-REMISE-"), puis toute la chaîne :
// demande facultative (non requise), sortie en DRH, 3 signatures, remise magasinier,
// réception physique du demandeur (quantite_recue > 0). Reliquat = 0 → sortie éligible.
// Toutes les données sont préfixées pour ne pas polluer les données métier existantes.
const BASE = 'http://localhost:1337';

let auth = {};

async function j(url, opts = {}) {
  const r = await fetch(url, opts);
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 500); }
  return { status: r.status, body };
}

async function login(email, password, role) {
  const r = await j(`${BASE}/api/auth/local`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });
  if (r.status !== 200) throw new Error(`Login ${role} (${email}) échoué: ${JSON.stringify(r.body)}`);
  auth.role = { Authorization: `Bearer ${r.body.jwt}` };
  console.log(`LOGIN ${role}: ${r.body.user.username} (id=${r.body.user.id}, dep=${r.body.user.department})`);
  return r.body.jwt;
}

async function postJSON(path, data) {
  return j(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth.role }, body: JSON.stringify(data) });
}

(async () => {
  try {
    // ── 1. Login admin pour créer les matériaux test ──
    await login('m.rakoto@ministere.gov.mg', 'admin123', 'ADMIN');

    const m1 = await postJSON('/api/materials', { data: {
      designation: 'E2E-REMISE-ClavierTest',
      quantite_stock: 5,
      valeur_unitaire: 1000,
      statut: 'en_stock',
      observations: 'Matériel créé pour test E2E remise détenteur - ne pas supprimer'
    }});
    console.log('Matériel 1:', m1.status, JSON.stringify(m1.body?.data ?? m1.body));

    const m2 = await postJSON('/api/materials', { data: {
      designation: 'E2E-REMISE-SourisTest',
      quantite_stock: 5,
      valeur_unitaire: 500,
      statut: 'en_stock',
      observations: 'Matériel créé pour test E2E remise détenteur - ne pas supprimer'
    }});
    console.log('Matériel 2:', m2.status, JSON.stringify(m2.body?.data ?? m2.body));

    const mat1 = m1.body?.data?.documentId ?? m1.body?.documentId;
    const mat2 = m2.body?.data?.documentId ?? m2.body?.documentId;

    // ── 2. Direction cible pour la sortie ──
    // Utilise la direction existante "Direction des Ressources Humaines" (abréviation "DRH").
    // Le filtre backend extrait "DRH" du department du demandeur ("DRH - Service Gestion Personnel")
    // et doit matcher via l'abréviation (correction sortie.js: documentIdsDuDirection).
    const DRH_DIR = 'o6penoousqcbvhl1cfmg7f3u'; // Direction des Ressources Humaines

    const SERVICE_GP = 'dp5nuo0iwj8z066ryko7zzuc'; // Service Gestion Personnel

    // ── 2b. Login dépositaire → créer la sortie en direction DRH ──
    await login('hery.rakoto@mtefop.gov.mg', 'depositaire123', 'DEPOSITAIRE');

    const sortie = await postJSON('/api/sorties/create-complete', { data: {
      date_sortie: '2026-10-29',
      justificatif: 'E2E Test Remise Détenteur',
      direction_id: DRH_DIR,
      service_id: SERVICE_GP,
      beneficiaire: 'Utilisateur E2E Test',
      lignes: [
        { materiel_id: mat1, designation: 'Clavier test E2E', quantite: 1 },
        { materiel_id: mat2, designation: 'Souris test E2E', quantite: 1 },
      ]
    }});
    console.log('Sortie créée:', sortie.status, JSON.stringify(sortie.body?.data ?? sortie.body).slice(0, 600));
    if (sortie.status !== 201) { console.log('ARRET création sortie'); return; }

    const sortieDocId = sortie.body?.data?.documentId ?? sortie.body?.id;
    const reference = sortie.body?.data?.reference;

    // ── 3. Signature magasinier (étape 1) ──
    await login('fara.andriam@mtefop.gov.mg', 'magasinier123', 'MAGASINIER');
    const lignesSortie = (await j(`${BASE}/api/sorties/${sortieDocId}?populate[lignes][populate][materiel]=true`, { headers: auth.role })).body?.data ?? {};
    const lignesIds = (lignesSortie.lignes ?? []).map(l => l.documentId);
    const ctrl = { role: 'magasinier', controles: lignesIds.map(id => ({ ligne: id, etat: 'neuf' })) };
    const s1 = await j(`${BASE}/api/sorties/${sortieDocId}/sign`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth.role }, body: JSON.stringify(ctrl) });
    console.log('Sign magasinier:', s1.status, s1.body?.error ? JSON.stringify(s1.body.error) : 'OK');

    // ── 4. Signature dépositaire (étape 2) ──
    await login('hery.rakoto@mtefop.gov.mg', 'depositaire123', 'DEPOSITAIRE');
    const s2 = await j(`${BASE}/api/sorties/${sortieDocId}/sign`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth.role }, body: JSON.stringify({ role: 'depositaire' }) });
    console.log('Sign dépositaire:', s2.status, s2.body?.error ? JSON.stringify(s2.body.error) : 'OK');

    // ── 5. Signature logistique (étape 3) ──
    await login('tojo.razaf@mtefop.gov.mg', 'logistique123', 'LOGISTIQUE');
    const s3 = await j(`${BASE}/api/sorties/${sortieDocId}/sign`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth.role }, body: JSON.stringify({ role: 'logistique' }) });
    console.log('Sign logistique:', s3.status, s3.body?.error ? JSON.stringify(s3.body.error) : 'OK');

    // ── 6. Remise magasinier → statut sortie_effectuee (re-login magasinier, car auth.role = logistique ici) ──
    await login('fara.andriam@mtefop.gov.mg', 'magasinier123', 'MAGASINIER');
    const s4 = await j(`${BASE}/api/sorties/${sortieDocId}/remise`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth.role }, body: JSON.stringify({ data: { date_remise: '2026-10-29' } }) });
    console.log('Remise magasinier (→ sortie_effectuee):', s4.status, s4.body?.error ? JSON.stringify(s4.body.error) : 'OK');

    // ── 7. Réception physique du demandeur DRH (quantite_recue > 0) ──
    await login('tolotra.randria@mtefop.gov.mg', 'demandeur123', 'DEMANDEUR');
    const rec = await postJSON('/api/receptions-physiques', { data: {
      sortieId: sortieDocId,
      date_reception: '2026-10-29',
      quantite_prevue: 2,
      quantite_recue: 2,
      statut: 'conforme',
      utilisateur: 'Randriamampionona Tolotra'
    }});
    console.log('Réception physique:', rec.status, rec.body?.error ? JSON.stringify(rec.body.error) : 'OK');

    // ── 8. Vérification finale ──
    const sorties = await j(`${BASE}/api/sorties?pagination[pageSize]=100&sort=date_sortie:desc&populate[direction]=true&populate[lignes][populate][materiel]=true`, { headers: auth.role });
    console.log('\n=== VERIFICATION ===');
    for (const s of sorties.body?.data ?? []) {
      console.log(` ${s.reference} | statut=${s.statut} | cloturee=${s.remise_detenteur_cloturee} | dir=${s.direction?.nom_direction} | lignes=${(s.lignes||[]).length}`);
    }

    const receptions = await j(`${BASE}/api/receptions-physiques?pagination[pageSize]=100&populate[sortie]=true`, { headers: auth.role });
    console.log(`Receptions: ${receptions.body?.data?.length ?? 0}`);
    for (const r of receptions.body?.data ?? []) {
      console.log(`  sortie=${r.sortie?.documentId} reçue=${r.quantite_recue}/${r.quantite_prevue} statut=${r.statut}`);
    }

  } catch (e) {
    console.error('ERREUR:', e.message);
  }
})();
